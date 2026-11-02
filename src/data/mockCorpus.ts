import { encodeVnFilename } from '../lib/vniCodec';

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
 * Danh mục ngữ liệu mẫu minh họa giao diện (Mock Corpus Data)
 * Giúp người dùng hình dung rõ cách thức quản lý từ vựng và file âm thanh của đồ án.
 */
export const MOCK_CORPUS_ITEMS: CorpusItem[] = [
  {
    id: 'mock-1',
    word: 'xin chào',
    code: 'xin0_chao2',
    speaker: 'Nam',
    filename: 'xin0_chao2.wav',
    duration: 0.72,
    createdAt: '2026-11-01 09:30',
    isMock: true
  },
  {
    id: 'mock-2',
    word: 'việt nam',
    code: 'vie+t5_nam0',
    speaker: 'Nữ',
    filename: 'vie+t5_nam0.wav',
    duration: 0.85,
    createdAt: '2026-11-01 09:35',
    isMock: true
  },
  {
    id: 'mock-3',
    word: 'công nghệ',
    code: 'co+ng0_nghe+5',
    speaker: 'Nam',
    filename: 'co+ng0_nghe+5.wav',
    duration: 0.78,
    createdAt: '2026-11-01 10:15',
    isMock: true
  },
  {
    id: 'mock-4',
    word: 'thông tin',
    code: 'tho+ng0_tin0',
    speaker: 'Nữ',
    filename: 'tho+ng0_tin0.wav',
    duration: 0.69,
    createdAt: '2026-11-01 10:20',
    isMock: true
  },
  {
    id: 'mock-5',
    word: 'tiếng việt',
    code: 'tie+ng1_vie+t5',
    speaker: 'Nữ',
    filename: 'tie+ng1_vie+t5.wav',
    duration: 0.74,
    createdAt: '2026-11-01 10:45',
    isMock: true
  },
  {
    id: 'mock-6',
    word: 'học tập',
    code: 'hoc5_ta+p5',
    speaker: 'Nam',
    filename: 'hoc5_ta+p5.wav',
    duration: 0.75,
    createdAt: '2026-11-01 11:00',
    isMock: true
  },
  {
    id: 'mock-7',
    word: 'tiếng nói',
    code: 'tie+ng1_noi1',
    speaker: 'Nữ',
    filename: 'tie+ng1_noi1.wav',
    duration: 0.81,
    createdAt: '2026-11-01 11:20',
    isMock: true
  },
  {
    id: 'mock-8',
    word: 'bác',
    code: 'bac1',
    speaker: 'Nam',
    filename: 'bac1.wav',
    duration: 0.42,
    createdAt: '2026-11-01 14:00',
    isMock: true
  },
  {
    id: 'mock-9',
    word: 'cảng',
    code: 'cang3',
    speaker: 'Nữ',
    filename: 'cang3.wav',
    duration: 0.48,
    createdAt: '2026-11-01 14:05',
    isMock: true
  },
  {
    id: 'mock-10',
    word: 'ba',
    code: 'ba0',
    speaker: 'Nam',
    filename: 'ba0.wav',
    duration: 0.38,
    createdAt: '2026-11-01 14:10',
    isMock: true
  },
  {
    id: 'mock-11',
    word: 'đêm',
    code: 'd-e+m0',
    speaker: 'Nữ',
    filename: 'd-e+m0.wav',
    duration: 0.45,
    createdAt: '2026-11-01 14:15',
    isMock: true
  },
  {
    id: 'mock-12',
    word: 'đường',
    code: 'd-uuoong2',
    speaker: 'Nam',
    filename: 'd-uuoong2.wav',
    duration: 0.52,
    createdAt: '2026-11-01 14:20',
    isMock: true
  }
];

/**
 * Danh sách lịch sử chuyển đổi ban đầu (Mock History Data)
 */
export const INITIAL_CONVERSION_HISTORY: ConversionHistoryItem[] = [
  {
    id: 'hist-0',
    text: 'xin chào mừng bạn đến với VietVoice',
    speaker: 'Nữ',
    duration: 1.85,
    createdAt: '4 phút trước',
    filename: 'xin_chao_mung_ban_den_voi_vietvoice.wav',
    status: 'completed'
  },
  {
    id: 'hist-1',
    text: 'Xin chào',
    speaker: 'Nam',
    duration: 0.72,
    createdAt: '15 phút trước',
    filename: 'xin0_chao2.wav',
    status: 'completed'
  },
  {
    id: 'hist-2',
    text: 'Việt Nam',
    speaker: 'Nữ',
    duration: 0.85,
    createdAt: '2026-11-02 15:05',
    filename: 'vie+t5_nam0.wav',
    status: 'completed'
  },
  {
    id: 'hist-3',
    text: 'Công nghệ thông tin',
    speaker: 'Nam',
    duration: 1.47,
    createdAt: '2026-11-02 16:30',
    filename: 'co+ng0_nghe+5_tho+ng0_tin0.wav',
    status: 'completed'
  }
];

