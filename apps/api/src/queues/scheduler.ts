import { Monitor } from '../db/Monitor.js';
import { getCheckQueue } from './queue.js';
import { logger } from '../config/logger.js';

let schedulerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

export async function processDueMonitors(): Promise<number> {
  if (isProcessing) {
    logger.debug('Scheduler tick already in progress, skipping tick.');
    return 0;
  }

  isProcessing = true;
  try {
    const now = new Date();
    // Query active monitors that are due
    const dueMonitors = await Monitor.find({
      active: true,
      deletedAt: null,
      nextRunAt: { $lte: now },
    })
      .sort({ nextRunAt: 1 })
      .limit(100);

    if (dueMonitors.length === 0) {
      return 0;
    }

    const queue = getCheckQueue();
    let enqueuedCount = 0;

    for (const monitor of dueMonitors) {
      const scheduledMinute = Math.floor(now.getTime() / 60000);
      const jobId = `check:${monitor._id.toString()}:${scheduledMinute}`;

      // Bump nextRunAt temporarily to prevent double picking on next tick
      const temporaryNextRun = new Date(now.getTime() + monitor.intervalSeconds * 1000);
      await Monitor.updateOne(
        { _id: monitor._id, nextRunAt: monitor.nextRunAt },
        { nextRunAt: temporaryNextRun }
      );

      try {
        await queue.add(
          'check',
          {
            monitorId: monitor._id.toString(),
            scheduledAt: now.toISOString(),
          },
          {
            jobId,
          }
        );
        enqueuedCount++;
      } catch (err: any) {
        // BullMQ deduplicates if jobId already exists in queue
        logger.debug(`Job ${jobId} already queued or failed to enqueue: ${err.message}`);
      }
    }

    logger.debug(`Scheduler enqueued ${enqueuedCount} check jobs for ${dueMonitors.length} due monitors`);
    return enqueuedCount;
  } catch (error: any) {
    logger.error('Error in scheduler processDueMonitors:', { error: error.message });
    return 0;
  } finally {
    isProcessing = false;
  }
}

export function startScheduler(intervalMs: number = 5000): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  logger.info(`Starting scheduler loop with interval ${intervalMs}ms`);
  schedulerInterval = setInterval(async () => {
    await processDueMonitors();
  }, intervalMs);

  // Run initial tick immediately
  processDueMonitors().catch((err) => {
    logger.warn('Initial scheduler tick encountered error:', { error: err.message });
  });
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Scheduler stopped');
  }
}
