# User Roles and Permissions

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


## 1. Role model
Roles are assigned per workspace, not globally. A user can have different roles in different workspaces. Workspace owner is unique per workspace in MVP.

## 2. Permission matrix
| Action | Owner | Admin | Member | Viewer |
|---|---:|---:|---:|---:|
| View dashboard/monitors/analytics | Yes | Yes | Yes | Yes |
| Create/edit monitors | Yes | Yes | Yes | No |
| Pause/resume monitors | Yes | Yes | Yes | No |
| Delete monitors | Yes | Yes | No | No |
| Create/edit alert rules | Yes | Yes | Yes | No |
| View incidents | Yes | Yes | Yes | Yes |
| Acknowledge/investigate incidents | Yes | Yes | Yes | No |
| Resolve incidents | Yes | Yes | Yes | No |
| Manage workspace settings | Yes | Yes | No | No |
| Invite/remove members | Yes | Yes | No | No |
| Change member roles | Yes | No | No | No |
| Transfer ownership/delete workspace | Yes | No | No | No |
| View audit log | Yes | Yes | No | No |

## 3. Enforcement requirements
- **RBAC-001:** Determine workspace from authenticated active context and verify membership on every request.
- **RBAC-002:** Resource lookup includes `workspaceId`; never fetch by ID alone then trust client.
- **RBAC-003:** UI hiding is not authorization; API enforces all permissions.
- **RBAC-004:** Socket rooms are joined only after membership validation.
- **RBAC-005:** Role changes, invitations, removals, and ownership transfer create audit events.
- **RBAC-006:** Default role for invited users is Member; invitation tokens are single-use and expire.
- **RBAC-007:** Removed members lose access immediately and their socket connection is disconnected.
- **RBAC-008:** Return a safe 404 for cross-workspace resources.

## 4. Workspace lifecycle
Creator becomes Owner. Owner can invite Admin, Member, or Viewer. Ownership transfer requires re-authentication and confirmation. Workspace deletion requires explicit confirmation and a retention-aware deletion job. In MVP, users cannot remove the last Owner.

## 5. Future role enhancements
Custom roles, organization-level policies, SSO group mapping, SCIM provisioning, and audit export are future scope.
