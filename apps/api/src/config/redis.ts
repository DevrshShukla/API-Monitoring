import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

let redisInstance: Redis | null = null;

export function getRedisConnection(): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  redisInstance = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
    reconnectOnError(err) {
      logger.warn('Redis reconnect on error:', { error: err.message });
      return true;
    },
  });

  redisInstance.on('connect', () => {
    logger.info('Redis connection established');
  });

  let lastWarnTime = 0;
  redisInstance.on('error', (err) => {
    const now = Date.now();
    if (now - lastWarnTime > 30000) {
      logger.warn('Redis unavailable (standalone dev mode or connecting):', { message: err.message });
      lastWarnTime = now;
    }
  });

  return redisInstance;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit().catch(() => {});
    redisInstance = null;
  }
}
