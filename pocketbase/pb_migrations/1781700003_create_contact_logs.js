/// <reference path="../pb_data/types.d.ts" />
// Append-only audit log of contact edits. One row per save that changed
// something. editor is forced to the caller in pb_hooks/main.pb.js; rows
// are immutable (no update/delete rule) and cascade-deleted with the contact.
migrate((app) => {
  const contacts = app.findCollectionByNameOrId("contacts")

  const collection = new Collection({
    type: "base",
    name: "contact_logs",
    fields: [
      { name: "contact", type: "relation", required: true, collectionId: contacts.id,      cascadeDelete: true,  maxSelect: 1 },
      { name: "editor",  type: "relation", required: true, collectionId: "_pb_users_auth_", cascadeDelete: false, maxSelect: 1 },
      { name: "changes", type: "json", required: false, maxSize: 200000 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    listRule:   "@request.auth.id != ''",
    viewRule:   "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: null,
    deleteRule: null,
    indexes: [
      "CREATE INDEX `idx_contact_logs_contact` ON `contact_logs` (`contact`)",
    ],
  })

  app.save(collection)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("contact_logs"))
})
