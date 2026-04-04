import { mkdir, unlink } from 'node:fs/promises';
import config from '../../config.js';

export const TEMP_DIR = config.tempDir;

export async function ensureTempDir(): Promise<void> {
  await mkdir(TEMP_DIR, { recursive: true });
}

export async function cleanupFiles(...paths: string[]): Promise<void> {
  for (const p of paths) {
    try { await unlink(p); } catch { /* ignore */ }
  }
}
