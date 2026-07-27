/**
 * Lightweight error monitoring: captures runtime errors and stores them in a
 * Firestore `error_reports` collection (create-only per security rules).
 * Best-effort: reporting failures are swallowed and never break the app.
 * Rate-limited client-side to avoid write amplification during error storms.
 */
import { addDoc, collection } from 'firebase/firestore';
import { dataAppId } from './firebase.js';

const MAX_PER_MINUTE = 5;

const truncate = (value, max) => String(value ?? '').substring(0, max);

let config = null;
let initialized = false;
let sentTimestamps = [];
const queue = [];
let flushing = false;

async function flushQueue() {
  if (flushing || !config?.db) return;
  flushing = true;
  try {
    while (queue.length > 0) {
      const now = Date.now();
      sentTimestamps = sentTimestamps.filter((t) => now - t < 60000);
      if (sentTimestamps.length >= MAX_PER_MINUTE) {
        queue.length = 0;
        break;
      }
      const entry = queue.shift();
      try {
        await addDoc(collection(config.db, 'artifacts', dataAppId, 'error_reports'), entry);
        sentTimestamps.push(Date.now());
      } catch {
        // Best effort — never surface reporting failures to the user
      }
    }
  } finally {
    flushing = false;
  }
}

export function reportError(error, { source = 'manual' } = {}) {
  if (import.meta.env.DEV) console.error(`[errorReporting:${source}]`, error);
  if (!config?.db) return;

  queue.push({
    message: truncate(error?.message || error, 2000),
    stack: truncate(error?.stack, 8000),
    source: truncate(source, 200),
    url: truncate(window.location.href, 500),
    userAgent: truncate(navigator.userAgent, 500),
    userId: config.getUserId?.() || null,
    createdAt: Date.now(),
  });
  void flushQueue();
}

export function initErrorReporting({ db, getUserId }) {
  config = { db, getUserId };
  if (initialized) return;
  initialized = true;

  window.addEventListener('error', (event) => {
    reportError(event.error || new Error(event.message), { source: 'window.onerror' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    reportError(reason, { source: 'unhandledrejection' });
  });
}
