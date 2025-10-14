import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to manage timer logic.
 * @param {object} activeLogData - The currently running log entry from Firestore.
 * @param {boolean} isTimerRunning - Whether the timer is actively running.
 * @returns {{elapsedMs: number}} - The current elapsed milliseconds for the active timer.
 */
export const useTimer = (activeLogData, isTimerRunning) => {
  const [elapsedMs, setElapsedMs] = useState(0);
  const activeLogDataRef = useRef(activeLogData);

  // Keep a ref to the active log data to avoid re-running the interval effect.
  useEffect(() => {
    activeLogDataRef.current = activeLogData;
  }, [activeLogData]);

  // The main timer interval effect.
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        const logData = activeLogDataRef.current;
        if (logData && logData.startTime) {
          const currentRunDuration = Date.now() - logData.startTime;
          setElapsedMs(logData.accumulatedMs + currentRunDuration);
        }
      }, 1000);
    } else {
      clearInterval(interval);
    }

    return () => {
      clearInterval(interval);
    };
  }, [isTimerRunning]);

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

