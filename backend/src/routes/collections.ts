import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  listCollectionsWithUnlock,
  createCollectionRecord,
  getCollectionById,
  updateCollectionById,
  deleteCollectionCascade,
  unlockCollectionWithPassphrase,
} from '../services/collectionsService.js';

const router = Router();
router.use(requireAuth);

function routeSingleParam(v: string | string[] | undefined): string {
  if (v === undefined) return '';
  return typeof v === 'string' ? v : (v[0] ?? '');
}

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await listCollectionsWithUnlock());
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

  const collection = await createCollectionRecord({
    name,
    description: description?.trim() ?? '',
    passphrase,
  });

  res.status(201).json(collection);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const collection = await getCollectionById(routeSingleParam(req.params.id));
  if (!collection) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }
  res.json(collection);
}));

router.put('/:id', validate([
  { field: 'name', maxLength: 200 },
  { field: 'description', maxLength: 2000 },
]), asyncHandler(async (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };

  const result = await updateCollectionById(routeSingleParam(req.params.id), { name, description });

  if (!result.ok) {
    if (result.reason === 'nothing_to_update') {
      res.status(400).json({ error: 'Nothing to update' });
      return;
    }
    res.status(404).json({ error: 'Collection not found' });
    return;
  }

  res.json(result.row);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await deleteCollectionCascade(routeSingleParam(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }
  res.status(204).end();
}));

router.post('/:id/unlock', validate([
  { field: 'passphrase', required: true, maxLength: 500 },
]), asyncHandler(async (req, res) => {
  const { passphrase } = req.body as { passphrase: string };

  const unlock = await unlockCollectionWithPassphrase(routeSingleParam(req.params.id), passphrase);

  if (unlock === 'not_found') {
    res.status(404).json({ error: 'Encrypted collection not found' });
    return;
  }
  if (unlock === 'wrong_passphrase') {
    res.status(403).json({ error: 'Wrong passphrase' });
    return;
  }

  res.json({ success: true });
}));

export default router;
