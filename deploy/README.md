# Deploy

Both environments are Coolify **Docker Compose** resources built from `deploy/docker-compose.prod.yml`
(base directory `/`; no host ports, Coolify's Traefik routes the domain set on the `web` service as
`https://<host>:80`; `flight-store` has no domain, nginx reaches it as `flight-store:8000`).

- `nextjs/Dockerfile` builds the static export and serves it with nginx (`nextjs/deploy/nginx.conf`).
- The internal `flight-store` service persists flight checkpoints/tracks in the `flight-data` named
  volume, exposed only by nginx at `/flight-sync/`. Never remove this volume on deploy. See
  [flight sync contract and backup/recovery](../docs/agents/FLIGHT_SYNC.md).

| Branch    | Coolify resource           | Domain                                                          | Trigger                             |
| --------- | -------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| `develop` | `svgtoq9uaq4ognic2x7u9vhy` | dev.fms.lab.vibecde.com (Tailscale only, no authentication yet) | `.github/workflows/deploy-dev.yml`  |
| `main`    | production resource        | see Coolify                                                     | `.github/workflows/deploy-prod.yml` |

Coolify is reachable over Tailscale only, so the workflows join the tailnet (`tag:ci`) and call
`POST /api/v1/deploy?uuid=<resource>` with the `COOLIFY_TOKEN` secret (needs deploy permission; reading
the resource list needs read). Coolify's own auto-deploy stays off to avoid double deploys. Required
repository secrets: `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `COOLIFY_TOKEN`.

Manual deploy: Coolify UI, or `gh workflow run "Deploy develop"`.
