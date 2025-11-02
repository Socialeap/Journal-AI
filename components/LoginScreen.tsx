import React from 'react';
import { GoogleIcon } from './icons/GoogleIcon';

interface LoginScreenProps {
  onLoginClick: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginClick }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900">
      <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">AI Journal</h1>
        <p className="text-slate-600 dark:text-slate-300 mb-6">Connect with Google Sheets to start journaling.</p>
        <button
          onClick={onLoginClick}
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <GoogleIcon className="w-5 h-5 mr-3" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
};