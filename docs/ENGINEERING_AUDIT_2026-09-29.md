# Engineering Audit: APIs, Build, and Reliability

**Date:** 2026-09-29

> **See also:** [ENGINEERING_AUDIT_2026-09-30.md](ENGINEERING_AUDIT_2026-09-30.md) — Comprehensive follow-up audit covering svelte-check remediation, build status, test suite, and dependency health.

## Findings and Changes

- TypeScript diagnostics exposed invalid `Writable.get()` usage, mismatched route types, stale profile calls, and missing generated Vite environment types. The auth store now provides a typed synchronous getter, SvelteKit's generated `tsconfig` includes are preserved, and the local type errors are fixed.
- Vite resolved extensionless imports to same-name JavaScript files before TypeScript. Vite now prefers `.ts` so app imports use the maintained typed sources instead of stale JavaScript siblings.
- Vite's forced manual chunks referenced externalized or unsupported package roots. Those declarations were removed, and Firebase optimization uses its actual `firebase/app` and `firebase/messaging` exports.
- Supabase spatial reads used raw SQL and positional placeholders in `.select()` projections. They now call PostGIS-backed RPCs for bounds/nearby search and counts; nearby pagination no longer fetches every matching row to calculate a count.
- Notification rows were missing owner-scoped RLS, verification trusted a caller-supplied user ID, and client inserts could spoof several ownership columns. Migration 006 adds RLS and binds identity to `auth.uid()`.
- Agency approvals previously used multiple client writes and accepted a client-supplied reviewer ID. They now use authenticated, atomic database RPCs that validate admin role and set the reviewer from `auth.uid()`.
- A database trigger in the initial migration passed an invalid trigger argument and called an undefined notification function. It now uses a row-trigger wrapper; the upgrade migration also replaces that wrapper for existing installations.
- The routing map and Overpass bounds used coordinates outside Tacloban. The default map, sample route, and road bounds now use Tacloban-area coordinates. Simulated roads were removed, and routing fails rather than treating a failed hazard API call as hazard-free.
- The app manually registered a service-worker URL that was not a static asset and used `importScripts()` with ES modules. The manual registration was removed and a SvelteKit-bundled worker now precaches app assets and caches map tiles.
- Offline queue helpers previously returned success without sending data, which caused the queue processor to delete unsent actions. They now fail explicitly so queued items are retained. Background syncing itself remains unimplemented.
- The previous Jest-style suites could not run under Vitest and one imported nonexistent services. They were replaced with focused Vitest checks for spatial and agency RPC contracts.

## Verification

- `npx tsc --noEmit --pretty false`: passed.
- `npm test -- --run`: passed, 2 test files and 6 tests.
- `npm run build`: passed; SvelteKit emitted `.svelte-kit/output/client/service-worker.mjs`.
- `npm audit --omit=dev`: reported zero production dependency vulnerabilities in the audit run.

The build still reports existing unused CSS selector warnings and `No adapter specified`; the latter must be addressed for a specific deployment target.

## Deployment and Remaining Work

- Apply migrations in order, including `supabase/migrations/006_secure_notifications_and_spatial_api.sql`, to the Supabase project before using the new RPCs and policies. SQL could not be executed or linted in this workspace because it has no Supabase project config, local Postgres client, or Docker runtime.
- The Supabase URL and anon key were present in the local environment; their values were not recorded here. Firebase configuration was absent. FCM sending remains a placeholder and requires a server-side sender; privileged credentials must not be added to browser code.
- The E2E test file remains an outline; Cypress/Playwright are not installed. The nine `validate-step*.sh` scripts check file presence only.
- Several same-name `.js` siblings of TypeScript modules remain in the source tree. Vite's resolver is configured to select TypeScript first, but deleting/retiring generated JavaScript duplicates should be handled as a separate cleanup with care.

## Documentation Organization

Root-level project guides and the Supabase migration guide were moved into `docs/`. Existing documents already under `docs/` remain in place.
