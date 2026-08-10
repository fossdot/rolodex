---
name: pb
description: Start a throwaway PocketBase backend for this repo with migrations and hooks actually loaded, on an isolated port and data dir. Use whenever you need to exercise collection rules, pb_hooks behaviour, or a migration against a real server rather than the demo mock — and to tear it down afterwards.
---

# Throwaway PocketBase

A scratch backend with the repo's real schema and hooks, isolated from `pocketbase/pb_data/` so nothing you do here can touch local dev data.

## Start it

```bash
./pocketbase/pocketbase serve \
  --dir /tmp/pbtest \
  --migrationsDir "$PWD/pocketbase/pb_migrations" \
  --hooksDir "$PWD/pocketbase/pb_hooks" \
  --http 127.0.0.1:8099
```

Run it in the background and wait for `Server started` before hitting it.

**Both explicit paths are load-bearing.** `--migrationsDir` and `--hooksDir` resolve relative to the **data** directory, not the executable. With `--dir /tmp/pbtest` and the flags omitted, PocketBase looks for `/tmp/pb_migrations` and `/tmp/pb_hooks`, finds nothing, and starts **silently empty** — no error, just a server with no collections and no hook validation. Every request then fails in a way that looks like a code bug.

Sanity-check before trusting any result:

```bash
curl -s http://127.0.0.1:8099/api/health
curl -s http://127.0.0.1:8099/api/collections -H "Authorization: $TOKEN" | python3 -c "import sys,json; print([c['name'] for c in json.load(sys.stdin)['items']])"
```

You should see `organisations`, `contacts`, `activities`, `reminders`, `reactions`, `contact_logs`, `users`. An empty list means the migrations did not load — fix the flags, don't debug the app.

## Get a superuser

A fresh `--dir` has no accounts. Create one against the same data dir (server stopped, or use the upsert form):

```bash
./pocketbase/pocketbase superuser upsert test@example.com testpassword123 --dir /tmp/pbtest
```

Then authenticate. Never inline real credentials into a command — read them from the environment:

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8099/api/collections/_superusers/auth-with-password \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$PB_EMAIL\",\"password\":\"$PB_PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

## What this is for

Use a real backend, not `lib/demo/mockPb.ts`, when the thing under test is **server-side**:

- collection API rules (who can list/view/update, the soft-delete visibility split)
- `pb_hooks/main.pb.js` validation — e.g. an activity requiring at least one contact
- a migration's effect on a live schema
- multi-value relation filters (`contacts.id ?= '<id>'`, `orgs.name ?~ 'gnome'`), which the mock only approximates

The demo mock reimplements a slice of the SDK; it does not enforce rules or run hooks, so it can never confirm access control works.

## Hook edits need a restart

`pb_hooks/*.js` is read at boot. After editing a hook, restart the server or you are testing the old code.

Remember that each hook handler runs in its own goja runtime and cannot see its file's module scope — a top-level helper fails at runtime with `X is not defined` and surfaces to the client as a generic 400. `require` inside the handler body instead.

## Tear down

Always clean up when finished — a stray server on 8099 silently poisons the next run.

```bash
pkill -f "pocketbase serve"
rm -rf /tmp/pbtest
```

Check nothing is left holding the port:

```bash
lsof -nP -iTCP:8099 -sTCP:LISTEN
```
