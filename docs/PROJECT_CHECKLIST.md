# RouteGuard PWA Project Checklist

## Overview
This checklist tracks the progress of implementing the RouteGuard Svelte PWA with Supabase backend, adapted from the Z.AI design system. Tasks are organized by feature area and implementation phase.

## Legend

- [ ] Not Started
- [ ] In Progress
- [x] Completed
- [ ] Blocked

## Latest Verified Update (2026-10-02)

- [x] Added the self-contained RGIcons kit and wired inline SVG hazard, advisory, user-location, and route styling into Leaflet maps.
- [x] Changed light app/auth/report backgrounds to a cool gray-blue gradient and defined a separate dark gradient token.
- [x] Removed demo-account buttons from `/auth` and centered the sign-in/sign-up card.
- [x] Added agency Map and agency/admin Statistics navigation tabs; overview loading now exits to an auth/error state when a staff profile cannot be resolved.
- [x] Fixed advisory geometry updates to unwrap Leaflet GeoJSON Features before validating coordinates.
- [x] Added hazard flag submission and moderator action code plus forward migration 014 and a schema mirror.
- [ ] Apply and validate migrations 013/014 against a reachable Supabase database. The current browser session observed Supabase endpoint timeouts; the moderation table will not exist until migration 014 is applied.
- [ ] Authenticated visual verification of staff map/statistics, advisory drawing, theme switching, and auth layout.
- [ ] Implement hard hazard blocking, reliable rerouting from the user's current position, and selectable basemap styles per [the navigation/rerouting/map-layers plan](superpowers/plans/2026-10-02-community-navigation-and-map-layers.md).

---

## 🏗️ FOUNDATION & SETUP

### Project Infrastructure

- [x] Initialize SvelteKit project with TypeScript
- [x] Configure Vite with @sveltejs/vite-plugin-svelte
- [x] Set up ESLint and Prettier (if applicable)
- [x] Configure Supabase client (`src/lib/supabaseClient.ts`)
- [x] Set up environment variables (.env.example)
- [x] Add `"type": "module"` to package.json for ESM
- [x] Install and configure svelte-preprocess for SCSS support
- [x] Add required dependencies (Supabase, Leaflet, etc.)

### Design System Implementation

- [x] Create design system tokens (`static/lib/styles/tokens.css`)
- [x] Create base styles (`static/lib/styles/base.css`)
- [x] Create map-specific styles (`static/lib/styles/map.css`)
- [x] Fix SSR error by moving CSS links to `src/app.html`
- [x] Fix unused CSS selector warnings
- [x] Set proper height constraints for html/body
- [x] Enhance map.css for consistent form field styling

### Core Components

- [x] Create reusable Icon component (`src/lib/components/Icon.svelte`)
- [x] Create reusable Button primitive (`src/lib/components/primitives/Button.svelte`)
- [x] Create reusable Field primitive (`src/lib/components/primitives/Field.svelte`)
- [x] Fix Svelte $ prefix restrictions in components
- [x] Fix malformed conditional blocks in Icon.svelte

### State Management

- [x] Create auth store (`src/lib/authStore.ts`)
- [x] Create profile store (`src/lib/stores/profile.ts`)
- [x] Create toast store (`src/lib/stores/toast.js`)

### Authentication Flow

- [x] Implement login page (`src/routes/login/+page.svelte`)
- [x] Implement register page (`src/routes/register/+page.svelte`)
- [x] Implement login/register server actions
- [x] Implement protected route redirects based on user role
- [x] Implement email verification flow
- [x] Implement password reset flow (if needed)

---

## 🗺️ CORE APPLICATION FEATURES

