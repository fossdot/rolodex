/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1262591861")

  // Allow the person who logged an activity (or an admin) to edit it, so human
  // errors can be fixed after logging. Immutable fields (logged_by, contact,
  // deleted_at/deleted_by) are re-pinned server-side by the onRecordUpdateRequest
  // hook in pb_hooks/main.pb.js, so this only opens up the content fields.
  unmarshal({
    "updateRule": "@request.auth.id = logged_by || @request.auth.role = 'admin'"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1262591861")

  unmarshal({
    "updateRule": null
  }, collection)

  return app.save(collection)
})
