# Comprehensive Engineering Audit: RouteGuard PWA

**Date:** 2026-09-30
**Auditor:** Automated remediation pass + static analysis

---

## 1. Project Overview

RouteGuard PWA is a SvelteKit 2 + Svelte 5 Progressive Web App for hazard-aware route planning. It integrates with Supabase (PostgreSQL + PostGIS), Firebase Cloud Messaging, and Leaflet.js for interactive maps with real-time hazard/advisory overlays.

**Tech Stack:** Svelte 5 (runes mode), SvelteKit 2, TypeScript 5, Vite 5, Supabase, Leaflet, Vitest, PostCSS.

**Entry point:** `src/app.html`, routed via SvelteKit file-based routing under `src/routes/`.

---

## 2. Verification Matrix

| Check | Tool | Result | Notes |
|---|---|---|---|
| **Type Safety** | `svelte-check` | ✅ 0 errors, 0 warnings | Fully clean |
| **Type Safety** | `tsc --noEmit` | ✅ Passes | No type errors |
| **Build** | `npm run build` | ✅ Succeeds | Warnings: empty server chunks, no adapter |
| **Unit Tests** | `npm test -- --run` | ⚠️ 20/20 pass, 4/8 suites fail | Failures from stale `.js` imports; all actual tests pass |
| **Security** | `npm audit --omit=dev` | ✅ 0 vulnerabilities | Clean |
| **Linting** | ESLint | ❌ Not configured | No `lint` script in package.json |
| **Formatting** | Prettier | ❌ Not configured | No `.prettierrc`; no lint/format scripts |

---

## 3. Svelte-Check Remediation Summary

The initial audit identified 26 TypeScript/Svelte errors and 3 warnings. All have been resolved.

### Fixes Applied (26 errors → 0)

| # | File | Error | Fix |
|---|---|---|---|
| 1-2 | `mapUtils.ts:371-372` | `Property 'length' on type 'unknown'` | Added `Array.isArray()` guard + `as [number, number]` cast for geometry coordinates |
| 3 | `Button.svelte:2` | `Cannot use export let in runes mode` | Migrated to `const { block = false, loading = false, disabled = false, children, ...restProps } = $props()` |
| 4 | `Field.svelte:2` | `Cannot use export let in runes mode` | Migrated to `const { label = '', error = undefined, children, ...restProps } = $props()` |
| 5 | `agency/+page.svelte:131` | `Cannot find name 'is_active'` | Fixed object shorthand `is_active` → `is_active: isActive` |
| 6-7 | `agency/+page.svelte:51,54` | `Field label/type props missing` | Resolved by Button/Field `$props()` migration |
| 8 | `login/+page.svelte:69` | `Button type prop missing` | Resolved by Button `$props()` migration |
| 9 | `map/+page.svelte:230` | `Type '() => void' not assignable to 'void'` | Changed `return () => {...}` to `onDestroy(() => {...})`; removed `Promise<void>` annotation |
| 10 | `map/+page.svelte:365` | `Cannot find name 'clearAdvisoryMarkers'` | Added to import from `$lib/mapUtils` |
| 11 | `map/+page.svelte:723` | `openSheet` not assignable to `MouseEventHandler` | Changed `on:click={openSheet}` → `on:click={() => showSheet.update(s => !s)}` |
| 12 | `register/+page.svelte:42` | `'data' does not exist in SignUpWithPasswordCredentials` | Fixed Supabase v2 API: `data` → `options: { data }` |
| 13-14 | `register/+page.svelte:70,74` | `Field label prop missing` | Resolved by Field `$props()` migration |
| 15 | `report-hazard/+page.svelte:279` | `Cannot use 'latitude' as a store` | Removed `$` prefix (plain `let` variable, not a store) |
| 16 | `report-hazard/+page.svelte:279` | `Cannot use 'longitude' as a store` | Removed `$` prefix |
| 17 | `report-hazard/+page.svelte:288` | `Cannot use 'geoError' as a store` | Removed `$` prefix |
| 18-21 | `route/+page.svelte:142-146` | `Cannot find name 'currentcurrentRoute'` | Fixed typo: `currentcurrentRoute` → `currentRoute` |
| 22-23 | `agency/+page.svelte:288` | Self-closing `<textarea />` ambiguous | Changed to `<textarea></textarea>` |
| 24-25 | `agency/+page.svelte:463,501` | Unused CSS selectors | Added `class:inactive` binding; removed dead `.advisory-form h2` rule |

### Deprecation Warnings Fixed (3 → 0)

