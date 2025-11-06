
import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import * as Sheets from '../services/googleSheetsService';
import type { TranscriptEntry } from '../types';

type SessionState = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'PROCESSING' | 'ERROR';

// FIX: Redefined LiveSession to match the SDK's Session object,
// which has separate methods for sending media and tool responses.
interface LiveSession {
    close: () => void;
    sendRealtimeInput(req: { media: Blob }): void;
    sendToolResponse(req: { functionResponses: any }): void;
}

const findEntriesTool: FunctionDeclaration = {
    name: 'findEntries',
    description: 'Searches the user\'s journal for entries matching a query. Returns a list of matching entries with their content and row number.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description: 'The keyword or phrase to search for in the journal entries. If empty, returns the 5 most recent entries.',
            },
        },
        required: ['query'],
    },
};

const updateJournalEntryTool: FunctionDeclaration = {
    name: 'updateJournalEntry',
    description: 'Updates a specific field of a journal entry in the spreadsheet.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            row: {
                type: Type.INTEGER,
                description: 'The row number of the entry to update.',
            },
            field: {
                type: Type.STRING,
                description: 'The field to update. Must be one of: "entry", "tags", "type", "taskStatus", "dueDate", "priority".',
            },
            value: {
                type: Type.STRING,
                description: 'The new value for the field.',
            },
        },
        required: ['row', 'field', 'value'],
    },
};


export const useGeminiLive = (spreadsheetId: string) => {
    const [sessionState, setSessionState] = useState<SessionState>('IDLE');
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

    const sessionRef = useRef<LiveSession | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextAudioStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const currentTranscriptRef = useRef<TranscriptEntry[]>([]);

    const addTranscript = (entry: TranscriptEntry) => {
        currentTranscriptRef.current = [...currentTranscriptRef.current, entry];
        setTranscript(currentTranscriptRef.current);
    }
    const updateLastTranscript = (updater: (prev: TranscriptEntry) => TranscriptEntry) => {
         const lastIndex = currentTranscriptRef.current.length - 1;
         if (lastIndex >= 0) {
            currentTranscriptRef.current[lastIndex] = updater(currentTranscriptRef.current[lastIndex]);
            setTranscript([...currentTranscriptRef.current]);
         }
    }


    const stopSession = useCallback(() => {
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (inputAudioContextRef.current?.state !== 'closed') {
            inputAudioContextRef.current?.close();
        }
        if (outputAudioContextRef.current?.state !== 'closed') {
             outputAudioContextRef.current?.close();
        }
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        setSessionState('IDLE');
    }, []);

    const startSession = useCallback(async () => {
        setSessionState('CONNECTING');
        currentTranscriptRef.current = [];
        setTranscript([]);
        
        try {
            if (!process.env.API_KEY) throw new Error("API_KEY is not set.");
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const systemInstruction = `You are a helpful and empathetic journal assistant.
Your primary role is to help the user manage their journal, which is stored in a Google Sheet.
You can find entries and update them using the provided tools.

**IMPORTANT RULES:**
- Before updating any entry, you MUST first use the 'findEntries' tool to locate the correct row number.
- Always confirm the action with the user before making an update.
- Be conversational and concise.

**Spreadsheet Schema:**
- Column A: ID (auto-generated)
- Column B: Date Created (auto-generated)
- Column C: Entry (The main text of the journal)
- Column D: Tags (Comma-separated keywords)
- Column E: Type ('personal', 'work', 'task', 'note')
- Column F: Status ('todo', 'in-progress', 'done', 'none')
- Column G: Due Date (YYYY-MM-DD)
- Column H: Priority ('low', 'medium', 'high', 'none')
- Column I: AI Summary (auto-generated)
- Column J: AI Insight (auto-generated)`;

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                    systemInstruction: systemInstruction,
                    tools: [{ functionDeclarations: [findEntriesTool, updateJournalEntryTool] }]
                },
                callbacks: {
                    onopen: async () => {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        mediaStreamRef.current = stream;

                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                        
                        setSessionState('LISTENING');
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle transcriptions
                        if (message.serverContent?.inputTranscription) {
                            const { text } = message.serverContent.inputTranscription;
                            const last = currentTranscriptRef.current[currentTranscriptRef.current.length - 1];
                            if (last?.source === 'user') {
                                updateLastTranscript(prev => ({...prev, text: prev.text + text}));
                            } else {
                                addTranscript({ source: 'user', text });
                            }
                        }
                        
                        if (message.serverContent?.outputTranscription) {
                            const { text } = message.serverContent.outputTranscription;
                            const last = currentTranscriptRef.current[currentTranscriptRef.current.length - 1];
                             if (last?.source === 'ai') {
                                updateLastTranscript(prev => ({...prev, text: prev.text + text}));
                            } else {
                                addTranscript({ source: 'ai', text });
                            }
                        }

                        // Handle Function Calling
                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                let result;
                                try {
                                    if (fc.name === 'findEntries') {
                                        addTranscript({ source: 'system', text: `Searching journal for "${fc.args.query}"...` });
                                        // FIX: Cast query to string to satisfy findEntries function signature.
                                        const found = await Sheets.findEntries(spreadsheetId, String(fc.args.query));
                                        result = { result: JSON.stringify(found) };
                                    } else if (fc.name === 'updateJournalEntry') {
                                        addTranscript({ source: 'system', text: `Updating ${fc.args.field} to "${fc.args.value}" on row ${fc.args.row}...` });
                                        // FIX: Cast arguments to their expected types for updateJournalEntry.
                                        await Sheets.updateJournalEntry(spreadsheetId, Number(fc.args.row), String(fc.args.field) as any, String(fc.args.value));
                                        result = { result: "Update successful." };
                                    }
                                } catch (e) {
                                    console.error(e);
                                    result = { error: { message: e instanceof Error ? e.message : String(e) } };
                                }

                                sessionPromise.then(session => {
                                    // FIX: Use session.sendToolResponse and provide the correct payload structure.
                                    session.sendToolResponse({
                                        functionResponses: { id: fc.id, name: fc.name, response: result }
                                    });
                                });
                            }
                        }

                        // Handle audio playback
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData) {
                            const outputCtx = outputAudioContextRef.current;
                            if (!outputCtx) return;

                            nextAudioStartTimeRef.current = Math.max(nextAudioStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                            source.start(nextAudioStartTimeRef.current);
                            nextAudioStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                        if (message.serverContent?.interrupted) {
                           audioSourcesRef.current.forEach(source => source.stop());
                           audioSourcesRef.current.clear();
                           nextAudioStartTimeRef.current = 0;
                        }
                    },
                    onclose: () => stopSession(),
                    onerror: (e) => {
                        console.error("Live session error:", e);
                        setSessionState('ERROR');
                        stopSession();
                    },
                }
            });

            sessionRef.current = await sessionPromise;

        } catch (error) {
            console.error("Failed to start session:", error);
            setSessionState('ERROR');
            stopSession();
        }
    }, [stopSession, spreadsheetId]);
    
    return { sessionState, transcript, startSession, stopSession };
};
