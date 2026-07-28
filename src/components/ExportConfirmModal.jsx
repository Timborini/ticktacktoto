import { Check, Download, X } from 'lucide-react';
import ModalBase from "./ModalBase.jsx";

const ExportConfirmModal = ({ isOpen, onClose, pendingExport, isLoading, onConfirmExport }) => {
  if (!pendingExport) return null;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="export-confirm-title"
      describedBy="export-confirm-description"
      sizeClass="max-w-sm"
      backdropCanClose={!isLoading}
    >
      <h3 id="export-confirm-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
        Export Time Entries
      </h3>
      <p id="export-confirm-description" className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        You're about to export <strong>{pendingExport.logs.length} session(s)</strong>,
        including <strong>{pendingExport.unsubmittedCount} unsubmitted</strong>.
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Would you like to mark them as submitted? Submitted items are hidden by default —
        you can undo for a few seconds afterwards.
      </p>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => onConfirmExport(true)}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-2 min-h-[44px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="h-4 w-4 mr-2" />
          Export & Mark Submitted
        </button>

        <button
          onClick={() => onConfirmExport(false)}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Only
        </button>

        <button
          onClick={onClose}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-2 min-h-[44px] text-gray-600 dark:text-gray-400 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </button>
      </div>
    </ModalBase>
  );
};

export default ExportConfirmModal;
