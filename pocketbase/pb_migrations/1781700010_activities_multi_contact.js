/// <reference path="../pb_data/types.d.ts" />
// One activity, many contacts (issue #6). Most real activities involve several
// people — a summit has a speaker, an organiser, a sponsor and a maintainer — and
// logging it once per person meant re-typing the same notes N times.
//
// `activities.contact` (single) becomes `activities.contacts` (multi). Adding a
// new field and backfilling is deliberate: changing maxSelect on the existing
// field in place would have to reinterpret a stored id string as a list.
//
// cascadeDelete is false, unlike the old single relation. With several contacts
// on a row, cascading would delete a whole shared activity the moment any one
// participant was hard-deleted. Contacts are soft-deleted here anyway, so the
// activity survives and simply stops listing that participant.
migrate((app) => {
  const contacts = app.findCollectionByNameOrId("contacts")
  const activities = app.findCollectionByNameOrId("activities")

  activities.fields.add(new RelationField({
    name: "contacts", required: false,
    collectionId: contacts.id, cascadeDelete: false,
    minSelect: 0, maxSelect: 50,
  }))
  app.save(activities)

  // Backfill: every existing activity had exactly one contact.
  const all = app.findRecordsByFilter("activities", "id != ''", "", 0, 0)
  for (const a of all) {
    const one = a.getString("contact")
    if (!one) continue
    a.set("contacts", [one])
    app.saveNoValidate(a)
  }

  const activities2 = app.findCollectionByNameOrId("activities")
  activities2.fields.removeByName("contact")
  // The back-relation contacts use to reach activities is named after the field,
  // so it becomes `activities_via_contacts` — ContactsBrowser's notes search and
  // the "my contacts" scope filter both reference it.
  //
  // No index on `contacts`: a multi-relation is stored as a JSON array and
  // membership queries (`contacts.id ?= …`) go through json_each, which a plain
  // column index does not serve. PocketBase leaves multi-relations unindexed for
  // the same reason.
  app.save(activities2)
}, (app) => {
  const contacts = app.findCollectionByNameOrId("contacts")
  const activities = app.findCollectionByNameOrId("activities")

  activities.fields.add(new RelationField({
    name: "contact", required: false,
    collectionId: contacts.id, cascadeDelete: true, maxSelect: 1,
  }))
  app.save(activities)

  // Reverse keeps the first contact; activities that had been given more than
  // one participant cannot be represented by the old single field.
  const all = app.findRecordsByFilter("activities", "id != ''", "", 0, 0)
  for (const a of all) {
    const ids = a.get("contacts")
    if (!Array.isArray(ids) || !ids.length) continue
    a.set("contact", ids[0])
    app.saveNoValidate(a)
  }

  const activities2 = app.findCollectionByNameOrId("activities")
  activities2.fields.removeByName("contacts")
  app.save(activities2)
})
