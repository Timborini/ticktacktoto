import React, { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import {
  AlertTriangle, Loader, X, Check, Clipboard, Sun, Moon, Info,
  Clock, List, Pencil, CornerUpRight, Trash2, TrendingUp, Keyboard, Download, Send
} from 'lucide-react';

// --- Firebase Imports (MUST use module path for React) ---
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
} from 'firebase/auth';
import {
  getFirestore, collection, query, onSnapshot,
  doc, updateDoc, deleteDoc, addDoc, where, getDocs, writeBatch, setDoc
} from 'firebase/firestore';

// --- Toast Notifications ---
import toast, { Toaster } from 'react-hot-toast';
import ModalBase from './components/ModalBase.jsx';
import TimerSection from './components/TimerSection.jsx';
import SessionList from './components/SessionList.jsx';
import StatsDashboard from './components/StatsDashboard.jsx';
import FilterBar from './components/FilterBar.jsx';
import useAsyncAction from './utils/useAsyncAction.js';
import { formatTime, sanitizeTicketId, sanitizeNote, escapeCSV } from './utils/helpers.js';

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
 * Custom Confirmation Modal Component with Accessibility
 */
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm" }) => {
  const confirmButtonRef = useRef(null);

  // Focus and Escape are handled by ModalBase

  if (!isOpen) return null;

  const confirmButtonColor = confirmText === "Delete" ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700";

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={confirmText === "Delete" ? onCancel : onCancel}
      labelledBy="modal-title"
      describedBy="modal-description"
      initialFocusRef={confirmButtonRef}
      sizeClass="max-w-sm"
      backdropCanClose={confirmText !== "Delete"}
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
          type="button"
          onClick={onCancel}
          className="flex items-center space-x-1 px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </button>
        <button
          type="button"
          ref={confirmButtonRef}
          onClick={onConfirm}
          className={`flex items-center space-x-1 px-4 py-2 min-h-[44px] text-white font-semibold rounded-lg transition-colors active:scale-[0.98] ${confirmButtonColor}`}
          aria-label={confirmText}
        >
          <Check className="w-4 h-4" />
          <span>{confirmText}</span>
        </button>
      </div>
    </ModalBase>
  );
};

const ReallocateModal = ({ isOpen, onClose, sessionInfo, allTicketIds, onConfirm }) => {
  const [newTicketId, setNewTicketId] = useState('');
  const selectRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setNewTicketId('');
    }
  }, [isOpen, sessionInfo]);

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
    <ModalBase
      isOpen={isOpen && !!sessionInfo}
      onClose={onClose}
      labelledBy="reallocate-title"
      describedBy="reallocate-description"
      initialFocusRef={selectRef}
      sizeClass="max-w-md"
    >
      <h3 id="reallocate-title" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
        Reallocate Session
      </h3>
      <p id="reallocate-description" className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
        Move this session from <strong className="font-mono text-indigo-500">{sessionInfo?.currentTicketId}</strong> to another ticket.
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
          type="button"
          onClick={onClose}
          className="flex items-center justify-center space-x-1 px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!newTicketId || newTicketId === sessionInfo?.currentTicketId}
          className="flex items-center justify-center space-x-1 px-4 py-2 min-h-[44px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Confirm Reallocation"
        >
          <Check className="w-4 h-4" />
          <span>Confirm Reallocation</span>
        </button>
      </div>
    </ModalBase>
  );
};

