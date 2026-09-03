/// <reference path="../pb_data/types.d.ts" />

// In-app team management. Until now an admin had no way to manage members:
// changing a role was superuser-only in the PocketBase dashboard, which Caddy
// blocks in production, so it meant an SSH tunnel.
//
// - `disabled` marks a member who has left. Sign-in is refused for them (see
//   pb_hooks/main.pb.js, which also refreshes their token key so sessions
//   already open stop working), while their name stays on every contact and
//   activity they added. Reversible — unlike deleting the account, which would
//   orphan `added_by`/`logged_by` and blank that attribution everywhere.
// - `updateRule` now lets an admin edit another member's record. *Which* fields
//   they may touch is decided in the hooks, not here: role and disabled only,
//   never on their own record, and never the last active admin.

migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")

  users.fields.add(new Field({
    "hidden": false,
    "id": "bool1795833654",
    "name": "disabled",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  unmarshal({
    "updateRule": "id = @request.auth.id || @request.auth.role = 'admin'",
    // Gates the auth endpoints: a disabled member can neither sign in nor
    // refresh their token. Since lib/pb.ts calls authRefresh() on load and
    // clears the auth store when it fails, that logs them out of the app on
    // their next page load. Measured on PocketBase 0.39.1: authRule is NOT
    // consulted on ordinary authenticated requests, so a raw token already in
    // hand keeps working for direct API calls until it expires (authToken
    // duration, 14 days by default). Neither refreshTokenKey() nor this rule
    // changes that.
    "authRule": "disabled = false",
  }, users)

  app.save(users)

  // Backfill every existing member explicitly. A row where `disabled` is NULL
  // rather than false is the difference between "everyone keeps working" and
  // "nobody can sign in", since a NULL never satisfies `disabled != true`.
  const members = app.findRecordsByFilter("users", "id != ''", "", 0, 0)
  for (const m of members) {
    m.set("disabled", false)
    app.save(m)
  }

  return null
}, (app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")

  users.fields.removeById("bool1795833654")

  unmarshal({
    "updateRule": "id = @request.auth.id",
    "authRule": "",
  }, users)

  return app.save(users)
})
