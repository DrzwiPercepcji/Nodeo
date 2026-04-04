import type { Request, Response } from 'express';
import * as s3 from './s3.js';
import { createStreamDecipher } from './encryption.js';

export function parseRange(rangeHeader: string, totalSize: number): { start: number; end: number } {
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) return { start: 0, end: totalSize - 1 };
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
  return { start: Math.min(start, totalSize - 1), end: Math.min(end, totalSize - 1) };
}

export interface MediaStreamParams {
  contentType: string;
  totalSize: number;
  s3Key: string;
  isEncrypted: boolean;
  encryptionIv: Buffer | null;
  dek: Buffer | null;
}

/** Range-aware S3 → client; CTR decrypt when `isEncrypted` (caller must pass DEK when encrypted). */
export async function streamMediaToResponse(
  req: Request,
  res: Response,
  p: MediaStreamParams,
): Promise<void> {
  const { contentType, totalSize, s3Key, isEncrypted, encryptionIv, dek } = p;
  const rangeHeader = req.headers.range;

  if (!isEncrypted) {
    if (rangeHeader) {
      const { start, end } = parseRange(rangeHeader, totalSize);
      const s3Range = `bytes=${start}-${end}`;
      const obj = await s3.getObject(s3Key, s3Range);
      res.writeHead(206, {
        'Content-Type': contentType,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
      });
      obj.body.pipe(res);
    } else {
      const obj = await s3.getObject(s3Key);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': totalSize,
        'Accept-Ranges': 'bytes',
      });
      obj.body.pipe(res);
    }
    return;
  }

  const iv = encryptionIv!;

  if (rangeHeader) {
    const { start, end } = parseRange(rangeHeader, totalSize);
    const alignedStart = Math.floor(start / 16) * 16;
    const skipBytes = start - alignedStart;
    const s3Range = `bytes=${alignedStart}-${end}`;

    const obj = await s3.getObject(s3Key, s3Range);
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
    const obj = await s3.getObject(s3Key);
    const decipher = createStreamDecipher(dek!, iv, 0);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': totalSize,
      'Accept-Ranges': 'bytes',
    });

    obj.body.pipe(decipher).pipe(res);
  }
}
