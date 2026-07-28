import { useRef, useState } from "react";
import { Clipboard, Send, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import ModalBase from "./ModalBase.jsx";

const ReportModal = ({ isOpen, onClose, reportData, ticketId, canMarkSubmitted = false, onMarkSubmitted }) => {
  const copyButtonRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMarkSubmitted = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onMarkSubmitted();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Focus and Escape are handled by ModalBase

  const copyToClipboard = async () => {
    if (!reportData?.text) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(reportData.text);
        toast.success('Copied to clipboard!');
        return;
      }
    } catch { }
    // Fallback method
    try {
      const tempInput = document.createElement('textarea');
      tempInput.value = reportData.text;
      tempInput.setAttribute('readonly', '');
      tempInput.style.position = 'absolute';
      tempInput.style.left = '-9999px';
      document.body.appendChild(tempInput);
      tempInput.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(tempInput);
      if (successful) {
        toast.success('Copied to clipboard!');
      } else {
        toast.error('Copy failed');
      }
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="report-title"
      describedBy="report-description"
      initialFocusRef={copyButtonRef}
      sizeClass="max-w-xl"
    >
      <h3 id="report-title" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center">
        <Send className="w-6 h-6 mr-2" /> AI Prompt for {ticketId}
      </h3>
      <p id="report-description" className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
        Copy this prompt and paste it into your preferred AI chat application.
      </p>

      <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl border border-gray-300 dark:border-gray-600">
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono text-sm">{reportData?.text}</p>
      </div>
      {canMarkSubmitted && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Mark the selected sessions as submitted? Submitted items are hidden by default.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleMarkSubmitted}
              disabled={isSubmitting}
              className="flex items-center justify-center space-x-2 px-4 py-2 min-h-[44px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isSubmitting ? 'Marking…' : 'Mark as Submitted'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
            >
              Keep Unsubmitted
            </button>
          </div>
        </div>
      )}
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <button
          type="button"
          ref={copyButtonRef}
          onClick={copyToClipboard}
          disabled={!reportData?.text}
          className="flex items-center justify-center space-x-2 px-4 py-2 min-h-[44px] bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Copy to Clipboard"
        >
          <Clipboard className="w-4 h-4" />
          <span>Copy to Clipboard</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
          aria-label="Close"
        >
          Close
        </button>
      </div>
    </ModalBase>
  );
};


export default ReportModal;
