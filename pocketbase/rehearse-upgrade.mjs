// Pre-deploy rehearsal: proves a pending migration does not damage existing data.
//
// Run it against a COPY of production. It snapshots every record before the
// migration, then diffs the result afterwards, so you find out about data loss on
// your machine rather than in production.
//
// Usage (two phases, either side of the migrating restart):
//
//   node pocketbase/rehearse-upgrade.mjs before  <url> <superuser-email> <password>
//   …restart PocketBase so the new migrations apply…
//   node pocketbase/rehearse-upgrade.mjs after   <url> <superuser-email> <password>
//
// The snapshot is written to pocketbase/.rehearsal-snapshot.json (gitignored).
//
// Fields listed in EXPECTED_REMOVED / EXPECTED_ADDED are the ones a migration is
// meant to change; every other field must come across untouched. Update those
// lists when you add a migration that reshapes a collection.

import fs from 'node:fs';
import path from 'node:path';

const [phase, url = 'http://127.0.0.1:8090', email, password] = process.argv.slice(2);
const SNAP = path.join(import.meta.dirname, '.rehearsal-snapshot.json');
const COLLECTIONS = ['contacts', 'activities', 'reminders', 'reactions', 'contact_logs', 'organisations'];

// Fields a migration deliberately drops or introduces — never flagged as drift.
const EXPECTED_REMOVED = { contacts: ['org'], activities: ['contact'] };
const EXPECTED_ADDED = {
  contacts: ['orgs', 'org_designations'],
  activities: ['contacts', 'contact_roles'],
  reminders: ['cc', 'cc_emails'],
};

if (!['before', 'after'].includes(phase) || !email || !password) {
  console.error('usage: node pocketbase/rehearse-upgrade.mjs <before|after> <url> <superuser-email> <password>');
  process.exit(2);
}

