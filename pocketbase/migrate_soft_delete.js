#!/usr/bin/env node
// One-time migration: adds soft-delete fields to contacts and activities.

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node migrate_soft_delete.js <admin-email> <admin-password>');
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
  const { token } = await api('collections/_superusers/auth-with-password', 'POST', { identity: email, password });
  console.log('✅ Authenticated');

  const { items } = await api('collections?perPage=200', 'GET', undefined, token);

  const softDeleteFields = [
    { name: 'deleted_at', type: 'autodate', onCreate: false, onUpdate: false },
    {
      name: 'deleted_by',
      type: 'relation',
      required: false,
      collectionId: '_pb_users_auth_',
      cascadeDelete: false,
      maxSelect: 1,
    },
  ];

  // contacts: admins can hard-delete records; activities must stay immutable (deleteRule: null).
  const rulesPerCollection = {
    contacts: {
      listRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
      viewRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
      deleteRule: "@request.auth.role = 'admin'",
    },
    activities: {
      listRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
      viewRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
      // deleteRule intentionally left unchanged (null) — activities are tamper-proof
    },
  };

  for (const name of ['contacts', 'activities']) {
    const col = items.find((c) => c.name === name);
    if (!col) { console.log(`⚠️  collection "${name}" not found, skipping`); continue; }

    const hasDeletedAt = col.fields?.some((f) => f.name === 'deleted_at');
    if (hasDeletedAt) {
      console.log(`⏭  ${name}: soft-delete fields already present`);
      continue;
    }

    await api(`collections/${col.id}`, 'PATCH', {
      fields: [...col.fields, ...softDeleteFields],
      ...rulesPerCollection[name],
    }, token);
    console.log(`✅ Updated ${name}`);
  }

  console.log('\n🎉 Migration complete!\n');
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
