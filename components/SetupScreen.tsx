import React, { useState, useEffect } from 'react';
import { createJournalSheet } from '../services/googleSheetsService';
import { findJournalSheetsInDrive, type DriveFile } from '../services/googleApiService';
import { FileIcon } from './icons/FileIcon';

interface SetupScreenProps {
  onIdSubmit: (id: string) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onIdSubmit }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [isSearching, setIsSearching] = useState(true);
    const [foundSheets, setFoundSheets] = useState<DriveFile[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const searchForSheets = async () => {
            setIsSearching(true);
            setError(null);
            try {
                const sheets = await findJournalSheetsInDrive();
                setFoundSheets(sheets);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not search your Google Drive for sheets.');
            } finally {
                setIsSearching(false);
            }
        };
        searchForSheets();
    }, []);
    
    const handleCreateSheet = async () => {
        setIsCreating(true);
        setError(null);
        try {
            const newSheetId = await createJournalSheet();
            onIdSubmit(newSheetId);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'An unknown error occurred. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 px-4">
            <div className="w-full max-w-lg p-8 bg-white dark:bg-slate-800 rounded-lg shadow-xl">
                <h1 className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-2">Connect Your Journal</h1>
                <p className="text-slate-600 dark:text-slate-300 mb-6 text-center">
                    Choose an existing journal from your Google Drive or create a new one.
                </p>

                {error && <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-md mb-4 text-sm"><p className="font-semibold">An error occurred:</p><p>{error}</p></div>}

                <div className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-3">Existing Journals</h2>
                        <div className="max-h-60 overflow-y-auto bg-slate-50 dark:bg-slate-700/50 rounded-md p-2 space-y-2 border border-slate-200 dark:border-slate-700">
                            {isSearching ? (
                                <p className="text-slate-500 dark:text-slate-400 text-center py-4">Searching your Google Drive...</p>
                            ) : foundSheets.length > 0 ? (
                                foundSheets.map(sheet => (
                                    <button
                                        key={sheet.id}
                                        onClick={() => onIdSubmit(sheet.id)}
                                        className="w-full flex items-center text-left p-3 rounded-md bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors shadow-sm"
                                    >
                                        <FileIcon className="w-5 h-5 mr-3 text-slate-500 dark:text-slate-400" />
                                        <span className="flex-grow font-medium text-slate-800 dark:text-slate-100">{sheet.name}</span>
                                    </button>
                                ))
                            ) : (
                                <p className="text-slate-500 dark:text-slate-400 text-center py-4">No existing journal sheets found.</p>
                            )}
                        </div>
                    </div>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
                        <span className="flex-shrink mx-4 text-slate-500 dark:text-slate-400 text-sm">OR</span>
                        <div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div>
                    </div>

                    <div>
                        <button
                            onClick={handleCreateSheet}
                            disabled={isCreating}
                            className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {isCreating ? 'Creating Sheet...' : 'Create & Connect New Journal Sheet'}
                        </button>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                            This will create a new file named "AI Journal Sheet" in your Google Drive.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};