import type { Response } from 'express';
import type { Readable } from 'node:stream';
import * as s3 from './s3.js';
import { decrypt } from './encryption.js';
import type { ThumbnailFrame } from './mediaUploadPipeline.js';

export function parseThumbnails(row: unknown): ThumbnailFrame[] {
  if (!row || !Array.isArray(row)) return [];
  return row as ThumbnailFrame[];
}

async function readableToBuffer(body: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Fetch thumb from S3; decrypt if frame carries an IV (encrypted collection). */
export async function serveThumbnail(
  res: Response,
  frame: ThumbnailFrame,
  dek: Buffer | null,
): Promise<void> {
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
}
