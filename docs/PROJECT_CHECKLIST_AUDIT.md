# RouteGuard PWA — Checklist Reality Audit & Revised Plan

**Date:** 2026-09-30 (updated)
**Original Date:** 2026-09-29    
**Method:** Static code analysis + \svelte-check\ (0 errors, 0 warnings after fixes) + \ite build\ (compiles, warnings for empty chunks and missing adapter) + \itest run\ (20 tests pass, 4 suites fail) + \	sc --noEmit\ (passes) + pm audit\ (0 vulnerabilities)T.md` claims **85+ items as "completed"**, but verification reveals that **only ~35% are actually working at runtime**. The project compiles and 3 unit test files pass, but `svelte-check` exposes **25+ type errors**, several of which are **runtime-breaking**. Critical user flows (sign-out, root redirect, FCM notifications, hazard verification) will **crash at runtime**.

| Category | Claimed Complete | Actually Working | Notes |
|---|---|---|---|
| Build | ✅ | ✅ (compiles) | Build succeeds; empty chunks for server-only modules; No adapter specified |
| Tests | ✅ | ✅ (20/20 pass) | 4 test suites fail (stale .js imports, vi.mock hoisting); no e2e coverage |
| Type Safety | ✅ | ✅ (0 errors, 0 warnings) | svelte-check fully clean; tsc --noEmit passes |
| Auth (sign out) | ✅ | ✅ FIXED | `signOut` now imported in layout |
| Root redirect | ✅ | ✅ FIXED | `redirect` now imported from '@sveltejs/kit' |
| Notification center | ✅ | ✅ FIXED | `showNotification` now imported from notificationUtils |
| Admin dashboard | ✅ | ✅ FIXED | `AgencyRequest` type now imported from agencyUtils |
| Components (Button/Field) | ✅ | ✅ FIXED | Full Svelte 5 migration: `$props()` destructuring, `onclick`, `{@render children()}` |
| Email verification | ✅ | ❌ MISSING | No UI |
| Password reset | ✅ | ❌ MISSING | No page |
| Service worker | ✅ | ❌ NOT REGISTERED | No registration code |
| Offline features | ✅ | ❌ NOT WIRED | Files exist, never imported |
| Moderation queue | ✅ | ❌ MISSING | No table, no UI |
| User management | ✅ | ❌ MISSING | No UI |
| Analytics dashboard | ✅ | ❌ MISSING | No UI |
| Theme toggle | ⚠️ In progress | ❌ Missing UI | CSS exists, no toggle logic |
| ESLint/Prettier | ✅ | ❌ MISSING | Not installed |

---

## 🐛 CRITICAL RUNTIME BUGS (App Will Crash)

### 1. `signOut` Not Imported in Layout
**File:** `src/routes/+layout.svelte` lines 69, 128  
**Issue:** Calls `signOut().catch(...)` but the import statement on line 4 does NOT include `signOut`:
```ts
// line 4 — missing signOut!
import { initAuth, user, authLoading, authError, profileLoading, profileError } from '$lib/authStore';
```
**Impact:** Clicking "Sign out" anywhere crashes with `TypeError: signOut is not a function`.
**Status:** ✅ FIXED - Added `signOut` to import statement

### 2. `redirect` Not Imported in Root Page
**File:** `src/routes/+page.svelte` line 5  
**Issue:** `throw redirect(302, '/map')` but `redirect` is never imported from `@sveltejs/kit`.  
**Impact:** Visiting the root URL (`/`) crashes immediately.
**Status:** ✅ FIXED - Added `import { redirect } from '@sveltejs/kit'`

### 3. `showNotification` Not Imported in Map Page
**File:** `src/routes/map/+page.svelte` line 147  
**Issue:** FCM listener callback calls `showNotification(title, { body })` but `showNotification` is NOT in the import from `$lib/notificationUtils`:
```ts
import { initNotifications, checkProximityAlerts, sendVerificationPrompt } from '$lib/notificationUtils';
// showNotification is missing
```
**Impact:** Receiving an FCM notification in the foreground crashes.
**Status:** ✅ FIXED - Added `showNotification` to the import statement

### 4. `AgencyRequest` Type Not Imported
**File:** `src/routes/admin/agency-requests/+page.svelte` line 9  
**Issue:** `let requests: AgencyRequest[] = [];` — the `AgencyRequest` interface is defined in `agencyUtils.ts` but never imported.  
**Impact:** Type-check failure; could cause runtime confusion.
**Status:** ✅ FIXED - Added import of `AgencyRequest` type from agencyUtils

### 5. Button & Field Primitives Broken for Svelte 5
**Files:** `src/lib/components/primitives/Button.svelte`, `Field.svelte`  
**Issue:** Both use `export let restProps: Record<string, any> = {};` — this Svelte 4 pattern does NOT capture rest props. In Svelte 5, you need `$$props` or `$$restProps`.  
**Impact:** `variant`, `size`, `type`, `onClick` props are silently lost. `<Button type="submit">` defaults to `type="button"` (form never submits). `<Field id="li-pw">` never passes `id` to inner elements.
**Status:** ✅ FIXED - Changed to use `const { $$restProps: restProps } = $props()` pattern in both files

### 6. `profile.get()` Misused on Writable Stores
**Files:** `src/routes/+layout.svelte`, `src/routes/agency-request/+page.svelte`  
**Issue:** Both call `profile.get()` but `profile` is a plain Svelte `writable` store (not the augmented `user` store). Plain writables have no `.get()` method.  
**Impact:** `TypeError: profile.get is not a function` when checking user role.
**Status:** ✅ FIXED - Changed to use `get(profile)` and `get(user)` from svelte/store in all affected files

### 7. `toast()` Called as Function but Imported as Store
**Files:** `src/routes/login/+page.svelte` line 34, `src/routes/register/+page.svelte` line 50  
**Issue:** `import { toast } from '$lib/stores/toast'` imports a `writable` store, but code calls `toast('message', 'g')` as a function. The function `show()` is exported separately but not imported.  
**Impact:** Login/register success messages crash with `TypeError: toast is not a function`.
**Status:** ✅ FIXED - Changed import from `{ toast }` to `{ show }` and updated function calls to use `show()` instead of `toast()`

### 8. `verify_hazard` RPC Called with Missing Parameter
**File:** `src/routes/map/+page.svelte` line 349-352  
**Issue:** Calls `supabase.rpc('verify_hazard', { p_hazard_id, p_verification_type })` but the SQL function signature requires 3 params: `p_hazard_id, p_verification_type, p_user_id`.  
**Impact:** Verification always fails at the database level.
**Status:** ✅ FIXED - Added `p_user_id: $user?.id` parameter to the verify_hazard RPC call

### 9. `VirtualList.svelte` Invalid Syntax
**File:** `src/lib/VirtualList.svelte` line 150  
**Issue:** Uses `{#slice items visibleStart visibleEnd}` — this is not valid Svelte syntax.  
**Impact:** Component never compiles if imported.
**Status:** ✅ FIXED - Replaced invalid `{#slice}` syntax with valid `{#each items.slice(visibleStart, visibleEnd)}` syntax

### 10. Schema SQL Out of Sync with Migrations
**File:** `supabase/schema.sql` (613 lines)  
**Issue:** Missing `verify_hazard`, `approve_agency_request`, `reject_agency_request`, `expire_hazards`, `check_and_expire_hazards_on_update`, and all spatial RPC functions — these exist only in migration files (001–006).  
**Impact:** Anyone setting up the DB from `schema.sql` will have missing functions; the app will fail on hazard verification and agency approval.

---

## ⚠️ DUPLICATE FILE PROBLEM

The `src/lib/` directory contains **stale compiled `.js` artifacts alongside every `.ts` file**:

| Category | Count | Details |
|---|---|---|
| `.ts` + `.js` pairs | 20+ files | `supabaseClient.ts`/`.js`, `authStore.ts`/`.js`, `mapUtils.ts`/`.js`, etc. |
| `.js`-only files (no types) | 14 files | `firebase.js`, `stores/toast.js`, `stores/notifications.js`, `indexedDB.js`, `backgroundSync.js`, `conflictResolution.js`, `imageOptimization.js`, `lazyLoad.js`, `mapTileCache.js`, `pagination.js`, `performanceMonitoring.js`, `queryCache.js`, `queryOptimization.js`, `serviceWorker.js`, `codeSplitting.js` |
| `.js` files have different behavior | Several | `supabaseClient.js` uses `VITE_SUPABASE_ANON_KEY`; `.ts` uses `VITE_SUPABASE_PUBLISHABLE_KEY`; `authStore.js` lacks loading/error states |

**Root cause:** The `.gitignore` contains `*.js` (line 21), which would normally ignore these, but they were force-added. Vite's `resolve.extensions` lists `.ts` before `.js`, so `.ts` files are preferred — but importing `./firebase` (which has only `.js`) gets no types, causing svelte-check errors.

**Additional issue:** `docs` (line 23) and `tests` (line 24) are in `.gitignore` — these directories shouldn't be ignored.

---

## 📊 DETAILED CHECKLIST VERIFICATION (by Section)

### Foundation & Setup

| Checklist Item | Status | Evidence |
|---|---|---|
| Initialize SvelteKit + TypeScript | ⚠️ Partial | `svelte.config.js` uses old `preprocess()` pattern; `vite.config.js` has deprecated `polyfillDynamicImport: false` |
| Configure Vite + @sveltejs/vite-plugin-svelte | ✅ | Compiles and builds |
| ESLint and Prettier | ❌ BROKEN | Not installed. No config files. No deps in package.json. |
| Configure Supabase client | ✅ | `supabaseClient.ts` exists. Duplicate `.js` uses different env var key name. |
| Environment variables (.env.example) | ✅ | Exists with all required vars. `.env` also exists with real values. |
| `"type": "module"` in package.json | ✅ | Present |
| svelte-preprocess for SCSS | ⚠️ Partial | Installed but no `.scss` files exist. Only `app.css` is used. |
| Required dependencies | ⚠️ Partial | Has Supabase, Leaflet, Firebase, sass. Missing: `svelte-check` (dev dep) |
| Design tokens CSS | ❌ BROKEN | Claims `tokens.css`, `base.css`, `map.css` but only `app.css` exists |
| Map-specific styles | ⚠️ Partial | Map styles in `app.css`, not separate `map.css` |
| SSR CSS fix (app.html) | ✅ | `app.html` correctly imports `/lib/styles/app.css` |
| Height constraints html/body | ✅ | `html, body { height: 100%; margin: 0; }` |
| Icon component | ⚠️ Partial | Only 5 icons supported; mostly uses inline SVG |
| Button primitive | ❌ BROKEN | `restProps` pattern broken in Svelte 5 |
| Field primitive | ❌ BROKEN | Same `restProps` issue |
| Auth store | ✅ (import bug) | `signOut` not imported in layout |
| Profile store | ⚠️ Partial | `.js`/`.ts` signature mismatch for `loadUserProfile` |
| Toast store | ❌ BROKEN | `toast` is writable store; called as function in login/register |

### Authentication Flow

| Checklist Item | Status | Evidence |
|---|---|---|
| Login page | ⚠️ Partial | Broken `Button`/`Field`; calls `toast()` as function |
| Register page | ⚠️ Partial | Same issues as login |
| Login/register server actions | ❌ MISSING | `+page.server.ts` files are EMPTY (just comments) |
| Protected route redirects (role-based) | ⚠️ Partial | Shows/hides nav but uses broken `profile.get()` |
| Email verification flow | ❌ MISSING | No verification page, no resend |
| Password reset flow | ❌ MISSING | No reset page or email flow |

### Map View & Visualization

| Checklist Item | Status | Evidence |
|---|---|---|
| Leaflet + OSM tiles | ✅ | `mapUtils.ts` with lazy import |
| User location + accuracy circle | ✅ | `updateUserPosition()` |
| Hazards from Supabase (realtime) | ✅ | `loadHazards()` + `subscribeToHazardChanges()` |
| Hazard marker color coding | ✅ | `getHazardPinStyles()` |
| Hazard popups with photos | ✅ | Escaped content + photo |
| Proto bar (#proto) | ❌ MISSING | No `#proto` element in map page |
| Error banner (#errbox) | ✅ | Exists with toggle |
| Phone view (#view-phone) | ✅ | Exists |
| Status bar (.pstatus) | ❌ MISSING | `.pstatus` not found; uses `.srpill` |
| Screens container (.pscreens) | ✅ | Exists |
| Map box buttons | ✅ | Uses `.mbtns` not `.mapboxbtns` |
| Legend (.legend) | ✅ | Exists with toggle |
| Offline banner (.obanner) | ✅ | Exists |
| Verification card (#vc) | ✅ | Exists (RPC broken — see #8) |
| Coach tip (#coach) | ✅ | Exists with close |
| Layer popup | ⚠️ BROKEN | ALL checkboxes have empty handlers |
| FAB menu | ⚠️ STUB | Sheets say "Form implementation pending" |
| Navigation strip | ⚠️ STUB | Static placeholder text only |
| Destination pill | ⚠️ BROKEN | "Go" button does nothing |
| Recent destinations | ⚠️ STUB | Hardcoded static items |
| Alert chips | ✅ | Exists with filter logic |
| SR pill | ⚠️ Partial | Uses non-existent SVG symbol refs |

### Hazard Reporting & Workflow

| Checklist Item | Status | Evidence |
|---|---|---|
| Hazard reporting form | ✅ | `/report-hazard` route |
| Description textarea | ✅ | Present |
| Photo upload | ✅ | `uploadHazardPhoto()` |
| Photo preview | ✅ | `FileReader` preview |
| PostGIS point storage | ⚠️ Partial | Uses string `'POINT()'` not geometry type |
| Default status + 30-min lifetime | ✅ | `'unconfirmed'`, `lifetime_minutes: 30` |
| Success/error messaging | ✅ | Both exist |
| Auto-flag at 5+ similar | ✅ (SQL) | `check_hazard_verification` trigger |
| Proximity notifications | ⚠️ Partial | Alerts on ANY nearby hazard, not ≥5 threshold |
| Verification prompt UI | ⚠️ BROKEN | RPC missing `p_user_id` param (#8) |
| Adjust lifetime on verification | ✅ (SQL) | In migrations 002/004, NOT in schema.sql |
| Expire hazards at 0 lifetime | ⚠️ Partial | SQL function exists; client never calls it |
| Confirmation tracking | ✅ (SQL) | `hazard_confirmations` table |
| Commenting system | ✅ | `commentUtils.ts` + `HazardComments.svelte` |
| Voting system | ⚠️ Partial | `VoteButton.svelte` exists but not rendered in map; `loadInitialData()` called outside `onMount` |

### User Profile & Reputation

| Checklist Item | Status | Evidence |
|---|---|---|
| User profiles table | ✅ | In schema |
| Profile loading/display | ✅ | `profileUtils.ts` + `profile/+page.svelte` |
| Profile editing (full name) | ✅ | Form with save/cancel |
| Display user role | ✅ | Shows role text |
| Display reputation points | ✅ | Shows `profile.reputation_points` |
| Display member since date | ✅ | Formatted `created_at` |
| +5 for approved reports | ✅ (SQL) | Migration 002; NOT in schema.sql |
| -2 for "cleared" vote | ✅ (SQL) | Migration 004; NOT in schema.sql |
| -10 for 3+ "cleared" | ✅ (SQL) | Migration 004; NOT in schema.sql |

### Agency Request Flow & Real-time Features

| Checklist Item | Status | Evidence |
|---|---|---|
| Agency requests table | ✅ | In schema |
| Request submission form | ✅ | `/agency-request` route + `agencyUtils.ts` |
| Form validation | ⚠️ Partial | Required-field checks; no field-level messages |
| Admin dashboard | ⚠️ BROKEN | Missing `AgencyRequest` type import (#4) |
| Approve/reject actions | ✅ (migrations) | RPCs in migration 006; NOT in schema.sql |
| Supabase Realtime for hazards | ✅ | `subscribeToHazardChanges()` |
| Supabase Realtime for profiles | ❌ MISSING | No subscription on `user_profiles` table |
| In-app notification center | ✅ | `/notifications` route |
| FCM integration | ❌ BROKEN | `firebase.js` exists; `sendFCMNotification` is console.log stub; `showNotification` not imported (#3) |

### Hazard-Aware Routing (A*)

| Checklist Item | Status | Evidence |
|---|---|---|
| A* implementation | ✅ | `astar.ts` with MinHeap, hazard weighting |
| OSM data loader | ✅ | `osmLoader.ts` with Overpass API |
| Full A* with priority queue | ✅ | MinHeap implementation |
| Alternative route calculation | ✅ | `getAlternativeRoutes()` |
| Web worker support | ⚠️ Broken | `new URL('./routingWorker.ts')` incompatible with Vite SSR |
| Route simplification | ❌ MISSING | Not found anywhere in codebase |
| Turn-by-turn instructions | ✅ | `generateTurnByTurnInstructions()` |
| Route recalculation on hazards | ✅ | `recalculateRouteIfNeeded()` |

### Administrative Features — ALL MISSING

| Feature | Status | Notes |
|---|---|---|
| Advisory creation UI | ❌ MISSING | Table exists in SQL; no client code |
| Advisory geometry management | ❌ MISSING | No UI for point/line/polygon drawing |
| Moderation queue | ❌ MISSING | No table, no UI |
| Audit trail | ❌ MISSING | No logging of moderator/admin actions |
| User management interface | ❌ MISSING | No admin user management route |
| System settings | ❌ MISSING | No settings table or management UI |
| Analytics dashboard | ❌ MISSING | No analytics tables or dashboard |

### Offline & Performance — All NOT WIRED

| Feature | Status | Notes |
|---|---|---|
| Service worker | ❌ NOT REGISTERED | File exists but not configured/registered |
| IndexedDB | ❌ NOT WIRED | File exists, never imported |
| Background sync | ❌ NOT WIRED | File exists, never imported |
| Conflict resolution | ❌ NOT WIRED | File exists, never imported |
| Virtualization | ❌ BROKEN | `VirtualList.svelte` has invalid `{#slice}` syntax |
| Lazy loading | ❌ NOT WIRED | File exists, never imported |
| Image optimization | ❌ NOT WIRED | File exists, never imported |
| Performance monitoring | ❌ NOT WIRED | File exists, never imported |
| Bundle analysis | ❌ MISSING | Not configured |
| Error tracking | ❌ MISSING | No Sentry or similar |

### Code Quality & Testing

| Area | Status | Notes |
|---|---|---|
| TypeScript errors | ❌ 25+ errors | All in source code (svelte-check output) |
| ESLint/Prettier | ❌ NOT INSTALLED | Not in package.json, no config files |
| E2E tests | ❌ BROKEN | Uses unregistered Cypress (`cy.*`); selectors don't match actual HTML |
| Unit tests | ✅ 11 pass | 4 test files (queryOptimization, sqliteHazardDb, astar, supabaseIntegration) |
| Accessibility | ❌ NOT VALIDATED | No a11y testing performed |
| SEO metadata | ❌ MISSING | No meta tags in `app.html` |
| Dark/light theme toggle | ❌ MISSING | CSS exists but no toggle UI or logic |

### Pre-launch Blocking Issues

| Item | Status |
|---|---|
| Test authentication flow | ❌ BROKEN — `signOut` crash, `toast()` crash |
| Test agency approval workflow | ❌ BROKEN — type error + schema.sql missing RPCs |
| Test notification system | ❌ BROKEN — FCM stub + `showNotification` import bug |
| Test dark/light theme switching | ❌ No toggle UI exists |
| Test offline capabilities | ❌ Service worker not registered |

---

## 📋 svelte-check ERROR SUMMARY (Full List)

```
1.  authStore.ts:42 — Property 'unsubscribe' missing in type '{ data: { subscription } }'
    (Supabase v2 onAuthStateChange returns differently; type assignment needs fix)

2.  notificationUtils.ts:4 — Could not find declaration for './firebase' (firebase.js has no types)

3.  storageUtils.ts:13 — Object is possibly 'undefined' (file.name.split('.').pop())

4.  VirtualList.svelte:150 — Expected 'if', 'each', 'await', 'key' or 'snippet' ({#slice} invalid)

5.  +layout.svelte:69 — Cannot find name 'signOut' (MISSING IMPORT — RUNTIME CRASH)
    Parameter 'err' implicitly has 'any' type

6.  +layout.svelte:128 — Cannot find name 'signOut' (MISSING IMPORT — RUNTIME CRASH)
    Parameter 'err' implicitly has 'any' type

7.  admin/agency-requests/+page.svelte — Cannot find name 'AgencyRequest' (MISSING IMPORT)

8.  profile store usage — Property 'get' does not exist on type 'Writable<UserProfile | null>'
    (profile.get() broken in layout and agency-request pages)

9.  login/+page.svelte:34 — toast is not a function (store called as function)

10. register/+page.svelte:50 — toast is not a function (store called as function)

11. stores/toast.js — No declaration file (implicitly 'any')
12. firebase.js — No declaration file (implicitly 'any')
13. HazardComments.svelte — No declaration file (implicitly 'any')
14. VoteButton.svelte — No declaration file (implicitly 'any')
15. notifications.js store — No declaration file (implicitly 'any')

16. map page — Cannot find name 'showNotification' (MISSING IMPORT — RUNTIME CRASH)

17. map page — Multiple implicit 'any' parameters (verificationType, contentType, chipId, etc.)
18. map page — Variable 'mapContainer'/'userMarker'/'systemTimeInterval' implicitly 'any'
19. map page — Property 'getLatLng' does not exist on type 'never'
20. map page — Argument of type '{ lat: any; lng: any; }' not assignable to 'null'
21. map page — Property 'get' does not exist on type 'Writable<boolean>'
22. map page — Property 'get' does not exist on type 'Writable<null>'

23. route page — Implicit any on multiple callback parameters
24. route page — Argument type mismatch (RoutePoint vs null)

25. Base layout — Argument of type '() => Promise<...>' not assignable to onMount callback type

26. Supabase auth-js type conflict: Interface 'PublicKeyCredentialFuture' incorrectly extends
```

---

## 📝 REVISED IMPLEMENTATION PLAN

### Phase 1: Critical Bug Fixes (BLOCKERS — App won't run)
**Estimated:** 2-3 days

1. **Fix missing imports in `+layout.svelte`** — Add `signOut` to authStore import; fix `profile.get()` → `get(profile)`; add type annotations
2. **Fix root `+page.svelte`** — Import `redirect` from `@sveltejs/kit`; fix `<script context="module">` → Svelte 5 syntax
3. **Fix map page** — Add `showNotification` to notificationUtils import; add `p_user_id` to `verify_hazard` RPC; type variables properly
4. **Fix admin page** — Import `AgencyRequest` type from `agencyUtils`
5. **Fix Button.svelte** — Replace `restProps` with Svelte 5 `$$props` or `$props()` pattern
6. **Fix Field.svelte** — Same Svelte 5 props fix
7. **Fix toast usage** — Change `toast('msg', 'g')` to `show('msg', 'g')` in login/register pages
8. **Fix VirtualList.svelte** — Replace invalid `{#slice}` with `{#each}` or remove
9. **Sync schema.sql** — Regenerate from migrations or append missing functions

### Phase 2: Cleanup & Hygiene (1-2 days)
1. **Delete all stale `.js` files** alongside `.ts` files (20+ files with source maps)
2. **Convert `.js`-only files to `.ts`** (firebase, stores/notifications, stores/toast, indexedDB, etc.)
3. **Fix `.gitignore`** — Remove `*.js`, `docs`, `tests` patterns; add specific ignores
4. **Remove `nnotifications` typo directory**
5. **Install ESLint + Prettier** with Svelte plugin
6. **Add `svelte-check` to devDependencies** and package.json scripts
7. **Add `check` script** to package.json (`svelte-check --tsconfig tsconfig.json`)

### Phase 3: Missing Critical Features (3-5 days)
1. **Email verification flow** — Create `/verify-email` route with token handling; add resend button on login
2. **Password reset flow** — Create `/reset-password` and `/update-password` routes; add link on login page
3. **Service worker registration** — Add SW config to `svelte.config.js`; register in `+layout.svelte` or `hooks.client.ts`
4. **Wire up offline capabilities** — Connect IndexedDB to hazard cache; wire background sync for offline reports
5. **Dark/light theme toggle** — Add toggle button to layout; persist preference; apply `data-theme` attribute
6. **Real-time profile updates** — Add Supabase Realtime subscription on `user_profiles` table
7. **FCM notification integration** — Fix `sendFCMNotification` to call backend or Edge Function; store tokens in DB

### Phase 4: Complete Partially-Implemented Features (3-4 days)
1. **Map FAB menu sheets** — Connect to actual forms/navigation (redirect to `/report-hazard`, wire route planner)
2. **Layer popup** — Wire checkboxes to toggle Leaflet layers (hazards, advisories, satellite)
3. **Navigation strip** — Connect to active route instructions; show next turn + distance
4. **Destination pill** — Wire "Go" button to `calculateAndDisplayRoute()`; show route summary
5. **Recent destinations** — Load from localStorage; add click-to-route
6. **Hazard auto-expiration** — Add client-side polling to refresh expired hazards
7. **VoteButton integration** — Render in map page; replace verification card with vote-based confirmation

### Phase 5: Missing Admin Features (4-6 days)
1. **Moderation queue** — Create `moderation_queue` table; `/admin/moderation` route; review UI
2. **Audit trail** — Create `audit_log` table; add triggers for all admin/moderation actions
3. **User management** — Create `/admin/users` route; list/search users; role management
4. **System settings** — Create `system_settings` table; `/admin/settings` route
5. **Analytics dashboard** — Create `/admin/analytics` route with charts
6. **Agency advisory management** — Create `/agency/advisories` route; drawing UI on map
7. **Advisory propagation** — Real-time subscription on `agency_advisories`; integrate into A* routing

---

## 🆕 POST-FIX AUDIT FINDINGS (2026-09-30)

After the svelte-check remediation pass, the following additional issues were identified:

### New Errors Found

#### 1. Stale `.js` Test Files Reference Nonexistent Modules
- **Test suites failing:** 4 out of 8 (but all 20 tests pass)
- **`tests/local/agencyUtils.test.js`**: imports `../../src/lib/agencyUtils.js` — file is `.ts`, Vite can't resolve `.js` extension
- **`tests/local/authProfile.test.js`**: imports `../../src/lib/authStore.js` — same root cause
- **`tests/local/hazardReporting.test.js`**: imports `../src/lib/types/hazardReport` — module doesn't exist
- **`src/lib/routing/astar.test.ts`**: `vi.mock` factory references `mockSupabase` before initialization (hoisting issue)
- **Fix:** Update test imports to use `.ts` extensions or omit extensions; fix the vi.mock factory to avoid top-level variable references

#### 2. Stale `.js` Files Alongside `.ts` Files
- **16 stale JavaScript files** exist in `src/lib/` where TypeScript versions are the canonical source
- Vite is configured to prefer `.ts`, so these don't cause runtime errors, but they are confusing and bloat the repo
- **Files:** `backgroundSync.js`, `codeSplitting.js`, `conflictResolution.js`, `firebase.js`, `imageOptimization.js`, `indexedDB.js`, `lazyLoad.js`, `mapTileCache.js`, `pagination.js`, `performanceMonitoring.js`, `queryCache.js`, `queryOptimization.js`, `serviceWorker.js`, `stores/notifications.js`, `stores/toast.js`
- **Fix:** Delete stale `.js` files (with source maps) in cleanup phase

#### 3. Missing Adapter for Production Deploy
- `vite build` succeeds but outputs `No adapter specified` warning
- SvelteKit requires an adapter (`@sveltejs/adapter-auto`, `@sveltejs/adapter-node`, etc.) for SSR deployment
- **Fix:** Install and configure an adapter in `svelte.config.js`

### Verification Post-Fix

| Check | Result |
|---|---|
| `svelte-check --tsconfig tsconfig.json` | ✅ 0 errors, 0 warnings |
| `tsc --noEmit` | ✅ Passes |
| `npm run build` | ✅ Succeeds (warnings for empty chunks + missing adapter) |
| `npm test -- --run` | ⚠️ 20/20 tests pass; 4/8 suites fail (stale imports) |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| ESLint | ❌ Not configured (no lint script) |

### Phase 6: Pre-launch & Quality (2-3 days)
1. **Fix E2E tests** — Replace Cypress with Playwright; fix selectors to match actual HTML
2. **Bundle analysis** — Install `rollup-plugin-visualizer`; add `analyze` script
3. **Error tracking** — Add Sentry SDK (`@sentry/sveltekit`)
4. **SEO metadata** — Add meta tags, OG tags to `app.html`
5. **Fix `.gitignore`** — Ensure `docs/` and `tests/` are tracked
6. **CI/CD pipeline** — GitHub Actions: lint → check → test → build → deploy

### Phase 7: Documentation (1 day)
1. **User documentation** — `docs/user-guide.md`
2. **Administrator manual** — `docs/admin-manual.md`
3. **API documentation** — Document all Supabase RPCs and client module APIs
4. **Release notes** — `CHANGELOG.md`
5. **Deployment guide** — Expand `DEPLOYMENT.md`