const api = (p) => `${url.replace(/\/+$/, '')}/api${p}`;
async function req(p, o = {}) {
  const r = await fetch(api(p), {
    method: o.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(o.token ? { Authorization: o.token } : {}) },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
}

const auth = await req('/collections/_superusers/auth-with-password', { method: 'POST', body: { identity: email, password } });
const token = auth.json?.token;
if (!token) { console.error(`could not authenticate as a superuser: ${auth.status} ${JSON.stringify(auth.json)}`); process.exit(2); }

/** Every record in a collection, or null when the collection does not exist yet. */
async function dump(coll) {
  const out = [];
  for (let page = 1; ; page++) {
    const r = await req(`/collections/${coll}/records?perPage=500&page=${page}&sort=created`, { token });
    if (r.status === 404) return null;
    if (r.status !== 200) { console.error(`  could not read ${coll}: ${r.status}`); return null; }
    out.push(...(r.json.items || []));
    if (page >= (r.json.totalPages || 1)) break;
  }
  return out;
}

const data = {};
for (const c of COLLECTIONS) data[c] = await dump(c);

// ── before: just record the state ───────────────────────────────────────────
if (phase === 'before') {
  fs.writeFileSync(SNAP, JSON.stringify(data, null, 2));
  console.log('snapshot written to', SNAP);
  for (const c of COLLECTIONS) console.log(`  ${c.padEnd(15)} ${data[c] === null ? '(absent)' : data[c].length + ' records'}`);
  console.log('\nNow restart PocketBase so the migrations apply, then run the "after" phase.');
  process.exit(0);
}

// ── after: diff ─────────────────────────────────────────────────────────────
if (!fs.existsSync(SNAP)) { console.error(`no snapshot at ${SNAP} — run the "before" phase first.`); process.exit(2); }
const before = JSON.parse(fs.readFileSync(SNAP, 'utf8'));

let problems = 0;
const bad = (m) => { problems++; console.log('  FAIL  ' + m); };
const ok = (m) => console.log('  ok    ' + m);

console.log('═══ row counts ═══');
for (const c of COLLECTIONS) {
  const b = before[c], a = data[c];
  if (b === null) { console.log(`  new   ${c}: ${a === null ? 'absent' : a.length + ' records'}`); continue; }
  if (a === null) { bad(`${c}: collection disappeared (had ${b.length} records)`); continue; }
  if (a.length < b.length) bad(`${c}: ${b.length} → ${a.length} — ${b.length - a.length} record(s) LOST`);
  else ok(`${c}: ${b.length} → ${a.length}`);
}

console.log('\n═══ field-level drift on pre-existing records ═══');
for (const c of COLLECTIONS) {
  const b = before[c], a = data[c];
  if (!b || !a) continue;
  const removed = new Set(EXPECTED_REMOVED[c] || []);
  const added = new Set(EXPECTED_ADDED[c] || []);
  const byId = new Map(a.map((r) => [r.id, r]));
  const drift = [];
  let missing = 0;
  for (const rec of b) {
    const now = byId.get(rec.id);
    if (!now) { missing++; continue; }
    for (const f of Object.keys(rec)) {
      if (removed.has(f) || added.has(f) || f === 'updated' || f === 'expand') continue;
      if (JSON.stringify(rec[f]) !== JSON.stringify(now[f])) {
        drift.push(`${rec.id}.${f}: ${JSON.stringify(rec[f])} → ${JSON.stringify(now[f])}`);
      }
    }
  }
  if (missing) bad(`${c}: ${missing} pre-existing record(s) no longer present`);
  if (drift.length) {
    bad(`${c}: ${drift.length} unexpected field change(s)`);
    for (const d of drift.slice(0, 8)) console.log('          ' + d);
    if (drift.length > 8) console.log(`          …and ${drift.length - 8} more`);
  } else if (!missing) ok(`${c}: every carried-over field identical`);
}

console.log('\n═══ organisation backfill ═══');
if (before.contacts && data.organisations) {
  const orgName = new Map(data.organisations.map((o) => [o.id, o.name]));
  const nowById = new Map(data.contacts.map((c) => [c.id, c]));
  let checked = 0, wrong = [];
  for (const b of before.contacts) {
    const was = String(b.org ?? '').trim();
    const now = nowById.get(b.id);
    if (!now) continue;
    const names = (now.orgs || []).map((id) => orgName.get(id)).filter(Boolean);
    if (!was) {
      if (names.length) wrong.push(`${b.id}: had no org, now ${JSON.stringify(names)}`);
    } else {
      checked++;
      // Case-insensitive: identical spellings intentionally collapse to one record.
      if (!names.some((n) => n.toLowerCase() === was.toLowerCase())) {
        wrong.push(`${b.id}: org ${JSON.stringify(was)} not represented in ${JSON.stringify(names)}`);
      }
    }
  }
  if (wrong.length) { bad(`${wrong.length} contact(s) with a mis-mapped organisation`); for (const w of wrong.slice(0, 8)) console.log('          ' + w); }
  else ok(`all ${checked} contacts that had an org are linked to it`);

  const dupes = new Map();
  for (const o of data.organisations) {
    const k = o.name.trim().toLowerCase();
    dupes.set(k, (dupes.get(k) || 0) + 1);
  }
  const dup = [...dupes.entries()].filter(([, n]) => n > 1);
  if (dup.length) bad(`duplicate organisations: ${JSON.stringify(dup)}`);
  else ok(`${data.organisations.length} organisations, no duplicates`);
} else console.log('  (skipped — no organisations collection)');

console.log('\n═══ activity participants ═══');
if (before.activities && data.activities) {
  const nowById = new Map(data.activities.map((a) => [a.id, a]));
  const wrong = [];
  for (const b of before.activities) {
    const now = nowById.get(b.id);
    if (!now) continue;
    const had = String(b.contact ?? '').trim();
    const has = now.contacts || [];
    if (had && !has.includes(had)) wrong.push(`${b.id}: contact ${had} missing from ${JSON.stringify(has)}`);
    if (!had && has.length) wrong.push(`${b.id}: had no contact, now ${JSON.stringify(has)}`);
  }
  if (wrong.length) { bad(`${wrong.length} activity/activities with a mis-mapped contact`); for (const w of wrong.slice(0, 8)) console.log('          ' + w); }
  else ok('every activity kept its original contact');
} else console.log('  (skipped)');

console.log(`\n${problems === 0 ? '✅ NO DATA LOSS DETECTED' : `❌ ${problems} PROBLEM(S) — do not deploy until these are understood`}`);
process.exit(problems === 0 ? 0 : 1);
