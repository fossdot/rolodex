/// <reference path="../pb_data/types.d.ts" />

// Let admins (directors) log activities too — they engage the network as
// much as anyone. logged_by is still forced to the authenticated user by
// this rule and the create hook, so attribution can't be forged.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("activities")
  collection.createRule = "@request.auth.id != '' && @request.body.logged_by = @request.auth.id"
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("activities")
  collection.createRule = "@request.auth.id != '' && @request.auth.role != 'admin' && @request.body.logged_by = @request.auth.id"
  return app.save(collection)
})
