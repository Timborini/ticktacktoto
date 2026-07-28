/**
 * Firestore batching helper: commit a large list of operations in chunks
 * to stay within Firestore's 500-operation-per-batch limit.
 * Each operation is { ref, data } for an update, { ref, data, type: 'set' }
 * for a full-document set (used to restore deleted docs), or
 * { ref, type: 'delete' }.
 */
import { writeBatch, query, getDocs, orderBy, limit, startAfter } from 'firebase/firestore';
import { BATCH_CHUNK_SIZE } from '../constants.js';

export async function commitInChunks(db, operations) {
  for (let i = 0; i < operations.length; i += BATCH_CHUNK_SIZE) {
    const batch = writeBatch(db);
    operations.slice(i, i + BATCH_CHUNK_SIZE).forEach((op) => {
      if (op.type === 'delete') batch.delete(op.ref);
      else if (op.type === 'set') batch.set(op.ref, op.data);
      else batch.update(op.ref, op.data);
    });
    await batch.commit();
  }
}

/**
 * Fetch every document in a collection ordered by endTime descending,
 * paging through the collection. Used by "export all" so exports are
 * complete even when the realtime listener only holds a bounded window.
 */
export async function fetchAllByEndTimeDesc(collectionRef, pageSize = BATCH_CHUNK_SIZE) {
  const docs = [];
  let lastVisible = null;
  for (;;) {
    const constraints = [orderBy('endTime', 'desc'), limit(pageSize)];
    if (lastVisible) constraints.push(startAfter(lastVisible));
    const snapshot = await getDocs(query(collectionRef, ...constraints));
    snapshot.docs.forEach((d) => docs.push(d));
    if (snapshot.docs.length < pageSize) break;
    lastVisible = snapshot.docs[snapshot.docs.length - 1];
  }
  return docs;
}
