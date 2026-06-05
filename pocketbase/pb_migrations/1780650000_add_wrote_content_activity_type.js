/// <reference path="../pb_data/types.d.ts" />

// Add the missing "wrote_content" value to activities.activity_type.
// frontend/src/lib/constants.ts has had it all along — the collection
// schema (created by earlier migrations) drifted behind it, so creating
// an activity with this type failed validation on the server.

migrate((app) => {
  const activities = app.findCollectionByNameOrId("activities")
  const field = activities.fields.getByName("activity_type")

  if (!field.values.includes("wrote_content")) {
    // keep the same position as in constants.ts (after conducted_workshop)
    const i = field.values.indexOf("conducted_workshop")
    field.values.splice(i >= 0 ? i + 1 : field.values.length, 0, "wrote_content")
    app.save(activities)
  }
}, (app) => {
  const activities = app.findCollectionByNameOrId("activities")
  const field = activities.fields.getByName("activity_type")
  const i = field.values.indexOf("wrote_content")
  if (i >= 0) {
    field.values.splice(i, 1)
    app.save(activities)
  }
})
