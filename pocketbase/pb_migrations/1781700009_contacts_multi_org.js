/// <reference path="../pb_data/types.d.ts" />
// Contacts can belong to several organisations (issue #8) — someone may maintain
// a project, work somewhere, and volunteer for a FOSS United city chapter.
//
// The single `contacts.org` text field becomes `contacts.orgs`, a multi-relation
// to a new `organisations` collection. A relation (rather than a list of strings)
// is what makes the org pages work: PocketBase can answer exact membership
// (`orgs.name ?= 'GNOME Foundation'`) and substring search across every org a
// contact belongs to (`orgs.name ?~ 'gnome'`). A JSON array supports neither —
// `?=` matches nothing on one, and `~` cannot tell "Foundation" apart from
// "Foundation for Free Software".
//
// One organisation per name, enforced by a case-insensitive unique index, so the
// /orgs grouping stays clean even though anyone can add an org inline.
//
// The first entry in `orgs` is treated as the contact's primary organisation and
// is what compact UI (list rows, activity feed, reminder emails) displays.
migrate((app) => {
  // ── 1. the organisations collection ───────────────────────────────────────
  const organisations = new Collection({
    type: "base",
    name: "organisations",
    fields: [
      { name: "name",    type: "text",     required: true, max: 200 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true  },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    // Anyone signed in may introduce an org, so a contact can be filed under a
    // new one without leaving the form.
    createRule: "@request.auth.id != ''",
    // Renaming or removing an org rewrites it for every contact linked to it,
    // so that stays with admins.
    updateRule: "@request.auth.role = 'admin'",
    deleteRule: "@request.auth.role = 'admin'",
    indexes: [
      "CREATE UNIQUE INDEX `idx_organisations_name` ON `organisations` (`name` COLLATE NOCASE)",
    ],
  })
  app.save(organisations)

  // ── 2. contacts.orgs ──────────────────────────────────────────────────────
  const contacts = app.findCollectionByNameOrId("contacts")
  contacts.fields.add(new RelationField({
    name: "orgs", required: false,
    collectionId: organisations.id, cascadeDelete: false,
    minSelect: 0, maxSelect: 10,
  }))
  app.save(contacts)

  // ── 3. backfill from the old single org string ─────────────────────────────
  // Soft-deleted contacts are included so restoring one keeps its organisation.
  //
  // saveNoValidate, not save: `how_you_know`, `fu_roles` and `topics` were made
  // required after some rows already existed, so a plain save would abort this
  // whole migration on the first legacy row that predates them. This is a
  // mechanical field copy, not user input — it must not re-litigate validity.
  const byLowerName = {}
  const all = app.findRecordsByFilter("contacts", "id != ''", "", 0, 0)
  for (const c of all) {
    const raw = String(c.getString("org") || "").trim()
    if (!raw) continue

    const key = raw.toLowerCase()
    if (!byLowerName[key]) {
      // Reuse an existing row if a differently-cased spelling already made one.
      const existing = app.findRecordsByFilter("organisations", "name = {:n}", "", 1, 0, { n: raw })
      if (existing.length) {
        byLowerName[key] = existing[0].id
      } else {
        const org = new Record(app.findCollectionByNameOrId("organisations"))
        org.set("name", raw)
        app.save(org)
        byLowerName[key] = org.id
      }
    }

    c.set("orgs", [byLowerName[key]])
    app.saveNoValidate(c)
  }

  // ── 4. drop the superseded field ──────────────────────────────────────────
  const contacts2 = app.findCollectionByNameOrId("contacts")
  contacts2.fields.removeByName("org")
  app.save(contacts2)
}, (app) => {
  // Reverse: restore `org` from the first linked organisation, then tear down.
  const contacts = app.findCollectionByNameOrId("contacts")
  contacts.fields.add(new TextField({ name: "org", required: false }))
  app.save(contacts)

  const all = app.findRecordsByFilter("contacts", "id != ''", "", 0, 0)
  for (const c of all) {
    const ids = c.get("orgs")
    if (!Array.isArray(ids) || !ids.length) continue
    try {
      const org = app.findRecordById("organisations", ids[0])
      c.set("org", org.getString("name"))
      app.saveNoValidate(c)
    } catch (e) { /* org row already gone */ }
  }

  const contacts2 = app.findCollectionByNameOrId("contacts")
  contacts2.fields.removeByName("orgs")
  app.save(contacts2)

  app.delete(app.findCollectionByNameOrId("organisations"))
})
