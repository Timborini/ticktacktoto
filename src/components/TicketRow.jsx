import React, { memo } from 'react';
import { Pencil, Check, Repeat, Lock, CornerUpRight, Trash2, BookOpen, Clock, Calendar } from 'lucide-react';
import { format } from './formatters';

const TicketRow = memo(function TicketRow({
  group,
  isSelected,
  onToggleSelectTicket,
  isFullySubmitted,
  onReopenTicket,
  onCloseTicket,
  onContinueTicket,
  onReallocateSession,
  editingTicketId,
  editingTicketValue,
  setEditingTicketId,
  setEditingTicketValue,
  handleUpdateTicketId,
  sessions,
  editingSessionNote,
  editingSessionNoteValue,
  setEditingSessionNote,
  setEditingSessionNoteValue,
  handleUpdateSessionNote,
  handleDeleteClick,
  handleDeleteTicketClick
}) {
  return (
    <div className={`group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ${isSelected ? 'ring-2 ring-indigo-500 border-transparent' : ''}`}>

      {/* Card Header - Ticket Info */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl">

        {/* Left: Checkbox & Ticket ID */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <input
            type="checkbox"
            aria-label={`Select ticket ${group.ticketId}`}
            checked={isSelected}
            onChange={() => onToggleSelectTicket(group.ticketId)}
            className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />

          <div className="flex items-center gap-2 min-w-0 flex-1">
            {editingTicketId === group.ticketId ? (
              <input
                type="text"
                value={editingTicketValue}
                onChange={(e) => setEditingTicketValue(e.target.value)}
                onBlur={() => handleUpdateTicketId(group.ticketId, editingTicketValue)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    e.preventDefault();
                    handleUpdateTicketId(group.ticketId, editingTicketValue);
                  } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    e.preventDefault();
                    setEditingTicketId(null);
                  }
                }}
                className="text-lg font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-gray-700 rounded px-2 py-1 border-2 border-indigo-500 w-full max-w-[200px]"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-2 min-w-0 group/edit">
                <span
                  className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate"
                  title={group.ticketId}
                >
                  {group.ticketId}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTicketId(group.ticketId);
                    setEditingTicketValue(group.ticketId);
                  }}
                  className="opacity-0 group-hover/edit:opacity-100 focus:opacity-100 p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                  title="Edit Ticket ID"
                  aria-label="Edit Ticket ID"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Status, Time, Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-6">

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${group.isClosed
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              }`}>
              {group.isClosed ? 'Closed' : 'Open'}
            </span>
            {isFullySubmitted && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                <Check className="w-3 h-3" />
                Submitted
              </span>
            )}
          </div>

          {/* Total Time */}
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 px-2 sm:px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="font-mono font-bold text-lg">
              {format.duration(group.totalDurationMs)}
            </span>
          </div>

          {/* Ticket Actions */}
          <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-2 sm:pl-4">
            {group.isClosed ? (
              <button
                type="button"
                onClick={() => onReopenTicket(group.ticketId)}
                className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                title="Reopen Ticket"
                aria-label="Reopen Ticket"
              >
                <Repeat className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onCloseTicket(group.ticketId)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Close Ticket"
                  aria-label="Close Ticket"
                >
                  <Lock className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onContinueTicket(group.ticketId)}
                  className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                  title="Start New Session"
                  aria-label="Start New Session"
                >
                  <Repeat className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDeleteTicketClick(group.ticketId); }}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete Ticket & All Sessions"
              aria-label="Delete Ticket"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Card Body - Sessions List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {sessions.length > 0 ? (
          sessions.map((session) => (
            <div key={session.id} className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group/session">

              {/* Session Note */}
              <div className="flex-1 min-w-0 flex items-start gap-3">
                <BookOpen className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {editingSessionNote === session.id ? (
                    <input
                      type="text"
                      value={editingSessionNoteValue}
                      onChange={(e) => setEditingSessionNoteValue(e.target.value)}
                      onBlur={() => handleUpdateSessionNote(session.id, editingSessionNoteValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation();
                          e.preventDefault();
                          handleUpdateSessionNote(session.id, editingSessionNoteValue);
                        } else if (e.key === 'Escape') {
                          e.stopPropagation();
                          e.preventDefault();
                          setEditingSessionNote(null);
                          setEditingSessionNoteValue('');
                        }
                      }}
                      placeholder="Add session note..."
                      maxLength={5000}
                      className="w-full text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-600 rounded px-2 py-1 border border-indigo-300 focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                  ) : (
                    <div className="group/note relative pr-6">
                      <p
                        className="text-sm text-gray-600 dark:text-gray-300 truncate cursor-text"
                        onClick={() => {
                          setEditingSessionNote(session.id);
                          setEditingSessionNoteValue(session.note || '');
                        }}
                        title={session.note || 'No notes'}
                      >
                        {session.note || <span className="italic text-gray-400">No notes added...</span>}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSessionNote(session.id);
                          setEditingSessionNoteValue(session.note || '');
                        }}
                        className="absolute right-0 top-0 opacity-0 group-hover/note:opacity-100 p-0.5 text-gray-400 hover:text-indigo-600 transition-all"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Session Meta & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-4 pl-7 sm:pl-0">
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    <Clock className="w-3 h-3" />
                    {format.duration(session.accumulatedMs)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format.dateShort(session.endTime)}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/session:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => onReallocateSession(session.id, group.ticketId)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                    title="Reallocate Session"
                    aria-label="Reallocate Session"
                  >
                    <CornerUpRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(session)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Delete Session"
                    aria-label="Delete Session"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

            </div>
          ))
        ) : (
          <div className="p-4 text-center text-sm text-gray-400 italic">
            No sessions recorded for this ticket.
          </div>
        )}
      </div>
    </div>
  );
});

export default TicketRow;
