import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import Busboy from 'busboy';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import Drop from '../models/Drop.js';
import DropFile from '../models/DropFile.js';
import AbuseReport from '../models/AbuseReport.js';
import DownloadEvent from '../models/DownloadEvent.js';
import { getStorage, storageConfigured } from '../config/storage.js';
import { scheduleDropCleanup } from '../jobs/queue.js';
import { createAccessCode, createManagementSecret, hashCode, hashManagementSecret, managementSecretMatches } from '../utils/secrets.js';
import { httpError } from '../middleware/errors.js';
import rateLimit from 'express-rate-limit';

const api = Router();
const userCodeSchema = z.string().trim().min(4).max(24);
const accessCodeSchema = z.string().trim().min(8).max(24).transform((value) => value.replace(/[\s-]/g, '').toUpperCase());
const fileSchema = z.object({
  name: z.string().trim().min(1).max(255).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'Filename contains invalid characters.'),
  type: z.string().trim().min(1).max(255),
  size: z.number().int().positive()
});
const expiration = { '10m': 10, '1h': 60, '24h': 1440, '7d': 10080 };
const allowedPreviews = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
  'video/mp4', 'video/webm', 'application/pdf'
]);
const maxFileBytes = Number(process.env.MAX_FILE_BYTES || 104857600);
const maxDropBytes = Number(process.env.MAX_DROP_BYTES || 524288000);
const maxFiles = Number(process.env.MAX_FILES_PER_DROP || 20);
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const createLimiter = rateLimit({ windowMs: 60_000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false });
const lookupLimiter = rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });
const reportLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false });

api.param('id', (req, res, next, id) => {
  if (!/^[a-f\d]{24}$/i.test(id)) return res.status(404).json({ error: { code: 'DROP_UNAVAILABLE', message: 'This Drop is unavailable or has expired.' } });
  next();
});

api.param('fileId', (req, res, next, id) => {
  if (!/^[a-f\d]{24}$/i.test(id)) return res.status(404).json({ error: { code: 'FILE_UNAVAILABLE', message: 'This file is unavailable.' } });
  next();
});

function assertNotExpired(drop) {
  if (!drop || drop.status !== 'ready' || drop.expiresAt <= new Date()) {
    throw httpError(404, 'DROP_UNAVAILABLE', 'This Drop is unavailable or has expired.');
  }
}

function assertAvailable(drop) {
  assertNotExpired(drop);
  if (drop.downloadLimit !== null && drop.downloadCount + drop.activeDownloads >= drop.downloadLimit) {
    throw httpError(410, 'DROP_EXHAUSTED', 'This Drop has reached its download limit.');
  }
}

function requireManagement(req, drop) {
  const secret = req.get('X-Management-Secret');
  if (!managementSecretMatches(secret, drop.managementHash)) {
    throw httpError(401, 'UNAUTHORIZED', 'A valid management capability is required.');
  }
}

function requireAccessCode(req, drop) {
  const rawCode = req.get('X-Drop-Code');
  if (!rawCode) throw httpError(404, 'DROP_UNAVAILABLE', 'This Drop is unavailable or has expired.');
  let code;
  try {
    code = accessCodeSchema.parse(rawCode);
  } catch {
    throw httpError(404, 'DROP_UNAVAILABLE', 'This Drop is unavailable or has expired.');
  }
  if (drop.codeHash !== hashCode(code)) {
    throw httpError(404, 'DROP_UNAVAILABLE', 'This Drop is unavailable or has expired.');
  }
}

