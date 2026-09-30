```
Chapter III
OPERATIONAL FRAMEWORK
Materials
This section identifies the software, hardware, and estimated development cost
required to build, deploy, and test RouteGuard.
Software
Table 3-1
Software Requirements for RouteGuard
Software/Tool
Recommended Version
Purpose/Usage
Node.js
v22 (LTS)
Backend runtime environment for the API server
Express.js
v4.x
REST API framework
PostgreSQL
v16 or later
Primary relational database
PostGIS
v3.4 or later (PostgreSQL extension)
Geospatial indexing and radius-based hazard queries
Valkey
v8.x
In-memory cache, report-confidence expiration, and pub/sub notifications
OSRM (Open Source Routing Machine)
Latest stable, MLD algorithm
Self-hosted route computation engine
OpenStreetMap Data
Current extract, Tacloban City, Leyte
Road network data source for OSRM
Android Studio
Ladybug (2024.2) or later
Android application development IDE
Kotlin
v2.x
Android application programming language
Jetpack Compose
Latest stable (BOM-managed)
Android UI toolkit
React
v18.x
Web-based administrative dashboard frontend
Git and GitHub
Latest
Version control and source code hosting
Postman
Latest
API endpoint testing
Figma
Latest
UI/UX prototyping
```

```
Hardware
Table 3-2
Minimum and Recommended Hardware Specifications
Item
Minimum Specification
Recommended Specification
Development Laptop/PC
Intel Core i5 processor, 8 GB RAM, 256 GB SSD
Intel Core i7 processor, 16 GB RAM, 512 GB SSD
```

```
Android Test Device
Android 10, 3 GB RAM, GPS-enabled
Android 13 or later, 6 GB RAM, GPS-enabled
Backend Server (VPS)
2 vCPUs, 4 GB RAM, 50 GB SSD storage
4 vCPUs, 8 GB RAM, 100 GB SSD storage
Internet Connection
10 Mbps broadband
50 Mbps or higher broadband
```

# `Project Development Cost` 

```
This section itemizes the one-time development-phase costs (capital
expenditures, or CAPEX) incurred in building and preparing RouteGuard for pilot
deployment. Ongoing operational expenditures (OPEX) — such as recurring cloud
hosting, post-launch maintenance, or marketing — are excluded from this table,
consistent with the distinction between development cost and operating cost. As
discussed under Materials, RouteGuard’s backend, database, cache, and routing
engine are hosted on a free-tier cloud instance during development and pilot
evaluation, so no recurring hosting expenditure is capitalized here; this choice
is revisited under the cost-benefit discussion below.
Table 3-3
Estimated Project Development Budget
```

```
Item
```

```
Description/Purpose
Estimated Cost
Google Play Developer Account (one-time)
Required to publish the Android application on the Google Play Store; a
fixed, one-time registration fee set by Google.
₱1,400.00
Domain / Hostname for Testing
A free subdomain (e.g., via DuckDNS or a similar free dynamic-DNS
provider) points to the free-tier instance and is used to reach the
administrative dashboard and API endpoint during development and pilot testing.
A paid, registered domain is deferred to a future production launch, which is
outside this capstone’s scope.
```

```
₱0.00
```

```
Backend, database, and mobile development tools(Node.js, Express.js,
PostgreSQL, PostGIS, Valkey, OSRM, OpenStreetMap data, Kotlin, Jetpack Compose,
React, Git/GitHub, Postman, Figma)
```

```
Free and open-source under their respective licenses (MIT, Apache-2.0,
ODbL); not an academic waiver of a normally paid product.
₱0.00
```

```
Total Cost
```

```
₱1,400.00
```

# `Cost Justification and Estimation Methodology` 

```
The Google Play Developer Account fee (₱1,400.00) is a fixed, one-time
registration cost set by Google and is required regardless of application
complexity; its value is taken directly from Google’s published rate at the time
of writing. The domain/hostname item is valued at ₱0.00 because, for the
development and pilot-testing phase this study covers, a free subdomain from a
dynamic-DNS provider is sufficient to reach the administrative dashboard and API
endpoint; a paid, registered domain is not required until a future production
launch beyond this capstone’s scope. The backend, database, and mobile
development tools listed — Node.js, Express.js, PostgreSQL, PostGIS, Valkey,
OSRM, OpenStreetMap data, Kotlin, Jetpack Compose, React, Git/GitHub, Postman,
and Figma — are likewise valued at ₱0.00 because they are permanently free and
open-source under their respective licenses (e.g., MIT, Apache-2.0, and the Open
Data Commons Open Database License for OpenStreetMap data). This is distinct
from an academic waiver of a tool that is normally sold commercially; no such
```

```
waived-license tool was used in this project, so no nominal capitalized value is
assigned to that line. This table does not include a capitalized cost for
developer labor: because the proponents are the system’s own developers
completing this project as a degree requirement rather than an externally paid
development team, no imputed labor cost is assigned here, and the table instead
reflects only the actual, out-of-pocket resources acquired or utilized during
development.
```

