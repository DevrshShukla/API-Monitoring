# API Monitoring Dashboard — Implementation & Execution Plan

## 1. Project Overview & Invariants
The **API Monitoring Dashboard** is a production-grade, enterprise-ready SaaS monitoring platform for engineering teams to register HTTP APIs, continuously monitor availability and latency via independent background workers, diagnose regressions using statistical analytics, manage incident lifecycles, and receive multi-channel alerts (in-app and email).

### Architectural Invariants & ADR Compliance
1. **Server-Side Execution (ADR-003, ADR-004):** Monitoring checks execute strictly on server background workers using Redis + BullMQ. No browser session is ever required.
2. **Immutable Health Checks (ADR-002):** Health checks are append-only observations; history is never updated in-place.
3. **Strict Multi-Tenant Workspace Isolation (ADR-001, RBAC-001..008):** Every resource query and mutation is strictly scoped by `workspaceId`. Cross-workspace access returns safe 404 responses.
4. **State Machine Separation (ADR-005):** Check result outcome, monitor health status (`Unknown | Operational | Degraded | Down | Paused`), incident lifecycle (`Open | Acknowledged | Investigating | Resolved`), and alert notifications are decoupled concepts.
5. **Robust SSRF Defense-in-Depth (SEC-SSRF-001..009):** Dedicated outbound request service with strict scheme validation (`http`/`https`), DNS pre-resolution and pinning against private/loopback/link-local/multicast/cloud metadata ranges, no uncontrolled DNS rebinding, redirects disabled by default, response payload size capped (default 1MB), and timeout limits (1s–30s).
6. **Encrypted Secrets (ADR-010, SEC):** Custom headers and sensitive request payloads are encrypted at rest using AES-256-GCM. Secret values are write-only and redacted from all read APIs and application logs.
7. **Authoritative REST with Realtime Enhancement (ADR-007):** REST APIs are the source of truth. Socket.IO emits workspace-scoped notifications and status events to invalidate client caches, while clients reliably fall back to REST.
8. **Explainable Deterministic Analytics:** Latency metrics compute exact nearest-rank percentiles (P50, P95, P99), min, max, average, error rate, and HTTP status distribution over customizable UTC windows.

---

