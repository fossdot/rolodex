/// <reference path="../pb_data/types.d.ts" />
// PocketBase v0.23+ hook API (verified against v0.39).

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

// Force added_by = authenticated user, regardless of what the client sends.
// Prevents attribution fraud and score gaming via the API.
onRecordCreateRequest((e) => {
    if (e.auth) {
        e.record.set("added_by", e.auth.id);
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
        e.record.set("deleted_by", e.auth ? e.auth.id : "");
    } else if (wasDeleted && !isNowDeleted) {
        if (!e.auth || e.auth.getString("role") !== "admin") {
            throw new ForbiddenError("Only admins can restore deleted contacts.");
        }
        e.record.set("deleted_by", "");
    }

    e.next();
}, "contacts");
