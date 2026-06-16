/// <reference path="../pb_data/types.d.ts" />
// Session length → 2 weeks. The app calls authRefresh() on every load, which
// reissues the token, so this is a rolling window: as long as a user opens the
// app within any 14-day span they stay signed in; 2 weeks of no use logs them
// out. (Was 5 days / 432000s.)
migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  users.authToken.duration = 1209600 // 14 days
  return app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  users.authToken.duration = 432000 // 5 days
  return app.save(users)
})
