import dotenv from 'dotenv';
import { z } from 'zod';
import { CONFIG_DEFAULTS } from '@api-monitoring/shared';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/api-monitoring'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(16).default('development-jwt-access-secret-minimum-32-chars!'),
  JWT_REFRESH_SECRET: z.string().min(16).default('development-jwt-refresh-secret-minimum-32-chars!'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().default(30),
  ENCRYPTION_KEY: z.string().min(32).default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  APP_ORIGIN: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  MONITOR_INTERVAL_SECONDS: z.coerce.number().default(CONFIG_DEFAULTS.MONITOR_INTERVAL_SECONDS),
  MONITOR_TIMEOUT_MS: z.coerce.number().default(CONFIG_DEFAULTS.MONITOR_TIMEOUT_MS),
  MAX_RESPONSE_BYTES: z.coerce.number().default(CONFIG_DEFAULTS.MAX_RESPONSE_BYTES),
  MAX_REDIRECTS: z.coerce.number().default(CONFIG_DEFAULTS.MAX_REDIRECTS),
  FAILURES_TO_DOWN: z.coerce.number().default(CONFIG_DEFAULTS.FAILURES_TO_DOWN),
  LATENCY_DEGRADED_MS: z.coerce.number().default(CONFIG_DEFAULTS.LATENCY_DEGRADED_MS),
  ANALYTICS_DEFAULT_RANGE_DAYS: z.coerce.number().default(CONFIG_DEFAULTS.ANALYTICS_DEFAULT_RANGE_DAYS),
  CHECK_RETENTION_DAYS: z.coerce.number().default(CONFIG_DEFAULTS.CHECK_RETENTION_DAYS),
  INCIDENT_RETENTION_DAYS: z.coerce.number().default(CONFIG_DEFAULTS.INCIDENT_RETENTION_DAYS),
  NOTIFICATION_COOLDOWN_MINUTES: z.coerce.number().default(CONFIG_DEFAULTS.NOTIFICATION_COOLDOWN_MINUTES),
  ALLOWED_MONITOR_PORTS: z.string().default('80,443'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('alerts@apimonitor.local'),
});

export type Env = z.infer<typeof EnvSchema>;

let parsedEnv: Env;
try {
  parsedEnv = EnvSchema.parse(process.env);
} catch (err: any) {
  console.error('Environment validation error:', err.errors || err);
  parsedEnv = EnvSchema.parse({});
}

export const env = parsedEnv;
