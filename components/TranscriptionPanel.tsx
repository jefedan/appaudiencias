import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { TranscriptionMode } from '../types';
import { resampleAudioBuffer, float32ArrayToPCM16Base64 } from '../utils/audioUtils';
import Spinner from './Spinner';
import { MicrophoneIcon, StopIcon, UploadIcon } from './icons';

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

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const getGenAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const startSession = useCallback(() => {
        if (!process.env.API_KEY) {
            setError("API_KEY environment variable not set.");
            return null;
        }
        
        let currentTranscription = '';
        const ai = getGenAI();

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    console.log('Session opened.');
                    setError(null);
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
                    // Per Gemini guidelines, audio output must be handled even if unused.
                    const base64EncodedAudioString =
                        message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                    if (base64EncodedAudioString) {
                        // This app only does transcription, so we do not process the audio output.
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

    useEffect(() => {
        return () => stopRecording();
    }, [stopRecording]);

    return (
        <div className="w-full max-w-2xl mx-auto p-4 md:p-6 bg-gray-800 rounded-lg shadow-lg">
             <div className="flex justify-center border-b border-gray-700 mb-4">
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
                        className={`mx-auto flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 ${isRecording ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                    >
                        {isRecording ? <StopIcon className="w-10 h-10 text-white" /> : <MicrophoneIcon className="w-10 h-10 text-white" />}
                    </button>
                    <p className="mt-4 text-gray-300">{isRecording ? 'Grabando... presione para detener' : 'Presione para empezar a grabar'}</p>
                </div>
            )}
            {mode === TranscriptionMode.UPLOAD && (
                <div className="text-center">
                     <label className="mx-auto cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-600 rounded-lg hover:bg-gray-700 transition-colors">
                        <UploadIcon className="w-10 h-10 text-gray-400 mb-2"/>
                        <span className="text-gray-300">Seleccione un archivo de audio</span>
                        <input type="file" className="hidden" onChange={handleFileUpload} accept="audio/*" disabled={isProcessing} />
                     </label>
                     {isProcessing && <div className="mt-4"><Spinner /></div>}
                </div>
            )}
            {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
            {(transcription || isRecording || isProcessing) && (
                 <div className="mt-6">
                    <h3 className="font-semibold mb-2 text-center text-blue-300">Transcripción:</h3>
                    <div className="w-full min-h-[150px] p-3 bg-gray-900 border border-gray-700 rounded-md">
                        {transcription}
                        {(isRecording || isProcessing) && !transcription && <span className="text-gray-500">Esperando audio...</span>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TranscriptionPanel;