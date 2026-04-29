# Troubleshooting

## Port 4131 Is Not Reachable

Check whether another process is bound to the port:

```powershell
netstat -ano | Select-String ":4131"
```

Stop stale Node processes if needed, then restart:

```powershell
node .\node_modules\next\dist\bin\next dev -p 4131 -H 0.0.0.0
```

## App Returns 500 In Production

Common causes:

- `AUTH_SECRET` is missing.
- `AUTH_URL` does not match the public URL.
- `DATABASE_URL` points to an unreachable database.
- Migrations have not been run.

Check container logs:

```sh
docker compose logs app
docker compose logs postgres
```

## Seed Endpoint Returns 404 Or 403

In production, `/api/seed` is intentionally locked down.

- Set `REMI_BLOOM_SEED_SECRET`.
- Send it with `x-seed-secret`.
- If users already exist, seeding is skipped.

```sh
curl -H "x-seed-secret: $REMI_BLOOM_SEED_SECRET" https://your-domain.com/api/seed
```

## Login Redirects Or Cookies Fail

Verify:

- `AUTH_URL=https://your-domain.com`
- Browser uses the same hostname.
- Caddy or any upstream proxy forwards HTTPS correctly.
- System clock is correct.

## Offline Or PWA Behavior Looks Stale

The service worker is built only for production. In development, Serwist is disabled.

For production cache issues:

1. Hard refresh.
2. Unregister the service worker in browser devtools.
3. Clear site data.
4. Reload after the new deployment is healthy.

Queued offline mutations are stored in IndexedDB and replayed to `/api/sync` when connectivity returns.

## GHCR Pull Fails

If the package is private, authenticate the host running Docker:

```sh
echo "$GHCR_TOKEN" | docker login ghcr.io -u renji61 --password-stdin
```

If the package is public, verify the image name:

```text
ghcr.io/renji61/remi-bloom:latest
```

## Production Compose Still Builds Locally

Use both compose files:

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
```

The merged `app` service should show `image: ghcr.io/renji61/remi-bloom:latest` and no `build` block.
