/**
 * Streaming & encryption notes
 * ---------------------------
 * - **S3 → Node chunk size**: The AWS SDK exposes the object as a Node `Readable`. Chunk sizes are not
 *   configured in this repo; they follow the SDK / HTTP stack (often on the order of tens–hundreds of KiB
 *   per `data` event). Tuning would mean wrapping the body with a `Readable` that uses a different
 *   `highWaterMark` or buffering strategy.
 * - **AES-256-CTR**: Ciphertext is XORed with a keystream derived from the key and a per-file IV plus
 *   block index. Decrypting in small stream chunks does **not** weaken confidentiality vs. one large
 *   decrypt—the security margin is AES-256 and unique IVs per object. Aligning range starts to 16-byte
 *   boundaries is required so the CTR counter matches the stored ciphertext.
 * - **Integrity**: CTR provides confidentiality only; a malicious storage layer could flip bits without
 *   detection. Mitigation would be an AEAD (e.g. AES-GCM) or separate MAC—out of scope here.
 *
 * **Redis cache** (optional): When enabled, we store the **exact bytes sent to the client** for a given
 * `(mediaId, start, end)` range—i.e. plaintext after decryption. TTL and max range size come from env.
 */
import type { Request, Response } from 'express';
import type { Readable } from 'node:stream';
import * as s3 from './s3.js';
import { createStreamDecipher } from './encryption.js';
import config from '../config.js';
import { getCachedRange, isStreamCacheEnabled, setCachedRange } from './streamCache.js';

export function parseRange(rangeHeader: string, totalSize: number): { start: number; end: number } {
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) return { start: 0, end: totalSize - 1 };
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
  return { start: Math.min(start, totalSize - 1), end: Math.min(end, totalSize - 1) };
}

export interface MediaStreamParams {
  mediaId: string;
  contentType: string;
  totalSize: number;
  s3Key: string;
  isEncrypted: boolean;
  encryptionIv: Buffer | null;
  dek: Buffer | null;
}

function rangeByteLength(start: number, end: number): number {
  return end - start + 1;
}

function cacheableRange(start: number, end: number): boolean {
  return rangeByteLength(start, end) <= config.streamCache.maxRangeBytes;
}

async function readStreamWithLimit(stream: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let len = 0;
  for await (const chunk of stream) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    len += b.length;
    if (len > maxBytes) {
      stream.destroy();
      throw new Error('stream exceeds cache size limit');
    }
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}

async function collectPlaintextRange(
  s3Key: string,
  s3Range: string | undefined,
  maxBytes: number,
): Promise<Buffer> {
  const obj = await s3.getObject(s3Key, s3Range);
  return readStreamWithLimit(obj.body as Readable, maxBytes);
}

async function collectDecryptedRange(
  s3Key: string,
  s3Range: string,
  dek: Buffer,
  iv: Buffer,
  alignedStart: number,
  skipBytes: number,
  maxPlainBytes: number,
): Promise<Buffer> {
  const obj = await s3.getObject(s3Key, s3Range);
  const decipher = createStreamDecipher(dek, iv, alignedStart);
  const chunks: Buffer[] = [];
  let outLen = 0;
  let skipped = 0;

  return new Promise((resolve, reject) => {
    const fail = (err: Error) => {
      try { (obj.body as Readable).destroy(); } catch { /* ignore */ }
      try { decipher.destroy(); } catch { /* ignore */ }
      reject(err);
    };

    decipher.on('data', (chunk: Buffer) => {
      try {
        if (skipped < skipBytes) {
          const toSkip = Math.min(skipBytes - skipped, chunk.length);
          skipped += toSkip;
          if (toSkip < chunk.length) {
            const rest = chunk.subarray(toSkip);
            outLen += rest.length;
            if (outLen > maxPlainBytes) {
              fail(new Error('decrypted stream exceeds cache size limit'));
              return;
            }
            chunks.push(rest);
          }
        } else {
          outLen += chunk.length;
          if (outLen > maxPlainBytes) {
            fail(new Error('decrypted stream exceeds cache size limit'));
            return;
          }
          chunks.push(chunk);
        }
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)));
      }
    });
    decipher.on('end', () => resolve(Buffer.concat(chunks)));
    decipher.on('error', (err) => fail(err instanceof Error ? err : new Error(String(err))));
    (obj.body as Readable).on('error', (err) => fail(err instanceof Error ? err : new Error(String(err))));
    (obj.body as Readable).pipe(decipher);
  });
}

