export interface CorpusItem {
  id: string;
  word: string;
  code: string;
  speaker: 'Nam' | 'Nữ';
  filename: string;
  duration: number; // giây
  createdAt: string;
  isMock: boolean;
  audioUrl?: string;
  source?: string;
}

export interface ConversionHistoryItem {
  id: string;
  text: string;
  speaker: 'Nam' | 'Nữ';
  duration: number;
  createdAt: string;
  audioBlob?: Blob;
  audioUrl?: string;
  filename: string;
  status: 'converting' | 'completed' | 'failed';
}

export const MOCK_CORPUS_ITEMS: CorpusItem[] = [];

export const INITIAL_CONVERSION_HISTORY: ConversionHistoryItem[] = [];
