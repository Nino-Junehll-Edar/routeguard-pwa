
**ROUTEGUARD: A COLLABORATIVE URBAN NAVIGATION APP**  
**& REAL-TIME ROUTE OPTIMIZATION**

A Capstone Project

Presented to the

Faculty of the Department of Information Technology  
School of Engineering  
Eastern Visayas State University  
Tacloban City

In Partial Fulfillment

of the Requirements for the Degree

Bachelor of Science in Information Technology

By

Ethan Gabriel C. Calzita  
Niño Junehll B. Edar  
Kate Andrea C. Hechanova

August 2026

---

# **CHAPTER III**  
# **OPERATIONAL FRAMEWORK**

## **Materials**

This section identifies the software, hardware, and estimated development cost required to build, deploy, and test RouteGuard.

### **Software**

**Table 3-1**  
*Software Requirements for RouteGuard*

| **Software/Tool** | **Recommended Version** | **Purpose/Usage** |
|---|---|---|
| SvelteKit | 2.5.20 | Progressive Web App framework with SSR, routing, and PWA adapter support |
| TypeScript | 5.4.5 | Type-safe programming language for the entire frontend and shared logic |
| Svelte | 5.x | Reactive component framework for the UI (runes-based reactivity) |
| Vite | 5.2.12 | Build tool, development server, and hot-module replacement |
| Leaflet | 1.9.4 | Interactive mapping library with OpenStreetMap tile rendering |
| Supabase JS Client (@supabase/supabase-js) | 2.45.0 | Backend-as-a-Service client: authentication, PostgreSQL/PostGIS database, Storage, and Realtime subscriptions |
| PostgreSQL | 17 | Primary relational database (managed by Supabase) |
| PostGIS | 3.5+ | Geospatial extension for hazard proximity queries and spatial indexing |
| Firebase Cloud Messaging (FCM) | 12.x | Push notifications and proximity alerts for the PWA (via Firebase JS SDK 12.19.0) |
| IndexedDB | Browser-native API | Client-side storage for offline OSM road data and queued reports |
| Service Workers | SvelteKit-bundled (Vite 5.2.12) | Offline asset caching and background synchronization |
| Git and GitHub | Latest | Version control and source code hosting |
| Supabase CLI | 2.x | Local development, migration management, and database schema deployment |
| Vitest | 1.6.1 | Unit and integration testing framework |
| Sass | 1.77.8 | CSS preprocessor for component styling |
| Figma | Latest | UI/UX prototyping and design system development |

### **Hardware**

**Table 3-2**  
*Minimum and Recommended Hardware Specifications*

| **Item** | **Minimum Specification** | **Recommended Specification** |
|---|---|---|
| Development Laptop/PC | Intel Core i5 processor, 8 GB RAM, 256 GB SSD | Intel Core i7 processor, 16 GB RAM, 512 GB SSD or higher |
| Target Deployment Device | Smartphone or tablet with a modern browser (Chrome 120+, Safari 17+, Edge 120+) and GPS support | Smartphone with latest browser version and GPS support |
| Internet Connection | 10 Mbps broadband | 50 Mbps or higher broadband |

*** Items are stated for the development machine used by the proponents. The target deployment device is a standard smartphone or tablet with a modern web browser, as RouteGuard is delivered as a Progressive Web Application that runs natively in the browser without app-store installation. No dedicated backend server hardware is required because backend services are provided by Supabase's managed cloud infrastructure.***

---

## **Project Development Cost**

This section itemizes the one-time development-phase costs (capital expenditures, or CAPEX) incurred in building and preparing RouteGuard for pilot deployment. Ongoing operational expenditures (OPEX) — such as recurring cloud hosting, post-launch maintenance, or marketing — are excluded from this table, consistent with the distinction between development cost and operating cost. As discussed under Materials, RouteGuard's backend, database, storage, and routing are hosted on a free-tier cloud instance during development and pilot evaluation, so no recurring hosting expenditure is capitalized here; this choice is revisited under the cost-benefit discussion below.

