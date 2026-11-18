import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditEvent extends Document {
  workspaceId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId | null;
  action: string; // e.g. 'MONITOR_CREATED', 'MONITOR_DELETED', 'MEMBER_INVITED', 'ROLE_CHANGED'
  resourceType: string;
  resourceId: string | null;
  metadataSafe: Record<string, unknown>;
  ipHash: string | null;
  createdAt: Date;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, default: null },
    metadataSafe: { type: Schema.Types.Mixed, default: {} },
    ipHash: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes
AuditEventSchema.index({ workspaceId: 1, createdAt: -1 });
// 365 days retention TTL
AuditEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

export const AuditEvent = mongoose.model<IAuditEvent>('AuditEvent', AuditEventSchema);
