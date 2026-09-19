import { describe, test, expect, vi, beforeAll } from 'vitest';
import { performExport } from './exportHelpers.js';
import { formatTime } from '../../utils/helpers.js';

let capturedBlobs = [];

beforeAll(() => {
  class MockBlob {
    constructor(parts) {
      this.parts = parts;
      capturedBlobs.push(this);
    }
  }
  vi.stubGlobal('Blob', MockBlob);
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn(() => undefined);
});

const makeLog = (overrides = {}) => ({
  id: 's-1',
  ticketId: 'PROJ-1',
  accumulatedMs: 3661000,
  note: 'did things',
  status: 'submitted',
  submissionDate: 1727000000000,
  createdAt: 1726900000000,
  endTime: 1726999900000,
  ...overrides,
});

describe('performExport JSON', () => {
  test('writes one object per log with the documented keys', () => {
    capturedBlobs = [];
    performExport([makeLog()], 'report', 'json');

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const data = JSON.parse(capturedBlobs[0].parts[0]);
    expect(data).toHaveLength(1);
    expect(data[0]).toEqual({
      ticketId: 'PROJ-1',
      timeWorked: formatTime(3661000),
      timeWorkedMs: 3661000,
      note: 'did things',
      startDateTime: new Date(1726900000000).toISOString(),
      finishedDateTime: new Date(1726999900000).toISOString(),
      sessionId: 's-1',
      status: 'submitted',
      submissionDate: new Date(1727000000000).toISOString(),
    });
  });

  test('omits null timestamps rather than emitting "null"', () => {
    capturedBlobs = [];
    performExport([makeLog({ endTime: null, submissionDate: null })], 'report', 'json');
    const data = JSON.parse(capturedBlobs[0].parts[0]);
    expect(data[0].finishedDateTime).toBe(null);
    expect(data[0].submissionDate).toBe(null);
  });
});

describe('performExport CSV', () => {
  test('emits a header row and one row per log', () => {
    capturedBlobs = [];
    performExport([makeLog(), makeLog({ id: 's-2' })], 'report', 'csv');

    const content = capturedBlobs[0].parts[0];
    const rows = content.split('\n');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toBe(
      'Ticket ID,Time Worked (HH:MM:SS),Note,Start Date/Time,Finished Date/Time,Session ID,Status,Submission Date'
    );
    expect(rows[1]).toContain('"PROJ-1"');
    expect(rows[1]).toContain('"01:01:01"');
    expect(rows[2]).toContain('"s-2"');
  });

  test('neutralises formula injection in exported values', () => {
    capturedBlobs = [];
    performExport([makeLog({ ticketId: '=CMD|calc' })], 'report', 'csv');
    const rows = capturedBlobs[0].parts[0].split('\n');
    expect(rows[1]).toMatch(/^"'=/);
  });
});
