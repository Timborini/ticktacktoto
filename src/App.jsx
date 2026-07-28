import { useState, useEffect, useCallback, useMemo, useRef, startTransition, lazy, Suspense } from 'react';
import {
  AlertTriangle, Loader, X, Sun, Moon, Info, User, LogOut
} from 'lucide-react';
import {
  collection, query, doc, getDoc, updateDoc, deleteDoc, where, getDocs, setDoc
} from 'firebase/firestore';

// --- Services & Context ---
import { db, dataAppId, dataAppIdIsValid, missingFirebaseVars } from './services/firebase.js';
import { initErrorReporting, reportError } from './services/errorReporting.js';
import { useAuth, AuthProvider } from './context/AuthContext.jsx';
import { ConfigError } from './components/ConfigError.jsx';

// --- Hooks ---
import { useTimer } from './hooks/useTimer.js';
import { useRecentTickets } from './hooks/useRecentTickets.js';
import { useFilterUrlSync } from './hooks/useFilterUrlSync.js';
import { useLogs, toLog } from './hooks/useLogs.js';
import { useTicketStatuses } from './hooks/useTicketStatuses.js';

// --- Utilities ---
import toast, { Toaster } from 'react-hot-toast';
import useAsyncAction from './utils/useAsyncAction.js';
import { commitInChunks, fetchAllByEndTimeDesc } from './utils/firestore.js';
import { showUndoToast, normalizeForRestore, runLastUndo } from './utils/undoToast.jsx';
import { performExport } from './features/export/exportHelpers.js';
import { formatTime, sanitizeTicketId, sanitizeNote, toLocalDateString } from './utils/helpers.js';
import {
  STATUS_FILTERS,
  SESSION_STATUS,
  STORAGE_KEYS,
  MAX_USER_TITLE_LENGTH,
} from './constants.js';

// --- Components ---
import { InstructionsContent } from './components/InstructionsContent.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { isAnyModalOpen } from './components/modalState.js';
import TimerSection from './components/TimerSection.jsx';
import SessionList from './components/SessionList.jsx';
import StatsDashboard from './components/StatsDashboard.jsx';
import FilterBar from './components/FilterBar.jsx';

const ConfirmationModal = lazy(() => import('./components/ConfirmationModal.jsx'));
const ReallocateModal = lazy(() => import('./components/ReallocateModal.jsx'));
const ReportModal = lazy(() => import('./components/ReportModal.jsx'));
const WelcomeModal = lazy(() => import('./components/WelcomeModal.jsx'));
const ExportConfirmModal = lazy(() => import('./components/ExportConfirmModal.jsx'));

