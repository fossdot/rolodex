/// <reference path="../pb_data/types.d.ts" />
// Reminders now attach to an ACTIVITY rather than living on the contact, so the
// email can carry the interaction's context. This migration:
//   1. drops the short-lived per-contact reminder fields,
//   2. drops the superseded `reminder_logs` collection (history now lives on the
//      reminder row itself via `sent_at`),
//   3. creates the `reminders` collection — a follow-up against an activity,
//      fired by pb_hooks/reachout.pb.js and pending until `sent_at` is stamped.
migrate((app) => {
  // 1. Drop the old per-contact reminder fields.
  const c = app.findCollectionByNameOrId("contacts")
  c.fields.removeByName("reach_out_at")
  c.fields.removeByName("reach_out_to")
  app.save(c)

  // 2. Remove the superseded history collection, if it was created.
  try { app.delete(app.findCollectionByNameOrId("reminder_logs")) } catch (e) { /* never existed */ }

  // 3. Create the reminders collection.
  const contacts = app.findCollectionByNameOrId("contacts")
  const activities = app.findCollectionByNameOrId("activities")
  const reminders = new Collection({
    type: "base",
    name: "reminders",
    fields: [
      { name: "contact",    type: "relation", required: true,  collectionId: contacts.id,       cascadeDelete: true,  maxSelect: 1 },
      { name: "activity",   type: "relation", required: true,  collectionId: activities.id,     cascadeDelete: true,  maxSelect: 1 },
      { name: "remind_at",  type: "date",     required: true },
      { name: "notify",     type: "relation", required: true,  collectionId: "_pb_users_auth_", cascadeDelete: false, maxSelect: 1 },
      { name: "created_by", type: "relation", required: true,  collectionId: "_pb_users_auth_", cascadeDelete: false, maxSelect: 1 },
      { name: "sent_at",    type: "date",     required: false },
      { name: "created",    type: "autodate", onCreate: true,  onUpdate: false },
      { name: "updated",    type: "autodate", onCreate: true,  onUpdate: true  },
    ],
    // Personal: you only ever see reminders you created or will be notified about.
    listRule:   "@request.auth.id != '' && (created_by = @request.auth.id || notify = @request.auth.id)",
    viewRule:   "@request.auth.id != '' && (created_by = @request.auth.id || notify = @request.auth.id)",
    // created_by is forced to the caller in pb_hooks/reachout.pb.js.
    createRule: "@request.auth.id != ''",
    // Edit only your own, and only while still pending (sent rows are history).
    updateRule: "@request.auth.id != '' && created_by = @request.auth.id && sent_at = ''",
    deleteRule: "@request.auth.id != '' && created_by = @request.auth.id",
    indexes: [
      "CREATE INDEX `idx_reminders_notify` ON `reminders` (`notify`)",
      "CREATE INDEX `idx_reminders_due` ON `reminders` (`sent_at`, `remind_at`)",
      "CREATE INDEX `idx_reminders_activity` ON `reminders` (`activity`)",
    ],
  })
  app.save(reminders)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("reminders"))
  const c = app.findCollectionByNameOrId("contacts")
  c.fields.add(new DateField({ name: "reach_out_at", required: false }))
  c.fields.add(new RelationField({ name: "reach_out_to", required: false, collectionId: "_pb_users_auth_", cascadeDelete: false, maxSelect: 1 }))
  app.save(c)
})