function safeFileName(name) {
  return name.replace(/[\\/"\r\n]/g, '_').replace(/[^\x20-\x7e]/g, '_').slice(0, 180) || 'download';
}

function publicDrop(drop, files) {
  return {
    id: String(drop._id),
    title: drop.title,
    text: drop.text,
    status: drop.status,
    createdAt: drop.createdAt,
    expiresAt: drop.expiresAt,
    downloadLimit: drop.downloadLimit,
    downloadCount: drop.downloadCount,
    fileCount: drop.fileCount,
    totalSize: drop.totalSize,
    files: files.map((file) => ({
      id: String(file._id),
      name: file.name,
      type: file.contentType,
      size: file.size,
      previewable: allowedPreviews.has(file.contentType),
      status: file.status
    }))
  };
}

api.post('/drops', createLimiter, wrap(async (req, res) => {
  const body = z.object({
    title: z.string().trim().max(120).optional().default(''),
    text: z.string().max(100000).optional().default(''),
    code: userCodeSchema.optional(),
    expiry: z.enum(['10m', '1h', '24h', '7d']).default('24h'),
    downloadLimit: z.number().int().min(1).max(10000).nullable().optional().default(null),
    files: z.array(fileSchema).max(maxFiles).default([])
  }).parse(req.body);

  // Allow either text OR files (or both)
  // This check is now just checking if we have ANY content
  const hasContent = body.text.trim().length > 0 || body.files.length > 0;
  if (!hasContent) {
    throw httpError(400, 'EMPTY_DROP', 'Add some text or at least one file to create a Drop.');
  }
  if (body.files.some((file) => file.size > maxFileBytes)) {
    throw httpError(413, 'FILE_TOO_LARGE', `Each file must be no larger than ${maxFileBytes} bytes.`);
  }
  const totalSize = body.files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > maxDropBytes) throw httpError(413, 'DROP_TOO_LARGE', 'The combined files exceed the Drop size limit.');
  if (body.files.length && !storageConfigured()) {
    throw httpError(503, 'STORAGE_UNAVAILABLE', 'File sharing is not configured on this server yet.');
  }

  let code;
  let drop;
  const managementSecret = createManagementSecret();
  
  // If user provided a code, check if it's already in use (active/not expired)
  if (body.code) {
    const existingDrop = await Drop.findOne({ 
      codeHash: hashCode(body.code),
      status: 'ready',
      expiresAt: { $gt: new Date() } // Only if not expired
    });
    
    if (existingDrop) {
      throw httpError(409, 'CODE_IN_USE', 'This code is already in use. Please choose a different code.');
    }
  }
  
  for (let attempt = 0; attempt < 4; attempt += 1) {
    code = body.code || createAccessCode();
    try {
      drop = await Drop.create({
        codeHash: hashCode(code),
        managementHash: hashManagementSecret(managementSecret),
        title: body.title,
        text: body.text,
        status: 'ready',
        expiresAt: new Date(Date.now() + expiration[body.expiry] * 60_000),
        downloadLimit: body.downloadLimit,
        totalSize,
        fileCount: body.files.length
      });
      break;
    } catch (error) {
      if (error.code !== 11000 || attempt === 3) throw error;
    }
  }

  await scheduleDropCleanup(drop.id, {
    delay: Math.max(0, drop.expiresAt.getTime() - Date.now()),
    jobId: `drop-${drop.id}`
  });
  
  res.status(201).json({
    ...publicDrop(drop, []),
    code,
    managementSecret
  });
}));

// Simple file upload endpoint for the frontend
api.post('/drops/:id/files', wrap(async (req, res) => {
  const drop = await Drop.findById(req.params.id);
  if (!drop || drop.status === 'deleted' || drop.expiresAt <= new Date()) {
    throw httpError(404, 'DROP_UNAVAILABLE', 'This Drop is unavailable.');
  }
  
  if (!req.headers['content-type']?.startsWith('multipart/form-data')) {
    throw httpError(400, 'INVALID_REQUEST', 'Files must be sent as multipart form data.');
  }

  let fileName = 'file';
  let fileType = 'application/octet-stream';
  let fileBuffer = null;
  
  // Use busboy for proper multipart parsing
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });
    
    bb.on('file', (fieldname, file, info) => {
      fileName = info.filename;
      fileType = info.mimeType || 'application/octet-stream';
      
      const chunks = [];
      file.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });
    
    bb.on('close', async () => {
      try {
        if (!fileBuffer) {
          throw httpError(400, 'INVALID_REQUEST', 'No file data received.');
        }
        
        const fileSize = fileBuffer.length;
        if (fileSize > maxFileBytes) {
          throw httpError(413, 'FILE_TOO_LARGE', `File must be no larger than ${maxFileBytes} bytes.`);
        }

        console.log(`File upload: ${fileName} (${fileSize} bytes, type: ${fileType})`);

        // Store file in memory
        const file = await DropFile.create({
          dropId: drop._id,
          objectKey: `memory://${drop.id}/${randomUUID()}`,
          name: fileName,
          contentType: fileType,
          size: fileSize,
          status: 'ready',
          uploadId: null,
          fileData: fileBuffer
        });

        res.status(201).json({
          id: String(file._id),
          name: file.name,
          type: file.contentType,
          size: file.size,
          previewable: allowedPreviews.has(fileType)
        });
      } catch (err) {
        if (res.headersSent) return;
        if (err.status) {
          res.status(err.status).json({ error: { code: err.code, message: err.message } });
        } else {
          console.error('File upload error:', err);
          res.status(500).json({ error: { code: 'UPLOAD_ERROR', message: 'File upload failed.' } });
        }
      }
    });
    
    bb.on('error', (err) => {
      reject(err);
    });
    
    req.pipe(bb);
  });
}));

