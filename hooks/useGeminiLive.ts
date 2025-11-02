

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
    description: 'Searches journal entries. Can filter by a text query, a date range, or both. Returns matching entries.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description: 'Optional keyword or phrase to search for in the entry text. If empty, returns recent entries.',
            },
            startDate: {
                type: Type.STRING,
                description: 'Optional start date for the search range in YYYY-MM-DD format. Filters entries with a due date on or after this date.',
            },
            endDate: {
                type: Type.STRING,
                description: 'Optional end date for the search range in YYYY-MM-DD format. Filters entries with a due date on or before this date.',
            },
        },
    },
};

const updateJournalEntryTool: FunctionDeclaration = {
    name: 'updateJournalEntry',
    description: 'Updates a specific field of a journal entry in the spreadsheet AFTER you have its row number.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            row: {
                type: Type.INTEGER,
                description: 'The row number of the entry to update. CRITICAL: This number MUST be obtained by first calling the `findEntries` tool.',
            },
            field: {
                type: Type.STRING,
                description: 'The column/field to update. Valid options are: "entry", "tags", "type", "taskStatus", "dueDate", "priority".',
            },
            value: {
                type: Type.STRING,
                description: 'The new value for the specified field. For due dates, use YYYY-MM-DD format.',
            },
        },
        required: ['row', 'field', 'value'],
    },
};


export const useGeminiLive = (spreadsheetId: string) => {
    const [sessionState, setSessionState] = useState<SessionState>('IDLE');
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

    const sessionRef = useRef<LiveSession | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextAudioStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const currentTranscriptRef = useRef<TranscriptEntry[]>([]);
    const analyserNodeRef = useRef<AnalyserNode | null>(null);

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
        analyserNodeRef.current = null;
        setAnalyserNode(null);
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
            
            // Create and configure the AnalyserNode for visualization
            const analyser = outputAudioContextRef.current.createAnalyser();
            analyser.fftSize = 256;
            analyserNodeRef.current = analyser;
            setAnalyserNode(analyser);

            const today = new Date().toISOString().slice(0, 10); // Get YYYY-MM-DD

            const systemInstruction = `You are a helpful and empathetic journal assistant. Your primary role is to help the user manage their journal by finding and updating entries using the provided tools.

**HANDLING DATES:**
- **Today's date is ${today}.**
- When a user asks about a time period (e.g., "next week", "this month", "in 2025"), you MUST calculate the 'startDate' and 'endDate' in YYYY-MM-DD format and use them in the 'findEntries' tool.
- For "next week," calculate a 7-day period starting from tomorrow.
- For "2025," the range would be startDate: '2025-01-01', endDate: '2025-12-31'.
- Do not just pass the user's text like "next week" into the query parameter. Use the date parameters for accurate filtering.

**CRITICAL WORKFLOW FOR UPDATES:**
You MUST follow this two-step process for any request that involves modifying an existing entry:
1.  **FIND:** First, use the 'findEntries' tool to locate the specific entry the user is talking about. Use keywords from their request in the 'query' parameter. This tool will return the entry's content and, most importantly, its 'row' number.
2.  **UPDATE:** Once you have the correct 'row' number from the 'findEntries' result, use the 'updateJournalEntry' tool to make the change. You will need the 'row', the specific 'field' to change, and the 'new value'.

**EXAMPLE CONVERSATION FLOW (Date Search):**
- **User:** "What do I have due next week?"
- **YOU (Internal thought):** Today is ${today}. "Next week" starts tomorrow. I will calculate the date range and use the 'findEntries' tool.
- **YOU (Tool Call):** \`findEntries({ startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" })\`
- **Tool Response:** \`[ ... list of tasks ... ]\`
- **YOU (Spoken to user):** "Here are the tasks you have due next week: ..."

**IMPORTANT RULES:**
- **NEVER GUESS ROW NUMBERS.** Always get the row number from the \`findEntries\` tool first.
- If \`findEntries\` returns multiple results, ask the user to clarify which one they mean before you update anything.
- Be conversational and concise in your spoken responses.

**Spreadsheet Schema & Fields you can update:**
- 'entry': The main text of the journal entry.
- 'tags': Comma-separated keywords.
- 'type': 'personal', 'work', 'task', 'note'.
- 'taskStatus': 'todo', 'in-progress', 'done', 'none'.
- 'dueDate': Date in YYYY-MM-DD format.
- 'priority': 'low', 'medium', 'high', 'none'.`;

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
                                        const { query, startDate, endDate } = fc.args;
                                        addTranscript({ source: 'system', text: `Searching journal...` });
                                        const found = await Sheets.findEntries(
                                            spreadsheetId, 
                                            query ? String(query) : '',
                                            startDate ? String(startDate) : undefined,
                                            endDate ? String(endDate) : undefined
                                        );
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
                        if (audioData) {
                            const outputCtx = outputAudioContextRef.current;
                            const analyser = analyserNodeRef.current;
                            if (!outputCtx || !analyser) return;

                            // FIX: Resume AudioContext if suspended. Browsers often suspend AudioContext
                            // until a user interaction, which can cause audio to not play.
                            if (outputCtx.state === 'suspended') {
                                await outputCtx.resume();
                            }

                            try {
                                nextAudioStartTimeRef.current = Math.max(nextAudioStartTimeRef.current, outputCtx.currentTime);
                                const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                                const source = outputCtx.createBufferSource();
                                source.buffer = audioBuffer;
                                
                                // Connect source to analyser, and analyser to destination
                                source.connect(analyser);
                                analyser.connect(outputCtx.destination);
                                
                                source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                                source.start(nextAudioStartTimeRef.current);
                                nextAudioStartTimeRef.current += audioBuffer.duration;
                                audioSourcesRef.current.add(source);
                            } catch(e) {
                                console.error("Error processing or playing audio chunk:", e);
                            }
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
    
    return { sessionState, transcript, analyserNode, startSession, stopSession };
};
