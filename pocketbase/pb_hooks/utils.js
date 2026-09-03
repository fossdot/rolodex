/// <reference path="../pb_data/types.d.ts" />
// Shared helpers for the hook files.
//
// IMPORTANT: PocketBase runs each hook handler in its own goja runtime, with no
// access to the enclosing file's scope — a function declared at the top of a
// *.pb.js file is NOT visible inside `onRecordCreateRequest(...)` and fails at
// runtime with "X is not defined". Anything shared between handlers has to be
// required from inside the handler body, like so:
//
//     onRecordCreateRequest((e) => {
//         const { normaliseCcEmails } = require(`${__hooks}/utils.js`)
//         ...
//     }, "reminders")
//
// This file is deliberately named `utils.js`, not `utils.pb.js`, so PocketBase
// does not try to load it as a hook file of its own.

const CC_EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const MAX_CC_EMAILS = 20;

/**
 * Normalise and validate a reminder's free-text CC list in place.
 *
 * The field holds addresses that need not belong to a Rolodex user (a Google
 * group, a partner). Splitting/lowercasing/deduping here means the cron can
 * treat the stored value as a clean comma-separated list, and a typo is reported
 * to whoever typed it instead of silently losing an email days later.
 *
 * Throws BadRequestError on a malformed address or too many of them.
 */
function normaliseCcEmails(record) {
    const raw = String(record.getString("cc_emails") || "");
    if (!raw.trim()) { record.set("cc_emails", ""); return; }

    const seen = {};
    const out = [];
    const parts = raw.split(/[,;\s]+/);
    for (let i = 0; i < parts.length; i++) {
        const addr = parts[i].trim().toLowerCase();
        if (!addr) continue;
        if (!CC_EMAIL_RE.test(addr)) {
            throw new BadRequestError("'" + addr + "' is not a valid email address.");
        }
        if (seen[addr]) continue;
        seen[addr] = true;
        out.push(addr);
    }
    if (out.length > MAX_CC_EMAILS) {
        throw new BadRequestError("At most " + MAX_CC_EMAILS + " CC addresses.");
    }
    record.set("cc_emails", out.join(", "));
}

// ── per-entry label maps ─────────────────────────────────────────────────────
// `activities.contact_roles` and `contacts.org_designations` are JSON objects
// keyed by a related record's id. Both are normalised on write so a map can never
// outlive the relation it describes.

// Mirror of PARTICIPANT_ROLES in frontend/src/lib/constants.ts.
const PARTICIPANT_ROLE_VALUES = [
    "speaker", "organiser", "volunteer", "sponsor", "attendee",
    "mentor", "judge", "maintainer", "host", "other",
];

const MAX_DESIGNATION_LEN = 120;

/**
 * Read a json field as a plain object.
 *
 * PocketBase hands json fields to the JS runtime inconsistently depending on how
 * they were written — sometimes an object, sometimes the raw JSON text — so try
 * the object form and fall back to parsing the string.
 */
function readJsonObject(record, field) {
    const direct = record.get(field);
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
        // A goja-wrapped Go map yields no keys via Object.keys; fall through then.
        if (Object.keys(direct).length > 0) return direct;
    }
    const raw = String(record.getString(field) || "").trim();
    if (!raw || raw === "null") return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
        return {};
    }
}

/** ids currently held by a multi-relation, as a lookup object. */
function relationIdSet(record, field) {
    const out = {};
    const ids = record.get(field);
    if (Array.isArray(ids)) {
        for (const id of ids) out[String(id)] = true;
    } else {
        // Fall back to the JSON text, same reasoning as readJsonObject.
        const raw = String(record.getString(field) || "").trim();
        if (raw && raw !== "null") {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) for (const id of parsed) out[String(id)] = true;
                else if (raw) out[raw] = true;
            } catch (e) {
                if (raw) out[raw] = true;
            }
        }
    }
    return out;
}

