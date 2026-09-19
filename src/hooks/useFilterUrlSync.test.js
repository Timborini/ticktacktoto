import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFilterUrlSync, readFiltersFromUrl } from './useFilterUrlSync.js';

const setUrl = (search) => {
  window.history.replaceState({}, '', `/${search}`);
};

beforeEach(() => {
  setUrl('');
});

describe('readFiltersFromUrl', () => {
  test('reads all valid params', () => {
    setUrl('?shareId=team_share-1&status=Open&search=PROJ-1&dateStart=2026-01-01&dateEnd=2026-01-31');
    const f = readFiltersFromUrl();
    expect(f).toEqual({
      shareId: 'team_share-1',
      status: 'Open',
      search: 'PROJ-1',
      dateStart: '2026-01-01',
      dateEnd: '2026-01-31',
    });
  });

  test('rejects an invalid status value', () => {
    setUrl('?status=Bogus');
    expect(readFiltersFromUrl().status).toBe(null);
  });

  test('rejects a shareId with spaces or unsafe characters', () => {
    setUrl('?shareId=bad%20id!');
    expect(readFiltersFromUrl().shareId).toBe(null);
  });

  test('rejects an overlong shareId', () => {
    setUrl(`?shareId=${'a'.repeat(65)}`);
    expect(readFiltersFromUrl().shareId).toBe(null);
  });

  test('rejects malformed dates', () => {
    setUrl('?dateStart=2026-1-1&dateEnd=01/31/2026');
    const f = readFiltersFromUrl();
    expect(f.dateStart).toBe(null);
    expect(f.dateEnd).toBe(null);
  });

  test('sanitizes the search value', () => {
    setUrl('?search=<script>');
    expect(readFiltersFromUrl().search).toBe('script');
  });

  test('ignores an overlong search value', () => {
    setUrl(`?search=${'x'.repeat(201)}`);
    expect(readFiltersFromUrl().search).toBe(null);
  });
});

describe('useFilterUrlSync initial state', () => {
  test('seeds filters from the URL', () => {
    setUrl('?status=Closed&search=PROJ-9');
    const { result } = renderHook(() => useFilterUrlSync());
    expect(result.current.statusFilter).toBe('Closed');
    expect(result.current.searchQuery).toBe('PROJ-9');
    expect(result.current.shareId).toBe(null);
  });

  test('defaults to All when no status param', () => {
    const { result } = renderHook(() => useFilterUrlSync());
    expect(result.current.statusFilter).toBe('All');
  });
});
