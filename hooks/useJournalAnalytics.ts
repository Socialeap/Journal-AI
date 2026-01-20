
import { useMemo } from 'react';
import type { JournalEntry } from '../types';
import type { LegacyItem, LegacyStat } from '../components/legacy-ui-export/types';

export const useJournalAnalytics = (entries: JournalEntry[]) => {
  
  // 1. Transform Logic: Core Data -> Legacy UI Data
  const legacyItems: LegacyItem[] = useMemo(() => {
    // Filter out Archived items from the list view
    return entries
        .filter(entry => entry.taskStatus !== 'Archived 🗄️')
        .map(entry => ({
            id: entry.id,
            title: entry.aiSummary || entry.entry.substring(0, 50) + '...',
            description: entry.aiInsight || entry.entry,
            status: entry.taskStatus === 'none' ? 'active' : entry.taskStatus,
            tags: entry.tags,
            date: entry.timestamp,
            priority: entry.priority,
            meta: [
                { label: 'Type', value: entry.type },
                { label: 'Due', value: entry.dueDate || 'N/A' }
            ]
        }));
  }, [entries]);

  // 2. Calculation Logic: Derived Statistics
  const stats: LegacyStat[] = useMemo(() => {
    const total = entries.length;
    const activeEntries = entries.filter(e => e.taskStatus !== 'Archived 🗄️');
    
    // Count specific task statuses
    const newTasks = activeEntries.filter(e => e.taskStatus === 'Pending ✨').length;
    const completed = activeEntries.filter(e => e.taskStatus === 'Completed ✔️').length;
    const neglected = activeEntries.filter(e => e.taskStatus === 'Neglected ⚠️').length;
    
    // Calculate simple trend (last 7 days)
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentCount = entries.filter(e => new Date(e.timestamp) > oneWeekAgo).length;

    return [
      { 
        label: 'Pending', 
        value: newTasks, 
        trend: `+${recentCount} total added this week`, 
        colorScheme: 'indigo' 
      },
      { 
        label: 'Neglected ⚠️', 
        value: neglected, 
        trend: 'Needs attention',
        colorScheme: 'rose' 
      },
      { 
        label: 'Completed ✔️', 
        value: completed, 
        colorScheme: 'emerald' 
      },
      { 
        label: 'Active Items', 
        value: activeEntries.length, 
        colorScheme: 'slate' 
      }
    ];
  }, [entries]);

  return { legacyItems, stats };
};
