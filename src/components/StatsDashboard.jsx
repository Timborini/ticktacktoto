import React from 'react';
import { Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { formatTime } from '../utils/helpers';

const StatsDashboard = ({
    totalFilteredTimeMs,
    filteredAndGroupedLogs,
    logs
}) => {
    return (
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
                        {filteredAndGroupedLogs.length} ticket(s) • {filteredAndGroupedLogs.reduce((sum, g) => sum + g.sessions.length, 0)} session(s)
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
                        <span className="text-sm text-gray-700 dark:text-gray-300">Submitted:</span>
                        <span className="text-lg font-bold text-green-700 dark:text-green-300">
                            {logs.filter(l => l.status === 'submitted').length}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Unsubmitted:</span>
                        <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                            {logs.filter(l => l.status !== 'submitted').length}
                        </span>
                    </div>
                </div>
            </div>

            {/* Average Session Time */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 p-4 rounded-lg shadow-md border border-purple-200 dark:border-purple-700">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-purple-600 dark:text-purple-300 uppercase tracking-wide">Average Session</p>
                    <TrendingUp className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                </div>
                <p className="text-2xl font-bold font-mono text-purple-900 dark:text-purple-100">
                    {logs.length > 0
                        ? formatTime(Math.floor(logs.reduce((sum, l) => sum + l.accumulatedMs, 0) / logs.length))
                        : '00:00:00'
                    }
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Per session across all time
                </p>
            </div>
        </div>
    );
};

export default StatsDashboard;
