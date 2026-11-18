import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { WorkspaceMember } from '../db/WorkspaceMember.js';
import mongoose from 'mongoose';

let io: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });

  const workspaceNamespace = io.of('/workspace');

  workspaceNamespace.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      const workspaceId = socket.handshake.auth?.workspaceId || socket.handshake.query?.workspaceId;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) {
        return next(new Error('Valid workspaceId required'));
      }

      const payload = jwt.verify(token as string, env.JWT_ACCESS_SECRET) as { sub: string };

      const member = await WorkspaceMember.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId as string),
        userId: new mongoose.Types.ObjectId(payload.sub),
        status: 'active',
      });

      if (!member) {
        return next(new Error('Access to workspace denied'));
      }

      (socket as any).userId = payload.sub;
      (socket as any).workspaceId = workspaceId;
      next();
    } catch (err: any) {
      logger.warn('Socket handshake authentication failed:', { error: err.message });
      next(new Error('Authentication failed'));
    }
  });

  workspaceNamespace.on('connection', (socket: Socket) => {
    const workspaceId = (socket as any).workspaceId;
    const roomName = `workspace:${workspaceId}`;
    socket.join(roomName);
    logger.debug(`Socket joined room: ${roomName}`);

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected from ${roomName}`);
    });
  });

  logger.info('Socket.IO initialized on namespace /workspace');
  return io;
}

export function emitToWorkspace(workspaceId: string, event: string, payload: unknown): void {
  if (!io) return;
  try {
    io.of('/workspace').to(`workspace:${workspaceId}`).emit(event, payload);
  } catch (err: any) {
    logger.warn(`Failed to emit socket event ${event}:`, { error: err.message });
  }
}
