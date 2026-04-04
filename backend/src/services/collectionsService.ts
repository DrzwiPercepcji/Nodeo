/** Barrel: collections split under `./collections/`. */
export type {
  CollectionRow,
  CollectionWithUnlock,
  UpdateCollectionInput,
  UpdateCollectionResult,
  UnlockResult,
} from './collections/types.js';
export { listCollectionsWithUnlock, getCollectionById } from './collections/read.js';
export {
  createCollectionRecord,
  updateCollectionById,
  deleteCollectionCascade,
  unlockCollectionWithPassphrase,
} from './collections/mutations.js';
