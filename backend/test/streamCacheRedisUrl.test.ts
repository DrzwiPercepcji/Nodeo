import { describe, it, expect } from 'vitest';
import { resolveStreamCacheRedisUrl } from '../src/config/streamCacheRedisUrl.js';

describe('resolveStreamCacheRedisUrl', () => {
  it('returns undefined when REDIS_URL missing', () => {
    expect(resolveStreamCacheRedisUrl({})).toBeUndefined();
  });

  it('returns URL unchanged when REDIS_DB unset', () => {
    expect(
      resolveStreamCacheRedisUrl({ REDIS_URL: 'redis://redis:6379/0' }),
    ).toBe('redis://redis:6379/0');
  });

  it('appends DB path when REDIS_DB set', () => {
    expect(
      resolveStreamCacheRedisUrl({ REDIS_URL: 'redis://localhost:6379', REDIS_DB: '2' }),
    ).toBe('redis://localhost:6379/2');
  });

  it('REDIS_DB overrides DB in URL', () => {
    expect(
      resolveStreamCacheRedisUrl({ REDIS_URL: 'redis://h:6379/0', REDIS_DB: '3' }),
    ).toBe('redis://h:6379/3');
  });

  it('ignores invalid REDIS_DB', () => {
    expect(
      resolveStreamCacheRedisUrl({ REDIS_URL: 'redis://h:6379/1', REDIS_DB: 'x' }),
    ).toBe('redis://h:6379/1');
  });
});
