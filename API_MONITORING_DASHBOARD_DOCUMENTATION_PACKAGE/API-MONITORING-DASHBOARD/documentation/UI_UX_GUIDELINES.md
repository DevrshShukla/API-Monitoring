# UI/UX Guidelines

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


## 1. Design philosophy
Use a classical, restrained developer-tool interface: clean hierarchy, predictable navigation, compact but readable data density, clear status semantics, and minimal decoration. The dashboard must feel reliable rather than playful. Avoid excessive gradients, glassmorphism, animated backgrounds, and crowded cards.

## 2. Design tokens
| Token | Hex | Usage |
|---|---|---|
| Primary / Indigo | `#4338CA` | Primary actions, selected navigation |
| Primary hover | `#3730A3` | Hover/focus for primary controls |
| App background | `#F8FAFC` | Main canvas |
| Surface | `#FFFFFF` | Cards, tables, dialogs |
| Border | `#E2E8F0` | Dividers and outlines |
| Text primary | `#0F172A` | Main content |
| Text secondary | `#64748B` | Labels and helper text |
| Success | `#16A34A` | Operational |
| Warning | `#D97706` | Degraded / warning |
| Danger | `#DC2626` | Down / critical |
| Info | `#0284C7` | Informational state |
| Focus ring | `#818CF8` | Keyboard focus |

Use status text plus icon/shape; never communicate state by color alone. Maintain contrast at WCAG AA for text and controls.

## 3. Layout and navigation
- Desktop: fixed 248px sidebar, top bar with workspace switcher, global date range where relevant, notifications, and profile.
- Main content max width 1440px; 24px page padding; 16–24px section spacing.
- Tablet: collapsible sidebar; cards wrap to two columns.
- Mobile: drawer navigation; tables become stacked rows or horizontally scrollable with visible labels.
- Primary navigation: Overview, Monitors, Analytics, Incidents, Alert Rules, Settings.

## 4. Required screens
1. Sign in / sign up / password reset.
2. Overview dashboard: metric cards, health summary, recent failures, incident list.
3. Monitors list: search, status filter, pagination, add monitor.
4. Add/edit monitor form: URL, method, interval, timeout, expected codes, headers/body advanced section.
5. Monitor detail: current status, latency, uptime, recent checks, tabs for history/analytics/config.
6. Analytics: date filter, summary statistics, six chart types, endpoint comparison.
7. Incidents list and incident detail timeline.
8. Alert rule list and create/edit rule.
9. Notifications center.
10. Workspace/profile/security settings.

## 5. Interaction rules
- Destructive actions require confirmation and clearly name the affected monitor.
- Pause/resume uses immediate action with toast and status update.
- Form errors appear next to fields; preserve valid user input on server errors.
- Secrets are write-only after save: show “Configured” and allow replace/remove, never reveal stored value.
- Empty states explain the next action and provide one clear CTA.
- Loading states use skeletons for data regions; avoid full-screen spinners for routine refresh.
- Error states offer retry and a human-readable reason; never silently show empty charts after a failed request.
- Tables support keyboard focus, clear sort state, and accessible row actions.
- Charts include textual summaries or accessible data tables.

## 6. Screen-level content specification
### Overview
- Header: “Overview”, selected workspace, last updated timestamp.
- KPI cards: monitored endpoints, operational, degraded, down, average latency, uptime.
- Health distribution and response-time trend.
- Recent incidents with severity, monitor, opened time, current status.
- Recent failures list with timestamp, status/error, latency.
### Monitors
- Columns: name, URL host, method, current status, last checked, latency, interval, actions.
- Filters: status, active/paused, search by name/host.
- Add monitor opens dedicated page or wide modal; avoid overlong modal forms.
### Monitor detail
- Status banner, URL/method, last check, uptime.
- Latency cards: current, average, P95.
- Time-series chart; recent checks table with outcome, HTTP code, duration, checked time.
### Incident detail
- Severity and state, monitor link, trigger explanation, opened/acknowledged/resolved timestamps.
- Timeline with automated events and user notes; actions based on role and state.

## 7. Responsive breakpoints
- Small: <640px; medium: 640–1023px; large: ≥1024px.
- At small sizes prioritize status, name, and last check; hide secondary table columns behind detail view.
- Charts stack vertically; filters move into a collapsible filter panel.

## 8. Accessibility and content
- All interactive controls have labels and visible focus.
- Use semantic headings in order; dialog focus is trapped and returned to trigger.
- Announce async status changes via polite live region.
- Date/time displays include timezone context in tooltip or settings.
- Use plain language: “No checks yet” rather than “N/A”; “Could not connect” rather than raw stack trace.
