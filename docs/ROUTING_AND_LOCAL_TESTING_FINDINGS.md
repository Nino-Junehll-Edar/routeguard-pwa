# Routing and Local Testing Findings

**Date:** 2026-09-29

## Scope

This note records the A* and routing review, the fixes applied during local testing, and the current SQLite testing setup. It is supplemental to [ENGINEERING_AUDIT_2026-09-29.md](ENGINEERING_AUDIT_2026-09-29.md).

## Routing Findings

### Fixed

- A* treated a valid start score of `0` as `Infinity` because it used `value || Infinity`. This prevented normal routes from expanding beyond the start node. Main-thread and worker implementations now use nullish fallback.
- Improved paths could leave stale entries in the open heap. The search now refreshes priorities and skips stale heap entries.
- The map route flow called `findNearestNode`, `getNode`, and `generateTurnByTurnInstructions` without importing them. The imports are now explicit.
- TypeScript and checked-in JavaScript routing copies were synchronized for the score and heap fixes.

### Remaining Risks

1. **Hazard score reconstruction is incomplete on the main thread.**
   `getHazardWeightAtLocationSync` currently returns `1.0`, so main-thread route results report zero hazard cost and score even when hazard weights influenced path selection. The worker performs asynchronous reconstruction, but the two result paths are inconsistent.

2. **Hazard lookup is expensive.**
   A* performs Supabase RPC calls serially while sampling every edge. A larger route can generate many network requests. Hazard data should be loaded once or cached in a spatial index before pathfinding.

3. **OSM one-way rules are ignored.**
   [osmLoader.ts](../src/lib/routing/osmLoader.ts) adds both directions for every way. OSM `oneway` and access tags need to be respected before this is safe for real navigation.

4. **Nearest-node calculations differ by execution mode.**
   The main thread uses degree-space Euclidean distance while the worker uses haversine distance. Both paths should share one distance implementation.

5. **Route-area hazard checks use the wrong query shape.**
   The route page uses PostgREST `contains` against a point geometry while describing the operation as a 100-meter search. It should use the existing `get_hazards_near_point` RPC or a dedicated `ST_DWithin` RPC.

6. **Overpass availability remains a runtime dependency.**
   Routing depends on the Tacloban Overpass request on first load. A production-ready implementation should cache the graph and define offline or stale-cache behavior.

## Local SQLite Testing

SQLite is now used only for local Node/Vitest tests. The production browser app still uses Supabase for remote data and IndexedDB for browser-side offline storage.

### Added

- `better-sqlite3` as a development dependency.
- An in-memory hazard database in [tests/local/sqliteHazardDb.js](../tests/local/sqliteHazardDb.js).
- Fixture-backed tests in [tests/local/sqliteHazardDb.test.js](../tests/local/sqliteHazardDb.test.js).
- Vitest discovery for `tests/local`, while keeping the Cypress-style `tests/e2e` outline out of Vitest.

The SQLite harness currently supports:

- Fixture seeding from `fixtures/hazards.js`.
- Radius filtering using haversine distance.
- Hazard type and status filters.
- Excluding expired hazards by default.
- Distance ordering, counts, offset, and limit behavior.

This gives local tests a real SQL-backed hazard store without changing the Supabase API contract or requiring a local Postgres/PostGIS installation.

## Verification

The following checks passed after the changes:

- `npm test -- --run`: **4 test files, 11 tests passed**.
- `npx vitest run tests/local/sqliteHazardDb.test.js --reporter=verbose`: **3 tests passed**.
- `npm run build`: **passed**.
- Editor diagnostics for touched files: **no errors**.

The existing build still emits unrelated Svelte unused-CSS warnings and `No adapter specified`; those are deployment/configuration follow-ups, not SQLite or routing test failures.

## Recommended Next Steps

1. Refactor hazard access behind an injectable routing hazard provider.
2. Use the SQLite provider in a full A* integration test with a deterministic road graph.
3. Cache hazard data before searching instead of issuing one RPC per sampled edge point.
4. Add OSM direction and access-tag handling.
5. Add a cached graph/offline policy for Overpass failures.
