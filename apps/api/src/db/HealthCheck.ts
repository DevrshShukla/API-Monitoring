import mongoose, { Schema, Document } from 'mongoose';
import { CheckOutcome, CHECK_OUTCOME } from '@api-monitoring/shared';

export interface IHealthCheck extends Document {
  workspaceId: mongoose.Types.ObjectId;
  monitorId: mongoose.Types.ObjectId;
  scheduledAt: Date;
  startedAt: Date;
  completedAt: Date;
  outcome: CheckOutcome;
  statusCode: number | null;
  latencyMs: number;
  errorCategory: string | null;
  errorMessageSafe: string | null;
  responseBytes: number;
  traceId: string | null;
  createdAt: Date;
}

const HealthCheckSchema = new Schema<IHealthCheck>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    monitorId: { type: Schema.Types.ObjectId, ref: 'Monitor', required: true },
    scheduledAt: { type: Date, required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
    outcome: { type: String, enum: Object.values(CHECK_OUTCOME), required: true },
    statusCode: { type: Number, default: null },
    latencyMs: { type: Number, required: true },
    errorCategory: { type: String, default: null },
    errorMessageSafe: { type: String, default: null },
    responseBytes: { type: Number, default: 0 },
    traceId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes
HealthCheckSchema.index({ workspaceId: 1, monitorId: 1, completedAt: -1 });
HealthCheckSchema.index({ workspaceId: 1, completedAt: -1 });
// TTL index: 30 days default = 30 * 24 * 3600 = 2,592,000 seconds
HealthCheckSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export const HealthCheck = mongoose.model<IHealthCheck>('HealthCheck', HealthCheckSchema);
