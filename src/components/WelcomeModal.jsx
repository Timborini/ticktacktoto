import React, { useRef, useEffect } from "react";
import { InstructionsContent } from "./InstructionsContent.jsx";

const WelcomeModal = ({ isOpen, onClose }) => {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => closeButtonRef.current?.focus(), 100);

      const handleEscape = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        aria-describedby="welcome-description"
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl transform transition-all scale-100 overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="welcome-title" className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">
          Welcome to TickTackToto!
        </h2>
        <p id="welcome-description" className="text-gray-600 dark:text-gray-400 mb-6">
          Here's a quick guide to get you started:
        </p>

        <InstructionsContent />

        <div className="mt-8 flex justify-end">
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="px-6 py-2 min-h-[44px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors active:scale-[0.98]"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
