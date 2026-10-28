#!/usr/bin/env bash
# Pull-based deploy of the develop branch on the homelab (run by deploy/systemd timer).
# The repo is public and we have no admin rights for a self-hosted runner, so the homelab polls
# instead: only commits pushed to develop are deployed, nothing listens for inbound requests.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/srv/stacks/fms-dev/repo}"
BRANCH="${BRANCH:-develop}"
STATE="$REPO_DIR/../deployed-commit"

exec 9>"$REPO_DIR/../deploy.lock"
flock -n 9 || exit 0 # a deploy is already running

cd "$REPO_DIR"
git fetch --quiet origin "$BRANCH"
target="$(git rev-parse "origin/$BRANCH")"
if [[ "$target" == "$(cat "$STATE" 2>/dev/null || true)" && "${1:-}" != "--force" ]]; then
  exit 0
fi

echo "Deploying $BRANCH $target"
git checkout --quiet --force --detach "$target"
docker compose -f deploy/docker-compose.yml -p fms-dev up -d --build --remove-orphans

for _ in $(seq 30); do
  if curl -fsS http://100.70.224.81:8020/ >/dev/null && curl -fsS http://100.70.224.81:8020/data/aircraft.json >/dev/null && curl -fsS http://100.70.224.81:8020/flight-sync/health >/dev/null; then
    echo "$target" >"$STATE"
    docker image prune -f >/dev/null
    echo "Deployed $target"
    exit 0
  fi
  sleep 2
done
echo "Smoke test failed for $target" >&2
docker compose -f deploy/docker-compose.yml -p fms-dev logs --tail 50 >&2
exit 1
