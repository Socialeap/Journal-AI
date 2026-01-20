
import React from 'react';
import { LegacyItem } from './types';

interface LegacyProjectCardProps {
  item: LegacyItem;
  onClick?: (id: string) => void;
  onEdit?: (item: LegacyItem) => void;
}

const statusColors: Record<string, string> = {
  'Pending ✨': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Extended ⏳': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'Completed ✔️': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Neglected ⚠️': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'Archived 🗄️': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  'none': 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
  // Fallbacks for legacy/transitional states
  'todo': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'done': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'NEW ✨': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

const priorityColors = {
  'high': 'border-l-4 border-rose-500',
  'medium': 'border-l-4 border-amber-500',
  'low': 'border-l-4 border-emerald-500',
  'none': 'border-l-4 border-transparent'
};

// Helper to safely render text with clickable links
const renderTextWithLinks = (text: string) => {
    if (!text) return null;

    // Regex to find URLs (http/https)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
        if (part.match(urlRegex)) {
            // Basic heuristic to strip trailing punctuation from the URL itself
            // (e.g. "Check google.com." -> link="google.com", text=".")
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
                        onClick={(e) => e.stopPropagation()} // Prevent card click
                        className="text-blue-600 dark:text-blue-400 hover:underline z-10 relative break-all"
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

export const LegacyProjectCard: React.FC<LegacyProjectCardProps> = ({ item, onClick, onEdit }) => {
  return (
    <div 
      className={`group bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm hover:shadow-md transition-all border border-slate-100 dark:border-slate-700 relative ${priorityColors[item.priority]}`}
    >
      {/* Primary Click Area */}
      <div 
        onClick={() => onClick?.(item.id)}
        className="cursor-pointer"
      >
        <div className="flex justify-between items-start mb-2 pr-8">
          <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-1">{item.title}</h3>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[item.status] || statusColors['none']}`}>
            {item.status.replace('-', ' ')}
          </span>
        </div>
        
        {/* Description with interactive links */}
        <div className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-2 h-10">
          {renderTextWithLinks(item.description)}
        </div>
        
        <div className="flex items-center gap-2 mb-4 overflow-hidden">
          {item.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
              #{tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          <span>{new Date(item.date).toLocaleDateString()}</span>
          <div className="flex gap-3">
              {item.meta.map((m, i) => (
                  <span key={i}><strong>{m.label}:</strong> {m.value}</span>
              ))}
          </div>
        </div>
      </div>

      {/* Edit Button - Always visible on touch screens (via lg: breakpoint logic) or on hover for desktop */}
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item);
          }}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 dark:hover:text-blue-400 rounded-md transition-colors 
                     opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100"
          aria-label="Edit entry"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}
    </div>
  );
};
