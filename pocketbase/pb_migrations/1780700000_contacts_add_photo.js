/// <reference path="../pb_data/types.d.ts" />

// Optional contact photo. Lists request ?thumb=100x100 (pre-declared below so
// it's generated at upload time); the full-size original is only fetched when
// the photo is clicked open in the profile lightbox.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("contacts")

  collection.fields.add(new Field({
    "hidden": false,
    "id": "file_photo0000001",
    "name": "photo",
    "type": "file",
    "required": false,
    "presentable": false,
    "system": false,
    "maxSelect": 1,
    "maxSize": 5242880,
    "mimeTypes": ["image/jpeg", "image/png", "image/webp", "image/gif"],
    "thumbs": ["100x100"],
    "protected": false
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("contacts")
  collection.fields.removeById("file_photo0000001")
  return app.save(collection)
})
