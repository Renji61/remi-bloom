# REMI Bloom

REMI Bloom is a high-density balcony garden management PWA for urban gardeners and collaborative household plant care. It follows a local-first architecture: the primary data store is IndexedDB in the browser, with mutations enqueued for sync to a Postgres-backed server. The app works fully offline after initial load and syncs automatically when connectivity returns.

## Key Features

- **Plant Collection Management**: CRUD operations with search, filter (by location, tag, needs-care status), sort, and grid/list views. Each plant supports an emoji, photo, scientific name, planted date, location assignment, and tags.
- **Collaborative Shared Gardens**: Invite members via 8-character codes with configurable Roles (Owner, Caretaker, Observer) and Scopes (Full, Location-based, Collection-based). Members see only the plants their scope permits.
- **Anti-Conflict Care Logging**: Duplicate detection prevents double-watering within the same day. All care actions and journal entries are attributed with the performer's display name and displayed in the journal timeline.
- **Live Sync via Polling**: A 30-second polling interval (`GET /api/sync`) keeps shared garden members' data in sync. Care events and journal entries update in-place without a full page reload. Removed gardens or revoked memberships are detected and cleaned up on the next poll cycle.
- **Weather Alerts**: Built-in frost, heatwave, and storm alerts with configurable custom temperature above/below thresholds and rain forecast window rules. Delivered via Gotify or Apprise through a server-side proxy to avoid CORS restrictions.
- **Offline-First Architecture**: IndexedDB local cache with a durable sync queue. Mutations are written locally, enqueued, and replayed to the server when connectivity returns. Queue replay is capped to 100 operations per batch.
- **Garden Planner**: A Konva-based square-foot garden canvas where users can visually arrange plants on a grid.
- **Calendar, Journal, Inventory, Growth Progress, Todos, Reminders**: Comprehensive plant management toolkit with scheduled activities, timeline entries, categorized inventory, height/leaf-count tracking, and smart reminders with repeat configurations.
- **Plant Identification**: Upload photos for identification via the Plant.id API (v3), enriched with Perenual species and care guide data. Supports camera capture and image upload. Care schedules are parsed from Perenual's response and presented with per-task toggle selection.
- **Theme System**: Dark, Light, and System modes with accent color customization (emerald, terracotta, sky, lavender, rose). Persisted to localStorage and per-user IndexedDB settings.
- **PWA**: Installable with Serwist service worker caching, offline navigation fallback to `/offline`, and skip-waiting on update.
- **Docker Compose Deployment**: Local and production Docker Compose stacks with Postgres 17, automatic SQL migration execution on startup, and health checks.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (React 19) |
| Language | TypeScript 5 |
| UI | Tailwind CSS 4 + Radix UI primitives (Dialog, Select, Tabs, Popover) |
| Animations | Framer Motion 11 |
| Icons | Lucide React |
| State Management | Zustand 5 |
| Client DB / Offline | Dexie 4 (IndexedDB) |
| Server DB | PostgreSQL 17 via Drizzle ORM |
| Auth | NextAuth (v5 beta) with credentials provider, bcrypt |
| PWA | Serwist 9 (workbox-based service worker) |
| Notifications | Gotify or Apprise (proxied through server API) |
| Plant APIs | Plant.id (identification), Perenual (species + care guides) |
| Weather | OpenWeatherMap 5-day/3-hour forecast API |
| Canvas | React-Konva + Konva (garden planner) |
| Containerization | Docker Compose (local + production) |

## Architecture Overview

REMI Bloom uses a local-first pattern. The primary data store is IndexedDB in the browser, managed through Dexie. Every mutation is written to IndexedDB and enqueued in a durable sync queue. When the browser reports connectivity and `/api/ping` is healthy, the queue replays to the Postgres-backed API via `POST /api/sync`. On login, the app calls `GET /api/sync` to hydrate both the Zustand in-memory store and the IndexedDB cache with the full user snapshot. This means the app works fully offline after initial load, and syncs automatically when connectivity returns.

The sync mechanism supports 12 entity types: plants, care events, locations, tags, inventory items, journal entries, garden cells, reminders, todos, progress entries, shared gardens, and action items. Each entity has its own create, update, and delete operations with ownership validation on the server side.

## Local Development

The app listens on port `4131`.

```
node .\node_modules\next\dist\bin\next dev -p 4131 -H 0.0.0.0
```

If `npm` is available on your PATH:

```
npm run dev
```

### Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server on port 4131 |
| `npm run build` | Production build |
| `npm run start` | Start production server on port 4131 |
| `npm run db:generate` | Generate Drizzle SQL migration |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npx tsc --noEmit` | Type-check without emitting |

## Deployment

### Environment Variables

Create `.env` from `.env.example`:

| Variable | Required | Description |
|---|---|---|
| `DB_PASSWORD` | Yes | Postgres password |
| `DATABASE_URL` | Yes | Full Postgres connection string |
| `AUTH_SECRET` | Yes | NextAuth secret (generate with `openssl rand -base64 32`) |
| `AUTH_URL` | Yes | Public URL users access in the browser (include port if LAN) |
| `REMI_BLOOM_SEED_SECRET` | No | One-time seed endpoint password |
| `REMI_BLOOM_IMAGE_TAG` | No | GHCR image tag for production compose |

### Docker Compose (Local)

```
cp .env.example .env
docker compose up -d --build
```

The local compose builds the image from source and exposes the app on port `4131`.

### Docker Compose (Production / Dockhand)

```
docker compose -f docker-compose.prod.yml up -d
```

The production compose pulls from `ghcr.io/renji61/remi-bloom:latest` and uses an explicit `10.20.0.0/24` bridge subnet.

### First Admin Bootstrap

The `/api/seed` endpoint is disabled in production unless `REMI_BLOOM_SEED_SECRET` is set.

```
curl -H "x-seed-secret: $REMI_BLOOM_SEED_SECRET" https://your-domain.com/api/seed
```

Change seeded passwords immediately after first login. See `DEPLOYMENT.md` for full details on upgrades, backups, and Dockhand setup.

### Database Migrations

Committed SQL migrations under `src/db/migrations` are the source of truth. The Docker image runs bundled migrations automatically before starting the server. Applied filenames are tracked in the `__remi_bloom_migrations` table.

```
npm run db:generate
npm run db:migrate
```

## Validation

```
npx tsc --noEmit
npx next build
```

## Documentation

- `docs/architecture.md` -- Database schema, API reference, sync contract, notification system, security
- `docs/shared-garden.md` -- Full shared garden workflow, roles, scopes, invitation flow, anti-conflict logic
- `DEPLOYMENT.md` -- Production deployment, Dockhand, upgrades, backups
- `OFFLINE_SYNC.md` -- Offline cache and sync queue behavior
- `MIGRATIONS.md` -- Database migration policy
- `TROUBLESHOOTING.md` -- Common local and production issues
- `CHANGELOG.md` -- Release history
