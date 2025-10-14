import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Clock, Play, Square, List, Loader, Trash2, Pause, X, Check, Repeat, Lock, Send, Clipboard, BookOpen, User, Sun, Moon, Info, Pencil, CornerUpRight
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
} from 'firebase/auth';
import {
  getFirestore, collection, query, onSnapshot,
  doc, updateDoc, deleteDoc, addDoc, where, getDocs, writeBatch
} from 'firebase/firestore';


// This has been updated with your specific Firebase configuration.
const firebaseConfig = {
  apiKey: "AIzaSyDLpi8kG36WLf0gn5-UBTkyu1f1wNSW4ug",
  authDomain: "time-tracker-9a56c.firebaseapp.com",
  projectId: "time-tracker-9a56c",
  storageBucket: "time-tracker-9a56c.firebasestorage.app",
  messagingSenderId: "457573849083",
  appId: "1:457573849083:web:9d758949a0b8781074dd5e",
  measurementId: "G-4NBGX3Y9N9"
};

// --- Custom Hooks ---

/**
 * Custom hook to manage timer logic.
 * @param {object} activeLogData - The currently running log entry from Firestore.
 * @param {boolean} isTimerRunning - Whether the timer is actively running.
 * @returns {{elapsedMs: number}} - The current elapsed milliseconds for the active timer.
 */
const useTimer = (activeLogData, isTimerRunning) => {
  const [elapsedMs, setElapsedMs] = useState(0);
  const intervalRef = useRef(null);

  // --- Stable Timer Interval Effect ---
  useEffect(() => {
    if (isTimerRunning) {
      intervalRef.current = setInterval(() => {
        if (activeLogData && activeLogData.startTime) {
          const currentRunDuration = Date.now() - activeLogData.startTime;
          setElapsedMs(activeLogData.accumulatedMs + currentRunDuration);
        }
      }, 1000);
    }
  
    return () => {
      clearInterval(intervalRef.current);
    };
  }, [isTimerRunning, activeLogData]);

  // Effect to set the elapsed time when the timer is not running (e.g., on load or pause).
  useEffect(() => {
    if (!isTimerRunning && activeLogData) {
      setElapsedMs(activeLogData.accumulatedMs);
    } else if (!activeLogData) {
      setElapsedMs(0);
    }
  }, [activeLogData, isTimerRunning]);

  return { elapsedMs };
};


const appId = 'default-app-id'; 

/**
 * Custom hook to manage all Firestore interactions and related state.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The authenticated user's ID.
 * @param {string|null} shareId - An optional ID for accessing shared data.
 * @returns {object} - State and functions for interacting with Firestore.
 */
