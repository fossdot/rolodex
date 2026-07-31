/// <reference path="../pb_data/types.d.ts" />
// A deleted activity disappears from the app completely — for admins too.
//
// Deletion stays soft, so nothing is actually erased: the row keeps its
// `deleted_at`/`deleted_by` stamps and remains readable in the PocketBase
// dashboard (superusers bypass collection rules), which is where an accidental
// delete gets undone. Dropping the `@request.auth.role = 'admin'` exception means
// the record no longer reaches any browser through the app's API, rather than
// being fetched and then styled as struck-through.
//
// Contacts are unaffected: they keep the admin-visible "Deleted" view and the
// in-app Restore button.
migrate((app) => {
  const activities = app.findCollectionByNameOrId("activities")
  activities.listRule = "@request.auth.id != '' && deleted_at = null"
  activities.viewRule = "@request.auth.id != '' && deleted_at = null"
  return app.save(activities)
}, (app) => {
  const activities = app.findCollectionByNameOrId("activities")
  activities.listRule = "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')"
  activities.viewRule = "@request.auth.id != '' && (deleted_at = null || @request.auth.role = 'admin')"
  return app.save(activities)
})
