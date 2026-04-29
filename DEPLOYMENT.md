# Deployment

This guide covers production deployment with Docker Compose, Dockhand, GHCR, Postgres, and Caddy.

## Image

Production deployments should pull:

```text
ghcr.io/renji61/remi-bloom:latest
```

Versioned releases can use tags published by the GitHub Actions workflow, for example `ghcr.io/renji61/remi-bloom:1.0.0`.

## Required Environment

Create `.env` from `.env.example` and set strong values:

```env
DB_PASSWORD=change_me_to_a_long_random_password
AUTH_SECRET=generate_with_openssl_rand_base64_32
DOMAIN=plants.example.com
AUTH_URL=https://plants.example.com
REMI_BLOOM_SEED_SECRET=generate_with_openssl_rand_base64_32
REMI_BLOOM_IMAGE_TAG=latest
```

`AUTH_URL` must match the public URL used in the browser, including `https://` in production. NextAuth cookies and redirects depend on it.

## Docker Compose

Local build:

```sh
docker compose up -d --build
```

Production image pull:

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The production override resets the local `build` block and uses `ghcr.io/renji61/remi-bloom:${REMI_BLOOM_IMAGE_TAG:-latest}`.

## Dockhand

Use the repository compose files as the Dockhand app source:

- Base compose: `docker-compose.yml`
- Production override: `docker-compose.prod.yml`
- Image: `ghcr.io/renji61/remi-bloom:latest`
- Required env: `DB_PASSWORD`, `AUTH_SECRET`, `DOMAIN`, `AUTH_URL`, `REMI_BLOOM_SEED_SECRET`
- Persistent volumes: `pgdata`, `caddy_data`, `caddy_config`

Set `DOMAIN` to the hostname Dockhand will expose. Caddy reads it through the `{$DOMAIN:localhost}` placeholder in `Caddyfile`.

## Database Migrations

Committed Drizzle migrations are the source of truth. Run migrations before starting or upgrading the app:

```sh
npm run db:migrate
```

For Docker deployments, run migrations from a checkout or CI environment that has the same `DATABASE_URL` as production. The app image contains committed migrations, but it does not silently migrate on start.

## First Admin Bootstrap

In production, `/api/seed` requires `REMI_BLOOM_SEED_SECRET` and does not return plaintext passwords.

```sh
curl -H "x-seed-secret: $REMI_BLOOM_SEED_SECRET" https://$DOMAIN/api/seed
```

After seeding:

1. Sign in with the seeded admin account.
2. Change the password immediately from the profile page.
3. Create named administrator accounts.
4. Rotate or remove the seed secret if it is no longer needed.

## Upgrades

1. Back up Postgres.
2. Pull the new image tag.
3. Run migrations.
4. Restart the stack.
5. Verify `/api/ping` and login.

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Backups

At minimum, back up the `pgdata` volume. A commented backup service is included in `docker-compose.prod.yml` as a starting point for scheduled `pg_dump` backups.
