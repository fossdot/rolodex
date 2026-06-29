/// <reference path="../pb_data/types.d.ts" />
// Reach-out reminders: a follow-up date on a contact plus the user to email
// (10 AM IST, see pb_hooks/reachout.pb.js). Also opens up users.listRule so the
// assignee picker can load the roster for every signed-in user.
migrate((app) => {
  const c = app.findCollectionByNameOrId("contacts")
  c.fields.add(new DateField({ name: "reach_out_at", required: false }))
  c.fields.add(new RelationField({
    name: "reach_out_to", required: false,
    collectionId: "_pb_users_auth_", cascadeDelete: false, maxSelect: 1,
  }))
  app.save(c)

  const u = app.findCollectionByNameOrId("users")
  u.listRule = "@request.auth.id != ''"
  app.save(u)
}, (app) => {
  const c = app.findCollectionByNameOrId("contacts")
  c.fields.removeByName("reach_out_at")
  c.fields.removeByName("reach_out_to")
  app.save(c)

  const u = app.findCollectionByNameOrId("users")
  u.listRule = "@request.auth.role = 'admin'"
  app.save(u)
})
