import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { db, storage } from './clients.js';
import { env } from './config.js';
import { asyncRoute } from './http.js';

const documentTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
} as const;
const maxDocumentSize = 10 * 1024 * 1024;

export const kyc = Router();

kyc.post('/documents', express.raw({
  type: Object.keys(documentTypes),
  limit: maxDocumentSize,
}), asyncRoute(async (req, res) => {
  const contentType = req.headers['content-type']?.split(';')[0]?.trim() as keyof typeof documentTypes;
  const extension = documentTypes[contentType];
  if (!extension) {
    return res.status(415).json({ message: 'Dokumentet må være JPEG, PNG, WebP eller PDF.' });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ message: 'Dokumentet er tomt eller mangler.' });
  }
  if (!matchesContentType(req.body, contentType)) {
    return res.status(415).json({ message: 'Filinnholdet samsvarer ikke med filtypen.' });
  }

  const key = `kyc/${req.userId!}/${randomUUID()}.${extension}`;
  await storage.send(new PutObjectCommand({
    Bucket: env.NEON_STORAGE_BUCKET,
    Key: key,
    Body: req.body,
    ContentLength: req.body.length,
    ContentType: contentType,
    Metadata: { user_id: req.userId! },
  }));
  res.status(201).json({ path: key, contentType, size: req.body.length });
}));

kyc.post('/submissions', asyncRoute(async (req, res) => {
  const documents = Array.isArray(req.body?.documents) ? req.body.documents : [];
  if (!documents.length || documents.length > 10) {
    return res.status(400).json({ message: 'Send mellom 1 og 10 dokumenter.' });
  }

  const userPrefix = `kyc/${req.userId!}/`;
  const validPath = /^kyc\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i;
  for (const document of documents) {
    if (
      typeof document?.path !== 'string'
      || !document.path.startsWith(userPrefix)
      || !validPath.test(document.path)
    ) {
      return res.status(400).json({ message: 'Dokumentreferanse er ugyldig.' });
    }
    try {
      const result = await storage.send(new HeadObjectCommand({
        Bucket: env.NEON_STORAGE_BUCKET,
        Key: document.path,
      }));
      if (result.Metadata?.user_id !== req.userId) {
        return res.status(400).json({ message: 'Dokumentreferanse er ugyldig.' });
      }
    } catch (error) {
      if (isObjectNotFound(error)) {
        return res.status(400).json({ message: 'Dokumentreferanse er ugyldig.' });
      }
      throw error;
    }
  }

  const [submission] = await db`
    INSERT INTO phone.kyc_submissions (user_id, status, documents, created_at, updated_at)
    VALUES (
      ${req.userId!},
      'pending',
      ${JSON.stringify(documents)}::jsonb,
      now(),
      now()
    )
    RETURNING id, status, documents, created_at AS submitted_at
  `;
  res.status(201).json({ submission });
}));

kyc.get('/status', asyncRoute(async (req, res) => {
  const submissions = await db`
    SELECT id, status, documents, created_at AS submitted_at,
           CASE WHEN status <> 'pending' THEN updated_at END AS reviewed_at
    FROM phone.kyc_submissions
    WHERE user_id = ${req.userId!}
    ORDER BY created_at DESC
    LIMIT 20
  `;
  res.json({ submissions });
}));

kyc.get('/admin/submissions', requireAdmin, asyncRoute(async (_req, res) => {
  const submissions = await db`
    SELECT id, user_id, status, documents, created_at AS submitted_at
    FROM phone.kyc_submissions
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 100
  `;
  res.json({ submissions });
}));

kyc.patch('/admin/submissions/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ message: 'Søknads-ID er ugyldig.' });
  const status = req.body?.status;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Status må være approved eller rejected.' });
  }

  const [submission] = await db`
    UPDATE phone.kyc_submissions
    SET
      status = ${status},
      reviewed_by = ${req.userId!},
      updated_at = now()
    WHERE id = ${id.data}::uuid AND status = 'pending'
    RETURNING id, status, updated_at AS reviewed_at
  `;
  if (!submission) return res.status(404).json({ message: 'Søknaden finnes ikke eller er allerede behandlet.' });
  res.json({ submission });
}));

function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!req.isAdmin) return res.status(403).json({ message: 'Administrator access is required.' });
  return next();
}

function isObjectNotFound(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && '$metadata' in error
    && typeof error.$metadata === 'object'
    && error.$metadata !== null
    && 'httpStatusCode' in error.$metadata
    && error.$metadata.httpStatusCode === 404;
}

function matchesContentType(body: Buffer, contentType: keyof typeof documentTypes): boolean {
  switch (contentType) {
    case 'image/jpeg':
      return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
    case 'image/png':
      return body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return body.length >= 12
        && body.toString('ascii', 0, 4) === 'RIFF'
        && body.toString('ascii', 8, 12) === 'WEBP';
    case 'application/pdf':
      return body.toString('ascii', 0, 5) === '%PDF-';
  }
}
