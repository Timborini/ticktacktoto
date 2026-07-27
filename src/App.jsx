import { useState, useEffect, useCallback, useMemo, useRef, startTransition, lazy, Suspense } from 'react';
import {
  AlertTriangle, Loader, X, Sun, Moon, Info
} from 'lucide-react';
import {
  collection, query, doc, updateDoc, deleteDoc, where, getDocs, setDoc
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
  const [selectedTickets, setSelectedTickets] = useState(new Set());
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
      if (!localStorage.getItem(STORAGE_KEYS.HAS_VISITED)) {
        localStorage.setItem(STORAGE_KEYS.HAS_VISITED, 'true');
        return true;
      }
    } catch {}
    return false;
  });
  const [showInstructions, setShowInstructions] = useState(false);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState(null);

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
    setSelectedTickets(new Set());
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
      setStatusesError(`Failed to close ticket ${ticketId}.`);
      toast.error('Failed to close ticket', { id: loadingToast, duration: 4000 });
    }
  }, [getTicketStatusCollectionRef, ticketStatuses, setTicketStatuses, setStatusesError, userId]);

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
      setStatusesError(`Failed to reopen ticket ${ticketId}.`);
      toast.error('Failed to reopen ticket', { id: loadingToast, duration: 4000 });
    }
  }, [getTicketStatusCollectionRef, ticketStatuses, setTicketStatuses, setStatusesError, userId]);

  const handleDeleteClick = useCallback((session) => {
    setLogToDelete(session);
    setIsConfirmingDelete(true);
  }, []);

  const handleDeleteTicketClick = useCallback((ticketId) => {
    setTicketToDelete(ticketId);
    setIsConfirmingDelete(true);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setIsConfirmingDelete(false);
    setLogToDelete(null);
    setTicketToDelete(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if ((!logToDelete && !ticketToDelete) || !getCollectionRef) return;

    setIsConfirmingDelete(false);
    setIsActionLoading(true);

    try {
      if (ticketToDelete) {
        const sessionsQuery = query(getCollectionRef, where('ticketId', '==', ticketToDelete));
        const sessionSnapshots = await getDocs(sessionsQuery);
        const operations = sessionSnapshots.docs.map((d) => ({ ref: d.ref, type: 'delete' }));

        if (getTicketStatusCollectionRef) {
          try {
            const statusQuery = query(getTicketStatusCollectionRef, where('ticketId', '==', ticketToDelete));
            const statusSnapshots = await getDocs(statusQuery);
            statusSnapshots.docs.forEach((d) => operations.push({ ref: d.ref, type: 'delete' }));
          } catch (statusError) {
            if (import.meta.env.DEV) console.warn('Could not query ticket status:', statusError);
          }
        }
        await commitInChunks(db, operations);
        toast.success(`Deleted ticket ${ticketToDelete} and all its sessions`);
      } else if (logToDelete) {
        await deleteDoc(doc(getCollectionRef, logToDelete.id));
        toast.success('Session deleted');
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error deleting:', error);
      reportError(error, { source: 'handleConfirmDelete' });
      setLogsError('Failed to delete.');
    } finally {
      setLogToDelete(null);
      setTicketToDelete(null);
      setIsActionLoading(false);
    }
  }, [logToDelete, ticketToDelete, getCollectionRef, getTicketStatusCollectionRef, setLogsError]);

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
      await runAsync(async () => {
        const deletePromises = Array.from(selectedSessions).map((sessionId) =>
          deleteDoc(doc(getCollectionRef, sessionId))
        );
        await Promise.all(deletePromises);
        setSelectedSessions(new Set());
      }, { successMessage: `Successfully deleted ${selectedSessions.size} session(s)` });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error deleting sessions:', error);
      reportError(error, { source: 'handleConfirmBulkDelete' });
      setLogsError('Failed to delete some sessions.');
    } finally {
      setIsActionLoading(false);
    }
  }, [getCollectionRef, selectedSessions, runAsync, setLogsError]);

  const handleBulkStatusChange = useCallback(async (newStatus) => {
    if (!getCollectionRef || selectedSessions.size === 0) return;

    setIsActionLoading(true);
    try {
      const updatePromises = Array.from(selectedSessions).map((sessionId) =>
        updateDoc(doc(getCollectionRef, sessionId), {
          status: newStatus,
          ...(newStatus === SESSION_STATUS.SUBMITTED ? { submissionDate: Date.now() } : {}),
        })
      );
      await Promise.all(updatePromises);
      setSelectedSessions(new Set());
      toast.success(`Successfully updated ${selectedSessions.size} session(s) to ${newStatus}`);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error updating session status:', error);
      reportError(error, { source: 'handleBulkStatusChange' });
      setLogsError('Failed to update some sessions.');
      toast.error('Failed to update some sessions');
    } finally {
      setIsActionLoading(false);
    }
  }, [getCollectionRef, selectedSessions, setLogsError]);

  const handleReallocateSession = useCallback(async (sessionId, newTicketId) => {
    const sanitizedTicketId = sanitizeTicketId(newTicketId);
    if (!sessionId || !sanitizedTicketId || !getCollectionRef) return;

    setIsActionLoading(true);
    try {
      const sessionRef = doc(getCollectionRef, sessionId);
      await updateDoc(sessionRef, { ticketId: sanitizedTicketId });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error reallocating session:', error);
      reportError(error, { source: 'handleReallocateSession' });
      setLogsError('Failed to reallocate session.');
    } finally {
      setIsReallocateModalOpen(false);
      setReallocatingSessionInfo(null);
      setIsActionLoading(false);
    }
  }, [getCollectionRef, setLogsError]);

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
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error updating ticket ID:', error);
      reportError(error, { source: 'handleUpdateTicketId' });
      setLogsError('Failed to update ticket ID. Please check the console.');
    } finally {
      setEditingTicketId(null);
      setEditingTicketValue('');
      setIsActionLoading(false);
    }
  }, [getCollectionRef, getTicketStatusCollectionRef, setLogsError]);

  const handleUpdateSessionNote = useCallback(async (sessionId, newNote) => {
    const sanitizedNote = sanitizeNote(newNote);
    if (!getCollectionRef) {
      setEditingSessionNote(null);
      return;
    }

    setIsActionLoading(true);
    try {
      await updateDoc(doc(getCollectionRef, sessionId), { note: sanitizedNote });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error updating session note:', error);
      reportError(error, { source: 'handleUpdateSessionNote' });
      setLogsError('Failed to update session note. Please check the console.');
    } finally {
      setEditingSessionNote(null);
      setEditingSessionNoteValue('');
      setIsActionLoading(false);
    }
  }, [getCollectionRef, setLogsError]);

  const getFinalSessionIds = useCallback(() => {
    const finalSessionIds = new Set(selectedSessions);
    selectedTickets.forEach((ticketId) => {
      logs.forEach((log) => {
        if (log.ticketId === ticketId) finalSessionIds.add(log.id);
      });
    });
    exportedSessionIds.forEach((sessionId) => finalSessionIds.add(sessionId));
    return finalSessionIds;
  }, [selectedSessions, selectedTickets, logs, exportedSessionIds]);

  const handleMarkAsSubmitted = useCallback(async () => {
    const finalSessionIds = getFinalSessionIds();
    if (finalSessionIds.size === 0 || !getCollectionRef || !db) return;

    setIsActionLoading(true);
    try {
      const operations = [];
      const now = Date.now();
      finalSessionIds.forEach((sessionId) => {
        const docRef = doc(getCollectionRef, sessionId);
        operations.push({ ref: docRef, data: { status: SESSION_STATUS.SUBMITTED, submissionDate: now } });
      });
      await commitInChunks(db, operations);
      setSelectedTickets(new Set());
      setSelectedSessions(new Set());
      setExportedSessionIds(new Set());
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error marking sessions as submitted:', error);
      reportError(error, { source: 'handleMarkAsSubmitted' });
      setLogsError('Failed to mark sessions as submitted.');
    } finally {
      setIsActionLoading(false);
      setIsConfirmingSubmit(false);
    }
  }, [getFinalSessionIds, getCollectionRef, setLogsError]);

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
      if (markAsSubmitted && exportedSessionIds.size > 0) {
        const operations = [];
        const now = Date.now();
        exportedSessionIds.forEach((sessionId) => {
          const sessionRef = doc(getCollectionRef, sessionId);
          operations.push({ ref: sessionRef, data: { status: SESSION_STATUS.SUBMITTED, submissionDate: now } });
        });
        await commitInChunks(db, operations);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error:', error);
      reportError(error, { source: 'handleConfirmExport' });
      setLogsError('Failed to update submission status.');
      toast.error('Failed to update status');
    } finally {
      setIsConfirmingSubmit(false);
      setExportedSessionIds(new Set());
      setPendingExport(null);
      setIsActionLoading(false);
    }
  }, [pendingExport, exportedSessionIds, getCollectionRef, setLogsError]);

  const handleMarkAsUnsubmitted = useCallback(async () => {
    const finalSessionIds = getFinalSessionIds();
    if (finalSessionIds.size === 0 || !getCollectionRef) return;

    setIsActionLoading(true);
    try {
      const operations = [];
      finalSessionIds.forEach((sessionId) => {
        const docRef = doc(getCollectionRef, sessionId);
        operations.push({ ref: docRef, data: { status: SESSION_STATUS.UNSUBMITTED, submissionDate: null } });
      });
      await commitInChunks(db, operations);
      setSelectedTickets(new Set());
      setSelectedSessions(new Set());
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error marking sessions as unsubmitted:', error);
      reportError(error, { source: 'handleMarkAsUnsubmitted' });
      setLogsError('Failed to mark sessions as unsubmitted.');
    } finally {
      setIsActionLoading(false);
    }
  }, [getFinalSessionIds, getCollectionRef, setLogsError]);

  const handleCreateDraft = useCallback(() => {
    const finalTicketIds = new Set(selectedTickets);
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
  }, [selectedTickets, selectedSessions, logs, filteredAndGroupedLogs, userTitle]);

  const handleExport = useCallback(async (exportType, format = 'csv') => {
    if (!exportType) return;

    let logsToExport;
    let reportName;

    switch (exportType) {
      case 'selected': {
        if (selectedTickets.size === 0 && selectedSessions.size === 0) {
          setExportOption('');
          return;
        }

        const finalSelectedSessions = new Set();
        selectedSessions.forEach((sessionId) => {
          const log = logs.find((l) => l.id === sessionId);
          if (log) finalSelectedSessions.add(log);
        });
        selectedTickets.forEach((ticketId) => {
          logs.forEach((log) => {
            if (log.ticketId === ticketId && log.endTime) {
              finalSelectedSessions.add(log);
            }
          });
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
        try {
          const allDocs = await fetchAllByEndTimeDesc(getCollectionRef);
          logsToExport = allDocs.map(toLog).filter((log) => log.endTime);
        } catch (error) {
          if (import.meta.env.DEV) console.error('Error fetching full history:', error);
          reportError(error, { source: 'handleExport:all' });
          toast.error('Failed to load full history for export');
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

    performExport(logsToExport, reportName, format);
    setExportOption('');
  }, [logs, selectedTickets, selectedSessions, filteredAndGroupedLogs, statusFilter, getCollectionRef]);

  useEffect(() => {
    handleExportRef.current = handleExport;
  }, [handleExport]);

  // --- Selection Handlers ---
  const handleToggleSelectTicket = useCallback((ticketId) => {
    setSelectedTickets((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(ticketId)) {
        newSelected.delete(ticketId);
      } else {
        newSelected.add(ticketId);
      }
      return newSelected;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    const allVisibleTicketIds = new Set(filteredAndGroupedLogs.map((g) => g.ticketId));
    const allVisibleSelected = [...allVisibleTicketIds].every((id) => selectedTickets.has(id));

    if (allVisibleSelected) {
      setSelectedTickets((prevSelected) => {
        const newSelected = new Set(prevSelected);
        allVisibleTicketIds.forEach((id) => newSelected.delete(id));
        return newSelected;
      });
    } else {
      setSelectedTickets((prevSelected) => new Set([...prevSelected, ...allVisibleTicketIds]));
    }
    setSelectedSessions(new Set());
  }, [filteredAndGroupedLogs, selectedTickets]);

  // --- Action Button Logic ---
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
  const isActionDisabled = selectedTickets.size === 0 && selectedSessions.size === 0;

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
      const hasModal = document.querySelector('.fixed.inset-0');
      const isEditing = editingTicketIdRef.current || editingSessionNote;

      if (event.key === ' ' && (event.ctrlKey || event.metaKey) && !hasModal && !isEditing) {
        event.preventDefault();
        if (actionHandlerRef.current && !isButtonDisabledRef.current) {
          actionHandlerRef.current();
        }
        return;
      }

      if (event.key === ' ' && event.shiftKey && !event.ctrlKey && !event.metaKey && !hasModal && !isEditing) {
        event.preventDefault();
        if (!isStopButtonDisabledRef.current && stopTimerRef.current) {
          stopTimerRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingSessionNote]);

  // --- Render Helpers ---
  const combinedError = authError || logsError || statusesError;

  if (combinedError) {
    return (
      <div className="p-6 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md mx-auto max-w-lg mt-8">
        <div className="flex items-center">
          <AlertTriangle className="h-6 w-6 mr-3" />
          <h2 className="text-xl font-bold">Error</h2>
        </div>
        <p className="mt-2 text-sm">{combinedError}</p>
        <button
          onClick={() => { clearFirebaseError(); setLogsError(null); setStatusesError(null); window.location.reload(); }}
          className="mt-4 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  if (!isAuthReady || !logsLoadedOnce) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <Loader className="h-10 w-10 text-indigo-600 animate-spin" />
        <p className="ml-3 text-lg font-medium text-gray-700">Loading Tracker...</p>
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
      </div>
    );
  } else if (ticketToDelete) {
    const sessionsCount = logs.filter((l) => l.ticketId === ticketToDelete).length;
    deleteMessage = (
      <div>
        <p className="text-red-600 dark:text-red-400 font-bold mb-2">Warning: This action cannot be undone.</p>
        <p>Are you sure you want to delete Ticket <strong>{ticketToDelete}</strong>?</p>
        <p className="mt-2">This will permanently delete <strong>{sessionsCount}</strong> session{sessionsCount !== 1 ? 's' : ''} associated with this ticket.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-sans antialiased">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#363636', color: '#fff' },
          success: { duration: 2000, iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { duration: 4000, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Suspense fallback={null}>
        <WelcomeModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} />
        <ConfirmationModal
          isOpen={isConfirmingDelete}
          title="Confirm Deletion"
          message={deleteMessage}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          confirmText="Delete"
        />
        <ConfirmationModal
          isOpen={isConfirmingBulkDelete}
          title="Confirm Bulk Deletion"
          message={`Are you sure you want to delete ${selectedSessions.size} session(s)? This action cannot be undone.`}
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
        <ConfirmationModal
          isOpen={isConfirmingSubmit && !pendingExport}
          title="Mark as Submitted?"
          message={exportedSessionIds.size > 0
            ? `This will mark the ${exportedSessionIds.size} exported session(s) as 'submitted'. Submitted items are hidden by default.`
            : `This will mark all sessions for the selected ticket(s) as 'submitted'. Submitted items are hidden by default.`
          }
          onConfirm={handleMarkAsSubmitted}
          onCancel={() => { setIsConfirmingSubmit(false); setExportedSessionIds(new Set()); }}
          confirmText="Mark as Submitted"
        />

        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            if ((selectedTickets.size > 0 || selectedSessions.size > 0) && statusFilter !== STATUS_FILTERS.SUBMITTED) {
              setIsConfirmingSubmit(true);
            }
          }}
          reportData={generatedReport}
          ticketId={reportingTicketInfo?.ticketId}
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
                    <img
                      src={user.photoURL?.startsWith('https://lh3.googleusercontent.com/') ? user.photoURL : ''}
                      alt={user.displayName || 'User'}
                      className="w-10 h-10 rounded-full border-2 border-indigo-500"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{user.displayName}</p>
                      <button onClick={handleLogout} className="text-xs text-red-500 hover:underline">Logout</button>
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
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
          userTitle={userTitle}
          setUserTitle={setUserTitle}
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
          {hasMore && (
            <div className="mt-4 flex items-center justify-between flex-wrap gap-2" role="status">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Only your most recent sessions are loaded.
              </p>
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="px-4 py-2 min-h-[44px] text-sm font-semibold rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? 'Loading…' : 'Load older sessions'}
              </button>
            </div>
          )}
        </section>

        <SessionList
          logs={logs}
          filteredAndGroupedLogs={filteredAndGroupedLogs}
          selectedSessions={selectedSessions}
          setSelectedSessions={setSelectedSessions}
          selectedTickets={selectedTickets}
          handleToggleSelectAll={handleToggleSelectAll}
          handleToggleSelectTicket={handleToggleSelectTicket}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          setDateFilter={setDateFilter}
          dateFilter={dateFilter}
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
