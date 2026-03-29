import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import pool from '../db/pool.js';
import { getCachedDek } from '../services/keyCache.js';
import { generateFileIv, encryptFile, createStreamDecipher } from '../services/encryption.js';
import * as s3 from '../services/s3.js';
import { transcode, generateThumbnail, probeDuration, getFileSize, PROFILES } from '../services/transcoding.js';

const router = Router();
router.use(requireAuth);

const TEMP_DIR = join(tmpdir(), 'nodeo-uploads');
const upload = multer({ dest: TEMP_DIR, limits: { fileSize: 10 * 1024 * 1024 * 1024 } });

async function ensureTempDir() {
  await mkdir(TEMP_DIR, { recursive: true });
}

async function cleanupFiles(...paths: string[]) {
  for (const p of paths) {
    try { await unlink(p); } catch { /* ignore */ }
  }
}

function getDekForCollection(collectionId: string, isEncrypted: boolean): Buffer | null {
  if (!isEncrypted) return null;
  return getCachedDek(collectionId);
}

// --- Upload ---

router.post('/collections/:collectionId/media', upload.single('file'), async (req: Request, res: Response) => {
  await ensureTempDir();

  const collectionId = req.params.collectionId as string;
  const file = req.file;
  if (!file) { res.status(400).json({ error: 'No file provided' }); return; }

  const title = (req.body.title as string) || file.originalname || 'Untitled';
  const description = (req.body.description as string) || '';
  const profileName = (req.body.profile as string) || '720p';

  if (!PROFILES[profileName]) {
    await cleanupFiles(file.path);
    res.status(400).json({ error: `Invalid profile. Valid: ${Object.keys(PROFILES).join(', ')}` });
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
  const s3Key = `collections/${collectionId}/media/${mediaId}.mp4`;
  const thumbS3Key = `collections/${collectionId}/thumbs/${mediaId}.jpg`;

  await pool.query(
    `INSERT INTO media (id, collection_id, title, description, media_type, profile, s3_key, thumb_s3_key, mime_type, status, original_name)
     VALUES ($1, $2, $3, $4, 'video', $5, $6, $7, 'video/mp4', 'processing', $8)`,
    [mediaId, collectionId, title, description, profileName, s3Key, thumbS3Key, file.originalname],
  );

  res.status(202).json({ id: mediaId, status: 'processing' });

  processUpload(mediaId, collectionId, collection.is_encrypted as boolean, file.path, profileName, s3Key, thumbS3Key).catch((err: Error) => {
    console.error(`Processing failed for ${mediaId}:`, err.message);
  });
});

async function processUpload(
  mediaId: string, collectionId: string, isEncrypted: boolean,
  inputPath: string, profileName: string, s3Key: string, thumbS3Key: string,
) {
  const transcodedPath = join(TEMP_DIR, `${mediaId}.mp4`);
  const thumbPath = join(TEMP_DIR, `${mediaId}.jpg`);
  const encryptedPath = join(TEMP_DIR, `${mediaId}.enc.mp4`);

  try {
    console.log(`[${mediaId}] Transcoding with profile ${profileName}...`);
    await transcode(inputPath, transcodedPath, profileName);

    console.log(`[${mediaId}] Generating thumbnail...`);
    await generateThumbnail(inputPath, thumbPath).catch(() =>
      generateThumbnail(transcodedPath, thumbPath),
    );

    const duration = await probeDuration(transcodedPath);

    let encryptionIv: Buffer | null = null;
    let uploadPath = transcodedPath;

    if (isEncrypted) {
      const dek = getCachedDek(collectionId);
      if (dek) {
        encryptionIv = generateFileIv();
        console.log(`[${mediaId}] Encrypting...`);
        await encryptFile(dek, encryptionIv, transcodedPath, encryptedPath);
        uploadPath = encryptedPath;
      }
    }

    const fileSize = await getFileSize(uploadPath);

    console.log(`[${mediaId}] Uploading to S3...`);
    await s3.uploadFile(s3Key, uploadPath, 'video/mp4');
    await s3.uploadFile(thumbS3Key, thumbPath, 'image/jpeg');

    await pool.query(
      `UPDATE media SET status = 'ready', duration_sec = $1, file_size_bytes = $2, encryption_iv = $3 WHERE id = $4`,
      [duration, fileSize, encryptionIv, mediaId],
    );

    console.log(`[${mediaId}] Done.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${mediaId}] Error:`, message);
    await pool.query(`UPDATE media SET status = 'error' WHERE id = $1`, [mediaId]);
  } finally {
    await cleanupFiles(inputPath, transcodedPath, thumbPath, encryptedPath);
  }
}

// --- List media in collection ---

router.get('/collections/:collectionId/media', async (req, res) => {
  const collectionId = req.params.collectionId as string;
  const { rows } = await pool.query(
    `SELECT m.id, m.title, m.description, m.media_type, m.duration_sec, m.file_size_bytes,
            m.profile, m.mime_type, m.status, m.created_at
     FROM media m WHERE m.collection_id = $1 ORDER BY m.created_at DESC`,
    [collectionId],
  );
  res.json(rows);
});

// --- Single media ---

router.get('/media/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.*, c.is_encrypted FROM media m JOIN collections c ON m.collection_id = c.id WHERE m.id = $1`,
    [req.params.id],
  );
  if (rows.length === 0) { res.status(404).json({ error: 'Media not found' }); return; }
  res.json(rows[0]);
});

