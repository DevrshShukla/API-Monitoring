import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkspace extends Document {
  name: string;
  slug: string;
  createdBy: mongoose.Types.ObjectId;
  plan: 'free' | 'pro' | 'enterprise';
  settings: {
    retentionDaysChecks: number;
    retentionDaysIncidents: number;
    emailAlertsEnabled: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    settings: {
      retentionDaysChecks: { type: Number, default: 30 },
      retentionDaysIncidents: { type: Number, default: 365 },
      emailAlertsEnabled: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const Workspace = mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
