/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != ''",
    "deleteRule": "@request.auth.id = logged_by || @request.auth.role = 'admin'",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_1930317162",
        "help": "",
        "hidden": false,
        "id": "relation1281549880",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "contact",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
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
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1105736365",
        "max": 0,
        "min": 0,
        "name": "event_name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "date2862495610",
        "max": "",
        "min": "",
        "name": "date",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text18589324",
        "max": 0,
        "min": 0,
        "name": "notes",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "cascadeDelete": false,
        "collectionId": "_pb_users_auth_",
        "help": "",
        "hidden": false,
        "id": "relation4061243609",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "logged_by",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      }
    ],
    "id": "pbc_1262591861",
    "indexes": [],
    "listRule": "@request.auth.id != ''",
    "name": "activities",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.id = logged_by || @request.auth.role = 'admin'",
    "viewRule": "@request.auth.id != ''"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1262591861");

  return app.delete(collection);
})