## 2. Monorepo Architecture & Directory Structure
```text
api-monitoring-dashboard/
├── package.json                 # Root workspace manifest (npm workspaces)
├── tsconfig.base.json           # Shared base TypeScript configuration
├── docker-compose.yml           # Local & staging services (API, Worker, Scheduler, Mongo, Redis, Web)
├── .env.example                 # Environment configuration template
├── README.md                    # Complete production documentation & quickstart
├── PLANNING.md                  # Implementation roadmap and execution record
├── packages/
│   └── shared/                  # Isomorphic contracts, schemas & constants (ESM)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── constants/       # Status codes, limits, error codes, regex
│           ├── contracts/       # REST API DTOs, socket events, query params
│           ├── schemas/         # Zod schemas for auth, monitors, alerts, incidents
│           └── index.ts
├── apps/
│   ├── api/                     # Express REST API, Sockets & Workers
│   │   ├── Dockerfile           # Multi-stage production container
│   │   ├── Dockerfile.worker    # Dedicated BullMQ worker container
│   │   ├── Dockerfile.scheduler # Dedicated BullMQ scheduler container
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── config/          # Env parsing, logger, database, redis, constants
│   │       ├── db/              # Mongoose connection & models
│   │       │   ├── User.ts
│   │       │   ├── Workspace.ts
│   │       │   ├── WorkspaceMember.ts
│   │       │   ├── Monitor.ts
│   │       │   ├── HealthCheck.ts
│   │       │   ├── AlertRule.ts
│   │       │   ├── Incident.ts
│   │       │   ├── IncidentEvent.ts
│   │       │   ├── Notification.ts
│   │       │   ├── NotificationDelivery.ts
│   │       │   ├── RefreshToken.ts
│   │       │   └── AuditEvent.ts
│   │       ├── middleware/      # Auth, RBAC, error handler, request logger
│   │       ├── services/        # Crypto (AES-256-GCM), SSRF validator, safe HTTP client,
│   │       │                    # status calculator, analytics aggregator, alert engine,
│   │       │                    # notification & email service, audit logger
│   │       ├── queues/          # BullMQ queue instances, scheduler, workers
│   │       │   ├── queue.ts
│   │       │   ├── scheduler.ts
│   │       │   └── monitorWorker.ts
│   │       ├── modules/         # Express controllers & routes
│   │       │   ├── auth/
│   │       │   ├── workspaces/
│   │       │   ├── monitors/
│   │       │   ├── analytics/
│   │       │   ├── incidents/
│   │       │   ├── alerts/
│   │       │   ├── notifications/
│   │       │   └── audit/
│   │       ├── realtime/        # Socket.IO workspace rooms & handlers
│   │       ├── server.ts        # HTTP & Socket.IO server startup
│   │       ├── workerRunner.ts  # Worker standalone process entrypoint
│   │       └── schedulerRunner.ts # Scheduler standalone process entrypoint
│   └── web/                     # React + Vite + TypeScript frontend
│       ├── Dockerfile           # Multi-stage Nginx container
│       ├── nginx.conf           # Reverse proxy routing /api & /socket.io
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── index.html
│       └── src/
│           ├── components/      # UI component library (AppShell, MetricCard,
│           │                    # StatusBadge, ConfirmDialog, EmptyState,
│           │                    # Skeleton, Toast, Charts)
│           ├── context/         # AuthContext, ToastContext, SocketContext
│           ├── lib/             # Axios instance with interceptors, token rotation
│           ├── pages/           # Login, Register, Overview, Monitors, Detail,
│           │                    # Analytics, Incidents, AlertRules, Settings
│           ├── App.tsx          # Root routing & protected auth gates
│           └── main.tsx         # DOM entrypoint
```

---

## 3. Step-by-Step Execution Plan

### Step 1: Foundation & Shared Packages
- [x] Initialize monorepo root `package.json` with npm workspaces (`packages/*`, `apps/*`).
- [x] Set up base TypeScript config (`tsconfig.base.json`) in strict mode.
- [x] Create `packages/shared`:
  - Enums and constants: MonitorStatus (`unknown`, `operational`, `degraded`, `down`, `paused`), CheckOutcome (`success`, `http_error`, `timeout`, `network_error`, `tls_error`, `blocked`), IncidentSeverity (`p1`, `p2`, `p3`, `p4`), IncidentStatus (`investigating`, `identified`, `monitoring`, `resolved`), WorkspaceRole (`owner`, `admin`, `member`, `viewer`).
  - Zod validation schemas for registration, login, monitor create/update, alert rule create/update, incident note/resolution, query pagination and time-ranges.
  - Standard API envelopes: `{ data: T, meta: { requestId: string } }` and `{ error: { code: string, message: string, requestId: string, details?: any[] } }`.
  - Compile to ESM native package.

