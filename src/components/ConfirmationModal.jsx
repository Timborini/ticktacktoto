import React, { useRef } from "react";
import { X, Check } from 'lucide-react';
import ModalBase from "./ModalBase.jsx";

/**
 * Custom Confirmation Modal Component with Accessibility
 */
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm" }) => {
  const confirmButtonRef = useRef(null);

  // Focus and Escape are handled by ModalBase

  if (!isOpen) return null;

  const confirmButtonColor = confirmText === "Delete" ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700";

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={confirmText === "Delete" ? onCancel : onCancel}
      labelledBy="modal-title"
      describedBy="modal-description"
      initialFocusRef={confirmButtonRef}
      sizeClass="max-w-sm"
      backdropCanClose={confirmText !== "Delete"}
    >
      <h3
        id="modal-title"
        className={`text-xl font-bold ${confirmText === "Delete" ? "text-red-600" : "text-indigo-600 dark:text-indigo-400"} mb-3`}
      >
        {title}
      </h3>
      <div id="modal-description" className="text-gray-700 dark:text-gray-300 mb-6">{message}</div>
      <div className="flex justify-end space-x-3">
        <button
          type="button"
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
          className={`flex items-center space-x-1 px-4 py-2 min-h-[44px] text-white font-semibold rounded-lg transition-colors active:scale-[0.98] ${confirmButtonColor}`}
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