**Table 3-3**  
*Estimated Project Development Budget*

| **Item** | **Description/Purpose** | **Estimated Cost** |
|---|---|---:|
| **Domain / Hostname for Testing** | A free subdomain or the Supabase-provisioned project URL is used to access the PWA during development and pilot testing. A paid, registered domain is deferred to a future production launch outside this capstone's scope. | **₱0.00** |
| **Progressive Web App Distribution** | RouteGuard is distributed as a web application accessed through a standard browser URL. No app-store developer account, APK signing, or platform-specific publishing infrastructure is required for the PWA, eliminating the Google Play Developer registration fee that a native Android app would incur. | **₱0.00** |
| **Backend-as-a-Service (Supabase)** | Supabase's free tier provides PostgreSQL, Auth, Storage, and Realtime without charge during development and pilot evaluation. Paid tiers are deferred to a future production launch beyond this capstone's scope. | **₱0.00** |
| **Development and Deployment Tools**<br>(SvelteKit, TypeScript, Vite, Leaflet, Git/GitHub, Vitest, Supabase CLI, Figma) | All tools are available under free or open-source licenses (MIT, Apache-2.0, BSD, and the Open Database License for OpenStreetMap data). No paid commercial licenses were required. | **₱0.00** |
| **Firebase Cloud Messaging** | FCM's Spark (free) plan provides sufficient notification capacity for pilot testing. | **₱0.00** |
| | **Total Cost** | **₱0.00** |

### Cost Justification and Estimation Methodology

Each item listed in Table 3-3 represents a cost that the research team evaluated during development. The domain/hostname item is valued at ₱0.00 because, for the development and pilot-testing phase, a free subdomain from a dynamic-DNS provider such as DuckDNS, or the project URL provisioned by Supabase itself, is sufficient to reach the application — a paid, registered domain is deferred to a future production launch outside this capstone's scope. The progressive-web-app distribution item is likewise valued at ₱0.00 because RouteGuard is delivered as a web application accessible through any modern browser; unlike a native Android app, no Google Play Store developer registration (which carries a one-time ₱1,400.00 fee) is required, and no APK signing or platform-specific publishing infrastructure is needed. The backend-as-a-service item reflects Supabase's free Hobby tier, which provides PostgreSQL, Auth, Storage, and Realtime sufficient for pilot-scale usage; all production-tier paid plans are deferred to a future rollout. The development and deployment tools — SvelteKit, TypeScript, Vite, Leaflet, Git/GitHub, Vitest, the Supabase CLI, and Figma — are all available under free or open-source licenses (MIT, Apache-2.0, BSD, and the Open Database Commons Open Database License for OpenStreetMap data), so no licensing fees were incurred. Firebase Cloud Messaging is used under its free Spark plan. No paid commercial software licenses were required during development. Developer labor is not capitalized because the proponents are the system's own developers completing this project as a degree requirement rather than an externally paid team; only actual, out-of-pocket third-party costs are reflected in the table.

### Capitalization as an Organizational Asset

Upon completion, the RouteGuard codebase — comprising the SvelteKit PWA frontend (TypeScript, Svelte components, A* routing engine, and service-worker logic), the Supabase-managed PostgreSQL/PostGIS database schema with RLS policies and SECURITY DEFINER trigger functions, the Leaflet-based interactive map components, and the FCM-integrated notification service — is capitalized as an Intangible Asset, as it constitutes custom-developed software and database design rather than physical equipment. RouteGuard has no Tangible Asset (Property, Plant, and Equipment) component: no dedicated physical hardware was acquired, because development relies on the proponents' own existing computers and the Supabase cloud infrastructure rather than purchased server hardware. It is worth noting that the capitalized figure in Table 3-3 (₱0.00) reflects only third-party out-of-pocket costs — all of which were free-tier or open-source resources — and does not monetize the proponents' own development effort; the system's functional and technical value as a working asset therefore substantially exceeds its capitalized cost, a common characteristic of student-developed software where both tooling and labor are contributed rather than purchased. The capitalized amount is assumed to amortize on a straight-line basis over a three-year useful life, as an assumption used for this project's projection, with residual value assumed to be zero given the pace of technological change in web standards and mapping data.

