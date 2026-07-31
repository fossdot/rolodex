// Lists organisations that look like duplicates of each other, worst first, so
// they can be merged by renaming one to match the other exactly.
//   node org-dupes.mjs <superuser-email> <password> [api-url]
const [email, pw, url = 'http://127.0.0.1:8090'] = process.argv.slice(2);
const API = url.replace(/\/+$/, '') + '/api';
const j = async (r) => { try { return await r.json(); } catch { return null; } };

const auth = await j(await fetch(`${API}/collections/_superusers/auth-with-password`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identity: email, password: pw }),
}));
if (!auth?.token) { console.error('Could not authenticate as a superuser.'); process.exit(1); }
const H = { Authorization: auth.token };

const all = async (coll, q = '') => {
  const out = [];
  for (let p = 1; ; p++) {
    const r = await j(await fetch(`${API}/collections/${coll}/records?perPage=200&page=${p}${q}`, { headers: H }));
    out.push(...(r?.items || []));
    if (p >= (r?.totalPages || 1)) break;
  }
  return out;
};

const orgs = await all('organisations', '&sort=name');
const contacts = await all('contacts', '&filter=' + encodeURIComponent('deleted_at = null'));

const uses = {};
for (const c of contacts) for (const o of c.orgs || []) uses[o] = (uses[o] || 0) + 1;

// Strip case, punctuation and the usual corporate suffixes so "Acme" and
// "Acme, Inc" collapse to the same key.
const NOISE = /\b(inc|ltd|llc|llp|pvt|private|limited|corp|corporation|co|company|foundation|technologies|technology|tech|labs|lab|solutions|systems|services|india|global|group|the)\b/g;
const norm = (s) => s.toLowerCase().replace(/[.,'"()\-_/&]/g, ' ').replace(NOISE, ' ').replace(/\s+/g, ' ').trim();

const groups = {};
for (const o of orgs) { const k = norm(o.name) || o.name.toLowerCase(); (groups[k] ??= []).push(o); }
const dupes = Object.values(groups).filter((g) => g.length > 1)
  .sort((a, b) => (b.reduce((n, o) => n + (uses[o.id] || 0), 0)) - (a.reduce((n, o) => n + (uses[o.id] || 0), 0)));

console.log(`${orgs.length} organisations across ${contacts.length} live contacts\n`);
if (!dupes.length) console.log('No likely duplicates found.');
else {
  console.log(`${dupes.length} group(s) that look like the same organisation — merge by renaming one to match the other exactly:\n`);
  for (const g of dupes) console.log('  ' + g.map((o) => `"${o.name}" (${uses[o.id] || 0} contact${(uses[o.id] || 0) === 1 ? '' : 's'})`).join('   ↔   '));
}
const empty = orgs.filter((o) => !uses[o.id]);
if (empty.length) console.log(`\n${empty.length} organisation(s) with no live contacts:\n  ${empty.map((o) => o.name).join(', ')}`);
