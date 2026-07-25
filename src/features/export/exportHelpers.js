import toast from 'react-hot-toast';
import { formatTime, escapeCSV } from '../../utils/helpers.js';

function formatTimestamp(ts) {
  if (!ts) return null;
  try {
    return new Date(ts).toISOString();
  } catch {
    return null;
  }
}

function formatLocaleTimestamp(ts) {
  if (!ts) return 'N/A';
  try {
    return new Date(ts).toLocaleString('en-US');
  } catch {
    return 'N/A';
  }
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function performExport(logsToExport, reportName, format) {
  const today = new Date().toISOString().split('T')[0];

  try {
    if (format === 'json') {
      const filename = `${reportName}-${today}.json`;
      const jsonData = logsToExport.map((log) => ({
        ticketId: log.ticketId,
        timeWorked: formatTime(log.accumulatedMs),
        timeWorkedMs: log.accumulatedMs,
        note: log.note || '',
        startDateTime: formatTimestamp(log.createdAt),
        finishedDateTime: formatTimestamp(log.endTime),
        sessionId: log.id,
        status: log.status,
        submissionDate: formatTimestamp(log.submissionDate),
      }));
      downloadBlob(JSON.stringify(jsonData, null, 2), filename, 'application/json');
    } else {
      const filename = `${reportName}-${today}.csv`;
      const headers = [
        'Ticket ID',
        'Time Worked (HH:MM:SS)',
        'Note',
        'Start Date/Time',
        'Finished Date/Time',
        'Session ID',
        'Status',
        'Submission Date',
      ];
      const csvRows = logsToExport.map((log) => {
        const formattedDuration = formatTime(log.accumulatedMs);
        const startTime = formatLocaleTimestamp(log.createdAt);
        const finishTime = formatLocaleTimestamp(log.endTime);
        const submissionDate = formatLocaleTimestamp(log.submissionDate);
        return [
          escapeCSV(log.ticketId),
          escapeCSV(formattedDuration),
          escapeCSV(log.note || ''),
          escapeCSV(startTime),
          escapeCSV(finishTime),
          escapeCSV(log.id),
          escapeCSV(log.status),
          escapeCSV(submissionDate),
        ].join(',');
      });

      const csvContent = [headers.join(','), ...csvRows].join('\n');
      downloadBlob(csvContent, filename, 'text/csv;charset=utf-8;');
    }
  } catch (error) {
    if (import.meta.env.DEV) console.error('Export Failed:', error);
    toast.error('Export failed');
    throw error;
  }
}