### Cost-Benefit Analysis and Future Projections

The total development cost of ₱0.00 compares favorably against the recurring cost of the present, manual system described under Data, under which Tacloban City commuters and LGU personnel rely on disconnected social media posts, radio announcements, and barangay-level notices to disseminate hazard information. That present approach carries an ongoing, largely uncounted cost in LGU staff time spent manually cross-posting advisories across multiple channels, and in commuter time and safety risk lost to delayed or missed hazard information. RouteGuard's minimal one-time development cost, by contrast, capitalizes a reusable system rather than an ongoing manual process, and because both hosting and the domain/hostname are free-tier during this evaluation phase, the marginal operating cost beyond the initial zero-cost capitalization is effectively zero. Should the Tacloban City LGU formally adopt RouteGuard beyond the pilot phase, the primary future cost would be a modest, predictable recurring expenditure for Supabase and FCM paid-tier services rather than a repeat of the one-time development investment, giving the system a clear pathway toward a positive return on investment as adoption grows. The automated nature of the system — real-time hazard detection, proactive notifications, and hazard-aware routing — reduces manual LGU dissemination effort, minimizes commuter exposure to road hazards, and speeds up route recalibration in response to changing conditions, generating quantifiable safety and efficiency benefits that the zero-cost CAPEX baseline already satisfies.

## **Data**

### **Systems Environment**

RouteGuard operates within a cloud-native, web-based systems environment. The frontend is a Progressive Web Application built with SvelteKit 2.5.20 that runs entirely in the user's web browser (Chrome, Safari, Edge, or Firefox) on any device with a modern browser and GPS support. All backend services are provided by **Supabase**, a managed Backend-as-a-Service that hosts **PostgreSQL 17** with the **PostGIS 3.5** extension, handles **authentication** via Supabase Auth (supabase-js 2.45.0), stores hazard photos in **Supabase Storage** (in a dedicated `hazard-photos` bucket), and delivers **real-time updates** through Supabase Realtime WebSocket subscriptions. The application communicates with Supabase exclusively through the `@supabase/supabase-js` 2.45.0 client library using the project's publishable (anon) key, with all authorization enforced server-side through PostgreSQL Row Level Security (RLS) policies and `SECURITY DEFINER` stored procedures. Road network data is sourced from the **OpenStreetMap** project via the **Overpass API**, with the Tacloban City extract (bounding box: 124.95°E–125.05°E, 11.20°N–11.30°N) fetched on first load and cached locally in the browser's **IndexedDB** for offline access. **Firebase Cloud Messaging** (via the Firebase JS SDK 12.19.0) provides push notification delivery for proximity alerts and verification prompts. The routing engine is a **client-side A* search algorithm** implemented in TypeScript 5.4.5, with an optional Web Worker (`routingWorker.ts`) for off-main-thread computation. A **service worker** (bundled by SvelteKit 2.5.20 via Vite 5.2.12) provides offline asset caching. The Supabase project is named `routeguard-pwa` with database major version 17 (per `supabase/config.toml`), and no self-hosted infrastructure — no Node.js/Express API server, no Valkey cache, no OSRM routing engine, and no VPS — is maintained by the development team.

### **Locale**

This study is conducted in **Tacloban City, Leyte, Philippines**, a coastal city of approximately 243,000 residents whose road network is highly vulnerable to seasonal flooding, typhoon-related debris, and construction-related obstructions. The OpenStreetMap bounding box used for road network data is centered on the city at coordinates 124.95°E–125.05°E, 11.20°N–11.30°N, capturing the primary commuter arteries and hazard-prone corridors.

### **Organizational Chart / Profile**

