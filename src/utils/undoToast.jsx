import toast from 'react-hot-toast';

const DEFAULT_DURATION = 8000;
let lastUndoAction = null;

async function executeUndo(onUndo, undoMessage) {
  try {
    const result = await onUndo();
    toast.success(typeof result === 'string' ? result : (undoMessage || 'Restored'));
  } catch (error) {
    if (import.meta.env.DEV) console.error('Undo failed:', error);
    toast.error('Undo failed');
  }
}

/**
 * Show a toast with an Undo action. Also registers the action as the app's
 * most recent undoable operation so Ctrl+Z can trigger it while fresh.
 */
export function showUndoToast(message, onUndo, { duration = DEFAULT_DURATION, icon, undoMessage } = {}) {
  const toastId = toast((t) => (
    <div className="flex items-center gap-3">
      <span className="text-sm">{message}</span>
      <button
        type="button"
        onClick={async () => {
          toast.dismiss(t.id);
          if (lastUndoAction?.onUndo === onUndo) lastUndoAction = null;
          await executeUndo(onUndo, undoMessage);
        }}
        className="shrink-0 px-3 py-1.5 bg-indigo-500 text-white text-sm font-semibold rounded-md hover:bg-indigo-400 transition-colors"
      >
        Undo
      </button>
    </div>
  ), { duration, ...(icon ? { icon } : {}) });
  lastUndoAction = { onUndo, undoMessage, expires: Date.now() + duration, toastId };
}

/**
 * Run the most recent undoable action if it is still within its window.
 * Returns true when an action was triggered (caller may preventDefault).
 */
export function runLastUndo() {
  if (!lastUndoAction || Date.now() > lastUndoAction.expires) return false;
  const { onUndo, undoMessage, toastId } = lastUndoAction;
  lastUndoAction = null;
  toast.dismiss(toastId);
  executeUndo(onUndo, undoMessage);
  return true;
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
