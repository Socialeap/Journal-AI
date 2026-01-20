
import React, { useState, useEffect, useCallback } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { JournalView } from './components/JournalView';
import { LiveChatView } from './components/LiveChatView';
import { DashboardView } from './components/DashboardView';
import { Header } from './components/Header';
import { SetupScreen } from './components/SetupScreen';
import type { View, JournalSheet, JournalEntry } from './types';
import * as GoogleApiService from './services/googleApiService';
import { getJournalEntries } from './services/googleSheetsService';

type AppState = 'initializing' | 'login' | 'setup' | 'viewing_journal';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('initializing');
  const [journalSheets, setJournalSheets] = useState<JournalSheet[]>([]);
  const [activeJournalId, setActiveJournalId] = useState<string | null>(null);
  // Default to 'live-chat' as requested for the initial startup page
  const [activeView, setActiveView] = useState<View>('live-chat');
  
  // Shared State: Lifted from JournalView to enable Dashboard integration
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);

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
    const init = async () => {
        // Initialize client and check for stored session
        await GoogleApiService.initClient(updateAuthState);
        
        // Only set to login if not signed in after init check
        if (!GoogleApiService.isUserSignedIn()) {
            setAppState('login');
        }
    };
    init();
  }, [updateAuthState]);

  // Shared Data Fetching Logic
  const fetchEntries = useCallback(async () => {
    if (!activeJournalId || appState !== 'viewing_journal') return;
    
    setIsLoadingEntries(true);
    setEntriesError(null);
    try {
        const fetchedEntries = await getJournalEntries(activeJournalId);
        setEntries(fetchedEntries);
    } catch (error) {
        console.error("Failed to fetch entries:", error);
        setEntriesError(error instanceof Error ? error.message : "An unknown error occurred.");
    } finally {
        setIsLoadingEntries(false);
    }
  }, [activeJournalId, appState]);

  // Fetch entries whenever the journal changes or we enter viewing mode
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSignIn = () => {
    GoogleApiService.signIn();
  };
  
  const handleSignOut = () => {
    GoogleApiService.signOut();
    localStorage.clear();
    setJournalSheets([]);
    setActiveJournalId(null);
    setEntries([]); // Clear sensitive data
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
    // When switching journals, we generally stay on the current view, 
    // but resetting entries is important.
    setEntries([]); 
  };

  // Drill-Down Logic: Navigation from Dashboard to Journal
  const handleNavigateToEntry = (id: string) => {
    setFocusedEntryId(id);
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
              <div className="max-w-6xl mx-auto">
                {activeJournalId && activeView === 'journal' && (
                  <JournalView 
                    spreadsheetId={activeJournalId} 
                    entries={entries}
                    isLoading={isLoadingEntries}
                    error={entriesError}
                    onRefresh={fetchEntries}
                    focusedEntryId={focusedEntryId}
                    onClearFocus={() => setFocusedEntryId(null)}
                    onUpdateEntries={setEntries} // Pass setter for optimistic updates
                  />
                )}
                {activeJournalId && activeView === 'live-chat' && (
                  <LiveChatView spreadsheetId={activeJournalId} />
                )}
                {activeJournalId && activeView === 'dashboard' && (
                   <DashboardView 
                      spreadsheetId={activeJournalId} 
                      entries={entries} 
                      isLoading={isLoadingEntries}
                      error={entriesError}
                      onRefresh={fetchEntries}
                      onNavigate={handleNavigateToEntry}
                   />
                )}
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