function sendBuffer(
  res: Response,
  status: 200 | 206,
  contentType: string,
  body: Buffer,
  totalSize: number,
  range?: { start: number; end: number },
): void {
  if (status === 206 && range) {
    res.writeHead(206, {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'Content-Range': `bytes ${range.start}-${range.end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
    });
  } else {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'Accept-Ranges': 'bytes',
    });
  }
  res.end(body);
}

/** Range-aware S3 → client; CTR decrypt when `isEncrypted` (caller must pass DEK when encrypted). */
export async function streamMediaToResponse(
  req: Request,
  res: Response,
  p: MediaStreamParams,
): Promise<void> {
  const { mediaId, contentType, totalSize, s3Key, isEncrypted, encryptionIv, dek } = p;
  const rangeHeader = req.headers.range;
  const useCache = isStreamCacheEnabled();

  let rangeStart = 0;
  let rangeEnd = totalSize - 1;
  if (rangeHeader) {
    const r = parseRange(rangeHeader, totalSize);
    rangeStart = r.start;
    rangeEnd = r.end;
  }

  if (useCache && cacheableRange(rangeStart, rangeEnd)) {
    const cached = await getCachedRange(mediaId, rangeStart, rangeEnd);
    if (cached) {
      sendBuffer(
        res,
        rangeHeader ? 206 : 200,
        contentType,
        cached,
        totalSize,
        rangeHeader ? { start: rangeStart, end: rangeEnd } : undefined,
      );
      return;
    }
  }

  if (!isEncrypted) {
    if (rangeHeader) {
      if (useCache && cacheableRange(rangeStart, rangeEnd)) {
        const buf = await collectPlaintextRange(
          s3Key,
          `bytes=${rangeStart}-${rangeEnd}`,
          config.streamCache.maxRangeBytes,
        );
        void setCachedRange(mediaId, rangeStart, rangeEnd, buf);
        sendBuffer(res, 206, contentType, buf, totalSize, { start: rangeStart, end: rangeEnd });
        return;
      }
      const s3Range = `bytes=${rangeStart}-${rangeEnd}`;
      const obj = await s3.getObject(s3Key, s3Range);
      res.writeHead(206, {
        'Content-Type': contentType,
        'Content-Length': rangeEnd - rangeStart + 1,
        'Content-Range': `bytes ${rangeStart}-${rangeEnd}/${totalSize}`,
        'Accept-Ranges': 'bytes',
      });
      obj.body.pipe(res);
    } else {
      if (useCache && cacheableRange(0, totalSize - 1)) {
        const buf = await collectPlaintextRange(s3Key, undefined, config.streamCache.maxRangeBytes);
        void setCachedRange(mediaId, 0, totalSize - 1, buf);
        sendBuffer(res, 200, contentType, buf, totalSize);
        return;
      }
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
    const alignedStart = Math.floor(rangeStart / 16) * 16;
    const skipBytes = rangeStart - alignedStart;
    const s3Range = `bytes=${alignedStart}-${rangeEnd}`;

    if (useCache && dek && cacheableRange(rangeStart, rangeEnd)) {
      const buf = await collectDecryptedRange(
        s3Key,
        s3Range,
        dek,
        iv,
        alignedStart,
        skipBytes,
        config.streamCache.maxRangeBytes,
      );
      void setCachedRange(mediaId, rangeStart, rangeEnd, buf);
      sendBuffer(res, 206, contentType, buf, totalSize, { start: rangeStart, end: rangeEnd });
      return;
    }

    const obj = await s3.getObject(s3Key, s3Range);
    const decipher = createStreamDecipher(dek!, iv, alignedStart);

    res.writeHead(206, {
      'Content-Type': contentType,
      'Content-Length': rangeEnd - rangeStart + 1,
      'Content-Range': `bytes ${rangeStart}-${rangeEnd}/${totalSize}`,
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
    if (useCache && dek && cacheableRange(0, totalSize - 1)) {
      const buf = await collectDecryptedRange(
        s3Key,
        `bytes=0-${totalSize - 1}`,
        dek,
        iv,
        0,
        0,
        config.streamCache.maxRangeBytes,
      );
      void setCachedRange(mediaId, 0, totalSize - 1, buf);
      sendBuffer(res, 200, contentType, buf, totalSize);
      return;
    }

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
