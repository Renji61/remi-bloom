# Architecture & API Reference

## Database Schema

All database schemas are defined using Drizzle ORM in `@src/db/schema/`. The database is PostgreSQL 17. Each table uses UUID-style text primary keys and `cascade` on delete for foreign key relationships.

### users (`@src/db/schema/auth.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key, default `crypto.randomUUID()` |
| `username` | `text` | Not null, unique |
| `display_name` | `text` | Not null |
| `password_hash` | `text` | Not null (bcrypt) |
| `role` | `text` | Not null, default `"user"`, enum: `"admin"` or `"user"` |
| `avatar` | `text` | Default `""` |
| `email` | `text` | Not null |
| `active` | `boolean` | Not null, default `true` |
| `last_login_at` | `timestamp` (string mode) | Nullable |
| `created_at` | `timestamp` (string mode) | Not null, default now() |
| `updated_at` | `timestamp` (string mode) | Not null, default now() |

Also includes NextAuth adapter tables: `account`, `session`, `verificationToken`.

### plants (`@src/db/schema/plants.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `name` | `text` | Not null |
| `scientific_name` | `text` | Default `""` |
| `description` | `text` | Default `""` |
| `emoji` | `text` | Default `""` |
| `image_url` | `text` | Default `""` |
| `created_at` | `timestamp` | Not null, default now() |
| `planted_date` | `timestamp` | Nullable |
| `location_id` | `text` | Nullable |
| `tags` | `text[]` | Nullable |
| `garden_x` | `integer` | Nullable |
| `garden_y` | `integer` | Nullable |
| `garden_placed` | `boolean` | Default `false` |

### shared_gardens (`@src/db/schema/shared-gardens.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `owner_id` | `text` | Foreign key -> users.id, cascade on delete |
| `garden_name` | `text` | Not null |
| `code` | `text` | Not null, unique (8-character invite code) |
| `created_at` | `timestamp` (string mode) | Not null, default now() |
| `members` | `jsonb` | Not null, default `[]` |
| `shared_plant_ids` | `text[]` | Not null, default `[]` |
| `pending_invites` | `jsonb` | Not null, default `[]` |

### care_events (`@src/db/schema/care-events.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `plant_id` | `text` | Foreign key -> plants.id, cascade on delete |
| `plant_name` | `text` | Not null |
| `type` | `text` | Enum: `water`, `fertilize`, `repot`, `prune`, `other` |
| `date` | `timestamp` (string mode) | Not null |
| `note` | `text` | Default `""` |

The sync system maps `performedBy` from the client to the `note` column (included in the `careEvent` create/update fields). The client-side `CareEvent` TypeScript interface includes `performedBy: string` for attribution.

### journal_entries (`@src/db/schema/journal.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `plant_id` | `text` | Foreign key -> plants.id, cascade on delete |
| `plant_name` | `text` | Not null |
| `note` | `text` | Not null |
| `date` | `timestamp` (string mode) | Not null |
| `photo_url` | `text` | Nullable |

The sync system includes `performedBy` in the create/update fields for journal entries.

### action_items (`@src/db/schema/action-items.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `title` | `text` | Not null |
| `source` | `text` | Enum: `system`, `manual` |
| `type` | `text` | Enum: `water`, `fertilize`, `repot`, `prune`, `mist`, `clean`, `seed`, `transplant`, `harvesting`, `planting`, `maintenance`, `general` |
| `date` | `timestamp` (string mode) | Not null |
| `time` | `text` | Default `""` |
| `completed` | `boolean` | Not null, default `false` |
| `plant_ids` | `text[]` | Default `[]` |
| `plant_names` | `text[]` | Default `[]` |
| `note` | `text` | Default `""` |
| `repeat` | `text` | Not null, default `"none"`, enum with 11 values |
| `repeat_config` | `jsonb` | Default `{}` |
| `snoozed_until` | `timestamp` | Nullable |
| `category` | `text` | Not null, same enum as type |
| `created_at` | `timestamp` | Not null, default now() |