const useFirestore = (db, userId, shareId) => {
    const [logs, setLogs] = useState([]);
    const [ticketStatuses, setTicketStatuses] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [firebaseError, setFirebaseError] = useState(null);
    
    // State derived from Firestore data
    const [activeLogData, setActiveLogData] = useState(null); 
    const [isTimerRunning, setIsTimerRunning] = useState(false); 
    const [isTimerPaused, setIsTimerPaused] = useState(false); 
    const [runningLogDocId, setRunningLogDocId] = useState(null);

    // --- Firestore Data Path Helpers ---
    const getCollectionRef = useMemo(() => {
      if (db && userId) {
        if (shareId) {
          return collection(db, 'artifacts', appId, 'public/data', shareId, 'time_entries');
        }
        return collection(db, 'artifacts', appId, 'users', userId, 'time_entries');
      }
      return null;
    }, [db, userId, shareId]);
    
    const getTicketStatusCollectionRef = useMemo(() => {
      if (db && userId) {
        if (shareId) {
          return collection(db, 'artifacts', appId, 'public/data', shareId, 'ticket_statuses');
        }
        return collection(db, 'artifacts', appId, 'users', userId, 'ticket_statuses');
      }
      return null;
    }, [db, userId, shareId]);

    // --- Real-time Listeners ---
    useEffect(() => {
      if (!getTicketStatusCollectionRef) return;
      const q = query(getTicketStatusCollectionRef);
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const statuses = {};
          snapshot.docs.forEach((doc) => {
              const data = doc.data();
              if (data.ticketId) {
                  statuses[data.ticketId] = { id: doc.id, isClosed: data.isClosed || false };
              }
          });
          setTicketStatuses(statuses);
      }, (error) => {
          console.error('Firestore ticket status snapshot error:', error);
          setFirebaseError('Failed to load ticket statuses.');
      });
      return () => unsubscribe();
    }, [getTicketStatusCollectionRef]);
  
    useEffect(() => {
      if (!getCollectionRef) {
        setIsLoading(!!userId);
        return;
      }
      
      setIsLoading(true);
      const q = query(getCollectionRef);
  
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let fetchedLogs = [];
        let currentActiveLog = null;
  
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const log = {
            id: doc.id,
            ticketId: data.ticketId || 'No Ticket ID',
            startTime: data.startTime || null, 
            endTime: data.endTime || null, 
            accumulatedMs: data.accumulatedMs || 0,
            note: data.note || '',
            status: data.status || 'unsubmitted'
          };
  
          if (log.endTime === null) {
            currentActiveLog = log;
          } else {
            fetchedLogs.push(log);
          }
        });
  
        setLogs(fetchedLogs);
  
        if (currentActiveLog) {
          setRunningLogDocId(currentActiveLog.id);
          setActiveLogData(currentActiveLog); 
          setIsTimerRunning(!!currentActiveLog.startTime);
          setIsTimerPaused(!currentActiveLog.startTime);
        } else {
          setRunningLogDocId(null);
          setActiveLogData(null); 
          setIsTimerRunning(false);
          setIsTimerPaused(false);
        }
  
        setIsLoading(false);
      }, (error) => {
        console.error('Firestore snapshot error:', error);
        setFirebaseError('Failed to load real-time data.');
        setIsLoading(false);
      });
  
      return () => unsubscribe();
    }, [getCollectionRef, userId]);

    // --- Action Functions ---
    const pauseTimer = useCallback(async (currentNote) => {
      if (!runningLogDocId || !isTimerRunning || !getCollectionRef || !activeLogData) return;
  
      setIsLoading(true);
      const stopTime = Date.now();
      const currentRunDuration = stopTime - activeLogData.startTime; 
      const newAccumulatedMs = activeLogData.accumulatedMs + Math.max(0, currentRunDuration); 
  
      try {
        await updateDoc(doc(getCollectionRef, runningLogDocId), {
          startTime: null,
          accumulatedMs: newAccumulatedMs,
          note: currentNote.trim(),
        });
      } catch (error) {
        console.error('Error pausing timer:', error);
        setFirebaseError('Failed to pause timer.');
      } finally {
        setIsLoading(false);
      }
    }, [runningLogDocId, isTimerRunning, getCollectionRef, activeLogData]);
  
    const stopTimer = useCallback(async (currentNote, isAutoOverride = false) => {
      if (!runningLogDocId || !getCollectionRef || !activeLogData) return;
  
      setIsLoading(true);
      const finalStopTime = Date.now();
      let finalAccumulatedMs = activeLogData.accumulatedMs; 
  
      if (isTimerRunning) {
          const currentRunDuration = finalStopTime - activeLogData.startTime;
          finalAccumulatedMs += Math.max(1000, currentRunDuration); 
      } else if (isTimerPaused) {
          finalAccumulatedMs = activeLogData.accumulatedMs;
          if (finalAccumulatedMs < 1000) finalAccumulatedMs = 1000;
      }
  
      try {
        await updateDoc(doc(getCollectionRef, runningLogDocId), {
          endTime: finalStopTime,
          startTime: null,
          accumulatedMs: finalAccumulatedMs,
          note: currentNote.trim(),
          status: 'unsubmitted'
        });
      } catch (error) {
        console.error('Error stopping timer:', error);
        setFirebaseError('Failed to stop timer.');
      } finally {
        setIsLoading(false);
      }
    }, [runningLogDocId, getCollectionRef, isTimerRunning, isTimerPaused, activeLogData]);
  
    const startNewSession = useCallback(async (ticketId, note = '') => {
      if(!getCollectionRef) return;
      setIsLoading(true);
      const startTimestamp = Date.now();
      try {
          const newEntry = {
              ticketId: ticketId.trim(),
              startTime: startTimestamp,
              endTime: null,
              accumulatedMs: 0,
              note: note.trim(),
              status: 'unsubmitted'
          };
          await addDoc(getCollectionRef, newEntry);
      } catch (error) {
          console.error('Error starting new timer:', error);
          setFirebaseError('Failed to start new timer.');
      } finally {
          setIsLoading(false);
      }
    }, [getCollectionRef]);
  
    const startOrResumeTimer = useCallback(async (currentTicketId, currentNote) => {
      if (!getCollectionRef || currentTicketId.trim() === '') return;
      if (isTimerRunning) return;
  
      setIsLoading(true);
      const startTimestamp = Date.now();
  
      try {
        if (isTimerPaused) {
          if (!runningLogDocId) throw new Error("Paused log ID missing.");
          await updateDoc(doc(getCollectionRef, runningLogDocId), {
            startTime: startTimestamp,
            note: currentNote.trim(),
          });
        } else {
          await startNewSession(currentTicketId, currentNote);
        }
      } catch (error) {
        console.error('Error starting/resuming timer:', error);
        setFirebaseError(`Failed to ${isTimerPaused ? 'resume' : 'start'} timer.`);
      } finally {
        setIsLoading(false);
      }
    }, [getCollectionRef, isTimerRunning, isTimerPaused, runningLogDocId, startNewSession]);
    
    const handleCloseTicket = useCallback(async (ticketId) => {
      if (!getTicketStatusCollectionRef || isLoading) return;
      setIsLoading(true);
      const statusEntry = ticketStatuses[ticketId];
      try {
          if (statusEntry && statusEntry.id) {
              await updateDoc(doc(getTicketStatusCollectionRef, statusEntry.id), { isClosed: true });
          } else {
              await addDoc(getTicketStatusCollectionRef, { ticketId: ticketId, isClosed: true });
          }
      } catch (error) {
          console.error('Error closing ticket:', error);
          setFirebaseError(`Failed to close ticket ${ticketId}.`);
      } finally {
          setIsLoading(false);
      }
    }, [getTicketStatusCollectionRef, isLoading, ticketStatuses]);
    
    const handleReopenTicket = useCallback(async (ticketId) => {
      if (!getTicketStatusCollectionRef || isLoading) return;
      setIsLoading(true);
      const statusEntry = ticketStatuses[ticketId];
      try {
          if (statusEntry && statusEntry.id) {
              await updateDoc(doc(getTicketStatusCollectionRef, statusEntry.id), { isClosed: false });
          }
      } catch (error) {
          console.error('Error reopening ticket:', error);
          setFirebaseError(`Failed to reopen ticket ${ticketId}.`);
      } finally {
          setIsLoading(false);
      }
    }, [getTicketStatusCollectionRef, isLoading, ticketStatuses]);
  
    const handleConfirmDelete = useCallback(async (logToDelete) => {
      if (!logToDelete || !getCollectionRef) return;
      setIsLoading(true);
      try {
          await deleteDoc(doc(getCollectionRef, logToDelete.id));
      } catch (error) {
          console.error('Error deleting log:', error);
          setFirebaseError('Failed to delete log entry.');
      } finally {
          setIsLoading(false);
      }
    }, [getCollectionRef]);
    
    const handleReallocateSession = useCallback(async (sessionId, newTicketId) => {
      if (!sessionId || !newTicketId || !getCollectionRef) return;
      setIsLoading(true);
      try {
          const sessionRef = doc(getCollectionRef, sessionId);
          await updateDoc(sessionRef, { ticketId: newTicketId });
      } catch (error) {
          console.error("Error reallocating session:", error);
          setFirebaseError("Failed to reallocate session.");
      } finally {
          setIsLoading(false);
      }
    }, [getCollectionRef]);
  
    const handleUpdateTicketId = useCallback(async (oldTicketId, newTicketId) => {
      if (!newTicketId || oldTicketId === newTicketId || !getCollectionRef || !getTicketStatusCollectionRef || !db) return;
      setIsLoading(true);
      const batch = writeBatch(db);
      try {
        const sessionsQuery = query(getCollectionRef, where("ticketId", "==", oldTicketId));
        const sessionSnapshots = await getDocs(sessionsQuery);
        sessionSnapshots.forEach((doc) => {
          batch.update(doc.ref, { ticketId: newTicketId });
        });
  
        const statusQuery = query(getTicketStatusCollectionRef, where("ticketId", "==", oldTicketId));
        const statusSnapshots = await getDocs(statusQuery);
        statusSnapshots.forEach((doc) => {
          batch.update(doc.ref, { ticketId: newTicketId });
        });
  
        await batch.commit();
      } catch (error) {
        console.error("Error updating ticket ID:", error);
        setFirebaseError("Failed to update ticket ID.");
      } finally {
        setIsLoading(false);
      }
    }, [getCollectionRef, getTicketStatusCollectionRef, db]);
  
    const handleMarkSessionsSubmitted = useCallback(async (sessionIdsToUpdate) => {
        if (sessionIdsToUpdate.size === 0 || !getCollectionRef || !db) return;
        setIsLoading(true);
        const batch = writeBatch(db);
        try {
            sessionIdsToUpdate.forEach(sessionId => {
                const docRef = doc(getCollectionRef, sessionId);
                batch.update(docRef, { status: 'submitted' });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error marking sessions as submitted:", error);
            setFirebaseError("Failed to mark sessions as submitted.");
        } finally {
            setIsLoading(false);
        }
    }, [getCollectionRef, db]);
  
    const handleMarkSessionsUnsubmitted = useCallback(async (sessionIdsToUpdate) => {
        if (sessionIdsToUpdate.size === 0 || !getCollectionRef || !db) return;
        setIsLoading(true);
        const batch = writeBatch(db);
        try {
            sessionIdsToUpdate.forEach(sessionId => {
                const docRef = doc(getCollectionRef, sessionId);
                batch.update(docRef, { status: 'unsubmitted' });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error marking sessions as unsubmitted:", error);
            setFirebaseError("Failed to mark sessions as unsubmitted.");
        } finally {
            setIsLoading(false);
        }
    }, [getCollectionRef, db]);

    return {
        logs,
        ticketStatuses,
        isLoading,
        firebaseError,
        activeLogData,
        isTimerRunning,
        isTimerPaused,
        pauseTimer,
        stopTimer,
        startNewSession,
        startOrResumeTimer,
        handleCloseTicket,
        handleReopenTicket,
        handleConfirmDelete,
        handleReallocateSession,
        handleUpdateTicketId,
        handleMarkSessionsSubmitted,
        handleMarkSessionsUnsubmitted,
    };
};

/**
 * Utility function to format milliseconds into HH:MM:SS
 */
const formatTime = (ms) => {
  if (ms < 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map(unit => String(unit).padStart(2, '0'))
    .join(':');
};

/**
 * UI Components (Modals, Instructions)
 */
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm" }) => {
    if (!isOpen) return null;
    const confirmButtonColor = confirmText === "Delete" ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700";
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4" onClick={onCancel}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className={`text-xl font-bold ${confirmText === "Delete" ? "text-red-600" : "text-indigo-600 dark:text-indigo-400"} mb-3`}>{title}</h3>
                <div className="text-gray-700 dark:text-gray-300 mb-6">{message}</div>
                <div className="flex justify-end space-x-3">
                    <button type="button" onClick={onCancel} className="flex items-center space-x-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">
                        <X className="w-4 h-4" /><span>Cancel</span>
                    </button>
                    <button type="button" onClick={onConfirm} className={`flex items-center space-x-1 px-4 py-2 text-white font-semibold rounded-lg ${confirmButtonColor}`}>
                        <Check className="w-4 h-4" /><span>{confirmText}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const ReallocateModal = ({ isOpen, onClose, sessionInfo, allTicketIds, onConfirm }) => {
    const [newTicketId, setNewTicketId] = useState('');
    useEffect(() => { if (isOpen) setNewTicketId(''); }, [isOpen]);
    if (!isOpen || !sessionInfo) return null;
    const handleConfirm = () => { if (newTicketId && newTicketId !== sessionInfo.currentTicketId) onConfirm(sessionInfo.sessionId, newTicketId); };
    const availableTickets = allTicketIds.filter(id => id !== sessionInfo.currentTicketId);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">Reallocate Session</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Move from <strong className="font-mono text-indigo-500">{sessionInfo.currentTicketId}</strong> to:</p>
                <select id="ticket-reallocate" value={newTicketId} onChange={(e) => setNewTicketId(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="" disabled>Select a ticket...</option>
                    {availableTickets.map(ticketId => <option key={ticketId} value={ticketId}>{ticketId}</option>)}
                </select>
                <div className="mt-8 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="flex items-center space-x-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">
                        <X className="w-4 h-4" /><span>Cancel</span>
                    </button>
                    <button type="button" onClick={handleConfirm} disabled={!newTicketId || newTicketId === sessionInfo.currentTicketId} className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                        <Check className="w-4 h-4" /><span>Confirm</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const ReportModal = ({ isOpen, onClose, reportData, ticketId }) => {
    if (!isOpen) return null;
    const copyToClipboard = () => {
        if (reportData?.text) {
            const tempInput = document.createElement('textarea');
            tempInput.value = reportData.text;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
        }
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center"><Send className="w-6 h-6 mr-2"/> AI Prompt for {ticketId}</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Copy and paste into your preferred AI chat application.</p>
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl border border-gray-300 dark:border-gray-600">
                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono text-sm">{reportData?.text}</p>
                </div>
                <div className="mt-6 flex justify-between items-center">
                    <button type="button" onClick={copyToClipboard} disabled={!reportData?.text} className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50">
                        <Clipboard className="w-4 h-4" /><span>Copy to Clipboard</span>
                    </button>
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const InstructionsContent = () => (
    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <div>
            <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">Core Features:</h4>
            <ul className="list-disc list-inside space-y-1">
                <li><strong>Timer:</strong> Enter a ticket ID and hit 'START'.</li>
                <li><strong>Notes:</strong> Add notes to your running session.</li>
                <li><strong>Editing:</strong> Click <Pencil className="w-4 h-4 inline-block -mt-1"/> to rename a ticket ID, or <CornerUpRight className="w-4 h-4 inline-block -mt-1"/> to reallocate a session.</li>
                <li><strong>Manage Tickets:</strong> Mark tickets as 'Closed' or 'Re-open' them.</li>
            </ul>
        </div>
        <div>
            <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">AI Workflow:</h4>
            <ul className="list-disc list-inside space-y-1">
                <li>Select items and click "AI Draft".</li>
                <li>After creating a draft, you'll be prompted to mark items as 'submitted'.</li>
                <li>Use the filter to view 'Submitted' items.</li>
            </ul>
        </div>
         <div>
            <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">Keyboard Shortcuts:</h4>
             <ul className="list-disc list-inside space-y-1">
                <li><span className="font-mono bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">Enter</span>: Start / Pause / Resume.</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">Alt/Cmd + Enter</span>: Stop.</li>
            </ul>
        </div>
    </div>
);

const WelcomeModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">Welcome to TickTackToto!</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">A quick guide to get you started:</p>
                <InstructionsContent />
                <div className="mt-8 flex justify-end">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">
                        Get Started
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Main application component for time tracking.
 */
const App = () => {
  // --- Firebase Auth State ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [shareId, setShareId] = useState(null);
  
  // --- UI State for Inputs ---
  const [currentTicketId, setCurrentTicketId] = useState('');
  const [currentNote, setCurrentNote] = useState('');
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editingTicketValue, setEditingTicketValue] = useState('');
  const [userTitle, setUserTitle] = useState('');

  // --- UI State for Filters & Selections ---
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [selectedSessions, setSelectedSessions] = useState(new Set());

  // --- UI State for Modals ---
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [logToDelete, setLogToDelete] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [reportingTicketInfo, setReportingTicketInfo] = useState(null); 
  const [isReallocateModalOpen, setIsReallocateModalOpen] = useState(false);
  const [reallocatingSessionInfo, setReallocatingSessionInfo] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);

  // --- Theme State ---
  const [theme, setTheme] = useState('light');

  // --- Custom Hooks for Logic ---
  const {
    logs, ticketStatuses, isLoading, firebaseError, activeLogData,
    isTimerRunning, isTimerPaused,
    pauseTimer, stopTimer, startNewSession, startOrResumeTimer,
    handleCloseTicket, handleReopenTicket, handleConfirmDelete,
    handleReallocateSession, handleUpdateTicketId,
    handleMarkSessionsSubmitted, handleMarkSessionsUnsubmitted
  } = useFirestore(db, userId, shareId);

  const { elapsedMs } = useTimer(activeLogData, isTimerRunning);

  // --- Effects for UI Sync and Initialization ---
  useEffect(() => {
    if (activeLogData) {
      setCurrentTicketId(activeLogData.ticketId);
      setCurrentNote(activeLogData.note || '');
    } else if (!isTimerRunning && !isTimerPaused) {
      // Only clear if no active session exists
      setCurrentTicketId('');
      setCurrentNote('');
    }
  }, [activeLogData, isTimerRunning, isTimerPaused]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    if (!localStorage.getItem('hasVisitedTimeTracker')) {
        setShowWelcome(true);
        localStorage.setItem('hasVisitedTimeTracker', 'true');
    }
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('shareId');
    if (id) setShareId(id);
  }, []);

  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      setDb(getFirestore(app));
      setAuth(getAuth(app));
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  }, []);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        setUserId(user.uid);
      } else {
        signInAnonymously(auth).catch(err => {
          console.error('Anonymous sign-in error:', err);
        });
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [auth]);

  // --- Auth Handlers ---
  const handleGoogleLogin = async () => { if (auth) await signInWithPopup(auth, new GoogleAuthProvider()).catch(err => console.error(err)); };
  const handleLogout = async () => { if (auth) await signOut(auth).catch(err => console.error(err)); };
  
  // --- Derived State for UI ---
  const filteredAndGroupedLogs = useMemo(() => {
    const dateFiltered = dateFilter ? logs.filter(log => log.endTime && new Date(log.endTime).toISOString().split('T')[0] === dateFilter) : logs;
    const groups = dateFiltered.reduce((acc, log) => {
      acc[log.ticketId] = acc[log.ticketId] || { ticketId: log.ticketId, totalDurationMs: 0, sessions: [], isClosed: ticketStatuses[log.ticketId]?.isClosed || false };
      acc[log.ticketId].totalDurationMs += log.accumulatedMs;
      acc[log.ticketId].sessions.push(log);
      return acc;
    }, {});

    let groupedArray = Object.values(groups);
    if (statusFilter !== 'Submitted') groupedArray = groupedArray.filter(g => g.sessions.some(s => s.status !== 'submitted'));
    
    const statusFiltered = statusFilter === 'All' ? groupedArray : groupedArray.filter(g => {
        if (statusFilter === 'Open') return !g.isClosed;
        if (statusFilter === 'Closed') return g.isClosed;
        if (statusFilter === 'Submitted') return g.sessions.every(s => s.status === 'submitted');
        return true;
    });

    return statusFiltered.sort((a, b) => Math.max(...b.sessions.map(s => s.endTime)) - Math.max(...a.sessions.map(s => s.endTime)));
  }, [logs, ticketStatuses, statusFilter, dateFilter]);

  const totalFilteredTimeMs = useMemo(() => filteredAndGroupedLogs.reduce((total, group) => total + group.totalDurationMs, 0), [filteredAndGroupedLogs]);
  const allTicketIds = useMemo(() => Array.from(new Set([...logs.map(log => log.ticketId), currentTicketId])).sort(), [logs, currentTicketId]);

  // --- UI Action Handlers ---
  const handleStartNewOrOverride = useCallback(async (ticketId) => {
    const finalTicketId = ticketId.trim();
    if (!finalTicketId || ticketStatuses[finalTicketId]?.isClosed) return;
    if (isTimerRunning || isTimerPaused) await stopTimer(currentNote, true);
    await startNewSession(finalTicketId, ''); 
  }, [isTimerRunning, isTimerPaused, stopTimer, startNewSession, ticketStatuses, currentNote]);

  const handleCreateDraft = () => {
    const finalTicketIds = new Set(selectedTickets);
    selectedSessions.forEach(sessionId => {
      const log = logs.find(l => l.id === sessionId);
      if (log) finalTicketIds.add(log.ticketId);
    });

    if (finalTicketIds.size === 0) return;
    let combinedReport = "";
    let totalTime = 0;
    finalTicketIds.forEach(ticketId => {
        const group = filteredAndGroupedLogs.find(g => g.ticketId === ticketId);
        if (group) {
            totalTime += group.totalDurationMs;
            combinedReport += `\n---\n**Ticket:** ${ticketId}\n**Time Logged:** ${formatTime(group.totalDurationMs)}\n**Session Notes:**\n${group.sessions.map(s => s.note.trim()).filter(Boolean).map(note => `- ${note}`).join('\n') || 'No detailed notes.'}\n---`;
        }
    });
    const finalPrompt = `You are a professional assistant. Write a concise, professional status update summarizing work across multiple tickets.\n\n**Task Details:**\n- **Persona:** Write as a "${userTitle || 'Team Member'}".\n- **Topic:** Status update for ${finalTicketIds.size} ticket(s).\n- **Output Format:** A single, professional paragraph.\n\n**Information to Use:**\n- **Total Time:** ${formatTime(totalTime)}\n- **Ticket Summaries:**\n${combinedReport.trim()}`;
    setReportingTicketInfo({ ticketId: finalTicketIds.size === 1 ? [...finalTicketIds][0] : `${finalTicketIds.size} Tickets` });
    setGeneratedReport({ text: finalPrompt.trim() });
    setIsReportModalOpen(true);
  };

  const handleMarkAsSubmitted = () => {
    const sessionIdsToUpdate = new Set(selectedSessions);
    selectedTickets.forEach(ticketId => logs.forEach(log => { if (log.ticketId === ticketId) sessionIdsToUpdate.add(log.id); }));
    handleMarkSessionsSubmitted(sessionIdsToUpdate);
    setSelectedTickets(new Set());
    setSelectedSessions(new Set());
    setIsConfirmingSubmit(false);
  };
  
  const handleMarkAsUnsubmitted = () => {
    const sessionIdsToUpdate = new Set(selectedSessions);
    selectedTickets.forEach(ticketId => logs.forEach(log => { if (log.ticketId === ticketId) sessionIdsToUpdate.add(log.id); }));
    handleMarkSessionsUnsubmitted(sessionIdsToUpdate);
    setSelectedTickets(new Set());
    setSelectedSessions(new Set());
  };

  const handleToggleSelectTicket = (ticketId) => setSelectedTickets(p => { const n = new Set(p); n.has(ticketId) ? n.delete(ticketId) : n.add(ticketId); return n; });
  const handleToggleSelectSession = (sessionId) => setSelectedSessions(p => { const n = new Set(p); n.has(sessionId) ? n.delete(sessionId) : n.add(sessionId); return n; });
  const handleToggleSelectAll = () => {
    const allVisible = new Set(filteredAndGroupedLogs.map(g => g.ticketId));
    if ([...allVisible].every(id => selectedTickets.has(id))) {
      setSelectedTickets(p => { const n = new Set(p); allVisible.forEach(id => n.delete(id)); return n; });
    } else {
      setSelectedTickets(p => new Set([...p, ...allVisible]));
    }
    setSelectedSessions(new Set());
  };

  // --- Timer Controls ---
  const { actionButtonText, ActionButtonIcon, actionHandler, actionStyle, isButtonDisabled, isStopButtonDisabled } = useMemo(() => {
    const inputId = currentTicketId.trim();
    const isClosed = ticketStatuses[inputId]?.isClosed;
    const isPausedOnThisTicket = isTimerPaused && activeLogData?.ticketId === inputId;
    
    if (isTimerRunning) return { actionButtonText: 'PAUSE', ActionButtonIcon: Pause, actionHandler: () => pauseTimer(currentNote), actionStyle: 'bg-yellow-500 hover:bg-yellow-600 text-white', isButtonDisabled: isLoading, isStopButtonDisabled: isLoading };
    if (isPausedOnThisTicket) return { actionButtonText: 'RESUME', ActionButtonIcon: Play, actionHandler: () => startOrResumeTimer(inputId, currentNote), actionStyle: 'bg-green-600 hover:bg-green-700 text-white', isButtonDisabled: isLoading, isStopButtonDisabled: isLoading };
    
    return { 
        actionButtonText: isClosed ? 'TICKET CLOSED' : 'START', 
        ActionButtonIcon: isClosed ? Lock : Play, 
        actionHandler: () => handleStartNewOrOverride(inputId), 
        actionStyle: isClosed ? 'bg-gray-400 text-gray-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white',
        isButtonDisabled: isLoading || !inputId || isClosed,
        isStopButtonDisabled: !isTimerPaused
    };
  }, [isTimerRunning, isTimerPaused, currentTicketId, currentNote, ticketStatuses, activeLogData, isLoading, pauseTimer, startOrResumeTimer, handleStartNewOrOverride]);

    const actionHandlerRef = useRef(actionHandler);
    const stopTimerRef = useRef(() => stopTimer(currentNote, false));

    useEffect(() => {
        actionHandlerRef.current = actionHandler;
        stopTimerRef.current = () => stopTimer(currentNote, false);
    }, [actionHandler, stopTimer, currentNote]);

    const handleKeyDown = useCallback((event) => {
      const activeTag = document.activeElement.tagName;

      if (event.key === 'Enter' && (event.altKey || event.metaKey)) {
        event.preventDefault();
        if (!isStopButtonDisabled) {
          stopTimerRef.current();
        }
        return;
      }

      if (event.key === 'Enter') {
        if (activeTag === 'TEXTAREA' || activeTag === 'BUTTON' || document.querySelector('.fixed.inset-0')) {
          return;
        }
        event.preventDefault();
        if (actionHandlerRef.current && !isButtonDisabled) {
          actionHandlerRef.current();
        }
      }
    }, [isButtonDisabled, isStopButtonDisabled]); // Dependencies that control logic

    useEffect(() => {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [handleKeyDown]);


  // --- Final Render Check ---
  if (!isAuthReady || isLoading) return <div className="flex justify-center items-center h-screen bg-gray-50"><Loader className="h-10 w-10 text-indigo-600 animate-spin" /></div>;
  if (firebaseError) return <div className="p-6 bg-red-100 text-red-700">Error: {firebaseError}</div>;

  const isActionDisabled = selectedTickets.size === 0 && selectedSessions.size === 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-sans">
      <WelcomeModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} />
      <ConfirmationModal isOpen={isConfirmingDelete} title="Confirm Deletion" message={logToDelete ? `Delete session for ${logToDelete.ticketId}? (${formatTime(logToDelete.accumulatedMs)})` : ''} onConfirm={() => { handleConfirmDelete(logToDelete); setIsConfirmingDelete(false); }} onCancel={() => setIsConfirmingDelete(false)} confirmText="Delete"/>
      <ConfirmationModal isOpen={isConfirmingSubmit} title="Mark as Submitted?" message="This will mark selected items as 'submitted' and hide them from the default view." onConfirm={handleMarkAsSubmitted} onCancel={() => setIsConfirmingSubmit(false)} confirmText="Mark as Submitted"/>
      <ReportModal isOpen={isReportModalOpen} onClose={() => { setIsReportModalOpen(false); if ((selectedTickets.size > 0 || selectedSessions.size > 0) && statusFilter !== 'Submitted') setIsConfirmingSubmit(true); }} reportData={generatedReport} ticketId={reportingTicketInfo?.ticketId}/>
      <ReallocateModal isOpen={isReallocateModalOpen} onClose={() => setIsReallocateModalOpen(false)} sessionInfo={reallocatingSessionInfo} allTicketIds={allTicketIds} onConfirm={handleReallocateSession}/>

      <div className="max-w-xl mx-auto py-8">
        <div className="flex justify-between items-start mb-8">
            <div className="relative">
                <div className="flex items-center space-x-3 mb-3">
                    {user && !user.isAnonymous ? (<><img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full border-2 border-indigo-500"/><div><p className="font-semibold text-gray-800 dark:text-gray-200">{user.displayName}</p><button type="button" onClick={handleLogout} className="text-xs text-red-500 hover:underline">Logout</button></div></>) : 
                    (<button type="button" onClick={handleGoogleLogin} className="flex items-center space-x-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold px-4 py-2 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-5 h-5"/><span>Sign in with Google</span></button>)}
                </div>
                <button type="button" onClick={() => setShowInstructions(!showInstructions)} className="flex items-center space-x-2 text-sm text-gray-500 hover:text-indigo-600"><Info className="w-4 h-4" /><span>{showInstructions ? 'Hide' : 'Show'} Instructions</span></button>
                {showInstructions && <section className="absolute z-10 top-full mt-2 w-96 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border"><h3 className="text-xl font-semibold mb-4">How to Use</h3><InstructionsContent /><button type="button" onClick={() => setShowInstructions(false)} className="flex items-center justify-center w-full space-x-2 mt-6 px-4 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-lg"><X className="w-4 h-4" /><span>Hide</span></button></section>}
            </div>
            <button type="button" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700">{theme === 'light' ? <Moon className="w-5 h-5"/> : <Sun className="w-5 h-5" />}</button>
        </div>

        <header className="text-center mb-10"><h1 className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">TickTackToto</h1><p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">the slick ticket time tracker</p></header>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl mb-8">
             <h2 className="flex items-center text-xl font-semibold mb-4 border-b pb-2"><User className="h-5 w-5 mr-2 text-gray-500"/>Your Profile</h2>
             <label htmlFor="user-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Title / Role</label>
             <input id="user-title" type="text" value={userTitle} onChange={(e) => setUserTitle(e.target.value)} placeholder="e.g., Senior Software Engineer" className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600" />
             <p className="text-xs text-gray-500 mt-1">Used to personalize AI-ready prompts.</p>
        </section>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl mb-8 border-t-4 border-indigo-500">
          <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-semibold">{isTimerRunning ? 'Currently Running' : isTimerPaused ? 'Activity Paused' : 'Start New Session'}</h2><Clock className="h-6 w-6 text-indigo-500" /></div>
          <input type="text" placeholder="Enter Ticket ID (e.g., JIRA-101)" value={currentTicketId} onChange={(e) => setCurrentTicketId(e.target.value)} disabled={isTimerRunning} className={`w-full p-3 mb-4 text-lg border-2 rounded-xl transition-all shadow-sm ${isTimerRunning ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}/>
          {ticketStatuses[currentTicketId.trim()]?.isClosed && <p className="text-red-500 text-sm mb-4 flex items-center"><Lock className="w-4 h-4 mr-1"/> This ticket is closed.</p>}
          {(isTimerRunning || isTimerPaused) && <div className="mb-4"><label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">Session Notes</label><textarea placeholder="What are you working on?" value={currentNote} onChange={(e) => setCurrentNote(e.target.value)} rows="2" className="w-full p-2 text-sm border-2 rounded-xl bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 resize-none"/></div>}
          <div className={`text-center py-4 rounded-xl mb-6 ${isTimerRunning ? 'bg-indigo-50 dark:bg-indigo-900/50' : isTimerPaused ? 'bg-yellow-50 dark:bg-yellow-900/50' : 'bg-gray-50 dark:bg-gray-700/50'}`}><p className="text-4xl font-mono font-bold">{formatTime(elapsedMs)}</p></div>
          <div className="flex space-x-3">
            <button type="button" onClick={actionHandler} disabled={isButtonDisabled} className={`flex-grow flex items-center justify-center space-x-2 py-4 rounded-xl font-bold text-lg ${actionStyle} disabled:opacity-50 disabled:cursor-not-allowed`}><ActionButtonIcon className="h-6 w-6" /><span>{actionButtonText}</span></button>
            <button type="button" onClick={() => stopTimer(currentNote)} disabled={isStopButtonDisabled} className="w-16 flex items-center justify-center py-4 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"><Square className="h-6 w-6" /></button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">Filter & Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 items-end">
                <div><label htmlFor="status-filter" className="block text-sm font-medium mb-1">Status</label><select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"><option value="All">All Unsubmitted</option><option value="Open">Open</option><option value="Closed">Closed</option><option value="Submitted">Submitted</option></select></div>
                <div><label htmlFor="date-filter" className="block text-sm font-medium mb-1">Date</label><input type="date" id="date-filter" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full p-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"/></div>
                <button type="button" onClick={() => { setStatusFilter('All'); setDateFilter(''); }} className="w-full sm:w-auto px-4 py-2 bg-gray-200 dark:bg-gray-600 font-semibold rounded-lg hover:bg-gray-300">Clear</button>
            </div>
            <div className="bg-indigo-50 dark:bg-gray-700/50 p-4 rounded-lg text-center"><p className="text-sm font-medium text-indigo-600 dark:text-indigo-300">Total for Filtered</p><p className="text-2xl font-bold font-mono text-indigo-900 dark:text-indigo-100 mt-1">{formatTime(totalFilteredTimeMs)}</p></div>
        </section>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl mt-8">
          <div className="flex justify-between items-center gap-4 mb-4 border-b pb-2"><h2 className="flex items-center text-xl font-semibold"><List className="h-5 w-5 mr-2" />History</h2><div className="flex items-center gap-2">{statusFilter==='Submitted' ? (<button type="button" onClick={handleMarkAsUnsubmitted} disabled={isActionDisabled || isLoading} className="px-4 py-2 bg-yellow-500 text-white font-semibold text-sm rounded-lg hover:bg-yellow-600 disabled:opacity-50">Unsubmit</button>) : (<button type="button" onClick={handleCreateDraft} disabled={isActionDisabled || isLoading} className="px-4 py-2 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">AI Draft</button>)}
          </div></div>
          <div className="flex items-center pb-4 border-b"><input type="checkbox" id="select-all" checked={filteredAndGroupedLogs.length > 0 && filteredAndGroupedLogs.every(g => selectedTickets.has(g.ticketId))} onChange={handleToggleSelectAll} disabled={!filteredAndGroupedLogs.length} className="h-5 w-5 rounded border-gray-300 text-indigo-600"/><label htmlFor="select-all" className="ml-2 text-sm font-medium">Select All Visible</label></div>
          <ul className="space-y-6 max-h-96 overflow-y-auto pt-4">{filteredAndGroupedLogs.length === 0 ? <p className="text-center py-4">No logs match filters.</p> : filteredAndGroupedLogs.map(group => (<li key={group.ticketId} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border"><div className="flex justify-between items-start mb-2 border-b pb-2"><div className="flex items-start flex-grow"><input type="checkbox" checked={selectedTickets.has(group.ticketId)} onChange={() => handleToggleSelectTicket(group.ticketId)} className="h-5 w-5 rounded border-gray-300 text-indigo-600 mr-4 mt-1"/><div><div className="flex items-center gap-2">{editingTicketId === group.ticketId ? (<input type="text" value={editingTicketValue} onChange={(e) => setEditingTicketValue(e.target.value)} onBlur={() => handleUpdateTicketId(group.ticketId, editingTicketValue)} onKeyDown={(e) => {if (e.key === 'Enter') handleUpdateTicketId(group.ticketId, editingTicketValue); else if (e.key === 'Escape') setEditingTicketId(null);}} className="text-indigo-700 font-extrabold text-lg bg-indigo-50 rounded-md px-2" autoFocus/>) : (<><p className="text-indigo-700 font-extrabold text-lg break-all">{group.ticketId}</p>{group.sessions.every(s=>s.status==='submitted') && <Check className="w-5 h-5 text-green-500"/>}<button type="button" onClick={() => {setEditingTicketId(group.ticketId); setEditingTicketValue(group.ticketId);}} className="text-gray-400 hover:text-indigo-600"><Pencil className="w-4 h-4" /></button></>)}</div><p className="text-sm mt-1">Total: <span className="font-mono font-bold text-base">{formatTime(group.totalDurationMs)}</span></p></div></div><div className="flex flex-col space-y-2 mt-1">{group.isClosed ? (<><span className="flex items-center justify-center space-x-1 px-3 py-1 bg-gray-300 font-semibold text-xs rounded-lg"><Lock className="h-4 w-4" /><span>Closed</span></span><button type="button" onClick={() => handleReopenTicket(group.ticketId)} disabled={isLoading} className="flex items-center justify-center space-x-1 px-3 py-1 bg-green-100 text-green-700 font-semibold text-xs rounded-lg"><Repeat className="w-4 w-4" /><span>Re-open</span></button></>) : (<><button type="button" onClick={() => handleCloseTicket(group.ticketId)} disabled={isLoading} className="flex items-center justify-center space-x-1 px-3 py-1 bg-red-100 text-red-700 font-semibold text-xs rounded-lg"><Lock className="h-4 w-4" /><span>Close</span></button><button type="button" onClick={() => handleStartNewOrOverride(group.ticketId)} disabled={isLoading} className="flex items-center justify-center space-x-1 px-3 py-1 bg-indigo-500 text-white font-semibold text-xs rounded-lg"><Repeat className="w-4 w-4" /><span>Continue</span></button></>)}</div></div><ul className="pl-3 space-y-2 mt-2 border-l-2">{group.sessions.sort((a,b) => b.endTime - a.endTime).map(session => (<li key={session.id} className="text-xs pt-1 pb-1"><div className="flex justify-between items-center gap-2"><div className="flex items-center gap-2"><input type="checkbox" checked={selectedTickets.has(group.ticketId) || selectedSessions.has(session.id)} onChange={() => handleToggleSelectSession(session.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600"/>{session.status==='submitted' && <Check className="h-4 w-4 text-green-500" />}<span className={`font-mono font-bold text-sm ${session.status==='submitted' ? 'text-gray-400' : ''}`}>{formatTime(session.accumulatedMs)}</span></div><span className="text-gray-500 text-right text-xs">{new Date(session.endTime).toLocaleDateString()}</span><button type="button" onClick={() => {setReallocatingSessionInfo({sessionId: session.id, currentTicketId: group.ticketId}); setIsReallocateModalOpen(true);}} disabled={isLoading} className="p-1 text-gray-400 hover:text-indigo-600"><CornerUpRight className="h-4 w-4" /></button><button type="button" onClick={() => {setLogToDelete(session); setIsConfirmingDelete(true);}} disabled={isLoading} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>{session.note && <p className={`mt-1 flex items-start text-xs border-t pt-1 ${session.status==='submitted' ? 'text-gray-400' : 'text-gray-600'}`}><BookOpen className="h-3 w-3 mr-1 text-indigo-400 flex-shrink-0 mt-px"/><em>{session.note}</em></p>}</li>))}</ul></li>))}</ul>
        </section>
      </div>
    </div>
  );
};

export default App;

