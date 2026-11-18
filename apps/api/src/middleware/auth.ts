import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../db/User.js';
import { WorkspaceMember } from '../db/WorkspaceMember.js';
import { AppError } from './errorHandler.js';
import { ERROR_CODES, WorkspaceRole, WORKSPACE_ROLE } from '@api-monitoring/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  workspaceId?: string;
  userRole?: WorkspaceRole;
  requestId?: string;
}

export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Missing or invalid authorization header', 401));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; email: string };
    const user = await User.findById(payload.sub).select('_id email name status');
    if (!user || user.status !== 'active') {
      return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'User session invalid or inactive', 401));
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Access token expired', 401));
    }
    return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Invalid access token', 401));
  }
}

export async function requireWorkspace(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Authentication required', 401));
  }

  const rawParamWs = req.params ? (Array.isArray(req.params.workspaceId) ? req.params.workspaceId[0] : req.params.workspaceId) : undefined;
  const rawQueryWs = req.query ? (Array.isArray(req.query.workspaceId) ? req.query.workspaceId[0] : req.query.workspaceId) : undefined;
  const rawHeaderWs = req.headers['x-workspace-id'];

  const requestedWorkspaceId =
    (typeof rawHeaderWs === 'string' ? rawHeaderWs : undefined) ||
    (typeof rawQueryWs === 'string' ? rawQueryWs : undefined) ||
    (typeof rawParamWs === 'string' ? rawParamWs : undefined);

  let member = null;

  if (requestedWorkspaceId && mongoose.isValidObjectId(requestedWorkspaceId)) {
    member = await WorkspaceMember.findOne({
      workspaceId: new mongoose.Types.ObjectId(requestedWorkspaceId),
      userId: new mongoose.Types.ObjectId(req.user.id),
      status: 'active',
    });
  } else {
    // Fall back to first active workspace of user
    member = await WorkspaceMember.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      status: 'active',
    });
  }

  if (!member) {
    // RBAC-008: return safe 404 for cross-workspace resources to prevent enumeration
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Workspace not found or access denied', 404));
  }

  req.workspaceId = member.workspaceId.toString();
  req.userRole = member.role;
  next();
}

export function requireRole(allowedRoles: WorkspaceRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return next(
        new AppError(ERROR_CODES.FORBIDDEN, 'Insufficient permissions to perform this action', 403)
      );
    }
    next();
  };
}
