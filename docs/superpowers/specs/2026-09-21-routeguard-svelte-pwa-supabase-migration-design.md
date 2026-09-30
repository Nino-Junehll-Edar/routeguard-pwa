# RouteGuard Svelte PWA with Supabase Migration - Design Specification

**Date:** 2026-09-21  
**Status:** Approved  

## Overview
This document specifies the migration of the RouteGuard concept (from [RouteGuard_Chapter3.md](../../RouteGuard_Chapter3.md)) to a Pure Svelte PWA with Supabase backend. The application will serve as a unified platform for both commuters (common users) and agency personnel, replacing the existing Flutter/Dart mobile app and React web dashboard.

## Core MVP Features

### 1. Roles & Permissions
- **Admin:** System administrators (user management, settings, audit logs)
- **Agency Personnel:** LGU/DOT officers (can create official map advisories)
- **Common Users:** Tacloban community members (hazard reporting, map viewing, navigation)

Access control implemented via Supabase Auth + Row Level Security (RLS) policies.

### 2. Map View
- **Library:** Leaflet with OpenStreetMap tiles
- **Features:** Real-time hazard overlays, user location tracking, destination setting
- **Hazard Visualization:** Color-coded by status/severity (impassable=red, partial=orange, clear=green, unconfirmed=yellow)

### 3. Hazard Reporting (Common Users)
- **Input:** Hazard type selection (flooding, debris, roadblock, etc.) + photo evidence (camera/upload)
- **Submission:** Report sent to Supabase with: location, tags, photo URL, user ID, timestamp
- **Display:** Reports appear on map in real-time via Supabase Realtime

### 4. Hazard Reporting Workflow
1. User submits hazard report with photo
2. System shows report immediately on map (realtime via Supabase Realtime)
3. When ≥5 similar reports on same road segment within 100m:
   - Auto-flags as "needs verification" (via Supabase Function or client-side check)
   - Sends notification to users within 500m radius (FCM + local fallback)
4. Verification Prompt:
   - **"Hazard Active"** → extends report lifetime by 30 minutes
   - **"Hazard Cleared"** → reduces report lifetime by 15 minutes
5. Report expires when lifetime reaches 0 and is removed from map

### 5. Hazard-Aware Routing (A* Algorithm)
- **Data Source:** OSM road network data for Tacloban area (fetched via Overpass API or pre-loaded)
- **Dynamic Weighting:** 
  - Multiple unconfirmed reports: +50% traversal cost
  - Agency-verified hazards: +100% cost or blocked (based on severity)
  - Agency advisories: predefined weights (roadwork = blocked, festival = +200% cost)
  - Clear roads: normal cost (distance/time-based)
- **Functionality:** Calculates safest shortest path from user location to destination, avoiding high-risk areas
- **Updates:** Path recalculates in real-time as hazard data changes via Supabase Realtime

### 6. Real-time Updates
- Supabase Realtime subscriptions for:
  - New hazard reports
  - Hazard confirmations/updates
  - Agency advisories
  - User profile updates (for reputation)
- Enables live map updates without manual refresh

### 7. User Profiles & Reputation System (Common Users)
- **Profile:** View/edit basic information (name, email, etc.)
- **Reputation Points:**
  - +5 points for each approved hazard report
  - -2 points for each report marked "Hazard Cleared" by others
  - -10 points if 3+ users mark a report as "Hazard Cleared"
  - Points displayed on profile, no minimum/maximum limits
- **Profile Access:** Available to all authenticated users

### 8. Notifications
- **Proximity Alerts:** Push notifications when user is within 500m of active hazard
- **Verification Prompts:** Notifications to confirm nearby hazards needing verification
- Implemented using Firebase Cloud Messaging (FCM) + local fallback for PWA

### 9. Registration & Authentication
- **Common Users:** Standard email/password signup/login via Supabase Auth (immediate access)
- **Agency Personnel:** Request Access Flow:
  1. Fill out request form (name, agency, role, ID, purpose)
  2. Request stored in `agency_requests` table
  3. Admin notified via Supabase Realtime (email/webhook optional) and reviews requests
  4. Admin approves/rejects request via admin interface
  5. If approved: user's role updated to `agency_personnel` in `user_profiles`
  6. User can now login with agency credentials
- **Admin:** Pre-seeded in system or promoted via direct database access initially

## Technical Architecture

### Frontend (SvelteKit PWA)
- **Framework:** SvelteKit with TypeScript
- **State Management:** Svelte stores
- **Mapping:** Leaflet (via svelte-leafletjs or custom bindings)
- **Offline Support:** Service workers for caching static assets and critical data
- **Supabase Client:** `@supabase/supabase-js` for all auth/db/storage/realtime operations
- **Photo Handling:** Client-side image compression/resize before upload to Supabase Storage

### Backend (Supabase)
- **Authentication:** Supabase Auth (email/password)
- **Database:** PostgreSQL with PostGIS extension
  - Tables: `users`, `user_profiles`, `hazards`, `agency_requests`, `agency_advisories`, etc.
  - PostGIS for geospatial queries and hazard proximity calculations
- **Storage:** Supabase Storage for hazard photos
- **Realtime:** Supabase Realtime API for live updates
- **Security:** Row Level Security (RLS) policies enforcing role-based access

### Routing Service
- **Implementation:** Client-side A* algorithm in TypeScript/JavaScript (potentially in Web Worker for performance)
- **Data Loading:** OSM road data for Tacloban area fetched via Overpass API on first load, cached in IndexedDB for offline use
- **Dynamic Updates:** Graph edge weights adjusted based on realtime hazard data from Supabase Realtime subscriptions
- **Optimization:** Quadtree or spatial indexing for fast hazard lookup during path calculation

## Data Flow Summary

1. **App Launch:** User authenticates via Supabase Auth
2. **Map Initialization:** Leaflet loads OSM tiles, Supabase Realtime subscription to hazards table
3. **Hazard Reporting:** User submits report → Supabase Storage (photo) + Supabase DB (record) → Realtime update to map
4. **Workflow Trigger:** DB triggers/checks for ≥5 similar reports → flags for verification → sends notifications
5. **Verification:** User clicks "Hazard Active"/"Hazard Cleared" → updates hazard lifetime in DB → Realtime update
6. **Routing Calculation:** User sets destination → Routing service loads OSM graph → adjusts weights based on current hazard data → runs A* → returns path
7. **Path Display:** Path rendered on Leaflet map, updates as hazard data changes

## Open Questions & Considerations

1. **OSM Data Source:** Pre-load Tacloban extract vs. fetch via Overpass API on demand (with caching)
2. **Photo Storage:** Storage bucket organization and security rules for hazard photos
3. **Notification Service:** Firebase Cloud Messaging setup vs. alternatives for PWA
4. **Admin Initial Setup:** How first admin users are created (manual DB insert initially)
5. **Performance:** Client-side A* performance with large OSM datasets - may need web workers or simplification for MVP

## Future Phases (Post-MVP)

- Full Admin Dashboard (user management, system settings, audit logs)
- Agency Advisory Creation Workflow (map drawing tools for polylines/polygons)
- Advanced Reputation Features (badges, leaderboards, achievement systems)
- FAQ Section and User Manual Integration
- Enhanced Analytics and Reporting
- Offline-first data synchronization with conflict resolution

---
*This design document captures the approved specifications for migrating RouteGuard to a Svelte PWA with Supabase backend. Implementation will proceed via the writing-plans skill to create detailed task breakdown.*