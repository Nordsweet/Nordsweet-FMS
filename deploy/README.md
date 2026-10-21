# Deploy: develop → dev.fms.lab.vibecde.com

Pre-production, reachable only over Tailscale (no authentication yet).

- `nextjs/Dockerfile` builds the static export and serves it with nginx (`nextjs/deploy/nginx.conf`).
- `deploy/docker-compose.yml` runs it on `127.0.0.1:8020`; Caddy (`/srv/stacks/caddy`) proxies
  `dev.fms.lab.vibecde.com` to it with its own certificate (Cloudflare DNS challenge).
- The internal `flight-store` service persists flight checkpoints/tracks in the `flight-data` named
  volume, exposed only by nginx at `/flight-sync/`. Never remove this volume on deploy. See
  [flight sync contract and backup/recovery](../docs/agents/FLIGHT_SYNC.md). The deploy smoke test
  also verifies that this storage service is reachable and can open its database.
- `deploy/homelab-deploy.sh` is a pull-based deploy: every 2 minutes a systemd **user** timer
  fetches `origin/develop` and, when it moved, rebuilds and restarts the container, then smoke-tests
  it. A GitHub self-hosted runner is not used: the repo is public (fork PRs could run code on the
  homelab) and registering a runner needs admin rights.

## On the homelab

```sh
git clone https://github.com/Nordsweet/Nordsweet-FMS.git /srv/stacks/fms-dev/repo
git -C /srv/stacks/fms-dev/repo checkout --detach origin/develop   # deploy/ lives on develop
ln -s /srv/stacks/fms-dev/repo/deploy/systemd/fms-dev-deploy.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now fms-dev-deploy.timer
```

```sh
systemctl --user start fms-dev-deploy.service             # deploy now
/srv/stacks/fms-dev/repo/deploy/homelab-deploy.sh --force  # redeploy the same commit
journalctl --user -u fms-dev-deploy.service -n 50          # deploy log
```

Caddy site block (in `/srv/stacks/caddy/Caddyfile`; `*.lab.vibecde.com` does not cover a
two-level name):

```
dev.fms.lab.vibecde.com {
	reverse_proxy localhost:8020
}
```
