/**
 * Application-wide constants.
 */

// Input / data limits
export const MAX_TICKET_ID_LENGTH = 200;
export const MAX_NOTE_LENGTH = 5000;
export const MAX_USER_TITLE_LENGTH = 200;
export const MAX_RECENT_TICKETS = 10;

// Firestore batching
export const BATCH_CHUNK_SIZE = 450;

// Query limits
export const LOGS_QUERY_LIMIT = 200;
export const RANGED_LOGS_QUERY_LIMIT = 500;

// Timer milestones (in milliseconds)
export const TIMER_MILESTONES = [
  { ms: 30 * 60 * 1000, label: '30 minutes' },
  { ms: 60 * 60 * 1000, label: '1 hour' },
  { ms: 2 * 60 * 60 * 1000, label: '2 hours' },
  { ms: 4 * 60 * 60 * 1000, label: '4 hours' },
];

// Validation
export const VALID_TICKET_ID_REGEX = /^[\w\s\-_.#@/()[\]{}:,]+$/;
export const VALID_SHARE_ID_REGEX = /^[A-Za-z0-9_-]+$/;
export const MAX_SHARE_ID_LENGTH = 64;

// Time
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_ACCUMULATED_MS = ONE_DAY_MS * 30; // 30 days
export const MIN_SESSION_MS = 1000;

// Firebase init
export const FIREBASE_INIT_TIMEOUT_MS = 10000;

// LocalStorage keys
export const STORAGE_KEYS = {
  HAS_VISITED: 'hasVisitedTimeTracker',
  USER_TITLE: 'userTitle',
  RECENT_TICKET_IDS: 'recentTicketIds',
  THEME: 'timeTrackerTheme',
};

// Status filter options
export const STATUS_FILTERS = {
  ALL: 'All',
  OPEN: 'Open',
  CLOSED: 'Closed',
  SUBMITTED: 'Submitted',
};

// Session statuses
export const SESSION_STATUS = {
  SUBMITTED: 'submitted',
  UNSUBMITTED: 'unsubmitted',
};
