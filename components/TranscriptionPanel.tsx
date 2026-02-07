
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { TranscriptionMode, TranscriptionRecord } from '../types';
import { resampleAudioBuffer, float32ArrayToPCM16Base64 } from '../utils/audioUtils';
import { downloadAsWord } from '../utils/fileUtils';
import Spinner from './Spinner';
import { MicrophoneIcon, StopIcon, UploadIcon, BookmarkIcon, ArrowDownTrayIcon } from './icons';

const TARGET_SAMPLE_RATE = 16000;

function createGenAIBlob(data: Float32Array): GenAIBlob {
    return {
        data: float32ArrayToPCM16Base64(data),
        mimeType: `audio/pcm;rate=${TARGET_SAMPLE_RATE}`,
    };
}

const TranscriptionPanel: React.FC = () => {
    const [mode, setMode] = useState<TranscriptionMode>(TranscriptionMode.RECORD);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [transcription, setTranscription] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState<boolean>(false);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const lastSourceRef = useRef<string>('Grabación Directa');

    const getGenAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const startSession = useCallback(() => {
        if (!process.env.API_KEY) {
            setError("API_KEY environment variable not set.");
            return null;
        }
        
        let currentTranscription = '';
        const ai = getGenAI();

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
            callbacks: {
                onopen: () => {
                    console.log('Session opened.');
                    setError(null);
                    setIsSaved(false);
                },
                onmessage: (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        const text = message.serverContent.inputTranscription.text;
                        currentTranscription += text;
                        setTranscription(currentTranscription);
                    }
                    if(message.serverContent?.turnComplete) {
                        currentTranscription += ' ';
                    }
                },
                onerror: (e: any) => {
                    console.error('Session error:', e);
                    setError('Error en la sesión de transcripción. Intente de nuevo.');
                    setIsRecording(false);
                    setIsProcessing(false);
                },
                onclose: () => console.log('Session closed.'),
            },
            config: { 
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {} 
            },
        });
        
        sessionPromiseRef.current = sessionPromise;
        return sessionPromise;
    }, []);

    const stopSession = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close()).catch(console.error);
            sessionPromiseRef.current = null;
        }
    }, []);

    const startRecording = async () => {
        if (isRecording) return;
        setTranscription('');
        setError(null);
        setIsRecording(true);
        lastSourceRef.current = 'Grabación Directa';

        const sessionPromise = startSession();
        if(!sessionPromise) {
            setIsRecording(false);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: TARGET_SAMPLE_RATE });
            audioContextRef.current = context;
            
            const source = context.createMediaStreamSource(stream);
            mediaStreamSourceRef.current = source;
            const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const pcmBlob = createGenAIBlob(inputData);
                sessionPromise.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(context.destination);

        } catch (err) {
            console.error('Error starting recording:', err);
            setError('No se pudo acceder al micrófono. Por favor, verifique los permisos.');
            setIsRecording(false);
            stopSession();
        }
    };
    
    const stopRecording = useCallback(() => {
        setIsRecording(false);
        stopSession();

        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close().catch(console.error);

        mediaStreamRef.current = null;
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;
        audioContextRef.current = null;
    }, [stopSession]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setTranscription('');
        setError(null);
        setIsProcessing(true);
        lastSourceRef.current = `Archivo: ${file.name}`;

        const sessionPromise = startSession();
        if(!sessionPromise) {
            setIsProcessing(false);
            return;
        }
        
        try {
            const tempAudioContext = new AudioContext();
            const arrayBuffer = await file.arrayBuffer();
            const decodedBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
            await tempAudioContext.close();
            const resampledBuffer = await resampleAudioBuffer(decodedBuffer, TARGET_SAMPLE_RATE);
            const audioData = resampledBuffer.getChannelData(0);
            const session = await sessionPromise;
            
            const chunkSize = 4096;
            for (let i = 0; i < audioData.length; i += chunkSize) {
                const chunk = audioData.slice(i, i + chunkSize);
                if (chunk.length > 0) {
                    session.sendRealtimeInput({ media: createGenAIBlob(chunk) });
                }
                await new Promise(resolve => setTimeout(resolve, 50)); 
            }

            setTimeout(() => {
                stopSession();
                setIsProcessing(false);
            }, 2000);

        } catch (err) {
            console.error('Error processing audio file:', err);
            setError('Error al procesar el archivo de audio.');
            setIsProcessing(false);
            stopSession();
        }
    };

    const saveToHistory = () => {
        if (!transcription.trim()) return;

        const newRecord: TranscriptionRecord = {
            id: Date.now().toString(),
            text: transcription,
            timestamp: Date.now(),
            source: lastSourceRef.current,
            title: transcription.substring(0, 40).trim() + (transcription.length > 40 ? "..." : "")
        };

        const existingHistoryRaw = localStorage.getItem('transcription_history');
        let history: TranscriptionRecord[] = [];
        if (existingHistoryRaw) {
            try {
                history = JSON.parse(existingHistoryRaw);
            } catch (e) {
                history = [];
            }
        }
        history.push(newRecord);
        localStorage.setItem('transcription_history', JSON.stringify(history));
        setIsSaved(true);
    };

    const handleDownloadWord = () => {
        const title = transcription.substring(0, 30).trim() || "Transcripción";
        downloadAsWord(transcription, title, lastSourceRef.current);
    };

    useEffect(() => {
        return () => stopRecording();
    }, [stopRecording]);

    return (
        <div className="w-full max-w-2xl mx-auto p-4 md:p-6 bg-gray-800 rounded-lg shadow-lg">
             <div className="flex justify-center border-b border-gray-700 mb-6">
                <button 
                    onClick={() => setMode(TranscriptionMode.RECORD)}
                    className={`px-4 py-2 text-lg font-medium transition-colors ${mode === TranscriptionMode.RECORD ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}>
                    Grabar Audio
                </button>
                <button 
                    onClick={() => setMode(TranscriptionMode.UPLOAD)}
                    className={`px-4 py-2 text-lg font-medium transition-colors ${mode === TranscriptionMode.UPLOAD ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}>
                    Subir Archivo
                </button>
            </div>
            {mode === TranscriptionMode.RECORD && (
                <div className="text-center">
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`mx-auto flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-lg ${isRecording ? 'bg-red-600 hover:bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'}`}
                    >
                        {isRecording ? <StopIcon className="w-10 h-10 text-white" /> : <MicrophoneIcon className="w-10 h-10 text-white" />}
                    </button>
                    <p className="mt-4 text-gray-300 font-medium">{isRecording ? 'Escuchando y transcribiendo...' : 'Presione para empezar a grabar'}</p>
                </div>
            )}
            {mode === TranscriptionMode.UPLOAD && (
                <div className="text-center">
                     <label className="mx-auto cursor-pointer flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-600 rounded-lg hover:bg-gray-700/50 hover:border-blue-500 transition-all group">
                        <UploadIcon className="w-12 h-12 text-gray-500 mb-2 group-hover:text-blue-400 transition-colors"/>
                        <span className="text-gray-300 font-medium">Seleccione un archivo de audio</span>
                        <p className="text-xs text-gray-500 mt-1">MP3, WAV, M4A admitidos</p>
                        <input type="file" className="hidden" onChange={handleFileUpload} accept="audio/*" disabled={isProcessing} />
                     </label>
                     {isProcessing && <div className="mt-4 flex flex-col items-center gap-2"><Spinner /><span className="text-sm text-blue-300">Procesando audio...</span></div>}
                </div>
            )}
            {error && <p className="text-red-400 mt-4 text-center bg-red-900/20 p-2 rounded">{error}</p>}
            {(transcription || isRecording || isProcessing) && (
                 <div className="mt-8">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-blue-300 flex items-center gap-2">
                             Transcripción en tiempo real:
                        </h3>
                        <div className="flex gap-2">
                            {transcription && !isRecording && !isProcessing && (
                                <>
                                    <button 
                                        onClick={handleDownloadWord}
                                        className="flex items-center gap-2 px-3 py-1 rounded text-sm font-bold bg-teal-600 hover:bg-teal-500 transition-all"
                                    >
                                        <ArrowDownTrayIcon className="w-4 h-4" />
                                        Word
                                    </button>
                                    <button 
                                        onClick={saveToHistory}
                                        disabled={isSaved}
                                        className={`flex items-center gap-2 px-3 py-1 rounded text-sm font-bold transition-all ${isSaved ? 'bg-green-600 cursor-default' : 'bg-blue-600 hover:bg-blue-500'}`}
                                    >
                                        <BookmarkIcon className="w-4 h-4" />
                                        {isSaved ? 'Guardado' : 'Guardar'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="w-full min-h-[200px] p-4 bg-gray-900 border border-gray-700 rounded-md shadow-inner text-gray-200 leading-relaxed overflow-y-auto max-h-[400px]">
                        {transcription}
                        {(isRecording || isProcessing) && !transcription && (
                            <div className="flex items-center gap-2 text-gray-500 italic">
                                <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
                                Esperando audio...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TranscriptionPanel;
