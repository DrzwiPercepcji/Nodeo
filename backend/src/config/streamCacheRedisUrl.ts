/**
 * Stream-cache Redis connection string.
 * - `REDIS_URL` only — used as-is (may include DB: `redis://host:6379/2`).
 * - `REDIS_URL` + `REDIS_DB` — when `REDIS_DB` is a non-negative integer, path becomes `/${REDIS_DB}` (overrides any DB segment in the URL).
 */
export function resolveStreamCacheRedisUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const raw = env.REDIS_URL?.trim();
  if (!raw) return undefined;

  const dbRaw = env.REDIS_DB?.trim();
  if (dbRaw === undefined || dbRaw === '') return raw;

  const dbNum = parseInt(dbRaw, 10);
  if (!Number.isFinite(dbNum) || dbNum < 0) return raw;

  try {
    const u = new URL(raw);
    u.pathname = `/${dbNum}`;
    return u.href;
  } catch {
    return raw;
  }
}
