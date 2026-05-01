# Shared Garden Collaboration

## Overview

REMI Bloom's Shared Garden feature enables multiple users to collaborate on plant care within a shared collection. The system implements configurable visibility scopes and functional roles to ensure data integrity and coordinated daily care. All shared data is synchronized between members through a polling mechanism, and care actions include attribution to prevent conflicts.

## Data Model

The following interfaces (defined in `@src/lib/db.ts`) form the core of the shared garden system:

### SharedGarden

```
SharedGarden {
  id: string;
  ownerId: string;
  gardenName: string;
  code: string;               // 8-character alphanumeric invite code
  createdAt: string;
  members: SharedMember[];    // current garden members
  sharedPlantIds: string[];   // plant IDs shared in this garden
  pendingInvites: PendingInvite[];  // active, unconsumed invites
}
```

### SharedMember

```
SharedMember {
  id: string;                 // user ID of the member
  name: string;               // display name at time of joining
  role: "owner" | "caretaker" | "observer";
  scope: GardenScopeConfig;   // what this member can see
  addedAt: string;
  invitedBy: string;          // display name of the inviter
}
```

### GardenScopeConfig

```
GardenScopeConfig {
  type: "full" | "location" | "collection";
  locationIds?: string[];     // used when type = "location"
  plantIds?: string[];        // used when type = "collection"
}
```

### PendingInvite

```
PendingInvite {
  code: string;               // the invite code the new user enters
  role: "caretaker" | "observer";
  scope: GardenScopeConfig;   // the role and scope assigned on acceptance
  createdAt: string;
}
```

### CareEvent (relevant fields)

Includes a `performedBy: string` field set to the user's display name for attribution in the journal timeline.

### JournalEntry (relevant fields)

Includes a `performedBy?: string` field for optional attribution.

## The Three Scopes

| Scope | What the Member Sees |
|---|---|
| **Full Access** | All plants in the garden's `sharedPlantIds` array |
| **Location-Scoped** | Only plants assigned to specific location IDs (e.g. "West Balcony") |
| **Collection-Scoped** | Only a manually curated set of plant IDs (e.g. "High Maintenance") |

### Implementation

- The `@src/hooks/use-scoped-plants.ts` hook filters the full plants array client-side based on the current user's combined scopes from all shared gardens they belong to.
- The `@src/hooks/use-garden-role.ts` hook computes the effective permissions across all gardens: `canEdit`, `canManage`, `canAddPlants`, `canDeletePlants`, `canLogCare`. It returns a `GardenPermissions` object and a set of `visiblePlantIds`.

## The Three Roles

| Role | Permissions |
|---|---|
| **Owner** | Full control: manage members, delete garden, transfer ownership, add/delete plants, log care, edit everything. Cannot leave directly (must transfer ownership first). |
| **Caretaker** | View scoped plants, log care actions (water, fertilize, prune, repot, etc.), add journal entries, add photos, edit plant notes. Cannot delete plants, remove members, or modify garden configuration. Receives notifications and calendar activities for their scoped plants. |
| **Observer** | Read-only access. Can see garden status, plant details, and weather alerts. Cannot log actions, edit data, or create calendar or journal entries. |

## Invitation and Onboarding Workflow

1. **Owner** creates a garden on the Share page (`@src/app/share/page.tsx`). An 8-character alphanumeric invite code is generated automatically.
2. In the Manage Garden dialog, the owner selects a **Role** (Caretaker or Observer) and a **Scope** (Full, Location-based, or Collection-based) for the invite, then clicks "Generate Invite". A `PendingInvite` is created with the selected configuration and added to the garden's `pendingInvites` array.
3. **New user** enters the code on the "Join Garden" tab. The UI calls `GET /api/shared-gardens/lookup?code=XXXXX`, which queries Postgres directly. This resolves the earlier limitation where only the local IndexedDB was searched, preventing cross-device lookups.
4. If the code matches a `PendingInvite`, the user sees the garden name and the role/scope they will receive. If the user is already a member, the UI indicates this and disables joining.
5. User clicks **"Join Garden"**, which calls `POST /api/shared-gardens/join`. The server consumes the matching `PendingInvite`, adds the user as a member with the configured role and scope, and returns the updated garden.
6. A "Join Successful" screen displays the garden name, member count, and plant count. The garden appears in the user's "My Gardens" tab.
7. An offline fallback is available: if the API is unreachable, the join operation is applied locally to IndexedDB and queued for sync.

## Coordinated Daily Care (Anti-Conflict Logic)

