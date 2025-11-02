import React, { useState, useEffect, useCallback } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { JournalView } from './components/JournalView';
import { LiveChatView } from './components/LiveChatView';
import { Header } from './components/Header';
import { SetupScreen } from './components/SetupScreen';
import type { View } from './types';
import * as GoogleApiService from './services/googleApiService';

const App: React.FC = () => {
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userSpreadsheetId, setUserSpreadsheetId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>('journal');

  useEffect(() => {
    const storedId = localStorage.getItem('spreadsheetId');
    if (storedId) {
      setUserSpreadsheetId(storedId);
    }
  }, []);

  const updateAuthState = useCallback(() => {
    const signedIn = GoogleApiService.isUserSignedIn();
    setIsAuthenticated(signedIn);
    // If the auth state changes to "signed out", ensure we clear the spreadsheet ID.
    if (!signedIn) {
      localStorage.removeItem('spreadsheetId');
      setUserSpreadsheetId(null);
    }
  }, []);

  useEffect(() => {
    // Pass two separate callbacks: one for when the GSI client is ready,
    // and one for any time the authentication state changes.
    GoogleApiService.initClient(
      () => setIsGoogleReady(true), // onReady callback
      updateAuthState               // onAuthChange callback
    );
  }, [updateAuthState]);

  const handleSignIn = () => {
    // The callback provided to initClient will handle updating the auth state.
    GoogleApiService.signIn();
  };
  
  const handleSignOut = () => {
    // The callback provided to initClient will handle updating the auth state.
    GoogleApiService.signOut();
  };

  const handleSetSpreadsheetId = (id: string) => {
    localStorage.setItem('spreadsheetId', id);
    setUserSpreadsheetId(id);
  };

  const handleResetSpreadsheetId = () => {
    localStorage.removeItem('spreadsheetId');
    setUserSpreadsheetId(null);
  };

  if (!isGoogleReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Initializing...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginClick={handleSignIn} />;
  }

  if (!userSpreadsheetId) {
    return <SetupScreen onIdSubmit={handleSetSpreadsheetId} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header 
        activeView={activeView} 
        setActiveView={setActiveView}
        onSignOut={handleSignOut}
        spreadsheetId={userSpreadsheetId}
      />
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {activeView === 'journal' && <JournalView spreadsheetId={userSpreadsheetId} onReset={handleResetSpreadsheetId} />}
          {activeView === 'live-chat' && <LiveChatView spreadsheetId={userSpreadsheetId} />}
        </div>
      </main>
    </div>
  );
};

export default App;