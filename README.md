# REMI Bloom

REMI Bloom is a local-first plant and garden management PWA. It uses Next.js, NextAuth, Postgres, IndexedDB, and a durable offline sync queue so users can keep working after the app has been loaded once.

## Features

- Plant, reminder, todo, journal, inventory, location, progress, and garden planning tools.
- Offline cache and mutation queue backed by IndexedDB.
- Automatic sync back to Postgres when connectivity returns.
- NextAuth credentials login with bcrypt-backed Postgres users.
- Installable PWA with offline navigation fallback.
- Docker Compose stack with Postgres and the app exposed on port `4131`.

## Local Development

The app listens on port `4131`.

```powershell
node .\node_modules\next\dist\bin\next dev -p 4131 -H 0.0.0.0
```

If `npm` is available on your PATH, the equivalent command is:

```sh
npm run dev
```

## Docker Compose

For local Docker builds:

```sh
cp .env.example .env
docker compose up -d --build
```

For production/Dockhand installs, use the standalone production compose with the GHCR image:

```sh
docker compose -f docker-compose.prod.yml up -d
```

The production image is:

```text
ghcr.io/renji61/remi-bloom:latest
```

See `DEPLOYMENT.md` for required environment variables, migrations, admin bootstrap, and upgrade notes.

## First Admin Bootstrap

The seed endpoint is disabled by default in production unless `REMI_BLOOM_SEED_SECRET` is set and supplied.

```sh
curl -H "x-seed-secret: $REMI_BLOOM_SEED_SECRET" https://your-domain.com/api/seed
```

Change seeded passwords immediately after first login.

## Documentation

- `DEPLOYMENT.md` - production Docker Compose, Dockhand, GHCR, env vars, migrations, and upgrades.
- `MIGRATIONS.md` - database migration policy.
- `OFFLINE_SYNC.md` - offline cache and sync queue behavior.
- `TROUBLESHOOTING.md` - common local and production issues.

## Validation

```powershell
node .\node_modules\typescript\bin\tsc --noEmit
node .\node_modules\next\dist\bin\next build
```

`next lint` is deprecated in Next 15 and prompts for ESLint migration in this project.
