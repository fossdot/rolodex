/// <reference path="../pb_data/types.d.ts" />
// PocketBase v0.23+ hook API (verified against v0.39).

// Production safety net for settings that live only in each box's database
// (not in tracked code), so nothing otherwise guarantees production stays
// protected. On every boot, if this instance is the production deployment
// (matched by its configured app URL):
//   1. MFA — re-enable it if it has been turned off (locally it is disabled
//      by the gitignored disable_mfa_local migration).
//   2. Backups — enable daily scheduled backups with 7-day retention if none
//      are configured, so a bad migration / accidental delete / corruption is
//      recoverable. NOTE: these are written to the same disk; configure S3 in
//      Settings > Backups for off-host copies that survive disk failure.
// Local/dev instances have a different app URL and are left alone (OTP-free
// login and no scheduled backups). Wrapped so a failure can never block boot.
onBootstrap((e) => {
    e.next();
    try {
        const appURL = String(e.app.settings().meta.appURL || "");
        if (appURL.indexOf("rolodex.fossunited.org") === -1) return; // not production

        const users = e.app.findCollectionByNameOrId("_pb_users_auth_");
        if (!users.mfa.enabled) {
            unmarshal({ "mfa": { "enabled": true } }, users);
            e.app.save(users);
            e.app.logger().warn("Re-enabled MFA on the users collection (production safety net).");
        }

        const settings = e.app.settings();
        if (!settings.backups.cron) {
            settings.backups.cron = "0 3 * * *"; // daily at 03:00
            settings.backups.cronMaxKeep = 7;
            e.app.save(settings);
            e.app.logger().warn("Enabled daily scheduled backups (production safety net). Set S3 in Settings > Backups for off-host copies.");
        }
    } catch (err) {
        e.app.logger().warn("Production safety-net check failed: " + err);
    }
});

// Restrict OAuth2 sign-in to @fossunited.org accounts only.
onRecordAuthWithOAuth2Request((e) => {
    const email = String(e.oAuth2User?.email ?? "");
    if (!email.endsWith("@fossunited.org")) {
        throw new ForbiddenError("Only @fossunited.org accounts are permitted.");
    }
    e.next();
}, "users");

// Restrict password sign-in to @fossunited.org emails only.
onRecordAuthWithPasswordRequest((e) => {
    const identity = String(e.identity ?? "");
    if (!identity.endsWith("@fossunited.org")) {
        throw new ForbiddenError("Only @fossunited.org accounts are permitted.");
    }
    e.next();
}, "users");

// Block creating users with non-@fossunited.org emails (applies to the
// admin UI and any API path), so the restriction holds at the source.
onRecordCreateRequest((e) => {
    const email = String(e.record.get("email") ?? "");
    if (!email.endsWith("@fossunited.org")) {
        throw new ForbiddenError("User emails must be @fossunited.org.");
    }
    e.next();
}, "users");

// Lock the `role` field on user updates. The users collection has no custom
// updateRule, so it defaults to "id = @request.auth.id" — i.e. any user can
// PATCH their own record. `role` is a plain writable field, so without this
// guard a user could set role:"admin" and self-escalate. Only superusers
// (the PocketBase admin UI) may change a role; for everyone else we revert
// it to the stored value regardless of what the client sends.
onRecordUpdateRequest((e) => {
    const isSuperuser = e.auth && e.auth.collection().name === "_superusers";
    if (!isSuperuser) {
        const original = e.app.findRecordById("users", e.record.id);
        e.record.set("role", original.get("role"));
    }
    e.next();
}, "users");

