import pool from '../../db/pool.js';
import { getCachedDek } from '../keyCache.js';
import type { CollectionRow, CollectionWithUnlock } from './types.js';

function withUnlockFlag<T extends { id: string; is_encrypted: boolean }>(row: T): T & { is_unlocked: boolean } {
  return {
    ...row,
    is_unlocked: row.is_encrypted ? getCachedDek(row.id) !== null : true,
  };
}

export async function listCollectionsWithUnlock(): Promise<CollectionWithUnlock[]> {
  const { rows } = await pool.query<CollectionRow>(
    `SELECT id, name, description, is_encrypted, cover_url, created_at, updated_at
     FROM collections ORDER BY created_at DESC`,
  );
  return rows.map(withUnlockFlag);
}

export async function getCollectionById(id: string): Promise<CollectionWithUnlock | null> {
  const { rows } = await pool.query<CollectionRow>(
    `SELECT id, name, description, is_encrypted, cover_url, created_at, updated_at
     FROM collections WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) return null;
  return withUnlockFlag(rows[0]!);
}
