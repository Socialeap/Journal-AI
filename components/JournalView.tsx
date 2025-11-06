
import React, { useState, useEffect, useCallback } from 'react';
import type { JournalEntry } from '../types';
import { getJournalEntries, addJournalEntry, updateEntryWithAI } from '../services/googleSheetsService';
import { generateSummaryAndInsight } from '../services/geminiService';
import { SendIcon } from './icons/SendIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface JournalViewProps {
    spreadsheetId: string;
}

const EntryCard: React.FC<{ entry: JournalEntry; isExpanded: boolean; onToggleExpand: () => void; }> = ({ entry, isExpanded, onToggleExpand }) => {
    const priorityColors: { [key: string]: string } = {
        low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    
    const truncateText = (text: string, maxLength: number) => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md mb-4 transition-all duration-300">
            <div className="flex justify-between items-start gap-4">
                 <div className="flex-grow">
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {isExpanded ? entry.entry : truncateText(entry.entry, 120)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{new Date(entry.timestamp).toLocaleString()}</p>
                 </div>
                 <button onClick={onToggleExpand} className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 flex-shrink-0">
                    {isExpanded ? 'Show Less' : 'Show More'}
                </button>
            </div>
            
            {isExpanded && (
                 <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-3">
                    {entry.status === 'analyzing' && (
                        <div className="flex items-center space-x-2 text-sky-500">
                            <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                            <span>AI is analyzing your entry...</span>
                        </div>
                    )}
            
                    {entry.status === 'complete' && (
                        <div className="space-y-3">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center">
                                    <SparklesIcon className="w-4 h-4 mr-2 text-sky-500"/> AI Summary
                                </h4>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{entry.aiSummary}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center">
                                    <SparklesIcon className="w-4 h-4 mr-2 text-purple-500"/> AI Insight
                                </h4>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{entry.aiInsight}</p>
                            </div>
                            {entry.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {entry.tags.map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-xs rounded-full">{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {entry.type === 'task' && entry.taskStatus !== 'none' && (
                        <div className="mt-4 pt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium">
                            <span className="px-2 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 rounded-full capitalize">{entry.type}</span>
                            {entry.priority !== 'none' && (
                            <span className={`px-2 py-1 rounded-full capitalize ${priorityColors[entry.priority] ?? ''}`}>{entry.priority} Priority</span>
                            )}
                            {entry.dueDate && <span className="px-2 py-1 bg-slate-200 dark:bg-slate-600 rounded-full">Due: {entry.dueDate}</span>}
                            <span className="px-2 py-1 bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300 rounded-full capitalize">{entry.taskStatus.replace('-', ' ')}</span>
                        </div>
                    )}
                </div>
            )}
            
             {!isExpanded && (entry.status === 'complete' || entry.status === 'analyzing') && (
                <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-3">
                     {entry.status === 'analyzing' && (
                        <div className="flex items-center space-x-2 text-sky-500 text-sm">
                            <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                            <span>AI is analyzing...</span>
                        </div>
                     )}
                     {entry.status === 'complete' && (
                        <div className="space-y-2">
                            <div className="flex items-start">
                                <SparklesIcon className="w-4 h-4 mr-2 text-sky-500 mt-0.5 flex-shrink-0"/>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                <span className="font-semibold">Summary: </span>{entry.aiSummary}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {entry.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-xs rounded-full">{tag}</span>
                                ))}
                                {entry.tags.length > 3 && <span className="text-xs text-slate-500 dark:text-slate-400 self-center">...</span>}
                            </div>
                        </div>
                     )}
                </div>
             )}

        </div>
    );
}


export const JournalView: React.FC<JournalViewProps> = ({ spreadsheetId }) => {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [newEntry, setNewEntry] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

    const fetchEntries = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const fetchedEntries = await getJournalEntries(spreadsheetId);
            setEntries(fetchedEntries);
        } catch (error) {
            console.error("Failed to fetch entries:", error);
            setError(error instanceof Error ? error.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, [spreadsheetId]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const handleSaveEntry = async () => {
        if (!newEntry.trim()) return;
        setIsSubmitting(true);
        setError(null);
        
        const newEntryId = (Math.random() + 1).toString(36).substring(7);
        const newEntryText = newEntry;
        
        try {
            // Step 1: Add the basic entry to the sheet
            await addJournalEntry(spreadsheetId, newEntryId, newEntryText);
            setNewEntry('');

            // Step 2: Refetch to get the new entry with its row number
            const fetchedEntries = await getJournalEntries(spreadsheetId);
            setEntries(fetchedEntries);

            const addedEntry = fetchedEntries.find(e => e.id === newEntryId);
            if (!addedEntry) {
                 throw new Error("Could not find the newly added entry.");
            }
            
            // Step 3: Mark as analyzing locally for immediate UI feedback
            setEntries(prev => prev.map(e => e.id === newEntryId ? { ...e, status: 'analyzing' } : e));

            // Step 4: Get AI insights
            const aiData = await generateSummaryAndInsight(addedEntry.entry);
            
            // Step 5: Update the entry in the sheet with AI data
            if (aiData) {
                await updateEntryWithAI(spreadsheetId, addedEntry, aiData);
            }

        } catch (error) {
            console.error("Failed to save entry or get AI insights:", error);
            setError(error instanceof Error ? error.message : "An unknown error occurred.");
        } finally {
            // Step 6: Final refetch to ensure UI is perfectly in sync
            await fetchEntries();
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <div className="mb-6 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold mb-2">New Journal Entry</h2>
                <div className="relative">
                    <textarea
                        value={newEntry}
                        onChange={(e) => setNewEntry(e.target.value)}
                        placeholder="Use this box for new entries only. To edit an entry, use the Live Chat assistant."
                        className="w-full p-3 pr-24 rounded-md bg-slate-100 dark:bg-slate-700 border-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        rows={4}
                        disabled={isSubmitting}
                    />
                    <button
                        onClick={handleSaveEntry}
                        disabled={isSubmitting || !newEntry.trim()}
                        className="absolute bottom-3 right-3 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                    >
                       {isSubmitting ? 'Saving...' : 'Save'}
                       {!isSubmitting && <SendIcon className="w-4 h-4 ml-2"/>}
                    </button>
                </div>
            </div>

            <div>
                <h2 className="text-xl font-bold mb-4">Past Entries</h2>
                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-4 rounded-md mb-4">
                        <p className="font-semibold">An error occurred with this journal:</p>
                        <p>{error}</p>
                        {(error.includes("Failed to read the sheet") || error.includes("Spreadsheet not found")) && (
                           <p className="mt-2 text-sm">Please check the sheet in Google Drive or select a different journal from the header.</p>
                        )}
                    </div>
                )}
                {isLoading ? (
                    <p>Loading entries...</p>
                ) : (
                    entries.map(entry => 
                        <EntryCard 
                            key={entry.id} 
                            entry={entry} 
                            isExpanded={expandedEntryId === entry.id}
                            onToggleExpand={() => setExpandedEntryId(prev => prev === entry.id ? null : entry.id)}
                        />
                    )
                )}
                 {!isLoading && entries.length === 0 && !error && (
                    <div className="text-center py-8 px-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <p className="text-slate-500 dark:text-slate-400">No journal entries yet.</p>
                        <p className="text-slate-500 dark:text-slate-400">Write your first entry above to get started!</p>
                    </div>
                )}
            </div>
        </div>
    );
};