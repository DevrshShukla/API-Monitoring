# Deployment Guide

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


## 1. Environments
- Local: Docker Compose for MongoDB and Redis; Vite and API run locally.
- Staging: production-like services, test SMTP credentials, synthetic test monitors only.
- Production: managed MongoDB/Redis, TLS, secrets manager, separate worker processes, backups, monitoring.

## 2. Required services
1. Web frontend (static hosting such as Vercel).
2. API service (Node container).
3. Scheduler process (single active leader).
4. Monitor worker process (scalable replicas).
5. Notification worker process.
6. MongoDB Atlas or managed MongoDB.
7. Managed Redis compatible with BullMQ.
8. SMTP provider.

## 3. Deployment sequence
1. Provision MongoDB and Redis with network restrictions and credentials.
2. Configure secrets through host secret manager; never commit `.env`.
3. Deploy API and run database index/migration task.
4. Deploy scheduler and workers; verify queue health and scheduler leader lock.
5. Deploy frontend with API base URL and allowed origin.
6. Configure SMTP sender/domain and test delivery.
7. Run smoke tests: login, create monitor, receive check, view analytics, trigger test incident, receive notification.
8. Enable real external monitoring gradually; start with low concurrency.
9. Confirm SSRF controls and egress firewall before allowing user-defined targets.

## 4. Example local commands
```bash
npm install
cp .env.example .env
docker compose up -d mongodb redis
npm run dev
npm run worker:dev
npm run scheduler:dev
npm run test
npm run build
```
Actual scripts must match repository `package.json`; do not invent them without implementing them.

## 5. Health checks
- API liveness: process is running.
- API readiness: Mongo and Redis reachable; report dependency status.
- Worker heartbeat: last successful poll and queue activity.
- Scheduler heartbeat: last scheduler tick and leader lock.
- Notification worker: queue age and delivery success/failure.
Do not expose internal connection strings or stack traces from public health endpoints.

## 6. Backups and recovery
- Enable automated MongoDB backups and test restore quarterly.
- Redis persistence is optional depending on managed service; BullMQ queues require durable configuration appropriate to provider.
- Document RPO/RTO after selecting hosting tier; do not claim values before validating provider capabilities.
- Keep deployment rollback artifact and previous environment configuration.
- On failed release: disable new scheduler enqueue if needed, roll back API/worker image, preserve queued jobs, verify schema compatibility.

## 7. Production checklist
- [ ] TLS and secure headers enabled.
- [ ] CORS allowlist exact.
- [ ] JWT and encryption secrets generated securely.
- [ ] MongoDB and Redis network access restricted.
- [ ] SSRF egress controls tested.
- [ ] Worker concurrency and queue-age alerts configured.
- [ ] SMTP verified.
- [ ] Backups and restore tested.
- [ ] Error tracking and structured logs configured.
- [ ] Rate limits and request-size limits enabled.
- [ ] Retention policy scheduled and tested.
