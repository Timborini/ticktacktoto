import { useState, useRef, useEffect } from "react";
import { X, Check } from 'lucide-react';
import ModalBase from "./ModalBase.jsx";
import { sanitizeTicketId } from "../utils/helpers.js";
import { MAX_TICKET_ID_LENGTH } from "../constants.js";

const ReallocateModal = ({ isOpen, onClose, sessionInfo, allTicketIds, onConfirm }) => {
  const [newTicketId, setNewTicketId] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setNewTicketId('');
    }
  }, [isOpen, sessionInfo]);

  if (!isOpen || !sessionInfo) return null;

  const trimmed = newTicketId.trim();
  const sanitized = sanitizeTicketId(trimmed);
  const isInvalid = trimmed.length > 0 && !sanitized;

  const handleConfirm = () => {
    if (sanitized && sanitized !== sessionInfo.currentTicketId) {
      onConfirm(sessionInfo.sessionId, sanitized);
      onClose();
    }
  };

  // Filter out the current ticket ID from the list of options
  const availableTickets = allTicketIds.filter(id => id !== sessionInfo.currentTicketId);

  return (
    <ModalBase
      isOpen={isOpen && !!sessionInfo}
      onClose={onClose}
      labelledBy="reallocate-title"
      describedBy="reallocate-description"
      initialFocusRef={inputRef}
      sizeClass="max-w-md"
    >
      <h3 id="reallocate-title" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
        Move Session
      </h3>
      <p id="reallocate-description" className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
        Move this session from <strong className="font-mono text-indigo-500">{sessionInfo?.currentTicketId}</strong> to another ticket.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="ticket-reallocate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Move to Ticket (existing or new)
          </label>
          <input
            ref={inputRef}
            id="ticket-reallocate"
            type="text"
            list="reallocate-tickets-datalist"
            value={newTicketId}
            onChange={(e) => setNewTicketId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                e.preventDefault();
                handleConfirm();
              }
            }}
            placeholder="e.g., JIRA-101"
            maxLength={MAX_TICKET_ID_LENGTH}
            aria-invalid={isInvalid}
            aria-describedby={isInvalid ? 'ticket-reallocate-error' : undefined}
            className="w-full p-2 min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
          {isInvalid && (
            <p id="ticket-reallocate-error" className="text-red-500 text-sm mt-1" role="alert">
              Ticket ID contains no valid characters.
            </p>
          )}
          <datalist id="reallocate-tickets-datalist">
            {availableTickets.map(ticketId => (
              <option key={ticketId} value={ticketId} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center space-x-1 px-4 py-2 min-h-[44px] bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!sanitized || sanitized === sessionInfo?.currentTicketId}
          className="flex items-center justify-center space-x-1 px-4 py-2 min-h-[44px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Move Session"
        >
          <Check className="w-4 h-4" />
          <span>Move Session</span>
        </button>
      </div>
    </ModalBase>
  );
};


export default ReallocateModal;