// Force added_by = authenticated user, regardless of what the client sends.
// Prevents attribution fraud and score gaming via the API.
// Also: when 'other' is picked in fu_roles/topics, the matching free-text
// field must be filled (the schema can't express conditional requirements).
onRecordCreateRequest((e) => {
    const { normaliseOrgDesignations } = require(`${__hooks}/utils.js`);
    if (e.auth) {
        e.record.set("added_by", e.auth.id);
    }

    // Per-organisation titles are pruned to the orgs actually linked.
    normaliseOrgDesignations(e.record);

    const roles = e.record.get("fu_roles") || [];
    if (roles.includes && roles.includes("other") && String(e.record.get("fu_roles_other") || "").trim() === "") {
        throw new BadRequestError("Please specify the 'other' FOSS United role.");
    }
    const topics = e.record.get("topics") || [];
    if (topics.includes && topics.includes("other") && String(e.record.get("topics_other") || "").trim() === "") {
        throw new BadRequestError("Please specify the 'other' topic.");
    }

    e.next();
}, "contacts");

// Force logged_by = authenticated user, regardless of what the client sends.
onRecordCreateRequest((e) => {
    if (e.auth) {
        e.record.set("logged_by", e.auth.id);
    }
    e.next();
}, "activities");

// On activity update (allowed for the logger or an admin so they can fix
// mistakes), re-pin the immutable fields to their stored values. A content edit
// may never change an activity's attribution (logged_by) or which contact it
// belongs to, no matter what the client sends.
//
// Soft delete/restore is the one exception. It is handled explicitly below so
// that `deleted_by` is always stamped from the authenticated caller rather than
// the request body, restoring stays admin-only, and an ordinary content edit
// can't drift the soft-delete state. Mirrors the contact update lock below.
onRecordUpdateRequest((e) => {
    const original = e.app.findRecordById("activities", e.record.id);

    e.record.set("logged_by", original.get("logged_by"));

    // The participant list IS content now that an activity can cover several
    // contacts (issue #6) — correcting who attended is a normal edit, so unlike
    // `logged_by` it is not re-pinned. Any pending follow-up whose contact has
    // been dropped from the activity is cleared below.

    // e.record is the merged record (original + incoming changes), so these
    // read final state — a partial update like soft-delete works as expected.
    const wasDeleted = original.getString("deleted_at") !== "";
    const isNowDeleted = e.record.getString("deleted_at") !== "";

    if (!wasDeleted && isNowDeleted) {
        // Soft delete. The updateRule already limits this to the activity's
        // logger or an admin; stamp who did it rather than trust the client.
        e.record.set("deleted_by", e.auth ? e.auth.id : "");

        // Pending follow-ups on a deleted activity would email everyone about
        // an interaction that no longer exists, so drop them. Only unsent ones:
        // `sent_at` rows are history. Best-effort — the reachout cron re-checks
        // the activity's deleted state before sending, so a failure here can't
        // leak a stale reminder. Restoring does not bring reminders back.
        try {
            const stale = e.app.findRecordsByFilter("reminders",
                "activity = {:a} && sent_at = ''", "", 200, 0, { a: original.id });
            for (const rem of stale) e.app.delete(rem);
        } catch (err) {
            e.app.logger().warn("Could not clear reminders for deleted activity",
                "activity", original.id, "error", String(err));
        }
    } else if (wasDeleted && !isNowDeleted) {
        // Restore is admin-only, matching contacts.
        const isSuperuser = e.auth && e.auth.collection().name === "_superusers";
        if (!isSuperuser && (!e.auth || e.auth.getString("role") !== "admin")) {
            throw new ForbiddenError("Only admins can restore deleted activities.");
        }
        e.record.set("deleted_by", "");
    } else {
        // Plain content edit — the soft-delete state is not up for negotiation.
        e.record.set("deleted_at", original.get("deleted_at"));
        e.record.set("deleted_by", original.get("deleted_by"));

        // Removing a participant orphans any follow-up aimed at them on this
        // activity, so drop those. Only unsent ones; `sent_at` rows are history.
        try {
            const stillOn = {};
            const after = e.record.get("contacts");
            if (Array.isArray(after)) for (const cid of after) stillOn[cid] = true;

            const pending = e.app.findRecordsByFilter("reminders",
                "activity = {:a} && sent_at = ''", "", 200, 0, { a: original.id });
            for (const rem of pending) {
                if (!stillOn[rem.getString("contact")]) e.app.delete(rem);
            }
        } catch (err) {
            e.app.logger().warn("Could not reconcile reminders after an activity edit",
                "activity", original.id, "error", String(err));
        }
    }

    // Never let an edit strand an activity with nobody on it.
    const after = e.record.get("contacts");
    if (!Array.isArray(after) || after.length === 0) {
        throw new BadRequestError("An activity needs at least one contact.");
    }

    // Roles follow the participant list — a dropped participant loses theirs.
    const { normaliseContactRoles } = require(`${__hooks}/utils.js`);
    normaliseContactRoles(e.record);

    e.next();
}, "activities");