### Step 2: Backend Core Infrastructure & Security Primitives
- [x] Set up `apps/api` with TypeScript, Express, Helmet, CORS, and Winston structured logger with redaction.
- [x] Configure environment schema validation via Zod (`apps/api/src/config/env.ts`).
- [x] Implement Security Primitives:
  - `cryptoService.ts`: AES-256-GCM authenticated encryption/decryption with key versioning and random initialization vectors for monitor headers/body.
  - `ssrfValidator.ts` & `safeHttpClient.ts`: DNS validation and pinning, filtering IPv4/IPv6 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`, AWS/GCP/Azure link-local metadata `169.254.169.254`), protocol enforcement (`http`, `https`), port restriction, redirect prevention, response size caps (1MB), and custom Agent IP binding to defeat DNS rebinding.

### Step 3: Persistence Layer (Mongoose Schemas & Indexes)
- [x] Define schemas matching `DATABASE_DESIGN.md`:
  - `User`: normalized unique email, password hash (bcrypt), name, timestamps.
  - `Workspace` & `WorkspaceMember`: slug, role, composite index `{ workspaceId: 1, userId: 1 }`.
  - `RefreshToken`: token hash, family ID, expiration with TTL index.
  - `Monitor`: workspaceId, URL, normalizedHost, method, intervalSeconds, timeoutMs, expectedStatusCodes, encrypted headers/body, active, status, lastStatus, counters, nextRunAt.
  - `HealthCheck`: immutable execution record with TTL index for retention.
  - `AlertRule`: condition types, operator, thresholds, channels, cooldownMinutes.
  - `Incident` & `IncidentEvent`: unique partial index for active incidents by fingerprint `{ workspaceId: 1, fingerprint: 1, status: 1 }`, timeline events.
  - `Notification` & `NotificationDelivery`: in-app notifications and email dispatch records.
  - `AuditEvent`: security events with retention TTL.

### Step 4: Authentication, Workspaces & RBAC Middleware
- [x] Implement JWT token issuance (15-minute access token) and rotating refresh token family.
- [x] Implement authentication middleware (`authenticate`), workspace extraction and validation (`requireWorkspace`), and role-based access control (`requireRole(['owner', 'admin', ...])`).
- [x] Build Auth routes: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`.
- [x] Build Workspace management routes: list user workspaces, invite member, switch active workspace.

### Step 5: Monitoring Engine (Scheduler, Queue & Worker)
- [x] Implement Redis & BullMQ queue client with graceful shutdown and fallback.
- [x] Build Monitor Execution Worker:
  - Fetches fresh monitor configuration by ID (preventing stale payload execution).
  - Outbound execution using `safeHttpClient` with latency measurement and response cap.
  - Record immutable `HealthCheck` in MongoDB.
  - Compute new status (`Unknown`, `Operational`, `Degraded`, `Down`, `Paused`) and atomic counter updates.
  - Evaluate Alert Rules against result history and trigger incident evaluation.
  - Compute `nextRunAt` with ±10% jitter and schedule next job.
  - Emit Socket.IO real-time events to the workspace room.
- [x] Build Scheduler:
  - Periodic polling of due monitors (`nextRunAt <= now` and `active = true`).
  - Enqueue deterministic job IDs (`check:<monitorId>:<scheduledMinute>`).

### Step 6: Incident Management & Alerting Engine
- [x] Incident lifecycle management:
  - Deterministic fingerprinting: `workspaceId:monitorId:ruleId:conditionType`.
  - Atomic upsert for open incidents; duplicate suppression during `cooldownMinutes`.
  - Transitions: `investigating` -> `identified` -> `monitoring` -> `resolved`.
  - Timeline generation via `IncidentEvent`.
- [x] In-App and Email Notifications:
  - Persist in-app `Notification` immediately.
  - Queue `NotificationDelivery` for email dispatch.

### Step 7: REST API Controllers
- [x] `/monitors`: CRUD, pause, resume, check history pagination with secret redaction.
- [x] `/analytics`: Overview KPIs, endpoint analytics with bucketed time series (`5m`, `15m`, `1h`, `1d`), nearest-rank percentiles (`P50`, `P95`, `P99`), status distributions, comparison.
- [x] `/incidents`: List, detail with timeline, acknowledge, investigate, resolve (with required resolution notes).
- [x] `/alert-rules`: CRUD for custom rules and thresholds.
- [x] `/notifications`: List user notifications, mark read.
- [x] `/audit`: Audit trail for workspace admin/owner.

