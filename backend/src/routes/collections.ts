import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createCollectionKeys, unwrapDek } from '../services/encryption.js';
import { cacheDek, getCachedDek, evictDek } from '../services/keyCache.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, description, is_encrypted, cover_url, created_at, updated_at
     FROM collections ORDER BY created_at DESC`,
  );
  const collections = rows.map((r) => ({
    ...r,
    is_unlocked: r.is_encrypted ? getCachedDek(r.id) !== null : true,
  }));
  res.json(collections);
}));

router.post('/', validate([
  { field: 'name', required: true, maxLength: 200 },
  { field: 'description', maxLength: 2000 },
  { field: 'passphrase', maxLength: 500 },
]), asyncHandler(async (req, res) => {
  const { name, description, passphrase } = req.body as {
    name: string;
    description?: string;
    passphrase?: string;
  };

  const isEncrypted = !!passphrase;
  let encryptedDek: Buffer | null = null;
  let dekSalt: Buffer | null = null;
  let dekIv: Buffer | null = null;
  let verifyToken: Buffer | null = null;

  if (isEncrypted) {
    const keys = createCollectionKeys(passphrase);
    encryptedDek = keys.encryptedDek;
    dekSalt = keys.salt;
    dekIv = keys.dekIv;
    verifyToken = keys.verifyToken;
    cacheDek('pending', keys.dek);
  }

  const { rows } = await pool.query(
    `INSERT INTO collections (name, description, is_encrypted, encrypted_dek, dek_salt, dek_iv, verify_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, description, is_encrypted, cover_url, created_at, updated_at`,
    [name.trim(), description?.trim() || '', isEncrypted, encryptedDek, dekSalt, dekIv, verifyToken],
  );

  const collection = rows[0];

  if (isEncrypted) {
    const dek = getCachedDek('pending');
    evictDek('pending');
    if (dek) cacheDek(collection.id, dek);
  }

  res.status(201).json({ ...collection, is_unlocked: true });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, description, is_encrypted, cover_url, created_at, updated_at
     FROM collections WHERE id = $1`,
    [req.params.id],
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }

  const collection = rows[0];
  res.json({
    ...collection,
    is_unlocked: collection.is_encrypted ? getCachedDek(collection.id) !== null : true,
  });
}));

router.put('/:id', validate([
  { field: 'name', maxLength: 200 },
  { field: 'description', maxLength: 2000 },
]), asyncHandler(async (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };

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
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  updates.push(`updated_at = now()`);
  values.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE collections SET ${updates.join(', ')} WHERE id = $${idx}
     RETURNING id, name, description, is_encrypted, cover_url, created_at, updated_at`,
    values,
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }

  res.json(rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM collections WHERE id = $1', [req.params.id]);
  if (rowCount === 0) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }
  evictDek(req.params.id as string);
  res.status(204).end();
}));

router.post('/:id/unlock', validate([
  { field: 'passphrase', required: true, maxLength: 500 },
]), asyncHandler(async (req, res) => {
  const { passphrase } = req.body as { passphrase: string };

  const { rows } = await pool.query(
    'SELECT encrypted_dek, dek_salt, dek_iv, verify_token FROM collections WHERE id = $1 AND is_encrypted = true',
    [req.params.id],
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'Encrypted collection not found' });
    return;
  }

  const { encrypted_dek, dek_salt, dek_iv, verify_token } = rows[0];
  const dek = unwrapDek(passphrase, dek_salt, dek_iv, encrypted_dek, verify_token);

  if (!dek) {
    res.status(403).json({ error: 'Wrong passphrase' });
    return;
  }

  cacheDek(req.params.id as string, dek);
  res.json({ success: true });
}));

export default router;
