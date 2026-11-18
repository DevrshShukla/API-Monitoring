import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';

export const CHECK_QUEUE_NAME = 'monitor-checks';
export const NOTIFICATION_QUEUE_NAME = 'notifications';

let checkQueueInstance: Queue | null = null;
let notificationQueueInstance: Queue | null = null;

export function getCheckQueue(): Queue {
  if (!checkQueueInstance) {
    checkQueueInstance = new Queue(CHECK_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return checkQueueInstance;
}

export function getNotificationQueue(): Queue {
  if (!notificationQueueInstance) {
    notificationQueueInstance = new Queue(NOTIFICATION_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return notificationQueueInstance;
}
