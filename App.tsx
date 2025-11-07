
import React, { useState } from 'react';
import { AppMode } from './types';
import TextToSpeechPanel from './components/TextToSpeechPanel';
import TranscriptionPanel from './components/TranscriptionPanel';
import { DocumentTextIcon, SpeakerWaveIcon } from './components/icons';

interface TabButtonProps {
    label: string;
    currentMode: AppMode;
    targetMode: AppMode;
    onClick: () => void;
    icon: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ label, currentMode, targetMode, onClick, icon }) => (
    <button
        onClick={onClick}
        className={`flex-1 flex items-center justify-center gap-2 p-4 text-lg font-semibold border-b-4 transition-all duration-300
            ${currentMode === targetMode
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-400 border-transparent hover:bg-gray-700/50'
            }`}
    >
        {icon}
        {label}
    </button>
);

const App: React.FC = () => {
    const [mode, setMode] = useState<AppMode>(AppMode.TRANSCRIPTION);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 font-sans">
            <header className="w-full max-w-4xl text-center my-6 md:my-10">
                <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                    Asistente de Audiencias IA
                </h1>
                <p className="mt-2 text-lg text-gray-400">
                    Transcriba audio y convierta texto a voz con el poder de la IA.
                </p>
            </header>
            
            <main className="w-full max-w-4xl">
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-t-lg shadow-xl flex">
                    <TabButton 
                        label="Transcribir" 
                        currentMode={mode} 
                        targetMode={AppMode.TRANSCRIPTION} 
                        onClick={() => setMode(AppMode.TRANSCRIPTION)}
                        icon={<DocumentTextIcon className="w-6 h-6" />}
                    />
                    <TabButton 
                        label="Texto a Voz" 
                        currentMode={mode} 
                        targetMode={AppMode.TTS} 
                        onClick={() => setMode(AppMode.TTS)}
                        icon={<SpeakerWaveIcon className="w-6 h-6" />}
                    />
                </div>
                <div className="bg-gray-800 rounded-b-lg shadow-xl p-4 md:p-8">
                    {mode === AppMode.TRANSCRIPTION ? <TranscriptionPanel /> : <TextToSpeechPanel />}
                </div>
            </main>

            <footer className="w-full max-w-4xl text-center mt-8 text-gray-500 text-sm">
                <p>Powered by Gemini API. Creado con React y Tailwind CSS.</p>
            </footer>
        </div>
    );
};

export default App;
