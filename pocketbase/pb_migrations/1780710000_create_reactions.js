/// <reference path="../pb_data/types.d.ts" />

// Emoji reactions on activities (WhatsApp-style): one reaction per user per
// activity, replacing on re-react — enforced by the unique index and the
// create hook in pb_hooks/main.pb.js. Everyone signed in can see who
// reacted with what. Admins can react too (reactions don't affect scores).

migrate((app) => {
  const activities = app.findCollectionByNameOrId("activities")

  const collection = new Collection({
    type: "base",
    name: "reactions",
    fields: [
      { name: "activity", type: "relation", required: true, collectionId: activities.id,     cascadeDelete: true, maxSelect: 1 },
      { name: "user",     type: "relation", required: true, collectionId: "_pb_users_auth_", cascadeDelete: true, maxSelect: 1 },
      {
        name: "emoji",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["👍", "❤️", "🎉", "👏", "💯", "🔥"],
      },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: null, // change = replace (handled by the create hook)
    deleteRule: "user = @request.auth.id",
    indexes: [
      "CREATE UNIQUE INDEX `idx_reactions_activity_user` ON `reactions` (`activity`, `user`)",
    ],
  })

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("reactions")
  app.delete(collection)
})
