
import React, { useState } from 'react';
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

const MenuIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const NavButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}> = ({ label, isActive, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-md font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
    } ${className}`}
  >
    {label}
  </button>
);

export const Header: React.FC<HeaderProps> = ({ 
  activeView, setActiveView, onSignOut, journals, activeJournalId, onSwitchJournal, onAddNewJournal 
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNavClick = (view: View) => {
    setActiveView(view);
    setIsMenuOpen(false);
  };

  return (
    <header className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo and Mobile Toggle */}
          <div className="flex items-center justify-between w-full md:w-auto">
             <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex-shrink-0 mr-4">AI Journal</h1>
             
             {/* Mobile Menu Button - Larger Hit Area */}
             <button 
               className="md:hidden p-3 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none"
               onClick={() => setIsMenuOpen(!isMenuOpen)}
               aria-label="Toggle menu"
             >
               {isMenuOpen ? <XIcon className="h-8 w-8" /> : <MenuIcon className="h-8 w-8" />}
             </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4 flex-1 justify-between ml-8">
             <div className="flex items-center space-x-4">
                 <select
                    aria-label="Select Journal"
                    value={activeJournalId || ''}
                    onChange={(e) => onSwitchJournal(e.target.value)}
                    className="block w-full max-w-xs pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md bg-slate-100 dark:bg-slate-700"
                  >
                    {journals.map((journal) => (
                      <option key={journal.id} value={journal.id}>
                        {journal.name}
                      </option>
                    ))}
                  </select>
             </div>

             <div className="flex items-center space-x-2">
                <nav className="flex items-center space-x-1">
                  {/* Renamed Journal to New Entry */}
                  <NavButton label="New Entry" isActive={activeView === 'journal'} onClick={() => handleNavClick('journal')} />
                  <NavButton label="Live Chat" isActive={activeView === 'live-chat'} onClick={() => handleNavClick('live-chat')} />
                  <NavButton label="Dashboard" isActive={activeView === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
                </nav>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2"></div>
                <button
                    onClick={onAddNewJournal}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                >
                    + New
                </button>
                <button
                    onClick={onSignOut}
                    className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                >
                    Sign Out
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown - Full width and prominent */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-[64px] bottom-0 bg-white dark:bg-slate-900 z-40 overflow-y-auto border-t border-slate-200 dark:border-slate-700">
          <div className="px-6 py-8 space-y-8">
             
             {/* Journal Switcher */}
             <div className="space-y-3">
               <label className="block text-lg font-semibold text-slate-500 dark:text-slate-400">Current Journal</label>
               <div className="relative">
                   <select
                      value={activeJournalId || ''}
                      onChange={(e) => {
                          onSwitchJournal(e.target.value);
                          setIsMenuOpen(false);
                      }}
                      className="block w-full p-4 text-lg border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800 focus:border-blue-500 focus:ring-blue-500 transition-colors appearance-none"
                    >
                      {journals.map((journal) => (
                        <option key={journal.id} value={journal.id}>
                          {journal.name}
                        </option>
                      ))}
                    </select>
                    {/* Custom Arrow */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
               </div>
             </div>

             <nav className="flex flex-col space-y-4">
                <button 
                    onClick={() => handleNavClick('live-chat')} 
                    className={`w-full text-left p-4 rounded-xl text-xl font-bold transition-all ${activeView === 'live-chat' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-2 ring-blue-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                >
                    🎤 Live Voice Chat
                </button>
                <button 
                    onClick={() => handleNavClick('journal')} 
                    className={`w-full text-left p-4 rounded-xl text-xl font-bold transition-all ${activeView === 'journal' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-2 ring-blue-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                >
                    ✍️ New Entry
                </button>
                <button 
                    onClick={() => handleNavClick('dashboard')} 
                    className={`w-full text-left p-4 rounded-xl text-xl font-bold transition-all ${activeView === 'dashboard' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-2 ring-blue-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                >
                    📊 Dashboard
                </button>
             </nav>
             
             <div className="pt-8 border-t border-slate-200 dark:border-slate-700 flex flex-col space-y-4">
                <button
                    onClick={() => { onAddNewJournal(); setIsMenuOpen(false); }}
                    className="w-full px-6 py-4 rounded-xl text-lg font-bold text-white bg-blue-600 active:bg-blue-700 text-center shadow-md"
                >
                    + Create New Journal
                </button>
                <button
                    onClick={onSignOut}
                    className="w-full px-6 py-4 rounded-xl text-lg font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/40 text-center"
                >
                    Sign Out
                </button>
             </div>
          </div>
        </div>
      )}
    </header>
  );
};
