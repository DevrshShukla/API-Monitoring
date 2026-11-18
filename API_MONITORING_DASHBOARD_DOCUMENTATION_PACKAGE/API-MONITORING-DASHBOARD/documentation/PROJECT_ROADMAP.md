# Project Roadmap

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


## Delivery approach
Build in vertical slices. Every phase ends with a working, testable increment; do not build all backend modules before integrating the UI.

## Phase 1 — Foundation
- Repository, TypeScript strict configuration, lint/test/build pipeline.
- MongoDB/Redis local setup, environment validation, structured logging.
- Auth, workspace creation, membership roles.
**Exit:** user can register, log in, and access only their workspace.

## Phase 2 — API health monitoring
- Monitor CRUD and form validation.
- SSRF-safe outbound request module.
- Scheduler, BullMQ queue, monitor worker, check history.
- Status derivation, pause/resume, dashboard summary.
**Exit:** monitor runs when browser is closed; check history and status are correct.

## Phase 3 — Performance analytics
- Time range filters, aggregation endpoints.
- Latency percentiles, availability/error rates, status distributions.
- Charts and endpoint comparison.
- Threshold/rolling-window anomaly detection.
**Exit:** analytics reconcile with raw check records for tested periods.

## Phase 4 — Alerts and incidents
- Alert rule CRUD and evaluator.
- Incident fingerprint/deduplication and lifecycle.
- Incident timeline, in-app notifications, email delivery queue.
**Exit:** sustained failure creates one incident and notifications; recovery is recorded.

## Phase 5 — UI integration and polish
- Overview, monitor list/detail, analytics, incidents, alert rules, settings.
- Socket.IO updates, responsive layouts, accessibility.
**Exit:** all MVP workflows usable on desktop and mobile widths.

## Phase 6 — Quality and security
- Unit/integration/E2E/security suites.
- SSRF, tenant isolation, token rotation, secret redaction tests.
- Load tests and queue recovery drills.
**Exit:** all P0 acceptance criteria pass; no unresolved critical security findings.

## Phase 7 — Deployment
- Staging and production topology, backups, observability, SMTP.
- Smoke tests, gradual monitor activation, rollback rehearsal.
**Exit:** release checklist signed and operational runbook available.

## Priority convention
- P0: security, tenant isolation, background monitoring, check persistence, incident correctness.
- P1: analytics, email delivery, realtime UI, responsive polish.
- P2: export, public status pages, integrations, multi-region probes.

## Future roadmap (not MVP blockers)
Public status pages; Slack/Discord/webhooks; on-call rotations; team SSO; billing/usage plans; multi-region probes; custom maintenance windows; advanced anomaly baselines; CSV/PDF exports.