### plant_locations (`@src/db/schema/locations.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `name` | `text` | Not null |
| `description` | `text` | Default `""` |
| `emoji` | `text` | Default `""` |
| `image_url` | `text` | Default `""` |
| `created_at` | `timestamp` | Not null, default now() |

### tags (`@src/db/schema/tags.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `name` | `text` | Not null |
| `color` | `text` | Default `"#6366f1"` |
| `created_at` | `timestamp` | Not null, default now() |

### inventory_items (`@src/db/schema/inventory.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `name` | `text` | Not null |
| `category` | `text` | Not null, enum: `supply`, `seed`, `tool`, `other` |
| `quantity` | `integer` | Not null, default `0` |
| `unit` | `text` | Default `""` |
| `price` | `numeric` | Default `"0"` |
| `notes` | `text` | Default `""` |
| `image_url` | `text` | Default `""` |
| `created_at` | `timestamp` | Not null, default now() |

### garden_cells (`@src/db/schema/garden-cells.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `x` | `integer` | Not null |
| `y` | `integer` | Not null |
| `plant_id` | `text` | Nullable |
| `plant_name` | `text` | Nullable |
| `plant_emoji` | `text` | Nullable |
| `placed_at` | `timestamp` | Nullable |

Unique constraint on `(user_id, x, y)`.

### reminders (`@src/db/schema/reminders.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `title` | `text` | Not null |
| `plant_id` | `text` | Nullable |
| `plant_name` | `text` | Not null, default `""` |
| `type` | `text` | Enum: `water`, `fertilize`, `mist`, `repot`, `clean`, `seed`, `transplant`, `other` |
| `date` | `timestamp` | Not null |
| `time` | `text` | Default `""` |
| `repeat` | `text` | Not null, default `"none"`, enum: `none`, `daily`, `weekly`, `biweekly`, `monthly`, `custom` |
| `repeat_interval` | `integer` | Default `1` |
| `note` | `text` | Default `""` |
| `completed` | `boolean` | Not null, default `false` |
| `created_at` | `timestamp` | Not null, default now() |

### todos (`@src/db/schema/todos.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `title` | `text` | Not null |
| `description` | `text` | Default `""` |
| `date` | `timestamp` | Not null |
| `time` | `text` | Default `""` |
| `reminder_enabled` | `boolean` | Default `false` |
| `completed` | `boolean` | Not null, default `false` |
| `category` | `text` | Not null, default `"general"`, enum: `general`, `watering`, `planting`, `harvesting`, `maintenance` |
| `created_at` | `timestamp` | Not null, default now() |

### progress_entries (`@src/db/schema/progress.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `plant_id` | `text` | Foreign key -> plants.id, cascade on delete |
| `plant_name` | `text` | Not null |
| `date` | `timestamp` | Not null |
| `height` | `numeric` | Default `"0"` |
| `height_unit` | `text` | Enum: `cm`, `in`; default `"cm"` |
| `leaf_count` | `integer` | Default `0` |
| `notes` | `text` | Default `""` |
| `photo_url` | `text` | Default `""` |
| `harvest_yield` | `text` | Default `""` |
| `created_at` | `timestamp` | Not null, default now() |

### settings (`@src/db/schema/settings.ts`)

| Column | Type | Constraints |
|---|---|---|
| `key` | `text` | Primary key (format: `{userId}:{settingName}`) |
| `value` | `text` | Not null |

### species_cache (`@src/db/schema/species-cache.ts`)

| Column | Type | Constraints |
|---|---|---|
| `scientific_name` | `text` | Primary key |
| `species_data` | `jsonb` | Not null |
| `care_guide_data` | `jsonb` | Nullable |
| `cached_at` | `timestamp` | Not null, default now() |

### audit_logs (`@src/db/schema/audit-logs.ts`)

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `user_id` | `text` | Foreign key -> users.id, cascade on delete |
| `username` | `text` | Not null |
| `action` | `text` | Not null |
| `details` | `text` | Default `""` |
| `timestamp` | `timestamp` | Not null, default now() |

## Sync Contract

