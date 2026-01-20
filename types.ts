
export interface JournalEntry {
  id: string;
  row: number; // The row number in the Google Sheet for direct updates
  timestamp: string; // Corresponds to "Date Created"
  entry: string;
  tags: string[];
  type: 'personal' | 'work' | 'task' | 'note';
  // Updated status types to match new requirements
  taskStatus: 'Pending ✨' | 'Extended ⏳' | 'Completed ✔️' | 'Neglected ⚠️' | 'Archived 🗄️' | 'none'; 
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high' | 'none';
  
  // AI-generated content
  aiSummary: string | null;
  aiInsight: string | null;
  
  // Internal processing status
  status: 'new' | 'analyzing' | 'complete';
}

export type View = 'journal' | 'live-chat' | 'dashboard';

export interface TranscriptEntry {
  source: 'user' | 'ai' | 'system';
  text: string;
}

export interface JournalSheet {
  id: string;
  name: string;
}
