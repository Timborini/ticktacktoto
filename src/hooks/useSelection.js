import { useState, useEffect, useCallback } from 'react';

/**
 * Session selection state (single, per-ticket, select-all) plus the set of
 * sessions that were exported but not yet marked submitted, and the combined
 * final id set used by mark-submitted actions.
 */
export function useSelection({
  filteredAndGroupedLogs,
  statusFilter,
  searchQuery,
  dateRangeStart,
  dateRangeEnd,
  dateFilter,
}) {
  const [selectedSessions, setSelectedSessions] = useState(new Set());
  const [exportedSessionIds, setExportedSessionIds] = useState(new Set());

  // Clear selections when filters change
  useEffect(() => {
    setSelectedSessions(new Set());
  }, [statusFilter, searchQuery, dateRangeStart, dateRangeEnd, dateFilter]);

  const handleToggleSelectTicket = useCallback((ticketId) => {
    const group = filteredAndGroupedLogs.find((g) => g.ticketId === ticketId);
    const sessionIds = group ? group.sessions.map((s) => s.id) : [];

    setSelectedSessions((prevSelected) => {
      const newSelected = new Set(prevSelected);
      const allSelected = sessionIds.length > 0 && sessionIds.every((id) => prevSelected.has(id));
      sessionIds.forEach((id) => {
        if (allSelected) newSelected.delete(id);
        else newSelected.add(id);
      });
      return newSelected;
    });
  }, [filteredAndGroupedLogs]);

  const handleToggleSelectSession = useCallback((sessionId) => {
    setSelectedSessions((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(sessionId)) {
        newSelected.delete(sessionId);
      } else {
        newSelected.add(sessionId);
      }
      return newSelected;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    const allVisibleSessionIds = filteredAndGroupedLogs.flatMap((g) => g.sessions.map((s) => s.id));
    const allSelected = allVisibleSessionIds.length > 0 &&
      allVisibleSessionIds.every((id) => selectedSessions.has(id));

    if (allSelected) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(allVisibleSessionIds));
    }
  }, [filteredAndGroupedLogs, selectedSessions]);

  const getFinalSessionIds = useCallback(() => {
    const finalSessionIds = new Set(selectedSessions);
    exportedSessionIds.forEach((sessionId) => finalSessionIds.add(sessionId));
    return finalSessionIds;
  }, [selectedSessions, exportedSessionIds]);

  return {
    selectedSessions,
    setSelectedSessions,
    exportedSessionIds,
    setExportedSessionIds,
    handleToggleSelectTicket,
    handleToggleSelectSession,
    handleToggleSelectAll,
    getFinalSessionIds,
  };
}