const ReportModal = ({ isOpen, onClose, reportData, ticketId }) => {
  const copyButtonRef = useRef(null);

  // Focus and Escape are handled by ModalBase

  const copyToClipboard = async () => {
    if (!reportData?.text) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(reportData.text);
        toast.success('Copied to clipboard!');
        return;
      }
    } catch { }
    // Fallback method
    try {
      const tempInput = document.createElement('textarea');
      tempInput.value = reportData.text;
      tempInput.setAttribute('readonly', '');
      tempInput.style.position = 'absolute';
      tempInput.style.left = '-9999px';
      document.body.appendChild(tempInput);
      tempInput.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(tempInput);
      if (successful) {
        toast.success('Copied to clipboard!');
      } else {
        toast.error('Copy failed');
      }
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="report-title"
      describedBy="report-description"
      initialFocusRef={copyButtonRef}
      sizeClass="max-w-xl"
    >
      <h3 id="report-title" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center">
        <Send className="w-6 h-6 mr-2" /> AI Prompt for {ticketId}
      </h3>
      <p id="report-description" className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
        Copy this prompt and paste it into your preferred AI chat application.
      </p>

      <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl border border-gray-300 dark:border-gray-600">
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono text-sm">{reportData?.text}</p>
      </div>
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <button
          type="button"
          ref={copyButtonRef}
          onClick={copyToClipboard}
          disabled={!reportData?.text}
          className="flex items-center justify-center space-x-2 px-4 py-2 min-h-[44px] bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Copy to Clipboard"
        >
          <Clipboard className="w-4 h-4" />
          <span>Copy to Clipboard</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
          aria-label="Close"
        >
          Close
        </button>
      </div>
    </ModalBase>
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
          <li><strong>Edit:</strong> Click <Pencil className="w-3 h-3 inline-block -mt-1 text-blue-500" /> to rename tickets across all sessions</li>
          <li><strong>Reallocate:</strong> Click <CornerUpRight className="w-3 h-3 inline-block -mt-1 text-purple-500" /> to move sessions to different tickets</li>
          <li><strong>Delete:</strong> Click <Trash2 className="w-3 h-3 inline-block -mt-1 text-red-500" /> to remove sessions</li>
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
    const constraints = [];
    try {
      if (dateRangeStart) {
        const startMs = new Date(dateRangeStart).getTime();
        if (!Number.isNaN(startMs)) constraints.push(where('endTime', '>=', startMs));
      }
      if (dateRangeEnd) {
        const endMs = new Date(dateRangeEnd).getTime() + (24 * 60 * 60 * 1000 - 1);
        if (!Number.isNaN(endMs)) constraints.push(where('endTime', '<=', endMs));
      }
    } catch { }

    // Helper to parse a Firestore doc into our log shape
    const toLog = (doc) => {
      const data = doc.data();
      let submissionDate = null;
      if (data.submissionDate) {
        if (typeof data.submissionDate === 'number') {
          submissionDate = data.submissionDate;
        } else if (data.submissionDate.toDate) {
          submissionDate = data.submissionDate.toDate();
        }
      }
      return {
        id: doc.id,
        ticketId: data.ticketId || 'No Ticket ID',
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        accumulatedMs: data.accumulatedMs || 0,
        note: data.note || '',
        status: data.status || 'unsubmitted',
        submissionDate,
        createdAt: data.createdAt || null
      };
    };

    // When no date constraints, keep existing single real-time subscription (includes active)
    if (constraints.length === 0) {
      const q = query(getCollectionRef);
      const unsubscribeSingle = onSnapshot(q, (snapshot) => {
        let fetchedLogs = [];
        let currentActiveLog = null;

        snapshot.docs.forEach((doc) => {
          const log = toLog(doc);
          if (log.endTime === null) currentActiveLog = log;
          else fetchedLogs.push(log);
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
        } else if (runningLogDocId) {
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

        setIsLoading(false);
        setHasLoadedOnce(true);
      }, (error) => {
        console.error('Firestore snapshot error:', error);
        setFirebaseError('Failed to load real-time data. Check console.');
        setIsLoading(false);
        setHasLoadedOnce(true);
      });

      return () => unsubscribeSingle();
    }

    // With date constraints: subscribe to ranged finished sessions AND always-include active sessions
    let rangedLogs = [];
    let activeLog = null;
    let gotRanged = false;
    let gotActive = false;

    const recompute = () => {
      setLogs(rangedLogs);

      if (activeLog) {
        setRunningLogDocId(activeLog.id);
        setCurrentTicketId(activeLog.ticketId);
        setCurrentNote(activeLog.note || '');
        setActiveLogData(activeLog);

        if (activeLog.startTime) {
          setIsTimerRunning(true);
          setIsTimerPaused(false);
          const currentRunDuration = Date.now() - activeLog.startTime;
          setElapsedMs(activeLog.accumulatedMs + currentRunDuration);
        } else {
          setIsTimerRunning(false);
          setIsTimerPaused(true);
          setElapsedMs(activeLog.accumulatedMs);
        }
      } else if (runningLogDocId) {
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

      if (gotRanged && gotActive) {
        setIsLoading(false);
        setHasLoadedOnce(true);
      }
    };

    const rangedQuery = query(getCollectionRef, ...constraints);
    const unsubscribeRanged = onSnapshot(rangedQuery, (snapshot) => {
      rangedLogs = [];
      snapshot.docs.forEach((doc) => {
        const log = toLog(doc);
        // Ranged query contains only finished sessions
        if (log.endTime !== null) rangedLogs.push(log);
      });
      gotRanged = true;
      recompute();
    }, (error) => {
      console.error('Firestore ranged snapshot error:', error);
      setFirebaseError('Failed to load ranged data. Check console.');
      gotRanged = true;
      recompute();
    });

    const activeQuery = query(getCollectionRef, where('endTime', '==', null));
    const unsubscribeActive = onSnapshot(activeQuery, (snapshot) => {
      // We expect 0 or 1 active session for this user
      const first = snapshot.docs[0];
      activeLog = first ? toLog(first) : null;
      gotActive = true;
      recompute();
    }, (error) => {
      console.error('Firestore active snapshot error:', error);
      setFirebaseError('Failed to load active session. Check console.');
      gotActive = true;
      recompute();
    });

    return () => {
      unsubscribeRanged();
      unsubscribeActive();
    };
  }, [isAuthReady, getCollectionRef, runningLogDocId, dateRangeStart, dateRangeEnd]);

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

  // (Removed) Keyboard navigation for export dropdown is handled within ExportMenu component

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
      return;
    }

    setIsLoading(true);
    const stopTime = Date.now();
    const currentRunDuration = stopTime - activeLogData.startTime;
    const newAccumulatedMs = activeLogData.accumulatedMs + Math.max(0, currentRunDuration);

    try {
      await updateDoc(doc(getCollectionRef, runningLogDocId), {
        startTime: null,
        accumulatedMs: newAccumulatedMs,
        note: sanitizeNote(currentNote),
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
        note: sanitizeNote(currentNote),
        status: 'unsubmitted' // Ensure new logs are unsubmitted
      });

      if (!isAutoOverride) {
        setCurrentTicketId('');
        setCurrentNote('');
      }

    } catch (error) {
      console.error('Error stopping timer:', error);
      setFirebaseError('Failed to stop timer.');
    } finally {
      setIsLoading(false);
    }
  }, [runningLogDocId, getCollectionRef, isTimerRunning, isTimerPaused, activeLogData, currentNote]);

  const startNewSession = useCallback(async (ticketId, note = '') => {
    if (!getCollectionRef) return;
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
      return;
    }
    if (isTimerRunning) {
      return;
    }

    setIsLoading(true);
    const startTimestamp = Date.now();

    try {
      if (isTimerPaused) {
        if (!runningLogDocId) throw new Error("Paused log ID missing.");
        await updateDoc(doc(getCollectionRef, runningLogDocId), {
          startTime: startTimestamp,
          note: sanitizeNote(currentNote),
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
    if (!getTicketStatusCollectionRef) return;

    const loadingToast = toast.loading('Closing ticket...');
    const statusEntry = ticketStatuses[ticketId];

    try {
      // Use deterministic doc id = ticketId for stability
      const targetDocId = statusEntry?.id || ticketId;
      await setDoc(
        doc(getTicketStatusCollectionRef, targetDocId),
        { ticketId, isClosed: true },
        { merge: true }
      );
      // Optimistic UI update while snapshot catches up
      setTicketStatuses(prev => ({ ...prev, [ticketId]: { id: targetDocId, isClosed: true } }));
      toast.success('Ticket closed', { id: loadingToast, duration: 3000 });
    } catch (error) {
      console.error('Error closing ticket:', error);
      setFirebaseError(`Failed to close ticket ${ticketId}.`);
      toast.error('Failed to close ticket', { id: loadingToast, duration: 4000 });
    } finally {
      // Do not force-dismiss here; success/error replaced the loading toast with same id.
    }
  }, [getTicketStatusCollectionRef, ticketStatuses]);

  const handleReopenTicket = useCallback(async (ticketId) => {
    if (!getTicketStatusCollectionRef) return;

    const loadingToast = toast.loading('Reopening ticket...');
    const statusEntry = ticketStatuses[ticketId];

    try {
      const targetDocId = statusEntry?.id || ticketId;
      await setDoc(
        doc(getTicketStatusCollectionRef, targetDocId),
        { ticketId, isClosed: false },
        { merge: true }
      );
      setTicketStatuses(prev => ({ ...prev, [ticketId]: { id: targetDocId, isClosed: false } }));
      toast.success('Ticket reopened', { id: loadingToast, duration: 3000 });
    } catch (error) {
      console.error('Error reopening ticket:', error);
      setFirebaseError(`Failed to reopen ticket ${ticketId}.`);
      toast.error('Failed to reopen ticket', { id: loadingToast, duration: 4000 });
    } finally {
      // Do not force-dismiss here; success/error replaced the loading toast with same id.
    }
  }, [getTicketStatusCollectionRef, ticketStatuses]);

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
  const [runAsync] = useAsyncAction('Failed to perform action');

  const handleBulkDelete = useCallback(async () => {
    if (!getCollectionRef || selectedSessions.size === 0) return;

    const confirmDelete = window.confirm(`Delete ${selectedSessions.size} session(s)?`);
    if (!confirmDelete) return;

    try {
      setIsLoading(true);
      await runAsync(async () => {
        const deletePromises = Array.from(selectedSessions).map(sessionId => deleteDoc(doc(getCollectionRef, sessionId)));
        await Promise.all(deletePromises);
        setSelectedSessions(new Set());
      }, { successMessage: `Successfully deleted ${selectedSessions.size} session(s)` });
    } catch (error) {
      console.error('Error deleting sessions:', error);
      setFirebaseError('Failed to delete some sessions.');
    } finally {
      setIsLoading(false);
    }
  }, [getCollectionRef, selectedSessions, runAsync]);

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

    if (finalSessionIds.size === 0 || !getCollectionRef || !db) return;

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
      setFirebaseError("Failed to mark sessions as submitted.");
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
      if (markAsSubmitted && exportedSessionIds.size > 0) {
        // Mark sessions as submitted
        const batch = writeBatch(db);
        exportedSessionIds.forEach(sessionId => {
          const sessionRef = doc(getCollectionRef, sessionId);
          batch.update(sessionRef, {
            status: 'submitted',
            submissionDate: Date.now()
          });
        });
        await batch.commit();
      }

      // Now perform the export
      performExport(pendingExport.logs, pendingExport.name, pendingExport.format);

    } catch (error) {
      console.error('Error:', error);
      setFirebaseError('Failed to update submission status.');
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

  let actionHandler;

  if (isTimerRunning) {
    actionHandler = pauseTimer;
  } else if (isTimerPaused && inputTicketId === pausedTicketId) {
    actionHandler = startOrResumeTimer;
  } else {
    actionHandler = () => startNewOrOverride(inputTicketId);
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
                    <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full border-2 border-indigo-500" />
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
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" className="w-5 h-5" />
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
          isTimerRunning={isTimerRunning}
          isTimerPaused={isTimerPaused}
          userTitle={userTitle}
          setUserTitle={setUserTitle}
          currentTicketId={currentTicketId}
          setCurrentTicketId={setCurrentTicketId}
          isInputDisabled={isInputDisabled}
          recentTicketIds={recentTicketIds}
          isInputTicketClosed={isInputTicketClosed}
          currentNote={currentNote}
          setCurrentNote={setCurrentNote}
          elapsedMs={elapsedMs}
          onStart={startNewOrOverride}
          onPause={pauseTimer}
          onResume={startOrResumeTimer}
          onStop={stopTimer}
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
          selectedTickets={selectedTickets}
          handleToggleSelectAll={handleToggleSelectAll}
          handleToggleSelectTicket={handleToggleSelectTicket}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          setDateFilter={setDateFilter}
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

// Wrap App with Error Boundary for graceful error handling
const AppWithErrorBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

export default AppWithErrorBoundary;



