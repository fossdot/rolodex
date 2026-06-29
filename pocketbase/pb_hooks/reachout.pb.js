/// <reference path="../pb_data/types.d.ts" />
// Reach-out reminders — a follow-up attached to an activity.
//
// A `reminders` row carries the contact, the activity it follows up on, when to
// fire (`remind_at`, a UTC instant scheduled in IST), and who to email
// (`notify`). We wake every 5 minutes and email the assignee for any reminder
// whose time has arrived, then stamp `sent_at` so it fires exactly once and
// flips to "Reminded" in the UI. Storing an absolute instant keeps the check
// trivial — `remind_at <= now` — and recovers reminders that came due while the
// server was down.

// Force created_by to the caller (and default notify to them) on create.
onRecordCreateRequest((e) => {
    if (e.auth) {
        e.record.set("created_by", e.auth.id);
        if (!e.record.getString("notify")) e.record.set("notify", e.auth.id);
    }
    e.next();
}, "reminders");

cronAdd("reachout-reminders", "*/5 * * * *", () => {
    try {
        // PocketBase stores datetimes as "YYYY-MM-DD HH:MM:SS.sssZ" (space).
        const nowUTC = new Date().toISOString().replace("T", " ");

        const due = $app.findRecordsByFilter(
            "reminders",
            "sent_at = '' && remind_at <= {:now}",
            "remind_at", 200, 0,
            { now: nowUTC }
        );
        if (!due.length) return;

        const settings = $app.settings();
        const appURL = String(settings.meta.appURL || "").replace(/\/+$/, "");
        const mailClient = $app.newMailClient();

        // ── formatting helpers ──────────────────────────────────────────────────
        const esc = (s) => String(s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const humanize = (v) => String(v)
            .split("_").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
        const humanizeList = (arr) => (Array.isArray(arr) ? arr.map(humanize).join(", ") : "");
        const stripHtml = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
        const istDate = (stored) => {
            const d = new Date(String(stored).replace(" ", "T"));
            if (isNaN(d.getTime())) return "";
            const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000); // +05:30
            const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${ist.getUTCDate()} ${mons[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
        };
        const istLabel = (stored) => {
            const d = new Date(String(stored).replace(" ", "T"));
            if (isNaN(d.getTime())) return "";
            const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
            let h = ist.getUTCHours();
            const ampm = h >= 12 ? "PM" : "AM";
            h = h % 12 || 12;
            return `${istDate(stored)}, ${h}:${String(ist.getUTCMinutes()).padStart(2, "0")} ${ampm} IST`;
        };

        for (const rem of due) {
            try {
                const contact = $app.findRecordById("contacts", rem.getString("contact"));
                // Skip (and clean up) reminders on contacts that were deleted.
                if (contact.getString("deleted_at") !== "") {
                    $app.delete(rem);
                    continue;
                }

                const assigneeId = rem.getString("notify") || rem.getString("created_by");
                if (!assigneeId) { $app.logger().warn("Reminder skipped: no assignee", "reminder", rem.id); continue; }

                let user;
                try { user = $app.findRecordById("users", assigneeId); }
                catch (e) { $app.logger().warn("Reminder skipped: assignee not found", "reminder", rem.id); continue; }
                const toEmail = user.getString("email");
                if (!toEmail) continue;

                // Activity this reminder follows up on (the reason it's useful).
                let activity = null;
                try { activity = $app.findRecordById("activities", rem.getString("activity")); } catch (e) { /* may be gone */ }

                // ── contact metadata (useful when forwarded internally) ─────────────
                const cname = contact.getString("name") || contact.getString("org") || "your contact";
                const subtitle = [contact.getString("designation"), contact.getString("org")].filter(Boolean).join(", ");
                const link = appURL ? `${appURL}/contacts/${contact.id}` : "";

                let addedByName = "";
                try {
                    const ab = $app.findRecordById("users", contact.getString("added_by"));
                    addedByName = ab.getString("name") || ab.getString("email");
                } catch (e) { /* added_by may be unset */ }

                const li = contact.getString("linkedin");
                const liHref = li ? (li.indexOf("http") === 0 ? li : "https://" + li) : "";

                const rows = [];
                const row = (label, html) => {
                    if (!html) return;
                    rows.push(
                        `<tr><td style="padding:5px 14px 5px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top">${esc(label)}</td>` +
                        `<td style="padding:5px 0;color:#111827;font-size:13px;vertical-align:top">${html}</td></tr>`
                    );
                };
                const emails = [contact.getString("email"), contact.getString("secondary_email")].filter(Boolean).join(", ");
                const mobiles = [contact.getString("mobile"), contact.getString("secondary_mobile")].filter(Boolean).join(", ");
                const location = [contact.getString("city"), contact.getString("country")].filter(Boolean).join(", ");
                row("Email", emails ? esc(emails) : "");
                row("Mobile", mobiles ? esc(mobiles) : "");
                row("Location", location ? esc(location) : "");
                row("LinkedIn", liHref ? `<a href="${esc(liHref)}" style="color:#278F5E;text-decoration:none">${esc(li)}</a>` : "");
                row("FOSS United", esc(humanizeList(contact.get("fu_roles"))));
                row("Topics", esc(humanizeList(contact.get("topics"))));
                row("Added by", addedByName ? esc(addedByName) : "");

                // ── activity context block ──────────────────────────────────────────
                let activityHtml = "", activityText = "";
                if (activity) {
                    const at = humanize(activity.getString("activity_type"));
                    const ev = activity.getString("event_name");
                    const adate = istDate(activity.getString("date"));
                    const anotes = stripHtml(activity.getString("notes"));
                    const head = [at, ev].filter(Boolean).join(" — ") + (adate ? ` (${adate})` : "");
                    const notesShort = anotes ? (anotes.length > 320 ? anotes.slice(0, 320) + "…" : anotes) : "";
                    activityHtml =
                        `<div style="margin:0 0 18px;padding:12px 14px;background:#f0faf5;border:1px solid #cdebdd;border-radius:8px">` +
                        `<div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;margin-bottom:3px">Following up on</div>` +
                        `<div style="font-size:13px;color:#111827;font-weight:600">${esc(head)}</div>` +
                        (notesShort ? `<div style="font-size:13px;color:#374151;margin-top:4px">${esc(notesShort)}</div>` : "") +
                        `</div>`;
                    activityText = `Following up on: ${head}` + (notesShort ? `\n${notesShort}` : "");
                }

                const when = istLabel(rem.getString("remind_at"));
                const greeting = user.getString("name") ? " " + esc(user.getString("name")) : "";

                const html =
                    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;max-width:560px;line-height:1.5">` +
                    `<p style="margin:0 0 4px">Hi${greeting},</p>` +
                    `<p style="margin:0 0 16px">This is your Rolodex reminder to reach out to <strong>${esc(cname)}</strong>${subtitle ? ` <span style="color:#6b7280">— ${esc(subtitle)}</span>` : ""}.</p>` +
                    activityHtml +
                    (rows.length
                        ? `<table style="border-collapse:collapse;margin:0 0 18px;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px 0">${rows.join("")}</table>`
                        : "") +
                    (link
                        ? `<p style="margin:0 0 18px"><a href="${esc(link)}" style="display:inline-block;background:#278F5E;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:14px;font-weight:600">Open contact in Rolodex →</a></p>`
                        : "") +
                    `<p style="margin:0;color:#9ca3af;font-size:12px">${when ? `Scheduled for ${esc(when)}. ` : ""}This reminder won't repeat — set a new follow-up on the activity for another nudge.</p>` +
                    `</div>`;

                const textLines = [`Hi${user.getString("name") ? " " + user.getString("name") : ""},`, "",
                    `Reminder to reach out to ${cname}${subtitle ? " (" + subtitle + ")" : ""}.`];
                if (activityText) { textLines.push("", activityText); }
                textLines.push("");
                if (emails) textLines.push(`Email: ${emails}`);
                if (mobiles) textLines.push(`Mobile: ${mobiles}`);
                if (location) textLines.push(`Location: ${location}`);
                if (humanizeList(contact.get("fu_roles"))) textLines.push(`FOSS United: ${humanizeList(contact.get("fu_roles"))}`);
                if (humanizeList(contact.get("topics"))) textLines.push(`Topics: ${humanizeList(contact.get("topics"))}`);
                if (addedByName) textLines.push(`Added by: ${addedByName}`);
                if (link) { textLines.push("", `Open: ${link}`); }
                if (when) { textLines.push("", `Scheduled for ${when}. Won't repeat.`); }

                const message = new MailerMessage({
                    from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
                    to: [{ address: toEmail }],
                    subject: `Reach out to ${cname} today`,
                    html: html,
                    text: textLines.join("\n"),
                });

                mailClient.send(message);

                // Stamp sent_at → fires once, flips to "Reminded" in the UI, moves
                // to the bell's Sent list. Direct save bypasses the API rules.
                rem.set("sent_at", nowUTC);
                $app.save(rem);

                $app.logger().info("Sent reach-out reminder", "reminder", rem.id, "contact", contact.id, "to", toEmail);
            } catch (err) {
                $app.logger().error("Reach-out reminder failed", "reminder", rem.id, "error", String(err));
            }
        }
    } catch (err) {
        $app.logger().error("Reach-out reminder cron failed", "error", String(err));
    }
});
