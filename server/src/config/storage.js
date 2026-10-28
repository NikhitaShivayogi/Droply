import { S3Client } from '@aws-sdk/client-s3';

const required = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];

export function storageConfigured() {
  return required.every((key) => Boolean(process.env[key]));
}

export function getStorage() {
  if (!storageConfigured()) {
    throw new Error('Object storage is not configured. Set the S3-compatible storage environment variables.');
  }

  return {
    bucket: process.env.S3_BUCKET,
    client: new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
      }
    })
  };
}
