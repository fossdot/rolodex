---
name: rehearse
description: Rehearse a pending PocketBase migration against a copy of production data and diff every record before/after, to prove it loses nothing. Use before deploying any change under pocketbase/pb_migrations/, or whenever asked whether a migration is safe for existing data.
---

# Migration rehearsal

Proves a pending migration does not damage real data, on this machine, before it touches production. `pocketbase/rehearse-upgrade.mjs` snapshots every record, then diffs after the migrating restart and reports any lost row or unexpectedly changed field.

Run this for **any** change under `pocketbase/pb_migrations/`. A migration that reshapes a relation (the `org` → `orgs`, `contact` → `contacts` class of change) can silently drop rows, and the only honest way to know is to run it over production-shaped data.

## Get a copy of production

Never rehearse against the live database. Copy it down first:

```bash
mkdir -p /tmp/rehearsal /tmp/no-migrations
scp root@rolodex.fossunited.org:/opt/rolodex/pocketbase/pb_data/data.db /tmp/rehearsal/data.db
```

`/tmp/no-migrations` must stay empty — it is what makes the "before" phase snapshot the *unmigrated* state.

## Phase 1 — snapshot before

Start the copy with **no** migrations applied:

```bash
./pocketbase/pocketbase serve --dir /tmp/rehearsal \
  --migrationsDir /tmp/no-migrations --http 127.0.0.1:8095
```

Then snapshot (credentials from the environment, never inlined):

```bash
node pocketbase/rehearse-upgrade.mjs before http://127.0.0.1:8095 "$PB_EMAIL" "$PB_PASSWORD"
```

Stop the server.

## Phase 2 — migrate and diff

Same data dir, real migrations, **path passed explicitly**:

```bash
./pocketbase/pocketbase serve --dir /tmp/rehearsal \
  --migrationsDir "$PWD/pocketbase/pb_migrations" --http 127.0.0.1:8095
```

```bash
node pocketbase/rehearse-upgrade.mjs after http://127.0.0.1:8095 "$PB_EMAIL" "$PB_PASSWORD"
```

## The failure that looks like a pass

`--migrationsDir` resolves relative to the **data** directory, not the executable. With `--dir /tmp/rehearsal` and the flag omitted, PocketBase looks for `/tmp/pb_migrations`, finds nothing, applies nothing — and reports no error. The rehearsal then "passes" without ever having run the migration.

The giveaway in the "after" output is **`organisations: absent`**, usually with every activity reported as having a mis-mapped contact. If you see that, the migration never ran. Re-run phase 2 with the explicit path; do not interpret the diff.

Production is unaffected by this footgun — there `pb_data` and `pb_migrations` are siblings, so the default resolves correctly. It only bites when the copy lives outside the repo, which is always.

## Reading the diff

The script fails loudly on any lost row or changed field, except fields listed in `EXPECTED_ADDED` / `EXPECTED_REMOVED` at the top of `rehearse-upgrade.mjs` — the ones a migration is *meant* to change.

When your migration adds or drops a field, **extend those lists first**, or the rehearsal reports your intended change as drift and you learn to ignore its output. Report exactly what the diff said; do not summarise a failure as a pass.

## Clean up

```bash
pkill -f "pocketbase serve"
rm -rf /tmp/rehearsal /tmp/no-migrations pocketbase/.rehearsal-snapshot.json
```

The snapshot is gitignored but contains real production records — delete it when done.
