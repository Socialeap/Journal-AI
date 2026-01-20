
import React from 'react';
import { LegacyStat } from './types';

interface LegacyStatCardProps extends LegacyStat {
  icon?: React.ReactNode;
}

const colorMap = {
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
  slate: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const LegacyStatCard: React.FC<LegacyStatCardProps> = ({ 
  label, 
  value, 
  trend, 
  colorScheme = 'slate',
  icon 
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
          {trend && (
            <p className="text-xs mt-1 text-slate-400">
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorMap[colorScheme]}`}>
          {icon || <div className="w-6 h-6" />}
        </div>
      </div>
    </div>
  );
};
