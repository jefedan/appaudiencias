import React, { useState, useRef } from 'react';
import { generateSpeechFromText } from '../services/geminiService';
import { decode, pcmToWavBlob } from '../utils/audioUtils';
import Spinner from './Spinner';
import { UploadIcon, SpeakerWaveIcon } from './icons';

declare const mammoth: any;
declare const pdfjsLib: any;

const TextToSpeechPanel: React.FC = () => {
    const [text, setText] = useState<string>('');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setError(null);
        setIsLoading(true);
        setAudioUrl(null);
        setText(`Procesando archivo: ${file.name}...`);
        
        try {
            if (file.type === 'application/pdf') {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const pdf = await pdfjsLib.getDocument({ data: e.target?.result }).promise;
                        let content = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            content += textContent.items.map((item: any) => (item as {str: string}).str).join(' ');
                        }
                        setText(content);
                    } catch (err) {
                        setError('No se pudo procesar el archivo PDF.');
                        setText('');
                    } finally {
                        setIsLoading(false);
                    }
                };
                reader.readAsArrayBuffer(file);
            } else if (file.name.endsWith('.docx')) {
                 const reader = new FileReader();
                 reader.onload = async (e) => {
                    try {
                        const result = await mammoth.extractRawText({ arrayBuffer: e.target?.result });
                        setText(result.value);
                    } catch (err) {
                        setError('No se pudo procesar el archivo DOCX.');
                        setText('');
                    } finally {
                        setIsLoading(false);
                    }
                };
                reader.readAsArrayBuffer(file);
            } else {
                 setError('Tipo de archivo no soportado. Por favor, suba un PDF o DOCX.');
                 setText('');
                 setIsLoading(false);
            }
        } catch (e: any) {
            setError(`Error al procesar el archivo: ${e.message}`);
            setText('');
            setIsLoading(false);
        }
        // Reset file input to allow uploading the same file again
        if(event.target) {
            event.target.value = '';
        }
    };

    const handleGenerateAudio = async () => {
        if (!text.trim() || isLoading) return;
        setError(null);
        setIsLoading(true);
        setAudioUrl(null);
        try {
            const base64Audio = await generateSpeechFromText(text);
            const audioBytes = decode(base64Audio);
            // The API returns raw PCM data. Convert it to a WAV blob to be playable in the <audio> element.
            // The TTS audio is 24kHz, 16-bit, single-channel.
            const blob = pcmToWavBlob(audioBytes, 24000, 1, 16);
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
        } catch (e: any) {
            setError(`Fallo al generar audio: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-4 md:p-6 bg-gray-800 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-center text-blue-300">Convertir Texto a Voz</h2>
            <div className="mb-4">
                <textarea
                    className="w-full h-48 p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    placeholder="Escriba o pegue texto aquí, o suba un documento..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={isLoading}
                />
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                 <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors disabled:opacity-50"
                >
                    <UploadIcon className="w-5 h-5" />
                    Subir Documento
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.docx"
                />
                <button
                    onClick={handleGenerateAudio}
                    disabled={!text.trim() || isLoading}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Spinner /> : <><SpeakerWaveIcon className="w-5 h-5" /> Generar Audio</>}
                </button>
            </div>
            {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
            {audioUrl && (
                <div className="mt-6">
                    <h3 className="font-semibold mb-2 text-center">Audio Generado:</h3>
                    <audio controls src={audioUrl} className="w-full">
                        Tu navegador no soporta el elemento de audio.
                    </audio>
                </div>
            )}
        </div>
    );
};

export default TextToSpeechPanel;