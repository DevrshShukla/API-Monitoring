import { connectDB, disconnectDB } from './config/db.js';
import { getRedisConnection, closeRedisConnection } from './config/redis.js';
import { startScheduler, stopScheduler } from './queues/scheduler.js';
import { logger } from './config/logger.js';

async function main() {
  logger.info('Starting standalone Scheduler process...');
  await connectDB();
  getRedisConnection();

  startScheduler(5000);

  const shutdown = async (signal: string) => {
    logger.info(`Scheduler received ${signal}. Shutting down...`);
    stopScheduler();
    await disconnectDB();
    await closeRedisConnection();
    logger.info('Scheduler process shut down cleanly');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Scheduler fatal error:', { error: err });
  process.exit(1);
});
