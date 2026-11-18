# REST API Documentation

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


## 1. API conventions
Base path: `/api/v1`. Content type: `application/json`. All protected routes require `Authorization: Bearer <accessToken>`. Every response includes request correlation header `X-Request-Id`. Dates are ISO 8601 UTC. Use consistent envelopes and stable error codes.

Success:
```json
{ "data": {}, "meta": { "requestId": "req_123" } }
```
Error:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Check the supplied fields.", "requestId": "req_123", "details": [] } }
```

## 2. Authentication
| API ID | Method + path | Purpose |
|---|---|---|
| API-AUTH-001 | POST `/auth/register` | Create user and default workspace |
| API-AUTH-002 | POST `/auth/login` | Authenticate |
| API-AUTH-003 | POST `/auth/refresh` | Rotate refresh token |
| API-AUTH-004 | POST `/auth/logout` | Revoke refresh-token family |
| API-AUTH-005 | GET `/auth/me` | Current user and workspace memberships |

Access token lifetime: 15 minutes. Refresh token lifetime: 30 days, stored hashed, rotated on use. Detect refresh-token reuse and revoke token family. Rate limit login/register/refresh. Password reset and email verification are required before public production launch; local MVP may stub email verification only in development.

## 3. Monitor endpoints
| API ID | Method + path | Purpose |
|---|---|---|
| API-MON-001 | GET `/monitors` | List with filters and pagination |
| API-MON-002 | POST `/monitors` | Create monitor |
| API-MON-003 | GET `/monitors/:id` | Detail and summary |
| API-MON-004 | PATCH `/monitors/:id` | Update configuration |
| API-MON-005 | POST `/monitors/:id/pause` | Pause |
| API-MON-006 | POST `/monitors/:id/resume` | Resume |
| API-MON-007 | DELETE `/monitors/:id` | Deactivate/delete |
| API-MON-008 | GET `/monitors/:id/checks` | Check history |

Create request:
```json
{
  "name": "Payments API",
  "url": "https://api.example.com/health",
  "method": "GET",
  "intervalSeconds": 60,
  "timeoutMs": 10000,
  "expectedStatusCodes": [200, 204],
  "latencyThresholdMs": 2000,
  "headers": [{ "key": "X-Environment", "value": "production", "sensitive": false }]
}
```
Response omits header values and returns `{ "headersConfigured": true }` for sensitive configuration. Validation: interval 30–3600 seconds, timeout 1,000–30,000 ms, expected status codes 100–599, bounded header count/size, bounded body size.

## 4. Analytics
| API ID | Method + path | Purpose |
|---|---|---|
| API-ANA-001 | GET `/analytics/overview?from=&to=` | Workspace overview |
| API-ANA-002 | GET `/monitors/:id/analytics?from=&to=&bucket=` | Endpoint analytics |
| API-ANA-003 | GET `/analytics/compare?monitorIds=&from=&to=` | Compare endpoints |
| API-ANA-004 | GET `/analytics/status-distribution?from=&to=` | Status distribution |

Return sample count with all percentiles. If sample count is zero, values are `null`, not zero. Enforce maximum 90-day raw range. Bucket values: `5m|15m|1h|1d`; reject unsupported values.

## 5. Incidents and alert rules
| API ID | Method + path | Purpose |
|---|---|---|
| API-INC-001 | GET `/incidents` | Filtered incident list |
| API-INC-002 | GET `/incidents/:id` | Incident detail and timeline |
| API-INC-003 | POST `/incidents/:id/acknowledge` | Acknowledge |
| API-INC-004 | POST `/incidents/:id/investigate` | Start investigation |
| API-INC-005 | POST `/incidents/:id/resolve` | Resolve with note |
| API-INC-006 | POST `/incidents/:id/notes` | Add note |
| API-ALT-001 | GET `/alert-rules` | List rules |
| API-ALT-002 | POST `/alert-rules` | Create rule |
| API-ALT-003 | PATCH `/alert-rules/:id` | Update rule |
| API-ALT-004 | DELETE `/alert-rules/:id` | Delete rule |
| API-NOT-001 | GET `/notifications` | List current user's notifications |
| API-NOT-002 | POST `/notifications/:id/read` | Mark read |

Resolve request:
```json
{ "resolutionNote": "Database connection pool was exhausted; capacity increased and checks recovered." }
```
Only authorized roles may change alert rules or incident severity. All incident transitions create immutable incident events.

## 6. Authorization and error codes
Every handler calls workspace membership authorization before accessing a resource. Return 404 for resources outside the active workspace to avoid resource enumeration. Standard codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `CONFLICT`, `SSRF_BLOCKED`, `MONITOR_LIMIT_REACHED`, `INTERNAL_ERROR`.

## 7. Realtime events
Socket.IO namespace `/workspace`; authenticate during handshake and verify membership. Events: `monitor.status.updated`, `monitor.check.completed`, `incident.created`, `incident.updated`, `notification.created`. Payload contains IDs and safe summaries only. On reconnect, client refetches REST data.