The intended organizational adopter of RouteGuard is the **Tacloban City Local Government Unit (LGU)**, specifically the **Tacloban City Information Office** and the **Office of the City Administrator**, in coordination with the Traffic Management Group and the Office of the City Disaster Risk Reduction and Management Officer (CDRRMO). The LGU is responsible for maintaining road safety, issuing official road advisories, and coordinating with commuters during hazard events. RouteGuard serves as the technological bridge between the LGU's advisory capacity and the commuting public's navigation needs. The system's role hierarchy directly mirrors this organizational structure: **Admin** (system-level management, typically the development team or IT coordinator), **Agency Personnel** (authorized LGU staff who publish official advisories), and **Common User** (commuters and the general public who report hazards and use hazard-aware routing). For environment-specific hazards such as tree falls or scheduled tree removal near roads, the project also coordinates with the City Engineering Office (CEO), the Tacloban Economic Enterprise Office (TOMECO), and the Department of Environment and Natural Resources (DENR).

### **Population of the Study**

The population of this study consists of three respondent groups relevant to the evaluation of RouteGuard: **(a) Common Users (Commuters)** residing in or regularly traveling through Tacloban City, Leyte, who represent the application's primary end users; **(b) Agency Personnel** from the Tacloban City local government unit (LGU) — primarily the Tacloban City Information Office and the Traffic Management Group, who represent the intended users of the administrative dashboard, advisory publishing, and moderation module; and **(c) System Administrators**, who evaluate the technical reliability and security of the platform.

Given the impracticality of surveying the entire commuting population of the city, this study uses **purposive sampling**. Common-user respondents are selected based on the following inclusion criteria: (1) regular commuter in Tacloban City (at least three days per week), (2) age 18 to 65, (3) ownership of a smartphone with a modern web browser and GPS support (Android or iOS), and (4) self-reported familiarity with mobile map or navigation applications. The sample is stratified by device platform (approximately 60 % Android, 40 % iOS) and by commuting frequency (daily commuters, occasional commuters, and frequent inter-zone travelers) to capture cross-platform PWA behavior and varied usage patterns. Agency-personnel respondents are selected from the Tacloban City Information Office, the Traffic Management Group, and barangay-level offices, with at least two representatives from each unit to ensure coverage of both advisory publishing and moderation workflows. For environment-specific hazards (tree falls, scheduled tree removal near roads, landslides), the project also coordinates with the City Engineering Office (CEO), the Tacloban Economic Enterprise Office (TOMECO), the Office of the City Disaster Risk Reduction and Management Officer (CDRRMO), and the Department of Environment and Natural Resources (DENR) as needed. System-administrator respondents are selected from the development team and the LGU IT coordinator.

**Table 3-4**  
*Respondent Classification and Sample Sizes for User Acceptance Testing*

| **Respondent Group** | **Sample Size** | **Selection Criteria** |
|---|---|---|
| Common User / Commuter | 30–35 | Regular Tacloban commuter (≥3 days/week), age 18–65, smartphone with browser + GPS |
| Agency Personnel | 6 | Tacloban LGU staff: 2 Traffic Management, 2 City Information Office, 1–2 barangay officials |
| System Administrator | 3 | IT system coordinator + 2 developers |
| **Total** | **39–44** | |

A pre-test screening questionnaire is administered to all respondents to verify eligibility. Each respondent completes a structured evaluation session lasting approximately 20–30 minutes, during which they perform representative tasks (hazard reporting, route planning, advisory viewing for commuters; advisory creation, moderation review for agency personnel; and role-based access verification for administrators) while observed by the research team. Sessions are conducted on the respondent's own device whenever possible to reflect real-world usage conditions.

### **Description of the Present System**

At present, commuters in Tacloban City rely on a combination of general-purpose navigation applications, such as Waze and Google Maps, and informal, disconnected channels to stay informed of road hazards and advisories. General-purpose navigation applications provide routing and, in Waze's case, community-reported incidents, but these reports are not tailored to the hazard categories most relevant to a flood-prone Philippine city, such as flooding, debris, or partial road blockage, and depend on a global user base whose local reporting density in Tacloban City is inconsistent. Official hazard and road-advisory information, when available, is typically disseminated separately through LGU social media pages, local radio announcements, or barangay-level notices, none of which are integrated into any navigation platform a commuter might already be using while traveling. As a result, a commuter must actively monitor multiple, unconnected sources, often only after already encountering a hazard, rather than being proactively alerted to it while en route.

