import React from 'react';
import type { View } from '../types';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon';

interface HeaderProps {
  activeView: View;
  setActiveView: (view: View) => void;
  onSignOut: () => void;
  spreadsheetId: string;
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

export const Header: React.FC<HeaderProps> = ({ activeView, setActiveView, onSignOut, spreadsheetId }) => {
  return (
    <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">AI Journal</h1>
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
            <a
              href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Google Sheet in new tab"
              className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center"
            >
              <ExternalLinkIcon className="w-4 h-4 mr-2" />
              Open Sheet
            </a>
            <button
              onClick={onSignOut}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