The sync mechanism is implemented at `@src/app/api/sync/route.ts` and documented in detail in `OFFLINE_SYNC.md`. This section summarizes the contract.

### GET /api/sync

Returns a full user snapshot on successful authentication. The response includes all entities owned by or shared with the authenticated user:

```
{
  plants: Plant[],
  careEvents: CareEvent[],
  locations: PlantLocation[],
  tags: Tag[],
  inventory: InventoryItem[],
  journals: JournalEntry[],
  gardenCells: GardenCell[],
  reminders: Reminder[],
  todos: Todo[],
  progress: ProgressEntry[],
  sharedGardens: SharedGarden[],
  actionItems: ActionItem[],
  settings: Record<string, string>   // flat key-value map (key without userId: prefix)
}
```

This endpoint is called on app boot after login to hydrate the Zustand in-memory store and the IndexedDB cache.

### POST /api/sync

Accepts a batched array of CRUD operations for offline queue replay:

```
{
  operations: SyncOperation[]
}
```

Each operation has the shape:

```
{
  operationId?: string,
  action: "create" | "update" | "delete" | "replace",
  entity: string,         // one of the 12 entity names
  recordId?: string,
  data?: object
}
```

**Limits and rules**:

- Maximum 100 operations per batch (returns 413 if exceeded).
- Settings use a special upsert mechanism with `key` format `{userId}:{settingName}`.
- `gardenCells` uses a `replace` action that deletes all cells for the user and inserts the new set atomically in a transaction.
- Plant deletion cascades: deleting a plant also deletes its care events, journal entries, progress entries, and reminders in a single transaction.
- All entity operations validate ownership: the `ownerColumn` (either `userId` or `ownerId`) must match the authenticated user.

### Response format

Each operation returns a result:

```
{
  operationId: string | null,
  entity: string,
  action: string,
  recordId: string | null,
  success: boolean,
  error?: string,
  status?: "created" | "updated" | "deleted" | "replaced" | "upserted"
}
```

### Sync entities

| Entity | Owner Key | Key Create Fields |
|---|---|---|
| `plant` | `userId` | `name` |
| `careEvent` | `userId` | `plantId`, `plantName`, `type`, `date` |
| `location` | `userId` | `name` |
| `tag` | `userId` | `name` |
| `inventoryItem` | `userId` | `name`, `category` |
| `journalEntry` | `userId` | `plantId`, `plantName`, `note`, `date` |
| `reminder` | `userId` | `title`, `type`, `date` |
| `todo` | `userId` | `title`, `date` |
| `progressEntry` | `userId` | `plantId`, `plantName`, `date` |
| `actionItem` | `userId` | `title`, `source`, `type`, `date`, `category` |
| `sharedGarden` | `ownerId` | `gardenName`, `code` |

### Image storage

Image blobs are stored locally in IndexedDB. Fields such as plant, location, inventory, journal, and favicon images may reference `upload:<id>` values that only resolve on the device where the image was uploaded. Use HTTPS image URLs when an image needs to appear across devices. Server-backed image storage is not yet implemented.

### Offline behavior

- The service worker (`@public/sw.ts`, built via Serwist) provides offline navigation fallback to `/offline` for navigational requests.
- In development, the service worker is disabled. Test offline behavior against a production build.
- Users must load the app once while online before offline capabilities are available.
- The sync queue in IndexedDB replays to `POST /api/sync` when the browser reports connectivity and `/api/ping` returns healthy.

## Client-Server State Flow

```
User Action
    |
    v
Zustand Store (in-memory)  <-- reads/writes
    |
    v
IndexedDB (Dexie)  <-- all mutations written here first
    |
    v
Sync Queue (IndexedDB)  <-- operations enqueued
    |
    v  (when online)
POST /api/sync  <-- batch replay to server
    |
    v
PostgreSQL via Drizzle ORM
```

On login:
```
GET /api/sync  -->  Zustand Store  +  IndexedDB Cache
```

## Notification System

Defined in `@src/lib/notification-engine.ts`.

### Engine options

