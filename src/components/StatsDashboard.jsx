import { useMemo } from 'react';
import { Clock, CheckCircle, TrendingUp, CircleDashed } from 'lucide-react';
import { formatTime } from '../utils/helpers';
import { SESSION_STATUS } from '../constants.js';

const StatsDashboard = ({
    totalFilteredTimeMs,
    filteredAndGroupedLogs,
    logs
}) => {
    const visibleSessions = useMemo(() =>
        filteredAndGroupedLogs.flatMap((g) => g.sessions),
    [filteredAndGroupedLogs]);

    const submittedCount = useMemo(() =>
        visibleSessions.filter(l => l.status === SESSION_STATUS.SUBMITTED).length,
    [visibleSessions]);

    const unsubmittedCount = useMemo(() =>
        visibleSessions.filter(l => l.status !== SESSION_STATUS.SUBMITTED).length,
    [visibleSessions]);

    const averageSessionMs = useMemo(() => {
        if (logs.length === 0) return 0;
        return Math.floor(logs.reduce((sum, l) => sum + l.accumulatedMs, 0) / logs.length);
    }, [logs]);

    const sessionSummary = useMemo(() => ({
        tickets: filteredAndGroupedLogs.length,
        sessions: filteredAndGroupedLogs.reduce((sum, g) => sum + g.sessions.length, 0),
    }), [filteredAndGroupedLogs]);    return (
        <div className="space-y-6">
            {/* Total Time - Prominent Display */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20 p-6 rounded-xl shadow-md border border-indigo-200 dark:border-indigo-700">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide">Total Time</p>
                    <Clock className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
                </div>
                <p className="text-4xl font-bold font-mono text-indigo-900 dark:text-indigo-100 mb-2">{formatTime(totalFilteredTimeMs)}</p>
                {filteredAndGroupedLogs.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {sessionSummary.tickets} ticket(s) • {sessionSummary.sessions} session(s)
                    </p>
                )}
            </div>

            {/* Status Breakdown */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 p-4 rounded-lg shadow-md border border-green-200 dark:border-green-700">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-green-600 dark:text-green-300 uppercase tracking-wide">Status Breakdown</p>
                    <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                            Submitted:
                        </span>
                        <span className="text-lg font-bold text-green-700 dark:text-green-300">
                            {submittedCount}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <CircleDashed className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                            Unsubmitted:
                        </span>
                        <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                            {unsubmittedCount}
                        </span>
                    </div>
                </div>
            </div>

            {/* Average Session Time */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/60 dark:to-gray-700/40 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Average Session</p>
                    <TrendingUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </div>
                <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
                    {formatTime(averageSessionMs)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Per session across loaded sessions
                </p>
            </div>
        </div>
    );
};

export default StatsDashboard;
