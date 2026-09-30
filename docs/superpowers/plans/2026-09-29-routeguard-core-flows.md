# RouteGuard Core User and Agency Flows

**Status:** Ready for implementation  
**Scope:** Authentication and profile bootstrap, agency access requests and approval, community hazard reports, agency advisories.

## Goal

Complete the main signed-in workflows without trusting client-supplied roles or weakening Supabase Row Level Security (RLS). Keep the public map available to visitors; require an authenticated account to report hazards or request agency access. Only an approved `agency_personnel` account can publish advisories, and only an `admin` can approve agency requests.

## Current State

- `src/lib/authStore.ts` exposes `signOut()`, but the shared `src/routes/+layout.svelte` has no sign-in/sign-out action or auth-aware navigation. Auth initialization loads the session before registering the auth listener and awaits profile loading inside the listener.
- `src/routes/login/+page.svelte` signs in, then sends users to `/admin`, `/agency`, or `/`. `/admin` and `/agency` routes are absent; `/` currently attempts a redirect without importing SvelteKit's `redirect` helper. Use actual routes and make the common-user destination `/map`.
- `src/routes/register/+page.svelte` creates an Auth user but does not collect a full name or create a `user_profiles` row. `src/lib/stores/profile.ts` and `src/lib/profileUtils.ts` only load an existing profile; a missing row becomes `null` without a recovery path. `supabase/schema.sql` has no `auth.users` profile-creation trigger.
- Agency request submission exists in `src/routes/agency-request/+page.svelte` and `src/lib/agencyUtils.ts`. It requires an authenticated user in the service, but the page does not gate or redirect anonymous visitors. The `role` form/database field means an agency job title, not the RouteGuard role.
- Admin request listing and approve/reject RPCs exist at `src/routes/admin/agency-requests/+page.svelte`, `src/lib/agencyUtils.ts`, and in `supabase/schema.sql` / migration `006`. The page has no client-side role gate, and `loadAgencyRequests()` converts a query error into an empty list, making failures look like there are no requests. RLS and the RPC role checks must remain authoritative.
- Hazard reporting exists at `src/routes/report-hazard/+page.svelte`. It gets location once, requires GPS even if permission is denied, and tests coordinates with a falsy check (which incorrectly rejects valid zero coordinates). It inserts the hazard after uploading an optional photo.
- `src/lib/storageUtils.ts` expects a `hazard-photos` bucket, but the checked SQL does not create the bucket or its Storage policies. Its object key includes an unnecessary `hazard-photos/` prefix inside the bucket, and failed database inserts do not clean up uploaded files.
- `agency_advisories` and initial RLS policies exist in `supabase/schema.sql`, but there is no agency advisory route/service and the map does not load or display advisories. The insert policy checks that the caller has the agency role but does not require `created_by = auth.uid()`; the update policy checks ownership but not that the caller still has the agency role.
- `tests/e2e/userFlows.test.js` is an illustrative Cypress sketch, not an executable suite. Current executable coverage is Vitest, including a small mock test for the approval/rejection RPC wrappers.

## Security Invariants

1. The browser uses only the Supabase publishable/anon key. Never add a service-role/secret key to `VITE_*`, client code, or browser storage.
2. A profile starts as `common_user`. The browser cannot set or update `role` or `reputation_points`; use the database trigger and the authenticated admin approval RPC.
3. UI route guards improve navigation, but RLS and `SECURITY DEFINER` RPC checks enforce authorization.
4. Hazard inserts bind `reporter_id` to `auth.uid()`. Advisory inserts bind `created_by` to `auth.uid()` and require the current profile role to be `agency_personnel`.
5. Storage uploads are authenticated and scoped to a user-owned object path. Public photo reads are intentional only if the product confirms that hazard evidence is public.

## Implementation Sequence

### 0. Verify Supabase prerequisites

