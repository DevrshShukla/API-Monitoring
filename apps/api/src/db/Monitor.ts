import mongoose, { Schema, Document } from 'mongoose';
import {
  MonitorStatus,
  MONITOR_STATUS,
  HttpMethod,
  HTTP_METHODS,
  CONFIG_DEFAULTS,
} from '@api-monitoring/shared';
import { EncryptedData } from '../services/cryptoService.js';

export interface IMonitor extends Document {
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  url: string;
  normalizedHost: string;
  method: HttpMethod;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatusCodes: number[];
  headersEncrypted: EncryptedData | null;
  bodyEncrypted: EncryptedData | null;
  bodyContentType: string;
  active: boolean;
  status: MonitorStatus;
  lastStatus: MonitorStatus;
  lastCheckedAt: Date | null;
  nextRunAt: Date | null;
  lastLatencyMs: number | null;
  consecutiveFailures: number;
  recentSuccessRatio: number | null;
  latencyThresholdMs: number;
  createdBy: mongoose.Types.ObjectId;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EncryptedDataSchema = new Schema(
  {
    version: { type: Number, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    data: { type: String, required: true },
  },
  { _id: false }
);

const MonitorSchema = new Schema<IMonitor>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    normalizedHost: { type: String, required: true, trim: true },
    method: { type: String, enum: HTTP_METHODS, default: 'GET' },
    intervalSeconds: { type: Number, default: CONFIG_DEFAULTS.MONITOR_INTERVAL_SECONDS },
    timeoutMs: { type: Number, default: CONFIG_DEFAULTS.MONITOR_TIMEOUT_MS },
    expectedStatusCodes: { type: [Number], default: [200, 204] },
    headersEncrypted: { type: EncryptedDataSchema, default: null },
    bodyEncrypted: { type: EncryptedDataSchema, default: null },
    bodyContentType: { type: String, default: 'application/json' },
    active: { type: Boolean, default: true },
    status: {
      type: String,
      enum: Object.values(MONITOR_STATUS),
      default: MONITOR_STATUS.UNKNOWN,
    },
    lastStatus: {
      type: String,
      enum: Object.values(MONITOR_STATUS),
      default: MONITOR_STATUS.UNKNOWN,
    },
    lastCheckedAt: { type: Date, default: null },
    nextRunAt: { type: Date, default: Date.now },
    lastLatencyMs: { type: Number, default: null },
    consecutiveFailures: { type: Number, default: 0 },
    recentSuccessRatio: { type: Number, default: null },
    latencyThresholdMs: { type: Number, default: CONFIG_DEFAULTS.LATENCY_DEGRADED_MS },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
MonitorSchema.index({ workspaceId: 1, active: 1, nextRunAt: 1 });
MonitorSchema.index({ workspaceId: 1, status: 1 });
MonitorSchema.index({ workspaceId: 1, createdAt: -1 });

export const Monitor = mongoose.model<IMonitor>('Monitor', MonitorSchema);
