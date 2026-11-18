# Testing Documentation

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


## 1. Test strategy
Testing is layered: unit tests for deterministic logic, integration tests for API/database/queue boundaries, security tests for outbound URL handling and tenancy, and Playwright end-to-end tests for core user journeys.

## 2. Test levels and tools
| Level | Tool | Scope |
|---|---|---|
| Unit | Vitest | status derivation, percentile calculations, rule evaluation, validators |
| Component | React Testing Library | forms, tables, empty/loading/error states, accessibility |
| API integration | Supertest + test MongoDB | auth, workspace isolation, CRUD, incidents |
| Worker integration | BullMQ + test Redis | enqueue, idempotency, retry, lock behavior |
| E2E | Playwright | signup, add monitor, inspect result, resolve incident |
| Security | custom tests + dependency scanning | SSRF, auth, secrets, rate limits, injection |

## 3. Required test cases
- **TC-MON-001:** Create valid GET monitor and verify persisted configuration.
- **TC-MON-002:** Reject unsupported method, invalid interval, malformed URL, and oversized body.
- **TC-MON-003:** Paused monitor is not enqueued or executed.
- **TC-MON-004:** Worker records success, unexpected status, timeout, DNS failure, TLS failure.
- **TC-MON-005:** Duplicate job delivery creates one health-check record.
- **TC-MON-006:** Worker re-reads current monitor config; stale queued URL is never used.
- **TC-SEC-001:** Reject localhost, 127.0.0.1, ::1, private IPv4/IPv6, link-local, multicast, unspecified, metadata IPs.
- **TC-SEC-002:** Reject DNS names resolving to blocked addresses and test rebinding defenses.
- **TC-SEC-003:** Redirect response cannot pivot to blocked destination.
- **TC-SEC-004:** Cross-workspace read/update/delete returns 404 or equivalent safe denial.
- **TC-SEC-005:** API response and logs do not reveal sensitive header values.
- **TC-ANA-001:** Percentiles match nearest-rank reference dataset; empty data returns null.
- **TC-INC-001:** Threshold breach creates one active incident for fingerprint.
- **TC-INC-002:** Cooldown suppresses repeated notifications but incident remains updated.
- **TC-INC-003:** Invalid lifecycle transition is rejected.
- **TC-INC-004:** Resolve action requires note and writes timeline event.
- **TC-UI-001:** Loading, empty, and error states are accessible and distinct.
- **TC-E2E-001:** User signs up, adds monitor, sees first result, opens analytics, acknowledges and resolves incident.

## 4. Status derivation test matrix
| Latest observation | Consecutive failures | Latency | Expected |
|---|---:|---:|---|
| No checks | 0 | — | Unknown |
| Paused | any | — | Paused |
| Success | 0 | below threshold | Operational |
| Success | 0 | above threshold | Degraded |
| Failure | below configured threshold | — | retain prior state or Degraded per policy; show warning |
| Failure | at/above threshold | — | Down |
| Recovery success | — | normal | Operational after recovery window |

## 5. Quality gates
- TypeScript strict build passes.
- ESLint and formatting checks pass.
- Unit/integration tests pass in CI.
- No critical/high dependency vulnerabilities without approved exception.
- E2E core journey passes against production-like test environment.
- SSRF test suite passes before any production deployment.
- Migration/index creation and retention jobs are tested.
- Accessibility checks cover keyboard navigation, labels, focus, contrast.

## 6. Test data and environments
Use isolated test database and Redis namespace. Mock outbound HTTP in unit/integration tests; use a controlled local fixture server for worker integration. Never run SSRF tests against third-party production systems. Seed at least one workspace, users with each role, monitors across statuses, check histories, and incidents.

## 7. Release sign-off
QA signs off only when all P0 tests pass, no open critical security issue exists, all core acceptance criteria have evidence, and rollback has been rehearsed.
