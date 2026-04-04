import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, unlink } from 'node:fs/promises';

export const TEMP_DIR = join(tmpdir(), 'nodeo-uploads');

export async function ensureTempDir(): Promise<void> {
  await mkdir(TEMP_DIR, { recursive: true });
}

export async function cleanupFiles(...paths: string[]): Promise<void> {
  for (const p of paths) {
    try { await unlink(p); } catch { /* ignore */ }
  }
}
