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

module.exports = {
    normaliseCcEmails,
    MAX_CC_EMAILS,
    normaliseContactRoles,
    normaliseOrgDesignations,
    PARTICIPANT_ROLE_VALUES,
};