### Map View & Visualization
- [x] Integrate Leaflet with OpenStreetMap tiles
- [x] Initialize map container with proper sizing
- [x] Implement user location tracking with accuracy circle
- [x] Load and display hazards from Supabase in real-time
- [x] Implement hazard marker color coding by status
- [x] Implement hazard popups with information and photos
- [x] Add full Z.AI map UI structure:
  - [x] Proto bar (`#proto`) with LGU logo and status
  - [x] Error banner (`#errbox`) for system messages
  - [x] Phone view (`#view-phone`) with screen container
  - [x] Status bar (`.pstatus`) with time/signal/battery
  - [x] Screens container (`.pscreens`) for different views
  - [x] Page padding (`.page`)
  - [x] Map box buttons (`.mapboxbtns`) for layers/legend
  - [x] Legend container (`.legend`) with toggle functionality
  - [x] Offline banner (`.obanner`) for connectivity status
  - [x] Verification card (`#vc`) for hazard confirmation prompts
  - [x] Coach tip (`#coach`) for contextual help
  - [x] Layer popup (`#lyrPop`) for base/overlay selection
  - [x] FAB menu (`#fabmenu`) for quick actions
  - [x] Backdrop (`.backdrop`) for modal dialogs
  - [x] Sheet (`.sheet`) for bottom panels
  - [x] Navigation strip (`.navstrip`) for route guidance
  - [x] Destination pill (`.destpill`) for input
  - [x] Recent destinations (`.recents`)
  - [x] Alert chips (`.achips`) for hazard type filtering
- [x] Implement selection pulse animation for selected hazards
- [x] Implement SR pill (`.srpill`) for system status

### Hazard Reporting & Workflow
- [x] Create hazard reporting form with type selection
- [x] Implement description textarea input
- [x] Implement photo upload to Supabase Storage
- [x] Implement photo preview before upload
- [x] Store hazard reports with PostGIS GEOGRAPHY point
- [x] Set default status to 'unconfirmed' with 30-minute lifetime
- [x] Implement success/error messaging
- [x] **TODO**: Implement full hazard workflow:
  - [x] Auto-flag hazards for verification at 5+ similar reports
  - [x] Send proximity notifications when ≥5 similar reports
  - [x] Implement verification prompt UI (Hazard Active/Cleared)
  - [x] Adjust hazard lifetime based on verification
  - [x] Expire and remove hazards when lifetime reaches 0
  - [x] Implement hazard confirmation tracking
  - [x] Add commenting system for hazards
  - [x] Add voting system (upvotes/downvotes) for hazards

### User Profile & Reputation System
- [x] Create user profiles table linked to Supabase auth
- [x] Implement profile loading and display
- [x] Implement profile editing (full name)
- [x] Display user role (admin/agency/common)
- [x] Display reputation points with styling
- [x] Display member since date
- [x] Implement reputation points system:
  - [x] +5 points for approved hazard reports
  - [x] -2 points per "Hazard Cleared" vote by others
  - [x] -10 points if 3+ users mark as "Hazard Cleared"
  - [x] No minimum/maximum limits

### Agency Request Flow & Approval
- [x] Create agency requests table with status tracking
- [x] Implement request submission form for common users
- [x] Implement form validation (required fields)
- [x] Implement success/error messaging on submission
- [x] Create admin agency requests dashboard
- [x] Implement request filtering (pending/approved/rejected)
- [x] Implement approve/reject actions for administrators
- [x] Automatically update user role to agency_personnel on approval
- [x] Implement request review tracking (who/when reviewed)

### Real-time Features
- [x] Set up Supabase Realtime subscription for hazards
- [x] Reload hazards on real-time changes
- [x] Set up Supabase Realtime for user profile updates
- [x] **Implemented notification system**:
  - [x] Initialize notification service after auth
  - [x] Request notification permissions
  - [x] Implement proximity alerts (<500m of active hazards)
  - [x] Implement verification prompt notifications
  - [x] Implement in-app notification center
  - [x] Implement notification read/unread states
  - [x] Integrate with Firebase Cloud Messaging (FCM) + local fallback