api.post('/drops/:id/files/:fileId/part-url', wrap(async (req, res) => {
  const { partNumber } = z.object({ partNumber: z.number().int().min(1).max(10000) }).parse(req.body);
  const drop = await Drop.findById(req.params.id);
  if (!drop || drop.status !== 'uploading' || drop.expiresAt <= new Date()) throw httpError(404, 'DROP_UNAVAILABLE', 'This Drop is unavailable.');
  requireManagement(req, drop);
  const file = await DropFile.findOne({ _id: req.params.fileId, dropId: drop._id, status: 'uploading' });
  if (!file?.uploadId) throw httpError(404, 'FILE_UNAVAILABLE', 'This upload is unavailable.');
  const { client, bucket } = getStorage();
  const url = await getSignedUrl(client, new UploadPartCommand({
    Bucket: bucket, Key: file.objectKey, UploadId: file.uploadId, PartNumber: partNumber
  }), { expiresIn: 900 });
  res.json({ url, expiresIn: 900 });
}));

api.post('/drops/:id/files/:fileId/complete', wrap(async (req, res) => {
  const { parts } = z.object({
    parts: z.array(z.object({
      ETag: z.string().min(1).max(512),
      PartNumber: z.number().int().min(1).max(10000)
    })).min(1).max(10000)
  }).parse(req.body);
  const drop = await Drop.findById(req.params.id);
  if (!drop || drop.status !== 'uploading' || drop.expiresAt <= new Date()) throw httpError(404, 'DROP_UNAVAILABLE', 'This Drop is unavailable.');
  requireManagement(req, drop);
  const file = await DropFile.findOne({ _id: req.params.fileId, dropId: drop._id, status: 'uploading' });
  if (!file?.uploadId) throw httpError(404, 'FILE_UNAVAILABLE', 'This upload is unavailable.');
  const orderedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
  if (orderedParts.some((part, index) => part.PartNumber !== index + 1)) {
    throw httpError(400, 'INVALID_PARTS', 'Upload parts must be complete and numbered consecutively.');
  }
  const { client, bucket } = getStorage();
  await client.send(new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: file.objectKey,
    UploadId: file.uploadId,
    MultipartUpload: { Parts: orderedParts }
  }));
  const metadata = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: file.objectKey }));
  if (metadata.ContentLength !== file.size || metadata.Metadata?.['drop-id'] !== drop.id) {
    await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: file.objectKey, UploadId: file.uploadId })).catch(() => {});
    file.status = 'failed';
    await file.save();
    throw httpError(422, 'UPLOAD_VALIDATION_FAILED', 'The uploaded file did not match its expected metadata.');
  }
  file.status = 'ready';
  file.uploadId = '';
  file.checksum = metadata.ChecksumSHA256 || metadata.ETag || '';
  await file.save();
  const pending = await DropFile.countDocuments({ dropId: drop._id, status: { $ne: 'ready' } });
  if (pending === 0) {
    const readyDrop = await Drop.findOneAndUpdate({
      _id: drop._id, status: 'uploading', expiresAt: { $gt: new Date() }
    }, { $set: { status: 'ready' } }, { new: true });
    if (readyDrop) req.app.get('io').to(`drop:${drop.id}`).emit('drop:ready', { id: drop.id, status: 'ready' });
  } else {
    req.app.get('io').to(`drop:${drop.id}`).emit('drop:progress', { completed: drop.fileCount - pending, total: drop.fileCount });
  }
  res.json({ status: drop.status, completed: drop.fileCount - pending, total: drop.fileCount });
}));