- Confirm the current project's `user_profiles`, `hazards`, `agency_requests`, `agency_advisories`, `hazard_confirmations`, `notifications`, enum labels, RLS policies, and RPC signatures. Do not replay bootstrap SQL against a populated project.
- Confirm PostGIS spatial functions and the fixed search paths in migration `006` are applied.
- Decide whether hazard photos are public. Create/configure the `hazard-photos` bucket and Storage policies in the Supabase project before enabling the upload control.
- Provision the first admin role out-of-band in the Dashboard using the correct Auth user UUID. There must be no public admin signup or client role selector.

**Exit check:** An authenticated browser client can read its own profile; anonymous users can read public hazards; no browser bundle or environment variable contains a service-role key.

### 1. Authentication, profile bootstrap, and logout

**Primary files:** `src/lib/authStore.ts`, `src/lib/stores/profile.ts`, `src/lib/profileUtils.ts`, login/register routes, `src/routes/+layout.svelte`, and a small SQL migration.

- Add a database trigger on `auth.users` that creates one `user_profiles` row with the Auth UUID, email, optional `full_name` from metadata, and the database default role `common_user`. Do not copy a role from user metadata. Make the trigger safe for duplicate profile creation without overwriting an existing approved role.
- Collect and pass full name during signup. Handle both Supabase confirmation modes: a returned session can be absent while email verification is pending. Configure the confirmation redirect and provide a clear “check your email” state.
- Make session initialization deterministic and represent loading, signed-out, profile-loading, and profile-error states separately. Subscribe once to auth events and clean up the subscription if the app lifecycle changes; avoid repeatedly fetching profile data on token refresh/focus events.
- Add a sign-out action to the shared shell/profile menu. Await the Supabase result, show errors, clear profile-scoped UI state on success, and return to `/map` or `/login` consistently.
- Redirect users to real destinations: common users to `/map`, admins to `/admin/agency-requests`, and agency personnel to a new `/agency` dashboard. Fix the root redirect or replace it with a direct `/map` navigation.
- Add role-aware navigation and a friendly unauthorized/not-found state. Do not rely on hidden links as authorization.
- Remove the `user.set({ ...currentUser, ...updates })` profile/auth object merge in `profileUtils.ts`; update the profile store from the profile response instead. Restrict profile updates to approved profile fields.

**Acceptance checks:** New signup produces exactly one `common_user` profile; email-confirmation and immediate-session configurations both show the correct state; sign-in restores session/profile after refresh; logout clears session/profile; admins and agency users reach existing routes; missing profile is surfaced as setup failure rather than silently treated as signed out.

### 2. Agency access request and approval

**Primary files:** `src/routes/agency-request/+page.svelte`, `src/routes/admin/agency-requests/+page.svelte`, `src/lib/agencyUtils.ts`, profile/auth stores, and the existing SQL RPCs/RLS.

- Require a signed-in common user to request agency access. Preserve the intended path through login and return to the request page after authentication.
- Prefill name/email from the profile; label the form's `role` as agency position/title so it cannot be confused with the security role. Trim and validate required fields and show submission, pending, approved, rejected, and retry states.
- Prevent duplicate pending requests per user (database constraint or transaction-safe RPC); never accept `status`, `reviewed_by`, or profile `role` from browser input.
- Add a role gate to the admin review page. Keep the existing `approve_agency_request` and `reject_agency_request` checks; display query errors distinctly from a truly empty queue. Ensure approval sets profile role and request status atomically and refresh the signed-in user's profile after approval.
- Keep request review actions disabled while pending RPCs run; make retries safe if the response is lost.

**Acceptance checks:** Anonymous submit is blocked; authenticated common user can submit once; users can only read their own requests; non-admin cannot list/review all requests or invoke approval/rejection; successful approval changes exactly that user's role and request status; rejection does not grant a role.

### 3. Community hazard reports

**Primary files:** `src/routes/report-hazard/+page.svelte`, `src/lib/storageUtils.ts`, hazard types, and Storage/database policies.

