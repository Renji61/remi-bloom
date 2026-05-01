# Changelog

## [Unreleased]

### Added

- **Shared Garden Collaboration**: Full multi-user garden sharing with configurable roles (Owner, Caretaker, Observer) and scopes (Full, Location-based, Collection-based). Includes invite code system, join flow, "Leave Garden", and ownership transfer. See `docs/shared-garden.md` for complete workflow documentation.
- **Anti-Conflict Care Logging**: Duplicate detection prevents double-watering on the same day. All care actions and journal entries are attributed with the performer's display name.
- **Live Polling Sync**: 30-second polling for shared garden members to see real-time care updates without manual refresh. Polls `GET /api/sync` and merges changes into the Zustand store in-place.
- **Per-Task Care Schedule Toggles**: Users can now select individual care schedule activities when identifying a plant, rather than accepting all or nothing.
- **Weather Forecast Alert Rules**: Configurable temperature above/below thresholds and rain forecast alerts, accessible from the Weather page. Alerts delivered via Gotify or Apprise through a server-side proxy.
- **API Key Format Validation**: Client-side validation in settings warns if API keys appear malformed (minimum 10 characters) before saving.
- **Route-Level Loading State**: Added `src/app/home/loading.tsx` with a spinner for route transitions.
- **HTTPS Redirection**: Middleware now redirects HTTP to HTTPS in production when not on localhost.
- **CSP Report URI**: Content Security Policy includes `report-uri /api/csp-report` for monitoring policy violations.
- **Retry Logic for External APIs**: Plant.id and Perenual API calls include `fetchWithRetry` (2 retries, 1s backoff, 15s timeout).

### Fixed

- **Identify Plant Flow**: Fixed pre-filled data being lost due to React state batching (form reset clearing identified data before pre-fill applied).
- **Camera Black Screen**: Fixed video stream not being assigned to the `<video>` element in the identification dialog.
- **Calendar Timezone Bug**: Fixed date filtering using `toISOString()` which shifted dates by UTC offset. All YYYY-MM-DD comparisons now use locale-safe string construction.
- **Light/Dark Mode Readability**: Fixed low-opacity text, hardcoded icon colors, invisible dividers, and tag color contrast issues across all pages. Admin sidebar link now uses theme-aware CSS variables instead of hardcoded `text-purple-400`.
- **Shared Garden Code Lookup**: Fixed cross-device code lookup by adding a server-side API endpoint (`GET /api/shared-gardens/lookup`) instead of searching only local IndexedDB. The join flow now includes a functional "Join Garden" button that calls `POST /api/shared-gardens/join`.
- **IndexedDB Race Condition**: Added a `useRef` loading guard in `app-shell.tsx` to prevent duplicate data loading in React StrictMode.
- **NextAuth Type Safety**: Created `src/types/next-auth.d.ts` to augment the NextAuth Session type, removing unsafe `as any` casts throughout the codebase.
- **Stale Closure in Sync Hook**: Fixed the `poll` callback in `useSharedGardenSync` to use a ref for accessing the latest `sharedGardens` state, preventing inaccurate removed-garden detection.
- **Unused Import**: Removed unused `AnimatePresence` import from the identify-plant dialog.
- **Console Log Gating**: `console.warn` calls in the identification manager and `console.error` in the error page are now gated behind `process.env.NODE_ENV !== "production"`.
- **Image URL Resolution**: SafeImage component now resolves `upload:` prefixed URLs (IndexedDB blob references) into blob URLs before rendering.
- **Weather API Timeout**: Initial weather fetch and weather badge fetches now include `AbortSignal.timeout(10000)` for 10-second timeout.

### Changed

- **Calendar**: Renamed "Actions" to "Activities" in all user-facing labels. Added role-based restrictions on "Add" and edit/delete buttons.
- **Homepage**: Reordered filter buttons, added icons with mobile-responsive visibility, improved plant age display with relative time formatting. Integrated shared garden scope-based plant filtering.
- **Tags/Locations/Journal**: Consolidated sort buttons into toggle pattern, added icons with mobile-responsive visibility.
- **Safety Image Component**: Now asynchronously resolves `upload:` prefixed image URLs from IndexedDB blobs before rendering.
