# Acceptance Criteria

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


## 1. Definition of done
A feature is done only when requirements, implementation, automated tests, error states, accessibility, security checks, and documentation are complete. A screenshot alone is not acceptance evidence.

## 2. Product acceptance criteria
- **AC-MON-001** (FR-MON-001/005): Given an active monitor, when its interval becomes due, then a background worker executes a check while no browser is open.
- **AC-MON-002** (FR-MON-002/004): Given valid configuration, when a user saves a monitor, then the server persists method, URL, interval, timeout, expected codes, and safe request configuration.
- **AC-MON-003** (FR-MON-006/008): Given a completed check, then an immutable record includes outcome, status code if received, latency, timestamps, and safe error category.
- **AC-MON-004** (FR-MON-007): Given no check, status is Unknown; given pause, status is Paused; given threshold failures, status becomes Down.
- **AC-MON-005** (FR-MON-003): Given a saved sensitive header, when monitor details are retrieved, then the secret value is not returned.
- **AC-ANA-001** (FR-ANA-001): Given a known set of successful latency samples, then average/min/max/P50/P95/P99 match the documented algorithm and include sample count.
- **AC-ANA-002** (FR-ANA-002/003): Given a date range, then success/failure and status-code charts reflect only eligible checks in that UTC range.
- **AC-ANA-003** (FR-ANA-004/005): Given a configured threshold breach, then the anomaly explanation includes measured value, threshold, and time.
- **AC-INC-001** (FR-INC-002/003): Given sustained failure, then one active incident is created with configured severity and rule fingerprint.
- **AC-INC-002** (FR-INC-004/005): Given an open incident, when authorized user acknowledges/investigates/resolves, then state and timestamps update and an immutable event is added.
- **AC-INC-003** (FR-INC-006): Given repeated trigger during cooldown, then duplicate incident/notification is not created.
- **AC-ALT-001** (FR-ALT-001): Given email enabled and valid SMTP, then email delivery is queued and result is recorded; in-app notification persists regardless of SMTP availability.
- **AC-SEC-001** (SEC-SSRF-001..009): Given a blocked destination, then no outbound connection is made and a safe blocked result is recorded.
- **AC-SEC-002** (RBAC-001..008): Given a user from another workspace, then resource access is denied without leaking existence.
- **AC-UI-001**: Given loading, empty, error, or success data, then the relevant screen renders a distinct accessible state.
- **AC-DEP-001**: Given a worker restart, queued jobs are recovered or retried without duplicate check records.

## 3. Release gates
P0 gates: SSRF prevention; tenant isolation; authentication; background execution; immutable check persistence; status correctness; incident deduplication; secret redaction. P1 gates: analytics, email, realtime updates, responsive UI. No P0 failure can be waived for production.

## 4. Evidence template
For each AC, record: build/commit, environment, test case ID, execution date, result, logs/screenshots with secrets redacted, defect link, reviewer. Mark `PASS`, `FAIL`, or `BLOCKED`; do not mark untested criteria as passed.
