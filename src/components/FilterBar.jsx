import { X } from 'lucide-react';
import { toLocalDateString } from '../utils/helpers.js';

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
    const hasActiveFilters = Boolean(searchQuery) || statusFilter !== 'All' || Boolean(dateRangeStart) || Boolean(dateRangeEnd);

    const clearAll = () => {
        setStatusFilter('All');
        setDateFilter('');
        setDateRangeStart('');
        setDateRangeEnd('');
        setSearchQuery('');
    };

    const chipClass = 'px-3 py-1.5 text-xs font-semibold bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors';

    return (
        <div className="space-y-4">
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
                            aria-label="Clear search"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Date Filter Chips */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Quick:</span>
                <button
                    onClick={() => {
                        const today = toLocalDateString(Date.now());
                        setDateRangeStart(today);
                        setDateRangeEnd(today);
                        setDateFilter('');
                    }}
                    className={chipClass}
                >
                    Today
                </button>
                <button
                    onClick={() => {
                        const now = Date.now();
                        setDateRangeStart(toLocalDateString(now - 7 * 24 * 60 * 60 * 1000));
                        setDateRangeEnd(toLocalDateString(now));
                        setDateFilter('');
                    }}
                    className={chipClass}
                >
                    Last 7 Days
                </button>
                <button
                    onClick={() => {
                        const now = Date.now();
                        setDateRangeStart(toLocalDateString(now - 30 * 24 * 60 * 60 * 1000));
                        setDateRangeEnd(toLocalDateString(now));
                        setDateFilter('');
                    }}
                    className={chipClass}
                >
                    Last 30 Days
                </button>
                {hasActiveFilters && (
                    <button
                        onClick={clearAll}
                        className="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 rounded-full border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        Clear All
                    </button>
                )}
            </div>

            {/* Status Filter */}
            <div>
                <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status Filter
                </label>
                <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="All">All</option>
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
        </div>
    );
};

export default FilterBar;
