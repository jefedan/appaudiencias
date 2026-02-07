
import React, { useState, useEffect } from 'react';
import { TranscriptionRecord } from '../types';
import { downloadAsWord } from '../utils/fileUtils';
import { TrashIcon, ClipboardIcon, ClockIcon, DocumentTextIcon, ArrowDownTrayIcon } from './icons';

const HistoryPanel: React.FC = () => {
    const [history, setHistory] = useState<TranscriptionRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<TranscriptionRecord | null>(null);

    useEffect(() => {
        const savedHistory = localStorage.getItem('transcription_history');
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch (e) {
                console.error("Error loading history", e);
            }
        }
    }, []);

    const deleteRecord = (id: string) => {
        const newHistory = history.filter(r => r.id !== id);
        setHistory(newHistory);
        localStorage.setItem('transcription_history', JSON.stringify(newHistory));
        if (selectedRecord?.id === id) setSelectedRecord(null);
    };

    const clearHistory = () => {
        if (window.confirm("¿Está seguro de que desea borrar todo el historial?")) {
            setHistory([]);
            localStorage.removeItem('transcription_history');
            setSelectedRecord(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Texto copiado al portapapeles");
    };

    const handleDownloadWord = () => {
        if (selectedRecord) {
            downloadAsWord(selectedRecord.text, selectedRecord.title, selectedRecord.source);
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/3 bg-gray-800 rounded-lg shadow-lg p-4 overflow-y-auto max-h-[600px]">
                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                    <h2 className="text-xl font-bold text-blue-300 flex items-center gap-2">
                        <ClockIcon className="w-5 h-5" /> Historial
                    </h2>
                    {history.length > 0 && (
                        <button 
                            onClick={clearHistory}
                            className="text-red-400 hover:text-red-300 text-sm transition-colors"
                        >
                            Borrar todo
                        </button>
                    )}
                </div>

                {history.length === 0 ? (
                    <p className="text-gray-500 text-center py-10">No hay transcripciones guardadas.</p>
                ) : (
                    <div className="space-y-3">
                        {history.sort((a,b) => b.timestamp - a.timestamp).map(record => (
                            <div 
                                key={record.id}
                                onClick={() => setSelectedRecord(record)}
                                className={`p-3 rounded-md cursor-pointer transition-all border ${selectedRecord?.id === record.id ? 'bg-blue-900/40 border-blue-500' : 'bg-gray-700/50 border-transparent hover:bg-gray-700'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-mono text-gray-400">{formatDate(record.timestamp)}</span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); deleteRecord(record.id); }}
                                        className="text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <h4 className="font-semibold text-sm truncate text-gray-200">{record.title || "Sin título"}</h4>
                                <p className="text-xs text-blue-400 italic">{record.source}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1 bg-gray-800 rounded-lg shadow-lg p-6 min-h-[400px]">
                {selectedRecord ? (
                    <div className="h-full flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-100">{selectedRecord.title}</h3>
                                <p className="text-sm text-gray-400">{formatDate(selectedRecord.timestamp)} - {selectedRecord.source}</p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleDownloadWord}
                                    className="flex items-center gap-2 px-3 py-1 bg-teal-700 hover:bg-teal-600 rounded text-sm transition-colors text-white"
                                >
                                    <ArrowDownTrayIcon className="w-4 h-4" /> Word
                                </button>
                                <button 
                                    onClick={() => copyToClipboard(selectedRecord.text)}
                                    className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                                >
                                    <ClipboardIcon className="w-4 h-4" /> Copiar
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 p-4 bg-gray-900 rounded-md border border-gray-700 overflow-y-auto whitespace-pre-wrap text-gray-200">
                            {selectedRecord.text}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <DocumentTextIcon className="w-16 h-16 mb-4 opacity-20" />
                        <p>Seleccione una transcripción del historial para ver los detalles.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPanel;
