
import React, { useState, useEffect } from 'react';
import { useJournalAnalytics } from '../hooks/useJournalAnalytics';
import { 
  LegacyDashboardLayout, 
  LegacyStatCard, 
  LegacyProjectCard,
  LegacyModal,
  LegacyInput,
  LegacySelect,
  LegacyButton,
  LegacyItem
} from './legacy-ui-export';
import { updateJournalEntry } from '../services/googleSheetsService';
import type { JournalEntry } from '../types';

interface DashboardViewProps {
  spreadsheetId: string;
  entries: JournalEntry[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onNavigate: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
    spreadsheetId, 
    entries, 
    isLoading,
    error,
    onRefresh,
    onNavigate 
}) => {
  // USE THE ADAPTER: Transform data into "dumb" UI format
  const { legacyItems, stats } = useJournalAnalytics(entries);
  
  // Local state for the "Quick Edit" modal
  const [editingItem, setEditingItem] = useState<LegacyItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
      status: '',
      priority: '',
      dueDate: ''
  });

  const handleEditClick = (item: LegacyItem) => {
      setEditingItem(item);
      // Find the original entry to get exact due date if needed, or use meta
      // For simplicity, we initialize from the visual legacy item
      const dueMeta = item.meta.find(m => m.label === 'Due');
      setFormData({
          status: item.status,
          priority: item.priority,
          dueDate: dueMeta && dueMeta.value !== 'N/A' ? dueMeta.value : ''
      });
      setIsModalOpen(true);
  };

  const handleSave = async () => {
      if (!editingItem) return;
      
      const originalEntry = entries.find(e => e.id === editingItem.id);
      if (!originalEntry) {
          console.error("Could not find original entry for ID:", editingItem.id);
          return;
      }

      setIsSaving(true);
      try {
          if (formData.status !== editingItem.status) {
              await updateJournalEntry(spreadsheetId, originalEntry.row, 'taskStatus', formData.status);
          }
          if (formData.priority !== editingItem.priority) {
              await updateJournalEntry(spreadsheetId, originalEntry.row, 'priority', formData.priority);
          }
          if (formData.dueDate && formData.dueDate !== (originalEntry.dueDate || '')) {
              await updateJournalEntry(spreadsheetId, originalEntry.row, 'dueDate', formData.dueDate);
          }
          
          await onRefresh(); 
          setIsModalOpen(false);
      } catch (e) {
          console.error("Failed to update entry:", e);
          alert("Failed to update entry. Check console for details.");
      } finally {
          setIsSaving(false);
      }
  };

  const handleExtend = async () => {
      if (!editingItem || !formData.dueDate) return;
      const originalEntry = entries.find(e => e.id === editingItem.id);
      if (!originalEntry) return;

      setIsSaving(true);
      try {
          const currentDue = new Date(formData.dueDate);
          currentDue.setDate(currentDue.getDate() + 5);
          const newDateStr = currentDue.toISOString().split('T')[0];

          await updateJournalEntry(spreadsheetId, originalEntry.row, 'dueDate', newDateStr);
          await updateJournalEntry(spreadsheetId, originalEntry.row, 'taskStatus', 'Extended ⏳');
          
          await onRefresh();
          setIsModalOpen(false);
      } catch (e) {
          console.error("Failed to extend entry:", e);
          alert("Failed to extend entry.");
      } finally {
          setIsSaving(false);
      }
  };

  const handleArchive = async () => {
      if (!editingItem) return;
      const originalEntry = entries.find(e => e.id === editingItem.id);
      if (!originalEntry) return;

      if (!window.confirm("Are you sure you want to archive this entry? It will be removed from the Dashboard.")) {
          return;
      }

      setIsSaving(true);
      try {
          await updateJournalEntry(spreadsheetId, originalEntry.row, 'taskStatus', 'Archived 🗄️');
          await onRefresh();
          setIsModalOpen(false);
      } catch (e) {
          console.error("Failed to archive entry:", e);
          alert("Failed to archive entry.");
      } finally {
          setIsSaving(false);
      }
  };

  if (isLoading && entries.length === 0) {
      return (
          <LegacyDashboardLayout
            title="Project Watch Dashboard"
            subtitle="Loading your insights..."
            stats={
                <div className="col-span-4 flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            }
          >
             <div className="col-span-full text-center text-slate-500">Please wait while we fetch your journal data...</div>
          </LegacyDashboardLayout>
      );
  }

  if (error && entries.length === 0) {
    return (
        <LegacyDashboardLayout
          title="Project Watch Dashboard"
          subtitle="Connection Issue"
          stats={<div />}
        >
           <div className="col-span-full p-6 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
               <p className="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load dashboard data</p>
               <p className="text-sm text-red-500 dark:text-red-300 mb-4">{error}</p>
               <LegacyButton onClick={onRefresh}>Try Again</LegacyButton>
           </div>
        </LegacyDashboardLayout>
    );
  }

  return (
    <>
        <LegacyDashboardLayout
          title="Project Watch Dashboard"
          subtitle="Visual insights from your Journal Entries"
          stats={
            <>
              {stats.map((stat, i) => (
                <LegacyStatCard key={i} {...stat} />
              ))}
            </>
          }
        >
          {legacyItems.map((item) => (
            <LegacyProjectCard 
              key={item.id} 
              item={item} 
              onClick={(id) => onNavigate(id)} 
              onEdit={handleEditClick}
            />
          ))}
        </LegacyDashboardLayout>

        <LegacyModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Edit Task Details"
            footer={
                <div className="flex justify-between w-full">
                    <LegacyButton variant="danger" onClick={handleArchive} disabled={isSaving}>
                        Archive 🗄️
                    </LegacyButton>
                    <div className="flex gap-2">
                        <LegacyButton variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                            Cancel
                        </LegacyButton>
                        <LegacyButton variant="primary" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save'}
                        </LegacyButton>
                    </div>
                </div>
            }
        >
            <div className="space-y-4">
                 <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-md mb-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                        {editingItem?.title}
                    </p>
                 </div>

                 <LegacySelect
                    label="Status"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    options={[
                        { label: 'Pending ✨', value: 'Pending ✨' },
                        { label: 'Extended ⏳', value: 'Extended ⏳' },
                        { label: 'Completed ✔️', value: 'Completed ✔️' },
                        { label: 'Neglected ⚠️', value: 'Neglected ⚠️' },
                        { label: 'Archived 🗄️', value: 'Archived 🗄️' },
                        { label: 'None', value: 'none' }
                    ]}
                 />

                 <LegacySelect
                    label="Priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    options={[
                        { label: 'High', value: 'high' },
                        { label: 'Medium', value: 'medium' },
                        { label: 'Low', value: 'low' },
                        { label: 'None', value: 'none' }
                    ]}
                 />

                 <div className="flex items-end gap-2">
                     <div className="flex-grow">
                        <LegacyInput
                            label="Due Date"
                            type="date"
                            value={formData.dueDate}
                            onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                        />
                     </div>
                     <div className="mb-4">
                        <button
                            onClick={handleExtend}
                            disabled={!formData.dueDate || isSaving}
                            className="px-3 py-2 bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 rounded-md text-sm font-medium hover:bg-orange-200 transition-colors h-[42px] whitespace-nowrap"
                            title="Add 5 days to due date"
                        >
                            Extend (+5d) ⏳
                        </button>
                     </div>
                 </div>
            </div>
        </LegacyModal>
    </>
  );
};