| # | File | Warning | Fix |
|---|---|---|---|
| 1 | `Button.svelte:17` | `on:click` deprecated | Changed to `onclick={restProps.onClick}` |
| 2 | `Button.svelte:24` | `<slot />` deprecated | Changed to `{@render children()}` with `children` in `$props()` |
| 3 | `Field.svelte:15` | `<slot />` deprecated | Changed to `{@render children()}` with `children` in `$props()` |

---

## 4. Build & Deployment Status

### Vite Build
- **Status:** Succeeds
- **Output:** `.svelte-kit/output/` with client and server bundles (259 modules transformed)
- **Warnings:**
  - Empty chunks for `login/_page.server.ts` and `register/_page.server.ts` (server-only modules, expected)
  - `No adapter specified` — SvelteKit requires an adapter for SSR deployment

### Adapters
- No adapter configured in `svelte.config.js`
- **Recommendation:** Install `@sveltejs/adapter-auto` for development or a platform-specific adapter for production

---

## 5. Test Suite Status

### Passing (4 suites, 20 tests)
- `tests/local/basic.test.js` — 1 test
- `tests/local/simpleAdvisory.test.js` — 7 tests
- `tests/local/advisoryPermissions.test.js` — 9 tests
- `tests/local/sqliteHazardDb.test.js` — 3 tests

### Failing (4 suites, 0 tests run)
1. **`src/lib/routing/astar.test.ts`** — `vi.mock` factory references `mockSupabase` before initialization (hoisting issue)
2. **`tests/local/agencyUtils.test.js`** — Cannot resolve `../../src/lib/agencyUtils.js` (file is `.ts`)
3. **`tests/local/authProfile.test.js`** — Cannot resolve `../../src/lib/authStore.js` (file is `.ts`)
4. **`tests/local/hazardReporting.test.js`** — Cannot resolve `../src/lib/types/hazardReport` (module doesn't exist); also has a parse error

**Root cause:** Stale `.js` test files reference `.js` versions of TypeScript modules. Vite's resolver prefers `.ts` but the explicit `.js` extension in imports forces Vite to look for literal `.js` files.

---

## 6. Dependency Health

- **`npm audit --omit=dev`**: 0 vulnerabilities
- **Stale `.js` files**: 16 JavaScript files exist in `src/lib/` alongside TypeScript versions:
  `backgroundSync.js`, `codeSplitting.js`, `conflictResolution.js`, `firebase.js`, `imageOptimization.js`, `indexedDB.js`, `lazyLoad.js`, `mapTileCache.js`, `pagination.js`, `performanceMonitoring.js`, `queryCache.js`, `queryOptimization.js`, `serviceWorker.js`, `stores/notifications.js`, `stores/toast.js`
- Vite resolver configured to prefer `.ts` — stale files are not loaded at runtime but should be cleaned up

---

## 7. Code Quality & Hygiene

### ESLint / Prettier
- Not installed — no `lint` script in `package.json`
- No `.eslintrc` or `.prettierrc` configuration
- **Recommendation:** Install `eslintjs/eslint-plugin-svelte` and `prettier` with Svelte plugin

### Git Ignore
- Stale patterns in `.gitignore` may be excluding `docs/` and `tests/` from version control
- **Recommendation:** Review and fix `.gitignore` to track documentation and tests

---

## 8. Previously-Fixed Critical Runtime Issues

The following issues were identified and fixed in the earlier audit pass:

| Issue | Fix |
|---|---|
| `signOut` not imported in `+layout.svelte` | Added to import |
| `redirect` not imported in `+page.svelte` | Added `import { redirect } from '@sveltejs/kit'` |
| `showNotification` not imported in map page | Added to import |
| `AgencyRequest` type not imported | Added type import |
| Button/Field props broken in Svelte 5 | Migrated to `$props()` |
| `profile.get()` on writable stores | Changed to `get(profile)` |
| `toast()` called as function but imported as store | Changed to `get(toast)` |

---

## 9. Summary & Next Steps

| Priority | Items |
|---|---|
| **Immediate** (1 day) | Fix 4 failing test suites (update imports to remove `.js` extensions; fix vi.mock hoisting) |
| **Immediate** | Remove 16 stale `.js` files in `src/lib/` |
| **Immediate** | Install SvelteKit adapter for deployment |
| **Short-term** (1-2 days) | Install ESLint + Prettier; add `lint`/`format` npm scripts |
| **Short-term** | Fix `.gitignore` to track `docs/` and `tests/` |
| **Medium-term** | Implement email verification UI |
| **Medium-term** | Implement password reset flow |
| **Medium-term** | Wire up service worker registration |
| **Medium-term** | Connect offline capabilities (IndexedDB cache + background sync) |
| **Pre-launch** | Set up CI/CD pipeline (lint → check → test → build → deploy) |
| **Pre-launch** | Add bundle analysis and error tracking (Sentry) |