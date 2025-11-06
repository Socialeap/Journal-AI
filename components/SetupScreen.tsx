import React, { useState } from 'react';
import { createJournalSheet } from '../services/googleSheetsService';
import * as GoogleApiService from '../services/googleApiService';
import type { JournalSheet } from '../types';

interface SetupScreenProps {
  onJournalConfigured: (sheet: JournalSheet) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onJournalConfigured }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [journalSlug, setJournalSlug] = useState('');

    const handleCreateSheet = async () => {
        if (!journalSlug.trim()) {
            setError("Please provide a name for your journal.");
            return;
        }
        setIsCreating(true);
        setError(null);
        try {
            const fullSheetName = `AI Journal - ${journalSlug.trim()}`;
            const newSheetId = await createJournalSheet(fullSheetName);
            onJournalConfigured({ id: newSheetId, name: fullSheetName });
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'An unknown error occurred. Please try again.');
            setIsCreating(false);
        }
    };

    const handleOpenPicker = async () => {
        setIsOpening(true);
        setError(null);
        try {
            const selectedSheet = await GoogleApiService.showPicker();
            onJournalConfigured(selectedSheet);
        } catch (err) {
            if (err instanceof Error && !err.message.includes('cancelled')) {
                 setError(err.message);
            }
        } finally {
            setIsOpening(false);
        }
    };

    const isLoading = isCreating || isOpening;

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 px-4">
            <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-lg shadow-xl">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 text-center">Welcome to AI Journal</h1>
                <p className="text-slate-600 dark:text-slate-300 mb-6 text-center">
                    Create a new journal, or open an existing one from Google Drive.
                </p>

                <div className="space-y-4">
                    <input
                        type="text"
                        id="journal-name"
                        value={journalSlug}
                        onChange={(e) => setJournalSlug(e.target.value)}
                        placeholder="e.g., Daily Reflections"
                        className="w-full p-3 rounded-md bg-slate-100 dark:bg-slate-700 border-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleCreateSheet}
                        disabled={isLoading || !journalSlug.trim()}
                        className="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {isCreating ? 'Creating...' : 'Create New Journal'}
                    </button>
                </div>
                
                <div className="relative flex items-center my-6">
                    <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
                    <span className="flex-shrink mx-4 text-slate-500 dark:text-slate-400 text-sm">OR</span>
                    <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
                </div>

                <button
                    onClick={handleOpenPicker}
                    disabled={isLoading}
                    className="w-full px-6 py-3 border border-slate-300 dark:border-slate-600 text-base font-medium rounded-md text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-200 disabled:cursor-not-allowed transition-colors"
                >
                    {isOpening ? 'Opening Google Drive...' : 'Open Existing Journal'}
                </button>

                {error && (
                    <div className="mt-4 text-sm text-red-500 text-left bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                        <p className="font-semibold">An error occurred:</p>
                        <p className="mt-1">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
