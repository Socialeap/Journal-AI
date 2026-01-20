
import React from 'react';

interface LegacyDashboardLayoutProps {
  title: string;
  subtitle: string;
  stats: React.ReactNode;
  children: React.ReactNode;
}

export const LegacyDashboardLayout: React.FC<LegacyDashboardLayoutProps> = ({
  title,
  subtitle,
  stats,
  children
}) => {
  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-900">
      {/* Legacy "Project Watch" Header Style */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats}
      </div>

      {/* Main Content Area */}
      <div className="bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {children}
        </div>
      </div>
    </div>
  );
};
