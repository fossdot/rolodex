/// <reference path="../pb_data/types.d.ts" />

// Security hardening migration — June 2026 audit.
//
// Fixes four collection-rule regressions that were introduced by earlier migrations:
//
//  contacts.listRule/viewRule  — deleted contacts were visible to all employees via the API
//  contacts.createRule         — added_by could be forged (hooks covered this, but no defence-in-depth)
//  activities.listRule/viewRule — deleted activities were visible to all employees via the API
//  activities.createRule       — logged_by could be forged (hooks covered this, but no defence-in-depth)
//  users.listRule              — all employees could enumerate team members (names, emails, roles)

migrate((app) => {
  // ── contacts ─────────────────────────────────────────────────────────────────
  const contacts = app.findCollectionByNameOrId("contacts")
  unmarshal({
    "listRule":   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
    "viewRule":   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
    "createRule": "@request.auth.id != '' && @request.body.added_by = @request.auth.id",
  }, contacts)
  app.save(contacts)

  // ── activities ────────────────────────────────────────────────────────────────
  const activities = app.findCollectionByNameOrId("activities")
  unmarshal({
    "listRule":   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
    "viewRule":   "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
    "createRule": "@request.auth.id != '' && @request.auth.role != 'admin' && @request.body.contact.added_by = @request.auth.id && @request.body.logged_by = @request.auth.id",
  }, activities)
  app.save(activities)

  // ── users ─────────────────────────────────────────────────────────────────────
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  unmarshal({
    "listRule": "@request.auth.role = 'admin'",
    // viewRule stays open so expand:'added_by'/'logged_by' works for all users
  }, users)
  app.save(users)

}, (app) => {
  // Rollback to the weakened state that existed before this migration.
  const contacts = app.findCollectionByNameOrId("contacts")
  unmarshal({
    "listRule":   "@request.auth.id != ''",
    "viewRule":   "@request.auth.id != ''",
    "createRule": "@request.auth.id != ''",
  }, contacts)
  app.save(contacts)

  const activities = app.findCollectionByNameOrId("activities")
  unmarshal({
    "listRule":   "@request.auth.id != ''",
    "viewRule":   "@request.auth.id != ''",
    "createRule": "@request.auth.id != '' && @request.auth.role != 'admin' && @request.body.contact.added_by = @request.auth.id",
  }, activities)
  app.save(activities)

  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  unmarshal({
    "listRule": "@request.auth.id != ''",
  }, users)
  app.save(users)
})
