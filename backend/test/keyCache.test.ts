import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyCache } from '../src/services/keyCache.js';

describe('KeyCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when empty', () => {
    const cache = new KeyCache(60_000);
    expect(cache.get('c1')).toBeNull();
  });

  it('returns the DEK before TTL expires', () => {
    const cache = new KeyCache(60_000);
    const dek = Buffer.from('01234567890123456789012345678901');
    cache.set('c1', dek);
    expect(cache.get('c1')?.equals(dek)).toBe(true);
  });

  it('drops entry after TTL', () => {
    const cache = new KeyCache(1000);
    cache.set('c1', Buffer.alloc(32, 1));
    vi.advanceTimersByTime(1001);
    expect(cache.get('c1')).toBeNull();
  });

  it('evict removes the entry', () => {
    const cache = new KeyCache(60_000);
    cache.set('c1', Buffer.alloc(32, 2));
    cache.evict('c1');
    expect(cache.get('c1')).toBeNull();
  });
});
