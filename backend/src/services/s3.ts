import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { Upload } from '@aws-sdk/lib-storage';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import type { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import config from '../config.js';

/** Longer timeouts help large multipart uploads over Docker / flaky networks. */
const requestHandler = new NodeHttpHandler({
  requestTimeout: 300_000,
  connectionTimeout: 30_000,
});

const client = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  requestHandler,
  maxAttempts: 5,
  ...(config.s3.endpoint ? { endpoint: config.s3.endpoint, forcePathStyle: true } : {}),
});

const bucket = config.s3.bucket;

/** Quarantined keys; bucket lifecycle (prefix trash/) should expire after ~7 days. */
const TRASH_PREFIX = 'trash/archive';

function copySourceHeader(sourceKey: string): string {
  return `${bucket}/${encodeURIComponent(sourceKey).replace(/%2F/g, '/')}`;
}

const UPLOAD_MAX_ATTEMPTS = 4;
const UPLOAD_BASE_DELAY_MS = 750;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Transient TCP / proxy / MinIO issues during PutObject or multipart parts. */
function isRetryableUploadError(err: unknown): boolean {
  let cur: unknown = err;
  for (let depth = 0; cur && depth < 6; depth++) {
    if (typeof cur !== 'object' || cur === null) break;
    const o = cur as Record<string, unknown>;
    const code = typeof o.code === 'string' ? o.code : '';
    if (['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNABORTED'].includes(code)) return true;
    if (o.name === 'TimeoutError') return true;
    const status = (o.$metadata as { httpStatusCode?: number } | undefined)?.httpStatusCode;
    if (status === 500 || status === 502 || status === 503) return true;
    const msg = typeof o.message === 'string' ? o.message : '';
    if (/ECONNRESET|socket hang up|EPIPE|ETIMEDOUT|ECONNABORTED|timeout/i.test(msg)) return true;
    cur = o.cause;
  }
  return false;
}

async function runUploadWithRetries(
  label: string,
  key: string,
  run: () => Promise<void>,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
    try {
      await run();
      if (attempt > 1) console.log(`[s3] upload ok after ${attempt} attempt(s): ${key}`);
      return;
    } catch (err) {
      lastErr = err;
      const retry = isRetryableUploadError(err) && attempt < UPLOAD_MAX_ATTEMPTS;
      const msg = err instanceof Error ? err.message : String(err);
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
      console.warn(`[s3] upload failed (${label}) key=${key} attempt ${attempt}/${UPLOAD_MAX_ATTEMPTS}: ${msg}${code ? ` [${code}]` : ''}${retry ? ' — retrying' : ''}`);
      if (!retry) throw err;
      const delay = Math.min(UPLOAD_BASE_DELAY_MS * 2 ** (attempt - 1), 30_000);
      await sleep(delay);
    }
  }
  throw lastErr;
}

const uploadExtraParams: Pick<PutObjectCommandInput, 'StorageClass'> | Record<string, never> =
  config.s3.storageClass
    ? { StorageClass: config.s3.storageClass as PutObjectCommandInput['StorageClass'] }
    : {};

export async function uploadFile(key: string, filePath: string, contentType: string): Promise<void> {
  await runUploadWithRetries('file', key, async () => {
    const stream = createReadStream(filePath);
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: stream,
        ContentType: contentType,
        ...uploadExtraParams,
      },
      partSize: 10 * 1024 * 1024,
      queueSize: 3,
    });
    await upload.done();
  });
}

export async function uploadBuffer(key: string, data: Buffer, contentType: string): Promise<void> {
  await runUploadWithRetries('buffer', key, async () => {
    const upload = new Upload({
      client,
      params: { Bucket: bucket, Key: key, Body: data, ContentType: contentType, ...uploadExtraParams },
    });
    await upload.done();
  });
}

export async function getObject(key: string, range?: string): Promise<{
  body: Readable;
  contentLength: number;
  contentRange?: string;
}> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(range ? { Range: range } : {}),
  });
  const response = await client.send(command);
  return {
    body: response.Body as Readable,
    contentLength: response.ContentLength ?? 0,
    contentRange: response.ContentRange ?? undefined,
  };
}

export async function headObject(key: string): Promise<{ contentLength: number }> {
  const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return { contentLength: response.ContentLength ?? 0 };
}

export async function deleteObject(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** S3 keys from `media.thumbnails` JSON. */
export function thumbnailKeysFromRow(thumbnails: unknown): string[] {
  if (!thumbnails || !Array.isArray(thumbnails)) return [];
  return thumbnails
    .map((t: { s3_key?: string }) => (typeof t?.s3_key === 'string' ? t.s3_key : null))
    .filter((k): k is string => !!k);
}

/** Server-side copy to trash prefix, then delete original. No-op if object missing. */
export async function moveObjectToTrash(sourceKey: string): Promise<void> {
  if (!sourceKey || sourceKey.startsWith(`${TRASH_PREFIX}/`) || sourceKey.startsWith('trash/')) return;
  try {
    await headObject(sourceKey);
  } catch {
    return;
  }
  const destKey = `${TRASH_PREFIX}/${randomUUID()}/${sourceKey}`;
  await client.send(new CopyObjectCommand({
    Bucket: bucket,
    Key: destKey,
    CopySource: copySourceHeader(sourceKey),
  }));
  await deleteObject(sourceKey);
}

export async function moveMediaKeysToTrash(s3Key: string, thumbnails: unknown): Promise<void> {
  const keys = [s3Key, ...thumbnailKeysFromRow(thumbnails)];
  const seen = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) continue;
    seen.add(k);
    try {
      await moveObjectToTrash(k);
    } catch (err) {
      console.warn(`[s3] moveObjectToTrash failed for ${k}:`, err instanceof Error ? err.message : err);
    }
  }
}