// An activity must name at least one contact — the schema can't express
// "required" on a relation without also forcing it on every partial update, so
// it is checked here on the way in.
onRecordCreateRequest((e) => {
    const { normaliseContactRoles } = require(`${__hooks}/utils.js`);
    const ids = e.record.get("contacts");
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestError("An activity needs at least one contact.");
    }
    normaliseContactRoles(e.record);
    e.next();
}, "activities");

// Force editor = authenticated user on contact edit-log entries.
onRecordCreateRequest((e) => {
    if (e.auth) {
        e.record.set("editor", e.auth.id);
    }
    e.next();
}, "contact_logs");

// Reactions: force user = auth; re-reacting replaces the previous reaction
// (WhatsApp behaviour) so the unique (activity, user) index never trips.
onRecordCreateRequest((e) => {
    if (!e.auth || e.auth.collection().name !== "users") {
        throw new ForbiddenError("Reactions can only be added by app users.");
    }
    e.record.set("user", e.auth.id);

    const existing = e.app.findRecordsByFilter("reactions",
        "user = {:u} && activity = {:a}", "", 1, 0,
        { u: e.auth.id, a: e.record.getString("activity") });
    if (existing.length > 0) {
        e.app.delete(existing[0]);
    }

    e.next();
}, "reactions");

// On contact update:
//   - Lock added_by to its original value (can never be reassigned).
//   - If soft-deleting (deleted_at set), stamp deleted_by with the caller.
//   - If restoring (deleted_at cleared), require admin role.
onRecordUpdateRequest((e) => {
    const original = e.app.findRecordById("contacts", e.record.id);

    e.record.set("added_by", original.get("added_by"));

    const wasDeleted = original.getString("deleted_at") !== "";
    const isNowDeleted = e.record.getString("deleted_at") !== "";

    if (!wasDeleted && isNowDeleted) {
        // Editing is open to everyone, but only the contact's creator can delete.
        const isSuperuser = e.auth && e.auth.collection().name === "_superusers";
        const isOwner = e.auth && e.auth.id === original.getString("added_by");
        if (!isSuperuser && !isOwner) {
            throw new ForbiddenError("Only the contact's creator can delete it.");
        }
        e.record.set("deleted_by", e.auth ? e.auth.id : "");
    } else if (wasDeleted && !isNowDeleted) {
        const isSuperuser = e.auth && e.auth.collection().name === "_superusers";
        if (!isSuperuser && (!e.auth || e.auth.getString("role") !== "admin")) {
            throw new ForbiddenError("Only admins can restore deleted contacts.");
        }
        e.record.set("deleted_by", "");
    }

    // Designations follow the organisation list — unlinking an org drops its title.
    const { normaliseOrgDesignations } = require(`${__hooks}/utils.js`);
    normaliseOrgDesignations(e.record);

    // e.record is the merged record (original + incoming changes), so these
    // checks see final state — partial updates like soft-delete pass as long
    // as the stored record was valid.
    const roles = e.record.get("fu_roles") || [];
    if (roles.includes && roles.includes("other") && String(e.record.get("fu_roles_other") || "").trim() === "") {
        throw new BadRequestError("Please specify the 'other' FOSS United role.");
    }
    const topics = e.record.get("topics") || [];
    if (topics.includes && topics.includes("other") && String(e.record.get("topics_other") || "").trim() === "") {
        throw new BadRequestError("Please specify the 'other' topic.");
    }

    e.next();
}, "contacts");
