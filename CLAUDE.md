# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All frontend commands run from `frontend/`:

```bash
npm run dev       # dev server (binds to all interfaces via --host)
npm run build     # production build → frontend/build/
npm run preview   # preview the production build
```

PocketBase runs as a standalone binary from `pocketbase/`:

```bash
./pocketbase/pocketbase serve          # starts on :8090, applies pb_migrations/ on boot
```

The schema comes from `pb_migrations/` on boot; there is no separate bootstrap step. (`pocketbase/setup.js` is the original bootstrap script and is now superseded — see below.)

There is no linter or test suite configured. `npm run build` is the closest thing to a check — it catches Svelte template and type errors.

To exercise server rules and hooks against a real backend, run the binary with a throwaway data dir but the repo's migrations and hooks:

```bash
./pocketbase/pocketbase serve --dir /tmp/pbtest \
  --migrationsDir "$PWD/pocketbase/pb_migrations" --hooksDir "$PWD/pocketbase/pb_hooks" --http 127.0.0.1:8099
```

Without the explicit `--migrationsDir`/`--hooksDir` the JS migrations and hooks silently don't load and the schema comes up empty.

**Before deploying a migration**, rehearse it against a copy of production — `pocketbase/rehearse-upgrade.mjs` snapshots every record, and after the migrating restart it diffs the result and reports any lost row or unexpectedly changed field:

```bash
cp /path/to/prod/data.db /tmp/copy/data.db
./pocketbase/pocketbase serve --dir /tmp/copy --http 127.0.0.1:8095   # old binary/branch
node pocketbase/rehearse-upgrade.mjs before http://127.0.0.1:8095 <su-email> <pw>
# restart on the new branch so the pending migrations apply, then:
node pocketbase/rehearse-upgrade.mjs after  http://127.0.0.1:8095 <su-email> <pw>
```

Fields a migration is *meant* to add or drop are listed in `EXPECTED_ADDED`/`EXPECTED_REMOVED` at the top of that script — extend them when you reshape a collection, or the rehearsal will report the intended change as drift. Crons can be fired on demand via `POST /api/crons/<id>` as a superuser. The frontend also ships a backend-less demo (`VITE_DEMO=1 npm run dev`) that auto-signs-in as an admin over the seed data in `lib/demo/`; `lib/demo/mockPb.ts` reimplements the slice of the SDK the app uses, so a new filter operator or expand shape may need adding there too.

## Architecture

**Two-process setup:** A SvelteKit frontend (SSR disabled — `ssr = false`) talks directly to PocketBase from the browser via the PocketBase JS SDK. There is no API layer between them.

