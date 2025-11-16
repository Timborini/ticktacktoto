import React, { memo } from 'react';
import { Pencil, Check, Repeat, Lock, CornerUpRight, Trash2, BookOpen } from 'lucide-react';
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
}) {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <td className="py-3 px-2">
        <input
          type="checkbox"
          aria-label={`Select ticket ${group.ticketId}`}
          checked={isSelected}
          onChange={() => onToggleSelectTicket(group.ticketId)}
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 text-indigo-600 focus:ring-indigo-500"
        />
      </td>
      <td className="py-3 px-2">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
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
                className="text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-gray-600 rounded px-2 py-1 border border-indigo-300 min-w-0 flex-1"
                autoFocus
              />
            ) : (
              <>
                <span className="text-indigo-700 dark:text-indigo-300 font-bold truncate min-w-0 flex-1">
                  {group.ticketId}
                </span>
                {isFullySubmitted && <Check className="w-4 h-4 text-green-500 flex-shrink-0" title="All sessions submitted" aria-label="All sessions submitted"/>}
                <button
                  type="button"
                  onClick={() => {
                    setEditingTicketId(group.ticketId);
                    setEditingTicketValue(group.ticketId);
                  }}
                  className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-shrink-0"
                  title="Edit Ticket ID"
                  aria-label="Edit Ticket ID"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
          {sessions.length > 0 && (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                  <BookOpen className="h-3 w-3 flex-shrink-0"/>
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
                      className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-600 rounded px-2 py-1 border border-gray-300 dark:border-gray-500 min-w-0 flex-1"
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="truncate flex-1">{session.note || 'No notes'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSessionNote(session.id);
                          setEditingSessionNoteValue(session.note || '');
                        }}
                        className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-shrink-0"
                        title="Edit Session Note"
                        aria-label="Edit Session Note"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="py-3 px-2 text-right">
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono font-bold text-indigo-800 dark:text-indigo-200 whitespace-nowrap">
            {format.duration(group.totalDurationMs)}
          </span>
          {sessions.length > 0 && (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div key={session.id} className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {format.duration(session.accumulatedMs)} • {format.dateShort(session.endTime)}
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="py-3 px-2 text-center">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {sessions.length}
        </span>
      </td>
      <td className="py-3 px-2 text-center">
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
          group.isClosed
            ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
            : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
        }`}>
          {group.isClosed ? 'Closed' : 'Open'}
        </span>
      </td>
      <td className="py-3 px-2 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-1">
            {group.isClosed ? (
              <button
                type="button"
                onClick={() => onReopenTicket(group.ticketId)}
                className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
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
                  className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Close Ticket"
                  aria-label="Close Ticket"
                >
                  <Lock className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onContinueTicket(group.ticketId)}
                  className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                  title="Start New Session"
                  aria-label="Start New Session"
                >
                  <Repeat className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          {sessions.length > 0 && (
            <div className="flex flex-col items-center gap-1">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onReallocateSession(session.id, group.ticketId)}
                    className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                    title="Reallocate Session"
                    aria-label="Reallocate Session"
                  >
                    <CornerUpRight className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(session)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Delete Session"
                    aria-label="Delete Session"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
});

export default TicketRow;