// --- Stream ---

router.get('/media/:id/stream', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT m.s3_key, m.file_size_bytes, m.encryption_iv, m.collection_id, c.is_encrypted
     FROM media m JOIN collections c ON m.collection_id = c.id
     WHERE m.id = $1 AND m.status = 'ready'`,
    [req.params.id],
  );

  if (rows.length === 0) { res.status(404).json({ error: 'Media not found or not ready' }); return; }

  const media = rows[0];
  const dek = getDekForCollection(media.collection_id, media.is_encrypted);

  if (media.is_encrypted && !dek) {
    res.status(403).json({ error: 'Collection is locked' });
    return;
  }

  const totalSize = Number(media.file_size_bytes);
  const rangeHeader = req.headers.range;

  if (!media.is_encrypted) {
    if (rangeHeader) {
      const { start, end } = parseRange(rangeHeader, totalSize);
      const s3Range = `bytes=${start}-${end}`;
      const obj = await s3.getObject(media.s3_key, s3Range);
      res.writeHead(206, {
        'Content-Type': 'video/mp4',
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
      });
      obj.body.pipe(res);
    } else {
      const obj = await s3.getObject(media.s3_key);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': totalSize,
        'Accept-Ranges': 'bytes',
      });
      obj.body.pipe(res);
    }
    return;
  }

  // Encrypted streaming with AES-CTR
  const iv = media.encryption_iv as Buffer;

  if (rangeHeader) {
    const { start, end } = parseRange(rangeHeader, totalSize);
    const alignedStart = Math.floor(start / 16) * 16;
    const skipBytes = start - alignedStart;
    const s3Range = `bytes=${alignedStart}-${end}`;

    const obj = await s3.getObject(media.s3_key, s3Range);
    const decipher = createStreamDecipher(dek!, iv, alignedStart);

    res.writeHead(206, {
      'Content-Type': 'video/mp4',
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
    });

    let skipped = 0;
    decipher.on('data', (chunk: Buffer) => {
      if (skipped < skipBytes) {
        const toSkip = Math.min(skipBytes - skipped, chunk.length);
        skipped += toSkip;
        if (toSkip < chunk.length) res.write(chunk.subarray(toSkip));
      } else {
        res.write(chunk);
      }
    });
    decipher.on('end', () => res.end());
    decipher.on('error', () => res.end());
    obj.body.pipe(decipher);
  } else {
    const obj = await s3.getObject(media.s3_key);
    const decipher = createStreamDecipher(dek!, iv, 0);

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': totalSize,
      'Accept-Ranges': 'bytes',
    });

    obj.body.pipe(decipher).pipe(res);
  }
});

// --- Thumbnail ---

router.get('/media/:id/thumb', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT thumb_s3_key FROM media WHERE id = $1', [req.params.id],
  );
  if (rows.length === 0 || !rows[0].thumb_s3_key) {
    res.status(404).json({ error: 'Thumbnail not found' });
    return;
  }

  try {
    const obj = await s3.getObject(rows[0].thumb_s3_key);
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
    obj.body.pipe(res);
  } catch {
    res.status(404).json({ error: 'Thumbnail not found' });
  }
});

// --- Delete ---

router.delete('/media/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT s3_key, thumb_s3_key FROM media WHERE id = $1', [req.params.id],
  );
  if (rows.length === 0) { res.status(404).json({ error: 'Media not found' }); return; }

  await s3.deleteObject(rows[0].s3_key).catch(() => {});
  if (rows[0].thumb_s3_key) await s3.deleteObject(rows[0].thumb_s3_key).catch(() => {});
  await pool.query('DELETE FROM media WHERE id = $1', [req.params.id]);

  res.status(204).end();
});

function parseRange(rangeHeader: string, totalSize: number): { start: number; end: number } {
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) return { start: 0, end: totalSize - 1 };
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
  return { start: Math.min(start, totalSize - 1), end: Math.min(end, totalSize - 1) };
}

export default router;
