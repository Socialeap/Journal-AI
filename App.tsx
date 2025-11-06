import React, { useState, useEffect, useCallback } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { JournalView } from './components/JournalView';
import { LiveChatView } from './components/LiveChatView';
import { Header } from './components/Header';
import { SetupScreen } from './components/SetupScreen';
import type { View, JournalSheet } from './types';
import * as GoogleApiService from './services/googleApiService';

type AppState = 'initializing' | 'login' | 'setup' | 'viewing_journal';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('initializing');
  const [journalSheets, setJournalSheets] = useState<JournalSheet[]>([]);
  const [activeJournalId, setActiveJournalId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>('journal');

  const loadFromStorage = useCallback((): boolean => {
    try {
      const storedSheets = localStorage.getItem('journalSheets');
      if (storedSheets) {
        const sheets: JournalSheet[] = JSON.parse(storedSheets);
        if (sheets.length > 0) {
          setJournalSheets(sheets);
          const storedActiveId = localStorage.getItem('activeJournalId');
          const effectiveId = storedActiveId && sheets.some(s => s.id === storedActiveId)
            ? storedActiveId
            : sheets[0].id;
          setActiveJournalId(effectiveId);
          localStorage.setItem('activeJournalId', effectiveId);
          return true; // Journals found and loaded
        }
      }
    } catch (error) {
      console.error("Failed to parse journal data from localStorage", error);
      localStorage.clear();
    }
    return false; // No journals found
  }, []);

  const updateAuthState = useCallback(() => {
    if (GoogleApiService.isUserSignedIn()) {
      if (loadFromStorage()) {
        setAppState('viewing_journal');
      } else {
        setAppState('setup');
      }
    } else {
      setAppState('login');
    }
  }, [loadFromStorage]);
  
  useEffect(() => {
    GoogleApiService.initClient(updateAuthState);
    // The GSI library might automatically sign in the user.
    // The updateAuthState callback will handle the transition.
    // We'll transition to login state for now, which shows the login button
    // until the GSI library confirms authentication status.
    if (!GoogleApiService.isUserSignedIn()) {
      setAppState('login');
    }
  }, [updateAuthState]);

  const handleSignIn = () => {
    GoogleApiService.signIn();
  };
  
  const handleSignOut = () => {
    GoogleApiService.signOut();
    localStorage.clear();
    setJournalSheets([]);
    setActiveJournalId(null);
    setAppState('login');
  };
  
  const handleJournalConfigured = (configuredSheet: JournalSheet) => {
    const isExisting = journalSheets.some(sheet => sheet.id === configuredSheet.id);
    let updatedSheets = journalSheets;
    if (!isExisting) {
        updatedSheets = [...journalSheets, configuredSheet];
        setJournalSheets(updatedSheets);
        localStorage.setItem('journalSheets', JSON.stringify(updatedSheets));
    }
    setActiveJournalId(configuredSheet.id);
    localStorage.setItem('activeJournalId', configuredSheet.id);
    setAppState('viewing_journal');
  };

  const handleSwitchJournal = (id: string) => {
    setActiveJournalId(id);
    localStorage.setItem('activeJournalId', id);
    setActiveView('journal');
  };

  const renderContent = () => {
    switch (appState) {
      case 'initializing':
        return (
          <div className="flex items-center justify-center min-h-screen">
            Initializing...
          </div>
        );
      case 'login':
        return <LoginScreen onLoginClick={handleSignIn} />;
      case 'setup':
        return <SetupScreen onJournalConfigured={handleJournalConfigured} />;
      case 'viewing_journal':
        return (
          <div className="min-h-screen flex flex-col">
            <Header 
              activeView={activeView} 
              setActiveView={setActiveView}
              onSignOut={handleSignOut}
              journals={journalSheets}
              activeJournalId={activeJournalId}
              onSwitchJournal={handleSwitchJournal}
              onAddNewJournal={() => setAppState('setup')}
            />
            <main className="flex-grow p-4 md:p-8">
              <div className="max-w-4xl mx-auto">
                {activeJournalId && activeView === 'journal' && <JournalView spreadsheetId={activeJournalId} />}
                {activeJournalId && activeView === 'live-chat' && <LiveChatView spreadsheetId={activeJournalId} />}
              </div>
            </main>
          </div>
        );
      default:
        return (
           <div className="flex items-center justify-center min-h-screen">
            <p>An unexpected error occurred. Please refresh the page.</p>
          </div>
        );
    }
  };

  return renderContent();
};

export default App;
