import pool from '../../db/pool.js';
import { createCollectionKeys, unwrapDek } from '../encryption.js';
import { cacheDek, getCachedDek, evictDek } from '../keyCache.js';
import * as s3 from '../s3.js';
import type {
  CollectionRow,
  CollectionWithUnlock,
  UpdateCollectionInput,
  UpdateCollectionResult,
  UnlockResult,
} from './types.js';

const PENDING_ID = 'pending';

export async function createCollectionRecord(input: {
  name: string;
  description: string;
  passphrase?: string;
}): Promise<CollectionWithUnlock> {
  const { name, description, passphrase } = input;
  const isEncrypted = !!passphrase;
  let encryptedDek: Buffer | null = null;
  let dekSalt: Buffer | null = null;
  let dekIv: Buffer | null = null;
  let verifyToken: Buffer | null = null;

  if (isEncrypted) {
    const keys = createCollectionKeys(passphrase!);
    encryptedDek = keys.encryptedDek;
    dekSalt = keys.salt;
    dekIv = keys.dekIv;
    verifyToken = keys.verifyToken;
    cacheDek(PENDING_ID, keys.dek);
  }

  const { rows } = await pool.query<CollectionRow>(
    `INSERT INTO collections (name, description, is_encrypted, encrypted_dek, dek_salt, dek_iv, verify_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, description, is_encrypted, cover_url, created_at, updated_at`,
    [name.trim(), description.trim(), isEncrypted, encryptedDek, dekSalt, dekIv, verifyToken],
  );

  const collection = rows[0]!;

  if (isEncrypted) {
    const dek = getCachedDek(PENDING_ID);
    evictDek(PENDING_ID);
    if (dek) cacheDek(collection.id, dek);
  }

  return { ...collection, is_unlocked: true };
}

export async function updateCollectionById(
  id: string,
  body: UpdateCollectionInput,
): Promise<UpdateCollectionResult> {
  const { name, description } = body;
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(name.trim());
  }
  if (description !== undefined) {
    updates.push(`description = $${idx++}`);
    values.push(description.trim());
  }

  if (updates.length === 0) {
    return { ok: false, reason: 'nothing_to_update' };
  }

  updates.push(`updated_at = now()`);
  values.push(id);

  const { rows } = await pool.query<CollectionRow>(
    `UPDATE collections SET ${updates.join(', ')} WHERE id = $${idx}
     RETURNING id, name, description, is_encrypted, cover_url, created_at, updated_at`,
    values,
  );

  if (rows.length === 0) {
    return { ok: false, reason: 'not_found' };
  }
  return { ok: true, row: rows[0]! };
}

/** Move all media keys to trash, delete collection row, evict DEK from cache. */
export async function deleteCollectionCascade(id: string): Promise<boolean> {
  const { rows: mediaRows } = await pool.query<{ s3_key: string; thumbnails: unknown }>(
    'SELECT s3_key, thumbnails FROM media WHERE collection_id = $1',
    [id],
  );
  for (const row of mediaRows) {
    await s3.moveMediaKeysToTrash(row.s3_key, row.thumbnails);
  }
  const { rowCount } = await pool.query('DELETE FROM collections WHERE id = $1', [id]);
  if (rowCount === 0) return false;
  evictDek(id);
  return true;
}

export async function unlockCollectionWithPassphrase(
  collectionId: string,
  passphrase: string,
): Promise<UnlockResult> {
  const { rows } = await pool.query<{
    encrypted_dek: Buffer;
    dek_salt: Buffer;
    dek_iv: Buffer;
    verify_token: Buffer;
  }>(
    'SELECT encrypted_dek, dek_salt, dek_iv, verify_token FROM collections WHERE id = $1 AND is_encrypted = true',
    [collectionId],
  );

  if (rows.length === 0) return 'not_found';

  const { encrypted_dek, dek_salt, dek_iv, verify_token } = rows[0]!;
  const dek = unwrapDek(passphrase, dek_salt, dek_iv, encrypted_dek, verify_token);

  if (!dek) return 'wrong_passphrase';

  cacheDek(collectionId, dek);
  return 'ok';
}
