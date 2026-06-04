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
./pocketbase/pocketbase serve          # starts on :8090
node pocketbase/setup.js <email> <pw>  # bootstrap schema (run once after first superadmin is created)
```

There is no linter or test suite configured.

## Architecture

**Two-process setup:** A SvelteKit frontend (SSR disabled — `ssr = false`) talks directly to PocketBase from the browser via the PocketBase JS SDK. There is no API layer between them.

**PocketBase** (`pocketbase/`) is a self-hosted SQLite backend. The `setup.js` script creates the `contacts` and `activities` collections and extends the built-in `users` collection with `name` and `role` fields. PocketBase enforces all access control rules at the collection level; the frontend does not re-implement these checks except for UI gating.

**Frontend** (`frontend/src/`):

- `lib/pb.ts` — singleton PocketBase client. Reads `PUBLIC_PB_URL` env var (falls back to `http://127.0.0.1:8090`). `autoCancellation` is disabled deliberately so concurrent requests don't cancel each other.
- `lib/stores.ts` — three Svelte stores: `currentUser` (mirrors `pb.authStore`, reactive), `theme` (dark/light, persisted to `localStorage`), `toasts` (auto-dismiss after 4.5s).
- `lib/types.ts` — TypeScript interfaces for `User`, `Contact`, `Activity`. Relations use PocketBase's `expand` pattern.
- `lib/constants.ts` — all select-field values (`FU_ROLES`, `TOPICS`, `ACTIVITY_TYPES`, `COUNTRIES`). These must stay in sync with the PocketBase collection schema; changing one without the other breaks validation.

**Routing** (`src/routes/`):

| Route | Access |
|---|---|
| `/login` | Public |
| `/contacts` | Authenticated — shows only the user's own contacts (scope `mine`) |
| `/rolodex` | Authenticated — shows all contacts in the network (scope `all`) |
| `/activities` | Authenticated — all activities with week/month/quarter/year period filter |
| `/contacts/new`, `/contacts/[id]`, `/contacts/[id]/edit` | Any authenticated user (edit/delete gated to `added_by` or admin) |
| `/admin` | `role === 'admin'` only (redirects otherwise) |

`/contacts` and `/rolodex` share `lib/components/ContactsBrowser.svelte` (a `scope` prop controls the `added_by` filter). Records are soft-deleted (`deleted_at`/`deleted_by` fields) — delete actions set these instead of removing rows; admins can view and restore deleted records via the "Deleted" filter in the browser or the admin dashboard.

Auth redirect logic lives in `+layout.svelte`: unauthenticated users are sent to `/login`; authenticated users on `/login` are sent to `/contacts`. The root `/` page redirects immediately based on auth state.

**Styling:** Tailwind CSS v3 with `darkMode: 'class'`. Custom utility classes (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.input`, `.label`, `.card`, `.badge-green`, `.badge-neutral`) are defined in `src/app.css`. The accent colour is `#278F5E` (light) / `#30A66D` (dark), exposed as `bg-accent` / `bg-accent-dark` via `tailwind.config.js`.

**Scoring formula (admin dashboard):** `contacts_added × 1 + activities_logged × 2 = score`. This is computed client-side by querying PocketBase per user; it is not stored.

## Environment

Copy `frontend/.env.example` to `frontend/.env` and set `PUBLIC_PB_URL` if PocketBase is not on the default port.
