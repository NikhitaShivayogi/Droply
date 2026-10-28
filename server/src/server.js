import 'dotenv/config';
import mongoose from 'mongoose';
import { Worker } from 'bullmq';
import { DeleteObjectsCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import Drop from './models/Drop.js';
import DropFile from './models/DropFile.js';
import { createApp } from './app.js';
import { getStorage } from './config/storage.js';
import { initializeCleanupQueue, scheduleDropCleanup } from './jobs/queue.js';

const required = ['MONGODB_URI', 'REDIS_URL', 'CODE_PEPPER', 'MANAGEMENT_PEPPER'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

async function removeDrop(dropId) {
  const files = await DropFile.find({ dropId }).lean();
  if (files.length && process.env.S3_BUCKET) {
    const { client, bucket } = getStorage();
    for (const file of files) {
      if (file.uploadId) {
        await client.send(new AbortMultipartUploadCommand({
          Bucket: bucket, Key: file.objectKey, UploadId: file.uploadId
        })).catch((error) => {
          if (error.name !== 'NoSuchUpload') throw error;
        });
      }
    }
    await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: files.map((file) => ({ Key: file.objectKey })), Quiet: true }
    }));
  }
  await DropFile.deleteMany({ dropId });
}

const { connection, cleanupQueue } = initializeCleanupQueue();
const { httpServer, io } = createApp();
const worker = new Worker('drop-cleanup', async (job) => {
  const drop = await Drop.findById(job.data.dropId);
  if (!drop) return;
  if (drop.status !== 'deleted' && drop.expiresAt > new Date()) {
    await scheduleDropCleanup(drop.id, {
      delay: drop.expiresAt.getTime() - Date.now(),
      jobId: `drop-${drop.id}-recheck-${Math.floor(Date.now() / 1000)}`
    });
    return;
  }
  await removeDrop(drop.id);
  io.to(`drop:${drop.id}`).emit('drop:unavailable', { id: drop.id, reason: drop.status === 'deleted' ? 'deleted' : 'expired' });
  await Drop.deleteOne({ _id: drop._id });
}, { connection });

await mongoose.connect(process.env.MONGODB_URI);
await Promise.all([Drop.init(), DropFile.init()]);
await connection.ping();
await cleanupQueue.waitUntilReady();
httpServer.listen(Number(process.env.PORT || 4000), () => {
  console.log(`Droply API listening on port ${process.env.PORT || 4000}`);
});

for (const drop of await Drop.find({ status: { $in: ['ready', 'uploading', 'deleted'] } }).select('_id expiresAt status').lean()) {
  await scheduleDropCleanup(String(drop._id), {
    delay: drop.status === 'deleted' ? 0 : Math.max(0, drop.expiresAt.getTime() - Date.now()),
    jobId: `drop-${drop._id}`
  });
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await new Promise((resolve) => io.close(resolve));
  await worker.close();
  await cleanupQueue.close();
  await connection.quit();
  await mongoose.disconnect();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
