#!/usr/bin/env bash
# Rehearse the pending migrations on the VPS against a consistent COPY of the
# live database. Production is never touched: separate data dir, separate port,
# no hooks (so no reminder cron can email anyone from the copy), and the
# rehearsal server is stopped by PID, never by a pattern that could match the
# real one.
set -euo pipefail
R=/tmp/rehearsal; SRC=/tmp/rehearse-src; NOMIG=/tmp/no-migrations; NOHOOKS=/tmp/no-hooks
PORT=8095; SU_EMAIL=rehearse@example.com; SU_PASS="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)"
PB=/opt/rolodex/pocketbase/pocketbase

cleanup() { [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT

cd /opt/rolodex && git fetch -q origin main
echo "deployed: $(git log --oneline -1)"
echo "target:   $(git log --oneline -1 origin/main)"
echo "migrations pending: $(git diff --name-only HEAD origin/main -- pocketbase/pb_migrations | tr '\n' ' ')"

rm -rf "$R" "$SRC" "$NOMIG" "$NOHOOKS"; mkdir -p "$R" "$NOMIG" "$NOHOOKS"
git worktree prune; git worktree add -q --detach "$SRC" origin/main

# Consistent snapshot of a live WAL-mode database (a plain cp can miss the WAL).
python3 - <<PY
import sqlite3
src = sqlite3.connect("file:/opt/rolodex/pocketbase/pb_data/data.db?mode=ro", uri=True)
dst = sqlite3.connect("$R/data.db"); src.backup(dst); dst.close(); src.close()
print("copied data.db")
PY

"$PB" superuser upsert "$SU_EMAIL" "$SU_PASS" --dir "$R" --migrationsDir "$NOMIG" --hooksDir "$NOHOOKS" >/dev/null

wait_up() { for i in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null && return 0; sleep 0.5; done; echo "rehearsal server did not start"; cat "$1"; exit 1; }

echo "== phase 1: snapshot before (no migrations applied) =="
"$PB" serve --dir "$R" --migrationsDir "$NOMIG" --hooksDir "$NOHOOKS" --http "127.0.0.1:$PORT" > "$R/before.log" 2>&1 & PID=$!
wait_up "$R/before.log"
node "$SRC/pocketbase/rehearse-upgrade.mjs" before "http://127.0.0.1:$PORT" "$SU_EMAIL" "$SU_PASS"
kill "$PID"; wait "$PID" 2>/dev/null || true; PID=

echo "== phase 2: apply origin/main migrations to the copy, then diff =="
"$PB" serve --dir "$R" --migrationsDir "$SRC/pocketbase/pb_migrations" --hooksDir "$NOHOOKS" --http "127.0.0.1:$PORT" > "$R/after.log" 2>&1 & PID=$!
wait_up "$R/after.log"
RC=0; node "$SRC/pocketbase/rehearse-upgrade.mjs" after "http://127.0.0.1:$PORT" "$SU_EMAIL" "$SU_PASS" || RC=$?
kill "$PID"; wait "$PID" 2>/dev/null || true; PID=

echo "== migrations recorded in the copy (latest 5) =="
python3 - <<PY
import sqlite3
c = sqlite3.connect("file:$R/data.db?mode=ro", uri=True)
print([r[0] for r in c.execute("select file from _migrations order by applied desc limit 5")])
print("activities.team present:", any(f["name"]=="team" for f in __import__("json").loads(c.execute("select fields from _collections where name='activities'").fetchone()[0])))
PY
grep -i -E "error|panic" "$R/after.log" | head -5 || true
echo "== cleanup: the copy of production data and the snapshot are removed =="
rm -f "$SRC/pocketbase/.rehearsal-snapshot.json"; git worktree remove --force "$SRC" 2>/dev/null || true; git worktree prune
rm -rf "$R" "$NOMIG" "$NOHOOKS"
echo "== rehearsal exit code: $RC (0 = nothing lost, nothing unexpectedly changed) =="
exit $RC
