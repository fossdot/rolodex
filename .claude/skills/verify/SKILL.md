---
name: verify
description: Pre-merge check for Rolodex — typecheck, production build, and a real browser pass over every screen in demo mode using Playwright. Use before opening or merging a PR, after any UI or schema change, and whenever asked to test thoroughly or confirm nothing broke.
---

# Verify before merging

There is no test suite in this repo, so "it builds" is the floor, not the check. This skill is the repeatable version of *"do thorough testing, make sure nothing breaks"*.

Work through all three stages. Report what each one actually printed — if a stage fails, say so with the output rather than moving on.

## 1. Typecheck and build

```bash
cd frontend
npx svelte-check --threshold error
npm run build
```

`npm run build` is the closest thing to a test here: it catches Svelte template errors and type errors that never surface in the dev server. `svelte-check` catches more, earlier. With the `typescript-lsp` plugin installed, diagnostics also appear as you edit — but still run the build, since only it exercises the real Vite/SvelteKit pipeline.

If the change touches `frontend/package.json`, also confirm the demo build still works, since it uses a different adapter:

```bash
npm run build:demo
```

## 2. Drive the real UI in demo mode

Demo mode needs no backend — it auto-signs-in as an admin over the seed data in `lib/demo/`.

```bash
cd frontend && VITE_DEMO=1 npm run dev
```

Then use **Playwright MCP** to actually visit the app at `http://localhost:5173` and screenshot each screen. Do not describe what the UI probably looks like — open it and look.

Walk every route the change could plausibly touch:

| Route | What to confirm |
|---|---|
| `/contacts` | only the signed-in user's contacts (scope `mine`) |
| `/rolodex` | all contacts in the network (scope `all`) |
| `/activities` | list renders; week/month/quarter/year filter switches |
| `/activities/new` | multi-contact selection, per-contact role labels, inline contact creation |
| `/orgs`, `/orgs/[name]` | roster, and a single org page (routed by **name**, not id) |
| `/contacts/[id]` | timeline, participants, org designations |
| `/admin` | dashboard scores |

Check both themes and the mobile drawer — the light/dark toggle and the sidebar are easy to break and are not covered by any build error.

Blank names on a screen almost always mean a query forgot `expand` (`orgs`, `contacts`, or nested `contacts.orgs`), not a rendering bug — everything in `lib/org.ts` reads from `expand`.

**Demo mode's limits.** `lib/demo/mockPb.ts` reimplements only the slice of the SDK the app uses. A new filter operator or expand shape may need adding there before a screen works — and if you add one, that is a change to verify too, not a workaround. Demo mode also does **not** enforce collection rules or run `pb_hooks`, so it can never confirm access control.

## 3. Server-side behaviour, when the change warrants it

If the change touched collection rules, `pb_hooks/`, or migrations, demo mode cannot verify it. Use the `pb` skill for a throwaway backend with real rules and hooks, and confirm:

- access control actually denies what it should — an employee cannot see soft-deleted contacts; a non-owner, non-admin cannot edit
- hook validation rejects bad input (an activity with no contacts)
- multi-value relation filters return what you expect: `contacts.id ?= '<id>'`, `orgs.name ?~ 'gnome'`. The forms without `?` silently match **nothing**, so a broken filter looks like an empty result, not an error.

For a migration, run the `rehearse` skill — that is the only check that proves existing data survives.

## Clean up

Stop the dev server and any PocketBase you started, and remove test data. Leaving a server on 5173 or 8090 makes the next run's results meaningless.

```bash
pkill -f "vite dev"
pkill -f "pocketbase serve"
```
