import { join } from 'node:path';
import pool from '../../db/pool.js';
import { getCachedDek } from '../keyCache.js';
import { generateFileIv, encryptFile } from '../encryption.js';
import * as s3 from '../s3.js';
import { outputExtension, getFileSize } from '../transcoding.js';
import { setMediaJobProgress, clearMediaJobProgress } from '../processingProgress.js';
import type { ThumbnailFrame } from './types.js';
import { P_ENCRYPT, P_MAIN, P_THUMB_UP } from './progressBands.js';
import { TEMP_DIR, cleanupFiles } from './uploadTemp.js';
import { transcodeForUpload } from './transcodeStep.js';
import { extractVideoThumbnailsToDisk } from './thumbnailDiskStep.js';
import { extractMediaMetadata } from '../mediaMetadata.js';

function logProcessingError(mediaId: string, err: unknown): void {
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
}

export async function processUpload(
  mediaId: string,
  collectionId: string,
  isEncrypted: boolean,
  mediaType: 'video' | 'audio',
  inputPath: string,
  profileName: string,
  s3Key: string,
  mimeType: string,
): Promise<void> {
  const ext = outputExtension(mediaType, profileName);
  const transcodedPath = join(TEMP_DIR, `${mediaId}${ext}`);
  const encryptedPath = join(TEMP_DIR, `${mediaId}.enc${ext}`);
  const thumbPaths: string[] = [];
  const encThumbPaths: string[] = [];

  try {
    const fileMetadata = await extractMediaMetadata(inputPath, mediaType);

    const duration = await transcodeForUpload({
      mediaId,
      mediaType,
      inputPath,
      outputPath: transcodedPath,
      profileName,
    });

    if (mediaType === 'video') {
      const generated = await extractVideoThumbnailsToDisk({
        mediaId,
        transcodedPath,
        durationSec: duration,
        tempDir: TEMP_DIR,
      });
      thumbPaths.push(...generated);
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
      `UPDATE media SET status = 'ready', duration_sec = $1, file_size_bytes = $2, encryption_iv = $3, thumbnails = $4::jsonb, metadata = $5::jsonb WHERE id = $6`,
      [
        duration,
        fileSize,
        encryptionIv,
        JSON.stringify(frames),
        fileMetadata ? JSON.stringify(fileMetadata) : null,
        mediaId,
      ],
    );

    console.log(`[${mediaId}] Done.`);
  } catch (err) {
    logProcessingError(mediaId, err);
    await pool.query(`UPDATE media SET status = 'error' WHERE id = $1`, [mediaId]);
  } finally {
    clearMediaJobProgress(mediaId);
    const toClean = [inputPath, transcodedPath, encryptedPath, ...thumbPaths, ...encThumbPaths];
    await cleanupFiles(...toClean);
  }
}