- **Attribution**: Every `CareEvent` and `JournalEntry` created through shared gardens includes a `performedBy` field set to the acting user's display name.
- **Journal timeline**: The `@src/components/journal/timeline-entry-card.tsx` component displays "by [Name]" next to each journal entry.
- **Duplicate prevention**: Before saving a care action, the app calls `getCareEventsForPlantToday(plantId, type)` (defined in `@src/lib/db.ts`). If a care event of the same type for the same plant already exists from the current day and the performer is different, the second save is blocked with the message: "This action was just logged by [Name]. Duplicate ignored."
- **Live updates**: The `@src/hooks/use-shared-garden-sync.ts` hook polls `GET /api/sync` every 30 seconds. New care events and journal entries from other members are merged into the Zustand store in-place. If a garden was deleted or the current user was removed as a member, the garden is removed from the local store on the next poll cycle.

## Transferring Ownership and Leaving

- **Owner cannot leave directly**: The owner must first transfer ownership to a caretaker member via `POST /api/shared-gardens/transfer-ownership`. On transfer, the old owner becomes a caretaker and the selected caretaker becomes the new owner.
- **Non-owner members** can leave at any time via `POST /api/shared-gardens/leave`. Their data remains in the garden, but the garden and its shared plants disappear from their local view.
- **Revoked access**: If an owner removes a member or deletes the garden, the next poll cycle detects the change and removes the garden from the affected user's local store.

## Role-Based UI Restrictions

The permissions derived by `@src/hooks/use-garden-role.ts` are enforced across these pages:

| Page | Restricted Actions |
|---|---|
| `@src/app/home/page.tsx` | "Add Plant" / "Identify Plant" (owner/caretaker only), quick-care buttons (owner/caretaker only), plant detail edit/delete (per role) |
| `@src/app/calendar/page.tsx` | "Add" activity button, action item edit/delete buttons, double-click to create activity (all gated by `canLogCare` / `canEdit`) |
| `@src/app/journal/page.tsx` | "New Entry" / "Log Growth" buttons, entry edit/delete buttons (gated by `canLogCare`) |
| `@src/components/greenhouse/plant-card.tsx` and `@src/components/greenhouse/plant-list-view.tsx` | Quick-care and edit actions (gated by `canLogCare` / props) |

## API Endpoints

All shared garden API routes are defined under `@src/app/api/shared-gardens/`. Most require authentication via `requireAuth()` from `@src/lib/api-auth.ts`. The lookup endpoint is public (or optionally uses `requireAuth` if the caller is authenticated).

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/shared-gardens` | Required | List gardens where user is owner or member |
| POST | `/api/shared-gardens` | Required | Create a new garden (owner is set to current user) |
| PUT | `/api/shared-gardens` | Required | Update garden (owner only: name, members, sharedPlantIds) |
| DELETE | `/api/shared-gardens?id={id}` | Required | Delete garden (owner only) |
| GET | `/api/shared-gardens/lookup?code={code}` | Optional | Look up garden by invite code (returns garden name, member count, plant count, pending invites, membership status) |
| POST | `/api/shared-gardens/join` | Required | Join garden via invite code (consumes pending invite, adds member) |
| POST | `/api/shared-gardens/leave` | Required | Remove current user from garden membership |
| POST | `/api/shared-gardens/transfer-ownership` | Required | Transfer ownership to another member (owner only) |

## Sync Configuration

The `@src/app/api/sync/route.ts` sync engine includes the `sharedGarden` entity with:

- **Create fields**: `gardenName`, `code`, `createdAt`, `members`, `sharedPlantIds`, `pendingInvites`
- **Update fields**: `gardenName`, `members`, `sharedPlantIds`, `pendingInvites`

This ensures that pending invites and member changes are propagated through the standard sync mechanism along with all other entity data.

## Drizzle Schema

The `shared_gardens` table (`@src/db/schema/shared-gardens.ts`) uses:

| Column | Type | Constraints |
|---|---|---|
| `id` | `text` | Primary key |
| `owner_id` | `text` | Foreign key -> users.id, cascade on delete |
| `garden_name` | `text` | Not null |
| `code` | `text` | Not null, unique (8-character alphanumeric) |
| `created_at` | `timestamp` | Not null, default now() (string mode) |
| `members` | `jsonb` | Not null, default `[]` |
| `shared_plant_ids` | `text[]` | Not null, default `[]` |
| `pending_invites` | `jsonb` | Not null, default `[]` |

The `members` and `pending_invites` JSONB columns store arrays of `SharedMember` and `PendingInvite` objects respectively, allowing flexible schema evolution without additional migrations.
