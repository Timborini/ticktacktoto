/**
 * Utility function to format milliseconds into HH:MM:SS
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time string
 */
export const formatTime = (ms) => {
  if (ms < 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map(unit => String(unit).padStart(2, '0'))
    .join(':');
};

/**
 * Security: Sanitize ticket ID input to prevent XSS and injection attacks.
 * Uses an allowlist approach — only permits safe characters.
 * @param {string} ticketId - Raw ticket ID input
 * @returns {string} Sanitized ticket ID
 */
export const sanitizeTicketId = (ticketId) => {
  if (!ticketId) return '';
  return ticketId
    .trim()
    .replace(/[^\w\s\-_.#@/()[\]{}:,]/g, '') // Allowlist: word chars, spaces, common ticket ID punctuation
    .substring(0, 200); // Limit length to prevent abuse
};

/**
 * Security: Sanitize note input to prevent XSS attacks.
 * CRITICAL: This allows most characters because we strictly rely on React's
 * automatic plain-text escaping. NEVER use dangerouslySetInnerHTML with this value.
 * @param {string} note - Raw note input
 * @returns {string} Sanitized note
 */
export const sanitizeNote = (note) => {
  if (!note) return '';
  return note
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{M}\p{S}\n\r\t]/gu, '') // Allowlist approach
    .substring(0, 5000); // Limit length to prevent abuse
};

/**
 * Parse a 'YYYY-MM-DD' string as local midnight (not UTC).
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date|null} Date at local midnight, or null if invalid
 */
export const parseLocalDate = (dateStr) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Format a timestamp as a local 'YYYY-MM-DD' string (day boundary in the
 * user's timezone, not UTC).
 * @param {number} ts - Milliseconds timestamp
 * @returns {string} Local date string
 */
export const toLocalDateString = (ts) => {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Security: Escape CSV data to prevent formula injection attacks
 * @param {string} data - Raw data to be exported to CSV
 * @returns {string} Safely escaped CSV data
 */
export const escapeCSV = (data) => {
  const str = String(data);
  // Prevent CSV injection: check for dangerous characters even after leading
  // whitespace, which spreadsheets may strip before evaluating formulas
  const withoutLeadingWhitespace = str.replace(/^[\s\u00A0]+/u, '');
  if (/^[=+\-@\t\r]/.test(withoutLeadingWhitespace)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
};