api.post('/drops/:id/files/:fileId/abort', wrap(async (req, res) => {
  const drop = await Drop.findById(req.params.id);
  if (!drop || drop.status !== 'uploading') throw httpError(404, 'DROP_UNAVAILABLE', 'This upload is unavailable.');
  requireManagement(req, drop);
  const file = await DropFile.findOne({ _id: req.params.fileId, dropId: drop._id, status: 'uploading' });
  if (!file) return res.status(204).end();
  const { client, bucket } = getStorage();
  await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: file.objectKey, UploadId: file.uploadId }));
  file.status = 'failed';
  await file.save();
  drop.status = 'deleted';
  await drop.save();
  await scheduleDropCleanup(drop.id, { jobId: `drop-${drop.id}-aborted` });
  res.status(202).json({ status: 'aborted' });
}));

api.post('/drops/:id/abort', wrap(async (req, res) => {
  const drop = await Drop.findById(req.params.id);
  if (!drop || drop.status !== 'uploading') return res.status(204).end();
  requireManagement(req, drop);
  drop.status = 'deleted';
  await drop.save();
  await scheduleDropCleanup(drop.id, { jobId: `drop-${drop.id}-aborted` });
  res.status(202).json({ status: 'aborted' });
}));

api.post('/drops/resolve', lookupLimiter, wrap(async (req, res) => {
  const { code } = z.object({ code: userCodeSchema }).parse(req.body);
  
  // Check if drop exists at all
  const drop = await Drop.findOne({ codeHash: hashCode(code) });
  
  if (!drop) {
    // Drop doesn't exist
    throw httpError(404, 'DROP_NOT_FOUND', 'No drop found with this code. Please check and try again.');
  }
  
  if (drop.status === 'deleted') {
    throw httpError(404, 'DROP_DELETED', 'This drop was deleted.');
  }
  
  if (drop.expiresAt <= new Date()) {
    // Drop is expired
    throw httpError(410, 'DROP_EXPIRED', 'This drop has expired and is no longer available.');
  }
  
  if (drop.downloadLimit !== null && drop.downloadCount + drop.activeDownloads >= drop.downloadLimit) {
    throw httpError(410, 'DROP_EXHAUSTED', 'This Drop has reached its download limit.');
  }
  
  const files = await DropFile.find({ dropId: drop._id, status: 'ready' }).sort({ createdAt: 1 });
  res.json(publicDrop(drop, files));
}));

api.get('/drops/:id/status', wrap(async (req, res) => {
  const drop = await Drop.findById(req.params.id);
  assertNotExpired(drop);
  requireAccessCode(req, drop);
  res.json({
    status: drop.status,
    expiresAt: drop.expiresAt,
    fileCount: drop.fileCount,
    completedDownloads: drop.downloadCount,
    remainingDownloads: drop.downloadLimit === null ? null : Math.max(0, drop.downloadLimit - drop.downloadCount)
  });
}));