```
Capitalization as an Organizational Asset
```

```
Upon completion, the RouteGuard codebase — comprising the backend API, the
PostgreSQL/PostGIS database schema, the Android application, and the
administrative dashboard — is capitalized as an Intangible Asset, since it
constitutes custom-developed software and database design rather than physical
equipment. This project has no Tangible Asset (Property, Plant, and Equipment)
component: no dedicated physical hardware was acquired, as development relies on
the proponents’ own existing computers and Android devices, and the backend is
deployed on a free-tier cloud instance rather than purchased server hardware. It
is worth noting that the capitalized figure in Table 3-3 (₱1,400.00) reflects
only third-party, out-of-pocket costs and does not monetize the proponents’ own
development effort; the system’s functional and technical value as a working
asset therefore exceeds its capitalized cost, a common characteristic of
student-developed software where labor is contributed rather than purchased. The
capitalized amount is assumed to amortize on a straight-line basis over a three-
year useful life, consistent with the typical amortization period for custom
application software, with residual value assumed to be zero given the pace of
technological change in mobile platforms and mapping data standards.
Cost-Benefit Analysis and Future Projections
```

```
The total development cost of ₱1,400.00 compares favorably against the recurring
cost of the present, manual system described earlier in this chapter, under
which Tacloban City commuters and LGU personnel rely on disconnected social
media posts, radio announcements, and barangay-level notices to disseminate
hazard information. That present approach carries an ongoing, largely uncounted
cost in LGU staff time spent manually cross-posting advisories across multiple
channels, and in commuter time and safety risk lost to delayed or missed hazard
information. RouteGuard’s minimal one-time development cost, by contrast,
capitalizes a reusable system rather than an ongoing manual process, and because
both hosting and the domain/hostname are free-tier during this evaluation phase,
the marginal operating cost beyond the initial ₱1,400.00 capitalization is
effectively zero. Should the Tacloban City LGU formally adopt RouteGuard beyond
the pilot phase, the primary future cost would be a modest, predictable
recurring hosting and domain expenditure (see Materials) rather than a repeat of
the one-time development investment, giving the system a clear pathway toward a
positive return on investment as adoption grows.
```

# `Data` 

# `Systems Environment` 

# `Population of the Study` 

```
The population of this study consists of two respondent groups relevant to the
evaluation of RouteGuard: (a) commuters residing in or regularly traveling
through Tacloban City, Leyte, who represent the application’s primary end users,
and (b) personnel from the Tacloban City local government unit (LGU) or its
designated traffic and disaster-response office, who represent the intended
users of the administrative dashboard and moderation module. Given the
impracticality of surveying the entire commuting population of the city, this
study uses purposive sampling, selecting respondents who regularly travel routes
prone to flooding, road obstruction, or heavy traffic and who therefore have
direct, relevant experience with the problem RouteGuard addresses. A target of
at least 30 commuter respondents and 5 LGU or moderator-role respondents is set
for user acceptance testing and system evaluation, consistent with sample sizes
commonly used in pilot usability evaluations of comparable scope.
Description of the Present System
```

```
At present, commuters in Tacloban City rely on a combination of general-purpose
navigation applications, such as Waze and Google Maps, and informal,
disconnected channels to stay informed of road hazards and advisories. General-
purpose navigation applications provide routing and, in Waze’s case, community-
reported incidents, but these reports are not tailored to the hazard categories
```

```
most relevant to a flood-prone Philippine city, such as flooding, debris, or
partial road blockage, and depend on a global user base whose local reporting
density in Tacloban City is inconsistent. Official hazard and road-advisory
information, when available, is typically disseminated separately through LGU
social media pages, local radio announcements, or barangay-level notices, none
of which are integrated into any navigation platform a commuter might already be
using while traveling. As a result, a commuter must actively monitor multiple,
unconnected sources, often only after already encountering a hazard, rather than
being proactively alerted to it while en route.
Limitations/Drawbacks of the Present System
```

```
This fragmented approach has several drawbacks that directly motivate this
study, consistent with the gaps identified in Chapter I. First, information
reaches commuters with significant delay, since official advisories are posted
independently of a commuter’s live location and general navigation applications
are not tuned to local reporting patterns. Second, existing systems apply a
narrow definition of a reportable obstacle, typically limited to accidents or
standing traffic, and do not treat flooding, debris, or partial road blockage as
first-class, taggable hazard categories. Third, community-submitted reports on
general-purpose platforms are not independently verified through any moderation
process, leaving commuters with no reliable way to judge how much confidence to
place in a given report. Finally, because official advisories and crowd-sourced
reports reside on separate platforms, a commuter has no single, authoritative
source that combines both — a gap RouteGuard is designed to close.
Methods
```

# `System Development Life Cycle` 

