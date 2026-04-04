import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import pool from '../db/pool.js';
import { getCachedDek } from '../services/keyCache.js';
import * as s3 from '../services/s3.js';
import {
  detectMediaType,
  outputExtension,
  outputMime,
} from '../services/transcoding.js';
import {
  TEMP_DIR,
  ensureTempDir,
  cleanupFiles,
  processUpload,
  validateUploadProfile,
} from '../services/mediaUploadPipeline.js';
import { streamMediaToResponse } from '../services/mediaStreaming.js';
import { parseThumbnails, serveThumbnail } from '../services/mediaThumbnailServe.js';
import { progressForApi } from '../services/processingProgress.js';

const router = Router();
router.use(requireAuth);

const upload = multer({ dest: TEMP_DIR, limits: { fileSize: 10 * 1024 * 1024 * 1024 } });

function dekForCollection(collectionId: string, isEncrypted: boolean): Buffer | null {
  if (!isEncrypted) return null;
  return getCachedDek(collectionId);
}

router.post('/collections/:collectionId/media', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  await ensureTempDir();

  const collectionId = req.params.collectionId as string;
  const file = req.file;
  if (!file) { res.status(400).json({ error: 'No file provided' }); return; }

  const mediaType = detectMediaType(file.mimetype, file.originalname);
  const defaultProfile = mediaType === 'video' ? '720p' : 'mp3-192';

  const title = (req.body.title as string) || file.originalname || 'Untitled';
  const description = (req.body.description as string) || '';
  const profileName = (req.body.profile as string) || defaultProfile;

  const profileCheck = validateUploadProfile(mediaType, profileName);
  if (!profileCheck.ok) {
    await cleanupFiles(file.path);
    res.status(400).json({ error: `Invalid profile for ${mediaType}. Valid: ${profileCheck.validKeys}` });
    return;
  }

  const { rows: colRows } = await pool.query(
    'SELECT id, is_encrypted FROM collections WHERE id = $1', [collectionId],
  );
  if (colRows.length === 0) {
    await cleanupFiles(file.path);
    res.status(404).json({ error: 'Collection not found' });
    return;
  }

  const collection = colRows[0];
  if (collection.is_encrypted && !getCachedDek(collectionId)) {
    await cleanupFiles(file.path);
    res.status(403).json({ error: 'Collection is locked. Unlock it first.' });
    return;
  }

  const mediaId = randomUUID();
  const ext = outputExtension(mediaType, profileName);
  const mimeType = outputMime(mediaType, profileName);
  const s3Key = `collections/${collectionId}/media/${mediaId}${ext}`;

  await pool.query(
    `INSERT INTO media (id, collection_id, title, description, media_type, profile, s3_key, mime_type, status, original_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processing', $9)`,
    [mediaId, collectionId, title, description, mediaType, profileName, s3Key, mimeType, file.originalname],
  );

  res.status(202).json({ id: mediaId, status: 'processing' });

  processUpload(
    mediaId,
    collectionId,
    collection.is_encrypted as boolean,
    mediaType,
    file.path,
    profileName,
    s3Key,
    mimeType,
  ).catch((err: Error) => {
    console.error(`Processing failed for ${mediaId}:`, err.message);
  });
}));

router.get('/collections/:collectionId/media', asyncHandler(async (req, res) => {
  const collectionId = req.params.collectionId as string;
  const { rows } = await pool.query(
    `SELECT m.id, m.title, m.description, m.media_type, m.duration_sec, m.file_size_bytes,
            m.profile, m.mime_type, m.status, m.created_at, m.metadata,
            COALESCE(jsonb_array_length(m.thumbnails), 0)::int AS thumb_frame_count
     FROM media m WHERE m.collection_id = $1 ORDER BY m.created_at DESC`,
    [collectionId],
  );
  res.json(rows);
}));

router.get('/media/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.collection_id, m.title, m.description, m.media_type, m.duration_sec, m.file_size_bytes,
            m.profile, m.mime_type, m.status, m.created_at, m.s3_key, m.encryption_iv, m.original_name, m.metadata,
            c.is_encrypted,
            COALESCE(jsonb_array_length(m.thumbnails), 0)::int AS thumb_frame_count
     FROM media m JOIN collections c ON m.collection_id = c.id WHERE m.id = $1`,
    [req.params.id],
  );
  if (rows.length === 0) { res.status(404).json({ error: 'Media not found' }); return; }
  const row = rows[0] as Record<string, unknown>;
  if (row.status === 'processing') {
    res.set('Cache-Control', 'private, no-store');
    res.json({ ...row, progress: progressForApi(req.params.id as string) });
  } else {
    res.json(row);
  }
}));

router.get('/media/:id/stream', asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT m.s3_key, m.file_size_bytes, m.encryption_iv, m.collection_id, m.mime_type, c.is_encrypted
     FROM media m JOIN collections c ON m.collection_id = c.id
     WHERE m.id = $1 AND m.status = 'ready'`,
    [req.params.id],
  );

  if (rows.length === 0) { res.status(404).json({ error: 'Media not found or not ready' }); return; }

  const media = rows[0];
  const contentType = media.mime_type || 'application/octet-stream';
  const dek = dekForCollection(media.collection_id, media.is_encrypted);

  if (media.is_encrypted && !dek) {
    res.status(403).json({ error: 'Collection is locked' });
    return;
  }

  await streamMediaToResponse(req, res, {
    mediaId: req.params.id as string,
    contentType,
    totalSize: Number(media.file_size_bytes),
    s3Key: media.s3_key,
    isEncrypted: media.is_encrypted,
    encryptionIv: media.encryption_iv as Buffer,
    dek,
  });
}));

router.get('/media/:id/thumb', asyncHandler(async (req, res) => {
  const frameIndex = Math.max(0, parseInt(String(req.query.i ?? '0'), 10) || 0);

  const { rows } = await pool.query(
    `SELECT m.thumbnails, m.collection_id, c.is_encrypted
     FROM media m JOIN collections c ON m.collection_id = c.id
     WHERE m.id = $1 AND m.status = 'ready'`,
    [req.params.id],
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'Media not found' });
    return;
  }

  const frames = parseThumbnails(rows[0].thumbnails);
  if (frameIndex >= frames.length || frames.length === 0) {
    res.status(404).json({ error: 'Thumbnail not found' });
    return;
  }

  const frame = frames[frameIndex]!;
  const dek = dekForCollection(rows[0].collection_id, rows[0].is_encrypted);

  if (frame.encryption_iv && rows[0].is_encrypted && !dek) {
    res.status(403).json({ error: 'Collection is locked' });
    return;
  }

  try {
    await serveThumbnail(res, frame, dek);
  } catch {
    res.status(404).json({ error: 'Thumbnail not found' });
  }
}));

router.delete('/media/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT s3_key, thumbnails FROM media WHERE id = $1', [req.params.id],
  );
  if (rows.length === 0) { res.status(404).json({ error: 'Media not found' }); return; }

  await s3.moveMediaKeysToTrash(rows[0].s3_key as string, rows[0].thumbnails);
  await pool.query('DELETE FROM media WHERE id = $1', [req.params.id]);

  res.status(204).end();
}));

export default router;
