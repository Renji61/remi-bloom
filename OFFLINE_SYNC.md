# Offline Sync Notes

REMI Bloom currently uses IndexedDB as the local cache and a durable `syncQueue`
for offline mutations. Queue replay is capped to small batches to protect the
server.

The current refresh step still calls `GET /api/sync`, which returns a full user
snapshot. As datasets grow, add per-entity `updatedAt` fields and a cursor-based
delta sync so reconnects only transfer records changed since the last successful
sync.

## PWA Notes

Serwist builds the production service worker at `/sw.js`. It is disabled in
development, so offline navigation and install behavior should be verified
against a production build. Users need to load or install the app once while
online before cached pages and offline mutations are available.

Offline mutation support covers the main user-facing entities and replays queued
operations to `/api/sync` when the browser reports connectivity and `/api/ping`
is healthy.
