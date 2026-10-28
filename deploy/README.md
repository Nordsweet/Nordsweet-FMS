# Deploy: develop → dev.fms.lab.vibecde.com

Pre-production, reachable only over Tailscale (no authentication yet).

- `nextjs/Dockerfile` builds the static export and serves it with nginx (`nextjs/deploy/nginx.conf`).
- `deploy/docker-compose.yml` (compose project `fms-dev`) publishes it on the Tailscale IP,
  `100.70.224.81:8020`; Traefik inside Coolify (a container, so it cannot reach `127.0.0.1` on the
  host) proxies `dev.fms.lab.vibecde.com` to it and terminates TLS.
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

Traefik (Coolify) routes `dev.fms.lab.vibecde.com` to `http://100.70.224.81:8020`. Keep the
compose port binding on that IP: a `127.0.0.1` binding is unreachable from the proxy container.

## Production (Coolify)

Branch `production` is deployed by a Coolify **Docker Compose** resource (base directory `/`,
compose location `/deploy/docker-compose.prod.yml`). Set the domain on the `web` service as
`https://<host>:80`. `flight-store` has no domain; nginx reaches it as `flight-store:8000`.
`.github/workflows/deploy-prod.yml` triggers the deploy over Tailscale on every push to `production`.
