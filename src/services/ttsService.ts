import type { CorpusEntry, SynthResult } from '../lib/types';
import { synthesize, normalizeText } from '../lib/tts';
import { INITIAL_CONVERSION_HISTORY, type ConversionHistoryItem } from '../data/mockCorpus';

const STORAGE_KEY = 'amtu_conversion_history';

/**
 * Lấy lịch sử chuyển đổi từ LocalStorage (hoặc khởi tạo với dữ liệu mẫu)
 */
export function getStoredHistory(): ConversionHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CONVERSION_HISTORY));
      return INITIAL_CONVERSION_HISTORY;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Không thể đọc lịch sử chuyển đổi:', err);
    return INITIAL_CONVERSION_HISTORY;
  }
}

/**
 * Lưu lịch sử chuyển đổi vào LocalStorage
 */
export function saveHistory(items: ConversionHistoryItem[]): void {
  try {
    // Chỉ lưu metadata, bỏ blob để tránh tràn dung lượng LocalStorage
    const serializable = items.map((item) => ({
      id: item.id,
      text: item.text,
      speaker: item.speaker,
      duration: item.duration,
      createdAt: item.createdAt,
      filename: item.filename,
      status: item.status,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (err) {
    console.error('Không thể lưu lịch sử chuyển đổi:', err);
  }
}

/**
 * Thêm một mục lịch sử chuyển đổi mới
 */
export function addHistoryEntry(
  text: string,
  speaker: 'Nam 01' | 'Nữ 01',
  duration: number,
  audioBlob?: Blob,
  audioUrl?: string
): ConversionHistoryItem {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const cleanText = text.trim().slice(0, 15).replace(/\s+/g, '_').toLowerCase();
  const filename = `amtu_${speaker === 'Nam 01' ? 'nam' : 'nu'}_${cleanText || 'audio'}.wav`;

  const newItem: ConversionHistoryItem = {
    id: `conv-${Date.now()}`,
    text: text.trim(),
    speaker,
    duration,
    createdAt: dateStr,
    audioBlob,
    audioUrl,
    filename,
    status: 'completed',
  };

  const current = getStoredHistory();
  const updated = [newItem, ...current];
  saveHistory(updated);
  return newItem;
}

/**
 * Xóa một mục lịch sử
 */
export function removeHistoryEntry(id: string): ConversionHistoryItem[] {
  const current = getStoredHistory();
  const updated = current.filter((item) => item.id !== id);
  saveHistory(updated);
  return updated;
}

/**
 * Chuẩn hóa tên speaker cho thư viện tts
 */
export function mapSpeakerToCore(speaker: 'Nam 01' | 'Nữ 01'): string {
  return speaker === 'Nam 01' ? 'nam' : 'nu';
}

/**
 * Kiểm tra xem các từ trong câu có sẵn trong ngữ liệu thu âm hay chưa
 */
export function inspectVocabulary(
  text: string,
  speaker: 'Nam 01' | 'Nữ 01',
  entries: CorpusEntry[]
): {
  tokens: string[];
  matchedWords: string[];
  missingWords: string[];
  isFullyAvailable: boolean;
} {
  const norm = normalizeText(text);
  if (!norm) {
    return { tokens: [], matchedWords: [], missingWords: [], isFullyAvailable: false };
  }

  const tokens = norm.split(/\s+/).filter(Boolean);
  const speakerKey = mapSpeakerToCore(speaker);

  // Tập từ có sẵn của người nói này (và cả các speaker khác nếu tìm)
  const availableSet = new Set(
    entries
      .filter((e) => e.speaker.toLowerCase() === speakerKey.toLowerCase() || e.speaker.toLowerCase().includes(speakerKey.toLowerCase()))
      .map((e) => e.word.toLowerCase())
  );

  const matchedWords: string[] = [];
  const missingWords: string[] = [];

  for (const tok of tokens) {
    if (availableSet.has(tok)) {
      matchedWords.push(tok);
    } else {
      missingWords.push(tok);
    }
  }

  return {
    tokens,
    matchedWords,
    missingWords,
    isFullyAvailable: tokens.length > 0 && missingWords.length === 0,
  };
}

/**
 * Thực hiện tổng hợp âm thanh từ ngữ liệu thu âm thật
 */
export async function performSynthesis(
  text: string,
  speaker: 'Nam 01' | 'Nữ 01',
  entries: CorpusEntry[]
): Promise<{
  success: boolean;
  result?: SynthResult;
  error?: string;
  missingTokens?: string[];
}> {
  const norm = normalizeText(text);
  if (!norm) {
    return { success: false, error: 'Vui lòng nhập văn bản tiếng Việt hợp lệ.' };
  }

  const speakerKey = mapSpeakerToCore(speaker);

  // Tìm các mục khớp
  const speakerEntries = entries.filter(
    (e) => e.speaker.toLowerCase() === speakerKey.toLowerCase() || e.speaker.toLowerCase().includes(speakerKey.toLowerCase())
  );

  try {
    const synthRes = await synthesize(norm, speakerEntries.length > 0 ? speakerEntries : entries, {
      speaker: speakerKey,
      gapMs: 80,
      crossfadeMs: 25,
      trim: true,
      normalize: true,
      fallbackSpeaker: true,
    });

    // Kiểm tra xem có từ nào OOV (Out Of Vocabulary - không có trong ngữ liệu)
    const oovTokens = synthRes.trace.filter((t) => t.status === 'oov').map((t) => t.token);

    if (oovTokens.length === synthRes.trace.length) {
      return {
        success: false,
        error: `Các từ trong câu chưa có bản thu âm trong ngữ liệu (${oovTokens.join(', ')}). Hãy vào mục "Ngữ liệu" để thu âm thêm.`,
        missingTokens: oovTokens,
      };
    }

    return {
      success: true,
      result: synthRes,
      missingTokens: oovTokens,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Có lỗi xảy ra trong quá trình ghép nối âm thanh.',
    };
  }
}

