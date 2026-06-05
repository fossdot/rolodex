/// <reference path="../pb_data/types.d.ts" />

// Make how_you_know, fu_roles and topics mandatory. For multi-selects,
// required means "at least one value". The conditional rule (when 'other'
// is selected the matching *_other text is required) can't be expressed in
// the schema — it's enforced in pb_hooks/main.pb.js and in the form UI.
//
// Safe for existing records: PocketBase validates the merged record on
// update, and all production records already populate these fields, so
// partial updates (e.g. the soft-delete flow) keep working.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("contacts")
  collection.fields.getByName("how_you_know").required = true
  collection.fields.getByName("fu_roles").required = true
  collection.fields.getByName("topics").required = true
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("contacts")
  collection.fields.getByName("how_you_know").required = false
  collection.fields.getByName("fu_roles").required = false
  collection.fields.getByName("topics").required = false
  return app.save(collection)
})
