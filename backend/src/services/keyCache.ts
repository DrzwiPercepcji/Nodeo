const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  dek: Buffer;
  expiresAt: number;
}

/**
 * In-memory DEK cache with TTL. Use the default singleton via exported helpers,
 * or construct with {@link KeyCache} for isolated tests.
 */
export class KeyCache {
  private readonly map = new Map<string, CacheEntry>();

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  get(collectionId: string): Buffer | null {
    const entry = this.map.get(collectionId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(collectionId);
      return null;
    }
    return entry.dek;
  }

  set(collectionId: string, dek: Buffer): void {
    this.map.set(collectionId, { dek, expiresAt: Date.now() + this.ttlMs });
  }

  evict(collectionId: string): void {
    this.map.delete(collectionId);
  }
}

const defaultCache = new KeyCache();

export function getCachedDek(collectionId: string): Buffer | null {
  return defaultCache.get(collectionId);
}

export function cacheDek(collectionId: string, dek: Buffer): void {
  defaultCache.set(collectionId, dek);
}

export function evictDek(collectionId: string): void {
  defaultCache.evict(collectionId);
}
