/// <reference path="../pb_data/types.d.ts" />

// Close open registration on the users collection.
//
// `createRule` was "" — an empty rule, meaning *any* request, including an
// unauthenticated one, could create a user. The only gate was the hook in
// main.pb.js checking that the email string ends in @fossunited.org, which
// proves nothing about who owns that address. Anyone able to name a plausible
// address could POST /api/collections/users/records, choose their own password,
// sign in, and read the whole network: every contact's name, email and phone,
// every activity, and the team roster. Verified against a throwaway backend
// carrying these same migrations.
//
// Accounts are now created by an admin (or a superuser in the dashboard).
// Google sign-in is unaffected: the OAuth2 flow creates its record internally
// rather than through the records API, which is why the domain restriction for
// it needs its own hook (OnRecordAuthWithOAuth2Request) instead of riding on
// the create hook. A member invited by an admin can still sign in with Google
// afterwards — PocketBase matches the existing record by email.
//
// `deleteRule` was "id = @request.auth.id", letting any member delete their own
// account and orphan `added_by`/`logged_by` on everything they had contributed,
// blanking attribution across the app with no way back in-app. Deleting a member
// is an admin action now.

migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")

  unmarshal({
    "createRule": "@request.auth.role = 'admin'",
    "deleteRule": "@request.auth.role = 'admin'",
  }, users)

  return app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")

  unmarshal({
    "createRule": "",
    "deleteRule": "id = @request.auth.id",
  }, users)

  return app.save(users)
})
