#!/usr/bin/env bash
# The deploy proper — run only after scripts/rehearse-on-vps.sh reported exit code 0.
# Pulling updates pb_hooks/, which PocketBase's hooks watcher notices and restarts
# on; the explicit restart below makes that deterministic.
set -euo pipefail
cd /opt/rolodex
BEFORE=$(git rev-parse HEAD)
git pull -q --ff-only origin main
echo "now at: $(git log --oneline -1)"
if git diff --name-only "$BEFORE" HEAD -- frontend/package.json frontend/package-lock.json | grep -q .; then
  echo "== dependencies changed: npm ci =="; (cd /opt/rolodex/frontend && npm ci --no-audit --no-fund)
else
  echo "== dependencies unchanged: skipping npm ci =="
fi
echo "== build =="
(cd /opt/rolodex/frontend && npm run build 2>&1 | tail -4)
echo "== restart =="
systemctl restart pocketbase
sleep 2
systemctl restart sveltekit
sleep 2
systemctl is-active pocketbase sveltekit | tr '\n' ' '; echo
echo "== verify: new strings in the built client =="
for s in "Already in the Rolodex?" "Who else from the team was there?" "Team member"; do
  n=$(grep -rl --include='*.js' -F "$s" /opt/rolodex/frontend/build/client/ | wc -l); echo "  '$s': $n file(s)"
done
echo "== verify: migrations applied to production =="
python3 - <<PY
import sqlite3, json
c = sqlite3.connect("file:/opt/rolodex/pocketbase/pb_data/data.db?mode=ro", uri=True)
print([r[0] for r in c.execute("select file from _migrations order by applied desc limit 4")])
print("activities.team present:", any(f["name"]=="team" for f in json.loads(c.execute("select fields from _collections where name='activities'").fetchone()[0])))
print("users.disabled present:", any(f["name"]=="disabled" for f in json.loads(c.execute("select fields from _collections where name='users'").fetchone()[0])))
print("counts:", {t: c.execute(f"select count(*) from {t}").fetchone()[0] for t in ("contacts","activities","organisations","reminders","users")})
PY
echo "== verify: live =="
curl -sI https://rolodex.fossunited.org | head -1
curl -s https://rolodex.fossunited.org/api/health
echo; journalctl -u pocketbase -n 8 --no-pager | tail -8
echo "== cleanup rehearsal =="
git worktree remove --force /tmp/rehearse-src 2>/dev/null || true; git worktree prune
rm -rf /tmp/rehearsal /tmp/no-migrations /tmp/no-hooks
echo "done"
