
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
            <div className="text-center my-3">
                <span className="inline-block px-4 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-full shadow-sm">
                    {entry.text}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex ${entry.source === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] md:max-w-md p-4 rounded-2xl text-lg leading-relaxed shadow-sm ${
                entry.source === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200 dark:border-slate-600'
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
    errorMessage
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
        return { text: 'Error - Tap to Retry', color: 'bg-red-600 hover:bg-red-700', disabled: false };
      default:
        return { text: 'Start', color: 'bg-slate-500', disabled: true };
    }
  };

  const { text, color, disabled } = getButtonState();

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="flex-grow bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 md:p-6 space-y-6 overflow-y-auto flex flex-col-reverse shadow-inner">
        {transcript.length === 0 && sessionState !== 'ERROR' && (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8 opacity-60">
            <MicIcon className="w-16 h-16 text-slate-400 mb-4" />
            <p className="text-xl font-medium text-slate-500 dark:text-slate-400">
              Tap the microphone to start chatting with your AI Journal Assistant.
            </p>
          </div>
        )}

        {sessionState === 'ERROR' && errorMessage && (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
                <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-xl border border-red-200 dark:border-red-800">
                    <p className="text-lg font-semibold text-red-600 dark:text-red-300 mb-2">Connection Issue</p>
                    <p className="text-slate-700 dark:text-slate-300">{errorMessage}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
                        Tip: Close any active chat bubbles or screen overlays from other apps.
                    </p>
                </div>
            </div>
        )}

        <div className="space-y-6">
          {[...transcript].reverse().map((entry, index) => (
            <TranscriptLine key={index} entry={entry} />
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center shrink-0">
        <div className="h-12 flex items-center justify-center mb-4">
            {sessionState === 'LISTENING' ? (
                <VoiceVisualizer volume={micVolume} />
            ) : (
                <span className="text-lg font-medium text-slate-600 dark:text-slate-300">
                    {sessionState === 'IDLE' ? 'Click to start' : text}
                </span>
            )}
        </div>
        <button
            onClick={sessionState === 'IDLE' || sessionState === 'ERROR' ? startSession : stopSession}
            disabled={disabled}
            aria-label={sessionState === 'IDLE' ? 'Start conversation' : 'Stop conversation'}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${color} text-white shadow-xl focus:outline-none focus:ring-4 focus:ring-offset-4 dark:focus:ring-offset-slate-900 ${
                sessionState === 'LISTENING' ? 'ring-4 ring-green-400/50 scale-105' : `focus:ring-blue-500/50`
            }`}
        >
          <MicIcon className="w-10 h-10" />
        </button>
      </div>
    </div>
  );
};
