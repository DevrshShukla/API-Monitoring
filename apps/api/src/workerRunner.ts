import { connectDB, disconnectDB } from './config/db.js';
import { getRedisConnection, closeRedisConnection } from './config/redis.js';
import { startMonitorWorker } from './queues/monitorWorker.js';
import { logger } from './config/logger.js';

async function main() {
  logger.info('Starting standalone Monitor Worker process...');
  await connectDB();
  getRedisConnection();

  const worker = startMonitorWorker();

  const shutdown = async (signal: string) => {
    logger.info(`Worker received ${signal}. Shutting down...`);
    await worker.close();
    await disconnectDB();
    await closeRedisConnection();
    logger.info('Monitor Worker shut down cleanly');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Monitor Worker fatal error:', { error: err });
  process.exit(1);
});