api.post('/drops/:id/files/:fileId/preview', wrap(async (req, res) => {
  const drop = await Drop.findById(req.params.id);
  assertNotExpired(drop);
  requireAccessCode(req, drop);
  if (drop.downloadLimit !== null && drop.downloadCount + drop.activeDownloads >= drop.downloadLimit) {
    throw httpError(410, 'DROP_EXHAUSTED', 'This Drop has reached its download limit.');
  }
  const file = await DropFile.findOne({ _id: req.params.fileId, dropId: drop._id, status: 'ready' });
  if (!file || !allowedPreviews.has(file.contentType)) throw httpError(404, 'FILE_UNAVAILABLE', 'Preview unavailable.');
  const { client, bucket } = getStorage();
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: file.objectKey }));
  res.set({
    'Content-Type': file.contentType,
    'Content-Length': String(file.size),
    'Content-Disposition': `inline; filename="${safeFileName(file.name)}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; sandbox"
  });
  object.Body.pipe(res);
}));

api.get('/drops/:id/files/:fileId/download', wrap(async (req, res) => {
  const { code } = req.query;
  
  // Get access code from either query param or header
  const accessCode = code || req.get('X-Drop-Code');
  if (!accessCode) {
    throw httpError(404, 'DROP_UNAVAILABLE', 'This page or Drop is unavailable.');
  }
  
  // Parse and validate the code
  let parsedCode;
  try {
    parsedCode = userCodeSchema.parse(accessCode);
  } catch {
    throw httpError(404, 'DROP_UNAVAILABLE', 'This page or Drop is unavailable.');
  }
  
  const drop = await Drop.findOneAndUpdate({
    codeHash: hashCode(parsedCode),
    status: 'ready',
    expiresAt: { $gt: new Date() },
    $or: [
      { downloadLimit: null },
      { $expr: { $lt: [{ $add: ['$downloadCount', '$activeDownloads'] }, '$downloadLimit'] } }
    ]
  }, { $inc: { activeDownloads: 1 } }, { new: true });
  
  if (!drop) {
    throw httpError(404, 'DROP_UNAVAILABLE', 'This page or Drop is unavailable.');
  }
  
  const file = await DropFile.findOne({ _id: req.params.fileId, dropId: drop._id, status: 'ready' });
  if (!file) {
    await Drop.updateOne({ _id: drop._id }, { $inc: { activeDownloads: -1 } });
    throw httpError(404, 'FILE_UNAVAILABLE', 'This file is unavailable.');
  }
  
  let settled = false;
  const finish = async (success) => {
    if (settled) return;
    settled = true;
    await Drop.updateOne({ _id: drop._id }, success
      ? { $inc: { activeDownloads: -1, downloadCount: 1 } }
      : { $inc: { activeDownloads: -1 } });
    await DownloadEvent.create({
      dropId: drop._id,
      fileId: file._id,
      outcome: success ? 'completed' : 'interrupted'
    });
  };
  
  try {
    // Handle memory-stored files (for development)
    if (file.objectKey?.startsWith('memory://')) {
      res.set({
        'Content-Type': file.contentType,
        'Content-Length': String(file.size),
        'Content-Disposition': `attachment; filename="${safeFileName(file.name)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store'
      });
      res.once('finish', () => { void finish(true).catch((error) => console.error('Download completion tracking failed:', error)); });
      res.once('close', () => {
        if (!res.writableFinished) void finish(false).catch((error) => console.error('Download interruption tracking failed:', error));
      });
      res.end(file.fileData);
    } else {
      // Handle S3-stored files
      const { client, bucket } = getStorage();
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: file.objectKey }));
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(file.size),
        'Content-Disposition': `attachment; filename="${safeFileName(file.name)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store'
      });
      res.once('finish', () => { void finish(true).catch((error) => console.error('Download completion tracking failed:', error)); });
      res.once('close', () => {
        if (!res.writableFinished) void finish(false).catch((error) => console.error('Download interruption tracking failed:', error));
      });
      object.Body.once('error', () => {
        void finish(false).catch((error) => console.error('Download interruption tracking failed:', error));
        if (!res.headersSent) res.status(502).end();
        else res.destroy();
      });
      object.Body.pipe(res);
    }
  } catch (error) {
    await finish(false);
    throw error;
  }
}));

api.delete('/drops/:id', wrap(async (req, res) => {
  const secret = req.get('X-Management-Secret');
  if (!secret || !/^[A-Za-z0-9_-]{32,100}$/.test(secret)) {
    throw httpError(401, 'UNAUTHORIZED', 'A valid management capability is required.');
  }
  const drop = await Drop.findById(req.params.id);
  if (!drop || !managementSecretMatches(secret, drop.managementHash) || drop.status === 'deleted') {
    throw httpError(404, 'DROP_UNAVAILABLE', 'This Drop is unavailable.');
  }
  drop.status = 'deleted';
  await drop.save();
  req.app.get('io').to(`drop:${drop.id}`).emit('drop:unavailable', { id: drop.id, reason: 'deleted' });
  await scheduleDropCleanup(drop.id, { jobId: `drop-${drop.id}-deleted` });
  res.status(202).json({ status: 'deleted' });
}));

api.post('/reports', reportLimiter, wrap(async (req, res) => {
  const body = z.object({
    code: z.string().trim().max(24).optional(),
    category: z.enum(['copyright', 'malware', 'abuse', 'other']),
    description: z.string().trim().min(10).max(4000),
    email: z.string().email().max(254).optional().or(z.literal(''))
  }).parse(req.body);
  let dropId = null;
  if (body.code) {
    const drop = await Drop.findOne({ codeHash: hashCode(body.code.replace(/[\s-]/g, '').toUpperCase()) }).select('_id').lean();
    dropId = drop?._id || null;
  }
  const report = await AbuseReport.create({
    dropId, category: body.category, description: body.description, email: body.email || ''
  });
  res.status(201).json({ id: String(report._id), status: 'received' });
}));

export default api;
