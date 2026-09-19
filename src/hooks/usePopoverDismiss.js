import { useEffect, useRef } from 'react';

/**
 * Accessibility behavior for a lightweight popover panel:
 * - Escape closes it.
 * - Pointer-down outside the panel (and trigger) closes it.
 * - On open, focus moves into the panel; on close, focus returns to the trigger.
 * Pair with aria-expanded on the trigger and a panel with tabIndex={-1}.
 *
 * Refs are created by the caller (useRef) and passed in so ref usage stays
 * local to the component that renders the panel and trigger.
 */
export function usePopoverDismiss({ isOpen, onClose, panelRef, triggerRef }) {
  const previouslyFocusedRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    previouslyFocusedRef.current = document.activeElement;

    const panel = panelRef.current;
    if (panel) {
      if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
      panel.focus({ preventScroll: true });
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };

    const handlePointerDown = (event) => {
      const target = event.target;
      if (panel && !panel.contains(target)) {
        if (triggerRef.current && triggerRef.current.contains(target)) return;
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('touchstart', handlePointerDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('touchstart', handlePointerDown, true);
      const previous = previouslyFocusedRef.current;
      if (previous && typeof previous.focus === 'function') {
        try {
          previous.focus({ preventScroll: true });
        } catch {
          previous.focus();
        }
      }
    };
  }, [isOpen, panelRef, triggerRef]);

  return null;
}
