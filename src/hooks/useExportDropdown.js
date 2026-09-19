import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Export dropdown state (open flag, chosen format, keyboard focus index) with
 * click-outside dismissal. The trigger button ref is owned here so focus can
 * be restored to it when the menu closes.
 */
export function useExportDropdown() {
  const [exportOption, setExportOption] = useState('');
  const [exportFormat, setExportFormat] = useState('');
  const [exportFocusIndex, setExportFocusIndex] = useState(0);
  const exportButtonRef = useRef(null);
  const exportOptionRef = useRef('');

  useEffect(() => {
    exportOptionRef.current = exportOption;
  }, [exportOption]);

  // Click-outside dismissal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportOptionRef.current === 'menu' && !event.target.closest('.export-dropdown')) {
        setExportOption('');
        setExportFormat('');
        setExportFocusIndex(0);
      }
    };

    if (exportOption === 'menu') {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportOption]);

  const closeExportMenu = useCallback(() => {
    setExportOption('');
    setExportFormat('');
    setExportFocusIndex(0);
  }, []);

  return {
    exportOption,
    setExportOption,
    exportFormat,
    setExportFormat,
    exportFocusIndex,
    setExportFocusIndex,
    exportButtonRef,
    closeExportMenu,
  };
}
