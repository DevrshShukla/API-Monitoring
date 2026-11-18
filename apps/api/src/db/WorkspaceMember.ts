import mongoose, { Schema, Document } from 'mongoose';
import { WorkspaceRole, WORKSPACE_ROLE } from '@api-monitoring/shared';

export interface IWorkspaceMember extends Document {
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: WorkspaceRole;
  status: 'active' | 'invited' | 'disabled';
  joinedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: [
        WORKSPACE_ROLE.OWNER,
        WORKSPACE_ROLE.ADMIN,
        WORKSPACE_ROLE.MEMBER,
        WORKSPACE_ROLE.VIEWER,
      ],
      default: WORKSPACE_ROLE.MEMBER,
    },
    status: { type: String, enum: ['active', 'invited', 'disabled'], default: 'active' },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
WorkspaceMemberSchema.index({ userId: 1, status: 1 });

export const WorkspaceMember = mongoose.model<IWorkspaceMember>('WorkspaceMember', WorkspaceMemberSchema);
