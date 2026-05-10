import React, { useState } from 'react';
import { Clock, List, Pencil, CornerUpRight, Trash2, TrendingUp, Check, Keyboard, Info } from 'lucide-react';

export const InstructionsContent = () => {
  const [expandedSection, setExpandedSection] = useState('getting-started');

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const Section = ({ id, icon: Icon, title, children }) => {
    const isExpanded = expandedSection === id;

    return (
      <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
          aria-expanded={isExpanded}
        >
          <h4 className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center">
            <Icon className="w-4 h-4 mr-2" />
            {title}
          </h4>
          <span className="text-xl text-gray-400 dark:text-gray-500 font-light">
            {isExpanded ? '−' : '+'}
          </span>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 text-sm text-gray-700 dark:text-gray-300">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <Section id="getting-started" icon={Clock} title="Getting Started">
        <ul className="list-disc list-inside space-y-1.5">
          <li><strong>Start Timer:</strong> Enter ticket ID + press <kbd className="kbd-key">Ctrl+Space</kbd> (works while typing!)</li>
          <li><strong>Autocomplete:</strong> Recent tickets appear as suggestions</li>
          <li><strong>Notifications:</strong> Alerts at 30min, 1hr, 2hr, 4hr milestones</li>
          <li><strong>Pause/Resume:</strong> Press <kbd className="kbd-key">Ctrl+Space</kbd> anytime, anywhere</li>
        </ul>
      </Section>

      <Section id="managing" icon={List} title="Managing Logs">
        <ul className="list-disc list-inside space-y-1.5">
          <li><strong>Edit:</strong> Click <Pencil className="w-3 h-3 inline-block -mt-1 text-blue-500" /> to rename tickets across all sessions</li>
          <li><strong>Reallocate:</strong> Click <CornerUpRight className="w-3 h-3 inline-block -mt-1 text-purple-500" /> to move sessions to different tickets</li>
          <li><strong>Delete:</strong> Click <Trash2 className="w-3 h-3 inline-block -mt-1 text-red-500" /> to remove sessions</li>
          <li><strong>Archive:</strong> Mark tickets as 'Closed' to filter them out</li>
        </ul>
      </Section>

      <Section id="stats" icon={TrendingUp} title="Statistics & Insights">
        <ul className="list-disc list-inside space-y-1.5">
          <li>Dashboard shows total time, status breakdown, and averages</li>
          <li>Stats update in real-time as you track</li>
          <li>Filter by date range or search to analyze specific periods</li>
        </ul>
      </Section>

      <Section id="advanced" icon={Check} title="Advanced Features">
        <ul className="list-disc list-inside space-y-1.5">
          <li><strong>Search:</strong> Find tickets instantly by ID</li>
          <li><strong>Date Filters:</strong> Today, Last 7/30 days, or custom range</li>
          <li><strong>Bulk Operations:</strong> Select multiple → delete or change status</li>
          <li><strong>Export:</strong> CSV of selected/filtered/all entries</li>
          <li><strong>Share:</strong> Filters saved in URL - share specific views!</li>
        </ul>
      </Section>

      <Section id="shortcuts" icon={Keyboard} title="Keyboard Shortcuts">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div><kbd className="kbd-key">Ctrl+Space</kbd> Start/Pause (works everywhere)</div>
          <div><kbd className="kbd-key">Shift+Space</kbd> Stop & Finalize (works everywhere)</div>
          <div><kbd className="kbd-key">↑/↓</kbd> Navigate dropdowns</div>
          <div><kbd className="kbd-key">Esc</kbd> Close modals</div>
          <div><kbd className="kbd-key">Enter</kbd> Submit forms</div>
          <div><kbd className="kbd-key">Tab</kbd> Navigate UI</div>
        </div>
      </Section>

      <Section id="tips" icon={Info} title="Pro Tips">
        <ul className="list-disc list-inside space-y-1.5 text-xs">
          <li>Profile & recent tickets saved locally</li>
          <li>Limits: 200 chars (ticket), 5000 chars (notes)</li>
          <li>Use bulk ops for efficiency</li>
          <li>Data syncs via Firebase across devices</li>
        </ul>
      </Section>
    </div>
  );
};
