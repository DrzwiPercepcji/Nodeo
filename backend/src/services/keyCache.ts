const TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  dek: Buffer;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedDek(collectionId: string): Buffer | null {
  const entry = cache.get(collectionId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(collectionId);
    return null;
  }
  return entry.dek;
}

export function cacheDek(collectionId: string, dek: Buffer): void {
  cache.set(collectionId, { dek, expiresAt: Date.now() + TTL_MS });
}

export function evictDek(collectionId: string): void {
  cache.delete(collectionId);
}