- Keep hazard creation on the existing route. Require authentication and explain/signpost login instead of attempting an insert with a null reporter.
- Make geolocation a clear state machine (requesting, located, denied/unavailable, retry). Provide a map-pin/manual-location fallback so reporting is not impossible when GPS permission is refused. Validate latitude/longitude with `== null`, not truthiness.
- Keep hazard categories aligned with the app's actual hazard vocabulary. Validate description length and image MIME type/size. Prevent duplicate submit and show actionable errors.
- Test the geography payload end-to-end; preserve longitude/latitude ordering. Keep initial status server-controlled as `unconfirmed` and let database defaults/triggers set timestamps/expiry.
- Define one object key format, preferably `<auth.uid()>/<uuid>.<ext>`, and create a bucket policy that verifies the first folder is the authenticated user's ID. If public bucket reads are approved, limit public access to reads; writes and deletes remain owner-scoped.
- Store a stable photo path or intentional public URL consistently. If the hazard insert fails after upload, delete the uploaded object; if upload fails, do not insert a report that claims to have a photo.
- Return the inserted hazard row and confirmation to the user; optionally navigate to or highlight the new report on the map.

**Acceptance checks:** Signed-in user can report with and without a photo; denied GPS can use manual placement; `(0, 0)` is not rejected by client validation; row reporter ID cannot be spoofed; other users cannot overwrite/delete the report or another user's storage object; upload/insert failure leaves no orphaned photo.

### 4. Agency advisory authoring and map display

**Primary files:** new agency dashboard/advisory route and service, `src/routes/map/+page.svelte`, advisory types, `supabase/schema.sql` or a forward migration, and RLS policies.

- Create an agency dashboard reachable at `/agency` for approved `agency_personnel` only. Start with a list of the agency user's own advisories and an “Add advisory” flow.
- Reuse `agency_advisories` fields: title, description, `advisory_type`, geography, start/end timestamps, and `is_active`. Support a practical MVP geometry editor (drop a point and draw a line/area only if the existing map interaction can do so reliably); preview the shape before publishing.
- Insert `created_by = auth.uid()` from the current session. Tighten RLS so inserts require both agency role and `created_by = auth.uid()`, and updates require the same role plus ownership. Do not add a client-side privileged key.
- Validate start/end ordering and advisory type; define whether future-scheduled records remain inactive until their start time or are selected by an active-time query.
- Add a typed advisory data service. Fetch public active advisories for the map, render their geography with a legend distinction from community hazards, show details on selection, and refresh after publish/edit using the existing realtime pattern or an explicit refresh.
- Decide whether advisory edits become active immediately or need admin review. The current schema/policies imply immediate agency publication; record any different policy as a schema/RLS change before implementation.

**Acceptance checks:** Community/common user cannot create or edit an advisory; an unapproved account cannot create one; approved agency user can create one only under their own ID; public map shows active/current advisory geometry and hides inactive/expired records; invalid geometry/time range is rejected before insert.

### 5. Automated verification and rollout

- Add focused Vitest coverage for auth/profile state transitions, request input and RPC behavior, hazard payload and cleanup, and advisory permissions/filters.
- Replace or clearly mark `tests/e2e/userFlows.test.js`, which currently references Cypress APIs without Cypress setup, with runnable browser E2E coverage. Cover signup/confirmation, login/logout, request/approval, report creation, and advisory publication using a dedicated Supabase test project/account set.
- Keep destructive cleanup isolated to test data IDs and the test project. Never reset production data as part of these tests.
- Run `npm test -- --run`, `npm run build`, and the E2E suite. Manually verify Supabase Auth redirect URLs, RLS results, Storage bucket policies, and map rendering against the connected project.

## Handoff Notes

- Implement in the order above; advisory publishing depends on reliable profiles and agency approval.
- The current Supabase schema already contains agency approval RPCs and role-protection triggers. Reuse and test them instead of creating parallel client-side role mutation logic.
- Existing frontend issues to resolve early: invalid post-login destinations, missing signup profile creation, no visible logout, the root redirect's missing `redirect` import, empty-list-on-query-error in agency review, GPS-only report submission, and missing advisory authoring/display.
- This plan does not require a service-role key. Any unavoidable privileged bootstrap belongs in the Supabase Dashboard/SQL migration process, never in the browser client.
