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
mkdir -p /tmp/copy /tmp/no-migrations
cp /path/to/prod/data.db /tmp/copy/data.db

# snapshot first — an empty --migrationsDir means nothing is applied yet
pocketbase serve --dir /tmp/copy --migrationsDir /tmp/no-migrations --http 127.0.0.1:8095
node pocketbase/rehearse-upgrade.mjs before http://127.0.0.1:8095 <su-email> <pw>

# then the same data dir with the real migrations — pass the path EXPLICITLY
pocketbase serve --dir /tmp/copy --migrationsDir "$PWD/pocketbase/pb_migrations" --http 127.0.0.1:8095
node pocketbase/rehearse-upgrade.mjs after  http://127.0.0.1:8095 <su-email> <pw>
```

`--migrationsDir` resolves relative to the **data** directory, not the executable. With `--dir /tmp/copy` it looks for `/tmp/pb_migrations` and silently applies nothing, so it must be passed explicitly whenever the copy lives outside the repo. (Production is unaffected: there `pb_data` and `pb_migrations` are siblings, so the default resolves correctly.) A rehearsal where the migration never ran shows up as `organisations: absent` in the "after" output.

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

**Deep links to one activity.** The 🔗 button on a contact-timeline entry copies `/contacts/<contact>?activity=<activity>`, and the contact page scrolls to that entry and rings it once. It is a query param rather than a `#hash` because the sign-in redirect builds `?next=` from `url.search` and a hash never reaches that capture — a hash link would survive the login round trip only to land at the top of the page with the activity lost. The reveal depends on both the loaded timeline **and** `$page.url.search`, so an in-app link that only changes `?activity=` still fires, and it is guarded on the activity id so a later re-render (a reaction, an edit) doesn't yank the page back. Only the first 100 activities are fetched (`getList(1, 100)`), so a link to an older entry currently reveals nothing at all.

**Param routes must reload when the param changes.** SvelteKit reuses a page component when only the route param changes — and the "with &lt;name&gt;" participant link on a timeline entry does exactly that. `/contacts/[id]` and `/orgs/[name]` therefore trigger their load from a reactive guard (`loadedFor`), never from `onMount` alone. Loading only in `onMount` leaves the *previous* record rendered under the new URL, and because writes key off the route param (`contacts: [id]`, `contact: id`, `pb.collection('contacts').update(id, …)`), a save then lands on the record in the URL rather than the one on screen. This was a real bug: an activity logged from a stale contact page attached to the wrong contact, then rendered into the visible timeline with nothing warning anyone.

Auth redirect logic lives in `+layout.svelte`: unauthenticated users are sent to `/login`; authenticated users on `/login` are sent to `/contacts`. The root `/` page redirects immediately based on auth state.

**Team management (`/admin/team`, admin only).** The three dashboard tiles are links — contacts to `/rolodex`, activities to `/activities`, team to this screen. Roles, invites and access all run through the `users` collection rather than the PocketBase dashboard, so the rules matter:

- `createRule` is `@request.auth.role = 'admin'` — it used to be `""`, which let anyone on the internet create an account (the email-domain hook checks the string, not ownership). Google's first-sign-in creation is internal to the OAuth flow and bypasses this, which is why *its* domain check needs its own hook.
- `updateRule` is `id = @request.auth.id || @request.auth.role = 'admin'`. Which *fields* an admin may touch is decided in `pb_hooks/main.pb.js`, not by the rule: only `role` and `disabled`, never on their own record, and never the last active admin. An employee's writes to either field are reverted to the stored value, so a member can't PATCH `role:"admin"` onto themselves.
- `disabled` is how a departure is recorded. Deleting the account would orphan `added_by`/`logged_by` and blank that attribution everywhere, so the app never deletes; it disables, and Restore undoes it.
- `authRule` is `disabled = false`. **Measured on PocketBase 0.39.1:** that gates the auth endpoints only — sign-in and `auth-refresh` — and is *not* consulted on ordinary authenticated requests. Since `lib/pb.ts` calls `authRefresh()` on load and clears the auth store when it fails, a disabled member is signed out on their next page load; but a raw token already in hand keeps working for direct API calls until it expires (`authToken.duration`, 14 days). `record.refreshTokenKey()` does not change this, and neither does a password change.

Two things PocketBase will not let an admin do, both worked around rather than fought: they cannot set `verified` (it is protected for non-superusers, so invited accounts start unverified — nothing requires verification to sign in), and they cannot read another member's email (`emailVisibility` is false on every record). The password-reset button therefore posts to a custom admin-only route, `POST /api/team/send-password-reset`, which looks the address up server-side instead of widening email visibility for every signed-in member.

**Styling:** Tailwind CSS v3 with `darkMode: 'class'`. Custom utility classes (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.input`, `.label`, `.card`, `.badge-green`, `.badge-neutral`) are defined in `src/app.css`. The accent colour is `#278F5E` (light) / `#30A66D` (dark), exposed as `bg-accent` / `bg-accent-dark` via `tailwind.config.js`.

**Scoring formula (admin dashboard):** `contacts_added × 1 + activities_logged × 2 = score`. This is computed client-side by querying PocketBase per user; it is not stored. Note that one activity covering several contacts scores **once**, not once per participant.

## Environment

Copy `frontend/.env.example` to `frontend/.env` and set `PUBLIC_PB_URL` if PocketBase is not on the default port.
