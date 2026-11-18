export const MONITOR_STATUS = {
  UNKNOWN: 'unknown',
  OPERATIONAL: 'operational',
  DEGRADED: 'degraded',
  DOWN: 'down',
  PAUSED: 'paused',
} as const;
export type MonitorStatus = typeof MONITOR_STATUS[keyof typeof MONITOR_STATUS];

export const CHECK_OUTCOME = {
  SUCCESS: 'success',
  HTTP_ERROR: 'http_error',
  TIMEOUT: 'timeout',
  NETWORK_ERROR: 'network_error',
  TLS_ERROR: 'tls_error',
  BLOCKED: 'blocked',
} as const;
export type CheckOutcome = typeof CHECK_OUTCOME[keyof typeof CHECK_OUTCOME];

export const INCIDENT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type IncidentSeverity = typeof INCIDENT_SEVERITY[keyof typeof INCIDENT_SEVERITY];

export const INCIDENT_STATUS = {
  OPEN: 'open',
  ACKNOWLEDGED: 'acknowledged',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
} as const;
export type IncidentStatus = typeof INCIDENT_STATUS[keyof typeof INCIDENT_STATUS];

export const WORKSPACE_ROLE = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;
export type WorkspaceRole = typeof WORKSPACE_ROLE[keyof typeof WORKSPACE_ROLE];

export const ALERT_CONDITION_TYPE = {
  CONSECUTIVE_FAILURES: 'consecutive_failures',
  LATENCY_THRESHOLD: 'latency_threshold',
  ERROR_RATE: 'error_rate',
} as const;
export type AlertConditionType = typeof ALERT_CONDITION_TYPE[keyof typeof ALERT_CONDITION_TYPE];

export const ALERT_OPERATOR = {
  GT: 'gt',
  GTE: 'gte',
  LT: 'lt',
  LTE: 'lte',
  EQ: 'eq',
} as const;
export type AlertOperator = typeof ALERT_OPERATOR[keyof typeof ALERT_OPERATOR];

export const ALERT_CHANNEL = {
  IN_APP: 'in_app',
  EMAIL: 'email',
} as const;
export type AlertChannel = typeof ALERT_CHANNEL[keyof typeof ALERT_CHANNEL];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = typeof HTTP_METHODS[number];

export const ANALYTICS_BUCKETS = ['5m', '15m', '1h', '1d'] as const;
export type AnalyticsBucket = typeof ANALYTICS_BUCKETS[number];

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',
  SSRF_BLOCKED: 'SSRF_BLOCKED',
  MONITOR_LIMIT_REACHED: 'MONITOR_LIMIT_REACHED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Global configuration baseline defaults
export const CONFIG_DEFAULTS = {
  MONITOR_INTERVAL_SECONDS: 60,
  MIN_MONITOR_INTERVAL_SECONDS: 30,
  MAX_MONITOR_INTERVAL_SECONDS: 3600,
  MONITOR_TIMEOUT_MS: 10000,
  MIN_MONITOR_TIMEOUT_MS: 1000,
  MAX_MONITOR_TIMEOUT_MS: 30000,
  MAX_RESPONSE_BYTES: 1048576, // 1MB
  MAX_REDIRECTS: 0,
  FAILURES_TO_DOWN: 3,
  LATENCY_DEGRADED_MS: 2000,
  ANALYTICS_DEFAULT_RANGE_DAYS: 7,
  MAX_ANALYTICS_RANGE_DAYS: 90,
  CHECK_RETENTION_DAYS: 30,
  INCIDENT_RETENTION_DAYS: 365,
  NOTIFICATION_COOLDOWN_MINUTES: 15,
  ALLOWED_MONITOR_PORTS: [80, 443],
  DEGRADED_SUCCESS_RATIO_THRESHOLD: 0.95, // below 95% over recent checks
  RECENT_CHECKS_WINDOW: 20,
} as const;

export const SOCKET_EVENTS = {
  MONITOR_STATUS_UPDATED: 'monitor.status.updated',
  MONITOR_CHECK_COMPLETED: 'monitor.check.completed',
  INCIDENT_CREATED: 'incident.created',
  INCIDENT_UPDATED: 'incident.updated',
  NOTIFICATION_CREATED: 'notification.created',
} as const;
