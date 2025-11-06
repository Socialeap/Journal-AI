import React from 'react';
import type { JournalSheet } from '../types';

interface JournalSelectionScreenProps {
  journals: JournalSheet[];
  onJournalSelected: (id: string) => void;
  onCreateNew: () => void;
}

export const JournalSelectionScreen: React.FC<JournalSelectionScreenProps> = ({
  journals,
  onJournalSelected,
  onCreateNew,
}) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 text-center">Select Your Journal</h1>
        <p className="text-slate-600 dark:text-slate-300 mb-6 text-center">
          We found these journals in your "AI Journal" Google Drive folder.
        </p>

        <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
          {journals.map((journal) => (
            <button
              key={journal.id}
              onClick={() => onJournalSelected(journal.id)}
              className="w-full text-left px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              aria-label={`Select journal: ${journal.name}`}
            >
              {journal.name}
            </button>
          ))}
        </div>
        
        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
          <p className="text-center text-slate-600 dark:text-slate-300 mb-4">Or, start a new one.</p>
          <button
            onClick={onCreateNew}
            className="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Create a New Journal
          </button>
        </div>
      </div>
    </div>
  );
};
