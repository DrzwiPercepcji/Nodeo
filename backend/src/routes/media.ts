import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Readable } from 'node:stream';
import multer from 'multer';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import pool from '../db/pool.js';
import { getCachedDek } from '../services/keyCache.js';
import { generateFileIv, encryptFile, createStreamDecipher, decrypt } from '../services/encryption.js';
import * as s3 from '../services/s3.js';
import {
  transcodeVideo, transcodeAudio, probeDuration, getFileSize,
  VIDEO_PROFILES, AUDIO_PROFILES,
  detectMediaType, outputExtension, outputMime,
  thumbSeekSeconds, generateThumbnailAt, THUMB_FRAME_COUNT,
} from '../services/transcoding.js';
import {
  setMediaJobProgress,
  clearMediaJobProgress,
  progressForApi,
} from '../services/processingProgress.js';

/** Overall % bands: transcode → thumbs → encrypt → main S3 → thumb S3 */
const P_TRANSCODE = [0, 50] as const;
const P_THUMBS = [50, 62] as const;
const P_ENCRYPT = [62, 68] as const;
const P_MAIN = [68, 85] as const;
const P_THUMB_UP = [85, 100] as const;

function overallTranscode(ffmpegPct: number): number {
  const [lo, hi] = P_TRANSCODE;
  return Math.round(lo + (ffmpegPct / 100) * (hi - lo));
}

const router = Router();
router.use(requireAuth);

const TEMP_DIR = join(tmpdir(), 'nodeo-uploads');
const upload = multer({ dest: TEMP_DIR, limits: { fileSize: 10 * 1024 * 1024 * 1024 } });

interface ThumbnailFrame {
  s3_key: string;
  encryption_iv: string | null;
}

async function ensureTempDir() {
  await mkdir(TEMP_DIR, { recursive: true });
}

async function cleanupFiles(...paths: string[]) {
  for (const p of paths) {
    try { await unlink(p); } catch { /* ignore */ }
  }
}

async function readableToBuffer(body: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getDekForCollection(collectionId: string, isEncrypted: boolean): Buffer | null {
  if (!isEncrypted) return null;
  return getCachedDek(collectionId);
}

function parseThumbnails(row: unknown): ThumbnailFrame[] {
  if (!row || !Array.isArray(row)) return [];
  return row as ThumbnailFrame[];
}

router.post('/collections/:collectionId/media', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  await ensureTempDir();

  const collectionId = req.params.collectionId as string;
  const file = req.file;
  if (!file) { res.status(400).json({ error: 'No file provided' }); return; }

  const mediaType = detectMediaType(file.mimetype, file.originalname);
  const allowedProfiles = mediaType === 'video' ? VIDEO_PROFILES : AUDIO_PROFILES;
  const defaultProfile = mediaType === 'video' ? '720p' : 'mp3-192';

  const title = (req.body.title as string) || file.originalname || 'Untitled';
  const description = (req.body.description as string) || '';
  const profileName = (req.body.profile as string) || defaultProfile;

  if (!allowedProfiles[profileName]) {
    await cleanupFiles(file.path);
    res.status(400).json({ error: `Invalid profile for ${mediaType}. Valid: ${Object.keys(allowedProfiles).join(', ')}` });
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

  processUpload(mediaId, collectionId, collection.is_encrypted as boolean, mediaType, file.path, profileName, s3Key, mimeType).catch((err: Error) => {
    console.error(`Processing failed for ${mediaId}:`, err.message);
  });
}));