| Engine | Description |
|---|---|
| `disabled` | Notifications are turned off |
| `gotify` | Gotify push notification server |
| `apprise` | Apprise API (supports 90+ notification services) |

### Configuration

Notification settings are stored per-user in IndexedDB (and synced to the server settings table):

| Setting Key | Description |
|---|---|
| `notificationEngine` | `"disabled"` | `"gotify"` | `"apprise"` |
| `notificationUrl` | Gotify server URL or Apprise API URL |
| `notificationToken` | Gotify app token or Apprise API key |
| `useWeatherAlerts` | Enable weather-based alerts |
| `useCareAlerts` | Enable care-reminder alerts |

### Proxy pattern

All notifications are proxied through `POST /api/notifications/test` on the REMI Bloom server. The server makes the external HTTP call to Gotify or Apprise. This avoids CORS, preflight, and private-network restrictions that would prevent the browser from calling LAN-hosted services directly.

### Weather alert priority levels

| Priority | Alert Type |
|---|---|
| 10 | Storm alerts (most urgent) |
| 9 | Frost warnings and heatwave alerts |
| 8 | Custom temperature threshold alerts (above/below) |
| 7 | Rain forecast alerts |
| 5 | Default/care reminder alerts (used when no priority specified) |

### Weather trigger logic

The `@src/hooks/use-weather-trigger.ts` hook monitors weather data from the Zustand store and triggers notifications when conditions are met:

- **Built-in thresholds**: Frost at <= 2 C, heatwave at >= 38 C, storm when weather main is `Thunderstorm`, `Squall`, or `Tornado`.
- **Configurable rules**: Temperature above/below thresholds (enabled and value stored as user settings), rain forecast within a configurable time window (in hours).
- **Duplicate suppression**: Each alert type is tracked by a `Set<string>` keyed by `{alertType}:{weatherLocationHash}` to prevent spamming on every weather data refresh.

## Security

### Authentication

- All API routes use `requireAuth()` or `requireAuthUser()` from `@src/lib/api-auth.ts`.
- The `requireAuth` function authenticates the session via NextAuth and returns the user ID.
- The augmented Session type (defined in `@src/types/next-auth.d.ts`) exposes `id`, `username`, and `role` directly on `session.user`.

### Authorization

- Shared garden mutations validate ownership: modify and delete operations check that the requesting user is the garden owner.
- The transfer-ownership endpoint verifies the requester is the current owner.
- The sync endpoint validates ownership of each entity: the `ownerColumn` must match the authenticated user.

### Content Security Policy

CSP headers are set via middleware (`@src/middleware.ts`):

- `script-src`: Restricted (external scripts limited)
- `style-src`: Restricted
- `img-src`: Restricted (includes Unsplash for plant images)
- `connect-src`: Restricted
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `DENY`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `report-uri`: `/api/csp-report`

### API key storage

API keys for Plant.id, Perenual, and OpenWeatherMap are stored per-user in IndexedDB settings (`@src/db/schema/settings.ts`). They are synced to the server via the standard settings sync mechanism. Client-side validation enforces minimum length (10 characters) when saving keys through the settings UI.

## External API Integration

### Plant identification (`@src/lib/identification-manager.ts`)

- **Plant.id API v3**: Identification via photo upload. Uses `fetchWithRetry` (2 retries, 1s backoff, 15s timeout).
- **Perenual API**: Species search and care guide enrichment. Also uses `fetchWithRetry`. Console warnings for missing API keys are gated behind `process.env.NODE_ENV !== "production"`.
- **Caching**: Perenual species and care guide data is cached in the `species_cache` table to reduce redundant API calls.
- **Timeout wrapper**: All external fetch calls use `AbortSignal.timeout(15000)` for a 15-second timeout.

### Weather (`OpenWeatherMap`)

- 5-day / 3-hour forecast API.
- Fetches use `AbortSignal.timeout(10000)` (10-second timeout).
- Weather data is stored in the Zustand store and refreshed on the Weather page (`@src/app/weather/page.tsx`).
- The weather badge component (`@src/components/layout/weather-badge.tsx`) displays current conditions with a 10-second timeout on fetches.
