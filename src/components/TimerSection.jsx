import React from 'react';
import { Clock, Play, Square, User, Keyboard, Lock, Pause } from 'lucide-react';
import { formatTime } from '../utils/helpers';

const TimerSection = ({
    isTimerRunning,
    isTimerPaused,
    userTitle,
    setUserTitle,
    currentTicketId,
    setCurrentTicketId,
    isInputDisabled,
    recentTicketIds,
    isInputTicketClosed,
    currentNote,
    setCurrentNote,
    elapsedMs,
    onStart,
    onPause,
    onResume,
    onStop,
    pausedTicketId
}) => {

    // Derived state for action button
    let actionButtonText;
    let ActionButtonIcon;
    let actionHandler;
    let actionStyle;

    const inputTicketId = currentTicketId.trim();

    if (isTimerRunning) {
        actionButtonText = 'PAUSE';
        ActionButtonIcon = Pause;
        actionHandler = onPause;
        actionStyle = 'bg-yellow-500 hover:bg-yellow-600 text-white';
    } else if (isTimerPaused && inputTicketId === pausedTicketId) {
        actionButtonText = 'RESUME';
        ActionButtonIcon = Play;
        actionHandler = onResume;
        actionStyle = 'bg-green-600 hover:bg-green-700 text-white';
    } else {
        actionButtonText = isInputTicketClosed ? 'TICKET CLOSED' : 'START';
        ActionButtonIcon = isInputTicketClosed ? Lock : Play;
        actionHandler = () => onStart(inputTicketId);
        actionStyle = isInputTicketClosed
            ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white';
    }

    const isButtonDisabled = (isInputTicketClosed && !isTimerPaused && !isTimerRunning) || (currentTicketId.trim() === '' && !isTimerRunning && !isTimerPaused);
    const isStopButtonDisabled = !isTimerRunning && !isTimerPaused;

    return (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl mb-8 border-t-4 border-indigo-500">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                    {isTimerRunning ? 'Currently Running' : isTimerPaused ? 'Activity Paused' : 'Start New Session'}
                </h2>
                <Clock className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* LEFT COLUMN - Inputs & Configuration */}
                <div className="space-y-6">
                    {/* Profile Title */}
                    <div>
                        <label htmlFor="user-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <User className="h-4 w-4 inline mr-1" />
                            Your Title / Role
                        </label>
                        <input
                            id="user-title"
                            type="text"
                            value={userTitle}
                            onChange={(e) => setUserTitle(e.target.value)}
                            placeholder="e.g., Senior Software Engineer"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Used to personalize AI status reports</p>
                    </div>

                    {/* Ticket ID Input */}
                    <div>
                        <label htmlFor="ticket-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Ticket ID
                        </label>
                        <div className="relative">
                            <input
                                id="ticket-input"
                                type="text"
                                list="recent-tickets"
                                placeholder="Enter Ticket ID (e.g., JIRA-101)"
                                value={currentTicketId}
                                onChange={(e) => setCurrentTicketId(e.target.value)}
                                disabled={isInputDisabled}
                                maxLength={200}
                                className={`w-full p-3 pr-16 text-lg border-2 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${isInputDisabled ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500'}`}
                            />
                            <datalist id="recent-tickets">
                                {recentTicketIds.map(id => (
                                    <option key={id} value={id} />
                                ))}
                            </datalist>
                            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${currentTicketId.length > 180 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {currentTicketId.length}/200
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            e.g., PROJ-123, JIRA-456, or any custom format
                        </p>
                        {isInputTicketClosed && (
                            <p className="text-red-500 text-sm mt-2 flex items-center">
                                <Lock className="w-4 h-4 mr-1" /> This ticket is closed.
                            </p>
                        )}
                    </div>

                    {/* Session Notes - Smooth show/hide with CSS transitions */}
                    <div
                        className={`transition-all duration-300 ease-in-out overflow-hidden ${(isTimerRunning || isTimerPaused)
                                ? 'max-h-48 opacity-100'
                                : 'max-h-0 opacity-0'
                            }`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <label htmlFor="session-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Session Notes
                            </label>
                            <span className={`text-xs ${currentNote.length > 4500 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {currentNote.length}/5000
                            </span>
                        </div>
                        <textarea
                            id="session-notes"
                            placeholder="E.g., Fixed critical bug in user authentication module."
                            value={currentNote}
                            onChange={(e) => setCurrentNote(e.target.value)}
                            maxLength={5000}
                            rows="3"
                            className="w-full p-3 text-sm border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm resize-none"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Saved automatically on pause/stop</p>
                    </div>
                </div>

                {/* RIGHT COLUMN - Timer & Controls */}
                <div className="space-y-6">
                    {/* Timer Display */}
                    <div className="text-center">
                        <div
                            className={`py-8 px-6 rounded-xl shadow-inner border transition-colors touch-manipulation ${isTimerRunning ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' : isTimerPaused ? 'bg-yellow-50 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' : 'bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600'}`}
                            aria-live="polite"
                            aria-atomic="true"
                        >
                            <p className="text-3xl lg:text-4xl font-mono font-bold tracking-wider">
                                <span className="sr-only">Timer: </span>
                                {formatTime(elapsedMs)}
                            </p>
                            {(isTimerRunning || isTimerPaused) && (
                                <p className={`text-sm mt-2 font-semibold ${isTimerRunning ? 'text-indigo-500' : 'text-yellow-500'}`}>
                                    {isTimerRunning ? 'Running' : 'Paused'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={actionHandler}
                            disabled={isButtonDisabled}
                            className={`w-full flex items-center justify-center space-x-2 py-4 px-6 rounded-xl font-bold text-lg transition-all transform active:scale-[0.98] ${actionStyle} ${isButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <ActionButtonIcon className="h-6 w-6" />
                            <span>{actionButtonText}</span>
                        </button>
                        <button
                            onClick={() => onStop(false)}
                            disabled={isStopButtonDisabled}
                            title="Stop Activity"
                            className={`w-full flex items-center justify-center space-x-2 py-3 px-6 rounded-xl font-bold text-lg transition-all transform active:scale-[0.98] bg-red-500 hover:bg-red-600 text-white ${isStopButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Square className="h-5 w-5" />
                            <span>Stop</span>
                        </button>
                    </div>

                    {/* Keyboard Shortcuts */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <h3 className="flex items-center font-semibold text-gray-600 dark:text-gray-300 mb-3 text-sm">
                            <Keyboard className="w-4 h-4 mr-2" />
                            Keyboard Shortcuts
                        </h3>
                        <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex justify-between">
                                <span>Start / Pause / Resume</span>
                                <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Ctrl + Space</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Stop & Finalize</span>
                                <kbd className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded border border-gray-300 dark:border-gray-600">Shift + Space</kbd>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TimerSection;
