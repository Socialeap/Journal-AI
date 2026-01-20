
import React, { useState, useEffect, useRef } from 'react';
import type { JournalEntry } from '../types';
import { addJournalEntry, updateEntryWithAI } from '../services/googleSheetsService';
import { generateSummaryAndInsight } from '../services/geminiService';
import { SendIcon } from './icons/SendIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface JournalViewProps {
    spreadsheetId: string;
    entries: JournalEntry[];
    isLoading: boolean;
    error: string | null;
    onRefresh: () => void;
    focusedEntryId: string | null;
    onClearFocus: () => void;
    onUpdateEntries: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
}

// Helper to safely render text with clickable links
const renderTextWithLinks = (text: string) => {
    if (!text) return null;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
        if (part.match(urlRegex)) {
            let cleanUrl = part;
            let trailing = '';
            const lastChar = part.slice(-1);
            if (['.', ',', ';', '!', ')', ']'].includes(lastChar)) {
                 cleanUrl = part.slice(0, -1);
                 trailing = lastChar;
            }

            return (
                <React.Fragment key={index}>
                    <a 
                        href={cleanUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                        {cleanUrl}
                    </a>
                    {trailing}
                </React.Fragment>
            );
        }
        return part;
    });
};

const EntryCard: React.FC<{ 
  entry: JournalEntry; 
  isExpanded: boolean; 
  onToggleExpand: () => void;
  innerRef?: React.Ref<HTMLDivElement>;
}> = ({ entry, isExpanded, onToggleExpand, innerRef }) => {
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
        <div ref={innerRef} className={`bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 mb-4 transition-all duration-300 ${isExpanded ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : ''}`}>
            <div className="flex justify-between items-start gap-4">
                 <div className="flex-grow min-w-0">
                    <div className="text-base text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                        {isExpanded 
                            ? renderTextWithLinks(entry.entry) 
                            : renderTextWithLinks(truncateText(entry.entry, 120))
                        }
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">{new Date(entry.timestamp).toLocaleString()}</p>
                 </div>
                 <button onClick={onToggleExpand} className="text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 flex-shrink-0 ml-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    {isExpanded ? 'Less' : 'More'}
                </button>
            </div>
            
            {isExpanded && (
                 <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                    {entry.status === 'analyzing' && (
                        <div className="flex items-center space-x-3 text-sky-600 dark:text-sky-400 p-2 bg-sky-50 dark:bg-sky-900/20 rounded-lg">
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            <span className="font-medium">AI is analyzing your entry...</span>
                        </div>
                    )}
            
                    {entry.status === 'complete' && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center mb-1">
                                    <SparklesIcon className="w-4 h-4 mr-2 text-sky-500"/> AI Summary
                                </h4>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{entry.aiSummary}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center mb-1">
                                    <SparklesIcon className="w-4 h-4 mr-2 text-purple-500"/> AI Insight
                                </h4>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{entry.aiInsight}</p>
                            </div>
                            {entry.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {entry.tags.map(tag => (
                                        <span key={tag} className="px-3 py-1 bg-slate-200 dark:bg-slate-600 text-sm font-medium rounded-full text-slate-700 dark:text-slate-200">#{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Display metadata if present, regardless of AI status */}
                    {(entry.type !== 'note' || entry.taskStatus !== 'none') && (
                        <div className="mt-4 pt-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
                            <span className="px-3 py-1.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 rounded-md">{entry.type}</span>
                            {entry.priority !== 'none' && (
                            <span className={`px-3 py-1.5 rounded-md ${priorityColors[entry.priority] ?? ''}`}>{entry.priority}</span>
                            )}
                            {entry.dueDate && <span className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md">Due: {entry.dueDate}</span>}
                            {entry.taskStatus !== 'none' && <span className="px-3 py-1.5 bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300 rounded-md">{entry.taskStatus.replace('-', ' ')}</span>}
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
                                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                                <span className="font-semibold">Summary: </span>{entry.aiSummary}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {entry.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-xs font-medium rounded-full">{tag}</span>
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

export const JournalView: React.FC<JournalViewProps> = ({ 
    spreadsheetId, 
    entries, 
    isLoading, 
    error, 
    onRefresh, 
    focusedEntryId,
    onClearFocus,
    onUpdateEntries
}) => {
    const [newEntry, setNewEntry] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
    
    // Manual Input States
    const [entryType, setEntryType] = useState<JournalEntry['type']>('note');
    const [entryStatus, setEntryStatus] = useState<JournalEntry['taskStatus']>('none');
    const [entryPriority, setEntryPriority] = useState<JournalEntry['priority']>('none');
    const [entryDueDate, setEntryDueDate] = useState('');

    // Refs for scrolling to specific entries
    const entryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Drill-Down Effect: Scroll to entry if focusedEntryId provided
    useEffect(() => {
        if (focusedEntryId) {
            setExpandedEntryId(focusedEntryId);
            const element = entryRefs.current[focusedEntryId];
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
            onClearFocus();
        }
    }, [focusedEntryId, onClearFocus]);

    const handleSaveEntry = async () => {
        if (!newEntry.trim()) return;
        setIsSubmitting(true);
        setSubmissionError(null);
        
        const newEntryId = (Math.random() + 1).toString(36).substring(7);
        const newEntryText = newEntry;
        const timestamp = new Date().toISOString();
        
        // Prepare metadata from manual inputs
        const metadata = {
            type: entryType,
            taskStatus: entryStatus,
            priority: entryPriority,
            dueDate: entryDueDate || null
        };

        try {
            // Step 1: Add the basic entry to the sheet with MANUAL METADATA
            const newRowNumber = await addJournalEntry(spreadsheetId, newEntryId, newEntryText, metadata);
            
            // Reset form
            setNewEntry('');
            setEntryType('note');
            setEntryStatus('none');
            setEntryPriority('none');
            setEntryDueDate('');

            // Step 2: Optimistic Update
            const optimisticEntry: JournalEntry = {
                id: newEntryId,
                row: newRowNumber,
                timestamp: timestamp,
                entry: newEntryText,
                tags: [],
                type: metadata.type,
                taskStatus: metadata.taskStatus,
                dueDate: metadata.dueDate,
                priority: metadata.priority,
                aiSummary: null,
                aiInsight: null,
                status: 'analyzing'
            };

            onUpdateEntries(prev => [optimisticEntry, ...prev]);

            // Step 3: Get AI insights
            const aiData = await generateSummaryAndInsight(newEntryText);
            
            // Step 4: Update the entry in the sheet with AI data
            if (aiData) {
                // Map AI legacy status to App status
                let aiStatus: JournalEntry['taskStatus'] = 'none';
                if (aiData.taskStatus === 'todo' || aiData.taskStatus === 'in-progress') aiStatus = 'Pending ✨';
                else if (aiData.taskStatus === 'done') aiStatus = 'Completed ✔️';
                else if (aiData.taskStatus === 'none') aiStatus = 'none';

                // Merge logic: prefer manual inputs if they differ from default/none, otherwise accept AI suggestion
                const mergedData = {
                    summary: aiData.summary,
                    insight: aiData.insight,
                    tags: aiData.tags,
                    type: metadata.type !== 'note' ? metadata.type : aiData.type,
                    taskStatus: metadata.taskStatus !== 'none' ? metadata.taskStatus : aiStatus,
                    priority: metadata.priority !== 'none' ? metadata.priority : aiData.priority,
                    dueDate: metadata.dueDate ? metadata.dueDate : aiData.dueDate
                };

                await updateEntryWithAI(spreadsheetId, optimisticEntry, mergedData);
                
                // Update local state to reflect completion
                onUpdateEntries(prev => prev.map(e => e.id === newEntryId ? {
                    ...e,
                    ...mergedData,
                    status: 'complete',
                    aiSummary: aiData.summary,
                    aiInsight: aiData.insight
                } : e));
            }
            // Finally refresh real data to ensure consistency
            onRefresh();

        } catch (error) {
            console.error("Failed to save entry:", error);
            setSubmissionError(error instanceof Error ? error.message : "An unknown error occurred.");
            onRefresh();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700">
                <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">New Journal Entry</h2>
                
                {/* Text Input - Text Base for Mobile */}
                <div className="relative mb-6">
                    <textarea
                        value={newEntry}
                        onChange={(e) => setNewEntry(e.target.value)}
                        placeholder="What's on your mind? AI will analyze this for you."
                        className="w-full p-4 text-base rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-y min-h-[140px]"
                        rows={5}
                        disabled={isSubmitting}
                    />
                </div>

                {/* Manual Details Section - Responsive Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Type</label>
                        <div className="relative">
                            <select 
                                value={entryType}
                                onChange={(e) => {
                                    const newType = e.target.value as JournalEntry['type'];
                                    setEntryType(newType);
                                    if (newType === 'task' && entryStatus === 'none') setEntryStatus('Pending ✨');
                                }}
                                className="w-full text-base p-3 rounded-xl bg-slate-100 dark:bg-slate-700 border-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                disabled={isSubmitting}
                            >
                                <option value="note">Note</option>
                                <option value="task">Task</option>
                                <option value="work">Work</option>
                                <option value="personal">Personal</option>
                            </select>
                            {/* Chevron */}
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Status</label>
                         <div className="relative">
                            <select 
                                value={entryStatus}
                                onChange={(e) => setEntryStatus(e.target.value as JournalEntry['taskStatus'])}
                                className="w-full text-base p-3 rounded-xl bg-slate-100 dark:bg-slate-700 border-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                disabled={isSubmitting}
                            >
                                <option value="none">None</option>
                                <option value="Pending ✨">Pending ✨</option>
                                <option value="Extended ⏳">Extended ⏳</option>
                                <option value="Completed ✔️">Completed ✔️</option>
                                <option value="Neglected ⚠️">Neglected ⚠️</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Priority</label>
                         <div className="relative">
                            <select 
                                value={entryPriority}
                                onChange={(e) => setEntryPriority(e.target.value as JournalEntry['priority'])}
                                className="w-full text-base p-3 rounded-xl bg-slate-100 dark:bg-slate-700 border-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                disabled={isSubmitting}
                            >
                                <option value="none">None</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Due Date</label>
                        <input 
                            type="date"
                            value={entryDueDate}
                            onChange={(e) => setEntryDueDate(e.target.value)}
                            className="w-full text-base p-3 rounded-xl bg-slate-100 dark:bg-slate-700 border-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-200"
                            disabled={isSubmitting}
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSaveEntry}
                        disabled={isSubmitting || !newEntry.trim()}
                        className="w-full sm:w-auto flex items-center justify-center px-8 py-3 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                    >
                       {isSubmitting ? 'Saving...' : 'Save Entry'}
                       {!isSubmitting && <SendIcon className="w-5 h-5 ml-2"/>}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-bold mb-4 px-1 text-slate-800 dark:text-white">Past Entries</h2>
                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-4 rounded-xl mb-4">
                        <p className="font-semibold">An error occurred loading entries:</p>
                        <p>{error}</p>
                    </div>
                )}
                 {submissionError && (
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-4 rounded-xl mb-4">
                        <p className="font-semibold">Failed to save entry:</p>
                        <p>{submissionError}</p>
                    </div>
                )}
                {isLoading && entries.length === 0 ? (
                    <div className="flex justify-center py-12">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    entries.map(entry => 
                        <EntryCard 
                            key={entry.id} 
                            innerRef={el => { entryRefs.current[entry.id] = el }}
                            entry={entry} 
                            isExpanded={expandedEntryId === entry.id}
                            onToggleExpand={() => setExpandedEntryId(prev => prev === entry.id ? null : entry.id)}
                        />
                    )
                )}
                 {!isLoading && entries.length === 0 && !error && (
                    <div className="text-center py-12 px-6 bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                        <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">No journal entries yet.</p>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">Write your first entry above or use the Voice Chat to get started!</p>
                    </div>
                )}
            </div>
        </div>
    );
};
