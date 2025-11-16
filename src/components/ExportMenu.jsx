import React, { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * Accessible export menu (popover) with keyboard navigation.
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - buttonRef: ref to trigger button (for restoring focus)
 * - onChooseFormat: (fmt: 'csv'|'json') => void
 * - onExportScope: (scope: 'selected'|'filtered'|'all') => void
 * - canExportSelected: boolean
 * - canExportFiltered: boolean
 * - canExportAll: boolean
 * - exportFormat: ''|'csv'|'json'
 * - focusIndex: number
 * - setFocusIndex: (n: number) => void
 */
const ExportMenu = ({
  isOpen,
  onClose,
  buttonRef,
  onChooseFormat,
  onExportScope,
  canExportSelected,
  canExportFiltered,
  canExportAll,
  exportFormat,
  focusIndex,
  setFocusIndex,
}) => {
  const menuRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement;
    const first = menuRef.current?.querySelector('button');
    if (first) setTimeout(() => first.focus(), 0);
  }, [isOpen, onClose, setFocusIndex, exportFormat]);

  useEffect(() => {
    if (!isOpen) {
      const el = previouslyFocusedRef.current || buttonRef?.current;
      if (el && el.focus) setTimeout(() => el.focus(), 0);
    }
  }, [isOpen, buttonRef]);

  const handleKey = (e) => {
    // Prevent bubbling to any global handlers
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (exportFormat) {
        onChooseFormat('');
        setFocusIndex(0);
      } else {
        onClose();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Bound focus index based on current view
      const maxIndex = exportFormat ? 2 : 1; // scope view: 3 options (0..2), format view: 2 options (0..1)
      setFocusIndex((n) => (n < maxIndex ? n + 1 : maxIndex));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex((n) => (n > 0 ? n - 1 : 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!exportFormat) {
        const nextFormat = focusIndex === 0 ? 'csv' : 'json';
        onChooseFormat(nextFormat);
        setFocusIndex(0);
      } else {
        const scopes = ['selected', 'filtered', 'all'];
        const scope = scopes[focusIndex] || 'selected';
        const canMap = {
          selected: canExportSelected,
          filtered: canExportFiltered,
          all: canExportAll,
        };
        if (canMap[scope]) {
          onExportScope(scope);
          onClose();
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="export-dropdown absolute top-12 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-[200px]"
      role="menu"
      aria-label="Export options"
      onKeyDown={handleKey}
    >
      {!exportFormat ? (
        <>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
            Choose Format
          </div>
          <button
            onClick={() => {
              onChooseFormat('csv');
              setFocusIndex(0);
            }}
            className={`w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${
              focusIndex === 0 ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
            }`}
            role="menuitem"
            type="button"
          >
            <span className="text-xl">📄</span>
            <span className="font-medium">CSV</span>
          </button>
          <button
            onClick={() => {
              onChooseFormat('json');
              setFocusIndex(0);
            }}
            className={`w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 rounded-b-lg ${
              focusIndex === 1 ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
            }`}
            role="menuitem"
            type="button"
          >
            <span className="text-xl">📋</span>
            <span className="font-medium">JSON</span>
          </button>
        </>
      ) : (
        <>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span>Choose Scope</span>
            <span className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded">
              {exportFormat.toUpperCase()}
            </span>
          </div>
          <button
            onClick={() => {
              onChooseFormat('');
              setFocusIndex(0);
            }}
            className="w-full px-4 py-2 text-left text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 flex items-center gap-1"
            type="button"
          >
            <ChevronLeft className="h-3 w-3" />
            Back to format
          </button>
          <button
            onClick={() => onExportScope('selected')}
            disabled={!canExportSelected}
            className={`w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${
              focusIndex === 0 ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
            }`}
            role="menuitem"
            type="button"
          >
            Selected
          </button>
          <button
            onClick={() => onExportScope('filtered')}
            disabled={!canExportFiltered}
            className={`w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed ${
              focusIndex === 1 ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
            }`}
            role="menuitem"
            type="button"
          >
            Filtered
          </button>
          <button
            onClick={() => onExportScope('all')}
            disabled={!canExportAll}
            className={`w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-b-lg ${
              focusIndex === 2 ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
            }`}
            role="menuitem"
            type="button"
          >
            All Data
          </button>
        </>
      )}
    </div>
  );
};

export default ExportMenu;


