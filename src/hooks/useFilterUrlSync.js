import { useState, useEffect, useCallback } from 'react';
import { sanitizeTicketId } from '../utils/helpers.js';
import { STATUS_FILTERS } from '../constants.js';

const VALID_STATUSES = Object.values(STATUS_FILTERS);
const SHARE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function useFilterUrlSync() {
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [shareId, setShareId] = useState(null);

  // Read filters from URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    const id = urlParams.get('shareId');
    if (id && SHARE_ID_REGEX.test(id) && id.length <= 100) {
      setShareId(id);
    }

    const urlStatus = urlParams.get('status');
    const urlSearch = urlParams.get('search');
    const urlDateStart = urlParams.get('dateStart');
    const urlDateEnd = urlParams.get('dateEnd');

    if (urlStatus && VALID_STATUSES.includes(urlStatus)) setStatusFilter(urlStatus);
    if (urlSearch && urlSearch.length <= 200) setSearchQuery(sanitizeTicketId(urlSearch));
    if (urlDateStart && DATE_REGEX.test(urlDateStart)) setDateRangeStart(urlDateStart);
    if (urlDateEnd && DATE_REGEX.test(urlDateEnd)) setDateRangeEnd(urlDateEnd);
  }, []);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existingShareId = params.get('shareId');
    const newParams = new URLSearchParams();

    if (existingShareId) newParams.set('shareId', existingShareId);
    if (statusFilter && statusFilter !== STATUS_FILTERS.ALL) newParams.set('status', statusFilter);
    if (searchQuery) newParams.set('search', searchQuery);
    if (dateRangeStart) newParams.set('dateStart', dateRangeStart);
    if (dateRangeEnd) newParams.set('dateEnd', dateRangeEnd);

    const newUrl = newParams.toString()
      ? `${window.location.pathname}?${newParams.toString()}`
      : window.location.pathname;

    window.history.replaceState({}, '', newUrl);
  }, [statusFilter, searchQuery, dateRangeStart, dateRangeEnd]);

  const clearFilters = useCallback(() => {
    setStatusFilter(STATUS_FILTERS.ALL);
    setSearchQuery('');
    setDateRangeStart('');
    setDateRangeEnd('');
  }, []);

  return {
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    dateRangeStart,
    setDateRangeStart,
    dateRangeEnd,
    setDateRangeEnd,
    shareId,
    clearFilters,
  };
}
