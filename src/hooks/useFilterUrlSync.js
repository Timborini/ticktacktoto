import { useState, useEffect, useCallback } from 'react';
import { sanitizeTicketId } from '../utils/helpers.js';
import { STATUS_FILTERS, MAX_SHARE_ID_LENGTH } from '../constants.js';

const VALID_STATUSES = Object.values(STATUS_FILTERS);
const SHARE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Read validated filter values from the current URL (used as lazy initial state)
function readFiltersFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const filters = { shareId: null, status: null, search: null, dateStart: null, dateEnd: null };

  const id = urlParams.get('shareId');
  if (id && SHARE_ID_REGEX.test(id) && id.length <= MAX_SHARE_ID_LENGTH) filters.shareId = id;

  const urlStatus = urlParams.get('status');
  if (urlStatus && VALID_STATUSES.includes(urlStatus)) filters.status = urlStatus;

  const urlSearch = urlParams.get('search');
  if (urlSearch && urlSearch.length <= 200) filters.search = sanitizeTicketId(urlSearch);

  const urlDateStart = urlParams.get('dateStart');
  if (urlDateStart && DATE_REGEX.test(urlDateStart)) filters.dateStart = urlDateStart;

  const urlDateEnd = urlParams.get('dateEnd');
  if (urlDateEnd && DATE_REGEX.test(urlDateEnd)) filters.dateEnd = urlDateEnd;

  return filters;
}

export function useFilterUrlSync() {
  const [statusFilter, setStatusFilter] = useState(() => readFiltersFromUrl().status || STATUS_FILTERS.ALL);
  const [searchQuery, setSearchQuery] = useState(() => readFiltersFromUrl().search || '');
  const [dateRangeStart, setDateRangeStart] = useState(() => readFiltersFromUrl().dateStart || '');
  const [dateRangeEnd, setDateRangeEnd] = useState(() => readFiltersFromUrl().dateEnd || '');
  const [shareId] = useState(() => readFiltersFromUrl().shareId);

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
