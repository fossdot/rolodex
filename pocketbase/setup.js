#!/usr/bin/env node
/**
 * Rolodex — PocketBase schema bootstrap
 * Compatible with PocketBase v0.23+
 * Run AFTER creating your PocketBase superuser account.
 *
 * Usage:
 *   node setup.js <admin-email> <admin-password>
 *
 * Example:
 *   node setup.js admin@fossunited.org mypassword
 */

const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node setup.js <admin-email> <admin-password>');
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

  // ── Authenticate as superuser ───────────────────────────────────────────────
  const authData = await api('collections/_superusers/auth-with-password', 'POST', { identity: email, password });
  const token = authData.token;
  console.log('✅ Authenticated as superuser');

  // ── Get existing collections ────────────────────────────────────────────────
  const existing = await api('collections?perPage=200', 'GET', undefined, token);
  const existingNames = new Set(existing.items.map((c) => c.name));

  // ── Extend the users collection with role + name ────────────────────────────
  const usersCol = existing.items.find((c) => c.name === 'users');
  if (usersCol) {
    const hasRole = usersCol.fields?.some((f) => f.name === 'role');
    const hasName = usersCol.fields?.some((f) => f.name === 'name');
    if (!hasRole || !hasName) {
      const extraFields = [];
      if (!hasName) {
        extraFields.push({ name: 'name', type: 'text', required: false });
      }
      if (!hasRole) {
        extraFields.push({
          name: 'role',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['admin', 'employee'],
        });
      }
      await api(`collections/${usersCol.id}`, 'PATCH', {
        fields: [...(usersCol.fields ?? []), ...extraFields],
      }, token);
      console.log('✅ Extended users collection (name, role)');
    } else {
      console.log('⏭  users collection already has name + role fields');
    }

    // Restrict user listing to admins; individual record view stays open for expands.
    await api(`collections/${usersCol.id}`, 'PATCH', {
      listRule: "@request.auth.role = 'admin'",
    }, token);
    console.log('✅ Restricted users.listRule to admins');
  }

  // ── Create contacts collection ──────────────────────────────────────────────
  if (existingNames.has('contacts')) {
    console.log('⏭  contacts collection already exists');
  } else {
    await api('collections', 'POST', {
      name: 'contacts',
      type: 'base',
      fields: [
        { name: 'name',             type: 'text',     required: false },
        { name: 'org',              type: 'text',     required: false },
        { name: 'designation',      type: 'text',     required: false },
        { name: 'city',             type: 'text',     required: false },
        { name: 'country',          type: 'text',     required: false },
        { name: 'email',            type: 'email',    required: false },
        { name: 'mobile',           type: 'text',     required: false },
        { name: 'secondary_email',  type: 'email',    required: false },
        { name: 'secondary_mobile', type: 'text',     required: false },
        { name: 'how_you_know',     type: 'text',     required: false },
        { name: 'linkedin',         type: 'url',      required: false },
        {
          name: 'fu_roles',
          type: 'select',
          required: false,
          maxSelect: 10,
          values: [
            'speaker', 'sponsor', 'meetup_host',
            'foss_club_ambassador_student', 'foss_club_ambassador_staff',
            'organising_volunteer', 'gov_board_expert',
            'mentor', 'project_maintainer', 'general',
          ],
        },
        {
          name: 'topics',
          type: 'select',
          required: false,
          maxSelect: 15,
          values: [
            'technologist', 'hardware', 'av_enthusiast', 'public_policy',
            'ai_ml', 'government', 'open_source', 'education', 'security',
            'devops', 'design', 'community', 'research', 'legal', 'finance',
          ],
        },
        {
          name: 'added_by',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'deleted_at', type: 'autodate', onCreate: false, onUpdate: false },
        { name: 'deleted_by', type: 'relation', required: false, collectionId: '_pb_users_auth_', cascadeDelete: false, maxSelect: 1 },
        { name: 'created',    type: 'autodate', onCreate: true,  onUpdate: false },
        { name: 'updated',    type: 'autodate', onCreate: true,  onUpdate: true  },
      ],
      listRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
      viewRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
      createRule: "@request.auth.id != '' && @request.body.added_by = @request.auth.id",
      updateRule: "@request.auth.id = added_by || @request.auth.role = 'admin'",
      deleteRule: "@request.auth.role = 'admin'",
    }, token);
    console.log('✅ Created contacts collection');
  }

  // ── Create activities collection ────────────────────────────────────────────
  const collections2 = await api('collections?perPage=200', 'GET', undefined, token);
  const contactsCol = collections2.items.find((c) => c.name === 'contacts');

  if (existingNames.has('activities')) {
    console.log('⏭  activities collection already exists');
  } else {
    await api('collections', 'POST', {
      name: 'activities',
      type: 'base',
      fields: [
        {
          name: 'contact',
          type: 'relation',
          required: true,
          collectionId: contactsCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'activity_type',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'proposed_talk', 'spoke_at_event', 'panel_discussion', 'conducted_workshop', 'wrote_content',
            'attended_event', 'attended_workshop', 'participated_hackathon',
            'hosted_meetup', 'established_foss_club', 'volunteered', 'general_volunteer', 'mentored_hackathon',
            'contributed_oss',
            'sponsored_event', 'applied_grant', 'received_grant', 'reviewed_grant', 'judged_project',
            'connected_sponsor', 'connected_venue', 'networking_call', 'expressed_interest',
            'other',
          ],
        },
        { name: 'event_name', type: 'text', required: true },
        { name: 'event_link', type: 'url',  required: false },
        { name: 'date',       type: 'date', required: false },
        { name: 'notes',      type: 'text', required: true },
        {
          name: 'logged_by',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'deleted_at', type: 'autodate', onCreate: false, onUpdate: false },
        { name: 'deleted_by', type: 'relation', required: false, collectionId: '_pb_users_auth_', cascadeDelete: false, maxSelect: 1 },
        { name: 'created',    type: 'autodate', onCreate: true,  onUpdate: false },
        { name: 'updated',    type: 'autodate', onCreate: true,  onUpdate: true  },
      ],
      listRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
      viewRule:   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
      // employees only, on their own contacts, and logged_by must be themselves
      createRule: "@request.auth.id != '' && @request.auth.role != 'admin' && @request.body.contact.added_by = @request.auth.id && @request.body.logged_by = @request.auth.id",
      // immutable: nobody can edit or delete activities via the API
      updateRule: null,
      deleteRule: null,
    }, token);
    console.log('✅ Created activities collection');
  }

  console.log('\n🎉 Setup complete! Your Rolodex database is ready.\n');
  console.log('Next steps:');
  console.log('  1. Create user accounts via the PocketBase admin UI (/_/)');
  console.log('     → Set role to "admin" for directors, "employee" for staff');
  console.log('  2. Run the frontend: cd ../frontend && npm install && npm run dev\n');
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
