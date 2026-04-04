export type CollectionRow = {
  id: string;
  name: string;
  description: string;
  is_encrypted: boolean;
  cover_url: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CollectionWithUnlock = CollectionRow & { is_unlocked: boolean };

export type UpdateCollectionInput = { name?: string; description?: string };

export type UpdateCollectionResult =
  | { ok: true; row: CollectionRow }
  | { ok: false; reason: 'nothing_to_update' | 'not_found' };

export type UnlockResult = 'not_found' | 'wrong_passphrase' | 'ok';