```
This study adopts the Agile Scrum framework as its development methodology.
RouteGuard’s core subsystems — obstacle detection and alerting, route
optimization, tag-based reporting, the reputation and report-confidence
mechanism, and the moderation module — are interdependent but individually
testable, and several of their design details, such as the decay behavior of the
report-confidence score, are expected to be refined once early prototypes are
tested against real usage patterns. Scrum’s iterative sprint structure allows
each subsystem to be developed, demonstrated, and adjusted incrementally, rather
than committing to a fixed technical design before any part of the system has
been validated, which better suits a project whose specific objectives (SO1–SO5)
map naturally onto discrete, independently deliverable increments.
The development team assumes the roles typical of a small Scrum team: the
proponents serve as the Development Team, the project adviser serves as the
Product Owner responsible for validating each increment against the study’s
specific objectives, and one proponent rotates as Scrum Master to facilitate
sprint ceremonies. Each sprint follows a two-week cycle consisting of sprint
planning, daily stand-ups, a sprint review with the adviser, and a sprint
retrospective. The product backlog is derived directly from the functional and
non-functional requirements defined in Chapter I. Figure 3-1 illustrates the
target system architecture toward which this development process builds.
```

# `Figure 3-1. RouteGuard System Architecture Procedures for the Different Phases` 

```
Development proceeds across seven sprints, each corresponding to a discrete
increment of the system. Figure 3-2 shows the context-level data flow supporting
these procedures, tracing how the two external actors — the Commuter/Reporting
User and the System Moderator — interact with the system throughout these
phases.
```

```
Figure 3-2. Context-Level (Level 0) Data Flow Diagram of RouteGuard
* Sprint 0 – Project Setup and Environment Preparation. Establish the
development environment, initialize the backend and mobile repositories,
configure the PostgreSQL schema, provision the self-hosted OSRM engine with an
OpenStreetMap extract of Tacloban City, Leyte, and set up the Valkey instance.
* Sprint 1 – Core Map and Obstacle Detection (SO1). Develop the mobile map
interface, implement geofencing logic to detect obstacles within a 5-kilometer
radius of the user, and implement the push notification system that alerts users
```

```
at least 500 meters before reaching a reported obstacle.
```

```
* Sprint 2 – Route Optimization (SO2). Integrate the mobile client and backend
with the self-hosted OSRM engine using the Multi-Level Dijkstra (MLD) algorithm,
and implement automatic rerouting targeting a 3-second response time from
obstacle confirmation.
```

```
* Sprint 3 – Reporting, Reputation, and Report Confidence (SO3). Build the tag-
based obstacle-reporting interface with a sub-10-second submission target,
implement the user reputation-scoring system, and implement the report-
confidence decay mechanism, including per-category base decay rates and
confirmation/denial weighting.
```

```
* Sprint 4 – Administrative Dashboard and Advisories (SO4). Develop the web-
based administrative dashboard that allows authorized municipal personnel to
post, edit, and remove official road advisories, ensuring newly posted
advisories propagate to the mobile hazard map within 5 seconds.
```

```
* Sprint 5 – Moderation Module (SO5). Implement the moderation queue within the
administrative dashboard, enabling authorized moderators to review flagged and
conflicting obstacle reports and resolve each as confirmed, false, or
inconclusive.
```

```
* Sprint 6 – System Integration, Testing, and Refinement. Conduct integration
testing across all subsystems, execute user acceptance testing with the
respondents described under Population of the Study, and refine the system based
on evaluation results prior to final defense.
Evaluation
```

```
RouteGuard is evaluated using the ISO/IEC 25010 software product quality model.
Given the scope of this study, evaluation focuses on five characteristics most
directly tied to the specific objectives defined in Chapter I: Functional
Suitability (whether obstacle detection, routing, reporting, and moderation
perform their intended functions completely and correctly), Performance
Efficiency (whether the 3-second reroute and 5-second advisory-propagation
targets are met under typical network conditions), Reliability (whether the
system maintains correct report-confidence and reputation state over sustained
use), Usability (whether the tag-based reporting interface can be completed in
under 10 seconds by an average user), and Security (whether user accounts,
reputation data, and moderation actions are protected against unauthorized
access or manipulation).
```

```
A structured questionnaire, adapted from the ISO/IEC 25010 characteristics
above, is administered to the respondents identified under Population of the
Study following user acceptance testing. Each item is rated on a five-point
Likert scale (5 – Strongly Agree, 4 – Agree, 3 – Neutral, 2 – Disagree, 1 –
Strongly Disagree).
```

```
Responses are summarized using the weighted mean, computed for each ISO/IEC
25010 characteristic as WM = Σ(fw) / N, where f is the number of respondents
selecting a given scale point, w is the numerical weight of that scale point (1
through 5), and N is the total number of respondents. The resulting weighted
mean for each characteristic, and for the instrument overall, is interpreted
using the following scale: 4.20–5.00 as Excellent, 3.40–4.19 as Very
Satisfactory, 2.60–3.39 as Satisfactory, 1.80–2.59 as Fair, and 1.00–1.79 as
Poor.
```

