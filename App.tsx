
import React, { useState } from 'react';
import { AppMode } from './types';
import TextToSpeechPanel from './components/TextToSpeechPanel';
import TranscriptionPanel from './components/TranscriptionPanel';
import HistoryPanel from './components/HistoryPanel';
import { DocumentTextIcon, SpeakerWaveIcon, ClockIcon } from './components/icons';

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
        className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 p-3 md:p-4 text-sm md:text-lg font-semibold border-b-4 transition-all duration-300
            ${currentMode === targetMode
                ? 'text-blue-400 border-blue-400 bg-blue-400/5'
                : 'text-gray-400 border-transparent hover:bg-gray-700/50'
            }`}
    >
        {icon}
        {label}
    </button>
);

const App: React.FC = () => {
    const [mode, setMode] = useState<AppMode>(AppMode.TRANSCRIPTION);

    const renderContent = () => {
        switch (mode) {
            case AppMode.TRANSCRIPTION:
                return <TranscriptionPanel />;
            case AppMode.TTS:
                return <TextToSpeechPanel />;
            case AppMode.HISTORY:
                return <HistoryPanel />;
            default:
                return <TranscriptionPanel />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 font-sans selection:bg-blue-500/30">
            <header className="w-full max-w-4xl text-center my-6 md:my-10">
                <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600">
                    Asistente de Audiencias IA
                </h1>
                <p className="mt-2 text-lg text-gray-400">
                    Tecnología avanzada para el manejo legal de audio y texto.
                </p>
            </header>
            
            <main className="w-full max-w-5xl">
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-t-xl shadow-2xl flex overflow-hidden">
                    <TabButton 
                        label="Transcribir" 
                        currentMode={mode} 
                        targetMode={AppMode.TRANSCRIPTION} 
                        onClick={() => setMode(AppMode.TRANSCRIPTION)}
                        icon={<DocumentTextIcon className="w-5 h-5 md:w-6 md:h-6" />}
                    />
                    <TabButton 
                        label="Texto a Voz" 
                        currentMode={mode} 
                        targetMode={AppMode.TTS} 
                        onClick={() => setMode(AppMode.TTS)}
                        icon={<SpeakerWaveIcon className="w-5 h-5 md:w-6 md:h-6" />}
                    />
                    <TabButton 
                        label="Historial" 
                        currentMode={mode} 
                        targetMode={AppMode.HISTORY} 
                        onClick={() => setMode(AppMode.HISTORY)}
                        icon={<ClockIcon className="w-5 h-5 md:w-6 md:h-6" />}
                    />
                </div>
                <div className="bg-gray-800 rounded-b-xl shadow-2xl p-4 md:p-8 min-h-[500px]">
                    {renderContent()}
                </div>
            </main>

            <footer className="w-full max-w-4xl text-center mt-12 mb-6 text-gray-500 text-sm border-t border-gray-800 pt-6">
                <p className="mb-1">Desarrollado con Gemini 2.5 Flash Native Audio.</p>
                <p>&copy; {new Date().getFullYear()} Asistente IA - Herramienta de productividad legal.</p>
            </footer>
        </div>
    );
};

export default App;