**PocketBase** (`pocketbase/`) is a self-hosted SQLite backend. `pb_migrations/` is the source of truth for the schema — migrations run automatically at boot, in filename order. (`setup.js` predates them and skips anything that already exists, so it no longer reflects the current schema; don't rely on it.) Collections: `organisations`, `contacts`, `activities`, `reminders`, `reactions`, `contact_logs`, plus the built-in `users` extended with `name` and `role`. PocketBase enforces all access control rules at the collection level; the frontend does not re-implement these checks except for UI gating.

**Multi-value relations.** Two fields are one-to-many and their filter syntax is easy to get wrong:

- `contacts.orgs` → `organisations` (a contact can belong to several; **the first is the primary** one, shown wherever only one line fits)
- `activities.contacts` → `contacts` (one activity covers everyone involved; at least one is required, enforced in `pb_hooks/main.pb.js`)

Filtering them needs a hop to the related record plus a `?` (any-of) operator. The obvious forms silently match **nothing**:

```
contacts.id ?= '<id>'      # ✅ membership      contacts ?= '<id>'   ❌ returns nothing
orgs.name ?= 'GNOME'       # ✅ exact match     orgs.name = 'GNOME'  ❌ only single-org contacts
orgs.name ?~ 'gnome'       # ✅ substring       orgs.name ~ 'gnome'  ❌ misses secondary orgs
```

There is also no way to express "has none" — `orgs != ''` matches every row — so filter emptiness in JS after fetching.

**Per-entry label maps.** `activities.contact_roles` and `contacts.org_designations` are `json` objects keyed by the *related record's id* — a participant's role in one activity, and a contact's title at one organisation. They are display-only (not filterable), and the hooks prune entries whose relation has gone, so a map can never outlive it. `PARTICIPANT_ROLES` in `lib/constants.ts` must stay in sync with `PARTICIPANT_ROLE_VALUES` in `pb_hooks/utils.js`, which rejects anything else. Note that PocketBase hands `json` fields to the JSVM inconsistently (object or raw text) — read them via the `readJsonObject` helper in `utils.js`, never `record.get()` alone. Reading names requires `expand` (`orgs`, `contacts`, or nested `contacts.orgs`); the helpers in `lib/org.ts` all read from `expand`, so a query that forgets it renders blanks.

**pb_hooks scope isolation.** Each hook handler runs in its own goja runtime and **cannot see its file's module scope** — a function declared at the top of a `*.pb.js` file fails at runtime inside `onRecordCreateRequest(...)` with `X is not defined`, surfacing to the client as a generic 400. Define helpers inside the handler, or put them in `pb_hooks/utils.js` and `require` them *within* the handler body:

```js
onRecordCreateRequest((e) => {
    const { normaliseCcEmails } = require(`${__hooks}/utils.js`)
    ...
}, "reminders")
```

**Frontend** (`frontend/src/`):

- `lib/pb.ts` — singleton PocketBase client. Reads `PUBLIC_PB_URL` env var (falls back to `http://127.0.0.1:8090`). `autoCancellation` is disabled deliberately so concurrent requests don't cancel each other.
- `lib/stores.ts` — three Svelte stores: `currentUser` (mirrors `pb.authStore`, reactive), `theme` (dark/light, persisted to `localStorage`), `toasts` (auto-dismiss after 4.5s).
- `lib/types.ts` — TypeScript interfaces for `User`, `Organisation`, `Contact`, `Activity`, `Reminder`, `Reaction`, `ContactLog`. Relations use PocketBase's `expand` pattern.
- `lib/activity.ts` — participant rendering: `participantLabel` / `participantLine` produce "Name (Role)" from `contact_roles`, and `roleLabel` / `otherParticipants` back the contact timeline. Four screens show participants; they all go through here so the format can't drift.
- `lib/org.ts` — the only place organisation names should be read from: `primaryOrg`, `orgNames`, `orgLine`, `contactLabel` (all off `expand.orgs`), `orgEntries` (org + its per-org designation), plus `loadOrganisations` and `resolveOrgs`/`resolveOrgIds` (name→id, creating new orgs on save so an abandoned form leaves no rows behind — `resolveOrgs` also returns the name→id map that `org_designations` needs).
- `lib/constants.ts` — all select-field values (`FU_ROLES`, `TOPICS`, `ACTIVITY_TYPES`, `PARTICIPANT_ROLES`, `COUNTRIES`). These must stay in sync with the PocketBase collection schema; changing one without the other breaks validation.

**Routing** (`src/routes/`):

| Route | Access |
|---|---|
| `/login` | Public |
| `/contacts` | Authenticated — shows only the user's own contacts (scope `mine`) |
| `/rolodex` | Authenticated — shows all contacts in the network (scope `all`) |
| `/activities` | Authenticated — all activities with week/month/quarter/year period filter |
| `/activities/new` | Authenticated — log one activity against several contacts, with inline contact creation |
| `/orgs`, `/orgs/[name]` | Authenticated — organisation roster and per-organisation page (routed by name, not id) |
| `/contacts/new`, `/contacts/[id]`, `/contacts/[id]/edit` | Any authenticated user (edit/delete gated to `added_by` or admin) |
| `/admin` | `role === 'admin'` only (redirects otherwise) |

`/contacts` and `/rolodex` share `lib/components/ContactsBrowser.svelte` (a `scope` prop controls the `added_by` filter).

**Soft delete, two different visibilities.** Both collections stamp `deleted_at`/`deleted_by` instead of removing rows, but they diverge on who can then see them:

- **Contacts** — hidden from employees; admins still see them (the "Deleted" view) and can restore in-app.
- **Activities** — hidden from *everyone*, admins included. The list/view rules are `deleted_at = null` flat, so a deleted activity never reaches a browser and there is no in-app restore; recovery is a superuser job in the PocketBase dashboard. Don't add struck-through rendering back — it is unreachable by design.

Deleting an activity also clears its pending reminders, as does removing a participant from one.

Sidebar nav lives in `lib/components/Sidebar.svelte` (reused for the mobile drawer). Its active-tab check is longest-prefix-match, not `startsWith`, so `/activities/new` highlights "Log Activity" alone rather than also lighting up "Activities".

Auth redirect logic lives in `+layout.svelte`: unauthenticated users are sent to `/login`; authenticated users on `/login` are sent to `/contacts`. The root `/` page redirects immediately based on auth state.

**Styling:** Tailwind CSS v3 with `darkMode: 'class'`. Custom utility classes (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.input`, `.label`, `.card`, `.badge-green`, `.badge-neutral`) are defined in `src/app.css`. The accent colour is `#278F5E` (light) / `#30A66D` (dark), exposed as `bg-accent` / `bg-accent-dark` via `tailwind.config.js`.

**Scoring formula (admin dashboard):** `contacts_added × 1 + activities_logged × 2 = score`. This is computed client-side by querying PocketBase per user; it is not stored. Note that one activity covering several contacts scores **once**, not once per participant.

## Environment

Copy `frontend/.env.example` to `frontend/.env` and set `PUBLIC_PB_URL` if PocketBase is not on the default port.
