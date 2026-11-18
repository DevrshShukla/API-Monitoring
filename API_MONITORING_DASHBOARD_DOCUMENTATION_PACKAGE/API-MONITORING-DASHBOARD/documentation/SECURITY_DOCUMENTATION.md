# Security Documentation

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


## 1. Security objectives
Protect user accounts, workspace data, monitored infrastructure, secrets, and notification channels. Treat every monitor URL and configuration field as hostile input.

## 2. Critical control: SSRF protection
**SEC-SSRF-001:** Only `http` and `https` schemes are accepted; reject URL credentials, fragments where unnecessary, malformed hosts, and unsupported ports.
**SEC-SSRF-002:** Resolve all A and AAAA records and reject if any resolved address is private, loopback, link-local, multicast, unspecified, reserved, or cloud metadata-related.
**SEC-SSRF-003:** Pin the validated resolved address for the connection while preserving the correct Host header and TLS SNI; do not perform a second uncontrolled DNS lookup.
**SEC-SSRF-004:** Revalidate on every execution; DNS can change after monitor creation.
**SEC-SSRF-005:** Redirects are disabled by default. If product requirements later enable redirects, every hop must be re-parsed, resolved, validated, and bounded.
**SEC-SSRF-006:** Restrict outbound ports (default 80/443), response bytes, request duration, and concurrency.
**SEC-SSRF-007:** Add network-level egress firewall rules blocking internal networks and cloud metadata endpoints. Application checks alone are insufficient.
**SEC-SSRF-008:** Do not forward inbound user cookies, authorization headers, or internal service credentials to monitored targets.
**SEC-SSRF-009:** Store only safe error summaries; do not expose internal IPs, DNS answers, or raw stack traces to normal users.
Test IPv4-mapped IPv6, alternative numeric IP encodings, trailing dots, IDN/punycode, mixed DNS answers, rebinding, and proxy environment variables. Ensure HTTP client does not silently honor environment proxy settings.

## 3. Authentication and authorization
- Hash passwords with bcrypt (cost factor tuned for deployment) or Argon2id.
- Short-lived access tokens; refresh-token rotation and reuse detection.
- Enforce workspace membership and role on every route and socket handshake.
- Rate limit login, registration, password reset, and mutation routes.
- Use secure, HttpOnly, SameSite cookies for refresh tokens where applicable; add CSRF protection for cookie-authenticated mutations.
- Revoke sessions on password change and account disablement.

## 4. Secrets and data handling
- Encrypt sensitive monitor headers/body with AES-256-GCM or KMS envelope encryption.
- Keep encryption key outside database and rotate using key version.
- Redact Authorization, Cookie, Set-Cookie, API keys, and user-marked sensitive headers.
- Never log full request/response bodies by default.
- Mask email destinations in delivery logs.
- Define deletion and retention processes; restrict production data access.

## 5. API and infrastructure controls
- Helmet/security headers, strict CORS, body-size limits, schema validation, output encoding.
- Parameterized database operations; avoid unsafe user-controlled regex.
- Dependency scanning, secret scanning, container image scanning.
- MongoDB/Redis private network access and least-privilege credentials.
- TLS in transit; encrypted backups and storage at rest.
- Admin actions and sensitive configuration changes are audit logged.

## 6. Incident response
On suspected compromise: revoke affected tokens, rotate secrets, pause outbound monitors if SSRF abuse is suspected, preserve audit logs, inspect egress telemetry, notify affected workspace owners as required, patch and retest, document postmortem. Maintain a security contact and vulnerability disclosure process before public launch.

## 7. Security acceptance
No production launch until SSRF suite, cross-tenant authorization suite, secret-redaction checks, authentication rate limits, and dependency scanning are passing. Security review must inspect the actual HTTP client and network policy, not just URL validation helper.