### Hazard-Aware Routing (A* Algorithm)
- [x] Create A* algorithm implementation (`src/lib/routing/astar.ts`)
- [x] Create OSM data loader (`src/lib/routing/osmLoader.ts`)
- [x] Create routing types interface (`src/lib/types/routing.ts`)
- [x] Implement Haversine distance calculation
- [x] Implement basic route finding with hazard weighting
- [x] Implement hazard-based edge weighting system
- [x] Show route distance, time, and hazard score
- [x] Display route segments with hazard cost breakdown
- [x] **Enhanced routing implementation**:
  - [x] Replace simulated OSM data with real data loading
  - [x] Implement proper nearest node finding for start/end points
  - [x] Implement full A* algorithm with priority queue
  - [x] Add alternative route calculation
  - [x] Implement route simplification for performance
  - [x] Add web worker support for heavy calculations
  - [x] Implement route visualization on map with polyline
  - [x] Add route instructions/turn-by-turn guidance
  - [ ] Replace count-based route refresh with geometry/remaining-corridor impact checks and current-position rerouting.
- [ ] Treat verified active impassable hazards and active official closure advisories as hard blocks; current A* applies soft weights only.
- [ ] Respect OSM one-way/access tags and use one hazard snapshot for search, route scoring, and explanation.
- [ ] Replace fixed sample endpoints with user-selected start/destination and active trip state.
- [ ] Add selectable street, terrain, satellite, and monochrome base maps without losing hazard/advisory/route overlays.
- [ ] Implement and verify the phases in [the community navigation and map layers plan](superpowers/plans/2026-10-02-community-navigation-and-map-layers.md).

### Administrative Features
- [x] Create agency admins table or role-based access
- [x] Implement agency advisory creation (official map advisories)
- [x] Implement advisory geometry storage (POINT/LINESTRING/POLYGON)
- [x] Implement advisory activation/deactivation
- [x] Implement advisory propagation to hazard map (5-second target)
- [x] Add hazard flag table/RLS and flag/resolve RPC definitions in migration 014 and schema mirror (not applied to the connected project).
- [x] Add a community flag action and admin moderation UI wired to the RPC contract.
- [ ] Apply migration 014 and verify flag submission, moderation actions, notifications, reputation changes, and audit records in Supabase.
- [x] Create user management interface for admins
- [ ] Implement system settings configuration.
- [x] Add basic role-specific Statistics pages for agency and admin; full analytics/reporting remain out of scope for that UI.

### Offline-first Capabilities (Future Enhancement)
- [x] Implement service worker for asset caching
- [x] Implement IndexedDB for offline data storage
- [x] Implement background sync for queued actions
- [x] Implement conflict resolution for offline changes
- [x] Implement offline map tile caching strategy
- [x] Implement offline hazard report queuing and submission

### Performance & Optimization (Future Enhancement)
- [x] Implement query optimization for hazard retrieval
- [x] Implement spatial indexing for geographic queries
- [x] Implement pagination for large datasets
- [x] Implement caching strategies for frequent queries
- [x] Implement virtualization for large lists
- [x] Implement image optimization for hazard photos
- [x] Implement lazy loading for non-critical resources
- [x] Implement code splitting for route-based loading

---

## 🔧 TECHNICAL QUALITY & TESTING

### Code Quality
- [x] Fix all TypeScript syntax errors in Svelte components
- [x] Ensure consistent code formatting
- [x] Implement proper error handling and logging
- [x] Add JSDoc comments for complex functions
- [x] Ensure proper component cleanup (onDestroy)
- [x] Validate accessibility (WCAG 2.1 compliance)
- [x] Implement proper loading and error states

### Testing
- [x] Write unit tests for utility functions
- [x] Write integration tests for Supabase interactions
- [x] Write end-to-end tests for critical user flows
- [x] Implement automated testing setup (if desired)
- [x] Create test data fixtures

### Performance Monitoring
- [x] Add performance monitoring for critical paths
- [x] Implement bundle analysis and optimization
- [x] Add memory leak detection
- [x] Implement error tracking and reporting

---

## 🚀 DEPLOYMENT & RELEASE

