import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock, Play, Square, List, AlertTriangle, Loader, Trash2, Pause, X, Check, Repeat, Download, Lock, Send, Clipboard, BookOpen, User, Keyboard, Sun, Moon, Info, Pencil, CornerUpRight
} from 'lucide-react';

// --- Firebase Imports (MUST use module path for React) ---
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
} from 'firebase/auth';
import {
  getFirestore, collection, query, onSnapshot,
  doc, updateDoc, deleteDoc, addDoc, where, getDocs, writeBatch
} from 'firebase/firestore';
import { setLogLevel } from 'firebase/firestore';

// Set Firebase log level for debugging in the console
setLogLevel('debug');

// --- Global Variable Access (MODIFIED FOR LOCAL DEVELOPMENT) ---
const appId = 'default-app-id'; 

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

/**
 * Utility function to format milliseconds into HH:MM:SS
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time string
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
 * Custom Confirmation Modal Component
 */
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm" }) => {
    if (!isOpen) return null;

    const confirmButtonColor = confirmText === "Delete" ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4" onClick={onCancel}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl transform transition-all scale-100" 
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className={`text-xl font-bold ${confirmText === "Delete" ? "text-red-600" : "text-indigo-600 dark:text-indigo-400"} mb-3`}>{title}</h3>
                <div className="text-gray-700 dark:text-gray-300 mb-6">{message}</div>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="flex items-center space-x-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
                    >
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex items-center space-x-1 px-4 py-2 text-white font-semibold rounded-lg transition-colors active:scale-[0.98] ${confirmButtonColor}`}
                    >
                        <Check className="w-4 h-4" />
                        <span>{confirmText}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const ReallocateModal = ({ isOpen, onClose, sessionInfo, allTicketIds, onConfirm }) => {
    const [newTicketId, setNewTicketId] = useState('');

    useEffect(() => {
        // Reset selection when modal opens or session changes
        if (isOpen) {
            setNewTicketId('');
        }
    }, [isOpen, sessionInfo]);

    if (!isOpen || !sessionInfo) return null;

    const handleConfirm = () => {
        if (newTicketId && newTicketId !== sessionInfo.currentTicketId) {
            onConfirm(sessionInfo.sessionId, newTicketId);
        }
    };

    // Filter out the current ticket ID from the list of options
    const availableTickets = allTicketIds.filter(id => id !== sessionInfo.currentTicketId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all scale-100" 
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">Reallocate Session</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    Move this session from <strong className="font-mono text-indigo-500">{sessionInfo.currentTicketId}</strong> to another ticket.
                </p>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="ticket-reallocate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            New Ticket ID
                        </label>
                        <select
                            id="ticket-reallocate"
                            value={newTicketId}
                            onChange={(e) => setNewTicketId(e.target.value)}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="" disabled>Select a ticket...</option>
                            {availableTickets.map(ticketId => (
                                <option key={ticketId} value={ticketId}>{ticketId}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div className="mt-8 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="flex items-center space-x-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
                    >
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!newTicketId || newTicketId === sessionInfo.currentTicketId}
                        className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors active:scale-[0.98] disabled:opacity-50"
                    >
                        <Check className="w-4 h-4" />
                        <span>Confirm Reallocation</span>
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
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-xl shadow-2xl transform transition-all scale-100 overflow-y-auto max-h-[90vh]" 
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center">
                    <Send className="w-6 h-6 mr-2"/> AI Prompt for {ticketId}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Copy this prompt and paste it into your preferred AI chat application.</p>
                
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl border border-gray-300 dark:border-gray-600">
                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono text-sm">{reportData?.text}</p>
                </div>
                <div className="mt-6 flex justify-between items-center">
                    <button
                        onClick={copyToClipboard}
                        disabled={!reportData?.text}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors active:scale-[0.98] disabled:opacity-50"
                    >
                        <Clipboard className="w-4 h-4" />
                        <span>Copy to Clipboard</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
                    >
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
                <li><strong>Start/Stop Timer:</strong> Enter a ticket ID and hit 'START'. The timer will run until you PAUSE or STOP.</li>
                <li><strong>Session Notes:</strong> Add notes to your running session. They are saved when you pause or stop.</li>
                <li><strong>Inline Ticket Editing:</strong> Click the <Pencil className="w-4 h-4 inline-block -mt-1"/> icon next to a ticket ID to rename it across all its sessions.</li>
                <li><strong>Session Reallocation:</strong> Click the <CornerUpRight className="w-4 h-4 inline-block -mt-1"/> icon on a session to move it to a different ticket.</li>
                <li><strong>History & Filtering:</strong> Your completed sessions are grouped by ticket ID. Filter them by status (Open/Closed), date, or view 'Submitted' tickets.</li>
                <li><strong>Manage Tickets:</strong> Mark tickets as 'Closed' to archive them, or 'Re-open' them if you need to track more time.</li>
                <li><strong>Export Data:</strong> Export all logs, filtered logs, or selected logs to a CSV file.</li>
            </ul>
        </div>
        <div>
            <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">AI-Ready Prompts & Workflow:</h4>
            <ul className="list-disc list-inside space-y-1">
                <li><strong>Multi-Item Draft:</strong> Select multiple tickets or individual sessions using the checkboxes, then click the "AI Draft" button at the top of the history section.</li>
                <li>After creating a draft, you'll be prompted to mark the selected items as 'submitted'.</li>
                <li>Submitted sessions are hidden by default and marked with a <Check className="w-4 h-4 inline-block -mt-1 text-green-500"/>. Use the filter to view them again.</li>
            </ul>
        </div>
         <div>
            <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">Keyboard Shortcuts:</h4>
             <ul className="list-disc list-inside space-y-1">
                <li><span className="font-mono bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">Enter</span>: Start / Pause / Resume timer.</li>
                <li><span className="font-mono bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">Alt + Enter</span> or <span className="font-mono bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">Cmd + Enter</span>: Stop and finalize the current entry.</li>
            </ul>
        </div>
    </div>
);

const WelcomeModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4">
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl transform transition-all scale-100 overflow-y-auto max-h-[90vh]" 
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">Welcome to TickTackToto!</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Here’s a quick guide to get you started:</p>
                
                <InstructionsContent />

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors active:scale-[0.98]"
                    >
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
  // --- Firebase State ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [firebaseError, setFirebaseError] = useState(null);
  
  // --- Inline Editing State ---
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editingTicketValue, setEditingTicketValue] = useState('');

  // --- Sharing State ---
  const [shareId, setShareId] = useState(null);

  // --- App State ---
  const [logs, setLogs] = useState([]);
  const [currentTicketId, setCurrentTicketId] = useState('');
  const [currentNote, setCurrentNote] = useState('');
  const [isTimerRunning, setIsTimerRunning] = useState(false); 
  const [isTimerPaused, setIsTimerPaused] = useState(false); 
  const [elapsedMs, setElapsedMs] = useState(0); 
  const [runningLogDocId, setRunningLogDocId] = useState(null);
  const [activeLogData, setActiveLogData] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);
  const [ticketStatuses, setTicketStatuses] = useState({});
  const [userTitle, setUserTitle] = useState('');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // --- Filter & Selection State ---
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [selectedSessions, setSelectedSessions] = useState(new Set());
  const [exportOption, setExportOption] = useState('');


  // --- Modal State ---
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

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Check for first visit to show welcome message
  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisitedTimeTracker');
    if (!hasVisited) {
        setShowWelcome(true);
        localStorage.setItem('hasVisitedTimeTracker', 'true');
    }
  }, []);
  
  // --- Check for Share ID in URL on initial load ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('shareId');
    if (id) {
      setShareId(id);
    }
  }, []);

  // --- Firebase Initialization and Authentication ---
  useEffect(() => {
    try {
      if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
        setFirebaseError('Firebase configuration is missing or invalid. Please replace the placeholder values in your firebaseConfig object.');
        setIsLoading(false);
        return;
      }

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const userAuth = getAuth(app);

      setDb(firestore);
      setAuth(userAuth);

      const unsubscribe = onAuthStateChanged(userAuth, (user) => {
        if (user) {
          setUser(user);
          setUserId(user.uid);
          setIsAuthReady(true);
        } else {
          // If no user, sign in anonymously to allow app usage
          signInAnonymously(userAuth).catch(err => {
            console.error('Anonymous sign-in error:', err);
            setFirebaseError('Failed to sign in anonymously.');
          });
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Firebase initialization error:', error);
      setFirebaseError('Error initializing Firebase. See console.');
      setIsLoading(false);
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google login error:", error);
      setFirebaseError("Failed to sign in with Google.");
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  

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

  // --- Real-time Ticket Status Listener (onSnapshot) ---
  useEffect(() => {
    if (!isAuthReady || !getTicketStatusCollectionRef) return;

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
    });

    return () => unsubscribe();
  }, [isAuthReady, getTicketStatusCollectionRef]);

  // --- Real-time Log Listener (onSnapshot) ---
  useEffect(() => {
    if (!isAuthReady || !getCollectionRef) return;
    
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
          status: data.status || 'unsubmitted' // Add status field
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
        setCurrentTicketId(currentActiveLog.ticketId);
        setCurrentNote(currentActiveLog.note || '');
        setActiveLogData(currentActiveLog); 

        if (currentActiveLog.startTime) {
          setIsTimerRunning(true);
          setIsTimerPaused(false);
          const currentRunDuration = Date.now() - currentActiveLog.startTime;
          setElapsedMs(currentActiveLog.accumulatedMs + currentRunDuration);
        } else {
          setIsTimerRunning(false);
          setIsTimerPaused(true);
          setElapsedMs(currentActiveLog.accumulatedMs);
        }
      } else {
        if (runningLogDocId) {
            setIsTimerRunning(false);
            setIsTimerPaused(false);
            setRunningLogDocId(null);
            setActiveLogData(null); 
            setCurrentTicketId('');
            setCurrentNote('');
            setElapsedMs(0);
        }
      }

      setIsLoading(false);
      setHasLoadedOnce(true);
    }, (error) => {
      console.error('Firestore snapshot error:', error);
      setFirebaseError('Failed to load real-time data. Check console.');
      setIsLoading(false);
      setHasLoadedOnce(true);
    });

    return () => unsubscribe();
  }, [isAuthReady, getCollectionRef, runningLogDocId]);

  // --- Timer Interval Effect ---
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && runningLogDocId) {
      interval = setInterval(() => {
         if(activeLogData && activeLogData.startTime) {
            const currentRunDuration = Date.now() - activeLogData.startTime;
            setElapsedMs(activeLogData.accumulatedMs + currentRunDuration);
         }
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTimerRunning, runningLogDocId, activeLogData]);

  // --- Effect to clear selections when filters change ---
  useEffect(() => {
    setSelectedTickets(new Set());
    setSelectedSessions(new Set());
  }, [statusFilter, dateFilter]);
  
  // --- Derived State: Grouped Logs and Totals ---
  const filteredAndGroupedLogs = useMemo(() => {
    const dateFilteredLogs = dateFilter
      ? logs.filter(log => {
          if (!log.endTime) return false;
          const logDate = new Date(log.endTime).toISOString().split('T')[0];
          return logDate === dateFilter;
        })
      : logs;

    const groups = dateFilteredLogs.reduce((acc, log) => {
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

    // Filter by 'submitted' status
    if (statusFilter !== 'Submitted') {
        groupedArray = groupedArray.filter(group => 
            group.sessions.some(session => session.status !== 'submitted')
        );
    }

    const statusFilteredGroups = statusFilter === 'All'
      ? groupedArray
      : groupedArray.filter(group => {
          if (statusFilter === 'Open') return !group.isClosed;
          if (statusFilter === 'Closed') return group.isClosed;
          if (statusFilter === 'Submitted') {
            return group.sessions.every(s => s.status === 'submitted');
          }
          return true;
        });

    statusFilteredGroups.sort((a, b) => {
        const lastSessionA = Math.max(...a.sessions.map(s => s.endTime).filter(Boolean));
        const lastSessionB = Math.max(...b.sessions.map(s => s.endTime).filter(Boolean));
        return lastSessionB - lastSessionA;
    });


    return statusFilteredGroups;
  }, [logs, ticketStatuses, statusFilter, dateFilter]);

  const totalFilteredTimeMs = useMemo(() => {
    return filteredAndGroupedLogs.reduce((total, group) => total + group.totalDurationMs, 0);
  }, [filteredAndGroupedLogs]);

  const allTicketIds = useMemo(() => {
    const ids = new Set(logs.map(log => log.ticketId));
    if (currentTicketId) ids.add(currentTicketId);
    return Array.from(ids).sort();
  }, [logs, currentTicketId]);

  // --- Core Timer Functions ---

  const pauseTimer = useCallback(async () => {
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
  }, [runningLogDocId, isTimerRunning, getCollectionRef, activeLogData, currentNote]);


  const stopTimer = useCallback(async (isAutoOverride = false) => {
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
        status: 'unsubmitted' // Ensure new logs are unsubmitted
      });
      
      if (!isAutoOverride) {
          setCurrentTicketId(''); 
          setCurrentNote('');
      }

    } catch (error)      {
      console.error('Error stopping timer:', error);
      setFirebaseError('Failed to stop timer.');
    } finally {
      setIsLoading(false);
    }
  }, [runningLogDocId, getCollectionRef, isTimerRunning, isTimerPaused, activeLogData, currentNote]);

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
            status: 'unsubmitted' // Default status
        };
        await addDoc(getCollectionRef, newEntry);
    } catch (error) {
        console.error('Error starting new timer:', error);
        setFirebaseError('Failed to start new timer.');
    } finally {
        setIsLoading(false);
    }
  }, [getCollectionRef]);

  const startOrResumeTimer = useCallback(async () => {
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
  }, [getCollectionRef, currentTicketId, isTimerRunning, isTimerPaused, runningLogDocId, startNewSession, currentNote]);

  const startNewOrOverride = useCallback(async (ticketId) => {
    const finalTicketId = ticketId || currentTicketId;
    if (!getCollectionRef || finalTicketId.trim() === '') return;
    
    if (ticketStatuses[finalTicketId]?.isClosed) {
        console.log(`Cannot start session for closed ticket: ${finalTicketId}`);
        return; 
    }

    if (isTimerRunning || isTimerPaused) {
        await stopTimer(true);
    }
    
    await startNewSession(finalTicketId, ''); 
    
    setCurrentTicketId(finalTicketId);
    setCurrentNote(''); 
  }, [getCollectionRef, currentTicketId, isTimerPaused, isTimerRunning, stopTimer, startNewSession, ticketStatuses]);

  const handleContinueTicket = useCallback(async (ticketId) => {
    await startNewOrOverride(ticketId);
  }, [startNewOrOverride]);
  
  const handleCloseTicket = useCallback(async (ticketId) => {
    if (!getTicketStatusCollectionRef || isLoading) return;

    setIsLoading(true);
    const statusEntry = ticketStatuses[ticketId];

    try {
        if (statusEntry && statusEntry.id) {
            await updateDoc(doc(getTicketStatusCollectionRef, statusEntry.id), { isClosed: true });
        } else {
            await addDoc(getTicketStatusCollectionRef, {
                ticketId: ticketId,
                isClosed: true,
            });
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

  const handleDeleteClick = useCallback((session) => {
    setLogToDelete(session);
    setIsConfirmingDelete(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!logToDelete || !getCollectionRef) return;
    
    setIsConfirmingDelete(false);
    setIsLoading(true);

    try {
        await deleteDoc(doc(getCollectionRef, logToDelete.id));
    } catch (error) {
        console.error('Error deleting log:', error);
        setFirebaseError('Failed to delete log entry.');
    } finally {
        setLogToDelete(null);
        setIsLoading(false);
    }
  }, [logToDelete, getCollectionRef]);

  const handleCancelDelete = useCallback(() => {
    setIsConfirmingDelete(false);
    setLogToDelete(null);
  }, []);
  
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
        setIsReallocateModalOpen(false);
        setReallocatingSessionInfo(null);
        setIsLoading(false);
    }
  }, [getCollectionRef]);

  const handleUpdateTicketId = useCallback(async (oldTicketId, newTicketId) => {
    if (!newTicketId || oldTicketId === newTicketId || !getCollectionRef || !getTicketStatusCollectionRef) {
      setEditingTicketId(null);
      return;
    }
    
    setIsLoading(true);
    const batch = writeBatch(db);

    try {
      // 1. Update all session documents
      const sessionsQuery = query(getCollectionRef, where("ticketId", "==", oldTicketId));
      const sessionSnapshots = await getDocs(sessionsQuery);
      sessionSnapshots.forEach((doc) => {
        batch.update(doc.ref, { ticketId: newTicketId });
      });

      // 2. Update the corresponding status document
      const statusQuery = query(getTicketStatusCollectionRef, where("ticketId", "==", oldTicketId));
      const statusSnapshots = await getDocs(statusQuery);
      statusSnapshots.forEach((doc) => {
        batch.update(doc.ref, { ticketId: newTicketId });
      });

      await batch.commit();

    } catch (error) {
      console.error("Error updating ticket ID:", error);
      setFirebaseError("Failed to update ticket ID. Please check the console.");
    } finally {
      setEditingTicketId(null);
      setEditingTicketValue('');
      setIsLoading(false);
    }
  }, [getCollectionRef, getTicketStatusCollectionRef, db]);

  const handleMarkAsSubmitted = useCallback(async () => {
    const finalSessionIds = new Set(selectedSessions);
    selectedTickets.forEach(ticketId => {
        logs.forEach(log => {
            if (log.ticketId === ticketId) {
                finalSessionIds.add(log.id);
            }
        });
    });

    if (finalSessionIds.size === 0 || !getCollectionRef) return;

    setIsLoading(true);
    const batch = writeBatch(db);

    try {
        finalSessionIds.forEach(sessionId => {
            const docRef = doc(getCollectionRef, sessionId);
            batch.update(docRef, { status: 'submitted' });
        });
        await batch.commit();
        setSelectedTickets(new Set()); // Clear selections
        setSelectedSessions(new Set());
    } catch (error) {
        console.error("Error marking sessions as submitted:", error);
        setFirebaseError("Failed to mark sessions as submitted.");
    } finally {
        setIsLoading(false);
        setIsConfirmingSubmit(false);
    }
}, [selectedTickets, selectedSessions, logs, getCollectionRef, db]);

  const handleMarkAsUnsubmitted = useCallback(async () => {
    const finalSessionIds = new Set(selectedSessions);
    selectedTickets.forEach(ticketId => {
        logs.forEach(log => {
            if (log.ticketId === ticketId) {
                finalSessionIds.add(log.id);
            }
        });
    });

    if (finalSessionIds.size === 0 || !getCollectionRef) return;

    setIsLoading(true);
    const batch = writeBatch(db);

    try {
        finalSessionIds.forEach(sessionId => {
            const docRef = doc(getCollectionRef, sessionId);
            batch.update(docRef, { status: 'unsubmitted' });
        });
        await batch.commit();
        setSelectedTickets(new Set()); // Clear selections
        setSelectedSessions(new Set());
    } catch (error) {
        console.error("Error marking sessions as unsubmitted:", error);
        setFirebaseError("Failed to mark sessions as unsubmitted.");
    } finally {
        setIsLoading(false);
    }
  }, [selectedTickets, selectedSessions, logs, getCollectionRef, db]);

  const handleCreateDraft = () => {
    const finalTicketIds = new Set(selectedTickets);
    selectedSessions.forEach(sessionId => {
        const log = logs.find(l => l.id === sessionId);
        if (log) {
            finalTicketIds.add(log.ticketId);
        }
    });

    if (finalTicketIds.size === 0) return;

    let combinedReport = "";
    let totalTime = 0;

    finalTicketIds.forEach(ticketId => {
        const group = filteredAndGroupedLogs.find(g => g.ticketId === ticketId);
        if (group) {
            const allNotes = group.sessions
                .map(s => s.note.trim())
                .filter(Boolean)
                .map(note => `- ${note}`)
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
  };


  const handleExport = useCallback((exportType) => {
    if (!exportType) return;

    let logsToExport = [];
    let reportName = 'time-report';

    switch (exportType) {
      case 'selected':
        if (selectedTickets.size === 0 && selectedSessions.size === 0) {
          console.log('Export skipped: No items selected.');
          setExportOption('');
          return;
        }
        
        const finalSelectedSessions = new Set();
        selectedSessions.forEach(sessionId => {
            const log = logs.find(l => l.id === sessionId);
            if (log) finalSelectedSessions.add(log);
        });
        selectedTickets.forEach(ticketId => {
            logs.forEach(log => {
                if (log.ticketId === ticketId && log.endTime) {
                    finalSelectedSessions.add(log);
                }
            });
        });
        logsToExport = Array.from(finalSelectedSessions);

        reportName = 'selected-report';
        break;

      case 'filtered':
        logsToExport = filteredAndGroupedLogs.flatMap(group => group.sessions);
        reportName = filteredAndGroupedLogs.length === 1
          ? filteredAndGroupedLogs[0].ticketId.replace(/[^a-z0-9]/gi, '_').toLowerCase()
          : 'filtered-report';
        break;

      case 'all':
        logsToExport = logs.filter(log => log.endTime);
        reportName = 'full-report';
        break;
      
      default:
        setExportOption('');
        return;
    }

    if (logsToExport.length === 0) {
      console.log(`Export skipped: No logs for type "${exportType}".`);
      setExportOption('');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const filename = `${reportName}-${today}.csv`;

    try {
      const headers = ["Ticket ID", "Duration (HH:MM:SS)", "Duration (ms)", "Note", "Finished Date/Time", "Session ID", "Status"];
      const csvRows = logsToExport.map(log => {
        const escape = (data) => `"${String(data).replace(/"/g, '""')}"`;
        const formattedDuration = formatTime(log.accumulatedMs);
        const finishTime = log.endTime ? new Date(log.endTime).toLocaleString('en-US') : 'N/A';
        return [escape(log.ticketId), escape(formattedDuration), log.accumulatedMs, escape(log.note || ''), escape(finishTime), escape(log.id), escape(log.status)].join(',');
      });

      const csvContent = [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CSV Export Failed:', error);
      setFirebaseError('CSV export failed. See console for details.');
    } finally {
      setExportOption('');
    }
  }, [logs, selectedTickets, selectedSessions, filteredAndGroupedLogs]);

  const handleToggleSelectTicket = (ticketId) => {
    setSelectedTickets(prevSelected => {
        const newSelected = new Set(prevSelected);
        if (newSelected.has(ticketId)) {
            newSelected.delete(ticketId);
        } else {
            newSelected.add(ticketId);
        }
        return newSelected;
    });
  };

  const handleToggleSelectSession = (sessionId) => {
    setSelectedSessions(prevSelected => {
        const newSelected = new Set(prevSelected);
        if (newSelected.has(sessionId)) {
            newSelected.delete(sessionId);
        } else {
            newSelected.add(sessionId);
        }
        return newSelected;
    });
  };

  const handleToggleSelectAll = () => {
      const allVisibleTicketIds = new Set(filteredAndGroupedLogs.map(g => g.ticketId));
      const allVisibleSelected = [...allVisibleTicketIds].every(id => selectedTickets.has(id));

      if (allVisibleSelected) {
          setSelectedTickets(prevSelected => {
              const newSelected = new Set(prevSelected);
              allVisibleTicketIds.forEach(id => newSelected.delete(id));
              return newSelected;
          });
      } else {
          setSelectedTickets(prevSelected => new Set([...prevSelected, ...allVisibleTicketIds]));
      }
      setSelectedSessions(new Set()); // Clear individual session selections
  };
  
  const isReady = isAuthReady && userId && db;
  const pausedTicketId = isTimerPaused ? activeLogData?.ticketId : '';
  const inputTicketId = currentTicketId.trim();
  const isInputTicketClosed = ticketStatuses[inputTicketId]?.isClosed || false;

  let actionButtonText;
  let ActionButtonIcon;
  let actionHandler;
  let actionStyle;

  if (isTimerRunning) {
    actionButtonText = 'PAUSE';
    ActionButtonIcon = Pause;
    actionHandler = pauseTimer;
    actionStyle = 'bg-yellow-500 hover:bg-yellow-600 text-white';
  } else if (isTimerPaused && inputTicketId === pausedTicketId) {
    actionButtonText = 'RESUME';
    ActionButtonIcon = Play;
    actionHandler = startOrResumeTimer;
    actionStyle = 'bg-green-600 hover:bg-green-700 text-white';
  } else {
    actionButtonText = isInputTicketClosed ? 'TICKET CLOSED' : 'START';
    ActionButtonIcon = isInputTicketClosed ? Lock : Play;
    actionHandler = () => startNewOrOverride(inputTicketId);
    actionStyle = isInputTicketClosed 
        ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
        : 'bg-indigo-600 hover:bg-indigo-700 text-white';
  }
  
  const isInputDisabled = isTimerRunning || !isReady; 
  const isButtonDisabled = !isReady || (isInputTicketClosed && !isTimerPaused && !isTimerRunning) || (currentTicketId.trim() === '' && !isTimerRunning && !isTimerPaused);
  const isStopButtonDisabled = !isTimerRunning && !isTimerPaused;
  const isActionDisabled = selectedTickets.size === 0 && selectedSessions.size === 0;

  useEffect(() => {
    const handleKeyDown = (event) => {
      const activeTag = document.activeElement.tagName;

      if (event.key === 'Enter' && (event.altKey || event.metaKey)) {
        event.preventDefault();
        if (!isStopButtonDisabled) {
          stopTimer(false);
        }
        return; 
      }
      
      if (event.key === 'Enter') {
        if (activeTag === 'TEXTAREA' || activeTag === 'INPUT' || activeTag === 'BUTTON' || document.querySelector('.fixed.inset-0') || editingTicketId) {
          return;
        }

        event.preventDefault();
        if (actionHandler && !isButtonDisabled) {
          actionHandler();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [actionHandler, isButtonDisabled, isStopButtonDisabled, stopTimer]);


  // --- Render Logic ---
  let deleteMessage = null;
  if (logToDelete) {
      deleteMessage = (
          <div>
              <p>Are you sure you want to delete this session for ticket <strong>{logToDelete.ticketId}</strong>?</p>
              <div className="mt-4 text-sm bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                  <p><strong>Duration:</strong> {formatTime(logToDelete.accumulatedMs)}</p>
                  {logToDelete.note && <p className="mt-1"><strong>Note:</strong> <em className="break-words">{logToDelete.note}</em></p>}
              </div>
          </div>
      );
  }

  if (firebaseError) {
    return (
      <div className="p-6 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md mx-auto max-w-lg mt-8">
        <div className="flex items-center">
          <AlertTriangle className="h-6 w-6 mr-3" />
          <h2 className="text-xl font-bold">Error</h2>
        </div>
        <p className="mt-2 text-sm">{firebaseError}</p>
        <p className="mt-2 text-xs">User ID: <span className='break-all'>{userId || 'N/A'}</span>. App ID: {appId}</p>
      </div>
    );
  }
  
  if (!isAuthReady || !hasLoadedOnce) {
    return (
        <div className="flex justify-center items-center h-screen bg-gray-50">
            <Loader className="h-10 w-10 text-indigo-600 animate-spin" />
            <p className="ml-3 text-lg font-medium text-gray-700">Loading Tracker...</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-sans antialiased">
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
        isOpen={isConfirmingSubmit}
        title="Mark as Submitted?"
        message={`This will mark all sessions for the selected ticket(s) as 'submitted'. Submitted items are hidden by default.`}
        onConfirm={handleMarkAsSubmitted}
        onCancel={() => setIsConfirmingSubmit(false)}
        confirmText="Mark as Submitted"
      />
      <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            if ((selectedTickets.size > 0 || selectedSessions.size > 0) && statusFilter !== 'Submitted') {
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

      <div className="max-w-xl mx-auto py-8">
        <div className="flex justify-between items-start mb-8">
            <div className="relative">
                <div className="flex flex-col space-y-3">
                    <div className="flex items-center space-x-3">
                        {user && !user.isAnonymous ? (
                            <>
                                <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full border-2 border-indigo-500"/>
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
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" className="w-5 h-5"/>
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
                    <section className="absolute z-10 top-full mt-2 w-96 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-indigo-200 dark:border-indigo-800">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">How to Use This Tracker</h3>
                        <InstructionsContent />
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => setShowInstructions(false)}
                                className="flex items-center justify-center w-full space-x-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
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
                    {theme === 'light' ? <Moon className="w-5 h-5"/> : <Sun className="w-5 h-5" />}
                </button>
            </div>
        </div>

        <header className="text-center mb-10">
          <div className="flex flex-col justify-center items-center mb-2">
            <h1 className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">TickTackToto</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">the slick ticket time tracker</p>
          </div>
        </header>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl mb-8">
             <h2 className="flex items-center text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                <User className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400"/>
                Your Profile
            </h2>
            <div>
                <label htmlFor="user-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Title / Role</label>
                <input
                    id="user-title"
                    type="text"
                    value={userTitle}
                    onChange={(e) => setUserTitle(e.target.value)}
                    placeholder="e.g., Senior Software Engineer"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This will be used to personalize the AI-ready prompt for your status reports.</p>
            </div>
        </section>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl mb-8 border-t-4 border-indigo-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              {isTimerRunning ? 'Currently Running' : isTimerPaused ? 'Activity Paused' : 'Start New Session'}
            </h2>
            <Clock className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
          </div>

          <input
            type="text"
            placeholder={'Enter Ticket ID (e.g., JIRA-101)'}
            value={currentTicketId}
            onChange={(e) => setCurrentTicketId(e.target.value)}
            disabled={isInputDisabled}
            className={`w-full p-3 mb-4 text-lg border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${isInputDisabled ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500'}`}
          />
          {isInputTicketClosed && (
              <p className="text-red-500 text-sm mb-4 flex items-center"><Lock className="w-4 h-4 mr-1"/> This ticket is closed.</p>
          )}
          
          {(isTimerRunning || isTimerPaused) && (
            <div className="mb-4">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">Session Notes (Saved on Pause/Stop)</label>
                <textarea
                    placeholder="E.g., Fixed critical bug in user authentication module."
                    value={currentNote}
                    onChange={(e) => setCurrentNote(e.target.value)}
                    rows="2"
                    className="w-full p-2 text-sm border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm resize-none"
                />
            </div>
          )}

          <div className={`text-center py-4 rounded-xl mb-6 transition-colors ${isTimerRunning ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 shadow-inner border border-indigo-200 dark:border-indigo-800' : isTimerPaused ? 'bg-yellow-50 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 shadow-inner border border-yellow-200 dark:border-yellow-800' : 'bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500'}`}>
            <p className="text-2xl sm:text-4xl font-mono font-bold tracking-wider">{formatTime(elapsedMs)}</p>
            {(isTimerRunning || isTimerPaused) && (
                <p className={`text-sm mt-1 font-semibold ${isTimerRunning ? 'text-indigo-500' : 'text-yellow-500'}`}>{isTimerRunning ? 'Running' : 'Paused'}</p>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={actionHandler}
              disabled={isButtonDisabled}
              className={`flex-grow flex items-center justify-center space-x-2 py-4 px-6 rounded-xl font-bold text-lg transition-all transform active:scale-[0.98] ${actionStyle} ${isButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ActionButtonIcon className="h-6 w-6" /><span>{actionButtonText}</span>
            </button>
            <button
              onClick={() => stopTimer(false)}
              disabled={isStopButtonDisabled}
              title="Stop and Finalize Activity"
              className={`flex-shrink-0 w-16 flex items-center justify-center py-4 px-3 rounded-xl font-bold text-lg transition-all transform active:scale-[0.98] bg-red-500 hover:bg-red-600 text-white ${isStopButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Square className="h-6 w-6" />
            </button>
          </div>
           <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                <h3 className="flex items-center font-semibold text-gray-600 dark:text-gray-300 mb-2"><Keyboard className="w-4 h-4 mr-2"/>Keyboard Shortcuts</h3>
                <p><span className="font-mono bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded">Enter</span>: Start / Pause / Resume timer.</p>
                <p className="mt-1"><span className="font-mono bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded">Alt + Enter</span>: Stop and finalize the current entry.</p>
           </div>
        </section>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl mb-8">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Filter & Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 items-end">
                <div>
                    <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="All">All Unsubmitted</option>
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                        <option value="Submitted">Submitted</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                    <input type="date" id="date-filter" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                </div>
                <button onClick={() => { setStatusFilter('All'); setDateFilter(''); }} className="w-full sm:w-auto px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]">
                     Clear Filters
                 </button>
            </div>
            <div className="bg-indigo-50 dark:bg-gray-700/50 p-4 rounded-lg text-center shadow-inner">
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-300">Total Time for Selected Filters</p>
                <p className="text-2xl font-bold font-mono text-indigo-900 dark:text-indigo-100 mt-1">{formatTime(totalFilteredTimeMs)}</p>
            </div>
        </section>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl">
          <div className="flex justify-between items-center gap-4 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
            <h2 className="flex items-center text-xl font-semibold text-gray-800 dark:text-gray-200 shrink-0"><List className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />Time Log History</h2>
            <div className="flex items-center gap-2">
                {statusFilter === 'Submitted' ? (
                  <button 
                    onClick={handleMarkAsUnsubmitted}
                    disabled={isActionDisabled}
                    className="px-4 py-2 bg-yellow-500 text-white font-semibold text-sm rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
                  >
                    Unsubmit
                  </button>
                ) : (
                  <button 
                    onClick={handleCreateDraft}
                    disabled={isActionDisabled}
                    className="px-4 py-2 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    AI Draft
                  </button>
                )}
                <div className="relative">
                    <select
                        value={exportOption}
                        onChange={(e) => {
                            const val = e.target.value;
                            setExportOption(val);
                            handleExport(val);
                        }}
                        className="w-10 h-10 flex items-center justify-center bg-green-500 text-transparent rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-400"
                        aria-label="Export CSV"
                    >
                        <option value="" disabled>Export CSV...</option>
                        <option value="selected" disabled={isActionDisabled}>Export Selected</option>
                        <option value="filtered" disabled={filteredAndGroupedLogs.length === 0}>Export Filtered</option>
                        <option value="all" disabled={logs.length === 0}>Export All</option>
                    </select>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white">
                        <Download className="h-5 w-5" />
                    </div>
                </div>
            </div>
          </div>
           <div className="flex items-center pb-4 border-b border-gray-200 dark:border-gray-700">
                <input
                    type="checkbox"
                    id="select-all-checkbox"
                    checked={filteredAndGroupedLogs.length > 0 && filteredAndGroupedLogs.every(g => selectedTickets.has(g.ticketId))}
                    onChange={handleToggleSelectAll}
                    disabled={filteredAndGroupedLogs.length === 0}
                    className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="select-all-checkbox" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select All Visible
                </label>
            </div>
          {filteredAndGroupedLogs.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center py-4">No finished logs match your current filters.</p>}
          <ul className="space-y-6 max-h-96 overflow-y-auto pt-4">
            {filteredAndGroupedLogs.map((group) => {
              const isFullySubmitted = group.sessions.every(session => session.status === 'submitted');
              return (
              <li key={group.ticketId} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-start mb-2 border-b border-gray-200 dark:border-gray-600 pb-2">
                   <div className="flex items-start flex-grow">
                        <input
                            type="checkbox"
                            aria-label={`Select ticket ${group.ticketId}`}
                            checked={selectedTickets.has(group.ticketId)}
                            onChange={() => handleToggleSelectTicket(group.ticketId)}
                            className="h-5 w-5 rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 text-indigo-600 focus:ring-indigo-500 mr-4 mt-1 self-start flex-shrink-0"
                        />
                        <div className="flex-grow">
                            <div className="flex items-center gap-2">
                                {editingTicketId === group.ticketId ? (
                                    <input
                                        type="text"
                                        value={editingTicketValue}
                                        onChange={(e) => setEditingTicketValue(e.target.value)}
                                        onBlur={() => handleUpdateTicketId(group.ticketId, editingTicketValue)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                handleUpdateTicketId(group.ticketId, editingTicketValue);
                                            } else if (e.key === 'Escape') {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                setEditingTicketId(null);
                                            }
                                        }}
                                        className="text-indigo-700 dark:text-indigo-300 font-extrabold text-lg bg-indigo-50 dark:bg-gray-600 rounded-md px-2 py-0.5 border border-indigo-300"
                                        autoFocus
                                    />
                                ) : (
                                    <>
                                        <p className="text-indigo-700 dark:text-indigo-300 font-extrabold text-lg break-all">{group.ticketId}</p>
                                        {isFullySubmitted && <Check className="w-5 h-5 text-green-500" title="All sessions submitted"/>}
                                        <button 
                                            onClick={() => {
                                                setEditingTicketId(group.ticketId);
                                                setEditingTicketValue(group.ticketId);
                                            }}
                                            className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                            title="Edit Ticket ID"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">Total Time: <span className="font-mono font-bold text-base text-indigo-800 dark:text-indigo-200">{formatTime(group.totalDurationMs)}</span></p>
                            <p className="text-gray-400 dark:text-gray-500 text-xs">({group.sessions.length} recorded sessions)</p>
                        </div>
                    </div>
                  <div className="flex flex-col space-y-2 mt-1 min-w-[120px] flex-shrink-0 ml-2">
                    {group.isClosed ? (
                        <>
                            <span className="flex items-center justify-center space-x-1 px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-xs rounded-lg"><Lock className="h-4 w-4" /><span>Closed</span></span>
                            <button onClick={() => handleReopenTicket(group.ticketId)} className="flex items-center justify-center space-x-1 px-3 py-1 bg-green-100 text-green-700 font-semibold text-xs rounded-lg hover:bg-green-200 transition-colors active:scale-[0.98] disabled:opacity-50" title="Reopen this Ticket for further tracking">
                                <Repeat className="w-4 w-4" /><span>Re-open Ticket</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => handleCloseTicket(group.ticketId)} className="flex items-center justify-center space-x-1 px-3 py-1 bg-red-100 text-red-700 font-semibold text-xs rounded-lg hover:bg-red-200 transition-colors active:scale-[0.98] disabled:opacity-50" title="Permanently Close this Ticket">
                                <Lock className="w-4 h-4" /><span>Close Ticket</span>
                            </button>
                            <button onClick={() => handleContinueTicket(group.ticketId)} className="flex items-center justify-center space-x-1 px-3 py-1 bg-indigo-500 text-white font-semibold text-xs rounded-lg hover:bg-indigo-600 transition-colors active:scale-[0.98] disabled:opacity-50" title="Start a New Session for this Ticket">
                                <Repeat className="w-4 w-4" /><span>Start New Session</span>
                            </button>
                        </>
                    )}
                  </div>
                </div>
                <ul className="pl-3 space-y-2 mt-2 border-l-2 border-gray-300 dark:border-gray-600">
                    {group.sessions.sort((a, b) => b.endTime - a.endTime).map((session) => (
                        <li key={session.id} className="text-xs text-gray-700 dark:text-gray-300 flex flex-col pt-1 pb-1">
                            <div className="flex justify-between items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        aria-label={`Select session ${session.id}`}
                                        checked={selectedTickets.has(group.ticketId) || selectedSessions.has(session.id)}
                                        onChange={() => handleToggleSelectSession(session.id)}
                                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    {session.status === 'submitted' && <Check className="h-4 w-4 text-green-500" title="Submitted"/>}
                                    <span className={`font-mono font-bold text-sm flex-shrink-0 ${session.status === 'submitted' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>{formatTime(session.accumulatedMs)}</span>
                                </div>
                                <span className="text-gray-500 dark:text-gray-400 text-right text-xs flex-grow">{new Date(session.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                <button 
                                    onClick={() => {
                                        setReallocatingSessionInfo({ sessionId: session.id, currentTicketId: group.ticketId });
                                        setIsReallocateModalOpen(true);
                                    }} 
                                    className="p-1 text-gray-400 hover:text-indigo-600 rounded-full transition-colors active:scale-95 disabled:opacity-50" title="Reallocate Session">
                                    <CornerUpRight className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDeleteClick(session)} className="p-1 text-red-400 hover:text-red-600 rounded-full transition-colors active:scale-95 disabled:opacity-50" title="Delete Session">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            {session.note && (
                                <p className={`mt-1 flex items-start text-xs border-t border-gray-200 dark:border-gray-600 pt-1 ${session.status === 'submitted' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}`}>
                                    <BookOpen className="h-3 w-3 mr-1 text-indigo-400 dark:text-indigo-500 flex-shrink-0 mt-[2px]"/>
                                    <span className="italic break-words">{session.note}</span>
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
              </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default App;



