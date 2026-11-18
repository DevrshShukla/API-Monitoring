import { MonitorStatus, CheckOutcome, IncidentSeverity, IncidentStatus, WorkspaceRole, HttpMethod } from '../constants/index.js';

export interface ApiResponse<T> {
  data: T;
  meta: {
    requestId: string;
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
    timestamp?: string;
  };
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: ApiErrorDetail[];
  };
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  plan: string;
  createdAt: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
  workspace: WorkspaceDto;
}

export interface MonitorHeaderInput {
  key: string;
  value: string;
  sensitive?: boolean;
}

export interface MonitorDto {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  normalizedHost: string;
  method: HttpMethod;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatusCodes: number[];
  headersConfigured: boolean;
  bodyConfigured: boolean;
  bodyContentType?: string;
  active: boolean;
  status: MonitorStatus;
  lastStatus: MonitorStatus;
  lastCheckedAt: string | null;
  nextRunAt: string | null;
  lastLatencyMs: number | null;
  consecutiveFailures: number;
  recentSuccessRatio: number | null;
  latencyThresholdMs: number;
  uptime24h?: number | null;
  uptime7d?: number | null;
  uptime30d?: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCheckDto {
  id: string;
  monitorId: string;
  scheduledAt: string;
  startedAt: string;
  completedAt: string;
  outcome: CheckOutcome;
  statusCode: number | null;
  latencyMs: number;
  errorCategory: string | null;
  errorMessageSafe: string | null;
  responseBytes: number;
  traceId?: string;
  createdAt: string;
}

export interface IncidentEventDto {
  id: string;
  incidentId: string;
  actorType: 'user' | 'system';
  actorId: string | null;
  actorName?: string | null;
  eventType: string;
  message: string;
  metadataSafe?: Record<string, unknown>;
  createdAt: string;
}

export interface IncidentDto {
  id: string;
  workspaceId: string;
  monitorId: string;
  monitorName?: string;
  monitorUrl?: string;
  alertRuleId: string | null;
  fingerprint: string;
  title: string;
  description: string;
  conditionType: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  openedAt: string;
  acknowledgedAt: string | null;
  investigatingAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  lastTriggeredAt: string;
  timeline?: IncidentEventDto[];
  createdAt: string;
  updatedAt: string;
}

export interface AlertRuleDto {
  id: string;
  workspaceId: string;
  monitorId: string | null;
  monitorName?: string | null;
  name: string;
  enabled: boolean;
  conditionType: string;
  operator: string;
  threshold: number;
  consecutiveCount: number;
  windowSize: number;
  severity: IncidentSeverity;
  channels: string[];
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDto {
  id: string;
  workspaceId: string;
  userId: string;
  incidentId: string | null;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface AnalyticsSummaryDto {
  totalMonitors: number;
  operational: number;
  degraded: number;
  down: number;
  paused: number;
  unknown: number;
  overallUptimePercent: number | null;
  averageLatencyMs: number | null;
  activeIncidentsCount: number;
}

export interface LatencyTimeSeriesPoint {
  timestamp: string;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
  sampleCount: number;
}

export interface StatusCodeDistributionItem {
  statusCode: number;
  count: number;
  percentage: number;
}

export interface EndpointAnalyticsDto {
  monitorId: string;
  name: string;
  timeRange: {
    from: string;
    to: string;
  };
  sampleCount: number;
  uptimePercent: number | null;
  averageLatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  statusDistribution: StatusCodeDistributionItem[];
  timeSeries: LatencyTimeSeriesPoint[];
  anomalies: {
    timestamp: string;
    type: string;
    observedValue: number;
    threshold: number;
    message: string;
  }[];
}