async function processUpload(
  mediaId: string, collectionId: string, isEncrypted: boolean, mediaType: 'video' | 'audio',
  inputPath: string, profileName: string, s3Key: string, mimeType: string,
) {
  const ext = outputExtension(mediaType, profileName);
  const transcodedPath = join(TEMP_DIR, `${mediaId}${ext}`);
  const encryptedPath = join(TEMP_DIR, `${mediaId}.enc${ext}`);
  const thumbPaths: string[] = [];
  const encThumbPaths: string[] = [];

  try {
    const inputDurationSec = await probeDuration(inputPath);
    setMediaJobProgress(mediaId, {
      stage: 'transcoding',
      overall_percent: 0,
      current_sec: 0,
      total_sec: inputDurationSec,
    });

    if (mediaType === 'video') {
      console.log(`[${mediaId}] Transcoding video with profile ${profileName}...`);
      await transcodeVideo(inputPath, transcodedPath, profileName, {
        durationSec: inputDurationSec,
        onProgress: ({ ffmpegPercent, currentSec }) => {
          setMediaJobProgress(mediaId, {
            stage: 'transcoding',
            overall_percent: overallTranscode(ffmpegPercent),
            current_sec: Math.round(currentSec),
            total_sec: inputDurationSec,
          });
        },
      });
    } else {
      console.log(`[${mediaId}] Transcoding audio with profile ${profileName}...`);
      await transcodeAudio(inputPath, transcodedPath, profileName, {
        durationSec: inputDurationSec,
        onProgress: ({ ffmpegPercent, currentSec }) => {
          setMediaJobProgress(mediaId, {
            stage: 'transcoding',
            overall_percent: overallTranscode(ffmpegPercent),
            current_sec: Math.round(currentSec),
            total_sec: inputDurationSec,
          });
        },
      });
    }

    const totalForBar = inputDurationSec ?? null;
    setMediaJobProgress(mediaId, {
      stage: 'transcoding',
      overall_percent: P_TRANSCODE[1],
      current_sec: totalForBar,
      total_sec: totalForBar,
    });

    const duration = await probeDuration(transcodedPath);

    if (mediaType === 'video') {
      const seeks = thumbSeekSeconds(duration);
      const thumbTotal = Math.min(seeks.length, THUMB_FRAME_COUNT);
      console.log(`[${mediaId}] Generating ${thumbTotal} thumbnail frames...`);
      for (let i = 0; i < thumbTotal; i++) {
        const [lo, hi] = P_THUMBS;
        setMediaJobProgress(mediaId, {
          stage: 'thumbnails',
          overall_percent: lo + Math.round(((i + 1) / thumbTotal) * (hi - lo)),
          current_sec: null,
          total_sec: null,
        });
        const p = join(TEMP_DIR, `${mediaId}-thumb-${i}.jpg`);
        try {
          await generateThumbnailAt(transcodedPath, p, seeks[i]!);
          thumbPaths.push(p);
        } catch {
          await cleanupFiles(p);
        }
      }
    }

    let encryptionIv: Buffer | null = null;
    let uploadPath = transcodedPath;

    if (isEncrypted) {
      const dek = getCachedDek(collectionId);
      if (dek) {
        encryptionIv = generateFileIv();
        setMediaJobProgress(mediaId, {
          stage: 'encrypting',
          overall_percent: P_ENCRYPT[0] + 2,
          current_sec: null,
          total_sec: null,
        });
        console.log(`[${mediaId}] Encrypting main file...`);
        await encryptFile(dek, encryptionIv, transcodedPath, encryptedPath);
        uploadPath = encryptedPath;
        setMediaJobProgress(mediaId, {
          stage: 'encrypting',
          overall_percent: P_ENCRYPT[1],
          current_sec: null,
          total_sec: null,
        });
      }
    }

    const fileSize = await getFileSize(uploadPath);

    setMediaJobProgress(mediaId, {
      stage: 'uploading_main',
      overall_percent: P_MAIN[0],
      current_sec: null,
      total_sec: null,
    });
    console.log(`[${mediaId}] Uploading to S3...`);
    await s3.uploadFile(s3Key, uploadPath, mimeType);
    setMediaJobProgress(mediaId, {
      stage: 'uploading_main',
      overall_percent: P_MAIN[1],
      current_sec: null,
      total_sec: null,
    });

    const frames: ThumbnailFrame[] = [];
    const dek = isEncrypted ? getCachedDek(collectionId) : null;
    const upCount = thumbPaths.length;

    if (upCount === 0) {
      setMediaJobProgress(mediaId, {
        stage: 'uploading_main',
        overall_percent: 99,
        current_sec: null,
        total_sec: null,
      });
    }

    for (let i = 0; i < thumbPaths.length; i++) {
      const thumbPath = thumbPaths[i]!;
      const frameKey = `collections/${collectionId}/thumbs/${mediaId}/${i}.jpg`;
      const frameKeyEnc = `collections/${collectionId}/thumbs/${mediaId}/${i}.enc`;

      const [tLo, tHi] = P_THUMB_UP;
      setMediaJobProgress(mediaId, {
        stage: 'uploading_thumbs',
        overall_percent: tLo + Math.round(((i + 1) / upCount) * (tHi - tLo)),
        current_sec: null,
        total_sec: null,
      });

      if (dek) {
        const iv = generateFileIv();
        const encPath = join(TEMP_DIR, `${mediaId}-thumb-${i}.enc`);
        await encryptFile(dek, iv, thumbPath, encPath);
        encThumbPaths.push(encPath);
        await s3.uploadFile(frameKeyEnc, encPath, 'application/octet-stream');
        frames.push({ s3_key: frameKeyEnc, encryption_iv: iv.toString('base64') });
      } else {
        await s3.uploadFile(frameKey, thumbPath, 'image/jpeg');
        frames.push({ s3_key: frameKey, encryption_iv: null });
      }
    }

    await pool.query(
      `UPDATE media SET status = 'ready', duration_sec = $1, file_size_bytes = $2, encryption_iv = $3, thumbnails = $4::jsonb WHERE id = $5`,
      [duration, fileSize, encryptionIv, JSON.stringify(frames), mediaId],
    );

    console.log(`[${mediaId}] Done.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
    const name = err && typeof err === 'object' && 'name' in err
      ? String((err as { name: unknown }).name)
      : '';
    console.error(
      `[${mediaId}] Processing error:`,
      message,
      [name, code].filter(Boolean).join(' '),
      err instanceof Error && err.stack ? `\n${err.stack}` : '',
    );
    await pool.query(`UPDATE media SET status = 'error' WHERE id = $1`, [mediaId]);
  } finally {
    clearMediaJobProgress(mediaId);
    const toClean = [inputPath, transcodedPath, encryptedPath, ...thumbPaths, ...encThumbPaths];
    await cleanupFiles(...toClean);
  }
}

router.get('/collections/:collectionId/media', asyncHandler(async (req, res) => {
  const collectionId = req.params.collectionId as string;
  const { rows } = await pool.query(
    `SELECT m.id, m.title, m.description, m.media_type, m.duration_sec, m.file_size_bytes,
            m.profile, m.mime_type, m.status, m.created_at,
            COALESCE(jsonb_array_length(m.thumbnails), 0)::int AS thumb_frame_count
     FROM media m WHERE m.collection_id = $1 ORDER BY m.created_at DESC`,
    [collectionId],
  );
  res.json(rows);
}));

router.get('/media/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.collection_id, m.title, m.description, m.media_type, m.duration_sec, m.file_size_bytes,
            m.profile, m.mime_type, m.status, m.created_at, m.s3_key, m.encryption_iv, m.original_name,
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
        'Content-Type': contentType,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
      });
      obj.body.pipe(res);
    } else {
      const obj = await s3.getObject(media.s3_key);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': totalSize,
        'Accept-Ranges': 'bytes',
      });
      obj.body.pipe(res);
    }
    return;
  }

  const iv = media.encryption_iv as Buffer;

  if (rangeHeader) {
    const { start, end } = parseRange(rangeHeader, totalSize);
    const alignedStart = Math.floor(start / 16) * 16;
    const skipBytes = start - alignedStart;
    const s3Range = `bytes=${alignedStart}-${end}`;

    const obj = await s3.getObject(media.s3_key, s3Range);
    const decipher = createStreamDecipher(dek!, iv, alignedStart);

    res.writeHead(206, {
      'Content-Type': contentType,
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
      'Content-Type': contentType,
      'Content-Length': totalSize,
      'Accept-Ranges': 'bytes',
    });

    obj.body.pipe(decipher).pipe(res);
  }
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
  const dek = getDekForCollection(rows[0].collection_id, rows[0].is_encrypted);

  if (frame.encryption_iv && rows[0].is_encrypted && !dek) {
    res.status(403).json({ error: 'Collection is locked' });
    return;
  }

  try {
    const obj = await s3.getObject(frame.s3_key);
    const body = await readableToBuffer(obj.body as Readable);

    if (frame.encryption_iv) {
      if (!dek) {
        res.status(403).json({ error: 'Collection is locked' });
        return;
      }
      const iv = Buffer.from(frame.encryption_iv, 'base64');
      const jpeg = decrypt(dek, iv, body);
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': jpeg.length,
        'Cache-Control': 'private, max-age=3600',
      });
      res.end(jpeg);
    } else {
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': body.length,
        'Cache-Control': 'private, max-age=86400',
      });
      res.end(body);
    }
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

function parseRange(rangeHeader: string, totalSize: number): { start: number; end: number } {
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) return { start: 0, end: totalSize - 1 };
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
  return { start: Math.min(start, totalSize - 1), end: Math.min(end, totalSize - 1) };
}

export default router;
