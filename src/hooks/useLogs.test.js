import { describe, test, expect } from 'vitest';
import { toLog, buildDateConstraints } from './useLogs.js';

describe('toLog', () => {
  const makeDoc = (data) => ({ id: 'doc-1', data: () => data });

  test('maps numeric submissionDate through unchanged', () => {
    const log = toLog(makeDoc({ ticketId: 'T-1', submissionDate: 1727000000000 }));
    expect(log.submissionDate).toBe(1727000000000);
  });

  test('converts Firestore Timestamp submissionDate to a Date', () => {
    const d = new Date('2026-08-22T10:00:00Z');
    const log = toLog(makeDoc({ ticketId: 'T-1', submissionDate: { toDate: () => d } }));
    expect(log.submissionDate).toEqual(d);
  });

  test('applies defaults for missing fields', () => {
    const log = toLog(makeDoc({}));
    expect(log.id).toBe('doc-1');
    expect(log.ticketId).toBe('No Ticket ID');
    expect(log.startTime).toBe(null);
    expect(log.endTime).toBe(null);
    expect(log.accumulatedMs).toBe(0);
    expect(log.note).toBe('');
    expect(log.status).toBe('unsubmitted');
    expect(log.submissionDate).toBe(null);
    expect(log.createdAt).toBe(null);
  });
});

describe('buildDateConstraints', () => {
  test('no dates yields no constraints', () => {
    expect(buildDateConstraints('', '')).toEqual([]);
    expect(buildDateConstraints(null, null)).toEqual([]);
  });

  test('start date only yields one constraint', () => {
    const c = buildDateConstraints('2026-01-01', '');
    expect(c).toHaveLength(1);
  });

  test('both dates yield two constraints', () => {
    const c = buildDateConstraints('2026-01-01', '2026-01-31');
    expect(c).toHaveLength(2);
  });

  test('malformed dates are dropped, not thrown', () => {
    expect(buildDateConstraints('01/02/2026', '2026-1-2')).toEqual([]);
  });
});
