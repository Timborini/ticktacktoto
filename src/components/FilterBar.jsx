import React from 'react';
import { X } from 'lucide-react';

const FilterBar = ({
    searchQuery,
    setSearchQuery,
    setDateRangeStart,
    setDateRangeEnd,
    setDateFilter,
    statusFilter,
    setStatusFilter,
    dateRangeStart,
    dateRangeEnd
}) => {
    return (
        <div className="space-y-6">
            {/* Search Bar */}
            <div>
                <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search Tickets
                </label>
                <div className="relative">
                    <input
                        type="search"
                        id="search-filter"
                        placeholder="Search by ticket ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-3 pl-3 pr-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Date Filters */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Quick Filters
                </label>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            setDateRangeStart(today);
                            setDateRangeEnd(today);
                            setDateFilter('');
                        }}
                        className="px-4 py-2 text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                    >
                        Today
                    </button>
                    <button
                        onClick={() => {
                            const today = new Date();
                            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                            setDateRangeStart(weekAgo.toISOString().split('T')[0]);
                            setDateRangeEnd(today.toISOString().split('T')[0]);
                            setDateFilter('');
                        }}
                        className="px-4 py-2 text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                    >
                        Last 7 Days
                    </button>
                    <button
                        onClick={() => {
                            const today = new Date();
                            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                            setDateRangeStart(monthAgo.toISOString().split('T')[0]);
                            setDateRangeEnd(today.toISOString().split('T')[0]);
                            setDateFilter('');
                        }}
                        className="px-4 py-2 text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                    >
                        Last 30 Days
                    </button>
                </div>
            </div>

            {/* Status Filter */}
            <div>
                <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status Filter
                </label>
                <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="All">All Unsubmitted</option>
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                    <option value="Submitted">Submitted</option>
                </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="date-start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Date
                    </label>
                    <input
                        type="date"
                        id="date-start"
                        value={dateRangeStart}
                        onChange={(e) => {
                            setDateRangeStart(e.target.value);
                            setDateFilter('');
                        }}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div>
                    <label htmlFor="date-end" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        End Date
                    </label>
                    <input
                        type="date"
                        id="date-end"
                        value={dateRangeEnd}
                        onChange={(e) => {
                            setDateRangeEnd(e.target.value);
                            setDateFilter('');
                        }}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>

            {/* Clear All Filters Button */}
            <button
                onClick={() => {
                    setStatusFilter('All');
                    setDateFilter('');
                    setDateRangeStart('');
                    setDateRangeEnd('');
                    setSearchQuery('');
                }}
                className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors active:scale-[0.98]"
            >
                Clear All Filters
            </button>
        </div>
    );
};

export default FilterBar;
