
import React from 'react';
import type { View, JournalSheet } from '../types';

interface HeaderProps {
  activeView: View;
  setActiveView: (view: View) => void;
  onSignOut: () => void;
  journals: JournalSheet[];
  activeJournalId: string | null;
  onSwitchJournal: (id: string) => void;
  onAddNewJournal: () => void;
}

const NavButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
    }`}
  >
    {label}
  </button>
);

export const Header: React.FC<HeaderProps> = ({ 
  activeView, setActiveView, onSignOut, journals, activeJournalId, onSwitchJournal, onAddNewJournal 
}) => {
  const activeJournalName = journals.find(j => j.id === activeJournalId)?.name || 'Select Journal';

  return (
    <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
             <h1 className="text-xl font-bold text-slate-900 dark:text-white flex-shrink-0">AI Journal</h1>
             <select
                aria-label="Select Journal"
                value={activeJournalId || ''}
                onChange={(e) => onSwitchJournal(e.target.value)}
                className="block w-full max-w-xs pl-3 pr-10 py-2 text-base border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-slate-100 dark:bg-slate-700"
              >
                {journals.map((journal) => (
                  <option key={journal.id} value={journal.id}>
                    {journal.name}
                  </option>
                ))}
              </select>
          </div>
          <div className="flex items-center space-x-4">
            <nav className="flex items-center space-x-2">
              <NavButton
                label="Journal"
                isActive={activeView === 'journal'}
                onClick={() => setActiveView('journal')}
              />
              <NavButton
                label="Live Chat"
                isActive={activeView === 'live-chat'}
                onClick={() => setActiveView('live-chat')}
              />
            </nav>
            <div className="flex items-center space-x-2">
                <button
                    onClick={onAddNewJournal}
                    className="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                    + New Journal
                </button>
                <button
                    onClick={onSignOut}
                    className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                    Sign Out
                </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
