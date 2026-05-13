import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('../src/config.js', () => ({
  default: { dataDir: '/fake/data' },
}));

vi.mock('../src/services/ytdlpCookies.js', () => ({
  getYtdlpCookiesPath: () => '/fake/data/ytdlp-cookies.txt',
}));

vi.mock('../src/middleware/auth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import express from 'express';
import request from 'supertest';
import settingsRoutes from '../src/routes/settings.js';

const readFileMock = vi.mocked(readFile);
const writeFileMock = vi.mocked(writeFile);
const mkdirMock = vi.mocked(mkdir);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', settingsRoutes);
  return app;
}

describe('GET /api/settings/ytdlp-cookies', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns configured: true when cookie file has content', async () => {
    readFileMock.mockResolvedValue('# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\n');
    const res = await request(createApp()).get('/api/settings/ytdlp-cookies');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: true });
    expect(readFileMock).toHaveBeenCalledWith('/fake/data/ytdlp-cookies.txt', 'utf-8');
  });

  it('returns configured: false when cookie file is empty', async () => {
    readFileMock.mockResolvedValue('   \n');
    const res = await request(createApp()).get('/api/settings/ytdlp-cookies');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: false });
  });

  it('returns configured: false when cookie file does not exist', async () => {
    readFileMock.mockRejectedValue(new Error('ENOENT'));
    const res = await request(createApp()).get('/api/settings/ytdlp-cookies');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: false });
  });
});

describe('PUT /api/settings/ytdlp-cookies', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves cookie content and returns configured: true', async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);

    const cookieData = '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tFALSE\t0\tSID\tvalue\n';
    const res = await request(createApp())
      .put('/api/settings/ytdlp-cookies')
      .send({ cookies: cookieData });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: true });
    expect(mkdirMock).toHaveBeenCalledWith('/fake/data', { recursive: true });
    expect(writeFileMock).toHaveBeenCalledWith('/fake/data/ytdlp-cookies.txt', cookieData, 'utf-8');
  });

  it('returns configured: false when saving empty string', async () => {
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);

    const res = await request(createApp())
      .put('/api/settings/ytdlp-cookies')
      .send({ cookies: '  ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: false });
  });

  it('returns 400 when cookies field is missing', async () => {
    const res = await request(createApp())
      .put('/api/settings/ytdlp-cookies')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'cookies field is required (string)' });
  });

  it('returns 400 when cookies is not a string', async () => {
    const res = await request(createApp())
      .put('/api/settings/ytdlp-cookies')
      .send({ cookies: 123 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'cookies field is required (string)' });
  });
});

describe('getYtdlpCookiesPath (from ytdlpCookies service)', () => {
  it('returns path under dataDir', async () => {
    const { getYtdlpCookiesPath } = await import('../src/services/ytdlpCookies.js');
    expect(getYtdlpCookiesPath()).toBe('/fake/data/ytdlp-cookies.txt');
  });
});
