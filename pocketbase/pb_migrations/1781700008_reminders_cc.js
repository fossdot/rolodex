/// <reference path="../pb_data/types.d.ts" />
// CC on follow-up reminders (issue #7). A reminder still has exactly one
// assignee (`notify`) — the person the nudge is *for*, and the one who sees it
// in their bell. CC is purely an emailed copy, in two flavours:
//
//   cc         — team members, picked from the users roster
//   cc_emails  — comma-separated external addresses, so a Google group or a
//                partner who has no Rolodex account can be looped in
//
// Both are optional, so every existing reminder stays valid.
migrate((app) => {
  const r = app.findCollectionByNameOrId("reminders")
  r.fields.add(new RelationField({
    name: "cc", required: false,
    collectionId: "_pb_users_auth_", cascadeDelete: false,
    minSelect: 0, maxSelect: 20,
  }))
  r.fields.add(new TextField({ name: "cc_emails", required: false, max: 2000 }))
  app.save(r)
}, (app) => {
  const r = app.findCollectionByNameOrId("reminders")
  r.fields.removeByName("cc")
  r.fields.removeByName("cc_emails")
  app.save(r)
})
