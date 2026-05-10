import { sanitizeTicketId, sanitizeNote, escapeCSV } from './helpers';

test('sanitizeTicketId strips HTML', () => expect(sanitizeTicketId('<script>')).not.toContain('<'));
test('sanitizeNote strips unprintable control chars and relies on React escaping', () => expect(sanitizeNote('hello\x00world')).toBe('helloworld'));
test('escapeCSV neutralises formula injection', () => expect(escapeCSV('=CMD|...')).toMatch(/^"'/));

