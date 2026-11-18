# Technical Requirements Document (TRD)

## Document control
- Product: API Monitoring Dashboard
- Version: 1.0 (MVP baseline)
- Status: Implementation-ready baseline; decisions requiring deployment-specific values are marked as configuration.
- Audience: Product, frontend, backend, QA, DevOps, security, and AI coding agents.
- Normative language: **MUST** is mandatory; **SHOULD** is recommended; **MAY** is optional.

## Product invariants
1. Monitoring executes on the server through workers; a browser session is never required.
2. A health check is an immutable observation. Corrections are represented by new records, not edits to history.
3. Every resource query is scoped to the authenticated user's workspace.
4. A check result, endpoint status, incident transition, and notification are separate concepts.
5. All times are stored in UTC and rendered in the user's selected timezone (default browser timezone).
6. Secrets are never returned in API responses or written to ordinary application logs.
7. A monitor must not be allowed to use the service as an unrestricted network proxy. SSRF controls are mandatory before any outbound request.
8. MVP prioritizes deterministic, explainable rules over machine-learning-based anomaly detection.

## Assumptions and decisions register
| ID | Decision | Rationale / implementation |
|---|---|---|
| ADR-001 | Multi-tenant workspace model | Every user belongs to one or more workspaces; all domain records carry `workspaceId`. |
| ADR-002 | MongoDB is the system of record | Mongoose schemas; indexes and retention jobs support query patterns. |
| ADR-003 | Redis + BullMQ for scheduling and execution | Durable queues, retries, concurrency limits, and independent workers. |
| ADR-004 | One scheduled job per active monitor | Scheduler enqueues due monitor IDs; worker re-reads current config before execution. |
| ADR-005 | Endpoint status uses recent-check policy | Configurable consecutive failures and latency threshold; exact defaults below. |
| ADR-006 | JWT access token + refresh-token rotation | Short-lived access token; hashed refresh token persisted and revocable. |
| ADR-007 | Socket.IO is an enhancement, REST remains authoritative | UI must recover by refetching REST data after reconnect. |
| ADR-008 | Email is MVP external notification channel | In-app notifications are always persisted; email depends on verified SMTP configuration. |
| ADR-009 | Retention defaults are configurable | MVP defaults: raw checks 30 days; incidents and audit events 1 year. |
| ADR-010 | No arbitrary scripting or user-supplied code in monitors | Avoids execution risk and keeps request semantics auditable. |

## MVP scope and exclusions
**MVP includes:** account/workspace access, endpoint CRUD, safe HTTP checks, configurable intervals/timeouts, history, dashboard, analytics, threshold-based anomaly detection, alert rules, incidents, in-app notifications, email notifications, audit trail, tests, and deployable environments.

**Not in MVP:** public status pages, on-call schedules, SMS/push, Slack/Discord, SSO/SAML, billing, multi-region probes, synthetic browser journeys, user-defined scripts, ML forecasting, and customer-managed agents. These must not block MVP delivery.

## Global configuration baseline
| Setting | Default | Validation |
|---|---:|---|
| `MONITOR_INTERVAL_SECONDS` | 60 | 30–3600; workspace plan limits may apply |
| `MONITOR_TIMEOUT_MS` | 10000 | 1000–30000 |
| `MAX_RESPONSE_BYTES` | 1048576 | hard cap; do not buffer unlimited bodies |
| `MAX_REDIRECTS` | 0 | redirects disabled by default |
| `FAILURES_TO_DOWN` | 3 | 1–10 consecutive failures |
| `LATENCY_DEGRADED_MS` | 2000 | configurable per monitor |
| `ANALYTICS_DEFAULT_RANGE_DAYS` | 7 | allowed range 1–90 |
| `CHECK_RETENTION_DAYS` | 30 | configurable operational limit |
| `INCIDENT_RETENTION_DAYS` | 365 | subject to legal/customer policy |
| `NOTIFICATION_COOLDOWN_MINUTES` | 15 | per alert rule and incident fingerprint |

## Cross-document traceability
- Requirements use `FR-*` and `NFR-*` identifiers.
- API operations use `API-*`; data entities use `DATA-*`; UI components use `UI-*`.
- Acceptance criteria use `AC-*` and refer back to requirements.
- Security controls use `SEC-*`; test cases use `TC-*`.
- A requirement is not considered complete until its acceptance criteria and test evidence are linked.


## 1. Architecture and stack
- Frontend: React + Vite + TypeScript, React Router, Tailwind CSS, TanStack Query, Axios, React Hook Form, Zod, Recharts, Lucide React.
- Backend: Node.js LTS + Express + TypeScript, REST JSON APIs, Zod validation, Mongoose.
- Data: MongoDB replica set (transactions where needed), Redis for BullMQ.
- Jobs: BullMQ scheduler/producer and independent worker process.
- Realtime: Socket.IO for workspace-scoped status/incident events.
- Email: Nodemailer via SMTP provider.
- Tests: Vitest, React Testing Library, Supertest, Playwright.
- Deployment: frontend on Vercel; API and worker on a container host; MongoDB Atlas; managed Redis.

