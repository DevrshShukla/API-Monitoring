# Product Requirements Document (PRD)

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


## 1. Executive summary
API Monitoring Dashboard is a SaaS-style web application for developers and engineering teams to register HTTP APIs, continuously measure their availability and latency, understand historical performance, and manage incidents from one workspace. The product's primary promise is early, actionable visibility into API health.

## 2. Goals and measurable outcomes
| Goal ID | Goal | MVP success measure |
|---|---|---|
| GOAL-01 | Make endpoint health visible | A user can add a monitor and see its first result without keeping the browser open. |
| GOAL-02 | Detect service degradation early | Consecutive failures and latency thresholds create an incident within one monitor cycle after threshold crossing. |
| GOAL-03 | Explain performance over time | User can inspect latency percentiles, uptime, status-code counts, and trends for a selected period. |
| GOAL-04 | Support incident response | User can acknowledge, investigate, resolve, and review a complete incident timeline. |
| GOAL-05 | Protect monitored infrastructure | SSRF controls block private, loopback, link-local, and metadata destinations. |

## 3. Personas and jobs-to-be-done
- **Individual developer:** “Tell me when my deployed API stops responding, and show me what changed.”
- **Backend engineer:** “Compare endpoint latency and isolate whether a regression is endpoint-specific.”
- **DevOps engineer:** “Give my team reliable alerts and a traceable incident lifecycle.”
- **Workspace administrator:** “Control access, monitor ownership, notification settings, and retention.”

## 4. User journeys
### J-01: Onboard and add a monitor
1. User creates an account and workspace.
2. User opens Monitors and selects Add monitor.
3. User enters name, URL, method, interval, timeout, optional headers/body, and expected status codes.
4. Server validates ownership, URL, request limits, and destination safety.
5. Monitor is saved as `active`; scheduler discovers it and queues a check.
6. User sees `Unknown` until the first result; then sees the computed status and history.

### J-02: Diagnose degraded performance
1. User opens an endpoint detail page.
2. User selects a time range.
3. Dashboard displays latency trend and P50/P95/P99, success rate, and HTTP status distribution.
4. User compares endpoints or filters by status code.
5. The page displays anomaly markers with the rule that fired.

### J-03: Respond to incident
1. Failure or degradation rule crosses its configured threshold.
2. Incident is created or updated using a stable fingerprint.
3. In-app notification is persisted; email is queued if enabled.
4. User acknowledges and moves incident to Investigating.
5. User records notes and resolves the incident.
6. A recovery check is attached to the incident timeline; duplicate notifications are suppressed during cooldown.

## 5. Functional requirements
### Monitoring
- **FR-MON-001:** Create, read, update, pause, resume, and delete monitors.
- **FR-MON-002:** Support GET, POST, PUT, PATCH, DELETE.
- **FR-MON-003:** Store encrypted-at-rest sensitive header values; redact them from all read APIs.
- **FR-MON-004:** Support configurable interval, timeout, expected status codes, headers, and JSON/text request body.
- **FR-MON-005:** Execute checks in background workers independent of browser state.
- **FR-MON-006:** Persist status code, latency, outcome, error category, timestamps, and bounded response metadata.
- **FR-MON-007:** Calculate uptime and derive Operational, Degraded, Down, Unknown, Paused states.
- **FR-MON-008:** Keep check records immutable and queryable by monitor/time.
### Analytics
- **FR-ANA-001:** Calculate min, max, average, P50, P95, and P99 latency for selected periods.
- **FR-ANA-002:** Calculate success/failure rates and 4xx/5xx distribution.
- **FR-ANA-003:** Provide time-series charts and endpoint comparisons.
- **FR-ANA-004:** Detect threshold breaches, repeated failures, and latency anomalies.
- **FR-ANA-005:** Explain each anomaly using observed value, threshold/baseline, and time.
### Incidents and alerts
- **FR-INC-001:** Configure alert rules per monitor or workspace.
- **FR-INC-002:** Create incidents for sustained failures or latency degradation.
- **FR-INC-003:** Support severity Low, Medium, High, Critical.
- **FR-INC-004:** Support Open → Acknowledged → Investigating → Resolved lifecycle.
- **FR-INC-005:** Persist notes and lifecycle timestamps.
- **FR-INC-006:** Prevent duplicate incidents using fingerprint and cooldown.
- **FR-ALT-001:** Persist in-app notifications and send email where configured.
- **FR-ALT-002:** Track delivery attempts and failure reasons without exposing secrets.

## 6. Non-functional requirements
- **NFR-PERF-001:** Dashboard API p95 target under 500 ms for normal indexed queries at MVP load.
- **NFR-PERF-002:** Health-check execution must respect per-monitor timeout and response-size caps.
- **NFR-REL-001:** Queue jobs are durable and idempotent; worker restart must not lose scheduled monitors.
- **NFR-SEC-001:** Enforce workspace isolation on every read/write.
- **NFR-SEC-002:** Block SSRF targets, including DNS-resolved private addresses and redirect pivots.
- **NFR-SEC-003:** Passwords use bcrypt/Argon2; tokens and secrets never appear in logs.
- **NFR-OBS-001:** Structured logs include request ID, workspace ID where safe, job ID, and outcome.
- **NFR-ACC-001:** Core workflows are keyboard-accessible and meet WCAG 2.1 AA targets.
- **NFR-MAINT-001:** TypeScript strict mode, linting, tests, and documented environment variables are required.

## 7. Status and incident business rules
- **Unknown:** no successful or failed check exists yet, or no recent check is available.
- **Paused:** monitor is intentionally disabled; no new checks are scheduled.
- **Down:** latest outcome is failure and consecutive failure count is at least `FAILURES_TO_DOWN`.
- **Degraded:** latest check succeeds but latency exceeds the configured latency threshold, or recent success ratio falls below the configured degraded threshold.
- **Operational:** latest check succeeds and no degradation condition is active.
Priority: Paused > Unknown (no data) > Down > Degraded > Operational. Status is recomputed after each check. Default degraded success ratio: below 95% over last 20 checks; this threshold is configurable.
Incident severity defaults: Critical for sustained outage of a critical monitor; High for other Down states; Medium for Degraded; Low for informational anomalies. Users may override severity in an alert rule.

## 8. Success metrics and analytics definitions
- **Availability:** successful checks / eligible completed checks × 100. Paused and intentionally skipped checks are excluded.
- **Success:** HTTP response status is in configured expected status list.
- **Failure:** timeout, network error, TLS error, or unexpected status.
- **Latency:** elapsed time from request dispatch to response headers; store integer milliseconds.
- **Percentiles:** nearest-rank percentile over successful measured checks; document sample count. Empty sample yields null.
- **Error rate:** failed checks / eligible completed checks × 100.
- **MTTR:** average resolvedAt − openedAt for resolved incidents.
- **MTTA:** average acknowledgedAt − openedAt for acknowledged incidents.

## 9. MVP release boundaries
MVP must support one logical monitoring region, workspace-based tenancy, email and in-app alerts, and explainable threshold detection. Advanced team scheduling, public status pages, billing, and integrations are future scope.

## 10. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Monitoring requests become SSRF proxy | Dedicated egress policy, DNS/IP checks, redirects disabled, response caps. |
| Queue backlog delays checks | Queue-age metrics, bounded concurrency, backoff, alert on lag. |
| False-positive alerts | Consecutive-failure threshold, cooldown, recovery hysteresis. |
| Analytics become expensive | Time indexes, bounded ranges, aggregation pipelines, rollups later. |
| Secret leakage | Encryption, redaction, restricted access, log scrubbing. |
