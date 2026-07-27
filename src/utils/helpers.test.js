import { describe, test, expect } from 'vitest';
import {
  formatTime,
  sanitizeTicketId,
  sanitizeNote,
  escapeCSV,
  parseLocalDate,
  toLocalDateString,
} from './helpers';

describe('formatTime', () => {
  test('formats hours, minutes, seconds', () => {
    expect(formatTime(3661000)).toBe('01:01:01');
  });
  test('clamps negative values to zero', () => {
    expect(formatTime(-5000)).toBe('00:00:00');
  });
  test('handles values over 24 hours', () => {
    expect(formatTime(90061000)).toBe('25:01:01');
  });
});

describe('sanitizeTicketId', () => {
  test('strips HTML', () => {
    expect(sanitizeTicketId('<script>')).not.toContain('<');
  });
  test('keeps common ticket punctuation', () => {
    expect(sanitizeTicketId('PROJ-1234_a/b')).toBe('PROJ-1234_a/b');
  });
  test('trims and caps length at 200', () => {
    expect(sanitizeTicketId(`  ${'x'.repeat(300)}  `)).toHaveLength(200);
  });
  test('handles empty input', () => {
    expect(sanitizeTicketId('')).toBe('');
    expect(sanitizeTicketId(null)).toBe('');
  });
});

describe('sanitizeNote', () => {
  test('strips unprintable control chars and relies on React escaping', () => {
    expect(sanitizeNote('hello\x00world')).toBe('helloworld');
  });
  test('keeps newlines and unicode letters', () => {
    expect(sanitizeNote('line one\nline two üñï')).toBe('line one\nline two üñï');
  });
  test('caps length at 5000', () => {
    expect(sanitizeNote('a'.repeat(6000))).toHaveLength(5000);
  });
});

describe('escapeCSV', () => {
  test('neutralises formula injection', () => {
    expect(escapeCSV('=CMD|...')).toMatch(/^"'/);
    expect(escapeCSV('+1+1')).toMatch(/^"'/);
    expect(escapeCSV('@SUM(A1)')).toMatch(/^"'/);
    expect(escapeCSV('-2+3')).toMatch(/^"'/);
  });
  test('neutralises injection hidden behind leading whitespace', () => {
    expect(escapeCSV('   =1+1')).toMatch(/^"'/);
    expect(escapeCSV('\t=1+1')).toMatch(/^"'/);
  });
  test('doubles embedded quotes', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });
  test('leaves safe values quoted but unmodified', () => {
    expect(escapeCSV('PROJ-123')).toBe('"PROJ-123"');
  });
});

describe('parseLocalDate', () => {
  test('parses YYYY-MM-DD as local midnight', () => {
    const d = parseLocalDate('2026-07-27');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(27);
    expect(d.getHours()).toBe(0);
  });
  test('rejects invalid formats', () => {
    expect(parseLocalDate('07/27/2026')).toBeNull();
    expect(parseLocalDate('')).toBeNull();
    expect(parseLocalDate('2026-7-2')).toBeNull();
  });
});

describe('toLocalDateString', () => {
  test('round-trips with parseLocalDate', () => {
    const d = parseLocalDate('2026-01-05');
    expect(toLocalDateString(d.getTime())).toBe('2026-01-05');
  });
  test('zero-pads month and day', () => {
    expect(toLocalDateString(new Date(2026, 0, 5).getTime())).toBe('2026-01-05');
  });
});
