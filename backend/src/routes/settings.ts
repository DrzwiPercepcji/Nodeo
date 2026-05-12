import { Router } from 'express';
import type { Request, Response } from 'express';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getYtdlpCookiesPath } from '../services/ytdlpCookies.js';

const router = Router();
router.use(requireAuth);

router.get('/settings/ytdlp-cookies', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const content = await readFile(getYtdlpCookiesPath(), 'utf-8');
    const hasContent = content.trim().length > 0;
    res.json({ configured: hasContent });
  } catch {
    res.json({ configured: false });
  }
}));

router.put('/settings/ytdlp-cookies', asyncHandler(async (req: Request, res: Response) => {
  const { cookies } = req.body as { cookies?: string };
  if (typeof cookies !== 'string') {
    res.status(400).json({ error: 'cookies field is required (string)' });
    return;
  }

  const filePath = getYtdlpCookiesPath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, cookies, 'utf-8');

  res.json({ configured: cookies.trim().length > 0 });
}));

export default router;
