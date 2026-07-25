import { useState, useEffect, useCallback } from 'react';
import {
  MAX_RECENT_TICKETS,
  MAX_TICKET_ID_LENGTH,
  STORAGE_KEYS,
} from '../constants.js';

function loadSavedRecentTickets() {
  const saved = localStorage.getItem(STORAGE_KEYS.RECENT_TICKET_IDS);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (
      Array.isArray(parsed) &&
      parsed.every((id) => typeof id === 'string' && id.length <= MAX_TICKET_ID_LENGTH)
    ) {
      return parsed.slice(0, MAX_RECENT_TICKETS);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.error('Error loading recent tickets:', e);
    localStorage.removeItem(STORAGE_KEYS.RECENT_TICKET_IDS);
  }
  return [];
}

export function useRecentTickets() {
  const [recentTicketIds, setRecentTicketIds] = useState(loadSavedRecentTickets);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.RECENT_TICKET_IDS, JSON.stringify(recentTicketIds));
    } catch {
      // Ignore storage errors (e.g., private mode)
    }
  }, [recentTicketIds]);

  const trackTicket = useCallback((ticketId) => {
    if (!ticketId) return;
    setRecentTicketIds((prev) => {
      const next = [ticketId, ...prev.filter((id) => id !== ticketId)].slice(0, MAX_RECENT_TICKETS);
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
  }, []);

  return { recentTicketIds, trackTicket };
}
