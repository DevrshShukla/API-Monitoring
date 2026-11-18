import { z } from 'zod';
import {
  HTTP_METHODS,
  ALERT_CONDITION_TYPE,
  ALERT_OPERATOR,
  ALERT_CHANNEL,
  INCIDENT_SEVERITY,
  ANALYTICS_BUCKETS,
  CONFIG_DEFAULTS,
} from '../constants/index.js';

// Auth Schemas
export const RegisterSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  workspaceName: z.string().trim().min(2, 'Workspace name must be at least 2 characters').max(100).optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

// Header Schema
export const MonitorHeaderSchema = z.object({
  key: z.string().trim().min(1, 'Header key is required').max(200),
  value: z.string().max(2000),
  sensitive: z.boolean().default(false),
});
export type MonitorHeaderItem = z.infer<typeof MonitorHeaderSchema>;

// Monitor Schemas
export const CreateMonitorSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  url: z.string().trim().url('Must be a valid URL'),
  method: z.enum(HTTP_METHODS).default('GET'),
  intervalSeconds: z
    .number()
    .int()
    .min(CONFIG_DEFAULTS.MIN_MONITOR_INTERVAL_SECONDS)
    .max(CONFIG_DEFAULTS.MAX_MONITOR_INTERVAL_SECONDS)
    .default(CONFIG_DEFAULTS.MONITOR_INTERVAL_SECONDS),
  timeoutMs: z
    .number()
    .int()
    .min(CONFIG_DEFAULTS.MIN_MONITOR_TIMEOUT_MS)
    .max(CONFIG_DEFAULTS.MAX_MONITOR_TIMEOUT_MS)
    .default(CONFIG_DEFAULTS.MONITOR_TIMEOUT_MS),
  expectedStatusCodes: z
    .array(z.number().int().min(100).max(599))
    .min(1, 'At least one expected status code is required')
    .default([200, 204]),
  latencyThresholdMs: z
    .number()
    .int()
    .min(100)
    .max(30000)
    .default(CONFIG_DEFAULTS.LATENCY_DEGRADED_MS),
  headers: z.array(MonitorHeaderSchema).max(20).optional().default([]),
  body: z.string().max(10000).optional(),
  bodyContentType: z.string().max(100).optional().default('application/json'),
});
export type CreateMonitorInput = z.infer<typeof CreateMonitorSchema>;

export const UpdateMonitorSchema = CreateMonitorSchema.partial();
export type UpdateMonitorInput = z.infer<typeof UpdateMonitorSchema>;

export const MonitorQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});
export type MonitorQueryInput = z.infer<typeof MonitorQuerySchema>;

// Alert Rule Schemas
export const CreateAlertRuleSchema = z.object({
  monitorId: z.string().nullable().optional(),
  name: z.string().trim().min(2).max(100),
  enabled: z.boolean().default(true),
  conditionType: z.enum([
    ALERT_CONDITION_TYPE.CONSECUTIVE_FAILURES,
    ALERT_CONDITION_TYPE.LATENCY_THRESHOLD,
    ALERT_CONDITION_TYPE.ERROR_RATE,
  ]),
  operator: z.enum([
    ALERT_OPERATOR.GT,
    ALERT_OPERATOR.GTE,
    ALERT_OPERATOR.LT,
    ALERT_OPERATOR.LTE,
    ALERT_OPERATOR.EQ,
  ]),
  threshold: z.number().min(0),
  consecutiveCount: z.number().int().min(1).max(50).default(3),
  windowSize: z.number().int().min(1).max(100).default(20),
  severity: z.enum([
    INCIDENT_SEVERITY.LOW,
    INCIDENT_SEVERITY.MEDIUM,
    INCIDENT_SEVERITY.HIGH,
    INCIDENT_SEVERITY.CRITICAL,
  ]).default(INCIDENT_SEVERITY.HIGH),
  channels: z.array(z.enum([ALERT_CHANNEL.IN_APP, ALERT_CHANNEL.EMAIL])).min(1).default([ALERT_CHANNEL.IN_APP]),
  cooldownMinutes: z.number().int().min(1).max(1440).default(CONFIG_DEFAULTS.NOTIFICATION_COOLDOWN_MINUTES),
});
export type CreateAlertRuleInput = z.infer<typeof CreateAlertRuleSchema>;

export const UpdateAlertRuleSchema = CreateAlertRuleSchema.partial();
export type UpdateAlertRuleInput = z.infer<typeof UpdateAlertRuleSchema>;

// Incident Action Schemas
export const ResolveIncidentSchema = z.object({
  resolutionNote: z.string().trim().min(5, 'Resolution note is required (min 5 characters)').max(1000),
});
export type ResolveIncidentInput = z.infer<typeof ResolveIncidentSchema>;

export const AddIncidentNoteSchema = z.object({
  note: z.string().trim().min(2, 'Note is required').max(1000),
});
export type AddIncidentNoteInput = z.infer<typeof AddIncidentNoteSchema>;

export const IncidentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  severity: z.string().optional(),
  monitorId: z.string().optional(),
});
export type IncidentQueryInput = z.infer<typeof IncidentQuerySchema>;

// Analytics Schemas
export const AnalyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type AnalyticsQueryInput = z.infer<typeof AnalyticsQuerySchema>;

export const EndpointAnalyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  bucket: z.enum(ANALYTICS_BUCKETS).default('1h'),
});
export type EndpointAnalyticsQueryInput = z.infer<typeof EndpointAnalyticsQuerySchema>;

export const CompareQuerySchema = z.object({
  monitorIds: z.string().min(1, 'monitorIds required as comma separated list'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type CompareQueryInput = z.infer<typeof CompareQuerySchema>;
