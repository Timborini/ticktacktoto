import { useRef } from "react";
import { X, Check } from 'lucide-react';
import ModalBase from "./ModalBase.jsx";

/**
 * Custom Confirmation Modal Component with Accessibility
 */
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", confirmDisabled = false }) => {
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);

  // Focus and Escape are handled by ModalBase

  if (!isOpen) return null;

  const isDestructive = confirmText === "Delete";
  const confirmButtonColor = isDestructive ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700";

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onCancel}
      labelledBy="modal-title"
      describedBy="modal-description"
      initialFocusRef={isDestructive ? cancelButtonRef : confirmButtonRef}
      sizeClass="max-w-sm"
      backdropCanClose={!isDestructive}
    >
      <h3
        id="modal-title"
        className={`text-xl font-bold ${isDestructive ? "text-red-600" : "text-indigo-600 dark:text-indigo-400"} mb-3`}
      >
        {title}
      </h3>
      <div id="modal-description" className="text-gray-700 dark:text-gray-300 mb-6">{message}</div>
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          ref={cancelButtonRef}
          onClick={onCancel}
          className="flex items-center space-x-1 px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </button>
        <button
          type="button"
          ref={confirmButtonRef}
          onClick={onConfirm}
          disabled={confirmDisabled}
          className={`flex items-center space-x-1 px-4 py-2 min-h-[44px] text-white font-semibold rounded-lg transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonColor}`}
          aria-label={confirmText}
        >
          <Check className="w-4 h-4" />
          <span>{confirmText}</span>
        </button>
      </div>
    </ModalBase>
  );
};


export default ConfirmationModal;