### Step 8: Frontend Application (React + Vite + Tailwind CSS)
- [x] Configure Vite, Tailwind CSS, React Router, TanStack Query, Lucide icons, and Recharts.
- [x] Implement Design System tokens (`#4338CA` Indigo primary, `#F8FAFC` background, status tokens).
- [x] Core UI Component Library:
  - `AppShell` with responsive sidebar, topbar, workspace selector, notification popover.
  - `MetricCard` with loading skeletons, formatters, and trend indicators.
  - `StatusBadge` with semantic colors, shapes, and accessibility labels.
  - `EmptyState`, `ErrorState`, `Skeleton`, `ConfirmDialog`, `Toast`.
  - Accessible Data Tables with pagination and keyboard focus.
- [x] Feature Views:
  - **Overview Dashboard:** Health summary cards, status distribution, response-time trend chart, recent incidents, recent failures.
  - **Monitors Management:** Filterable/searchable monitor table, add/edit monitor modal with advanced headers/body disclosure, pause/resume quick actions.
  - **Monitor Detail:** Status banner, latency cards (current, avg, P95), time-series chart, recent immutable check history table.
  - **Analytics:** Time-range picker, percentile cards, latency & uptime charts, status-code breakdown, multi-endpoint comparison.
  - **Incidents:** Active & historical incidents, detail page with interactive timeline, acknowledge/investigate/resolve modal.
  - **Alert Rules:** Rule builder with conditions, operators, thresholds, and channels.
  - **Settings:** Workspace info, team members, audit log.
- [x] Realtime Integration:
  - Socket.IO connection subscribing to workspace room.
  - Cache invalidation via TanStack Query upon receiving `monitor.status.updated`, `monitor.check.completed`, `incident.*`.

### Step 9: Testing Suite & Quality Verification
- [x] Unit tests (Vitest):
  - Status derivation matrix (`Unknown`, `Operational`, `Degraded`, `Down`, `Paused`).
  - Nearest-rank percentile calculations (`P50`, `P95`, `P99`).
  - Alert rule evaluator and deduplication cooldown logic.
- [x] Security tests:
  - SSRF validator against IPv4/IPv6 private ranges, localhost, AWS metadata IP (`169.254.169.254`), decimal IP tricks, redirect blocks.
  - Secret redaction test verifying sensitive headers are never emitted.
  - Cross-tenant workspace isolation test verifying 404 on cross-workspace queries.
- [x] API integration tests (Supertest + in-memory MongoDB):
  - Auth flow: register, login, refresh rotation, logout.
  - Monitor CRUD and check history.
  - Incident transition and timeline.
- [x] Monorepo TypeScript and Vite production builds passing with zero errors.

### Step 10: Docker Compose & Operational Runbook
- [x] `docker-compose.yml` for running API, worker, scheduler, web frontend, MongoDB, and Redis.
- [x] Multi-stage Dockerfiles (`apps/api/Dockerfile`, `Dockerfile.worker`, `Dockerfile.scheduler`, `apps/web/Dockerfile`, `apps/web/nginx.conf`).
- [x] Comprehensive `.env.example` with clear documentation of all configuration variables.
- [x] Scripts in root `package.json` for building, testing, and running all processes.

---

## 4. Current Status & Progress Tracking
- [x] Documentation and specifications thoroughly reviewed.
- [x] Initial implementation planning file created.
- [x] Step 1: Foundation & Shared Packages
- [x] Step 2: Backend Core Infrastructure & Security Primitives
- [x] Step 3: Persistence Layer (Mongoose Schemas & Indexes)
- [x] Step 4: Authentication, Workspaces & RBAC
- [x] Step 5: Monitoring Engine (Scheduler, Worker, SSRF HTTP Client)
- [x] Step 6: Incident Management & Alerting Engine
- [x] Step 7: REST API Controllers & Endpoints
- [x] Step 8: Frontend Application & Component Library
- [x] Step 9: Automated Test Suites (Unit, Security, Integration)
- [x] Step 10: Deployment Setup, Docker Compose & Verification