### Pre-launch Checklist
- [ ] Verify all environment variables are configured
- [ ] Test authentication flow completely
- [ ] Test hazard reporting with photo upload
- [ ] Test agency request and approval workflow
- [ ] Test real-time updates between clients
- [ ] Test map performance with multiple hazards
- [ ] Test routing algorithm with various scenarios
- [ ] Test notification system (proximity and verification)
- [ ] Test profile editing and reputation system
- [ ] Test dark/light theme switching at desktop/mobile and verify persisted theme behavior across auth, reports, and staff routes.
- [ ] Test responsive design on various screen sizes
- [ ] Test offline capabilities (if implemented)
- [ ] Verify SEO metadata and social sharing

### Deployment
- [x] Configure production Supabase project
- [x] Set up custom domain (if applicable) - Documentation added to DEPLOYMENT.md
- [x] Configure build optimization for production
- [x] Set up CDN for static assets (if needed) - Documentation added to DEPLOYMENT.md
- [x] Configure monitoring and error reporting
- [x] Create backup and recovery procedures
- [x] Document deployment process

### Launch Preparation
- [ ] Create user documentation and help guide
- [ ] Create administrator manual
- [ ] Create API documentation (if exposing endpoints)
- [ ] Prepare release notes
- [ ] Plan rollout strategy (phased release if applicable)
- [ ] Prepare marketing and announcement materials

---

## 📊 CURRENT STATUS SUMMARY

### ✅ COMPLETED (Foundation & Core)
- Project setup and Supabase integration
- Complete design system implementation (tokens, base, map styles)
- Reusable component library (Button, Field, Icon)
- State management (auth, profile, toast stores)
- Authentication system (login/register/role-based redirect)
- Agency request flow and approval system
- User profile and reputation system
- Basic map view with Leaflet and hazard display
- Hazard reporting form with photo upload
- Basic weighted A* routing implementation (hard closures and current-trip rerouting are not complete)
- Real-time hazard updates
- Profile viewing/editing
- Deployment preparation (Supabase setup, build optimization, monitoring, backup procedures)

### 🟡 IN PROGRESS / NEEDS VERIFICATION
- Apply and exercise migrations 013/014; the connected Supabase endpoint has timed out and local Docker/psql are unavailable.
- Verify admin/user/moderation/audit data reads against deployed RLS and tables.
- Verify advisory create/edit/draw flows in an authenticated browser and the public map.
- Implement actual hard road blocking, trip-state rerouting, directed OSM roads, and map base-layer selection per the new plan.
- Verify responsive/dark-theme/auth and staff navigation in authenticated browser sessions.

### 🔜 COMING NEXT
1. Restore Supabase connectivity and apply/verify forward migrations 013 and 014.
2. Finish authenticated browser verification for staff routes, advisory drawing, and dark mode.
3. Implement hard hazard/advisory blocks and reliable live rerouting from the user's current location.
4. Add compliant selectable street, terrain, satellite, and monochrome map layers.
5. Finish remaining admin user filters/pagination and audit search/export acceptance criteria.

---

## 📝 NOTES & CONSIDERATIONS

### Design System Adaptation Notes:
- The Z.AI design system uses CSS variables extensively for theming
- Dark theme is implemented via `[data-theme=dark]` selector
- All colors, borders, radii, shadows, and typography use CSS variables
- The agency request screen confirms the design system is working correctly
- The app canvas uses a gray-blue light gradient and a separate dark gradient; map base-layer choices remain planned.

### Technical Implementation Notes:
- Supabase Auth handles user authentication
- Row Level Security (RLS) policies should be implemented in Supabase for data protection
- PostGIS extension is used for geographic queries and hazard proximity calculations
- Realtime updates are handled via Supabase Realtime API
- Photo storage uses Supabase Storage bucket
- The current A* path is client-side by default and samples hazards per edge; worker performance and blocker snapshot semantics need measurement and verification.
- Service workers for offline capability can be added later as an enhancement

### Next Validation Steps:
When running `npm run dev`, check:
1. Network tab for CSS/JS loading errors and Supabase reachability
2. Console tab for JavaScript errors during auth bootstrap and map drawing
3. Elements tab to verify light/dark canvas and RGIcons styles
4. Authenticated agency/admin workflows, route rerouting, and map layers against the linked plan

This checklist will be updated as tasks are completed and new requirements emerge.