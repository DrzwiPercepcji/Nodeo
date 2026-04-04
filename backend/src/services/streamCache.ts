import { createClient, RESP_TYPES } from 'redis';
import config from '../config.js';

let client: ReturnType<typeof createClient> | null = null;
let connectPromise: Promise<void> | null = null;

const KEY_PREFIX = 'nodeo:stream:v1:';

export function isStreamCacheEnabled(): boolean {
  return Boolean(config.streamCache.redisUrl);
}

function cacheKey(mediaId: string, start: number, end: number): string {
  return `${KEY_PREFIX}${mediaId}:${start}:${end}`;
}

async function ensureRedis(): Promise<ReturnType<typeof createClient> | null> {
  const url = config.streamCache.redisUrl;
  if (!url) return null;
  if (client?.isOpen) return client;

  if (!connectPromise) {
    const c = createClient({ url });
    c.on('error', (err) => {
      console.error('[stream-cache]', err.message);
    });
    connectPromise = c.connect().then(() => {
      client = c;
    }).catch(async (err) => {
      console.error('[stream-cache] connect failed:', err instanceof Error ? err.message : err);
      await c.disconnect().catch(() => {});
      client = null;
      connectPromise = null;
      throw err;
    });
  }

  try {
    await connectPromise;
  } catch {
    return null;
  }

  return client?.isOpen ? client : null;
}

const blobAsBuffer = { [RESP_TYPES.BLOB_STRING]: Buffer } as const;

export async function getCachedRange(mediaId: string, start: number, end: number): Promise<Buffer | null> {
  const c = await ensureRedis();
  if (!c) return null;
  try {
    const key = cacheKey(mediaId, start, end);
    const buf = await c.withTypeMapping(blobAsBuffer).get(key);
    return buf;
  } catch {
    return null;
  }
}

export async function setCachedRange(
  mediaId: string,
  start: number,
  end: number,
  data: Buffer,
): Promise<void> {
  const c = await ensureRedis();
  if (!c) return;
  try {
    const key = cacheKey(mediaId, start, end);
    await c.set(key, data, { EX: config.streamCache.ttlSeconds });
  } catch {
    /* ignore cache write errors */
  }
}

export async function disconnectStreamCache(): Promise<void> {
  if (!client?.isOpen) return;
  try {
    await client.quit();
  } catch {
    /* ignore */
  }
  client = null;
  connectPromise = null;
}
