#!/usr/bin/env node
/**
 * Rolodex — Security patch for existing deployments.
 * Run this once against a live PocketBase instance to apply the collection-rule
 * fixes from the June 2025 security audit. The pb_hooks changes take effect on
 * the next PocketBase restart.
 *
 * Usage:
 *   node patch_security.js <admin-email> <admin-password>
 *
 * Safe to re-run — each patch is idempotent.
 */

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node patch_security.js <admin-email> <admin-password>');
  process.exit(1);
}

async function api(path, method = 'GET', body, token) {
  const res = await fetch(`${PB_URL}/api/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} /api/${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log(`\n🔗 Connecting to PocketBase at ${PB_URL}…`);

  const authData = await api('collections/_superusers/auth-with-password', 'POST', {
    identity: email,
    password,
  });
  const token = authData.token;
  console.log('✅ Authenticated as superuser');

  const existing = await api('collections?perPage=200', 'GET', undefined, token);
  const byName = Object.fromEntries(existing.items.map((c) => [c.name, c]));

  const contacts = byName['contacts'];
  const activities = byName['activities'];
  const users = byName['users'];

  if (!contacts) throw new Error('contacts collection not found — has setup.js been run?');
  if (!activities) throw new Error('activities collection not found');
  if (!users) throw new Error('users collection not found');

  // 1. Prevent added_by forgery: require client to send their own ID on create.
  //    The hook in pb_hooks/main.pb.js enforces this server-side as a second layer.
  // 2. Hide soft-deleted contacts from employees (list + view).
  await api(`collections/${contacts.id}`, 'PATCH', {
    createRule: "@request.auth.id != '' && @request.body.added_by = @request.auth.id",
    listRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
    viewRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
  }, token);
  console.log('✅ contacts — added_by forgery blocked; deleted contacts hidden from employees');

  // 3. Prevent logged_by forgery; hide soft-deleted activities from employees.
  await api(`collections/${activities.id}`, 'PATCH', {
    createRule: "@request.auth.id != '' && @request.auth.role != 'admin' && @request.body.contact.added_by = @request.auth.id && @request.body.logged_by = @request.auth.id",
    listRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
    viewRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
  }, token);
  console.log('✅ activities — logged_by forgery blocked; deleted activities hidden from employees');

  // 4. Restrict user listing to admins only (prevents employee enumeration).
  //    viewRule is left unchanged so expand: 'added_by' / 'logged_by' still works.
  await api(`collections/${users.id}`, 'PATCH', {
    listRule: "@request.auth.role = 'admin'",
  }, token);
  console.log('✅ users.listRule — restricted to admins');

  console.log('\n🎉 Collection rules patched.\n');
  console.log('Action required:');
  console.log('  → Restart PocketBase to activate the new pb_hooks/main.pb.js changes.');
  console.log('    The hooks enforce added_by/logged_by server-side and block non-admin restores.\n');
}

main().catch((err) => {
  console.error('\n❌ Patch failed:', err.message);
  process.exit(1);
});
