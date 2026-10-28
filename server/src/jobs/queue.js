import 'dotenv/config';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';

let connection;
let cleanupQueue;

export function initializeCleanupQueue() {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    cleanupQueue = new Queue('drop-cleanup', { connection });
  }
  return { connection, cleanupQueue };
}

export async function scheduleDropCleanup(dropId, options = {}) {
  if (!cleanupQueue) throw new Error('Cleanup queue has not been initialized.');
  return cleanupQueue.add('expire-drop', { dropId }, {
    attempts: 8,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    ...options
  });
}