/**
 * Keep `activities.contact_roles` to participants who are actually on the
 * activity, and reject any role outside the agreed vocabulary. Dropping someone
 * from an activity therefore also drops their role.
 */
function normaliseContactRoles(record) {
    const onActivity = relationIdSet(record, "contacts");
    const given = readJsonObject(record, "contact_roles");
    const out = {};
    for (const id of Object.keys(given)) {
        if (!onActivity[id]) continue; // no longer a participant
        const role = String(given[id] || "").trim().toLowerCase();
        if (!role) continue;
        if (PARTICIPANT_ROLE_VALUES.indexOf(role) === -1) {
            throw new BadRequestError("'" + role + "' is not a valid participant role.");
        }
        out[id] = role;
    }
    record.set("contact_roles", out);
}

/**
 * Keep `contacts.org_designations` to organisations the contact is actually
 * linked to. Free text, so only trimmed and length-capped.
 */
function normaliseOrgDesignations(record) {
    const linked = relationIdSet(record, "orgs");
    const given = readJsonObject(record, "org_designations");
    const out = {};
    for (const id of Object.keys(given)) {
        if (!linked[id]) continue; // no longer one of the contact's orgs
        const text = String(given[id] || "").trim();
        if (!text) continue;
        if (text.length > MAX_DESIGNATION_LEN) {
            throw new BadRequestError("A designation must be " + MAX_DESIGNATION_LEN + " characters or fewer.");
        }
        out[id] = text;
    }
    record.set("org_designations", out);
}

// ── team members on an activity (issue #26) ──────────────────────────────────

/** ids held by a multi-relation, in order, de-duplicated, blanks dropped. */
function relationIds(record, field) {
    const raw = record.get(field);
    let list = [];
    if (Array.isArray(raw)) {
        list = raw;
    } else {
        // Fall back to the JSON text, same reasoning as readJsonObject.
        const text = String(record.getString(field) || "").trim();
        if (text && text !== "null") {
            try {
                const parsed = JSON.parse(text);
                list = Array.isArray(parsed) ? parsed : [text];
            } catch (e) {
                list = [text];
            }
        }
    }
    const out = [];
    const seen = {};
    for (const id of list) {
        const s = String(id || "").trim();
        if (!s || seen[s]) continue;
        seen[s] = true;
        out.push(s);
    }
    return out;
}

/**
 * Keep `activities.team` to the *other* members on an activity. Whoever logged
 * it is on it by definition, so they are never listed twice; duplicates
 * collapse. Whether each id is a real user is PocketBase's relation check.
 */
function normaliseTeam(record) {
    const logger = String(record.getString("logged_by") || "");
    record.set("team", relationIds(record, "team").filter((id) => id !== logger));
}

/**
 * Email the members newly tagged on an activity — one message to all of them.
 *
 * Called by the activities hooks *after* `e.next()`, so the row is saved by the
 * time this runs, and wrapped there in try/catch: a mail outage must never fail
 * (or roll back) a logged activity. `actor` is the auth record doing the save,
 * `newIds` the member ids that were not on the activity before it.
 */
