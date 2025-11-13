import React, { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import {
  Clock, Play, Square, List, AlertTriangle, Loader, Trash2, Pause, X, Check, Repeat, Download, Lock, Send, Clipboard, BookOpen, User, Keyboard, Sun, Moon, Info, Pencil, CornerUpRight, CheckCircle, TrendingUp, RotateCcw, ChevronLeft
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

// --- Toast Notifications ---
import toast, { Toaster } from 'react-hot-toast';

// --- Global Variable Access (MODIFIED FOR LOCAL DEVELOPMENT) ---
const appId = process.env.REACT_APP_FIREBASE_APP_ID || 'default-app-id'; 

// Helper to decode base64 envs at runtime (avoids exposing raw keys in build output)
const decodeIfBase64 = (value) => {
  try {
    if (!value) return value;
    const looksBase64 = /^[A-Za-z0-9+/=]+$/.test(value) && value.length >= 40;
    return looksBase64 ? atob(value) : value;
  } catch {
    return value;
  }
};

// Firebase configuration from environment variables (no raw literals in source)
const firebaseConfig = {
  apiKey: decodeIfBase64(process.env.REACT_APP_FIREBASE_API_KEY_BASE64) || process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
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
 * Security: Sanitize ticket ID input to prevent XSS and injection attacks
 * @param {string} ticketId - Raw ticket ID input
 * @returns {string} Sanitized ticket ID
 */
const sanitizeTicketId = (ticketId) => {
  if (!ticketId) return '';
  return ticketId
    .trim()
    .replace(/[<>]/g, '') // Remove potentially dangerous HTML characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .substring(0, 200); // Limit length to prevent abuse
};

/**
 * Security: Sanitize note input to prevent XSS attacks
 * @param {string} note - Raw note input
 * @returns {string} Sanitized note
 */
const sanitizeNote = (note) => {
  if (!note) return '';
  return note
    .replace(/[<>]/g, '') // Remove potentially dangerous HTML characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .substring(0, 5000); // Limit length to prevent abuse
};

/**
 * Security: Escape CSV data to prevent formula injection attacks
 * @param {string} data - Raw data to be exported to CSV
 * @returns {string} Safely escaped CSV data
 */
const escapeCSV = (data) => {
  const str = String(data);
  // Prevent CSV injection by prefixing dangerous characters with a single quote
  if (str.match(/^[=+\-@\t\r]/)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

/**
 * Custom Confirmation Modal Component with Accessibility
 */
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm" }) => {
    const confirmButtonRef = useRef(null);

    // Focus management and Escape key handler
    useEffect(() => {
        if (isOpen) {
            // Focus the confirm button when modal opens
            setTimeout(() => confirmButtonRef.current?.focus(), 100);

            // Handle Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') onCancel();
            };
            window.addEventListener('keydown', handleEscape);
            return () => window.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const confirmButtonColor = confirmText === "Delete" ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700";

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4"
            onClick={(e) => {
                // Only close on backdrop click for non-destructive actions
                if (e.target === e.currentTarget && confirmText !== "Delete") {
                    onCancel();
                }
            }}
        >
            <div 
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                aria-describedby="modal-description"
                className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl transform transition-all scale-100" 
                onClick={(e) => e.stopPropagation()}
            >
                <h3 
                    id="modal-title"
                    className={`text-xl font-bold ${confirmText === "Delete" ? "text-red-600" : "text-indigo-600 dark:text-indigo-400"} mb-3`}
                >
                    {title}
                </h3>
                <div id="modal-description" className="text-gray-700 dark:text-gray-300 mb-6">{message}</div>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="flex items-center space-x-1 px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
                    >
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                    </button>
                    <button
                        ref={confirmButtonRef}
                        onClick={onConfirm}
                        className={`flex items-center space-x-1 px-4 py-2 min-h-[44px] text-white font-semibold rounded-lg transition-colors active:scale-[0.98] ${confirmButtonColor}`}
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
    const selectRef = useRef(null);

    useEffect(() => {
        // Reset selection when modal opens or session changes
        if (isOpen) {
            setNewTicketId('');
            // Focus the select element when modal opens
            setTimeout(() => selectRef.current?.focus(), 100);

            // Handle Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') onClose();
            };
            window.addEventListener('keydown', handleEscape);
            return () => window.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, sessionInfo, onClose]);

    if (!isOpen || !sessionInfo) return null;

    const handleConfirm = () => {
        if (newTicketId && newTicketId !== sessionInfo.currentTicketId) {
            onConfirm(sessionInfo.sessionId, newTicketId);
            onClose();
        }
    };

    // Filter out the current ticket ID from the list of options
    const availableTickets = allTicketIds.filter(id => id !== sessionInfo.currentTicketId);

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4" 
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div 
                role="dialog"
                aria-modal="true"
                aria-labelledby="reallocate-title"
                aria-describedby="reallocate-description"
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all scale-100" 
                onClick={(e) => e.stopPropagation()}
            >
                <h3 id="reallocate-title" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                    Reallocate Session
                </h3>
                <p id="reallocate-description" className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    Move this session from <strong className="font-mono text-indigo-500">{sessionInfo.currentTicketId}</strong> to another ticket.
                </p>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="ticket-reallocate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            New Ticket ID
                        </label>
                        <select
                            ref={selectRef}
                            id="ticket-reallocate"
                            value={newTicketId}
                            onChange={(e) => setNewTicketId(e.target.value)}
                            className="w-full p-2 min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="" disabled>Select a ticket...</option>
                            {availableTickets.map(ticketId => (
                                <option key={ticketId} value={ticketId}>{ticketId}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center space-x-1 px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
                    >
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!newTicketId || newTicketId === sessionInfo.currentTicketId}
                        className="flex items-center justify-center space-x-1 px-4 py-2 min-h-[44px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
    const copyButtonRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => copyButtonRef.current?.focus(), 100);

            const handleEscape = (e) => {
                if (e.key === 'Escape') onClose();
            };
            window.addEventListener('keydown', handleEscape);
            return () => window.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const copyToClipboard = () => {
        if (reportData?.text) {
            const tempInput = document.createElement('textarea');
            tempInput.value = reportData.text;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            toast.success('Copied to clipboard!');
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4" 
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div 
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-title"
                aria-describedby="report-description"
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-xl shadow-2xl transform transition-all scale-100 overflow-y-auto max-h-[90vh]" 
                onClick={(e) => e.stopPropagation()}
            >
                <h3 id="report-title" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center">
                    <Send className="w-6 h-6 mr-2"/> AI Prompt for {ticketId}
                </h3>
                <p id="report-description" className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    Copy this prompt and paste it into your preferred AI chat application.
                </p>
                
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl border border-gray-300 dark:border-gray-600">
                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono text-sm">{reportData?.text}</p>
                </div>
                <div className="mt-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                    <button
                        ref={copyButtonRef}
                        onClick={copyToClipboard}
                        disabled={!reportData?.text}
                        className="flex items-center justify-center space-x-2 px-4 py-2 min-h-[44px] bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Clipboard className="w-4 h-4" />
                        <span>Copy to Clipboard</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const InstructionsContent = () => {
    const [expandedSection, setExpandedSection] = useState('getting-started');

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const Section = ({ id, icon: Icon, title, children }) => {
        const isExpanded = expandedSection === id;
        
        return (
            <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                <button
                    onClick={() => toggleSection(id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                    aria-expanded={isExpanded}
                >
                    <h4 className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center">
                        <Icon className="w-4 h-4 mr-2" />
                        {title}
                    </h4>
                    <span className="text-xl text-gray-400 dark:text-gray-500 font-light">
                        {isExpanded ? '−' : '+'}
                    </span>
                </button>
                
                {isExpanded && (
                    <div className="px-4 pb-4 text-sm text-gray-700 dark:text-gray-300">
                        {children}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <Section id="getting-started" icon={Clock} title="Getting Started">
                <ul className="list-disc list-inside space-y-1.5">
                    <li><strong>Start Timer:</strong> Enter ticket ID + press <kbd className="kbd-key">Ctrl+Space</kbd> (works while typing!)</li>
                    <li><strong>Autocomplete:</strong> Recent tickets appear as suggestions</li>
                    <li><strong>Notifications:</strong> Alerts at 30min, 1hr, 2hr, 4hr milestones</li>
                    <li><strong>Pause/Resume:</strong> Press <kbd className="kbd-key">Ctrl+Space</kbd> anytime, anywhere</li>
                </ul>
            </Section>

            <Section id="managing" icon={List} title="Managing Logs">
                <ul className="list-disc list-inside space-y-1.5">
                    <li><strong>Edit:</strong> Click <Pencil className="w-3 h-3 inline-block -mt-1 text-blue-500"/> to rename tickets across all sessions</li>
                    <li><strong>Reallocate:</strong> Click <CornerUpRight className="w-3 h-3 inline-block -mt-1 text-purple-500"/> to move sessions to different tickets</li>
                    <li><strong>Delete:</strong> Click <Trash2 className="w-3 h-3 inline-block -mt-1 text-red-500"/> to remove sessions</li>
                    <li><strong>Archive:</strong> Mark tickets as 'Closed' to filter them out</li>
                </ul>
            </Section>

            <Section id="stats" icon={TrendingUp} title="Statistics & Insights">
                <ul className="list-disc list-inside space-y-1.5">
                    <li>Dashboard shows total time, status breakdown, and averages</li>
                    <li>Stats update in real-time as you track</li>
                    <li>Filter by date range or search to analyze specific periods</li>
                </ul>
            </Section>

            <Section id="advanced" icon={Check} title="Advanced Features">
                <ul className="list-disc list-inside space-y-1.5">
                    <li><strong>Search:</strong> Find tickets instantly by ID</li>
                    <li><strong>Date Filters:</strong> Today, Last 7/30 days, or custom range</li>
                    <li><strong>Bulk Operations:</strong> Select multiple → delete or change status</li>
                    <li><strong>Export:</strong> CSV of selected/filtered/all entries</li>
                    <li><strong>Share:</strong> Filters saved in URL - share specific views!</li>
                </ul>
            </Section>

            <Section id="shortcuts" icon={Keyboard} title="Keyboard Shortcuts">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div><kbd className="kbd-key">Ctrl+Space</kbd> Start/Pause (works everywhere)</div>
                    <div><kbd className="kbd-key">Shift+Space</kbd> Stop & Finalize (works everywhere)</div>
                    <div><kbd className="kbd-key">↑/↓</kbd> Navigate dropdowns</div>
                    <div><kbd className="kbd-key">Esc</kbd> Close modals</div>
                    <div><kbd className="kbd-key">Enter</kbd> Submit forms</div>
                    <div><kbd className="kbd-key">Tab</kbd> Navigate UI</div>
                </div>
            </Section>

            <Section id="tips" icon={Info} title="Pro Tips">
                <ul className="list-disc list-inside space-y-1.5 text-xs">
                    <li>Profile & recent tickets saved locally</li>
                    <li>Limits: 200 chars (ticket), 5000 chars (notes)</li>
                    <li>Use bulk ops for efficiency</li>
                    <li>Data syncs via Firebase across devices</li>
                </ul>
            </Section>
        </div>
    );
};

const WelcomeModal = ({ isOpen, onClose }) => {
    const closeButtonRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => closeButtonRef.current?.focus(), 100);
            
            const handleEscape = (e) => {
                if (e.key === 'Escape') onClose();
            };
            window.addEventListener('keydown', handleEscape);
            return () => window.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4">
            <div 
                role="dialog"
                aria-modal="true"
                aria-labelledby="welcome-title"
                aria-describedby="welcome-description"
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl transform transition-all scale-100 overflow-y-auto max-h-[90vh]" 
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="welcome-title" className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">
                    Welcome to TickTackToto!
                </h2>
                <p id="welcome-description" className="text-gray-600 dark:text-gray-400 mb-6">
                    Here's a quick guide to get you started:
                </p>
                
                <InstructionsContent />

                <div className="mt-8 flex justify-end">
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="px-6 py-2 min-h-[44px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors active:scale-[0.98]"
                    >
                        Get Started
                    </button>
                </div>
            </div>
        </div>
    );
};


/**
 * Error Boundary Component to catch and handle React errors gracefully
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md shadow-2xl">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Something went wrong</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The application encountered an unexpected error. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  const [editingSessionNote, setEditingSessionNote] = useState(null);
  const [editingSessionNoteValue, setEditingSessionNoteValue] = useState('');

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
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [selectedSessions, setSelectedSessions] = useState(new Set());
  const [exportOption, setExportOption] = useState('');
  const [exportFormat, setExportFormat] = useState(''); // Track selected format: '' | 'csv' | 'json'
  const [exportedSessionIds, setExportedSessionIds] = useState(new Set()); // Track sessions to mark as submitted after export
  const [pendingExport, setPendingExport] = useState(null); // Store export details for pre-confirmation
  const [recentTicketIds, setRecentTicketIds] = useState([]);

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

  // --- Performance: Refs for stable event handler references ---
  const actionHandlerRef = useRef(null);
  const isButtonDisabledRef = useRef(false);
  const isStopButtonDisabledRef = useRef(false);
  const stopTimerRef = useRef(null);
  const editingTicketIdRef = useRef(null);
  const exportOptionRef = useRef('');
  const exportButtonRef = useRef(null);
  const exportMenuRef = useRef(null);
  const [exportFocusIndex, setExportFocusIndex] = useState(0);
  const [timerMilestone, setTimerMilestone] = useState(null); // For timer notifications
  const handleExportRef = useRef(null);

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

  // Load user profile from localStorage
  useEffect(() => {
    const savedTitle = localStorage.getItem('userTitle');
    if (savedTitle) {
      setUserTitle(savedTitle);
    }
  }, []);

  // Save user profile to localStorage with debounce
  useEffect(() => {
    if (!userTitle) return;
    const timer = setTimeout(() => {
      localStorage.setItem('userTitle', userTitle);
    }, 500);
    return () => clearTimeout(timer);
  }, [userTitle]);

  // Load recent ticket IDs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentTicketIds');
    if (saved) {
      try {
        setRecentTicketIds(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading recent tickets:', e);
      }
    }
  }, []);

  // Track recent ticket IDs when new sessions are created
  useEffect(() => {
    if (logs.length > 0) {
      const uniqueTickets = [...new Set(logs.map(log => log.ticketId))];
      const recent = uniqueTickets.slice(0, 10); // Keep last 10 unique
      setRecentTicketIds(recent);
      localStorage.setItem('recentTicketIds', JSON.stringify(recent));
    }
  }, [logs]);
  
  // --- URL State Management: Read filters from URL on load ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check for share ID
    const id = urlParams.get('shareId');
    if (id) {
      setShareId(id);
    }

    // Read filter state from URL
    const urlStatus = urlParams.get('status');
    const urlSearch = urlParams.get('search');
    const urlDateStart = urlParams.get('dateStart');
    const urlDateEnd = urlParams.get('dateEnd');

    if (urlStatus) setStatusFilter(urlStatus);
    if (urlSearch) setSearchQuery(urlSearch);
    if (urlDateStart) setDateRangeStart(urlDateStart);
    if (urlDateEnd) setDateRangeEnd(urlDateEnd);
  }, []);

  // --- URL State Management: Update URL when filters change ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Preserve shareId if it exists
    const shareId = params.get('shareId');
    const newParams = new URLSearchParams();
    
    if (shareId) newParams.set('shareId', shareId);
    if (statusFilter && statusFilter !== 'All') newParams.set('status', statusFilter);
    if (searchQuery) newParams.set('search', searchQuery);
    if (dateRangeStart) newParams.set('dateStart', dateRangeStart);
    if (dateRangeEnd) newParams.set('dateEnd', dateRangeEnd);

    const newUrl = newParams.toString() 
      ? `${window.location.pathname}?${newParams.toString()}`
      : window.location.pathname;
    
    window.history.replaceState({}, '', newUrl);
  }, [statusFilter, searchQuery, dateRangeStart, dateRangeEnd]);

  // --- Firebase Initialization and Authentication ---
  useEffect(() => {
    let authCompleted = false;
    
    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (!authCompleted) {
        console.error('Firebase initialization timeout');
        setFirebaseError('Connection timeout. Please check your internet connection and refresh the page.');
        setIsLoading(false);
        setIsAuthReady(true); // Force auth ready to exit loading screen
        setHasLoadedOnce(true); // Force loaded flag to exit loading screen
      }
    }, 10000); // 10 second timeout

    try {
      if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.error('Firebase config missing or invalid');
        setFirebaseError('Firebase configuration is missing or invalid. Please replace the placeholder values in your firebaseConfig object.');
        setIsLoading(false);
        setIsAuthReady(true);
        setHasLoadedOnce(true);
        clearTimeout(loadingTimeout);
        return;
      }

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const userAuth = getAuth(app);

      setDb(firestore);
      setAuth(userAuth);

      const unsubscribe = onAuthStateChanged(userAuth, (user) => {
        if (user) {
          authCompleted = true;
          setUser(user);
          setUserId(user.uid);
          setIsAuthReady(true);
          clearTimeout(loadingTimeout);
        } else {
          // If no user, sign in anonymously to allow app usage
          signInAnonymously(userAuth)
            .then(() => {
              // Auth state will be updated by onAuthStateChanged
            })
            .catch(err => {
              authCompleted = true;
              console.error('Anonymous sign-in error:', err);
              setFirebaseError('Failed to sign in anonymously. Please refresh the page.');
              setIsLoading(false);
              setIsAuthReady(true);
              setHasLoadedOnce(true);
              clearTimeout(loadingTimeout);
            });
        }
      });

      return () => {
        unsubscribe();
        clearTimeout(loadingTimeout);
      };
    } catch (error) {
      console.error('Firebase initialization error:', error);
      setFirebaseError('Error initializing Firebase. See console.');
      setIsLoading(false);
      setIsAuthReady(true);
      setHasLoadedOnce(true);
      clearTimeout(loadingTimeout);
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
        
        // Handle submissionDate - could be Firestore Timestamp or number
        let submissionDate = null;
        if (data.submissionDate) {
          if (typeof data.submissionDate === 'number') {
            submissionDate = data.submissionDate; // Already a number (ms since epoch)
          } else if (data.submissionDate.toDate) {
            submissionDate = data.submissionDate.toDate(); // Firestore Timestamp
          }
        }
        
        const log = {
          id: doc.id,
          ticketId: data.ticketId || 'No Ticket ID',
          startTime: data.startTime || null, 
          endTime: data.endTime || null, 
          accumulatedMs: data.accumulatedMs || 0,
          note: data.note || '',
          status: data.status || 'unsubmitted', // Add status field
          submissionDate: submissionDate,
          createdAt: data.createdAt || null // Track when session was originally created
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
            // Batch non-urgent state updates for better performance
            startTransition(() => {
              setIsTimerRunning(false);
              setIsTimerPaused(false);
              setRunningLogDocId(null);
              setActiveLogData(null); 
              setCurrentTicketId('');
              setCurrentNote('');
              setElapsedMs(0);
            });
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

  // --- Timer Interval Effect (Optimized) ---
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && runningLogDocId && activeLogData?.startTime) {
      // Immediate update before starting interval
      const updateTimer = () => {
        const currentRunDuration = Date.now() - activeLogData.startTime;
        const newElapsedMs = activeLogData.accumulatedMs + currentRunDuration;
        setElapsedMs(newElapsedMs);

        // Check for milestones (30min, 1hr, 2hr, 4hr)
        const milestones = [
          { ms: 30 * 60 * 1000, label: '30 minutes' },
          { ms: 60 * 60 * 1000, label: '1 hour' },
          { ms: 2 * 60 * 60 * 1000, label: '2 hours' },
          { ms: 4 * 60 * 60 * 1000, label: '4 hours' }
        ];

        for (const milestone of milestones) {
          // Check if we just crossed this milestone (within 1 second)
          if (newElapsedMs >= milestone.ms && newElapsedMs < milestone.ms + 1000) {
            if (timerMilestone !== milestone.label) {
              setTimerMilestone(milestone.label);
              toast(`⏰ Timer reached ${milestone.label}!`, {
                icon: '🎯',
                duration: 4000,
              });
            }
          }
        }
      };
      
      updateTimer(); // Update immediately
      interval = setInterval(updateTimer, 1000); // Then update every second
    } else {
      setTimerMilestone(null); // Reset milestone when timer stops
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, runningLogDocId, activeLogData, timerMilestone]);

  // --- Effect to clear selections when filters change ---
  useEffect(() => {
    setSelectedTickets(new Set());
    setSelectedSessions(new Set());
  }, [statusFilter, dateFilter]);

  // --- Update refs for performance optimization ---
  useEffect(() => {
    exportOptionRef.current = exportOption;
  }, [exportOption]);

  // --- Effect to close export dropdown when clicking outside (Optimized) ---
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

  // --- Keyboard navigation for export dropdown ---
  useEffect(() => {
    if (exportOption !== 'menu') return;

    const handleKeyDown = (e) => {
      // Dynamic options based on current step
      const formatOptions = ['csv', 'json'];
      const scopeOptions = ['selected', 'filtered', 'all'];
      const currentOptions = exportFormat ? scopeOptions : formatOptions;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setExportFocusIndex((prev) => (prev + 1) % currentOptions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setExportFocusIndex((prev) => (prev - 1 + currentOptions.length) % currentOptions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!exportFormat) {
          // Step 1: Select format
          setExportFormat(formatOptions[exportFocusIndex]);
          setExportFocusIndex(0);
        } else {
          // Step 2: Select scope and export
          if (handleExportRef.current) {
            handleExportRef.current(scopeOptions[exportFocusIndex], exportFormat);
          }
          setExportOption('');
          setExportFormat('');
          setExportFocusIndex(0);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (exportFormat) {
          // Go back to format selection
          setExportFormat('');
          setExportFocusIndex(0);
        } else {
          // Close dropdown
          setExportOption('');
          setExportFocusIndex(0);
          if (exportButtonRef.current) {
            exportButtonRef.current.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [exportOption, exportFormat, exportFocusIndex]);
  
  // --- Derived State: Grouped Logs and Totals ---
  const filteredAndGroupedLogs = useMemo(() => {
    // Apply date filtering (single date or date range)
    let dateFilteredLogs = logs;
    
    if (dateRangeStart || dateRangeEnd) {
      // Date range filtering
      dateFilteredLogs = logs.filter(log => {
        if (!log.endTime) return false;
        const logDate = new Date(log.endTime).toISOString().split('T')[0];
        if (dateRangeStart && logDate < dateRangeStart) return false;
        if (dateRangeEnd && logDate > dateRangeEnd) return false;
        return true;
      });
    } else if (dateFilter) {
      // Single date filtering (legacy support)
      dateFilteredLogs = logs.filter(log => {
        if (!log.endTime) return false;
        const logDate = new Date(log.endTime).toISOString().split('T')[0];
        return logDate === dateFilter;
      });
    }

    // Apply search filtering
    const searchFilteredLogs = searchQuery
      ? dateFilteredLogs.filter(log => 
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

    // Optimized sorting: Use reduce instead of Math.max with spread to reduce memory allocation
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
    const ids = new Set(logs.map(log => log.ticketId));
    if (currentTicketId) ids.add(currentTicketId);
    return Array.from(ids).sort();
  }, [logs, currentTicketId]);

  // --- Core Timer Functions ---

  const pauseTimer = useCallback(async () => {
    if (!runningLogDocId || !isTimerRunning || !getCollectionRef || !activeLogData) {
      console.warn('Cannot pause timer:', {
        hasRunningLogDocId: !!runningLogDocId,
        isTimerRunning,
        hasCollectionRef: !!getCollectionRef,
        hasActiveLogData: !!activeLogData
      });
      return;
    }

    // Validate that startTime exists and is a valid number
    if (!activeLogData.startTime || typeof activeLogData.startTime !== 'number') {
      console.error('Invalid startTime when pausing:', {
        startTime: activeLogData.startTime,
        activeLogData,
        runningLogDocId
      });
      setFirebaseError('Cannot pause timer: Invalid start time.');
      return;
    }

    setIsLoading(true);
    const stopTime = Date.now();
    const currentRunDuration = stopTime - activeLogData.startTime;
    
    // Validate duration is reasonable (not negative or impossibly large)
    if (currentRunDuration < 0 || currentRunDuration > 86400000 * 30) { // Max 30 days
      console.error('Invalid duration calculation:', {
        currentRunDuration,
        stopTime,
        startTime: activeLogData.startTime,
        difference: stopTime - activeLogData.startTime
      });
      setFirebaseError('Cannot pause timer: Invalid duration calculation.');
      setIsLoading(false);
      return;
    }
    
    const newAccumulatedMs = (activeLogData.accumulatedMs || 0) + Math.max(0, currentRunDuration); 

    try {
      await updateDoc(doc(getCollectionRef, runningLogDocId), {
        startTime: null,
        accumulatedMs: newAccumulatedMs,
        note: sanitizeNote(currentNote),
      });
    } catch (error) {
      console.error('Error pausing timer:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        runningLogDocId,
        hasCollectionRef: !!getCollectionRef,
        startTime: activeLogData.startTime,
        accumulatedMs: activeLogData.accumulatedMs,
        newAccumulatedMs
      });
      setFirebaseError(`Failed to pause timer: ${error.message || error.code || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [runningLogDocId, isTimerRunning, getCollectionRef, activeLogData, currentNote]);


  const stopTimer = useCallback(async (isAutoOverride = false) => {
    if (!runningLogDocId || !getCollectionRef || !activeLogData) {
      console.warn('Cannot stop timer:', {
        hasRunningLogDocId: !!runningLogDocId,
        hasCollectionRef: !!getCollectionRef,
        hasActiveLogData: !!activeLogData
      });
      return;
    }

    setIsLoading(true);
    const finalStopTime = Date.now();
    let finalAccumulatedMs = activeLogData.accumulatedMs || 0; 

    if (isTimerRunning) {
        // Validate startTime exists and is a valid number
        if (!activeLogData.startTime || typeof activeLogData.startTime !== 'number') {
          console.error('Invalid startTime when stopping timer:', {
            startTime: activeLogData.startTime,
            activeLogData,
            runningLogDocId
          });
          setFirebaseError('Cannot stop timer: Invalid start time.');
          setIsLoading(false);
          return;
        }
        
        const currentRunDuration = finalStopTime - activeLogData.startTime;
        
        // Validate duration is reasonable
        if (currentRunDuration < 0 || currentRunDuration > 86400000 * 30) {
          console.error('Invalid duration calculation when stopping:', {
            currentRunDuration,
            finalStopTime,
            startTime: activeLogData.startTime
          });
          setFirebaseError('Cannot stop timer: Invalid duration calculation.');
          setIsLoading(false);
          return;
        }
        
        finalAccumulatedMs += Math.max(1000, currentRunDuration); 
    } else if (isTimerPaused) {
        finalAccumulatedMs = activeLogData.accumulatedMs || 0;
        if (finalAccumulatedMs < 1000) finalAccumulatedMs = 1000;
    }

    try {
      await updateDoc(doc(getCollectionRef, runningLogDocId), {
        endTime: finalStopTime,
        startTime: null,
        accumulatedMs: finalAccumulatedMs,
        note: sanitizeNote(currentNote),
        status: 'unsubmitted' // Ensure new logs are unsubmitted
      });
      
      if (!isAutoOverride) {
          setCurrentTicketId(''); 
          setCurrentNote('');
      }

    } catch (error) {
      console.error('Error stopping timer:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        runningLogDocId,
        hasCollectionRef: !!getCollectionRef,
        isTimerRunning,
        isTimerPaused,
        startTime: activeLogData.startTime,
        accumulatedMs: activeLogData.accumulatedMs,
        finalAccumulatedMs
      });
      setFirebaseError(`Failed to stop timer: ${error.message || error.code || 'Unknown error'}`);
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
            ticketId: sanitizeTicketId(ticketId),
            startTime: startTimestamp,
            endTime: null,
            accumulatedMs: 0,
            note: sanitizeNote(note),
            status: 'unsubmitted', // Default status
            createdAt: startTimestamp // Track when session was originally created
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
    if (!getCollectionRef || currentTicketId.trim() === '') {
      console.warn('Cannot start/resume timer:', {
        hasCollectionRef: !!getCollectionRef,
        currentTicketId: currentTicketId.trim()
      });
      return;
    }
    if (isTimerRunning) {
      console.warn('Timer already running, cannot start/resume');
      return;
    }

    setIsLoading(true);
    const startTimestamp = Date.now();

    try {
      if (isTimerPaused) {
        if (!runningLogDocId) {
          console.error('Paused log ID missing when resuming timer');
          setFirebaseError('Cannot resume timer: Session ID missing.');
          setIsLoading(false);
          return;
        }
        await updateDoc(doc(getCollectionRef, runningLogDocId), {
          startTime: startTimestamp,
          note: sanitizeNote(currentNote),
        });
      } else {
        await startNewSession(currentTicketId, currentNote);
      }
    } catch (error) {
      console.error('Error starting/resuming timer:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        isTimerPaused,
        runningLogDocId,
        hasCollectionRef: !!getCollectionRef,
        currentTicketId
      });
      setFirebaseError(`Failed to ${isTimerPaused ? 'resume' : 'start'} timer: ${error.message || error.code || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [getCollectionRef, currentTicketId, isTimerRunning, isTimerPaused, runningLogDocId, startNewSession, currentNote]);

  const startNewOrOverride = useCallback(async (ticketId) => {
    const finalTicketId = ticketId || currentTicketId;
    if (!getCollectionRef || finalTicketId.trim() === '') {
      return;
    }
    
    if (ticketStatuses[finalTicketId]?.isClosed) {
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

  // --- Bulk Operations ---
  const handleBulkDelete = useCallback(async () => {
    if (!getCollectionRef || selectedSessions.size === 0) return;
    
    const confirmDelete = window.confirm(`Delete ${selectedSessions.size} session(s)?`);
    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      const deletePromises = Array.from(selectedSessions).map(sessionId =>
        deleteDoc(doc(getCollectionRef, sessionId))
      );
      await Promise.all(deletePromises);
      setSelectedSessions(new Set());
      toast.success(`Successfully deleted ${selectedSessions.size} session(s)`);
    } catch (error) {
      console.error('Error deleting sessions:', error);
      setFirebaseError('Failed to delete some sessions.');
      toast.error('Failed to delete some sessions');
    } finally {
      setIsLoading(false);
    }
  }, [getCollectionRef, selectedSessions]);

  const handleBulkStatusChange = useCallback(async (newStatus) => {
    if (!getCollectionRef || selectedSessions.size === 0) return;

    setIsLoading(true);
    try {
      const updatePromises = Array.from(selectedSessions).map(sessionId =>
        updateDoc(doc(getCollectionRef, sessionId), { 
          status: newStatus,
          ...(newStatus === 'submitted' ? { submissionDate: Date.now() } : {})
        })
      );
      await Promise.all(updatePromises);
      setSelectedSessions(new Set());
      toast.success(`Successfully updated ${selectedSessions.size} session(s) to ${newStatus}`);
    } catch (error) {
      console.error('Error updating session status:', error);
      setFirebaseError('Failed to update some sessions.');
      toast.error('Failed to update some sessions');
    } finally {
      setIsLoading(false);
    }
  }, [getCollectionRef, selectedSessions]);
  
  const handleReallocateSession = useCallback(async (sessionId, newTicketId) => {
    const sanitizedTicketId = sanitizeTicketId(newTicketId);
    if (!sessionId || !sanitizedTicketId || !getCollectionRef) return;

    setIsLoading(true);
    try {
        const sessionRef = doc(getCollectionRef, sessionId);
        await updateDoc(sessionRef, { ticketId: sanitizedTicketId });
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
    const sanitizedNewTicketId = sanitizeTicketId(newTicketId);
    if (!sanitizedNewTicketId || oldTicketId === sanitizedNewTicketId || !getCollectionRef || !getTicketStatusCollectionRef) {
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
        batch.update(doc.ref, { ticketId: sanitizedNewTicketId });
      });

      // 2. Update the corresponding status document
      const statusQuery = query(getTicketStatusCollectionRef, where("ticketId", "==", oldTicketId));
      const statusSnapshots = await getDocs(statusQuery);
      statusSnapshots.forEach((doc) => {
        batch.update(doc.ref, { ticketId: sanitizedNewTicketId });
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

  const handleUpdateSessionNote = useCallback(async (sessionId, newNote) => {
    const sanitizedNote = sanitizeNote(newNote);
    if (!getCollectionRef) {
      setEditingSessionNote(null);
      return;
    }
    
    setIsLoading(true);
    try {
      await updateDoc(doc(getCollectionRef, sessionId), {
        note: sanitizedNote
      });
    } catch (error) {
      console.error("Error updating session note:", error);
      setFirebaseError("Failed to update session note. Please check the console.");
    } finally {
      setEditingSessionNote(null);
      setEditingSessionNoteValue('');
      setIsLoading(false);
    }
  }, [getCollectionRef]);

  const handleMarkAsSubmitted = useCallback(async () => {
    const finalSessionIds = new Set(selectedSessions);
    
    // Add from selected tickets
    selectedTickets.forEach(ticketId => {
        logs.forEach(log => {
            if (log.ticketId === ticketId) {
                finalSessionIds.add(log.id);
            }
        });
    });

    // Add from exported sessions
    exportedSessionIds.forEach(sessionId => {
        finalSessionIds.add(sessionId);
    });

    if (finalSessionIds.size === 0 || !getCollectionRef || !db) {
      console.warn('Cannot mark as submitted:', {
        sessionCount: finalSessionIds.size,
        hasCollectionRef: !!getCollectionRef,
        hasDb: !!db
      });
      return;
    }

    setIsLoading(true);
    const batch = writeBatch(db);

    try {
        finalSessionIds.forEach(sessionId => {
            const docRef = doc(getCollectionRef, sessionId);
            batch.update(docRef, { 
              status: 'submitted',
              submissionDate: Date.now()
            });
        });
        await batch.commit();
        setSelectedTickets(new Set()); // Clear selections
        setSelectedSessions(new Set());
        setExportedSessionIds(new Set()); // Clear exported session IDs
    } catch (error) {
        console.error("Error marking sessions as submitted:", error);
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          sessionCount: finalSessionIds.size,
          sessionIds: Array.from(finalSessionIds).slice(0, 5) // Log first 5 IDs
        });
        setFirebaseError(`Failed to mark sessions as submitted: ${error.message || error.code || 'Unknown error'}`);
    } finally {
        setIsLoading(false);
        setIsConfirmingSubmit(false);
    }
}, [selectedTickets, selectedSessions, exportedSessionIds, logs, getCollectionRef, db]);

  // Helper function to perform the actual export
  const performExport = useCallback((logsToExport, reportName, format) => {
    const today = new Date().toISOString().split('T')[0];

    try {
      if (format === 'json') {
        // JSON Export
        const filename = `${reportName}-${today}.json`;
        const jsonData = logsToExport.map(log => ({
          ticketId: log.ticketId,
          timeWorked: formatTime(log.accumulatedMs),
          timeWorkedMs: log.accumulatedMs,
          note: log.note || '',
          startDateTime: log.createdAt ? new Date(log.createdAt).toISOString() : null,
          finishedDateTime: log.endTime ? new Date(log.endTime).toISOString() : null,
          sessionId: log.id,
          status: log.status,
          submissionDate: log.submissionDate ? new Date(log.submissionDate).toISOString() : null
        }));

        const jsonContent = JSON.stringify(jsonData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Exported ${logsToExport.length} entries as JSON`);
      } else {
        // CSV Export
        const filename = `${reportName}-${today}.csv`;
        const headers = ["Ticket ID", "Time Worked (HH:MM:SS)", "Note", "Start Date/Time", "Finished Date/Time", "Session ID", "Status", "Submission Date"];
        const csvRows = logsToExport.map(log => {
          // Use secure CSV escaping to prevent formula injection
          const formattedDuration = formatTime(log.accumulatedMs);
          const startTime = log.createdAt ? new Date(log.createdAt).toLocaleString('en-US') : 'N/A';
          const finishTime = log.endTime ? new Date(log.endTime).toLocaleString('en-US') : 'N/A';
          const submissionDate = log.submissionDate ? new Date(log.submissionDate).toLocaleString('en-US') : 'N/A';
          return [escapeCSV(log.ticketId), escapeCSV(formattedDuration), escapeCSV(log.note || ''), escapeCSV(startTime), escapeCSV(finishTime), escapeCSV(log.id), escapeCSV(log.status), escapeCSV(submissionDate)].join(',');
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

        toast.success(`Exported ${logsToExport.length} entries as CSV`);
      }
    } catch (error) {
      console.error('Export Failed:', error);
      setFirebaseError(`Export failed: ${error.message}`);
      toast.error('Export failed');
    }
  }, []);

  // Handler for export confirmation with three options
  const handleConfirmExport = useCallback(async (markAsSubmitted) => {
    if (!pendingExport || !getCollectionRef || !db) {
      setIsConfirmingSubmit(false);
      setPendingExport(null);
      return;
    }

    setIsLoading(true);
    
    try {
      if (markAsSubmitted) {
        // Check if there are any sessions to mark as submitted
        if (exportedSessionIds.size === 0) {
          console.warn('No sessions to mark as submitted');
          // Still proceed with export even if no sessions to mark
        } else {
          // Filter to only mark completed sessions (those with endTime) as submitted
          // Get the actual logs to verify they have endTime
          const logsToMark = pendingExport.logs.filter(log => 
            exportedSessionIds.has(log.id) && log.endTime !== null
          );
          
          if (logsToMark.length === 0) {
            console.warn('No completed sessions to mark as submitted');
            // Still proceed with export
          } else {
            // Mark sessions as submitted
            const batch = writeBatch(db);
            const sessionIdsToMark = logsToMark.map(log => log.id);
            
            sessionIdsToMark.forEach(sessionId => {
              if (!sessionId) {
                console.warn('Skipping invalid session ID:', sessionId);
                return;
              }
              try {
                const sessionRef = doc(getCollectionRef, sessionId);
                batch.update(sessionRef, {
                  status: 'submitted',
                  submissionDate: Date.now()
                });
              } catch (error) {
                console.error(`Error adding session ${sessionId} to batch:`, error);
                throw error; // Re-throw to be caught by outer catch
              }
            });
            
            if (sessionIdsToMark.length > 0) {
              await batch.commit();
              toast.success(`Marked ${sessionIdsToMark.length} session(s) as submitted`);
            }
          }
        }
      }

      // Now perform the export
      performExport(pendingExport.logs, pendingExport.name, pendingExport.format);
      
    } catch (error) {
      console.error('Error in handleConfirmExport:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        db: !!db,
        getCollectionRef: !!getCollectionRef,
        exportedSessionIds: exportedSessionIds.size,
        sessionIds: Array.from(exportedSessionIds)
      });
      setFirebaseError(`Failed to update submission status: ${error.message || error.code || 'Unknown error'}`);
      toast.error('Failed to update status');
    } finally {
      setIsConfirmingSubmit(false);
      setExportedSessionIds(new Set());
      setPendingExport(null);
      setIsLoading(false);
    }
  }, [pendingExport, exportedSessionIds, getCollectionRef, db, performExport]);

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
            batch.update(docRef, { 
              status: 'unsubmitted',
              submissionDate: null
            });
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

  const handleExport = useCallback(async (exportType, format = 'csv') => {
    if (!exportType) return;

    let logsToExport = [];
    let reportName = 'time-report';

    // Data selection logic
    switch (exportType) {
      case 'selected':
        if (selectedTickets.size === 0 && selectedSessions.size === 0) {
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
      setExportOption('');
      return;
    }

    // Check for unsubmitted items BEFORE exporting
    const unsubmittedLogs = logsToExport.filter(log => log.status !== 'submitted');
    if (unsubmittedLogs.length > 0 && statusFilter !== 'Submitted') {
      // Store export details and show confirmation modal first
      setPendingExport({
        type: exportType,
        format,
        logs: logsToExport,
        name: reportName,
        unsubmittedCount: unsubmittedLogs.length
      });
      setExportedSessionIds(new Set(unsubmittedLogs.map(log => log.id)));
      setIsConfirmingSubmit(true);
      setExportOption('');
      return; // Exit - actual export happens after user confirms
    }

    // All items already submitted or no check needed - export immediately
    performExport(logsToExport, reportName, format);
    setExportOption('');
  }, [logs, selectedTickets, selectedSessions, filteredAndGroupedLogs, statusFilter, performExport]);

  // Update handleExportRef for keyboard navigation
  useEffect(() => {
    handleExportRef.current = handleExport;
  }, [handleExport]);

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

  // --- Update refs for keyboard handler optimization ---
  useEffect(() => {
    actionHandlerRef.current = actionHandler;
    isButtonDisabledRef.current = isButtonDisabled;
    isStopButtonDisabledRef.current = isStopButtonDisabled;
    stopTimerRef.current = stopTimer;
    editingTicketIdRef.current = editingTicketId;
  });

  // --- Optimized Keyboard Event Listener (uses refs to avoid re-registration) ---
  useEffect(() => {
    const handleKeyDown = (event) => {
      const hasModal = document.querySelector('.fixed.inset-0');
      const isEditing = editingTicketIdRef.current || editingSessionNote;

      // Ctrl+Space: Start/Pause/Resume (works EVERYWHERE, even in text fields)
      if (event.key === ' ' && (event.ctrlKey || event.metaKey) && !hasModal && !isEditing) {
        event.preventDefault();
        if (actionHandlerRef.current && !isButtonDisabledRef.current) {
          actionHandlerRef.current();
        }
        return;
      }

      // Shift+Space: Stop & Finalize (works EVERYWHERE, even in text fields)
      if (event.key === ' ' && event.shiftKey && !event.ctrlKey && !event.metaKey && !hasModal && !isEditing) {
        event.preventDefault();
        if (!isStopButtonDisabledRef.current && stopTimerRef.current) {
          stopTimerRef.current(false);
        }
        return;
      }

      // Enter: Only works normally in inputs/modals (for form submission)
      if (event.key === 'Enter') {
        // Let Enter work normally in inputs, textareas, buttons, and modals
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingSessionNote]); // Include editingSessionNote in dependencies


  // --- Render Logic ---
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
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 2000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <WelcomeModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} />
      <ConfirmationModal
        isOpen={isConfirmingDelete}
        title="Confirm Deletion"
        message={deleteMessage}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        confirmText="Delete"
      />
      {/* Export Confirmation Modal with three options */}
      {isConfirmingSubmit && pendingExport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4">
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-confirm-title"
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl transform transition-all scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="export-confirm-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Export Time Entries
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              You're about to export <strong>{pendingExport.logs.length} session(s)</strong>, 
              including <strong>{pendingExport.unsubmittedCount} unsubmitted</strong>.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Would you like to mark them as submitted?
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleConfirmExport(true)}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-2 min-h-[44px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4 mr-2" />
                Export & Mark Submitted
              </button>
              
              <button
                onClick={() => handleConfirmExport(false)}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Only
              </button>
              
              <button
                onClick={() => {
                  setIsConfirmingSubmit(false);
                  setPendingExport(null);
                  setExportedSessionIds(new Set());
                }}
                disabled={isLoading}
                className="w-full px-4 py-2 min-h-[44px] text-gray-600 dark:text-gray-400 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ConfirmationModal
          isOpen={isConfirmingSubmit}
          title="Mark as Submitted?"
          message={exportedSessionIds.size > 0 
            ? `This will mark the ${exportedSessionIds.size} exported session(s) as 'submitted'. Submitted items are hidden by default.`
            : `This will mark all sessions for the selected ticket(s) as 'submitted'. Submitted items are hidden by default.`
          }
          onConfirm={handleMarkAsSubmitted}
          onCancel={() => {
            setIsConfirmingSubmit(false);
            setExportedSessionIds(new Set());
          }}
          confirmText="Mark as Submitted"
        />
      )}
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

      <div className="max-w-4xl mx-auto py-8 px-4">
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

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl mb-8 border-t-4 border-indigo-500">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              {isTimerRunning ? 'Currently Running' : isTimerPaused ? 'Activity Paused' : 'Start New Session'}
            </h2>
            <Clock className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT COLUMN - Inputs & Configuration */}
            <div className="space-y-6">
              {/* Profile Title */}
              <div>
                <label htmlFor="user-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <User className="h-4 w-4 inline mr-1"/>
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

              {/* Ticket ID Input */}
              <div>
                <label htmlFor="ticket-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ticket ID
                </label>
                <div className="relative">
                  <input
                    id="ticket-input"
                    type="text"
                    list="recent-tickets"
                    placeholder="Enter Ticket ID (e.g., JIRA-101)"
                    value={currentTicketId}
                    onChange={(e) => setCurrentTicketId(e.target.value)}
                    disabled={isInputDisabled}
                    maxLength={200}
                    className={`w-full p-3 pr-16 text-lg border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${isInputDisabled ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500'}`}
                  />
                  <datalist id="recent-tickets">
                    {recentTicketIds.map(id => (
                      <option key={id} value={id} />
                    ))}
                  </datalist>
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${currentTicketId.length > 180 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {currentTicketId.length}/200
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  e.g., PROJ-123, JIRA-456, or any custom format
                </p>
                {isInputTicketClosed && (
                  <p className="text-red-500 text-sm mt-2 flex items-center">
                    <Lock className="w-4 h-4 mr-1"/> This ticket is closed.
                  </p>
                )}
              </div>

              {/* Session Notes - Smooth show/hide with CSS transitions */}
              <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  (isTimerRunning || isTimerPaused) 
                    ? 'max-h-48 opacity-100' 
                    : 'max-h-0 opacity-0'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="session-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Session Notes
                  </label>
                  <span className={`text-xs ${currentNote.length > 4500 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {currentNote.length}/5000
                  </span>
                </div>
                <textarea
                  id="session-notes"
                  placeholder="E.g., Fixed critical bug in user authentication module."
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                  maxLength={5000}
                  rows="3"
                  className="w-full p-3 text-sm border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Saved automatically on pause/stop</p>
              </div>
            </div>

            {/* RIGHT COLUMN - Timer & Controls */}
            <div className="space-y-6">
              {/* Timer Display */}
              <div className="text-center">
                <div 
                  className={`py-8 px-6 rounded-xl shadow-inner border transition-colors touch-manipulation ${isTimerRunning ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' : isTimerPaused ? 'bg-yellow-50 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' : 'bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600'}`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <p className="text-3xl lg:text-4xl font-mono font-bold tracking-wider">
                    <span className="sr-only">Timer: </span>
                    {formatTime(elapsedMs)}
                  </p>
                  {(isTimerRunning || isTimerPaused) && (
                    <p className={`text-sm mt-2 font-semibold ${isTimerRunning ? 'text-indigo-500' : 'text-yellow-500'}`}>
                      {isTimerRunning ? 'Running' : 'Paused'}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={actionHandler}
                  disabled={isButtonDisabled}
                  className={`w-full flex items-center justify-center space-x-2 py-4 px-6 rounded-xl font-bold text-lg transition-all transform active:scale-[0.98] ${actionStyle} ${isButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <ActionButtonIcon className="h-6 w-6" />
                  <span>{actionButtonText}</span>
                </button>
                <button
                  onClick={() => stopTimer(false)}
                  disabled={isStopButtonDisabled}
                  title="Stop Activity"
                  className={`w-full flex items-center justify-center space-x-2 py-3 px-6 rounded-xl font-bold text-lg transition-all transform active:scale-[0.98] bg-red-500 hover:bg-red-600 text-white ${isStopButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Square className="h-5 w-5" />
                  <span>Stop</span>
                </button>
              </div>

              {/* Keyboard Shortcuts */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="flex items-center font-semibold text-gray-600 dark:text-gray-300 mb-3 text-sm">
                  <Keyboard className="w-4 h-4 mr-2"/>
                  Keyboard Shortcuts
                </h3>
                <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                  <p>
                    <span className="font-mono bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-2 py-1 rounded mr-2">Ctrl + Space</span>
                    Start/Pause/Resume
                  </p>
                  <p>
                    <span className="font-mono bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-2 py-1 rounded mr-2">Shift + Space</span>
                    Stop & Finalize
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl mb-8">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">Filter & Summary</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* LEFT COLUMN - Filters */}
                <div className="space-y-6">
                    {/* Search Bar */}
                    <div>
                        <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Search Tickets
                        </label>
                        <div className="relative">
                            <input
                                type="search"
                                id="search-filter"
                                placeholder="Search by ticket ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full p-3 pl-3 pr-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Quick Date Filters */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Quick Filters
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => {
                                    const today = new Date().toISOString().split('T')[0];
                                    setDateRangeStart(today);
                                    setDateRangeEnd(today);
                                    setDateFilter('');
                                }}
                                className="px-4 py-2 text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                            >
                                Today
                            </button>
                            <button
                                onClick={() => {
                                    const today = new Date();
                                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                                    setDateRangeStart(weekAgo.toISOString().split('T')[0]);
                                    setDateRangeEnd(today.toISOString().split('T')[0]);
                                    setDateFilter('');
                                }}
                                className="px-4 py-2 text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                            >
                                Last 7 Days
                            </button>
                            <button
                                onClick={() => {
                                    const today = new Date();
                                    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                                    setDateRangeStart(monthAgo.toISOString().split('T')[0]);
                                    setDateRangeEnd(today.toISOString().split('T')[0]);
                                    setDateFilter('');
                                }}
                                className="px-4 py-2 text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                            >
                                Last 30 Days
                            </button>
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Status Filter
                        </label>
                        <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="All">All Unsubmitted</option>
                            <option value="Open">Open</option>
                            <option value="Closed">Closed</option>
                            <option value="Submitted">Submitted</option>
                        </select>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="date-start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Start Date
                            </label>
                            <input 
                                type="date" 
                                id="date-start" 
                                value={dateRangeStart} 
                                onChange={(e) => {
                                    setDateRangeStart(e.target.value);
                                    setDateFilter('');
                                }} 
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="date-end" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                End Date
                            </label>
                            <input 
                                type="date" 
                                id="date-end" 
                                value={dateRangeEnd} 
                                onChange={(e) => {
                                    setDateRangeEnd(e.target.value);
                                    setDateFilter('');
                                }} 
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Clear All Filters Button */}
                    <button 
                        onClick={() => { 
                            setStatusFilter('All'); 
                            setDateFilter(''); 
                            setDateRangeStart(''); 
                            setDateRangeEnd(''); 
                            setSearchQuery(''); 
                        }} 
                        className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
                    >
                        Clear All Filters
                    </button>
                </div>

                {/* RIGHT COLUMN - Statistics */}
                <div className="space-y-6">
                    {/* Total Time - Prominent Display */}
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20 p-6 rounded-xl shadow-md border border-indigo-200 dark:border-indigo-700">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide">Total Time</p>
                            <Clock className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
                        </div>
                        <p className="text-4xl font-bold font-mono text-indigo-900 dark:text-indigo-100 mb-2">{formatTime(totalFilteredTimeMs)}</p>
                        {filteredAndGroupedLogs.length > 0 && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {filteredAndGroupedLogs.length} ticket(s) • {filteredAndGroupedLogs.reduce((sum, g) => sum + g.sessions.length, 0)} session(s)
                            </p>
                        )}
                    </div>

                    {/* Status Breakdown */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 p-4 rounded-lg shadow-md border border-green-200 dark:border-green-700">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-green-600 dark:text-green-300 uppercase tracking-wide">Status Breakdown</p>
                            <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-700 dark:text-gray-300">Submitted:</span>
                                <span className="text-lg font-bold text-green-700 dark:text-green-300">
                                    {logs.filter(l => l.status === 'submitted').length}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-700 dark:text-gray-300">Unsubmitted:</span>
                                <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                                    {logs.filter(l => l.status !== 'submitted').length}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Average Session Time */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 p-4 rounded-lg shadow-md border border-purple-200 dark:border-purple-700">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-purple-600 dark:text-purple-300 uppercase tracking-wide">Average Session</p>
                            <TrendingUp className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                        </div>
                        <p className="text-2xl font-bold font-mono text-purple-900 dark:text-purple-100">
                            {logs.length > 0 
                                ? formatTime(Math.floor(logs.reduce((sum, l) => sum + l.accumulatedMs, 0) / logs.length))
                                : '00:00:00'
                            }
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Per session across all time
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl">
          {/* Bulk Actions Bar */}
          {selectedSessions.size > 0 && (
            <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedSessions.size > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const allSessions = new Set();
                      filteredAndGroupedLogs.forEach(group => {
                        group.sessions.forEach(session => allSessions.add(session.id));
                      });
                      setSelectedSessions(allSessions);
                    } else {
                      setSelectedSessions(new Set());
                    }
                  }}
                  className="w-5 h-5 cursor-pointer"
                />
                <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                  {selectedSessions.size} session(s) selected
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleBulkStatusChange('submitted')}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="h-4 w-4" />
                  Mark Submitted
                </button>
                <button
                  onClick={() => handleBulkStatusChange('unsubmitted')}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-yellow-500 text-white text-sm font-semibold rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <RotateCcw className="h-4 w-4" />
                  Mark Unsubmitted
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedSessions(new Set())}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Compact Header */}
          <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
            <div className="flex items-center gap-4">
              <h2 className="flex items-center text-xl font-semibold text-gray-800 dark:text-gray-200">
                <List className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
                Time Log History
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredAndGroupedLogs.length} tickets • {filteredAndGroupedLogs.reduce((sum, g) => sum + g.sessions.length, 0)} sessions
              </span>
            </div>
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
              <div className="relative export-dropdown">
                <button
                  ref={exportButtonRef}
                  onClick={() => {
                    if (exportOption) {
                      setExportOption('');
                      setExportFormat('');
                      setExportFocusIndex(0);
                    } else {
                      setExportOption('menu');
                    }
                  }}
                  className="w-10 h-10 flex items-center justify-center bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  aria-label="Export"
                  aria-expanded={exportOption === 'menu'}
                  aria-haspopup="true"
                >
                  <Download className="h-5 w-5" />
                </button>
                
                {exportOption === 'menu' && (
                  <div 
                    ref={exportMenuRef}
                    className="absolute top-12 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-[200px]"
                    role="menu"
                    aria-label="Export options"
                  >
                    {!exportFormat ? (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
                          Choose Format
                        </div>
                        <button
                          onClick={() => {
                            setExportFormat('csv');
                            setExportFocusIndex(0);
                          }}
                          className={`w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${exportFocusIndex === 0 ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                          role="menuitem"
                        >
                          <span className="text-xl">📄</span>
                          <span className="font-medium">CSV</span>
                        </button>
                        <button
                          onClick={() => {
                            setExportFormat('json');
                            setExportFocusIndex(0);
                          }}
                          className={`w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 rounded-b-lg ${exportFocusIndex === 1 ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                          role="menuitem"
                        >
                          <span className="text-xl">📋</span>
                          <span className="font-medium">JSON</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                          <span>Choose Scope</span>
                          <span className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded">
                            {exportFormat.toUpperCase()}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setExportFormat('');
                            setExportFocusIndex(0);
                          }}
                          className="w-full px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 flex items-center gap-1"
                        >
                          <ChevronLeft className="h-3 w-3" />
                          Back to format
                        </button>
                        <button
                          onClick={() => {
                            handleExport('selected', exportFormat);
                            setExportOption('');
                            setExportFormat('');
                            setExportFocusIndex(0);
                          }}
                          disabled={isActionDisabled}
                          className={`w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${exportFocusIndex === 0 ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                          role="menuitem"
                        >
                          Selected
                        </button>
                        <button
                          onClick={() => {
                            handleExport('filtered', exportFormat);
                            setExportOption('');
                            setExportFormat('');
                            setExportFocusIndex(0);
                          }}
                          disabled={filteredAndGroupedLogs.length === 0}
                          className={`w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${exportFocusIndex === 1 ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                          role="menuitem"
                        >
                          Filtered
                        </button>
                        <button
                          onClick={() => {
                            handleExport('all', exportFormat);
                            setExportOption('');
                            setExportFormat('');
                            setExportFocusIndex(0);
                          }}
                          disabled={logs.length === 0}
                          className={`w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-b-lg ${exportFocusIndex === 2 ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                          role="menuitem"
                        >
                          All Data
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Select All Checkbox */}
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

          {/* Empty State */}
          {filteredAndGroupedLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <List className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                {logs.length === 0 ? "No time logs yet" : "No logs match your filters"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 max-w-sm">
                {logs.length === 0 
                  ? "Start tracking time by entering a ticket ID and clicking START above" 
                  : "Try adjusting your filters or clearing them to see more results"}
              </p>
              {(statusFilter !== 'All' || dateFilter) && (
                <button
                  onClick={() => { setStatusFilter('All'); setDateFilter(''); }}
                  className="mt-4 px-4 py-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors text-sm font-medium"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}

          {/* Compact Table Layout */}
          <div className="overflow-x-auto pt-4">
            <table className="w-full border-collapse table-fixed" style={{minWidth: '600px'}}>
              {/* Table Header */}
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 w-8">
                    <input
                      type="checkbox"
                      checked={filteredAndGroupedLogs.length > 0 && filteredAndGroupedLogs.every(g => selectedTickets.has(g.ticketId))}
                      onChange={handleToggleSelectAll}
                      disabled={filteredAndGroupedLogs.length === 0}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 w-48">Ticket ID</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 w-24">Total Time</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 w-20">Sessions</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 w-16">Status</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 w-24">Actions</th>
                </tr>
              </thead>
              
              {/* Table Body */}
              <tbody>
                {filteredAndGroupedLogs.map((group) => {
                  const isFullySubmitted = group.sessions.every(session => session.status === 'submitted');
                  
                  return (
                    <React.Fragment key={group.ticketId}>
                      {/* Main Ticket Row */}
                      <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="py-3 px-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ticket ${group.ticketId}`}
                            checked={selectedTickets.has(group.ticketId)}
                            onChange={() => handleToggleSelectTicket(group.ticketId)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        
                        <td className="py-3 px-2">
                          <div className="flex flex-col gap-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
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
                                  className="text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-gray-600 rounded px-2 py-1 border border-indigo-300 min-w-0 flex-1"
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <span className="text-indigo-700 dark:text-indigo-300 font-bold truncate min-w-0 flex-1">
                                    {group.ticketId}
                                  </span>
                                  {isFullySubmitted && <Check className="w-4 h-4 text-green-500 flex-shrink-0" title="All sessions submitted"/>}
                                  <button 
                                    onClick={() => {
                                      setEditingTicketId(group.ticketId);
                                      setEditingTicketValue(group.ticketId);
                                    }}
                                    className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-shrink-0"
                                    title="Edit Ticket ID"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                            {/* Session Notes under Ticket ID */}
                            {group.sessions.length > 0 && (
                              <div className="space-y-1">
                                {group.sessions.map(session => (
                                  <div key={session.id} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                                    <BookOpen className="h-3 w-3 flex-shrink-0"/>
                                    {editingSessionNote === session.id ? (
                                      <input
                                        type="text"
                                        value={editingSessionNoteValue}
                                        onChange={(e) => setEditingSessionNoteValue(e.target.value)}
                                        onBlur={() => handleUpdateSessionNote(session.id, editingSessionNoteValue)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            handleUpdateSessionNote(session.id, editingSessionNoteValue);
                                          } else if (e.key === 'Escape') {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            setEditingSessionNote(null);
                                            setEditingSessionNoteValue('');
                                          }
                                        }}
                                        placeholder="Add session note..."
                                        maxLength={5000}
                                        className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-600 rounded px-2 py-1 border border-gray-300 dark:border-gray-500 min-w-0 flex-1"
                                        autoFocus
                                      />
                                    ) : (
                                      <>
                                        <span className="truncate flex-1">{session.note || 'No notes'}</span>
                                        <button 
                                          onClick={() => {
                                            setEditingSessionNote(session.id);
                                            setEditingSessionNoteValue(session.note || '');
                                          }}
                                          className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-shrink-0"
                                          title="Edit Session Note"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="py-3 px-2 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-mono font-bold text-indigo-800 dark:text-indigo-200 whitespace-nowrap">
                              {formatTime(group.totalDurationMs)}
                            </span>
                            {/* Individual session times and dates */}
                            {group.sessions.length > 0 && (
                              <div className="space-y-1">
                                {group.sessions.map(session => (
                                  <div key={session.id} className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {formatTime(session.accumulatedMs)} • {new Date(session.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="py-3 px-2 text-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {group.sessions.length}
                          </span>
                        </td>
                        
                        <td className="py-3 px-2 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            group.isClosed 
                              ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200' 
                              : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                          }`}>
                            {group.isClosed ? 'Closed' : 'Open'}
                          </span>
                        </td>
                        
                        <td className="py-3 px-2 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center justify-center gap-1">
                              {group.isClosed ? (
                                <button 
                                  onClick={() => handleReopenTicket(group.ticketId)} 
                                  className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                  title="Reopen Ticket"
                                >
                                  <Repeat className="w-4 h-4" />
                                </button>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => handleCloseTicket(group.ticketId)} 
                                    className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    title="Close Ticket"
                                  >
                                    <Lock className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleContinueTicket(group.ticketId)} 
                                    className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                                    title="Start New Session"
                                  >
                                    <Repeat className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                            {/* Session Actions */}
                            {group.sessions.length > 0 && (
                              <div className="flex flex-col items-center gap-1">
                                {group.sessions.map(session => (
                                  <div key={session.id} className="flex items-center gap-1">
                                    <button 
                                      onClick={() => {
                                        setReallocatingSessionInfo({ sessionId: session.id, currentTicketId: group.ticketId });
                                        setIsReallocateModalOpen(true);
                                      }} 
                                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                                      title="Reallocate Session"
                                    >
                                      <CornerUpRight className="h-3 w-3" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteClick(session)} 
                                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                      title="Delete Session"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

// Wrap App with Error Boundary for graceful error handling
const AppWithErrorBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

export default AppWithErrorBoundary;



