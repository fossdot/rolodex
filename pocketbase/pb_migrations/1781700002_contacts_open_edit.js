/// <reference path="../pb_data/types.d.ts" />
// Let any signed-in user edit any contact (engagement is shared).
// added_by stays locked and soft-delete stays owner/admin-only — both
// enforced in pb_hooks/main.pb.js. Deletion (deleteRule) is unchanged.
migrate((app) => {
  const c = app.findCollectionByNameOrId("contacts")
  c.updateRule = "@request.auth.id != ''"
  return app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId("contacts")
  c.updateRule = "@request.auth.id = added_by || @request.auth.role = 'admin'"
  return app.save(c)
})
