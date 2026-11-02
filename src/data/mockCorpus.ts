export interface CorpusItem {
  id: string;
  word: string;
  code: string;
  speaker: 'Nam' | 'Nữ';
  filename: string;
  duration: number; // giây
  createdAt: string;
  isMock: boolean; // Phân biệt rõ giữa dữ liệu mẫu UI và bản thu âm thật của nhóm
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
  status: 'completed' | 'failed';
}

/**
 * Đã xóa toàn bộ dữ liệu mẫu (Mock data) theo yêu cầu.
 * Hệ thống hoạt động 100% dựa trên ngữ liệu thu âm thật của người dùng.
 */
export const MOCK_CORPUS_ITEMS: CorpusItem[] = [];

export const INITIAL_CONVERSION_HISTORY: ConversionHistoryItem[] = [];
