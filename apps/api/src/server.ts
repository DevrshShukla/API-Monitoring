import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import { getRedisConnection, closeRedisConnection } from './config/redis.js';
import { requestCorrelation } from './middleware/requestCorrelation.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initSocketIO } from './realtime/socket.js';

// Route imports
import { authRoutes } from './modules/auth/authRoutes.js';
import { workspaceRoutes } from './modules/workspaces/workspaceRoutes.js';
import { monitorRoutes } from './modules/monitors/monitorRoutes.js';
import { analyticsRoutes } from './modules/analytics/analyticsRoutes.js';
import { incidentRoutes } from './modules/incidents/incidentRoutes.js';
import { alertRoutes } from './modules/alerts/alertRoutes.js';
import { notificationRoutes } from './modules/notifications/notificationRoutes.js';
import { auditRoutes } from './modules/audit/auditRoutes.js';

// Worker & Scheduler (for standalone dev mode)
import { startMonitorWorker } from './queues/monitorWorker.js';
import { startScheduler, stopScheduler } from './queues/scheduler.js';

export function createApp(): express.Application {
  const app = express();

  // Security & Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Workspace-Id'],
      exposedHeaders: ['X-Request-Id'],
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestCorrelation);

  // Request logger
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        requestId: (req as any).requestId,
      });
    });
    next();
  });

  // Health check probes
  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (_req, res) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    let redisStatus = 'disconnected';
    try {
      const pong = await getRedisConnection().ping();
      redisStatus = pong === 'PONG' ? 'connected' : 'degraded';
    } catch {
      redisStatus = 'disconnected';
    }

    const isHealthy = mongoStatus === 'connected';
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      dependencies: {
        mongodb: mongoStatus,
        redis: redisStatus,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // API v1 Routes
  const apiRouter = express.Router();
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/workspaces', workspaceRoutes);
  apiRouter.use('/monitors', monitorRoutes);
  apiRouter.use('/analytics', analyticsRoutes);
  apiRouter.use('/incidents', incidentRoutes);
  apiRouter.use('/alert-rules', alertRoutes);
  apiRouter.use('/notifications', notificationRoutes);
  apiRouter.use('/audit', auditRoutes);

  app.use('/api/v1', apiRouter);

  // Error handling middleware
  app.use(errorHandler);

  return app;
}

export async function startServer(): Promise<{ app: express.Application; server: http.Server }> {
  await connectDB();
  getRedisConnection();

  const app = createApp();
  const server = http.createServer(app);

  initSocketIO(server);

  // If in development mode, start worker and scheduler alongside API for convenience
  if (env.NODE_ENV === 'development') {
    try {
      startMonitorWorker();
      startScheduler(5000);
      logger.info('Started background monitor worker and scheduler in unified dev process');
    } catch (err: any) {
      logger.warn('Could not start worker/scheduler in-process (ensure Redis is running):', {
        error: err.message,
      });
    }
  }

  server.listen(env.PORT, () => {
    logger.info(`API Monitoring Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    stopScheduler();
    server.close(async () => {
      await disconnectDB();
      await closeRedisConnection();
      logger.info('Server closed cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return { app, server };
}

// Direct execution
if (process.argv[1] && process.argv[1].endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  startServer().catch((err) => {
    logger.error('Failed to start server:', { error: err });
    process.exit(1);
  });
}
