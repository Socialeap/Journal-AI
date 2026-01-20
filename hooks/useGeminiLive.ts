
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import * as Sheets from '../services/googleSheetsService';
import type { TranscriptEntry } from '../types';

type SessionState = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'PROCESSING' | 'ERROR';

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

// Helper for simple downsampling to 16kHz
const downsampleTo16k = (inputData: Float32Array, sampleRate: number): Float32Array => {
    if (sampleRate === 16000) return inputData;
    
    const ratio = sampleRate / 16000;
    const newLength = Math.ceil(inputData.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
        const offset = Math.floor(i * ratio);
        if (offset < inputData.length) {
            result[i] = inputData[offset];
        }
    }
    return result;
};


export const useGeminiLive = (spreadsheetId: string) => {
    const [sessionState, setSessionState] = useState<SessionState>('IDLE');
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [micVolume, setMicVolume] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const sessionRef = useRef<LiveSession | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    
    // Unified AudioContext for both input and output to reduce mobile resource friction
    const audioContextRef = useRef<AudioContext | null>(null);
    
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextAudioStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const currentTranscriptRef = useRef<TranscriptEntry[]>([]);
    
    // Prevent multiple start calls
    const isBusyRef = useRef(false);

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
        // 1. Close Gemini Session
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) { console.warn("Error closing session:", e); }
            sessionRef.current = null;
        }

        // 2. Stop Media Stream (Mic)
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        // 3. Disconnect Processing Nodes
        if (scriptProcessorRef.current) {
            try { scriptProcessorRef.current.disconnect(); } catch (e) { console.warn("Error disconnecting script processor:", e); }
            scriptProcessorRef.current = null;
        }

        // 4. Stop Playing Audio
        audioSourcesRef.current.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        audioSourcesRef.current.clear();

        // 5. Close AudioContext
        // We close it to release hardware resources fully.
        if (audioContextRef.current) {
            try {
                 if (audioContextRef.current.state !== 'closed') {
                    audioContextRef.current.close();
                 }
            } catch (e) { console.warn(e); }
            audioContextRef.current = null;
        }

        setSessionState('IDLE');
        setMicVolume(0);
        isBusyRef.current = false;
    }, []);

    const startSession = useCallback(async () => {
        if (isBusyRef.current || sessionRef.current) return;
        isBusyRef.current = true;
        
        setErrorMessage(null);
        currentTranscriptRef.current = [];
        setTranscript([]);
        setMicVolume(0);
        
        try {
            if (!process.env.API_KEY) throw new Error("API_KEY is not set.");
            
            // 1. Initialize Single AudioContext
            // We do NOT pass { sampleRate: 16000 } here. iOS often fails if we force it.
            // We let the browser choose (usually 44.1k or 48k) and we downsample later.
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;

            // 2. Resume Context IMMEDIATELY (Mobile Safeguard)
            // This must be called inside the user interaction (click) handler stack.
            // Even if the promise takes a moment, the call originated from the gesture.
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            // 3. Request Mic Access
            // Use standard constraints. Echo cancellation is vital for mobile voice mode.
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            mediaStreamRef.current = stream;

            // 4. Update UI State
            setSessionState('CONNECTING');

            // 5. Initialize Gemini
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
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
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
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
                        if (!mediaStreamRef.current || !audioContextRef.current) {
                            return;
                        }

                        // Setup Input Pipeline (Mic -> Processor)
                        const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            
                            // Check Sample Rate and Downsample if necessary
                            // The context might be 48k, Gemini wants 16k
                            const currentSampleRate = audioContextRef.current?.sampleRate || 48000;
                            const processedData = downsampleTo16k(inputData, currentSampleRate);

                            // Calculate volume for visualizer
                            let sum = 0;
                            for (let i = 0; i < inputData.length; i += 4) {
                                sum += inputData[i] * inputData[i];
                            }
                            const volume = Math.sqrt(sum / (inputData.length / 4));
                            setMicVolume(volume);

                            const pcmBlob = createBlob(processedData);
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(audioContextRef.current.destination);
                        
                        setSessionState('LISTENING');
                        isBusyRef.current = false;
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
                                        const found = await Sheets.findEntries(spreadsheetId, String(fc.args.query));
                                        result = { result: JSON.stringify(found) };
                                    } else if (fc.name === 'updateJournalEntry') {
                                        addTranscript({ source: 'system', text: `Updating ${fc.args.field} to "${fc.args.value}" on row ${fc.args.row}...` });
                                        await Sheets.updateJournalEntry(spreadsheetId, Number(fc.args.row), String(fc.args.field) as any, String(fc.args.value));
                                        result = { result: "Update successful." };
                                    }
                                } catch (e) {
                                    console.error(e);
                                    result = { error: { message: e instanceof Error ? e.message : String(e) } };
                                }

                                sessionPromise.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: { id: fc.id, name: fc.name, response: result }
                                    });
                                });
                            }
                        }

                        // Handle audio playback
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData && audioContextRef.current) {
                            const ctx = audioContextRef.current;
                            // Gemini sends 24kHz audio. decodeAudioData helper will create a buffer.
                            // We tell it the data is 24000Hz.
                            // If the context is 48000Hz, the browser resamples automatically during playback.
                            const audioBuffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
                            
                            nextAudioStartTimeRef.current = Math.max(nextAudioStartTimeRef.current, ctx.currentTime);
                            
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(ctx.destination);
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
                    onclose: () => {
                        console.log("Session closed by server.");
                        stopSession();
                    },
                    onerror: (e) => {
                        console.error("Live session error:", e);
                        setSessionState('ERROR');
                        setErrorMessage("Connection to AI assistant failed.");
                        stopSession();
                    },
                }
            });

            sessionRef.current = await sessionPromise;

        } catch (error: any) {
            console.error("Failed to start session:", error);
            
            let msg = "An unexpected error occurred.";
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                msg = "Microphone access denied. Please close any screen overlays (like chat heads) and try again.";
            } else if (error instanceof Error) {
                msg = error.message;
            }
            
            setErrorMessage(msg);
            setSessionState('ERROR');
            
            stopSession();
        }
    }, [spreadsheetId, stopSession]); 
    
    return { sessionState, transcript, startSession, stopSession, micVolume, errorMessage };
};