### **Limitations/Drawbacks of the Present System**

This fragmented approach has several drawbacks that directly motivate this study, consistent with the gaps identified in Chapter I. First, information reaches commuters with significant delay, since official advisories are posted independently of a commuter's live location and general navigation applications are not tuned to local reporting patterns. Second, existing systems apply a narrow definition of a reportable obstacle, typically limited to accidents or standing traffic, and do not treat flooding, debris, or partial road blockage as first-class, taggable hazard categories. Third, community-submitted reports on general-purpose platforms are not independently verified through any moderation process, leaving commuters with no reliable way to judge how much confidence to place in a given report. Finally, because official advisories and crowd-sourced reports reside on separate platforms, a commuter has no single, unified information source that combines both — a gap RouteGuard is designed to close.

## **Methods**

### **System Development Life Cycle**

# `SDLC Model`

This study adopts the Agile Scrum framework as its development methodology. RouteGuard's core subsystems — real-time hazard mapping, route optimization, tag-based reporting, the reputation and report-confidence mechanism, agency advisories, and the moderation module — are interdependent but individually testable. Scrum's iterative sprint structure allows each subsystem to be developed, demonstrated, and adjusted incrementally rather than committing to a fixed technical design before any part of the system has been validated. This approach is well-suited to a project whose specific objectives (SO1–SO5) map naturally onto discrete, independently deliverable increments.

The development team assumes the roles typical of a small Scrum team: the proponents serve as the Development Team, the project adviser serves as the Product Owner responsible for validating each increment against the study's specific objectives, and one proponent rotates as Scrum Master to facilitate sprint ceremonies. Each sprint follows a two-week cycle consisting of sprint planning, daily stand-ups, a sprint review with the adviser, and a sprint retrospective. The product backlog is derived directly from the functional and non-functional requirements defined in Chapter I. Figure 3-1 illustrates the target system architecture toward which this development process builds.

Figure 3-1. RouteGuard System Architecture

```mermaid
graph TB
    subgraph "Client Layer — RouteGuard PWA"
        CU["Common User<br/>SvelteKit 2.5.20 +<br/>Leaflet 1.9.4<br/>Android/iOS browser"]
        AP["Agency Personnel<br/>Admin Dashboard<br/>SvelteKit 2.5.20"]
        AD["System Administrator<br/>Admin Panel<br/>SvelteKit 2.5.20"]
    end

    subgraph "Service Layer — Supabase Cloud"
        SA["Supabase Auth<br/>(supabase-js 2.45.0)"]
        RT["Supabase Realtime<br/>(WebSocket pub/sub)"]
        ST["Supabase Storage<br/>(photo evidence)"]
        EF["Supabase Supabase Edge Functions (Deno 2)]
    end

    subgraph "Persistence Layer"
        DB["PostgreSQL 17<br/>+ PostGIS 3.5"]
    end

    subgraph "External Services"
        OSM["OpenStreetMap<br/>(tiles + road data)"]
        FCM["FCM 12.x<br/>Push Notifications"]
    end

    CU --- SA
    AP --- SA
    AD --- SA

    SA --> DB
    RT --> DB
    ST --> DB
    EF --> DB

    SA <--> RT
    SA <--> ST
    RT <--> EF
    ST <--> EF

    CU --- OSM
    AP --- OSM
    AD --- OSM

    CU <--> FCM
    AP <--> FCM

    style DB fill:#2d2d2d,stroke:#4a90d9,color:#fff
    style RT fill:#3a3a3a,stroke:#4a90d9,color:#fff
    style SA fill:#3a3a3a,stroke:#4a90d9,color:#fff
    style ST fill:#3a3a3a,stroke:#4a90d9,color:#fff
    style EF fill:#3a3a3a,stroke:#4a90d9,color:#fff
    style OSM fill:#3a3a3a,stroke:#50a14f,color:#fff
    style FCM fill:#3a3a3a,stroke:#ffc107,color:#000
```

