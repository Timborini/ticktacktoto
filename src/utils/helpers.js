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
 * Security: Sanitize ticket ID input to prevent XSS and injection attacks
 * @param {string} ticketId - Raw ticket ID input
 * @returns {string} Sanitized ticket ID
 */
export const sanitizeTicketId = (ticketId) => {
  if (!ticketId) return '';
  return ticketId
    .trim()
    .replace(/[<>]/g, '') // Remove potentially dangerous HTML characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .substring(0, 200); // Limit length to prevent abuse
};

/**
 * Security: Sanitize note input to prevent XSS attacks
 * @param {string} note - Raw note input
 * @returns {string} Sanitized note
 */
export const sanitizeNote = (note) => {
  if (!note) return '';
  return note
    .replace(/[<>]/g, '') // Remove potentially dangerous HTML characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
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
