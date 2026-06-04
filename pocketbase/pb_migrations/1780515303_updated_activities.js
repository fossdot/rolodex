/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1262591861")

  // update field
  collection.fields.addAt(2, new Field({
    "help": "",
    "hidden": false,
    "id": "select2400881851",
    "maxSelect": 1,
    "name": "activity_type",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "proposed_talk",
      "spoke_at_event",
      "hosted_meetup",
      "sponsored_event",
      "volunteered",
      "applied_grant",
      "received_grant",
      "established_foss_club",
      "judged_project",
      "reviewed_grant",
      "mentored_hackathon",
      "connected_sponsor",
      "connected_venue",
      "general_volunteer",
      "attended_event",
      "participated_hackathon",
      "conducted_workshop",
      "attended_workshop",
      "contributed_oss",
      "panel_discussion",
      "networking_call",
      "expressed_interest",
      "other"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1262591861")

  // update field
  collection.fields.addAt(2, new Field({
    "help": "",
    "hidden": false,
    "id": "select2400881851",
    "maxSelect": 1,
    "name": "activity_type",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "proposed_talk",
      "spoke_at_event",
      "hosted_meetup",
      "sponsored_event",
      "volunteered",
      "applied_grant",
      "received_grant",
      "established_foss_club",
      "judged_project",
      "reviewed_grant",
      "mentored_hackathon",
      "connected_sponsor",
      "connected_venue",
      "general_volunteer"
    ]
  }))

  return app.save(collection)
})
