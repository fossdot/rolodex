/// <reference path="../pb_data/types.d.ts" />
// Reaction palette change: drop 💯, add 👎. Keep in sync with
// REACTION_EMOJIS in frontend/src/lib/constants.ts.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("reactions")
  collection.fields.getByName("emoji").values = ["👍", "❤️", "🎉", "👏", "🔥", "👎"]
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("reactions")
  collection.fields.getByName("emoji").values = ["👍", "❤️", "🎉", "👏", "💯", "🔥"]
  return app.save(collection)
})
