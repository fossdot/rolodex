/// <reference path="../pb_data/types.d.ts" />
// Two per-entry labels, both optional and both the same shape: a JSON object
// keyed by the id of the related record.
//
//   activities.contact_roles   { <contactId>: "speaker" }
//     What each participant's part was in this one activity — Ananya spoke, Dev
//     sponsored, Rohit volunteered. Values are constrained to the list in
//     pb_hooks/utils.js (mirrored by PARTICIPANT_ROLES in lib/constants.ts).
//
//   contacts.org_designations  { <orgId>: "Professor, CSE" }
//     A contact's title at each organisation, since it differs per org. Free
//     text. `contacts.designation` stays as the headline shown wherever only one
//     line fits; these are the per-organisation detail.
//
// A side map rather than a join table: the relations (`activities.contacts`,
// `contacts.orgs`) keep working exactly as before, so every existing timeline,
// filter and back-relation is untouched. The trade-off is that these labels are
// for display, not something the backend can filter or group on. Both hooks in
// pb_hooks/main.pb.js prune entries whose related record is no longer linked, so
// the maps cannot drift.
migrate((app) => {
  const activities = app.findCollectionByNameOrId("activities")
  activities.fields.add(new JSONField({ name: "contact_roles", required: false, maxSize: 20000 }))
  app.save(activities)

  const contacts = app.findCollectionByNameOrId("contacts")
  contacts.fields.add(new JSONField({ name: "org_designations", required: false, maxSize: 20000 }))
  app.save(contacts)
}, (app) => {
  const activities = app.findCollectionByNameOrId("activities")
  activities.fields.removeByName("contact_roles")
  app.save(activities)

  const contacts = app.findCollectionByNameOrId("contacts")
  contacts.fields.removeByName("org_designations")
  app.save(contacts)
})
