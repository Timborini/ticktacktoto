import toast from 'react-hot-toast';

const DEFAULT_DURATION = 8000;
const MAX_UNDO_ACTIONS = 10;
const undoStack = [];

async function executeUndo(onUndo, undoMessage, ticketId) {
  try {
    const result = await onUndo();
    toast.success(typeof result === 'string' ? result : (undoMessage || 'Restored'));
    if (ticketId && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('undo-restored', { detail: { ticketId } }));
    }
  } catch (error) {
    if (import.meta.env.DEV) console.error('Undo failed:', error);
    toast.error('Undo failed');
  }
}

function removeUndoEntry(entry) {
  const index = undoStack.findIndex((item) => item.toastId === entry.toastId);
  if (index !== -1) undoStack.splice(index, 1);
}

/**
 * Show a toast with an Undo action. Also registers the action on the app's
 * undo stack (newest last) so Ctrl+Z can trigger the most recent undoable
 * operation, then earlier ones on repeated presses, while fresh.
 */
export function showUndoToast(message, onUndo, { duration = DEFAULT_DURATION, icon, undoMessage, ticketId } = {}) {
  const toastId = toast((t) => (
    <div className="flex items-center gap-3">
      <span className="text-sm">{message}</span>
      <button
        type="button"
        onClick={async () => {
          toast.dismiss(t.id);
          removeUndoEntry(entry);
          await executeUndo(onUndo, undoMessage, ticketId);
        }}
        className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-500 transition-colors"
      >
        Undo
      </button>
    </div>
  ), { duration, ...(icon ? { icon } : {}) });
  const entry = { onUndo, undoMessage, ticketId, expires: Date.now() + duration, toastId };
  undoStack.push(entry);
  while (undoStack.length > MAX_UNDO_ACTIONS) undoStack.shift();
}

/**
 * Undo the most recent undoable action (LIFO). Repeated calls undo earlier
 * actions. Expired entries are skipped. Returns true when an action was
 * triggered (caller may preventDefault).
 */
export function runLastUndo() {
  while (undoStack.length > 0) {
    const entry = undoStack.pop();
    toast.dismiss(entry.toastId);
    if (Date.now() > entry.expires) continue;
    executeUndo(entry.onUndo, entry.undoMessage, entry.ticketId);
    return true;
  }
  return false;
}

/**
 * Firestore create rules require startTime to be a number/timestamp, but
 * paused and completed sessions store startTime: null. When restoring a
 * deleted document, substitute a valid timestamp so the write passes rules.
 * Completed sessions can use their endTime (they never enter the active
 * query). Paused sessions fall back to now() — restoring as running-from-now
 * is the closest rules-compliant state and avoids inflating elapsed time.
 */
export function normalizeForRestore(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.startTime != null) return data;
  return { ...data, startTime: data.endTime ?? Date.now() };
}
