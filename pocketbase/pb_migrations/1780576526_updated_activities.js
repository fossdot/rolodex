/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1262591861")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != '' && @request.auth.role != 'admin' && @request.body.contact.added_by = @request.auth.id && @request.body.logged_by = @request.auth.id",
    "listRule": "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
    "viewRule": "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1262591861")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != '' && @request.auth.role != 'admin' && @request.body.contact.added_by = @request.auth.id",
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''"
  }, collection)

  return app.save(collection)
})
