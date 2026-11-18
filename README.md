# Enterprise API Monitoring & Observability Platform

A production-grade, distributed API Monitoring & Observability platform engineered for high-availability systems, mission-critical microservices, and multi-tenant engineering teams.

---

## 🌟 Key Architecture & Capabilities

- **Distributed Architecture:** Clean separation of concerns with npm workspaces monorepo:
  - `@api-monitoring/shared`: Strongly-typed contracts, DTOs, Zod schemas, and status state machine constants.
  - `@api-monitoring/api`: High-throughput Express + TypeScript API, Mongoose ORM, BullMQ queue producer, Winston logger with secret redaction, and Socket.IO real-time event pipeline.
  - `@api-monitoring/web`: Responsive, accessible (WCAG AA) React 18 dashboard built with Vite, Tailwind CSS, TanStack Query, Recharts, and Lucide Icons.
- **Enterprise SSRF Protection (SEC-SSRF-001..009):**
  - Canonical domain and IP validation with private IPv4/IPv6 CIDR rejection (RFC 1918, RFC 3927, RFC 4193, loopback, link-local, AWS/GCP/Azure link-local metadata `169.254.169.254`).
  - DNS resolution IP pinning with custom lookup agent preventing Time-of-Check to Time-of-Use (TOCTOU) DNS rebinding attacks while preserving valid TLS SNI.
  - Hard redirect disabling (`maxRedirects: 0`) and strict 1MB response body buffering caps.
  - Port white-listing strictly constrained to HTTP 80 and HTTPS 443.
- **Statistically Rigorous Analytics (ADR-005):**
  - Nearest-rank percentile computation for P50, P90, P95, and P99 response times.
  - Fixed-interval time-series aggregation buckets (`5m`, `15m`, `1h`, `1d`) with min, max, avg, and standard deviation.
  - Full HTTP status code distribution breakdown.
- **Robust Incident & Alert Engine (ADR-003, ADR-004):**
  - Multi-condition evaluation (`consecutive_failures`, `latency_threshold`, `error_rate`).
  - Deterministic incident fingerprinting (`hash(workspaceId, monitorId, conditionType)`).
  - Cooldown deduplication preventing notification storms.
  - Full incident state lifecycle: `investigating` ➔ `identified` ➔ `monitoring` ➔ `resolved` (with mandatory root-cause notes).
  - Detailed chronological incident timeline events.
- **Multi-Tenant RBAC & Security (ADR-006):**
  - Workspace scoping with granular roles (`owner`, `admin`, `member`, `viewer`).
  - Short-lived JWT access tokens (15m) paired with single-use rotating refresh tokens (7d).
  - Cryptographically secure credential encryption at rest using AES-256-GCM.
  - Immutable audit logs capturing administrative and configuration events.

---

## 🏗️ Monorepo Structure

```
├── apps/
│   ├── api/                     # Express REST API, Worker, and Scheduler
│   │   ├── src/
│   │   │   ├── config/          # Environment, Winston logger, DB, Redis
│   │   │   ├── db/models/       # Mongoose Schemas (Monitor, HealthCheck, Incident, etc.)
│   │   │   ├── middleware/      # Auth, RBAC, Zod validation, Error handlers
│   │   │   ├── modules/         # Auth, Workspaces, Monitors, Analytics, Incidents, Alerts
│   │   │   ├── queues/          # BullMQ queue, monitorWorker, and scheduler
│   │   │   ├── realtime/        # Socket.IO gateway and room broadcasters
│   │   │   └── services/        # SSRF validator, Safe HTTP client, Crypto, Analytics
│   │   └── test/                # Vitest integration & unit test suites
│   └── web/                     # React + Vite Dashboard
│       ├── src/
│       │   ├── components/      # AppShell, StatusBadge, MetricCard, ConfirmDialog, Charts
│       │   ├── context/         # AuthContext, ToastContext, SocketContext
│       │   ├── lib/             # Axios API client with automatic token refresh
│       │   └── pages/           # Overview, Monitors, Detail, Analytics, Incidents, Settings
├── packages/
│   └── shared/                  # Contracts, DTOs, Zod schemas, constants
├── docker-compose.yml           # Multi-container local orchestration
└── package.json                 # Monorepo workspaces definition
```

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- MongoDB >= 6.0 (or Docker)
- Redis >= 7.0 (or Docker)

### 1. Installation
Clone the repository and install all workspace dependencies:
```bash
npm install
```

### 2. Environment Configuration
Copy the sample environment file and configure secrets:
```bash
cp .env.example .env
```
Ensure `ENCRYPTION_KEY` is a 64-character hex string (32 bytes) for AES-256-GCM.

### 3. Build All Workspaces
Compile the shared libraries, backend TypeScript, and frontend bundle:
```bash
npm run build
```

### 4. Run Automated Test Suites
Run the backend test suite verifying SSRF defense, status machine transitions, nearest-rank analytics, and RBAC:
```bash
npm run test --workspace=@api-monitoring/api
```

### 5. Running with Docker Compose
To run the full stack (MongoDB, Redis, API, Worker, Scheduler, and Web frontend) in isolated containers:
```bash
docker-compose up --build
```
- Web Dashboard: `http://localhost:3000`
- API Endpoint: `http://localhost:4000/api/v1`
- Health Endpoint: `http://localhost:4000/health/ready`

### 6. Running in Local Development Mode
Start MongoDB and Redis locally, then run the unified dev server:
```bash
# Starts API, background worker, scheduler, and Vite dev server concurrently
npm run dev
```

---

## 🔒 Security Best Practices Implemented

| Security Threat | Mitigation | Implementation |
| :--- | :--- | :--- |
| **SSRF / Cloud Metadata Exfiltration** | Denylist private/loopback/link-local IPv4/IPv6 ranges & AWS/GCP metadata (`169.254.169.254`) | `apps/api/src/services/ssrfValidator.ts` |
| **DNS Rebinding (TOCTOU)** | Pin resolved IP address via custom DNS agent for outbound request socket connection | `apps/api/src/services/safeHttpClient.ts` |
| **Credential & Secret Exposure** | AES-256-GCM authenticated encryption at rest; Winston auto-redaction in logs | `apps/api/src/services/cryptoService.ts` |
| **Session Hijacking** | Short-lived JWT (15m) + Rotating Refresh Tokens with revocation family tracking | `apps/api/src/modules/auth/` |
| **Cross-Tenant Data Leakage** | Explicit `workspaceId` scoping on every database query and BullMQ worker job | Multi-tenant Mongoose filters |

---

## 📊 Evaluation & Verification Results

All automated test suites pass with 100% success rate:
- `ssrfValidator.test.ts`: Rejects private IP ranges, cloud metadata IPs, non-HTTP protocols, and localhost aliases.
- `statusCalculator.test.ts`: Validates status state hierarchy `Paused > Unknown > Down > Degraded > Operational`.
- `analyticsAggregator.test.ts`: Verifies exact nearest-rank percentile calculations and fixed-window bucket aggregations.
- `auth.integration.test.ts`: Tests user registration, login, JWT rotation, and token invalidation.
- `monitors.integration.test.ts`: Verifies CRUD, SSRF validation on creation, and pause/resume lifecycle.
- `incidents.integration.test.ts`: Verifies incident creation, status transition workflow, and mandatory resolution notes.
- `rbac.integration.test.ts`: Confirms member and viewer authorization boundaries.
