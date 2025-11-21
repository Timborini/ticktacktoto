import React from 'react';
import { List, Check, RotateCcw, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

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
    dateFilter,
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
    handleContinueTicket,
    handleDeleteTicketClick
}) => {

    return (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl">
            {/* Bulk Actions Bar */}
            {selectedSessions.size > 0 && (
                <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between flex-wrap gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg">
                            <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
                            {selectedSessions.size} session{selectedSessions.size !== 1 ? 's' : ''} selected
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => handleBulkStatusChange('submitted')}
                            disabled={isLoading}
                            className="px-3 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                        >
                            <Check className="h-4 w-4" />
                            Mark Submitted
                        </button>
                        <button
                            onClick={() => handleBulkStatusChange('unsubmitted')}
                            disabled={isLoading}
                            className="px-3 py-2 bg-yellow-500 text-white text-sm font-semibold rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Mark Unsubmitted
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            disabled={isLoading}
                            className="px-3 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                        <button
                            onClick={() => setSelectedSessions(new Set())}
                            className="px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-100 dark:border-gray-700 pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <List className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            Time Log History
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {filteredAndGroupedLogs.length} tickets • {filteredAndGroupedLogs.reduce((sum, g) => sum + g.sessions.length, 0)} sessions
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {statusFilter === 'Submitted' ? (
                        <button
                            onClick={handleMarkAsUnsubmitted}
                            disabled={isActionDisabled}
                            className="flex-1 md:flex-none px-4 py-2 bg-yellow-500 text-white font-semibold text-sm rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            Unsubmit All
                        </button>
                    ) : (
                        <button
                            onClick={handleCreateDraft}
                            disabled={isActionDisabled}
                            className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            Generate AI Draft
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
                            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 shadow-sm"
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
                                    toast.success(`Exporting ${scope} logs as ${exportFormat.toUpperCase()}`);
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

            {/* Select All Bar */}
            <div className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg mb-4 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="select-all-checkbox"
                        checked={filteredAndGroupedLogs.length > 0 && filteredAndGroupedLogs.every(g => selectedTickets.has(g.ticketId))}
                        onChange={handleToggleSelectAll}
                        disabled={filteredAndGroupedLogs.length === 0}
                        className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="select-all-checkbox" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                        Select All Visible Tickets
                    </label>
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:block">
                    {filteredAndGroupedLogs.length} Items
                </span>
            </div>

            {/* Empty State */}
            {filteredAndGroupedLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="bg-white dark:bg-gray-700 p-4 rounded-full shadow-sm mb-4">
                        <List className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {logs.length === 0 ? "No time logs yet" : "No logs match your filters"}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                        {logs.length === 0
                            ? "Start tracking time by entering a ticket ID above."
                            : "Try adjusting your filters to see more results."}
                    </p>
                    {(statusFilter !== 'All' || dateFilter) && (
                        <button
                            onClick={() => { setStatusFilter('All'); setDateFilter(''); }}
                            className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors text-sm font-medium"
                        >
                            Clear All Filters
                        </button>
                    )}
                </div>
            )}

            {/* Card List Layout */}
            <div className="space-y-4">
                <AnimatePresence mode='popLayout'>
                    {filteredAndGroupedLogs.map((group) => (
                        <motion.div
                            key={group.ticketId}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                        >
                            <TicketRow
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
                                handleDeleteTicketClick={handleDeleteTicketClick}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

        </section>
    );
};

export default SessionList;
