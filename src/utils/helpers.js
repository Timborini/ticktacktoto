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
 * Security: Escape CSV data to prevent formula injection attacks
 * @param {string} data - Raw data to be exported to CSV
 * @returns {string} Safely escaped CSV data
 */
export const escapeCSV = (data) => {
  const str = String(data);
  // Prevent CSV injection by prefixing dangerous characters with a single quote
  if (str.match(/^[=+\-@\t\r]/)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
};