function notifyTaggedMembers(app, activity, actor, newIds) {
    if (!newIds || !newIds.length) return;
    if (activity.getString("deleted_at") !== "") return;

    const settings = app.settings();
    const appURL = String(settings.meta.appURL || "").replace(/\/+$/, "");

    const esc = (s) => String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const humanize = (v) => String(v || "")
        .split("_").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
    const stripHtml = (s) => String(s || "")
        .replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
    const istDate = (stored) => {
        const d = new Date(String(stored).replace(" ", "T"));
        if (isNaN(d.getTime())) return "";
        const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000); // +05:30
        const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${ist.getUTCDate()} ${mons[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
    };

    // Recipients: the newly tagged members who have an address. Someone tagging
    // themselves on an edit gets no mail about it.
    const actorId = actor ? String(actor.id) : "";
    const to = [];
    for (const uid of newIds) {
        if (uid === actorId) continue;
        let member;
        try { member = app.findRecordById("users", uid); } catch (e) { continue; }
        const addr = member.getString("email");
        if (addr) to.push({ address: addr, name: member.getString("name") || "" });
    }
    if (!to.length) return;

    const actorName = (actor && (actor.getString("name") || actor.getString("email"))) || "A teammate";

    // Who it was with — each contact's name and primary organisation, as the
    // feed shows them. The first contact is also where the link lands.
    const contactIds = relationIds(activity, "contacts");
    const withLabels = [];
    for (const cid of contactIds) {
        let c;
        try { c = app.findRecordById("contacts", cid); } catch (e) { continue; }
        let org = "";
        const orgIds = relationIds(c, "orgs");
        if (orgIds.length) {
            try { org = app.findRecordById("organisations", orgIds[0]).getString("name"); } catch (e) { /* org row removed */ }
        }
        const name = c.getString("name");
        withLabels.push(name && org ? `${name} (${org})` : (name || org || "Unknown"));
    }
    const link = appURL && contactIds.length ? `${appURL}/contacts/${contactIds[0]}?activity=${activity.id}` : "";

    const type = humanize(activity.getString("activity_type"));
    const ev = activity.getString("event_name");
    const when = istDate(activity.getString("date"));
    const head = [type, ev].filter(Boolean).join(" — ") + (when ? ` (${when})` : "");
    const notes = stripHtml(activity.getString("notes"));
    const notesShort = notes.length > 320 ? notes.slice(0, 320) + "…" : notes;

    const html =
        `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;max-width:560px;line-height:1.5">` +
        `<p style="margin:0 0 16px">Hi,</p>` +
        `<p style="margin:0 0 16px"><strong>${esc(actorName)}</strong> tagged you on an activity in Rolodex.</p>` +
        `<div style="margin:0 0 18px;padding:12px 14px;background:#f0faf5;border:1px solid #cdebdd;border-radius:8px">` +
        `<div style="font-size:13px;color:#111827;font-weight:600">${esc(head)}</div>` +
        (withLabels.length ? `<div style="font-size:13px;color:#374151;margin-top:4px">With ${esc(withLabels.join(", "))}</div>` : "") +
        (notesShort ? `<div style="font-size:13px;color:#374151;margin-top:8px">${esc(notesShort)}</div>` : "") +
        `</div>` +
        (link
            ? `<p style="margin:0 0 18px"><a href="${esc(link)}" style="display:inline-block;background:#278F5E;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:14px;font-weight:600">Open in Rolodex →</a></p>`
            : "") +
        `<p style="margin:0;color:#9ca3af;font-size:12px">You can edit the activity to add what you remember. Being tagged records that you were part of it; the entry stays credited to whoever logged it.</p>` +
        `</div>`;

    const textLines = ["Hi,", "", `${actorName} tagged you on an activity in Rolodex.`, "", head];
    if (withLabels.length) textLines.push(`With ${withLabels.join(", ")}`);
    if (notesShort) textLines.push("", notesShort);
    if (link) textLines.push("", `Open: ${link}`);
    textLines.push("", "You can edit the activity to add what you remember. The entry stays credited to whoever logged it.");

    const message = new MailerMessage({
        from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
        to: to,
        subject: `${actorName} tagged you on an activity` + (ev ? `: ${ev}` : ""),
        html: html,
        text: textLines.join("\n"),
    });
    app.newMailClient().send(message);
    app.logger().info("Notified tagged team members", "activity", activity.id, "to", to.length);
}

module.exports = {
    normaliseCcEmails,
    MAX_CC_EMAILS,
    normaliseContactRoles,
    normaliseOrgDesignations,
    PARTICIPANT_ROLE_VALUES,
    relationIds,
    normaliseTeam,
    notifyTaggedMembers,
};