*The PWA is served statically (or via SSR adapter) by Vite 5.2.12. All authenticated users connect through Supabase Auth 2.45.0, which enforces Row-Level Security (RLS) policies on PostgreSQL 17. Real-time updates are broadcast via Supabase Realtime WebSocket subscriptions, and photo evidence is stored in Supabase Storage buckets. OSM road-network tiles are served by OpenStreetMap.*

### **Procedures for the Different Phases**

Development proceeds across seven two-week sprints, each corresponding to a discrete increment of the system. Figure 3-2 shows the context-level data flow supporting these procedures, tracing how the three primary user roles — the Common User / Commuter, the Agency Personnel, and the Admin / System Moderator — interact with the system throughout these phases.

Figure 3-2. Context-Level (Level 0) Data Flow Diagram of RouteGuard

```mermaid
flowchart LR
    subgraph USERS["User Layer"]
        U1["Common User<br/>Report Hazard"]
        U2["Common User<br/>Find Route"]
        AP["Agency Personnel<br/>Publish Advisory"]
        AV["Agency Personnel<br/>Verify Report"]
    end

    subgraph PWA["RouteGuard PWA"]
        MP["Map Page<br/>(Leaflet 1.9.4)"]
        RP["Route Page<br/>(A* Algorithm)"]
        HD["Agency Dashboard"]
    end

    subgraph SB["Supabase Cloud Services"]
        SA["Auth 2.45.0"]
        DB[(PostgreSQL 17<br/>+ PostGIS 3.5)]
        RT["Realtime<br/>(WebSocket)"]
        ST["Storage<br/>(Photos)"]
        EF["Supabase Edge Functions (Deno 2)]
    end

    subgraph EXT["External"]
        OSM["OpenStreetMap<br/>(OSM road data)"]
        FCM["FCM 12.x<br/>(Push)"]
        ODR[(IndexedDB<br/>OSM cache)]
    end

    U1 -->|"1. Submit<br/>photo + location"| MP
    MP -->|"2. INSERT"| SA
    SA -->|"3. RLS-validated INSERT"| DB
    DB -->|"4. NOTIFY / Realtime"| RT
    RT -->|"5. Broadcast"| DB
    RT -->|"6. SUBSCRIBE"| MP
    MP -->|"7. Re-render"| U1

    U2 -->|"8. Route request"| RP
    RP -->|"Reads OSM cache"| ODR
    RP -->|"Reads hazards"| DB
    RP -->|"9. A* + hazard<br/>avoidance"| RP
    RP -->|"10. Return route"| U2

    AP -->|"11. Publish advisory"| HD
    HD -->|"12. INSERT advisory"| SA
    SA -->|"13. INSERT"| DB
    DB -->|"14. NOTIFY / Realtime"| RT
    RT -->|"15. Broadcast"| MP
    MP -->|"16. Re-render"| U1
    U2 -->|"17. Advisory alert"| FCM

    AV -->|"18. Verify report"| HD
    HD -->|"19. UPDATE status"| SA
    SA -->|"20. UPDATE"| DB
    DB -->|"21. NOTIFY / Realtime"| RT
    RT -->|"22. Broadcast"| MP
    MP -->|"23. Update map"| U1

    EF -->|"Fetch OSM data"| OSM
    EF -->|"Cache"| ODR
    MP -->|"1. Subscribe"| FCM
    FCM -->|"2. Push notification"| U1
    FCM -->|"3. Push advisory"| U2

    style DB fill:#2d2d2d,stroke:#4a90d9,color:#fff
    style RT fill:#3a3a3a,stroke:#4a90d9,color:#fff
    style SA fill:#3a3a3a,stroke:#4a90d9,color:#fff
    style ST fill:#3a3a3a,stroke:#4a90d9,color:#fff
    style EF fill:#3a3a3a,stroke:#4a90d9,color:#fff
    style OSM fill:#3a3a3a,stroke:#50a14f,color:#fff
    style FCM fill:#3a3a3a,stroke:#ffc107,color:#000
    style ODR fill:#2d2d2d,stroke:#4a90d9,color:#fff

    classDef userLayer fill:#e1f5fe,stroke:#0277bd
    classDef pwaLayer fill:#fce4ec,stroke:#c2185b
    classDef svcLayer fill:#fff3e0,stroke:#ef6c00
    classDef extLayer fill:#f3e5f5,stroke:#7b1fa2

    class U1,U2,AP,AV userLayer
    class MP,RP,HD pwaLayer
    class SA,DB,RT,ST,EF svcLayer
    class OSM,FCM,ODR extLayer
```

