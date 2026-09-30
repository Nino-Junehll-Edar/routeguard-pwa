# ROUTEGUARD: A Collaborative Urban Navigation App & Real-Time Route Optimization

<img src="static/lib/styles/routeguard-logo.svg" alt="RouteGuard Logo" width="120" />

A **Progressive Web App (PWA)** that provides hazard-aware urban navigation for
Tacloban City commuters. RouteGuard merges community-reported road hazards
with official local government (LGU) advisories to compute safer,
real-time route recommendations — alerting users **before** they reach a
hazard instead of after.

---

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Project Structure](#project-structure)
6. [Prerequisites](#prerequisites)
7. [Setup & Installation](#setup--installation)
8. [Environment Variables](#environment-variables)
9. [Database Setup](#database-setup)
10. [Running the Application](#running-the-application)
11. [Testing](#testing)
12. [User Roles](#user-roles)
13. [Deployment](#deployment)
14. [Documentation](#documentation)
15. [License](#license)

---

## Overview

Commuters in Tacloban City currently rely on disconnected sources — Waze, Google
Maps, social media posts, radio announcements, and barangay notices — to stay
informed of road hazards. These sources are fragmented, frequently delayed, and
do not model the full set of locally relevant hazards (flooding, debris, partial
road blockages).

**RouteGuard** addresses this gap with a single, unified platform that:

1. Enables commuters to **report road hazards** (with photo evidence) in seconds.
2. **Aggregates and verifies** community reports through a confidence-decay
   workflow and moderation queue.
3. Allows authorized LGU personnel to publish **official road advisories**.
4. Computes **hazard-aware routes** using a client-side A* search algorithm
   that dynamically weights road segments based on real-time hazard data.
5. Sends **push notifications** to users approaching active hazards.

The result is a safer, more timely navigation experience that proactively alerts
users to hazards before they encounter them.

---

## Key Features

| Feature | Description |
|---|---|
| **Interactive Map** | Leaflet-based map with OpenStreetMap tiles, real-time hazard overlays, and user location tracking. |
| **Hazard Reporting** | Tag-based reporting (flooding, debris, roadblock, etc.) with optional photo upload to Supabase Storage. |
| **Confidence Decay** | Reports expire automatically via a lifetime mechanism. Status: `unconfirmed` → `needs_verification` → `hazard_active` → `hazard_cleared` → `expired`. |
| **Verification Workflow** | When ≥5 similar reports appear within 100 m, the report is auto-flagged for verification. Users respond with "Hazard Active" (extends lifetime) or "Hazard Cleared" (reduces lifetime). |
| **Reputation System** | Users earn +5 points per approved report, lose −2 for each "cleared" report, and −10 when 3+ users mark a report cleared. |
| **Agency Advisories** | Authorized LGU personnel can publish official advisories (roadwork, festivals, construction) with point/line/polygon geometry. |
| **Agency Access Requests** | Common users can request agency personnel access; admins approve/reject via a moderation dashboard. |
| **Hazard-Aware Routing** | Client-side A* algorithm with dynamic edge weighting based on hazard severity and status. Supports alternative routes and turn-by-turn instructions. |
| **Real-Time Updates** | Supabase Realtime subscriptions update the map instantly when hazards, confirmations, advisories, or notifications change — no page refresh needed. |
| **Notifications** | Proximity alerts (within 500 m of an active hazard) and verification prompts, delivered via FCM and in-app notification center. |
| **Progressive Web App** | Installable PWA with offline asset caching via service workers and IndexedDB for OSM road data. |

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **SvelteKit** | 2.5.20 | PWA framework with server-side rendering, routing, and adapters |
| **Svelte** | 5.x | Reactive component framework (runes-based reactivity) |
| **TypeScript** | 5.4.5 | Type-safe JavaScript superset |
| **Vite** | 5.2.12 | Build tool, dev server, and HMR |
| **Leaflet** | 1.9.4 | Interactive maps with OSM tile rendering |
| **Svelte Stores** | — | Client-side state management (auth, profile, notifications, UI) |
| **@types/leaflet** | 1.9.8 | TypeScript type definitions for Leaflet |
| **Sass** | 1.77.8 | CSS preprocessor for component styling |

### Backend & Data (Supabase)

| Technology | Version | Purpose |
|---|---|---|
| **Supabase JS** | 2.45.0 | Unified client SDK for auth, database, storage, and realtime |
| **PostgreSQL** | 17 | Primary relational database (managed by Supabase) |
| **PostGIS** | 3.5+ | Geospatial extension for hazard proximity queries and routing |
| **Supabase Storage** | — | `hazard-photos` bucket for uploaded hazard images |
| **Supabase Realtime** | — | WebSocket-based live updates for hazards, advisories, notifications |
| **Row Level Security (RLS)** | — | Role-based access control enforced at the database layer |

### Infrastructure & DevOps

| Technology | Version | Purpose |
|---|---|---|
| **Firebase Cloud Messaging** | 12.x | Push notifications and proximity alerts (PWA) (via Firebase JS SDK 12.19.0) |
| **IndexedDB** | Browser API | Offline caching of OSM road network and queued reports |
| **Service Workers** | SvelteKit bundled (Vite 5.2.12) | Offline asset caching and background operation |
| **Supabase CLI** | 2.x | Local development, migrations, and database management |
| **Git / GitHub** | Latest | Version control and CI/CD source hosting |
| **Vitest** | 1.6.1 | Unit testing framework |
| **Figma** | Latest | UI/UX design and prototyping |

### What Was Deprecated

RouteGuard was originally architected as a multi-platform system: a **Kotlin
/Jetpack Compose** Android app, a **React** web dashboard, an **Express.js**
REST API backed by **Node.js**, a self-hosted **OSRM** routing engine, and a
**Valkey** in-memory cache/pubsub. This has been consolidated into a single
**SvelteKit PWA** that communicates **directly with Supabase** for all backend
services, replacing the Express.js API, Valkey cache, and OSRM server. Routing is
performed client-side via the **A* algorithm**. The Android app and React
dashboard are no longer maintained.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RouteGuard PWA                        │
│                    (SvelteKit 2.5.20)                   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │  Map    │  │ Hazards  │  │ Routing  │  │ Profiles  │ │
│  │(Leaflet │  │(Realtime │  │(A* algo │  │(Reputation │ │
│  │ 1.9.4 + │  │  Subs)   │  │ + Web    │  │  System)   │ │
│  │  OSM)   │  │          │  │  Worker) │  │           │ │
│  └─────────┘  └──────────┘  └──────────┘  └───────────┘ │
│       │            │             │            │         │
│       └──────┬─────┴─────────────┴────────────┴─────────┤
│             │     Supabase JS Client (2.45.0)           │
│             └────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────┘
           │           │         │              │
    ┌──────┴───┐  ┌───┴────┐ ┌──┴─────┐   ┌──────┴─────┐
    │ Supabase │  │ Supabase │ │ Supabase │ │ Supabase   │
    │   Auth   │  │ DB (PG  │ │ Storage  │ │ Realtime  │
    │ 2.45.0   │  │ 17)     │ │          │ │           │
    │          │  │+PostGIS │ │          │ │           │
    │          │  │ 3.5)    │ │          │ │           │
    └──────────┘  └──────────┘ └──────────┘ └────────────┘
           │                                        │
    ┌──────┴───────────┐         ┌──────────────────┴──────┐
    │ Overpass API     │ (OSM)   │ Firebase (FCM 12.x)     │
    │  (Tacloban)      │         │ (Push Notif)             │
    └──────────────────┘         └──────────────────────────┘
```

**Data flow:**

1. User authenticates via **Supabase Auth (2.45.0)** → profile loaded with role/rep.
2. **Leaflet (1.9.4)** loads OSM tiles → **Supabase Realtime (2.45.0)** subscription to `hazards`.
3. User reports a hazard → photo to **Supabase Storage**, record to Supabase DB → live map update.
4. Auto-flagging logic (≥5 similar reports within 100 m) triggers via DB triggers → notification sent.
5. User sets destination → **A* algorithm** loads OSM graph (via **Overpass API**, cached in **IndexedDB**) → dynamically weights edges based on hazard data → returns safest path.

---

## Project Structure

```
routeguard-pwa/
├── package.json              # Project metadata, dependencies, scripts
├── svelte.config.js          # SvelteKit configuration
├── vite.config.js            # Vite build/dev server configuration
├── tsconfig.json             # TypeScript compiler configuration
├── vitest.config.js          # Unit testing configuration
├── .env.example              # Environment variable template
├── supabase/
│   ├── config.toml           # Supabase local project configuration
│   ├── schema.sql            # Complete database schema (dev reference)
│   └── migrations/           # Database migration files
│       ├── 001_init_schema.sql
│       ├── 002_add_reputation_to_verify_hazard.sql
│       ├── 004_update_verify_hazard_reputation.sql
│       ├── 005_add_spatial_indexes.sql
│       ├── 006_secure_notifications_and_spatial_api.sql
│       └── 007_hazard_photos_bucket.sql
├── src/
│   ├── app.html              # Root HTML template (loads CSS statically)
│   ├── routes/               # SvelteKit routes (pages)
│   │   ├── +layout.svelte    # Root layout with auth-aware navigation
│   │   ├── +page.svelte      # Landing page
│   │   ├── login/            # Authentication pages
│   │   ├── register/
│   │   ├── map/              # Main map view (hazards, advisories, popups)
│   │   ├── route/            # Route planning with A* navigation
│   │   ├── report-hazard/    # Hazard reporting form with photo upload
│   │   ├── profile/          # User profile & reputation display
│   │   ├── agency/           # Agency personnel dashboard
│   │   ├── agency-request/   # Request agency access
│   │   ├── notifications/    # In-app notification center
│   │   └── admin/            # Admin dashboard (agency approvals, moderation)
│   ├── lib/                  # Shared libraries and utilities
│   │   ├── supabaseClient.ts # Supabase client initialization
│   │   ├── authStore.ts      # Auth state management & session handling
│   │   ├── mapUtils.ts       # Leaflet map, hazards, advisories, routes
│   │   ├── notificationUtils.ts # Proximity alerts, FCM, in-app notifications
│   │   ├── storageUtils.ts   # Photo upload & cleanup utilities
│   │   ├── indexedDB.js      # Offline caching for OSM data & queued reports
│   │   ├── firebase.js       # FCM initialization & token management
│   │   ├── service-worker.js # PWA offline support & asset caching
│   │   ├── routing/          # A* routing implementation
│   │   │   ├── astar.ts      # Core A* with hazard-aware weighting
│   │   │   ├── osmLoader.ts  # OSM Overpass API loader w/ IndexedDB cache
│   │   │   └── routingWorker.ts # Web Worker for off-main-thread routing
│   │   ├── stores/           # Svelte stores (profile, notifications, toast)
│   │   ├── components/       # Reusable Svelte components
│   │   │   ├── Icon.svelte
│   │   │   ├── VoteButton.svelte
│   │   │   ├── HazardComments.svelte
│   │   │   └── primitives/   # Button.svelte, Field.svelte
│   │   ├── types/            # TypeScript interfaces
│   │   └── backgroundSync.js # Offline queue processing
│   └── static/
│       └── lib/styles/
│           ├── tokens.css    # Design tokens (colors, shadows, typography)
│           ├── base.css      # Base styles & CSS reset
│           └── map.css       # Map-specific UI styles (Z.AI design system)
├── tests/
│   ├── e2e/
│   │   └── userFlows.test.js   # End-to-end test outlines
│   └── local/                  # Local unit/integration tests
├── docs/                       # Project documentation
└── research_papers/            # Capstone manuscript (Chapters I–V)

---

## Prerequisites

- **Node.js** >= 18.x (or v22 LTS recommended)
- **npm** (bundled with Node.js)
- **Supabase account** — [https://supabase.com](https://supabase.com)
- **Supabase CLI** (optional, for local development):
  ```bash
  npm install -g supabase
  ```
- **Firebase project** (for push notifications — optional, needed only for FCM)

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/routeguard-pwa.git
cd routeguard-pwa
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env` and fill in your Supabase and Firebase credentials:

```bash
cp .env.example .env
```

### 4. Set up the Supabase database

```bash
# Link to your Supabase project
supabase login
supabase link --project-ref <your-project-ref>

# Push migrations to your Supabase project
supabase db push
```

Alternatively, apply the schema manually via the Supabase SQL Editor using
`supabase/schema.sql` as a reference.

---

## Environment Variables

Create a `.env` file in the project root (see `.env.example`):

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key |
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FIREBASE_VAPID_KEY` | Firebase VAPID key for FCM |
| `VITE_USE_ROUTING_WORKER` | Enable Web Worker for A* routing (`true`/`false`) |

---

## Database Setup

RouteGuard uses **PostgreSQL 17** with the **PostGIS** extension. Key tables:

| Table | Purpose |
|---|---|
| `user_profiles` | User info, role (admin/agency/common), reputation points |
| `hazards` | Hazard reports with GEOGRAPHY location, photo URL, status, lifetime |
| `agency_requests` | Access requests from common users to become agency personnel |
| `agency_advisories` | Official LGA advisories with geometry (point/line/polygon) |
| `hazard_confirmations` | "Hazard Active" / "Hazard Cleared" confirmations |
| `hazard_comments` | User comments on hazard reports |
| `hazard_votes` | Upvotes/downvotes on reports |
| `notifications` | In-app notification center items |

All tables use **Row Level Security (RLS)** policies for role-based access control.
Database triggers handle automatic profile creation, hazard verification flagging
(≥5 similar reports within 100 m), and report expiration via confidence decay.

Apply migrations in order: `001` → `002` → `004` → `005` → `006` → `007`.

---

## Running the Application

### Development

```bash
npm run dev
```

Starts the Vite dev server (typically at `http://localhost:5173`).

### Production Build

```bash
npm run build
```

Outputs to `.svelte-kit/output/`.

### Preview Production Build

```bash
npm run preview
```

---

## Testing

```bash
# Run all unit tests (Vitest)
npm test
# Run once and exit (no watch mode)
npm test -- --run
```

Test suites cover spatial API contracts, agency RPC behavior, auth & profile
state transitions, hazard report payloads and cleanup, and advisory
permissions/filters.

---

## User Roles

| Role | Capabilities |
|---|---|
| **Common User** | View map, report hazards with photos, confirm/clear reports, view/reply to comments, vote on hazards, view profile & reputation, request agency access |
| **Agency Personnel** | All common user features + publish/edit/remove official advisories, view verification prompts |
| **Admin** | All agency personnel features + approve/reject agency access requests, manage moderation queue |

Access control is enforced at two levels: UI-level route guards and database-level
RLS policies + `SECURITY DEFINER` RPCs.

---

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full deployment guide.

```bash
# 1. Build the production bundle
npm run build

# 2. Deploy to your preferred adapter (Vercel, Netlify, or static hosting)
#    SvelteKit adapter-auto detects the target environment.
```

For Supabase:
```bash
supabase link --project-ref <project-ref>
supabase db push
```

---

## Documentation

| Document | Description |
|---|---|
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Full deployment guide with adapter and Supabase setup |
| [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) | Step-by-step Supabase project and CLI setup |
| [`docs/FIREBASE_SUPABASE_SETUP_TUTORIAL.md`](docs/FIREBASE_SUPABASE_SETUP_TUTORIAL.md) | Firebase + Supabase integration tutorial |
| [`docs/PROGRESS_SUMMARY.md`](docs/PROGRESS_SUMMARY.md) | Current implementation status and next steps |
| [`docs/PROJECT_CHECKLIST.md`](docs/PROJECT_CHECKLIST.md) | Detailed feature-by-feature checklist |
| [`docs/ENGINEERING_AUDIT_2026-09-29.md`](docs/ENGINEERING_AUDIT_2026-09-29.md) | Recent engineering audit and fixes |
| [`docs/ROUTEGUARD_LGU_QUESTIONNAIRE.md`](docs/ROUTEGUARD_LGU_QUESTIONNAIRE.md) | LGU stakeholder consultation & ISO/IEC 25010 UAT evaluation questionnaire |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | Implementation plans and specs |
| [`docs/superpowers/specs/`](docs/superpowers/specs/) | Design specifications |
| [`research_papers/ROUTEGUARD_CHAPTER-1-3_PRE_ORAL_FIXED_FINAL_v5.md`](research_papers/ROUTEGUARD_CHAPTER-1-3_PRE_ORAL_FIXED_FINAL_v5.md) | Capstone manuscript (Chapters I–III) |
| [`research_papers/ROUTEGUARD_CHAPTER-3_OPERATIONAL-FRAMEWORK.md`](research_papers/ROUTEGUARD_CHAPTER-3_OPERATIONAL-FRAMEWORK.md) | Updated Chapter III — Operational Framework (SvelteKit + Supabase) |

---

## License

This project is a capstone requirement for the **Bachelor of Science in Information Technology** program at **Eastern Visayas State University**, Tacloban City.

---

## Authors

- **Ethan Gabriel C. Calzita**
- **Niño Junehll B. Edar**
- **Kate Andrea C. Hechanova**

Adviser: **Lyra K. Nuvas, PhD**

August 2026
```
