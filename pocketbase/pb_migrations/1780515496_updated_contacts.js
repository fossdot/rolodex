/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1930317162")

  // add field
  collection.fields.addAt(19, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text3612110267",
    "max": 0,
    "min": 0,
    "name": "fu_roles_other",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(20, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text4168792460",
    "max": 0,
    "min": 0,
    "name": "topics_other",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // update field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "select1077078561",
    "maxSelect": 11,
    "name": "fu_roles",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "speaker",
      "sponsor",
      "meetup_host",
      "foss_club_ambassador_student",
      "foss_club_ambassador_staff",
      "organising_volunteer",
      "gov_board_expert",
      "mentor",
      "project_maintainer",
      "general",
      "other"
    ]
  }))

  // update field
  collection.fields.addAt(12, new Field({
    "help": "",
    "hidden": false,
    "id": "select2448836153",
    "maxSelect": 16,
    "name": "topics",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "technologist",
      "hardware",
      "av_enthusiast",
      "public_policy",
      "ai_ml",
      "government",
      "open_source",
      "education",
      "security",
      "devops",
      "design",
      "community",
      "research",
      "legal",
      "finance",
      "other"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1930317162")

  // remove field
  collection.fields.removeById("text3612110267")

  // remove field
  collection.fields.removeById("text4168792460")

  // update field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "select1077078561",
    "maxSelect": 10,
    "name": "fu_roles",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "speaker",
      "sponsor",
      "meetup_host",
      "foss_club_ambassador_student",
      "foss_club_ambassador_staff",
      "organising_volunteer",
      "gov_board_expert",
      "mentor",
      "project_maintainer",
      "general"
    ]
  }))

  // update field
  collection.fields.addAt(12, new Field({
    "help": "",
    "hidden": false,
    "id": "select2448836153",
    "maxSelect": 15,
    "name": "topics",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "technologist",
      "hardware",
      "av_enthusiast",
      "public_policy",
      "ai_ml",
      "government",
      "open_source",
      "education",
      "security",
      "devops",
      "design",
      "community",
      "research",
      "legal",
      "finance"
    ]
  }))

  return app.save(collection)
})
