import { useState, useCallback } from 'react';
import {
  doc, getDoc, updateDoc, deleteDoc, where, getDocs, getCountFromServer, setDoc, FieldPath, query
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { sanitizeTicketId, sanitizeNote } from '../utils/helpers.js';
import { showUndoToast, normalizeForRestore } from '../utils/undoToast.jsx';
import { commitInChunks } from '../utils/firestore.js';
import { SESSION_STATUS } from '../constants.js';

/**
 * Ticket-level and session-level mutations: close/reopen, single and bulk
 * delete (with confirm state), bulk status changes, session reallocation,
 * ticket renames, and note edits. Owns the confirmation-modal and inline-edit
 * state that backs those flows.
 */
export function useTicketActions({
  getCollectionRef,
  getTicketStatusCollectionRef,
  db,
  logs,
  ticketStatuses,
  setTicketStatuses,
  selectedSessions,
  setSelectedSessions,
  exportedSessionIds,
  setExportedSessionIds,
  userId,
  setIsActionLoading,
  runAsync,
}) {
  // --- Inline Editing State ---
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editingTicketValue, setEditingTicketValue] = useState('');
  const [editingSessionNote, setEditingSessionNote] = useState(null);
  const [editingSessionNoteValue, setEditingSessionNoteValue] = useState('');

  // --- Confirm / Modal State ---
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [logToDelete, setLogToDelete] = useState(null);
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [ticketDeleteCount, setTicketDeleteCount] = useState(null);
  const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false);
  const [isReallocateModalOpen, setIsReallocateModalOpen] = useState(false);
  const [reallocatingSessionInfo, setReallocatingSessionInfo] = useState(null);

  const handleCloseTicket = useCallback(async (ticketId) => {
    if (!getTicketStatusCollectionRef) return;
    const loadingToast = toast.loading('Closing ticket...');
    const statusEntry = ticketStatuses[ticketId];

    try {
      const targetDocId = statusEntry?.id || ticketId;
      await setDoc(
        doc(getTicketStatusCollectionRef, targetDocId),
        { ticketId, isClosed: true, createdBy: userId },
        { merge: true }
      );
      setTicketStatuses((prev) => ({ ...prev, [ticketId]: { id: targetDocId, isClosed: true } }));
      toast.success('Ticket closed', { id: loadingToast, duration: 3000 });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error closing ticket:', error);
      toast.error('Failed to close ticket', { id: loadingToast, duration: 4000 });
    }
  }, [getTicketStatusCollectionRef, ticketStatuses, setTicketStatuses, userId]);

  const handleReopenTicket = useCallback(async (ticketId) => {
    if (!getTicketStatusCollectionRef) return;
    const loadingToast = toast.loading('Reopening ticket...');
    const statusEntry = ticketStatuses[ticketId];

    try {
      const targetDocId = statusEntry?.id || ticketId;
      await setDoc(
        doc(getTicketStatusCollectionRef, targetDocId),
        { ticketId, isClosed: false, createdBy: userId },
        { merge: true }
      );
      setTicketStatuses((prev) => ({ ...prev, [ticketId]: { id: targetDocId, isClosed: false } }));
      toast.success('Ticket reopened', { id: loadingToast, duration: 3000 });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error reopening ticket:', error);
      toast.error('Failed to reopen ticket', { id: loadingToast, duration: 4000 });
    }
  }, [getTicketStatusCollectionRef, ticketStatuses, setTicketStatuses, userId]);

  const handleDeleteClick = useCallback((session) => {
    setLogToDelete(session);
    setIsConfirmingDelete(true);
  }, []);

  const handleDeleteTicketClick = useCallback(async (ticketId) => {
    setTicketToDelete(ticketId);
    setTicketDeleteCount(null);
    setIsConfirmingDelete(true);
    if (!getCollectionRef) return;
    try {
      // Aggregate count instead of getDocs: counts every matching session
      // without downloading the documents.
      const countSnapshot = await getCountFromServer(
        query(getCollectionRef, where('ticketId', '==', ticketId))
      );
      setTicketDeleteCount(countSnapshot.data().count);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Could not count ticket sessions:', error);
      setTicketDeleteCount(logs.filter((l) => l.ticketId === ticketId).length);
    }
  }, [getCollectionRef, logs]);

  const handleCancelDelete = useCallback(() => {
    setIsConfirmingDelete(false);
    setLogToDelete(null);
    setTicketToDelete(null);
    setTicketDeleteCount(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if ((!logToDelete && !ticketToDelete) || !getCollectionRef) return;

    setIsConfirmingDelete(false);
    setIsActionLoading(true);

    try {
      if (ticketToDelete) {
        const sessionsQuery = query(getCollectionRef, where('ticketId', '==', ticketToDelete));
        const sessionSnapshots = await getDocs(sessionsQuery);
        const deletedSessions = sessionSnapshots.docs.map((d) => ({ id: d.id, data: d.data() }));
        const operations = sessionSnapshots.docs.map((d) => ({ ref: d.ref, type: 'delete' }));

        const deletedStatuses = [];
        if (getTicketStatusCollectionRef) {
          try {
            const statusQuery = query(getTicketStatusCollectionRef, where('ticketId', '==', ticketToDelete));
            const statusSnapshots = await getDocs(statusQuery);
            statusSnapshots.docs.forEach((d) => {
              operations.push({ ref: d.ref, type: 'delete' });
              deletedStatuses.push({ id: d.id, data: d.data() });
            });
          } catch (statusError) {
            if (import.meta.env.DEV) console.warn('Could not query ticket status:', statusError);
          }
        }
        await commitInChunks(db, operations);
        setSelectedSessions((prevSelected) => {
          const newSelected = new Set(prevSelected);
          deletedSessions.forEach(({ id }) => newSelected.delete(id));
          return newSelected;
        });
        const collectionRef = getCollectionRef;
        const statusCollectionRef = getTicketStatusCollectionRef;
        const deletedTicketId = ticketToDelete;
        showUndoToast(`Deleted ticket ${deletedTicketId} and ${deletedSessions.length} session(s)`, async () => {
          const restoreOps = deletedSessions.map(({ id, data }) => ({
            ref: doc(collectionRef, id),
            data: normalizeForRestore(data),
            type: 'set',
          }));
          if (statusCollectionRef) {
            deletedStatuses.forEach(({ id, data }) => {
              restoreOps.push({ ref: doc(statusCollectionRef, id), data, type: 'set' });
            });
          }
          await commitInChunks(db, restoreOps);
        }, { undoMessage: `Ticket ${deletedTicketId} and its sessions restored`, ticketId: deletedTicketId });
      } else if (logToDelete) {
        const sessionRef = doc(getCollectionRef, logToDelete.id);
        const snapshot = await getDoc(sessionRef);
        const rawData = snapshot.exists() ? snapshot.data() : null;
        await deleteDoc(sessionRef);
        setSelectedSessions((prevSelected) => {
          if (!prevSelected.has(logToDelete.id)) return prevSelected;
          const newSelected = new Set(prevSelected);
          newSelected.delete(logToDelete.id);
          return newSelected;
        });
        if (rawData) {
          const deletedTicketId = logToDelete.ticketId;
          showUndoToast(`Deleted session for ${deletedTicketId}`, async () => {
            await setDoc(sessionRef, normalizeForRestore(rawData));
          }, { ticketId: deletedTicketId });
        } else {
          toast.success('Session deleted');
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error deleting:', error);
      toast.error('Failed to delete. Please try again.');
    } finally {
      setLogToDelete(null);
      setTicketToDelete(null);
      setTicketDeleteCount(null);
      setIsActionLoading(false);
    }
  }, [logToDelete, ticketToDelete, getCollectionRef, getTicketStatusCollectionRef, setSelectedSessions, db, setIsActionLoading]);

  const handleBulkDelete = useCallback(() => {
    if (!getCollectionRef || selectedSessions.size === 0) return;
    setIsConfirmingBulkDelete(true);
  }, [getCollectionRef, selectedSessions]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (!getCollectionRef || selectedSessions.size === 0) return;
    setIsConfirmingBulkDelete(false);

    try {
      setIsActionLoading(true);
      const sessionIds = Array.from(selectedSessions);
      // Read the selected docs in 30-id chunks (whereIn limit) instead of one
      // getDoc per session, keeping the read count to ceil(n/30).
      const snapshots = [];
      for (let i = 0; i < sessionIds.length; i += 30) {
        const chunk = sessionIds.slice(i, i + 30);
        const snap = await getDocs(query(getCollectionRef, where(FieldPath.documentId(), 'in', chunk)));
        snap.docs.forEach((d) => snapshots.push(d));
      }
      const deletedDocs = snapshots
        .filter((s) => s.exists())
        .map((s) => ({ id: s.id, data: s.data() }));
      await runAsync(async () => {
        await commitInChunks(db, sessionIds.map((id) => ({ ref: doc(getCollectionRef, id), type: 'delete' })));
        setSelectedSessions(new Set());
      });
      const collectionRef = getCollectionRef;
      showUndoToast(`Deleted ${deletedDocs.length} session(s)`, async () => {
        await commitInChunks(db, deletedDocs.map(({ id, data }) => ({
          ref: doc(collectionRef, id),
          data: normalizeForRestore(data),
          type: 'set',
        })));
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error deleting sessions:', error);
      toast.error('Failed to delete some sessions.');
    } finally {
      setIsActionLoading(false);
    }
  }, [getCollectionRef, selectedSessions, runAsync, setSelectedSessions, db, setIsActionLoading]);

  const captureStatuses = useCallback((sessionIds) => {
    const previous = new Map();
    sessionIds.forEach((id) => {
      const log = logs.find((l) => l.id === id);
      if (log) previous.set(id, { status: log.status, submissionDate: log.submissionDate ?? null });
    });
    return previous;
  }, [logs]);

  const handleBulkStatusChange = useCallback(async (newStatus) => {
    if (!getCollectionRef || selectedSessions.size === 0) return;

    setIsActionLoading(true);
    try {
      const sessionIds = Array.from(selectedSessions);
      const previousStatuses = captureStatuses(sessionIds);
      // Batched writes instead of one updateDoc per session: ceil(n/450)
      // round trips instead of n.
      const operations = sessionIds.map((sessionId) => ({
        ref: doc(getCollectionRef, sessionId),
        data: {
          status: newStatus,
          submissionDate: newStatus === SESSION_STATUS.SUBMITTED ? Date.now() : null,
        },
      }));
      await commitInChunks(db, operations);
      setSelectedSessions(new Set());
      const collectionRef = getCollectionRef;
      const submitHint = newStatus === SESSION_STATUS.SUBMITTED
        ? ' — hidden by default; view via the Submitted filter'
        : '';
      showUndoToast(`Marked ${sessionIds.length} session(s) as ${newStatus}${submitHint}`, async () => {
        await commitInChunks(db, Array.from(previousStatuses, ([id, prev]) => ({
          ref: doc(collectionRef, id),
          data: { status: prev.status, submissionDate: prev.submissionDate },
        })));
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error updating session status:', error);
      toast.error('Failed to update some sessions');
    } finally {
      setIsActionLoading(false);
    }
  }, [getCollectionRef, selectedSessions, captureStatuses, setSelectedSessions, setIsActionLoading, db]);

  const handleOpenReallocate = useCallback((sessionId, ticketId) => {
    setReallocatingSessionInfo({ sessionId, currentTicketId: ticketId });
    setIsReallocateModalOpen(true);
  }, []);

  const handleReallocateSession = useCallback(async (sessionId, newTicketId) => {
    const sanitizedTicketId = sanitizeTicketId(newTicketId);
    if (!sessionId || !sanitizedTicketId || !getCollectionRef) return;

    setIsActionLoading(true);
    try {
      const sessionRef = doc(getCollectionRef, sessionId);
      const previousTicketId = reallocatingSessionInfo?.currentTicketId;
      await updateDoc(sessionRef, { ticketId: sanitizedTicketId });
      if (previousTicketId && previousTicketId !== sanitizedTicketId) {
        showUndoToast(`Moved session to ${sanitizedTicketId}`, async () => {
          await updateDoc(doc(getCollectionRef, sessionId), { ticketId: previousTicketId });
        }, { undoMessage: `Session moved back to ${previousTicketId}`, ticketId: previousTicketId });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error reallocating session:', error);
      toast.error('Failed to move session. Please try again.');
    } finally {
      setIsReallocateModalOpen(false);
      setReallocatingSessionInfo(null);
      setIsActionLoading(false);
    }
  }, [getCollectionRef, reallocatingSessionInfo, setIsActionLoading]);

  const handleUpdateTicketId = useCallback(async (oldTicketId, newTicketId) => {
    const sanitizedNewTicketId = sanitizeTicketId(newTicketId);
    if (!sanitizedNewTicketId || oldTicketId === sanitizedNewTicketId || !getCollectionRef || !getTicketStatusCollectionRef) {
      setEditingTicketId(null);
      return;
    }

    setIsActionLoading(true);
    try {
      const operations = [];
      const sessionsQuery = query(getCollectionRef, where('ticketId', '==', oldTicketId));
      const sessionSnapshots = await getDocs(sessionsQuery);
      sessionSnapshots.forEach((d) => {
        operations.push({ ref: d.ref, data: { ticketId: sanitizedNewTicketId } });
      });

      const statusQuery = query(getTicketStatusCollectionRef, where('ticketId', '==', oldTicketId));
      const statusSnapshots = await getDocs(statusQuery);
      statusSnapshots.forEach((d) => {
        operations.push({ ref: d.ref, data: { ticketId: sanitizedNewTicketId } });
      });

      await commitInChunks(db, operations);

      const renamedSessionRefs = sessionSnapshots.docs.map((d) => d.ref);
      const renamedStatusRefs = statusSnapshots.docs.map((d) => d.ref);
      const renamedFrom = oldTicketId;
      const renamedTo = sanitizedNewTicketId;
      const renamedCount = sessionSnapshots.size;
      showUndoToast(`Renamed ${renamedFrom} → ${renamedTo} (${renamedCount} session${renamedCount !== 1 ? 's' : ''})`, async () => {
        // Revert only the docs captured at rename time, and only if they
        // still carry the new ID — a later rename or a pre-existing ticket
        // with the same ID must not be swept into the revert.
        const currentDocs = await Promise.all(
          [...renamedSessionRefs, ...renamedStatusRefs].map((ref) => getDoc(ref))
        );
        const revertOps = [];
        currentDocs.forEach((snap) => {
          if (snap.exists() && snap.data().ticketId === renamedTo) {
            revertOps.push({ ref: snap.ref, data: { ticketId: renamedFrom } });
          }
        });
        if (revertOps.length === 0) {
          return `Nothing to restore — ${renamedTo} was changed again afterwards`;
        }
        await commitInChunks(db, revertOps);
        return `Restored ${revertOps.length} record(s) to ${renamedFrom}`;
      }, { ticketId: renamedFrom });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error updating ticket ID:', error);
      toast.error('Failed to update ticket ID. Please try again.');
    } finally {
      setEditingTicketId(null);
      setEditingTicketValue('');
      setIsActionLoading(false);
    }
  }, [getCollectionRef, getTicketStatusCollectionRef, db, setIsActionLoading]);

  const handleUpdateSessionNote = useCallback(async (sessionId, newNote) => {
    const sanitizedNote = sanitizeNote(newNote);
    if (!getCollectionRef) {
      setEditingSessionNote(null);
      return;
    }

    setIsActionLoading(true);
    try {
      const previousNote = logs.find((l) => l.id === sessionId)?.note ?? null;
      await updateDoc(doc(getCollectionRef, sessionId), { note: sanitizedNote });
      if (previousNote !== null && previousNote !== sanitizedNote) {
        showUndoToast('Note updated', async () => {
          await updateDoc(doc(getCollectionRef, sessionId), { note: previousNote });
        }, { undoMessage: 'Previous note restored' });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error updating session note:', error);
      toast.error('Failed to update session note. Please try again.');
    } finally {
      setEditingSessionNote(null);
      setEditingSessionNoteValue('');
      setIsActionLoading(false);
    }
  }, [getCollectionRef, logs]);

  const handleMarkAsSubmitted = useCallback(async () => {
    const finalSessionIds = new Set(selectedSessions);
    exportedSessionIds.forEach((sessionId) => finalSessionIds.add(sessionId));
    if (finalSessionIds.size === 0 || !getCollectionRef || !db) return;

    setIsActionLoading(true);
    try {
      const previousStatuses = captureStatuses(Array.from(finalSessionIds));
      const operations = [];
      const now = Date.now();
      finalSessionIds.forEach((sessionId) => {
        const docRef = doc(getCollectionRef, sessionId);
        operations.push({ ref: docRef, data: { status: SESSION_STATUS.SUBMITTED, submissionDate: now } });
      });
      await commitInChunks(db, operations);
      setSelectedSessions(new Set());
      setExportedSessionIds(new Set());
      const collectionRef = getCollectionRef;
      showUndoToast(`Marked ${finalSessionIds.size} session(s) as submitted — hidden by default; view via the Submitted filter`, async () => {
        await commitInChunks(db, Array.from(previousStatuses, ([id, prev]) => ({
          ref: doc(collectionRef, id),
          data: { status: prev.status, submissionDate: prev.submissionDate },
        })));
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error marking sessions as submitted:', error);
      toast.error('Failed to mark sessions as submitted. Please try again.');
      return false;
    } finally {
      setIsActionLoading(false);
    }
  }, [selectedSessions, exportedSessionIds, getCollectionRef, captureStatuses, setSelectedSessions, setExportedSessionIds, db, setIsActionLoading]);

  const handleMarkAsUnsubmitted = useCallback(async () => {
    if (selectedSessions.size === 0 || !getCollectionRef) return;

    setIsActionLoading(true);
    try {
      const previousStatuses = captureStatuses(Array.from(selectedSessions));
      const operations = [];
      selectedSessions.forEach((sessionId) => {
        const docRef = doc(getCollectionRef, sessionId);
        operations.push({ ref: docRef, data: { status: SESSION_STATUS.UNSUBMITTED, submissionDate: null } });
      });
      await commitInChunks(db, operations);
      setSelectedSessions(new Set());
      const collectionRef = getCollectionRef;
      showUndoToast(`Marked ${selectedSessions.size} session(s) as unsubmitted`, async () => {
        await commitInChunks(db, Array.from(previousStatuses, ([id, prev]) => ({
          ref: doc(collectionRef, id),
          data: { status: prev.status, submissionDate: prev.submissionDate },
        })));
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error marking sessions as unsubmitted:', error);
      toast.error('Failed to mark sessions as unsubmitted. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  }, [selectedSessions, getCollectionRef, captureStatuses, setSelectedSessions, setIsActionLoading]);

  return {
    // inline editing state
    editingTicketId, setEditingTicketId,
    editingTicketValue, setEditingTicketValue,
    editingSessionNote, setEditingSessionNote,
    editingSessionNoteValue, setEditingSessionNoteValue,
    // confirm state
    isConfirmingDelete, isConfirmingBulkDelete, setIsConfirmingBulkDelete,
    logToDelete, ticketToDelete, ticketDeleteCount,
    // reallocate modal state
    isReallocateModalOpen, setIsReallocateModalOpen, reallocatingSessionInfo,
    // handlers
    handleCloseTicket,
    handleReopenTicket,
    handleDeleteClick,
    handleDeleteTicketClick,
    handleCancelDelete,
    handleConfirmDelete,
    handleBulkDelete,
    handleConfirmBulkDelete,
    captureStatuses,
    handleBulkStatusChange,
    handleOpenReallocate,
    handleReallocateSession,
    handleUpdateTicketId,
    handleUpdateSessionNote,
    handleMarkAsSubmitted,
    handleMarkAsUnsubmitted,
  };
}
