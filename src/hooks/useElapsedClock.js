import { useEffect, useState } from 'react';

/**
 * Local ticking display clock for the timer. The 1-second tick state lives
 * here (inside TimerSection) instead of in useTimer/App state, so a running
 * timer re-renders only the timer display rather than the whole App tree.
 * App still sees snapshot-level timer state (isTimerRunning/activeLogData);
 * milestones and writes are handled by useTimer.
 */
export function useElapsedClock({ isTimerRunning, isTimerPaused, activeLogData }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (isTimerRunning && activeLogData?.startTime) {
      const base = activeLogData.accumulatedMs;
      const start = activeLogData.startTime;
      const compute = () => base + Math.max(0, Date.now() - start);
      setElapsedMs(compute());
      const interval = setInterval(() => setElapsedMs(compute()), 1000);
      return () => clearInterval(interval);
    }
    setElapsedMs(isTimerPaused && activeLogData ? activeLogData.accumulatedMs : 0);
  }, [isTimerRunning, isTimerPaused, activeLogData]);

  return elapsedMs;
}
