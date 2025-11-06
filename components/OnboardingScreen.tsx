import React, { useState } from 'react';
import type { JournalSheet } from '../types';
import * as GoogleApiService from '../services/googleApiService';

interface OnboardingScreenProps {
  onCreateNewClick: () => void;
  onJournalSelected: (sheet: JournalSheet) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onCreateNewClick, onJournalSelected }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleOpenPicker = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const selectedSheet = await GoogleApiService.showPicker();
            onJournalSelected(selectedSheet);
        } catch (err) {
            console.error("Picker error:", err);
            // Don't show an error if the user just cancelled.
            if (err instanceof Error && !err.message.includes('cancelled')) {
                 setError(err.message);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 px-4">
            <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-lg shadow-xl text-center">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Welcome to AI Journal</h1>
                <p className="text-slate-600 dark:text-slate-300 mb-8">
                    To begin, create a new journal or open an existing one from your Google Drive.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={onCreateNewClick}
                        className="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        Create a New Journal
                    </button>
                    
                    <button
                        onClick={handleOpenPicker}
                        disabled={isLoading}
                        className="w-full px-6 py-3 border border-slate-300 dark:border-slate-600 text-base font-medium rounded-md text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-200 disabled:cursor-not-allowed transition-colors"
                    >
                       {isLoading ? 'Opening Google Drive...' : 'Open Existing Journal'}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 text-sm text-red-500 text-left bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                        <p className="font-semibold">Could not open journal:</p>
                        <p className="mt-1">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