## 2. Repository structure
```text
api-monitoring-dashboard/
  apps/
    web/src/{app,components,features,hooks,lib,pages,routes,styles,types}
    api/src/{config,middleware,modules,queues,services,workers,utils}
  packages/shared/src/{contracts,constants,schemas}
  docs/                         # generated documentation
  infra/
  tests/e2e/
  .env.example
  package.json
```
Use a monorepo only if shared schemas are genuinely shared; otherwise a two-app repository is acceptable. Keep validation contracts in a shared package when using a monorepo.

## 3. Runtime processes
1. **Web client:** renders UI and calls REST endpoints; no monitoring execution.
2. **API process:** authentication, authorization, CRUD, analytics queries, incident workflows, queue scheduling.
3. **Scheduler:** periodically queries active monitors due for execution and enqueues `monitor.check` jobs.
4. **Worker:** validates current monitor state, performs safe outbound HTTP request, persists result, updates status, evaluates alert rules, emits events.
5. **Notification worker:** sends email and records delivery state; retries transient provider failures.

## 4. Monitor execution contract
Input: `monitorId`, `scheduledAt`, `jobId`, optional `traceId`. Worker re-fetches monitor by ID and checks `active=true`. It must not trust stale URL/config copied into a queued payload. The worker:
- acquires a per-monitor lock / uses deterministic job identity to avoid overlap;
- validates URL and resolved destination immediately before request;
- sends request with configured method, safe headers, optional body, timeout, and response cap;
- records a bounded result;
- updates monitor `lastCheckedAt`, `lastStatus`, and consecutive counters atomically;
- evaluates alert rules and incident state;
- schedules next run from persisted `nextRunAt`.
Use jitter (±10%) to spread synchronized workloads. Retries should not duplicate a check record; transient queue failures can retry the job, but the outbound request itself is not blindly retried for non-idempotent methods.

## 5. API and validation
- All request bodies are Zod-validated.
- Unknown properties are rejected or stripped consistently.
- IDs must be valid Mongo ObjectIds.
- Pagination uses cursor or bounded page/limit; default 20, maximum 100.
- Date ranges are ISO 8601 UTC; maximum analytics range 90 days for raw checks.
- API errors use a stable envelope: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "requestId": "...", "details": [] } }`.
- Responses never include encrypted values or raw authorization headers.

## 6. Frontend implementation
- Feature folders: `monitors`, `analytics`, `incidents`, `alerts`, `auth`, `settings`.
- TanStack Query owns server state; local component state only for transient UI.
- Axios interceptor attaches access token and handles one refresh attempt; on refresh failure clear session and route to sign-in.
- Forms use React Hook Form + Zod; display inline field errors and server errors.
- Charts require loading, empty, and error states; avoid misleading zero values when data is unavailable.
- Realtime events invalidate/refetch relevant queries; REST remains source of truth.

## 7. Security and reliability requirements
- SSRF defense must be implemented in a dedicated outbound-request service, not scattered across routes.
- DNS resolution must be pinned/validated against private/reserved ranges and rechecked against rebinding; block IPv4 and IPv6 loopback, private, link-local, multicast, unspecified, reserved, and cloud metadata ranges.
- Redirects disabled by default; if ever enabled, validate every hop and limit hops.
- Restrict schemes to HTTPS and HTTP; disallow credentials in URL; enforce allowed ports (80/443 by default).
- Use network-level egress firewall as defense in depth.
- Rate-limit authentication and monitor mutation endpoints.
- Encrypt monitor secrets using a managed key or environment-provided key; rotate keys with key version metadata.
- Set secure cookies for refresh tokens where browser architecture permits; protect against CSRF if cookie-based.
- Apply request body size limits, helmet, CORS allowlist, and structured redacted logging.

## 8. Performance and capacity baseline
MVP planning assumption: 100 workspaces, 2,000 active monitors, 1-minute minimum interval, 10-second timeout. This is a planning envelope, not a guaranteed capacity claim. Load test queue throughput and Mongo write volume before production. Apply workspace concurrency limits and global worker concurrency.

## 9. Observability
Required metrics: queue waiting/active/failed counts, oldest job age, check execution duration, check outcome, worker concurrency, API latency, DB pool saturation, notification delivery failure, scheduler lag. Logs must be structured JSON with correlation IDs. Never log request body or secret headers by default.

## 10. Environment variables
| Variable | Purpose |
|---|---|
| `NODE_ENV` | runtime environment |
| `PORT` | API listen port |
| `MONGODB_URI` | MongoDB connection |
| `REDIS_URL` | Redis connection |
| `JWT_ACCESS_SECRET` | access token signing secret |
| `JWT_REFRESH_SECRET` | refresh token signing secret |
| `ENCRYPTION_KEY` | monitor-secret encryption key |
| `APP_ORIGIN` | frontend origin |
| `CORS_ORIGINS` | comma-separated allowlist |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | email provider |
| `LOG_LEVEL` | structured log threshold |
| `CHECK_RETENTION_DAYS` | check retention |
| `MAX_RESPONSE_BYTES` | response cap |
| `ALLOWED_MONITOR_PORTS` | outbound port allowlist |