*The data flow illustrates two key cycles: (a) the hazard reporting cycle (steps 1–7), where a common user submits a report that flows through Supabase Auth → PostgreSQL 17 → Realtime WebSocket → back to the map for re-rendering; and (b) the route planning cycle (steps 8–10), where the client-side A* algorithm consults cached OSM road data (IndexedDB) and the live hazard layer from the database to compute an optimal, hazard-aware route. Official advisories and verification actions follow similar cycles (steps 11–23) through the agency dashboard. Push notifications are delivered via FCM 12.x.*

* **Sprint 0 – Project Setup and Environment Preparation.** Establish the SvelteKit PWA development environment, initialize the Vite dev server with TypeScript support, configure the Supabase client (`supabaseClient.ts`) with authentication, set up the PostgreSQL v17 / PostGIS database schema via migrations, configure environment variables, and initialize Firebase Cloud Messaging for push notifications.

* **Sprint 1 – Core Map and Hazard Proximity Identification (SO1).** Develop the interactive map interface using Leaflet with OpenStreetMap tiles and real-time hazard overlays via Supabase Realtime subscriptions, implement geofencing logic to identify reported hazards within a 5-kilometer radius of the user, and implement the push notification system that alerts users at least 500 meters before reaching an eligible confirmed, route-relevant hazard.

* **Sprint 2 – Route Optimization (SO2).** Implement the client-side A* search algorithm in TypeScript with optional Web Worker offloading, integrate OSM road network data for the Tacloban City area fetched via the Overpass API (cached in IndexedDB for offline use), apply dynamic edge weighting based on real-time hazard severity and report confidence scores, and implement automatic rerouting with a target response time of under 5 seconds from hazard confirmation.

* **Sprint 3 – Reporting, Reputation, and Report Confidence (SO3).** Build the tag-based hazard-reporting interface with photo upload to Supabase Storage and a sub-10-second submission target, implement the user reputation-scoring system (+5 per approved report, −2 per "Hazard Cleared" confirmation, −10 when 3+ users mark a report cleared), and implement the report-confidence decay mechanism using the `lifetime_minutes` field with confirmation/denial weighting tied to individual user reputation scores.

* **Sprint 4 – Agency Access Requests, Administrative Dashboard, and Advisories (SO4).** Develop the web-based agency request flow (common user → request → admin approval → agency_personnel role) and the administrative dashboard that allows authorized LGU personnel to post, edit, and remove official road advisories, ensuring newly posted advisories propagate to the map view within 5 seconds via Supabase Realtime.

* **Sprint 5 – Moderation Module (SO5).** Implement the moderation queue within the administrative dashboard, enabling authorized moderators to review flagged and conflicting hazard reports (auto-flagged when ≥5 similar reports appear within 100 m via database trigger) and resolve each as confirmed, false, or inconclusive, with appropriate reputation adjustments for involved reporters.

* **Sprint 6 – System Integration, Testing, and Refinement.** Conduct integration testing across all subsystems, execute user acceptance testing with the respondents described under Population of the Study, and refine the system based on evaluation results prior to final defense.

### **Evaluation and Testing**

