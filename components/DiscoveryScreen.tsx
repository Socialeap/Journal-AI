
import React from 'react';

export const DiscoveryScreen: React.FC = () => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
            <div className="text-center p-8">
                <div className="flex justify-center items-center mb-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Welcome Back!</h1>
                <p className="text-slate-600 dark:text-slate-300">
                    Searching your Google Drive for existing AI Journals...
                </p>
            </div>
        </div>
    );
};
