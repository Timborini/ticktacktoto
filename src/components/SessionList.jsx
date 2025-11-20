import React from 'react';
import { List, Check, RotateCcw, Trash2, Download } from 'lucide-react';
import TicketRow from './TicketRow';
import ExportMenu from './ExportMenu';

const SessionList = ({
    logs,
    filteredAndGroupedLogs,
    selectedSessions,
    setSelectedSessions,
    selectedTickets,
    handleToggleSelectAll,
    handleToggleSelectTicket,
    statusFilter,
    setStatusFilter,
    setDateFilter,
    handleBulkStatusChange,
    handleBulkDelete,
    handleMarkAsUnsubmitted,
    handleCreateDraft,
    handleExport,
    exportOption,
    setExportOption,
    exportFormat,
    setExportFormat,
    exportFocusIndex,
    setExportFocusIndex,
    exportButtonRef,
    isLoading,
    isActionDisabled,
    // TicketRow props
    editingTicketId,
    editingTicketValue,
    setEditingTicketId,
    setEditingTicketValue,
    handleUpdateTicketId,
    editingSessionNote,
    editingSessionNoteValue,
    setEditingSessionNote,
    setEditingSessionNoteValue,
    handleUpdateSessionNote,
    handleDeleteClick,
    handleReallocateSession,
    handleCloseTicket,
    handleReopenTicket,
    handleContinueTicket
}) => {

    return (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl">
            {/* Bulk Actions Bar */}
            {selectedSessions.size > 0 && (
                <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={selectedSessions.size > 0}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    const allSessions = new Set();
                                    filteredAndGroupedLogs.forEach(group => {
                                        group.sessions.forEach(session => allSessions.add(session.id));
                                    });
                                    setSelectedSessions(allSessions);
                                } else {
                                    setSelectedSessions(new Set());
                                }
                            }}
                            className="w-5 h-5 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                            {selectedSessions.size} session(s) selected
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => handleBulkStatusChange('submitted')}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                            <Check className="h-4 w-4" />
                            Mark Submitted
                        </button>
                        <button
                            onClick={() => handleBulkStatusChange('unsubmitted')}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-yellow-500 text-white text-sm font-semibold rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Mark Unsubmitted
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                        <button
                            onClick={() => setSelectedSessions(new Set())}
                            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}

            {/* Compact Header */}
            <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                <div className="flex items-center gap-4">
                    <h2 className="flex items-center text-xl font-semibold text-gray-800 dark:text-gray-200">
                        <List className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
                        Time Log History
                    </h2>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {filteredAndGroupedLogs.length} tickets • {filteredAndGroupedLogs.reduce((sum, g) => sum + g.sessions.length, 0)} sessions
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {statusFilter === 'Submitted' ? (
                        <button
                            onClick={handleMarkAsUnsubmitted}
                            disabled={isActionDisabled}
                            className="px-4 py-2 bg-yellow-500 text-white font-semibold text-sm rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
                        >
                            Unsubmit
                        </button>
                    ) : (
                        <button
                            onClick={handleCreateDraft}
                            disabled={isActionDisabled}
                            className="px-4 py-2 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            AI Draft
                        </button>
                    )}
                    <div className="relative export-dropdown">
                        <button
                            ref={exportButtonRef}
                            onClick={() => {
                                if (exportOption) {
                                    setExportOption('');
                                    setExportFormat('');
                                    setExportFocusIndex(0);
                                } else {
                                    setExportOption('menu');
                                }
                            }}
                            className="w-10 h-10 flex items-center justify-center bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            aria-label="Export"
                            aria-expanded={exportOption === 'menu'}
                            aria-haspopup="true"
                        >
                            <Download className="h-5 w-5" />
                        </button>

                        {exportOption === 'menu' && (
                            <ExportMenu
                                isOpen={exportOption === 'menu'}
                                onClose={() => { setExportOption(''); setExportFormat(''); setExportFocusIndex(0); }}
                                buttonRef={exportButtonRef}
                                onChooseFormat={(fmt) => { setExportFormat(fmt); setExportFocusIndex(0); }}
                                onExportScope={(scope) => {
                                    handleExport(scope, exportFormat);
                                    setExportOption(''); setExportFormat(''); setExportFocusIndex(0);
                                }}
                                canExportSelected={!isActionDisabled}
                                canExportFiltered={filteredAndGroupedLogs.length > 0}
                                canExportAll={logs.length > 0}
                                exportFormat={exportFormat}
                                focusIndex={exportFocusIndex}
                                setFocusIndex={setExportFocusIndex}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Select All Checkbox */}
            <div className="flex items-center pb-4 border-b border-gray-200 dark:border-gray-700">
                <input
                    type="checkbox"
                    id="select-all-checkbox"
                    checked={filteredAndGroupedLogs.length > 0 && filteredAndGroupedLogs.every(g => selectedTickets.has(g.ticketId))}
                    onChange={handleToggleSelectAll}
                    disabled={filteredAndGroupedLogs.length === 0}
                    className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="select-all-checkbox" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select All Visible
                </label>
            </div>

            {/* Empty State */}
            {filteredAndGroupedLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <List className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {logs.length === 0 ? "No time logs yet" : "No logs match your filters"}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 max-w-sm">
                        {logs.length === 0
                            ? "Start tracking time by entering a ticket ID and clicking START above"
                            : "Try adjusting your filters or clearing them to see more results"}
                    </p>
                    {(statusFilter !== 'All' || setDateFilter) && (
                        <button
                            onClick={() => { setStatusFilter('All'); setDateFilter(''); }}
                            className="mt-4 px-4 py-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors text-sm font-medium"
                        >
                            Clear All Filters
                        </button>
                    )}
                </div>
            )}

            {/* Compact Table Layout */}
            <div className="overflow-x-auto pt-4">
                <table className="w-full border-collapse table-fixed min-w-[42rem] md:min-w-[56rem]">
                    {/* Table Header */}
                    <thead>
                        <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-2 w-8">
                                <input
                                    type="checkbox"
                                    checked={filteredAndGroupedLogs.length > 0 && filteredAndGroupedLogs.every(g => selectedTickets.has(g.ticketId))}
                                    onChange={handleToggleSelectAll}
                                    disabled={filteredAndGroupedLogs.length === 0}
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                                />
                            </th>
                            <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 w-48">Ticket ID</th>
                            <th className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 w-24">Total Time</th>
                            <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 w-20">Sessions</th>
                            <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 w-16">Status</th>
                            <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndGroupedLogs.map((group) => (
                            <TicketRow
                                key={group.ticketId}
                                group={group}
                                isSelected={selectedTickets.has(group.ticketId)}
                                onToggleSelectTicket={handleToggleSelectTicket}
                                isFullySubmitted={group.sessions.every(s => s.status === 'submitted')}
                                onReopenTicket={handleReopenTicket}
                                onCloseTicket={handleCloseTicket}
                                onContinueTicket={handleContinueTicket}
                                onReallocateSession={handleReallocateSession}
                                editingTicketId={editingTicketId}
                                editingTicketValue={editingTicketValue}
                                setEditingTicketId={setEditingTicketId}
                                setEditingTicketValue={setEditingTicketValue}
                                handleUpdateTicketId={handleUpdateTicketId}
                                sessions={group.sessions}
                                editingSessionNote={editingSessionNote}
                                editingSessionNoteValue={editingSessionNoteValue}
                                setEditingSessionNote={setEditingSessionNote}
                                setEditingSessionNoteValue={setEditingSessionNoteValue}
                                handleUpdateSessionNote={handleUpdateSessionNote}
                                handleDeleteClick={handleDeleteClick}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default SessionList;