const App = () => {
  const { user, userId, isAuthReady, firebaseError: authError, clearFirebaseError, handleGoogleLogin, handleLogout } = useAuth();

  // --- Error Monitoring ---
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  useEffect(() => {
    if (db) initErrorReporting({ db, getUserId: () => userIdRef.current });
  }, []);

  // --- URL Sync ---
  const {
    statusFilter, setStatusFilter,
    searchQuery, setSearchQuery,
    dateRangeStart, setDateRangeStart,
    dateRangeEnd, setDateRangeEnd,
    shareId,
  } = useFilterUrlSync();

  // --- Inline Editing State ---
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editingTicketValue, setEditingTicketValue] = useState('');
  const [editingSessionNote, setEditingSessionNote] = useState(null);
  const [editingSessionNoteValue, setEditingSessionNoteValue] = useState('');

  // --- App State ---
  const [currentTicketId, setCurrentTicketId] = useState('');
  const [currentNote, setCurrentNote] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [userTitle, setUserTitle] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER_TITLE);
      if (saved && typeof saved === 'string' && saved.length <= MAX_USER_TITLE_LENGTH) return saved;
    } catch {}
    return '';
  });

  // --- Filter & Selection State ---
  const [dateFilter, setDateFilter] = useState('');
  const [selectedSessions, setSelectedSessions] = useState(new Set());
  const [exportOption, setExportOption] = useState('');
  const [exportFormat, setExportFormat] = useState('');
  const [exportedSessionIds, setExportedSessionIds] = useState(new Set());
  const [pendingExport, setPendingExport] = useState(null);

  // --- Modal State ---
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [logToDelete, setLogToDelete] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [reportingTicketInfo, setReportingTicketInfo] = useState(null);
  const [isReallocateModalOpen, setIsReallocateModalOpen] = useState(false);
  const [reallocatingSessionInfo, setReallocatingSessionInfo] = useState(null);
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return !localStorage.getItem(STORAGE_KEYS.HAS_VISITED);
    } catch {}
    return false;
  });
  const [showInstructions, setShowInstructions] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [ticketDeleteCount, setTicketDeleteCount] = useState(null);

  // --- Theme State ---
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // --- Performance Refs ---
  const actionHandlerRef = useRef(null);
  const isButtonDisabledRef = useRef(false);
  const isStopButtonDisabledRef = useRef(false);
  const stopTimerRef = useRef(null);
  const editingTicketIdRef = useRef(null);
  const exportOptionRef = useRef('');
  const exportButtonRef = useRef(null);
  const [exportFocusIndex, setExportFocusIndex] = useState(0);
  const handleExportRef = useRef(null);

  // --- Firestore Collection Refs ---
  const getCollectionRef = useMemo(() => {
    if (db && userId) {
      if (shareId && import.meta.env.REACT_APP_ENABLE_PUBLIC_SHARES === 'true') {
        return collection(db, 'artifacts', dataAppId, 'public_data', shareId, 'time_entries');
      }
      return collection(db, 'artifacts', dataAppId, 'users', userId, 'time_entries');
    }
    return null;
  }, [userId, shareId]);

  const getTicketStatusCollectionRef = useMemo(() => {
    if (db && userId) {
      if (shareId && import.meta.env.REACT_APP_ENABLE_PUBLIC_SHARES === 'true') {
        return collection(db, 'artifacts', dataAppId, 'public_data', shareId, 'ticket_statuses');
      }
      return collection(db, 'artifacts', dataAppId, 'users', userId, 'ticket_statuses');
    }
    return null;
  }, [userId, shareId]);

  // --- Data Hooks ---
  const {
    logs,
    isLoading: logsLoading,
    isLoadingMore,
    hasLoadedOnce: logsLoadedOnce,
    firebaseError: logsError,
    activeLog,
    hasMore,
    loadMore,
    setFirebaseError: setLogsError,
  } = useLogs({ getCollectionRef, dateRangeStart, dateRangeEnd });

  const {
    ticketStatuses,
    setTicketStatuses,
    firebaseError: statusesError,
    setFirebaseError: setStatusesError,
  } = useTicketStatuses({ getTicketStatusCollectionRef });

  const timer = useTimer({ getCollectionRef, currentNote, ticketStatuses, userId });
  const { recentTicketIds, trackTicket } = useRecentTickets();

  // Combined loading state: data fetch or in-flight user action
  const isLoading = logsLoading || isActionLoading;

  // --- Theme Effect ---
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try { localStorage.setItem(STORAGE_KEYS.THEME, theme); } catch {}
  }, [theme]);

  // --- localStorage Effects ---
  useEffect(() => {
    if (!userTitle) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEYS.USER_TITLE, userTitle); } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [userTitle]);

  // --- Sync active log from useLogs into timer ---
  useEffect(() => {
    if (activeLog) {
      setCurrentTicketId(activeLog.ticketId);
      setCurrentNote(activeLog.note || '');
      timer.restoreSession(activeLog);
    } else if (timer.runningLogDocId) {
      startTransition(() => {
        timer.clearSession();
        setCurrentTicketId('');
        setCurrentNote('');
      });
    }
  }, [activeLog, timer]);

  // --- Clear selections when filters change ---
  useEffect(() => {
    setSelectedSessions(new Set());
  }, [statusFilter, searchQuery, dateRangeStart, dateRangeEnd, dateFilter]);

  // --- Export dropdown click-outside ---
  useEffect(() => {
    exportOptionRef.current = exportOption;
  }, [exportOption]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportOptionRef.current === 'menu' && !event.target.closest('.export-dropdown')) {
        setExportOption('');
        setExportFormat('');
        setExportFocusIndex(0);
      }
    };

    if (exportOption === 'menu') {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportOption]);

  // --- Derived State: Grouped Logs and Totals ---
  const filteredAndGroupedLogs = useMemo(() => {
    let dateFilteredLogs = logs;

    if (dateRangeStart || dateRangeEnd) {
      dateFilteredLogs = logs.filter((log) => {
        if (!log.endTime) return false;
        const logDate = toLocalDateString(log.endTime);
        if (dateRangeStart && logDate < dateRangeStart) return false;
        if (dateRangeEnd && logDate > dateRangeEnd) return false;
        return true;
      });
    } else if (dateFilter) {
      dateFilteredLogs = logs.filter((log) => {
        if (!log.endTime) return false;
        return toLocalDateString(log.endTime) === dateFilter;
      });
    }

    const searchFilteredLogs = searchQuery
      ? dateFilteredLogs.filter((log) =>
          log.ticketId.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : dateFilteredLogs;

    const groups = searchFilteredLogs.reduce((acc, log) => {
      const id = log.ticketId;
      if (!acc[id]) {
        acc[id] = {
          ticketId: id,
          totalDurationMs: 0,
          sessions: [],
          isClosed: ticketStatuses[id]?.isClosed || false,
        };
      }
      acc[id].totalDurationMs += log.accumulatedMs;
      acc[id].sessions.push(log);
      return acc;
    }, {});

    let groupedArray = Object.values(groups);

    if (statusFilter !== STATUS_FILTERS.SUBMITTED) {
      groupedArray = groupedArray.filter((group) =>
        group.sessions.some((session) => session.status !== SESSION_STATUS.SUBMITTED)
      );
    }

    const statusFilteredGroups = statusFilter === STATUS_FILTERS.ALL
      ? groupedArray
      : groupedArray.filter((group) => {
        if (statusFilter === STATUS_FILTERS.OPEN) return !group.isClosed;
        if (statusFilter === STATUS_FILTERS.CLOSED) return group.isClosed;
        if (statusFilter === STATUS_FILTERS.SUBMITTED) {
          return group.sessions.every((s) => s.status === SESSION_STATUS.SUBMITTED);
        }
        return true;
      });

    statusFilteredGroups.sort((a, b) => {
      const lastSessionA = a.sessions.reduce((max, s) =>
        s.endTime && s.endTime > max ? s.endTime : max, 0);
      const lastSessionB = b.sessions.reduce((max, s) =>
        s.endTime && s.endTime > max ? s.endTime : max, 0);
      return lastSessionB - lastSessionA;
    });

    return statusFilteredGroups;
  }, [logs, ticketStatuses, statusFilter, dateFilter, dateRangeStart, dateRangeEnd, searchQuery]);

  const totalFilteredTimeMs = useMemo(() => {
    return filteredAndGroupedLogs.reduce((total, group) => total + group.totalDurationMs, 0);
  }, [filteredAndGroupedLogs]);

  const allTicketIds = useMemo(() => {
    const ids = new Set(logs.map((log) => log.ticketId));
    if (currentTicketId) ids.add(currentTicketId);
    return Array.from(ids).sort();
  }, [logs, currentTicketId]);

  // --- Core Handlers ---
  const handleContinueTicket = useCallback(async (ticketId) => {
    trackTicket(ticketId);
    await timer.startNewOrOverride(ticketId);
  }, [timer, trackTicket]);

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
      reportError(error, { source: 'handleCloseTicket' });
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
      reportError(error, { source: 'handleReopenTicket' });
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
      const sessionsQuery = query(getCollectionRef, where('ticketId', '==', ticketId));
      const snapshot = await getDocs(sessionsQuery);
      setTicketDeleteCount(snapshot.size);
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
        }, { undoMessage: `Ticket ${deletedTicketId} and its sessions restored` });
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
          });
        } else {
          toast.success('Session deleted');
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error deleting:', error);
      reportError(error, { source: 'handleConfirmDelete' });
      toast.error('Failed to delete. Please try again.');
    } finally {
      setLogToDelete(null);
      setTicketToDelete(null);
      setTicketDeleteCount(null);
      setIsActionLoading(false);
    }
  }, [logToDelete, ticketToDelete, getCollectionRef, getTicketStatusCollectionRef]);

  // --- Bulk Operations ---
  const [runAsync] = useAsyncAction('Failed to perform action');

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
      const snapshots = await Promise.all(sessionIds.map((id) => getDoc(doc(getCollectionRef, id))));
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
      reportError(error, { source: 'handleConfirmBulkDelete' });
      toast.error('Failed to delete some sessions.');
    } finally {
      setIsActionLoading(false);
    }
  }, [getCollectionRef, selectedSessions, runAsync]);

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
      const updatePromises = sessionIds.map((sessionId) =>
        updateDoc(doc(getCollectionRef, sessionId), {
          status: newStatus,
          submissionDate: newStatus === SESSION_STATUS.SUBMITTED ? Date.now() : null,
        })
      );
      await Promise.all(updatePromises);
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
      reportError(error, { source: 'handleBulkStatusChange' });
      toast.error('Failed to update some sessions');
    } finally {
      setIsActionLoading(false);
    }
  }, [getCollectionRef, selectedSessions, captureStatuses]);

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
        }, { undoMessage: `Session moved back to ${previousTicketId}` });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error reallocating session:', error);
      reportError(error, { source: 'handleReallocateSession' });
      toast.error('Failed to move session. Please try again.');
    } finally {
      setIsReallocateModalOpen(false);
      setReallocatingSessionInfo(null);
      setIsActionLoading(false);
    }
  }, [getCollectionRef, reallocatingSessionInfo]);

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
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error updating ticket ID:', error);
      reportError(error, { source: 'handleUpdateTicketId' });
      toast.error('Failed to update ticket ID. Please try again.');
    } finally {
      setEditingTicketId(null);
      setEditingTicketValue('');
      setIsActionLoading(false);
    }
  }, [getCollectionRef, getTicketStatusCollectionRef]);

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
      reportError(error, { source: 'handleUpdateSessionNote' });
      toast.error('Failed to update session note. Please try again.');
    } finally {
      setEditingSessionNote(null);
      setEditingSessionNoteValue('');
      setIsActionLoading(false);
    }
  }, [getCollectionRef, logs]);

  const getFinalSessionIds = useCallback(() => {
    const finalSessionIds = new Set(selectedSessions);
    exportedSessionIds.forEach((sessionId) => finalSessionIds.add(sessionId));
    return finalSessionIds;
  }, [selectedSessions, exportedSessionIds]);

  const handleMarkAsSubmitted = useCallback(async () => {
    const finalSessionIds = getFinalSessionIds();
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
      reportError(error, { source: 'handleMarkAsSubmitted' });
      toast.error('Failed to mark sessions as submitted. Please try again.');
      return false;
    } finally {
      setIsActionLoading(false);
      setIsConfirmingSubmit(false);
    }
  }, [getFinalSessionIds, getCollectionRef, captureStatuses]);

  const handleConfirmExport = useCallback(async (markAsSubmitted) => {
    if (!pendingExport || !getCollectionRef || !db) {
      setIsConfirmingSubmit(false);
      setPendingExport(null);
      return;
    }

    setIsActionLoading(true);
    try {
      // Export first: if the download fails, no submission state has changed
      performExport(pendingExport.logs, pendingExport.name, pendingExport.format);
      toast.success(`Exported ${pendingExport.logs.length} session(s) as ${pendingExport.format.toUpperCase()}`);
      if (markAsSubmitted && exportedSessionIds.size > 0) {
        const previousStatuses = captureStatuses(Array.from(exportedSessionIds));
        const operations = [];
        const now = Date.now();
        exportedSessionIds.forEach((sessionId) => {
          const sessionRef = doc(getCollectionRef, sessionId);
          operations.push({ ref: sessionRef, data: { status: SESSION_STATUS.SUBMITTED, submissionDate: now } });
        });
        await commitInChunks(db, operations);
        const collectionRef = getCollectionRef;
        showUndoToast(`Marked ${exportedSessionIds.size} session(s) as submitted — hidden by default; view via the Submitted filter`, async () => {
          await commitInChunks(db, Array.from(previousStatuses, ([id, prev]) => ({
            ref: doc(collectionRef, id),
            data: { status: prev.status, submissionDate: prev.submissionDate },
          })));
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error:', error);
      reportError(error, { source: 'handleConfirmExport' });
      toast.error('Export or status update failed. Please try again.');
    } finally {
      setIsConfirmingSubmit(false);
      setExportedSessionIds(new Set());
      setPendingExport(null);
      setIsActionLoading(false);
    }
  }, [pendingExport, exportedSessionIds, getCollectionRef, captureStatuses]);

  const handleMarkAsUnsubmitted = useCallback(async () => {
    const finalSessionIds = getFinalSessionIds();
    if (finalSessionIds.size === 0 || !getCollectionRef) return;

    setIsActionLoading(true);
    try {
      const previousStatuses = captureStatuses(Array.from(finalSessionIds));
      const operations = [];
      finalSessionIds.forEach((sessionId) => {
        const docRef = doc(getCollectionRef, sessionId);
        operations.push({ ref: docRef, data: { status: SESSION_STATUS.UNSUBMITTED, submissionDate: null } });
      });
      await commitInChunks(db, operations);
      setSelectedSessions(new Set());
      const collectionRef = getCollectionRef;
      showUndoToast(`Marked ${finalSessionIds.size} session(s) as unsubmitted`, async () => {
        await commitInChunks(db, Array.from(previousStatuses, ([id, prev]) => ({
          ref: doc(collectionRef, id),
          data: { status: prev.status, submissionDate: prev.submissionDate },
        })));
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error marking sessions as unsubmitted:', error);
      reportError(error, { source: 'handleMarkAsUnsubmitted' });
      toast.error('Failed to mark sessions as unsubmitted. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  }, [getFinalSessionIds, getCollectionRef, captureStatuses]);

  const handleCreateDraft = useCallback(() => {
    const finalTicketIds = new Set();
    selectedSessions.forEach((sessionId) => {
      const log = logs.find((l) => l.id === sessionId);
      if (log) finalTicketIds.add(log.ticketId);
    });

    if (finalTicketIds.size === 0) return;

    let combinedReport = '';
    let totalTime = 0;

    finalTicketIds.forEach((ticketId) => {
      const group = filteredAndGroupedLogs.find((g) => g.ticketId === ticketId);
      if (group) {
        const allNotes = group.sessions
          .map((s) => s.note.trim())
          .filter(Boolean)
          .map((note) => `- ${note}`)
          .join('\n') || 'No detailed notes were recorded.';

        totalTime += group.totalDurationMs;

        combinedReport += `
---
**Ticket:** ${ticketId}
**Time Logged:** ${formatTime(group.totalDurationMs)}
**Session Notes:**
${allNotes}
---
`;
      }
    });

    const finalPrompt = `
You are a professional assistant. Your task is to write a concise, professional status update summarizing the work across multiple tickets.

**Task Details:**
- **Persona:** Write from the perspective of a "${userTitle || 'Team Member'}".
- **Topic:** Status update for ${finalTicketIds.size} ticket(s).
- **Output Format:** A single, professional paragraph.

**Information to Use:**
- **Total Combined Time Logged:** ${formatTime(totalTime)}
- **Ticket Summaries:**
${combinedReport.trim()}

**Instructions & Constraints:**
- Synthesize the information from all tickets into a cohesive summary.
- Base the summary *only* on the information provided above.
- Do not invent new details or predict future steps.
- The tone should be factual and to the point.
`;

    const draftTitle = finalTicketIds.size === 1 ? [...finalTicketIds][0] : `${finalTicketIds.size} Tickets`;
    setReportingTicketInfo({ ticketId: draftTitle, totalDurationMs: null });
    setGeneratedReport({ text: finalPrompt.trim() });
    setIsReportModalOpen(true);
  }, [selectedSessions, logs, filteredAndGroupedLogs, userTitle]);

  const handleExport = useCallback(async (exportType, format = 'csv') => {
    if (!exportType) return;

    let logsToExport;
    let reportName;

    switch (exportType) {
      case 'selected': {
        if (selectedSessions.size === 0) {
          setExportOption('');
          return;
        }

        const finalSelectedSessions = new Set();
        selectedSessions.forEach((sessionId) => {
          const log = logs.find((l) => l.id === sessionId);
          if (log) finalSelectedSessions.add(log);
        });
        logsToExport = Array.from(finalSelectedSessions);
        reportName = 'selected-report';
        break;
      }

      case 'filtered':
        logsToExport = filteredAndGroupedLogs.flatMap((group) => group.sessions);
        reportName = filteredAndGroupedLogs.length === 1
          ? filteredAndGroupedLogs[0].ticketId.replace(/[^a-z0-9]/gi, '_').toLowerCase()
          : 'filtered-report';
        break;

      case 'all': {
        // Fetch the complete history so the export is not limited to the
        // realtime listener's bounded window.
        setIsActionLoading(true);
        const loadingToast = toast.loading('Loading full history…');
        try {
          const allDocs = await fetchAllByEndTimeDesc(getCollectionRef);
          logsToExport = allDocs.map(toLog).filter((log) => log.endTime);
          toast.dismiss(loadingToast);
        } catch (error) {
          if (import.meta.env.DEV) console.error('Error fetching full history:', error);
          reportError(error, { source: 'handleExport:all' });
          toast.error('Failed to load full history for export', { id: loadingToast });
          setExportOption('');
          return;
        } finally {
          setIsActionLoading(false);
        }
        reportName = 'full-report';
        break;
      }

      default:
        setExportOption('');
        return;
    }

    if (logsToExport.length === 0) {
      setExportOption('');
      return;
    }

    const unsubmittedLogs = logsToExport.filter((log) => log.status !== SESSION_STATUS.SUBMITTED);
    if (unsubmittedLogs.length > 0 && statusFilter !== STATUS_FILTERS.SUBMITTED) {
      setPendingExport({
        type: exportType,
        format,
        logs: logsToExport,
        name: reportName,
        unsubmittedCount: unsubmittedLogs.length,
      });
      setExportedSessionIds(new Set(unsubmittedLogs.map((log) => log.id)));
      setIsConfirmingSubmit(true);
      setExportOption('');
      return;
    }

    try {
      performExport(logsToExport, reportName, format);
      toast.success(`Exported ${logsToExport.length} session(s) as ${format.toUpperCase()}`);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Export failed:', error);
      reportError(error, { source: 'handleExport' });
      toast.error('Export failed. Please try again.');
    }
    setExportOption('');
  }, [logs, selectedSessions, filteredAndGroupedLogs, statusFilter, getCollectionRef]);

  useEffect(() => {
    handleExportRef.current = handleExport;
  }, [handleExport]);

  // --- Selection Handlers ---
  const handleToggleSelectTicket = useCallback((ticketId) => {
    const group = filteredAndGroupedLogs.find((g) => g.ticketId === ticketId);
    const sessionIds = group ? group.sessions.map((s) => s.id) : [];

    setSelectedSessions((prevSelected) => {
      const newSelected = new Set(prevSelected);
      const allSelected = sessionIds.length > 0 && sessionIds.every((id) => prevSelected.has(id));
      sessionIds.forEach((id) => {
        if (allSelected) newSelected.delete(id);
        else newSelected.add(id);
      });
      return newSelected;
    });
  }, [filteredAndGroupedLogs]);

  const handleToggleSelectSession = useCallback((sessionId) => {
    setSelectedSessions((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(sessionId)) {
        newSelected.delete(sessionId);
      } else {
        newSelected.add(sessionId);
      }
      return newSelected;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    const allVisibleSessionIds = filteredAndGroupedLogs.flatMap((g) => g.sessions.map((s) => s.id));
    const allSelected = allVisibleSessionIds.length > 0 &&
      allVisibleSessionIds.every((id) => selectedSessions.has(id));

    if (allSelected) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(allVisibleSessionIds));
    }
  }, [filteredAndGroupedLogs, selectedSessions]);

  // --- Action Button Logic ---
  const handleClearAllFilters = useCallback(() => {
    setStatusFilter(STATUS_FILTERS.ALL);
    setDateFilter('');
    setDateRangeStart('');
    setDateRangeEnd('');
    setSearchQuery('');
  }, [setStatusFilter, setDateRangeStart, setDateRangeEnd, setSearchQuery]);

  const hasActiveFilters = Boolean(searchQuery) || statusFilter !== STATUS_FILTERS.ALL ||
    Boolean(dateRangeStart) || Boolean(dateRangeEnd) || Boolean(dateFilter);

  const isReady = isAuthReady && userId && db;
  const pausedTicketId = timer.isTimerPaused ? timer.activeLogData?.ticketId : '';
  const inputTicketId = currentTicketId.trim();
  const isInputTicketClosed = ticketStatuses[inputTicketId]?.isClosed || false;

  let actionHandler;
  if (timer.isTimerRunning) {
    actionHandler = timer.pauseTimer;
  } else if (timer.isTimerPaused && inputTicketId === pausedTicketId) {
    actionHandler = timer.startOrResumeTimer;
  } else {
    actionHandler = () => {
      timer.startNewOrOverride(inputTicketId);
      trackTicket(inputTicketId);
    };
  }

  const isInputDisabled = timer.isTimerRunning || !isReady;
  const isButtonDisabled = !isReady ||
    (isInputTicketClosed && !timer.isTimerPaused && !timer.isTimerRunning) ||
    (currentTicketId.trim() === '' && !timer.isTimerRunning && !timer.isTimerPaused);
  const isStopButtonDisabled = !timer.isTimerRunning && !timer.isTimerPaused;
  const isActionDisabled = selectedSessions.size === 0;

  // --- Keyboard Handler ---
  useEffect(() => {
    actionHandlerRef.current = actionHandler;
    isButtonDisabledRef.current = isButtonDisabled;
    isStopButtonDisabledRef.current = isStopButtonDisabled;
    stopTimerRef.current = timer.stopTimer;
    editingTicketIdRef.current = editingTicketId;
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      const hasModal = isAnyModalOpen();
      const isEditing = editingTicketIdRef.current || editingSessionNote;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName);

      if (event.key === ' ' && (event.ctrlKey || event.metaKey) && !hasModal && !isEditing) {
        event.preventDefault();
        if (actionHandlerRef.current && !isButtonDisabledRef.current) {
          actionHandlerRef.current();
        }
        return;
      }

      if (event.key === ' ' && event.shiftKey && !event.ctrlKey && !event.metaKey && !hasModal && !isEditing && !isTyping) {
        event.preventDefault();
        if (!isStopButtonDisabledRef.current && stopTimerRef.current) {
          stopTimerRef.current();
        }
        return;
      }

      // Undo the most recent destructive action (delete/stop/status change/rename)
      // while fresh; leave native text undo alone when typing in a field
      if (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !hasModal && !isEditing && !isTyping) {
        if (runLastUndo()) event.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingSessionNote]);

  // --- Render Helpers ---
  const combinedError = authError || logsError || statusesError;

  if (combinedError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg shadow-md mx-auto max-w-lg mt-8">
        <div className="flex items-center">
          <AlertTriangle className="h-6 w-6 mr-3" />
          <h2 className="text-xl font-bold">Error</h2>
        </div>
        <p className="mt-2 text-sm">{combinedError}</p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => { clearFirebaseError(); setLogsError(null); setStatusesError(null); }}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white dark:bg-gray-800 text-red-700 dark:text-red-300 font-semibold rounded-lg border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthReady || !logsLoadedOnce) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
        <Loader className="h-10 w-10 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <p className="ml-3 text-lg font-medium text-gray-700 dark:text-gray-300">Loading Tracker...</p>
      </div>
    );
  }

  let deleteMessage = null;
  if (logToDelete) {
    deleteMessage = (
      <div>
        <p>Are you sure you want to delete this session for ticket <strong>{logToDelete.ticketId}</strong>?</p>
        <div className="mt-4 text-sm bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <p><strong>Time Worked:</strong> {formatTime(logToDelete.accumulatedMs)}</p>
          {logToDelete.note && <p className="mt-1"><strong>Note:</strong> <em className="break-words">{logToDelete.note}</em></p>}
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">You can undo for a few seconds afterwards.</p>
      </div>
    );
  } else if (ticketToDelete) {
    const hasActiveTimer = activeLog && activeLog.ticketId === ticketToDelete;
    deleteMessage = (
      <div>
        <p className="text-red-600 dark:text-red-400 font-bold mb-2">This will delete the ticket and all its sessions.</p>
        <p>Are you sure you want to delete Ticket <strong>{ticketToDelete}</strong>?</p>
        {hasActiveTimer && (
          <p className="mt-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
            This includes your currently active timer session.
          </p>
        )}
        {ticketDeleteCount === null ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Counting sessions…</p>
        ) : (
          <p className="mt-2">
            This will delete <strong>{ticketDeleteCount}</strong> session{ticketDeleteCount !== 1 ? 's' : ''} associated with this ticket.
            {' '}You can undo for a few seconds afterwards.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-sans antialiased">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          className: 'bg-gray-800! text-white! dark:bg-gray-100! dark:text-gray-900!',
          success: { duration: 2000, iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { duration: 4000, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Suspense fallback={null}>
        <WelcomeModal isOpen={showWelcome} onClose={() => {
          setShowWelcome(false);
          try { localStorage.setItem(STORAGE_KEYS.HAS_VISITED, 'true'); } catch {}
        }} />
        <ConfirmationModal
          isOpen={isConfirmingDelete}
          title="Confirm Deletion"
          message={deleteMessage}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          confirmText="Delete"
          confirmDisabled={!!ticketToDelete && ticketDeleteCount === null}
        />
        <ConfirmationModal
          isOpen={isConfirmingBulkDelete}
          title="Confirm Bulk Deletion"
          message={`Are you sure you want to delete ${selectedSessions.size} session(s)? You can undo for a few seconds afterwards.`}
          onConfirm={handleConfirmBulkDelete}
          onCancel={() => setIsConfirmingBulkDelete(false)}
          confirmText="Delete"
        />

        <ExportConfirmModal
          isOpen={isConfirmingSubmit && !!pendingExport}
          onClose={() => {
            setIsConfirmingSubmit(false);
            setPendingExport(null);
            setExportedSessionIds(new Set());
          }}
          pendingExport={pendingExport}
          isLoading={isLoading}
          onConfirmExport={handleConfirmExport}
        />
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          reportData={generatedReport}
          ticketId={reportingTicketInfo?.ticketId}
          canMarkSubmitted={selectedSessions.size > 0 && statusFilter !== STATUS_FILTERS.SUBMITTED}
          onMarkSubmitted={async () => {
            const succeeded = await handleMarkAsSubmitted();
            if (succeeded) setIsReportModalOpen(false);
          }}
        />
        <ReallocateModal
          isOpen={isReallocateModalOpen}
          onClose={() => setIsReallocateModalOpen(false)}
          sessionInfo={reallocatingSessionInfo}
          allTicketIds={allTicketIds}
          onConfirm={handleReallocateSession}
        />
      </Suspense>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-start mb-8">
          <div className="relative">
            <div className="flex flex-col space-y-3">
              <div className="flex items-center space-x-3">
                {user && !user.isAnonymous ? (
                  <>
                    {user.photoURL?.startsWith('https://lh3.googleusercontent.com/') && !avatarError ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-10 h-10 rounded-full border-2 border-indigo-500"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full border-2 border-indigo-500 bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold"
                        aria-hidden="true"
                      >
                        {(user.displayName || 'U').trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{user.displayName}</p>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Log out
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={handleGoogleLogin}
                    className="flex items-center justify-center space-x-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" referrerPolicy="no-referrer" alt="Google logo" className="w-5 h-5" />
                    <span>Sign in with Google</span>
                  </button>
                )}
              </div>
              <div>
                <button
                  onClick={() => setShowInstructions(!showInstructions)}
                  aria-expanded={showInstructions}
                  className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <Info className="w-4 h-4" />
                  <span>{showInstructions ? 'Hide' : 'Show'} Instructions</span>
                </button>
              </div>
            </div>

            {showInstructions && (
              <section className="absolute z-10 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-indigo-200 dark:border-indigo-800">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">How to Use This Tracker</h3>
                <InstructionsContent />
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowInstructions(false)}
                    className="flex items-center justify-center w-full space-x-2 px-4 py-2 min-h-[44px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Hide Instructions</span>
                  </button>
                </div>
              </section>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                onClick={() => setShowProfileSettings(!showProfileSettings)}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                aria-label="Report profile settings"
                aria-expanded={showProfileSettings}
                title="Report profile settings"
              >
                <User className="w-5 h-5" />
              </button>
              {showProfileSettings && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  <label htmlFor="user-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Title / Role
                  </label>
                  <input
                    id="user-title"
                    type="text"
                    value={userTitle}
                    onChange={(e) => setUserTitle(e.target.value)}
                    placeholder="e.g., Senior Software Engineer"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Used to personalize AI status reports</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <header className="text-center mb-10">
          <div className="flex flex-col justify-center items-center mb-2">
            <h1 className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">TickTackToto</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">the slick ticket time tracker</p>
          </div>
        </header>

        <TimerSection
          isTimerRunning={timer.isTimerRunning}
          isTimerPaused={timer.isTimerPaused}
          currentTicketId={currentTicketId}
          setCurrentTicketId={setCurrentTicketId}
          isInputDisabled={isInputDisabled}
          recentTicketIds={recentTicketIds}
          isInputTicketClosed={isInputTicketClosed}
          currentNote={currentNote}
          setCurrentNote={setCurrentNote}
          elapsedMs={timer.elapsedMs}
          onStart={(ticketId) => { timer.startNewOrOverride(ticketId); trackTicket(ticketId); }}
          onPause={timer.pauseTimer}
          onResume={timer.startOrResumeTimer}
          onStop={timer.stopTimer}
          pausedTicketId={pausedTicketId}
        />

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">Filter & Summary</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <FilterBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setDateRangeStart={setDateRangeStart}
              setDateRangeEnd={setDateRangeEnd}
              setDateFilter={setDateFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              dateRangeStart={dateRangeStart}
              dateRangeEnd={dateRangeEnd}
            />
            <StatsDashboard
              totalFilteredTimeMs={totalFilteredTimeMs}
              filteredAndGroupedLogs={filteredAndGroupedLogs}
              logs={logs}
            />
          </div>
        </section>

        <SessionList
          logs={logs}
          filteredAndGroupedLogs={filteredAndGroupedLogs}
          selectedSessions={selectedSessions}
          setSelectedSessions={setSelectedSessions}
          handleToggleSelectSession={handleToggleSelectSession}
          handleToggleSelectAll={handleToggleSelectAll}
          handleToggleSelectTicket={handleToggleSelectTicket}
          statusFilter={statusFilter}
          handleBulkStatusChange={handleBulkStatusChange}
          handleBulkDelete={handleBulkDelete}
          handleMarkAsUnsubmitted={handleMarkAsUnsubmitted}
          handleCreateDraft={handleCreateDraft}
          handleExport={handleExport}
          exportOption={exportOption}
          setExportOption={setExportOption}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          exportFocusIndex={exportFocusIndex}
          setExportFocusIndex={setExportFocusIndex}
          exportButtonRef={exportButtonRef}
          isLoading={isLoading}
          isActionDisabled={isActionDisabled}
          editingTicketId={editingTicketId}
          editingTicketValue={editingTicketValue}
          setEditingTicketId={setEditingTicketId}
          setEditingTicketValue={setEditingTicketValue}
          handleUpdateTicketId={handleUpdateTicketId}
          editingSessionNote={editingSessionNote}
          editingSessionNoteValue={editingSessionNoteValue}
          setEditingSessionNote={setEditingSessionNote}
          setEditingSessionNoteValue={setEditingSessionNoteValue}
          handleUpdateSessionNote={handleUpdateSessionNote}
          handleDeleteClick={handleDeleteClick}
          handleDeleteTicketClick={handleDeleteTicketClick}
          handleReallocateSession={(sessionId, ticketId) => {
            setReallocatingSessionInfo({ sessionId, currentTicketId: ticketId });
            setIsReallocateModalOpen(true);
          }}
          handleCloseTicket={handleCloseTicket}
          handleReopenTicket={handleReopenTicket}
          handleContinueTicket={handleContinueTicket}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          loadMore={loadMore}
          hasActiveFilters={hasActiveFilters}
          onClearAllFilters={handleClearAllFilters}
        />
      </div>
    </div>
  );
};

// Wrap App with providers and Error Boundary for graceful error handling
const AppWithProviders = () => {
  const configErrorVars = [...missingFirebaseVars];
  if (!dataAppIdIsValid) configErrorVars.push('REACT_APP_DATA_APP_ID (invalid format)');

  return (
    <ErrorBoundary>
      {configErrorVars.length > 0 ? (
        <ConfigError missingVars={configErrorVars} />
      ) : (
        <AuthProvider>
          <App />
        </AuthProvider>
      )}
    </ErrorBoundary>
  );
};

export default AppWithProviders;
