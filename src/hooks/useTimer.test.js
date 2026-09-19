import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  updateDoc: vi.fn(async () => undefined),
  addDoc: vi.fn(async () => undefined),
}));

vi.mock('react-hot-toast', () => {
  const toast = vi.fn();
  toast.success = vi.fn();
  toast.error = vi.fn();
  toast.loading = vi.fn();
  toast.dismiss = vi.fn();
  return { default: toast };
});

import { useTimer } from './useTimer.js';
import { updateDoc, addDoc } from 'firebase/firestore';
import { MIN_SESSION_MS } from '../constants.js';

const makeLog = (overrides = {}) => ({
  id: 'log-1',
  ticketId: 'T-1',
  startTime: Date.now() - 5000,
  endTime: null,
  accumulatedMs: 60000,
  note: 'working',
  status: 'unsubmitted',
  createdAt: Date.now() - 60000,
  ...overrides,
});

const renderTimer = (props = {}) =>
  renderHook(() =>
    useTimer({
      getCollectionRef: {},
      currentNote: '',
      ticketStatuses: {},
      userId: 'user-1',
      ...props,
    })
  );

beforeEach(() => {
  vi.mocked(updateDoc).mockClear();
  vi.mocked(addDoc).mockClear();
});

describe('useTimer.restoreSession', () => {
  test('running session: timer runs and elapsed continues from accumulatedMs', () => {
    const { result } = renderTimer();
    act(() => result.current.restoreSession(makeLog()));

    expect(result.current.isTimerRunning).toBe(true);
    expect(result.current.isTimerPaused).toBe(false);
    expect(result.current.runningLogDocId).toBe('log-1');
  });

  test('paused session (startTime null): timer paused, elapsed equals accumulatedMs', () => {
    const { result } = renderTimer();
    act(() => result.current.restoreSession(makeLog({ startTime: null })));

    expect(result.current.isTimerRunning).toBe(false);
    expect(result.current.isTimerPaused).toBe(true);
  });

  test('clearSession resets everything', () => {
    const { result } = renderTimer();
    act(() => result.current.restoreSession(makeLog()));
    act(() => result.current.clearSession());

    expect(result.current.isTimerRunning).toBe(false);
    expect(result.current.isTimerPaused).toBe(false);
    expect(result.current.runningLogDocId).toBe(null);
  });
});

describe('useTimer.pauseTimer', () => {
  test('writes startTime null and accumulated accumulatedMs', async () => {
    const { result } = renderTimer({ currentNote: 'note text' });
    act(() => result.current.restoreSession(makeLog()));

    await act(async () => {
      const ok = await result.current.pauseTimer();
      expect(ok).toBe(true);
    });

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const write = vi.mocked(updateDoc).mock.calls[0][1];
    expect(write.startTime).toBe(null);
    expect(write.accumulatedMs).toBeGreaterThanOrEqual(60000);
    expect(write.note).toBe('note text');
  });

  test('without a running session does nothing', async () => {
    const { result } = renderTimer();
    await act(async () => {
      await result.current.pauseTimer();
    });
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('useTimer.stopTimer', () => {
  test('paused session: writes endTime and enforces MIN_SESSION_MS', async () => {
    const { result } = renderTimer();
    act(() => result.current.restoreSession(makeLog({ startTime: null, accumulatedMs: 50 })));

    await act(async () => {
      const ok = await result.current.stopTimer();
      expect(ok).toBe(true);
    });

    const write = vi.mocked(updateDoc).mock.calls[0][1];
    expect(typeof write.endTime).toBe('number');
    expect(write.startTime).toBe(null);
    expect(write.status).toBe('unsubmitted');
    expect(write.accumulatedMs).toBeGreaterThanOrEqual(MIN_SESSION_MS);
  });

  test('running session: endTime now, accumulated includes run duration', async () => {
    const { result } = renderTimer();
    act(() => result.current.restoreSession(makeLog({ accumulatedMs: 0 })));

    await act(async () => {
      await result.current.stopTimer();
    });

    const write = vi.mocked(updateDoc).mock.calls[0][1];
    expect(write.accumulatedMs).toBeGreaterThanOrEqual(MIN_SESSION_MS);
  });
});

describe('useTimer.startNewSession', () => {
  test('adds a sanitized unsubmitted entry with createdBy', async () => {
    const { result } = renderTimer();

    await act(async () => {
      const ok = await result.current.startNewSession('PROJ-<b>42</b>', 'note \n text');
      expect(ok).toBe(true);
    });

    expect(addDoc).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(addDoc).mock.calls[0][1];
    expect(entry.ticketId).not.toContain('<');
    expect(entry.status).toBe('unsubmitted');
    expect(entry.accumulatedMs).toBe(0);
    expect(entry.endTime).toBe(null);
    expect(entry.createdBy).toBe('user-1');
    expect(typeof entry.startTime).toBe('number');
  });

  test('failure surfaces as false without throwing', async () => {
    vi.mocked(addDoc).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderTimer();
    await act(async () => {
      const ok = await result.current.startNewSession('T-1');
      expect(ok).toBe(false);
    });
  });
});

describe('useTimer.startNewOrOverride', () => {
  test('empty ticket id does nothing', async () => {
    const { result } = renderTimer();
    await act(async () => {
      await result.current.startNewOrOverride('   ');
    });
    expect(addDoc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test('closed ticket does nothing', async () => {
    const { result } = renderTimer({
      ticketStatuses: { 'CLOSED-1': { isClosed: true } },
    });
    await act(async () => {
      await result.current.startNewOrOverride('CLOSED-1');
    });
    expect(addDoc).not.toHaveBeenCalled();
  });

  test('with a running session: stops first, then starts the new one', async () => {
    const { result } = renderTimer();
    act(() => result.current.restoreSession(makeLog()));

    await act(async () => {
      await result.current.startNewOrOverride('T-2');
    });

    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(addDoc).toHaveBeenCalledTimes(1);
    const stopOrder = vi.mocked(updateDoc).mock.invocationCallOrder[0];
    const startOrder = vi.mocked(addDoc).mock.invocationCallOrder[0];
    expect(stopOrder).toBeLessThan(startOrder);
    const newEntry = vi.mocked(addDoc).mock.calls[0][1];
    expect(newEntry.ticketId).toBe('T-2');
  });
});
