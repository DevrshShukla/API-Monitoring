import mongoose, { Schema, Document } from 'mongoose';

export interface IIncidentEvent extends Document {
  workspaceId: mongoose.Types.ObjectId;
  incidentId: mongoose.Types.ObjectId;
  actorType: 'user' | 'system';
  actorId: mongoose.Types.ObjectId | null;
  actorName: string | null;
  eventType: string; // e.g. 'CREATED', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'NOTE_ADDED'
  message: string;
  metadataSafe: Record<string, unknown>;
  createdAt: Date;
}

const IncidentEventSchema = new Schema<IIncidentEvent>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', required: true },
    actorType: { type: String, enum: ['user', 'system'], default: 'system' },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: null },
    eventType: { type: String, required: true },
    message: { type: String, required: true },
    metadataSafe: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

IncidentEventSchema.index({ workspaceId: 1, incidentId: 1, createdAt: 1 });

export const IncidentEvent = mongoose.model<IIncidentEvent>('IncidentEvent', IncidentEventSchema);
