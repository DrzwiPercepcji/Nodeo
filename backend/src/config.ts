import 'dotenv/config';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveStreamCacheRedisUrl } from './config/streamCacheRedisUrl.js';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const defaultStreamCacheTtl = 30 * 60;
const defaultStreamCacheMaxRange = 8 * 1024 * 1024;

const config = {
  port: parseInt(process.env.BACKEND_PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  /** Upload / transcode scratch space (Docker: mount a volume here, e.g. /data/nodeo-tmp). */
  tempDir: process.env.NODEO_TEMP_DIR?.trim() || join(tmpdir(), 'nodeo-uploads'),

  /**
   * Optional Redis cache for media stream byte ranges (plaintext after decrypt).
   * If `redisUrl` is unset or empty, caching is disabled.
   * URL from `REDIS_URL` + optional `REDIS_DB` — see `config/streamCacheRedisUrl.ts`.
   */
  streamCache: {
    redisUrl: resolveStreamCacheRedisUrl(),
    ttlSeconds: Math.max(
      60,
      parsePositiveInt(process.env.STREAM_CACHE_TTL_SECONDS, defaultStreamCacheTtl),
    ),
    maxRangeBytes: Math.min(
      64 * 1024 * 1024,
      Math.max(
        256 * 1024,
        parsePositiveInt(process.env.STREAM_CACHE_MAX_RANGE_BYTES, defaultStreamCacheMaxRange),
      ),
    ),
  },

  db: {
    host: required('POSTGRES_HOST'),
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: required('POSTGRES_DB'),
    user: required('POSTGRES_USER'),
    password: required('POSTGRES_PASSWORD'),
  },

  auth: {
    username: required('AUTH_USERNAME'),
    passwordHash: required('AUTH_PASSWORD_HASH'),
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: '90d' as const,
    loginRateLimitMax: parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 5),
  },

  /** Directory for persistent app data (settings, cookies, etc.). Docker: mount a volume. */
  dataDir: process.env.NODEO_DATA_DIR?.trim() || join(tmpdir(), 'nodeo-data'),

  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'eu-central-1',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    endpoint: process.env.S3_ENDPOINT || undefined,
    /** e.g. INTELLIGENT_TIERING on AWS; leave unset for MinIO (Standard). */
    storageClass: process.env.S3_STORAGE_CLASS?.trim() || undefined,
  },
};

export default config;