RouteGuard is evaluated using the **ISO/IEC 25010:2011 Software Product Quality Requirements and Evaluation (SQuaRE)** model, applied separately to the commuter-facing and administrative-facing components of the system. The full ISO/IEC 25010 characteristic set — Functional Suitability, Performance Efficiency, Compatibility, Usability, Reliability, Security, Maintainability, and Portability — is considered, with evaluation focus weighted toward the five characteristics most directly tied to the study's specific objectives (SO1–SO5) defined in Chapter I. The remaining three (Maintainability, Portability, Compatibility) are assessed through technical inspection and cross-platform testing.

**Table 3-5**  
*ISO/IEC 25010 Evaluation Framework — Characteristics, Metrics, and Success Criteria*

| **ISO/IEC 25010 Characteristic** | **Sub-characteristic** | **Specific Metric** | **Success Criterion** |
|---|---|---|---|
| **Functional Suitability** | Functional completeness | All system features accessible to appropriate roles | 100% feature checklist pass |
| | Functional correctness | Hazard report visible on map within 2 seconds of submission | WM ≥ 4.20 (Excellent) |
| | Functional appropriateness | Hazards color-coded and displayed correctly | ≥ 95% accuracy |
| **Performance Efficiency** | Time behavior | Route calculation < 5s; hazard report submission < 10s; initial map load < 3s | ≥ 90% of trials meet target |
| | Resource utilization | Routing memory < 50 MB | Within threshold |
| | Capacity | Handles ≥ 10 simultaneous Realtime subscriptions | No degradation |
| **Compatibility** | Co-existence | Works on Chrome 120+, Safari 17+, Edge 120+ (Android & iOS) | Zero critical rendering errors |
| **Usability** | Understandability | First-time user task completion in < 2 minutes | ≥ 80 % success rate |
| | Learnability | Average user completes hazard report on first attempt in < 10s | WM ≥ 3.40 (Satisfactory) |
| **Reliability** | Fault tolerance | Recovers from network loss within 10 seconds | Zero unhandled errors |
| | Maturity | Zero crashes during 30-minute sustained use session | No crash events logged |
| **Security** | Confidentiality | RLS policies block unauthorized data access | All penetration tests pass |
| | Integrity | `reporter_id` bound to `auth.uid()`; non-owner cannot modify/delete | Zero spoofing incidents |
| **Maintainability** | Modularity | Codebase organized in reusable Svelte components and TS modules | Code review rating ≥ 4.0 |
| **Portability** | Adaptability | Deployable to ≥ 2 hosting adapters (static + SSR) | Successful deployment to both |

A two-stage evaluation approach is used: **(1) technical testing** — automated Vitest suites, performance timing, and security penetration checks; and **(2) user-acceptance evaluation** — a structured ISO/IEC 25010-adapted questionnaire administered to the respondents identified under Population of the Study. The questionnaire contains 32 items distributed across the five primary characteristics (Functional Suitability: 6 items, Performance Efficiency: 6 items, Usability: 10 items, Reliability: 5 items, Security: 5 items), with separate sections for commuter-facing and administrative-facing items to reflect the dual-component nature of the system. Each item is rated on a five-point Likert scale (5 – Strongly Agree, 4 – Agree, 3 – Neutral, 2 – Disagree, 1 – Strongly Disagree).

Responses are summarized using the weighted mean, computed for each ISO/IEC 25010 characteristic as *WM = Σ(fw) / N*, where *f* is the number of respondents selecting a given scale point, *w* is the numerical weight of that scale point (1 through 5), and *N* is the total number of respondents. The resulting weighted mean for each characteristic, and for the instrument overall, is interpreted using the following scale: 4.20–5.00 as Excellent, 3.40–4.19 as Very Satisfactory, 2.60–3.39 as Satisfactory, 1.80–2.59 as Fair, and 1.00–1.79 as Poor.

Quantitative performance metrics (route calculation time, hazard report submission time, map load time, memory usage) are recorded through browser performance APIs during user testing sessions and summarized as means, medians, and standard deviations. Qualitative findings — including security incident counts, crash logs, code review scores, and deployment success — are reported as binary outcomes (pass/fail) or categorical ratings. Both sets of results are synthesized in Chapter IV (Results and Discussion).
