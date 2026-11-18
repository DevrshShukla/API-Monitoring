import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  incidentId: mongoose.Types.ObjectId | null;
  type: string; // e.g. 'INCIDENT_OPENED', 'INCIDENT_RESOLVED', 'MONITOR_DOWN'
  title: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', default: null },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ workspaceId: 1, userId: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
