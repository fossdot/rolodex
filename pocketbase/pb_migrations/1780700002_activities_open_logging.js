/// <reference path="../pb_data/types.d.ts" />

// Any employee can now log activities on any contact — not just contacts
// they added. One person in the network is often engaged by several staff
// members; the contact profile derives its "engaged employees" list from
// who logged what. logged_by is still forced to the authenticated user by
// both this rule and the create hook, and admins remain blocked (logging
// counts toward employee scores).

migrate((app) => {
  const collection = app.findCollectionByNameOrId("activities")
  collection.createRule = "@request.auth.id != '' && @request.auth.role != 'admin' && @request.body.logged_by = @request.auth.id"
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("activities")
  collection.createRule = "@request.auth.id != '' && @request.auth.role != 'admin' && @request.body.contact.added_by = @request.auth.id && @request.body.logged_by = @request.auth.id"
  return app.save(collection)
})
