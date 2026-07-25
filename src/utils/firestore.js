/**
 * Firestore batching helper: commit a large list of update operations in chunks
 * to stay within Firestore's 500-operation-per-batch limit.
 */
import { writeBatch } from 'firebase/firestore';
import { BATCH_CHUNK_SIZE } from '../constants.js';

export async function commitInChunks(db, operations) {
  for (let i = 0; i < operations.length; i += BATCH_CHUNK_SIZE) {
    const batch = writeBatch(db);
    operations.slice(i, i + BATCH_CHUNK_SIZE).forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
  }
}
