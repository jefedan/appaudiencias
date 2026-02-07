
export enum AppMode {
  TRANSCRIPTION = 'transcription',
  TTS = 'tts',
  HISTORY = 'history',
}

export enum TranscriptionMode {
  RECORD = 'record',
  UPLOAD = 'upload',
}

export interface TranscriptionRecord {
    id: string;
    text: string;
    timestamp: number;
    source: string;
    title: string;
}
