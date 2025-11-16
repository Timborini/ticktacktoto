import React, { useEffect, useRef } from 'react';

/**
 * Accessible modal base with focus trapping and restore-focus behavior.
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - labelledBy: string (id of title element)
 * - describedBy?: string (id of description element)
 * - initialFocusRef?: React.RefObject
 * - children: React.ReactNode
 * - sizeClass?: string (e.g., 'max-w-sm', 'max-w-md')
 * - backdropCanClose?: boolean (default: true)
 */
const ModalBase = ({
  isOpen,
  onClose,
  labelledBy,
  describedBy,
  initialFocusRef,
  children,
  sizeClass = 'max-w-md',
  backdropCanClose = true,
}) => {
  const modalRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement;

    // Focus the initial element or the first focusable
    const focusTarget =
      initialFocusRef?.current ||
      modalRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    if (focusTarget && focusTarget.focus) {
      setTimeout(() => focusTarget.focus(), 0);
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const list = Array.from(focusables);
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, initialFocusRef]);

  useEffect(() => {
    if (!isOpen) {
      // Restore focus to previously focused element
      const el = previouslyFocusedRef.current;
      if (el && el.focus) {
        setTimeout(() => el.focus(), 0);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4"
      onClick={(e) => {
        if (!backdropCanClose) return;
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`bg-white dark:bg-gray-800 rounded-2xl p-6 w-full ${sizeClass} shadow-2xl transform transition-all scale-100`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default ModalBase;


