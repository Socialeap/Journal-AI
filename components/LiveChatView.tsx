

import React from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { MicIcon } from './icons/MicIcon';
import type { TranscriptEntry } from '../types';
import { VoiceVisualizer } from './VoiceVisualizer';

interface LiveChatViewProps {
  spreadsheetId: string;
}

const TranscriptLine: React.FC<{ entry: TranscriptEntry }> = ({ entry }) => {
    if (entry.source === 'system') {
        return (
            <div className="text-center my-2">
                <span className="px-3 py-1 bg-slate-700 text-slate-400 text-xs rounded-full">
                    {entry.text}
                </span>
            </div>
        );
    }

    const isUser = entry.source === 'user';
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-md p-3 rounded-lg shadow-sm ${
                isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-200'
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
    analyserNode,
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
        return { text: 'Stop Conversation', color: 'bg-red-600 hover:bg-red-700', disabled: false };
      case 'PROCESSING':
        return { text: 'Processing...', color: 'bg-gray-500', disabled: true };
      case 'ERROR':
        return { text: 'Start Conversation', color: 'bg-blue-600 hover:bg-blue-700', disabled: false };
      default:
        return { text: 'Start Conversation', color: 'bg-blue-600 hover:bg-blue-700', disabled: false };
    }
  };

  const buttonState = getButtonState();
  const isSessionActive = sessionState === 'LISTENING' || sessionState === 'PROCESSING' || sessionState === 'CONNECTING';

  const handleButtonClick = () => {
    if (sessionState === 'IDLE' || sessionState === 'ERROR') {
      startSession();
    } else if (sessionState === 'LISTENING') {
      stopSession();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-slate-900 rounded-lg shadow-xl overflow-hidden">
      {/* Top Part: Main visualizer area */}
      <div className="flex-grow relative flex items-center justify-center p-4">
        <VoiceVisualizer analyserNode={analyserNode} />
      </div>

      {/* Bottom Part: Transcript and Controls */}
      <div className="flex-shrink-0 bg-slate-800/50 backdrop-blur-sm border-t border-slate-700">
        
        {/* Scrollable Transcript Area */}
        <div className="h-40 overflow-y-auto p-4 space-y-4">
          {!isSessionActive && transcript.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
              <p>Click the microphone to talk with your AI assistant.</p>
            </div>
          )}
          {transcript.map((entry, index) => (
            <TranscriptLine key={index} entry={entry} />
          ))}
        </div>
        
        {/* Controls */}
        <div className="p-4 flex flex-col items-center">
          <button
            onClick={handleButtonClick}
            disabled={buttonState.disabled}
            className={`px-8 py-4 rounded-full text-white font-bold transition-all duration-300 flex items-center space-x-3 shadow-lg transform hover:scale-105 disabled:bg-slate-500 disabled:transform-none ${buttonState.color}`}
          >
            <MicIcon className="w-6 h-6" />
            <span>{buttonState.text}</span>
          </button>
          {sessionState === 'LISTENING' && (
            <p className="text-sm text-slate-400 mt-2 animate-pulse">
              Listening...
            </p>
          )}
          {sessionState === 'ERROR' && (
            <p className="text-sm text-red-400 mt-2">
              An error occurred. Please try again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
