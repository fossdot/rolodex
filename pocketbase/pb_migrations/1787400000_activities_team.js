/// <reference path="../pb_data/types.d.ts" />
// Tag the FOSS United members who were part of an activity (issue #26).
//
// An activity used to carry exactly one staff member — `logged_by`, forced to
// whoever saved it. When three people sat in the same grant meeting, either
// each logged it separately or the context left with the two who didn't.
// `team` records the *other* members who were there; `logged_by` stays the
// single attribution, and the only one that scores (see CLAUDE.md).
//
// The update rule widens so a tagged member can correct an activity they were
// part of. Deleting stays with the logger and admins — the rule cannot tell an
// edit from a soft-delete, so pb_hooks/main.pb.js decides that on the
// `deleted_at` transition.
//
// cascadeDelete is false for the same reason as `contacts`: members are
// disabled rather than deleted, so a hard delete would be a superuser accident,
// and it must not take shared activities down with it.
migrate((app) => {
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  const activities = app.findCollectionByNameOrId("activities")

  activities.fields.add(new RelationField({
    name: "team", required: false,
    collectionId: users.id, cascadeDelete: false,
    minSelect: 0, maxSelect: 50,
  }))
  // `team.id ?= …` is how a rule tests membership of a multi-relation; the
  // bare `team ?= …` form matches nothing (CLAUDE.md, multi-value relations).
  activities.updateRule = "@request.auth.id = logged_by || team.id ?= @request.auth.id || @request.auth.role = 'admin'"
  app.save(activities)
}, (app) => {
  const activities = app.findCollectionByNameOrId("activities")
  activities.updateRule = "@request.auth.id = logged_by || @request.auth.role = 'admin'"
  activities.fields.removeByName("team")
  app.save(activities)
})
