
import React from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { MicIcon } from './icons/MicIcon';
import { VoiceVisualizer } from './VoiceVisualizer';
import type { TranscriptEntry } from '../types';

interface LiveChatViewProps {
  spreadsheetId: string;
}

const TranscriptLine: React.FC<{ entry: TranscriptEntry }> = ({ entry }) => {
    if (entry.source === 'system') {
        return (
            <div className="text-center my-2">
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs rounded-full">
                    {entry.text}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex ${entry.source === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-md p-3 rounded-lg ${
                entry.source === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}
            >
                {entry.text}
            </div>
        </div>
    );
};


export const LiveChatView: React.FC<LiveChatViewProps> = ({ spreadsheetId }) => {
  const {
    sessionState,
    transcript,
    micVolume,
    startSession,
    stopSession,
  } = useGeminiLive(spreadsheetId);

  const getButtonState = () => {
    switch (sessionState) {
      case 'IDLE':
        return { text: 'Start Conversation', color: 'bg-blue-600 hover:bg-blue-700', disabled: false };
      case 'CONNECTING':
        return { text: 'Connecting...', color: 'bg-yellow-500', disabled: true };
      case 'LISTENING':
        return { text: 'Listening...', color: 'bg-green-500', disabled: false };
      case 'PROCESSING':
        return { text: 'Processing...', color: 'bg-purple-500', disabled: true };
      case 'ERROR':
        return { text: 'Error - Click to Restart', color: 'bg-red-600 hover:bg-red-700', disabled: false };
      default:
        return { text: 'Start', color: 'bg-slate-500', disabled: true };
    }
  };

  const { text, color, disabled } = getButtonState();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="h-96 bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-4 overflow-y-auto flex flex-col-reverse">
        {transcript.length === 0 && (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-slate-500 dark:text-slate-400">
              The conversation transcript will appear here.
            </p>
          </div>
        )}
        <div className="space-y-4">
          {[...transcript].reverse().map((entry, index) => (
            <TranscriptLine key={index} entry={entry} />
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center">
        <div className="h-12 flex items-center justify-center mb-4">
            {sessionState === 'LISTENING' ? (
                <VoiceVisualizer volume={micVolume} />
            ) : (
                <span className="text-slate-500 dark:text-slate-400">
                    {sessionState === 'IDLE' ? 'Click to start' : text}
                </span>
            )}
        </div>
        <button
            onClick={sessionState === 'IDLE' || sessionState === 'ERROR' ? startSession : stopSession}
            disabled={disabled}
            aria-label={sessionState === 'IDLE' ? 'Start conversation' : 'Stop conversation'}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${color} text-white shadow-lg focus:outline-none focus:ring-4 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                sessionState === 'LISTENING' ? 'ring-4 ring-green-400/50' : `focus:ring-blue-500/50`
            }`}
        >
          <MicIcon className="w-8 h-8" />
        