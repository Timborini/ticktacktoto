import { sanitizeTicketId, sanitizeNote, escapeCSV } from './helpers';

test('sanitizeTicketId strips HTML', () => expect(sanitizeTicketId('<script>')).not.toContain('<'));
test('sanitizeNote blocks javascript: protocol', () => expect(sanitizeNote('javascript:alert(1)')).not.toContain('javascript:'));
test('escapeCSV neutralises formula injection', () => expect(escapeCSV('=CMD|...')).toMatch(/^"'/));
