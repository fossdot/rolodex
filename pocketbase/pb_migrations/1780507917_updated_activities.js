/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1262591861")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.role = 'admin'",
    "listRule": "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')",
    "viewRule": "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')"
  }, collection)

  // add field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "date1257476049",
    "max": "",
    "min": "",
    "name": "deleted_at",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "cascadeDelete": false,
    "collectionId": "_pb_users_auth_",
    "help": "",
    "hidden": false,
    "id": "relation527409327",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "deleted_by",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1262591861")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id = logged_by || @request.auth.role = 'admin'",
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''"
  }, collection)

  // remove field
  collection.fields.removeById("date1257476049")

  // remove field
  collection.fields.removeById("relation527409327")

  return app.save(collection)
})
