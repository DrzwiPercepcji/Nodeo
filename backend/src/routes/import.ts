import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import pool from '../db/pool.js';
import { getCachedDek } from '../services/keyCache.js';
import { outputExtension, outputMime } from '../services/transcoding.js';
import {
  TEMP_DIR,
  ensureTempDir,
  cleanupFiles,
  processUpload,
  validateUploadProfile,
} from '../services/mediaUploadPipeline.js';
import { downloadYouTubeAudio } from '../services/youtubeDownload.js';
import { clearMediaJobProgress } from '../services/processingProgress.js';

const router = Router();
router.use(requireAuth);

router.post('/collections/:collectionId/import', asyncHandler(async (req: Request, res: Response) => {
  await ensureTempDir();

  const collectionId = req.params.collectionId as string;
  const { source, url, title, profile } = req.body as {
    source?: string;
    url?: string;
    title?: string;
    profile?: string;
  };

  if (!source || !url) {
    res.status(400).json({ error: 'source and url are required' });
    return;
  }

  if (source !== 'youtube') {
    res.status(400).json({ error: `Unknown import source: ${source}` });
    return;
  }

  const mediaType = 'audio' as const;
  const profileName = profile || 'mp3-192';

  const profileCheck = validateUploadProfile(mediaType, profileName);
  if (!profileCheck.ok) {
    res.status(400).json({ error: `Invalid profile. Valid: ${profileCheck.validKeys}` });
    return;
  }

  const { rows: colRows } = await pool.query(
    'SELECT id, is_encrypted FROM collections WHERE id = $1', [collectionId],
  );
  if (colRows.length === 0) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }

  const collection = colRows[0];
  if (collection.is_encrypted && !getCachedDek(collectionId)) {
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
    [mediaId, collectionId, title || 'Importing...', '', mediaType, profileName, s3Key, mimeType, url],
  );

  res.status(202).json({ id: mediaId, status: 'processing' });

  (async () => {
    const result = await downloadYouTubeAudio(mediaId, url, TEMP_DIR);

    if (!title) {
      await pool.query('UPDATE media SET title = $1 WHERE id = $2', [result.title, mediaId]);
    }

    await processUpload(
      mediaId,
      collectionId,
      collection.is_encrypted as boolean,
      mediaType,
      result.filePath,
      profileName,
      s3Key,
      mimeType,
    );
  })().catch(async (err: Error) => {
    console.error(`Import failed for ${mediaId}:`, err.message);
    clearMediaJobProgress(mediaId);
    await pool.query(`UPDATE media SET status = 'error' WHERE id = $1`, [mediaId]).catch(() => {});
  });
}));

export default router;
