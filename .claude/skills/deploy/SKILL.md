---
name: deploy
description: Release merged changes to the Rolodex production VPS at rolodex.fossunited.org — pull, install, build, restart the right services, and verify the new code actually shipped. Use when asked to deploy, push to production, or when a change is merged but not visible on the live site.
---

# Deploy to production

Production is a VPS serving `rolodex.fossunited.org`. The repo lives at `/opt/rolodex`. Two systemd services sit behind Caddy:

| Service | What it runs | Restart when |
|---|---|---|
| `sveltekit` | `adapter-node` build at `/opt/rolodex/frontend/build/index.js` on 127.0.0.1:3000 | any `frontend/` change |
| `pocketbase` | `/opt/rolodex/pocketbase/pocketbase serve` on 127.0.0.1:8090 | any `pb_hooks/` or migration change |

Caddy proxies `/api/*` to PocketBase and everything else to SvelteKit, and returns 403 for `/_/*` so the admin UI is not exposed. Reach the admin UI over a tunnel instead: `ssh -L 8090:localhost:8090 root@rolodex.fossunited.org`, then `http://localhost:8090/_/`.

## Before you deploy

- The change must be **merged to `main`** — production pulls `main`, not a branch.
- If the change touches `pocketbase/pb_migrations/`, run the `rehearse` skill first. Migrations apply automatically on the PocketBase restart; there is no undo.
- Deploying is outward-facing and hard to reverse. Confirm with the user before running these commands, and never deploy unmerged or unreviewed work on your own initiative.

## The deploy

SSH as root, then run with **absolute paths** — `cd frontend` from `~` fails:

```bash
ssh root@rolodex.fossunited.org
```

```bash
cd /opt/rolodex && git pull origin main
cd /opt/rolodex/frontend && npm ci        # only if package.json/package-lock.json changed
cd /opt/rolodex/frontend && npm run build
systemctl restart sveltekit
```

Add, only when the change touched hooks or migrations:

```bash
systemctl restart pocketbase
```

## Verify it actually shipped

Do not report a deploy as done because `systemctl restart` exited 0. Confirm the new code is in the build output:

```bash
grep -rl "<a string unique to the change>" /opt/rolodex/frontend/build/client/
systemctl status sveltekit --no-pager
curl -sI https://rolodex.fossunited.org | head -1
```

## When the change isn't visible on the live site

This has cost a long debugging session before, and the cause is almost always the same: **`npm run build` did not fully run** — skipped, or run from the wrong directory. Restarting `sveltekit` alone keeps serving the *old* `build/`, perfectly happily, with no error anywhere.

Check the build output for the new string before looking at anything else. Only once you have confirmed the code is missing from `build/client/` should you consider caching, Caddy, or the app itself.

Second most common cause: a pulled change added a dependency, and the bare `git pull && npm run build` shortcut skipped `npm ci`, so the build failed with `Cannot find package …` and left the previous `build/` in place. Read the build output rather than assuming it succeeded.

## What does not need a deploy

The interactive demo at `fossdot.github.io/rolodex` is a **separate** static build (`adapter-static`, `DEMO=1`) that auto-deploys via `.github/workflows/demo.yml` on pushes touching `frontend/**`. It has no backend and is unrelated to this VPS. Do not restart production services to update the demo.
