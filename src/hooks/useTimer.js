import { useState, useEffect, useRef, useCallback } from 'react';
import {
  doc,
  updateDoc,
  addDoc,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { sanitizeTicketId, sanitizeNote, formatTime } from '../utils/helpers.js';
import { showUndoToast } from '../utils/undoToast.jsx';
import { MIN_SESSION_MS, TIMER_MILESTONES } from '../constants.js';

export function useTimer({ getCollectionRef, currentNote, ticketStatuses, userId }) {
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [runningLogDocId, setRunningLogDocId] = useState(null);
  const [activeLogData, setActiveLogData] = useState(null);

  const passedMilestonesRef = useRef(new Set());

  // Restore a running/paused session from external log data (used by useLogs listener)
  const restoreSession = useCallback((log) => {
    setRunningLogDocId(log.id);
    setActiveLogData(log);

    if (log.startTime) {
      setIsTimerRunning(true);
      setIsTimerPaused(false);
      setElapsedMs(log.accumulatedMs + (Date.now() - log.startTime));
    } else {
      setIsTimerRunning(false);
      setIsTimerPaused(true);
      setElapsedMs(log.accumulatedMs);
    }
  }, []);

  const clearSession = useCallback(() => {
    setIsTimerRunning(false);
    setIsTimerPaused(false);
    setRunningLogDocId(null);
    setActiveLogData(null);
    setElapsedMs(0);
  }, []);

  // Timer interval
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && runningLogDocId && activeLogData?.startTime) {
      // Seed milestones already passed so a restored session doesn't re-toast them
      const initialElapsed = activeLogData.accumulatedMs + (Date.now() - activeLogData.startTime);
      passedMilestonesRef.current = new Set(
        TIMER_MILESTONES.filter((m) => initialElapsed >= m.ms).map((m) => m.label)
      );

      const updateTimer = () => {
        const currentRunDuration = Date.now() - activeLogData.startTime;
        const newElapsedMs = activeLogData.accumulatedMs + currentRunDuration;
        setElapsedMs(newElapsedMs);

        for (const milestone of TIMER_MILESTONES) {
          if (newElapsedMs >= milestone.ms && !passedMilestonesRef.current.has(milestone.label)) {
            passedMilestonesRef.current.add(milestone.label);
            toast(`⏰ Timer reached ${milestone.label}!`, {
              icon: '🎯',
              duration: 4000,
            });
          }
        }
      };

      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      passedMilestonesRef.current = new Set();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, runningLogDocId, activeLogData]);

  const pauseTimer = useCallback(async () => {
    if (!runningLogDocId || !isTimerRunning || !getCollectionRef || !activeLogData) return;

    const stopTime = Date.now();
    const currentRunDuration = stopTime - activeLogData.startTime;
    const newAccumulatedMs = activeLogData.accumulatedMs + Math.max(0, currentRunDuration);

    try {
      await updateDoc(doc(getCollectionRef, runningLogDocId), {
        startTime: null,
        accumulatedMs: newAccumulatedMs,
        note: sanitizeNote(currentNote),
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error pausing timer:', error);
      toast.error('Failed to pause timer. Please try again.');
      return false;
    }
  }, [runningLogDocId, isTimerRunning, getCollectionRef, activeLogData, currentNote]);

  const stopTimer = useCallback(async () => {
    if (!runningLogDocId || !getCollectionRef || !activeLogData) return;

    const finalStopTime = Date.now();
    let finalAccumulatedMs = activeLogData.accumulatedMs;

    if (isTimerRunning) {
      const currentRunDuration = finalStopTime - activeLogData.startTime;
      finalAccumulatedMs += Math.max(MIN_SESSION_MS, currentRunDuration);
    } else if (isTimerPaused) {
      finalAccumulatedMs = activeLogData.accumulatedMs;
      if (finalAccumulatedMs < MIN_SESSION_MS) finalAccumulatedMs = MIN_SESSION_MS;
    }

    try {
      await updateDoc(doc(getCollectionRef, runningLogDocId), {
        endTime: finalStopTime,
        startTime: null,
        accumulatedMs: finalAccumulatedMs,
        note: sanitizeNote(currentNote),
        status: 'unsubmitted',
      });
      const stoppedDocId = runningLogDocId;
      const stoppedTicketId = activeLogData.ticketId;
      const collectionRef = getCollectionRef;
      showUndoToast(`Logged ${formatTime(finalAccumulatedMs)} to ${stoppedTicketId}`, async () => {
        await updateDoc(doc(collectionRef, stoppedDocId), { endTime: null, startTime: null });
      }, { icon: '✅', undoMessage: `Session for ${stoppedTicketId} restored as paused` });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error stopping timer:', error);
      toast.error('Failed to stop timer. Your session is still running.');
      return false;
    }
  }, [runningLogDocId, getCollectionRef, isTimerRunning, isTimerPaused, activeLogData, currentNote]);

  const startNewSession = useCallback(async (ticketId, note = '') => {
    if (!getCollectionRef) return;

    const startTimestamp = Date.now();
    try {
      const newEntry = {
        ticketId: sanitizeTicketId(ticketId),
        startTime: startTimestamp,
        endTime: null,
        accumulatedMs: 0,
        note: sanitizeNote(note),
        status: 'unsubmitted',
        createdAt: startTimestamp,
        createdBy: userId,
      };
      await addDoc(getCollectionRef, newEntry);
      return true;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error starting new timer:', error);
      toast.error('Failed to start timer. Please try again.');
      return false;
    }
  }, [getCollectionRef, userId]);

  const startOrResumeTimer = useCallback(async () => {
    if (!getCollectionRef) return;

    const startTimestamp = Date.now();
    try {
      if (isTimerPaused && runningLogDocId) {
        await updateDoc(doc(getCollectionRef, runningLogDocId), {
          startTime: startTimestamp,
          note: sanitizeNote(currentNote),
        });
        return true;
      } else {
        throw new Error('No paused session to resume');
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error resuming timer:', error);
      toast.error('Failed to resume timer. Please try again.');
      return false;
    }
  }, [getCollectionRef, isTimerPaused, runningLogDocId, currentNote]);

  const startNewOrOverride = useCallback(async (ticketId) => {
    if (!getCollectionRef || !ticketId?.trim()) return;
    if (ticketStatuses[ticketId]?.isClosed) return;

    if (isTimerRunning || isTimerPaused) {
      const stopped = await stopTimer();
      if (!stopped) return;
    }

    await startNewSession(ticketId, '');
  }, [getCollectionRef, isTimerRunning, isTimerPaused, stopTimer, startNewSession, ticketStatuses]);

  return {
    isTimerRunning,
    isTimerPaused,
    elapsedMs,
    runningLogDocId,
    activeLogData,
    restoreSession,
    clearSession,
    pauseTimer,
    stopTimer,
    startNewSession,
    startOrResumeTimer,
    startNewOrOverride,
  };
}
