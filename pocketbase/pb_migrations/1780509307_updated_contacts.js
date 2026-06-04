/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1930317162")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1930317162")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
    "viewRule": "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')"
  }, collection)

  return app.save(collection)
})
