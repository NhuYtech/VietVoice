import type { CorpusEntry, SynthResult } from '../lib/types';
import { synthesize, normalizeText } from '../lib/tts';
import { INITIAL_CONVERSION_HISTORY, MOCK_CORPUS_ITEMS, type ConversionHistoryItem } from '../data/mockCorpus';

const STORAGE_KEY = 'vietvoice_conversion_history';

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
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return INITIAL_CONVERSION_HISTORY;
    }
    // Chuẩn hóa và làm sạch từng mục để không bao giờ bị undefined gây crash
    return parsed.map((item, idx) => ({
      id: item?.id || `hist-${idx}-${Date.now()}`,
      text: String(item?.text || 'Mẫu âm thanh'),
      speaker: (item?.speaker === 'Nữ' || item?.speaker === 'Nữ 01' ? 'Nữ' : 'Nam') as 'Nam' | 'Nữ',
      duration: typeof item?.duration === 'number' && !isNaN(item.duration) ? item.duration : 0.6,
      createdAt: String(item?.createdAt || '2026-11-02 12:00'),
      filename: String(item?.filename || 'vietvoice_audio.wav'),
      status: item?.status === 'failed' ? 'failed' : 'completed',
    }));
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
    if (!Array.isArray(items)) return;
    const serializable = items.slice(0, 50).map((item) => ({
      id: item.id,
      text: item.text,
      speaker: item.speaker,
      duration: typeof item.duration === 'number' ? item.duration : 0.6,
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
  speaker: 'Nam' | 'Nữ',
  duration: number,
  audioBlob?: Blob,
  audioUrl?: string
): ConversionHistoryItem {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const cleanText = (text || '').trim().slice(0, 15).replace(/\s+/g, '_').toLowerCase();
  const filename = `vietvoice_${speaker === 'Nam' ? 'nam' : 'nu'}_${cleanText || 'audio'}.wav`;

  const newItem: ConversionHistoryItem = {
    id: `conv-${Date.now()}`,
    text: (text || '').trim(),
    speaker,
    duration: typeof duration === 'number' && !isNaN(duration) ? duration : 0.6,
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
export function mapSpeakerToCore(speaker: 'Nam' | 'Nữ'): string {
  return speaker === 'Nam' ? 'nam' : 'nu';
}

export interface WordVoiceCheck {
  token: string;
  inCurrentVoice: boolean;
  inOtherVoice: boolean;
  isAvailableAnywhere: boolean;
  correctVoice?: 'Nam' | 'Nữ';
}

/**
 * Kiểm tra ràng buộc chọn giọng đọc cho từng từ:
 * - Nếu từ có bản thu âm là giọng Nữ: Bắt buộc người dùng phải chọn giọng Nữ
 * - Nếu từ có bản thu âm là giọng Nam: Bắt buộc người dùng phải chọn giọng Nam
 * - Nếu không đúng giọng: Thông báo rõ ràng để người dùng chọn lại giọng đọc cho đúng
 */
export function inspectVocabularyWithVoice(
  text: string,
  selectedVoice: 'Nam' | 'Nữ',
  entries: CorpusEntry[]
): {
  tokens: string[];
  wordChecks: WordVoiceCheck[];
  hasWrongVoice: boolean;
  wrongVoiceWords: string[];
  suggestedVoice?: 'Nam' | 'Nữ';
  wrongVoiceMessage?: string;
  hasMissing: boolean;
  missingTokens: string[];
  missingMessage?: string;
  canConvert: boolean;
} {
  const norm = normalizeText(text || '');
  if (!norm) {
    return {
      tokens: [],
      wordChecks: [],
      hasWrongVoice: false,
      wrongVoiceWords: [],
      hasMissing: false,
      missingTokens: [],
      canConvert: false,
    };
  }

  const tokens = norm.split(/\s+/).filter(Boolean);
  const safeEntries = Array.isArray(entries) ? entries : [];

  // Tạo tập từ có sẵn của từng giọng (kết hợp cả dữ liệu thu âm thật và dữ liệu ngữ liệu)
  const maleSet = new Set<string>();
  const femaleSet = new Set<string>();

  // Từ thật trong IndexedDB
  for (const e of safeEntries) {
    const spk = (e?.speaker || '').toLowerCase();
    const w = (e?.word || '').toLowerCase();
    if (!w) continue;
    if (spk === 'nam' || spk.includes('nam')) {
      maleSet.add(w);
      w.split(/\s+/).forEach((part) => maleSet.add(part));
    } else {
      femaleSet.add(w);
      w.split(/\s+/).forEach((part) => femaleSet.add(part));
    }
  }

  // Từ mẫu trong Ngữ liệu
  for (const m of MOCK_CORPUS_ITEMS) {
    const w = (m.word || '').toLowerCase();
    if (!w) continue;
    if (m.speaker === 'Nam') {
      maleSet.add(w);
      w.split(/\s+/).forEach((part) => maleSet.add(part));
    } else {
      femaleSet.add(w);
      w.split(/\s+/).forEach((part) => femaleSet.add(part));
    }
  }

  const otherVoice: 'Nam' | 'Nữ' = selectedVoice === 'Nam' ? 'Nữ' : 'Nam';
  const currentSet = selectedVoice === 'Nam' ? maleSet : femaleSet;
  const otherSet = selectedVoice === 'Nam' ? femaleSet : maleSet;

  const wordChecks: WordVoiceCheck[] = [];
  const wrongVoiceWords: string[] = [];
  const missingTokens: string[] = [];

  for (const tok of tokens) {
    const inCurrent = currentSet.has(tok);
    const inOther = otherSet.has(tok);

    if (inCurrent) {
      wordChecks.push({
        token: tok,
        inCurrentVoice: true,
        inOtherVoice: inOther,
        isAvailableAnywhere: true,
        correctVoice: selectedVoice,
      });
    } else if (inOther) {
      // Từ này có file âm thanh nhưng là của giọng kia!
      wordChecks.push({
        token: tok,
        inCurrentVoice: false,
        inOtherVoice: true,
        isAvailableAnywhere: true,
        correctVoice: otherVoice,
      });
      wrongVoiceWords.push(tok);
    } else {
      // Hoàn toàn chưa có trong ngữ liệu cả 2 giọng
      wordChecks.push({
        token: tok,
        inCurrentVoice: false,
        inOtherVoice: false,
        isAvailableAnywhere: false,
      });
      missingTokens.push(tok);
    }
  }

  const hasWrongVoice = wrongVoiceWords.length > 0;
  const hasMissing = missingTokens.length > 0;
  const canConvert = tokens.length > 0 && !hasWrongVoice && !hasMissing;

  let wrongVoiceMessage: string | undefined;
  if (hasWrongVoice) {
    wrongVoiceMessage = `Từ "${wrongVoiceWords.join(', ')}" có file thu âm là Giọng ${otherVoice}. Vui lòng chọn "Giọng ${otherVoice}" rồi mới nhấn Chuyển thành âm thanh!`;
  }

  let missingMessage: string | undefined;
  if (hasMissing) {
    missingMessage = `Từ "${missingTokens.join(', ')}" chưa có bản thu âm trong hệ thống ngữ liệu. Vui lòng vào mục "Ngữ liệu" để thu âm từ này trước khi chuyển thành âm thanh!`;
  }

  return {
    tokens,
    wordChecks,
    hasWrongVoice,
    wrongVoiceWords,
    suggestedVoice: hasWrongVoice ? otherVoice : undefined,
    wrongVoiceMessage,
    hasMissing,
    missingTokens,
    missingMessage,
    canConvert,
  };
}

/**
 * Phiên bản tương thích với MainEditor
 */
export function inspectVocabulary(
  text: string,
  speaker: 'Nam' | 'Nữ',
  entries: CorpusEntry[]
) {
  const res = inspectVocabularyWithVoice(text, speaker, entries);
  const matchedWords = res.wordChecks.filter((w) => w.inCurrentVoice).map((w) => w.token);
  const missingWords = res.wordChecks.filter((w) => !w.inCurrentVoice).map((w) => w.token);

  return {
    ...res,
    matchedWords,
    missingWords,
    isFullyAvailable: res.canConvert,
  };
}

/**
 * Thực hiện tổng hợp âm thanh từ ngữ liệu thu âm thật với ràng buộc giọng đọc nghiêm ngặt
 */
export async function performSynthesis(
  text: string,
  speaker: 'Nam' | 'Nữ',
  entries: CorpusEntry[]
): Promise<{
  success: boolean;
  result?: SynthResult;
  error?: string;
  missingTokens?: string[];
  suggestedVoice?: 'Nam' | 'Nữ';
}> {
  const norm = normalizeText(text || '');
  if (!norm) {
    return { success: false, error: 'Vui lòng nhập văn bản tiếng Việt hợp lệ.' };
  }

  // 1. Kiểm tra ràng buộc giọng đọc (nếu từ thu âm là Nữ thì bắt buộc chọn Nữ, nếu là Nam thì bắt buộc chọn Nam)
  const voiceCheck = inspectVocabularyWithVoice(text, speaker, entries);
  if (voiceCheck.hasWrongVoice) {
    return {
      success: false,
      error: voiceCheck.wrongVoiceMessage,
      suggestedVoice: voiceCheck.suggestedVoice,
      missingTokens: voiceCheck.wrongVoiceWords,
    };
  }

  if (voiceCheck.hasMissing) {
    return {
      success: false,
      error:
        voiceCheck.missingMessage ||
        `Từ "${voiceCheck.missingTokens.join(', ')}" chưa có bản thu âm trong ngữ liệu. Vui lòng vào mục "Ngữ liệu" để thu âm thêm trước khi chuyển thành âm thanh!`,
      missingTokens: voiceCheck.missingTokens,
    };
  }

  const speakerKey = mapSpeakerToCore(speaker);
  const safeEntries = Array.isArray(entries) ? entries : [];

  // Chỉ lấy đúng các mục của người nói này (KHÔNG fallback sang giọng khác)
  const speakerEntries = safeEntries.filter((e) => {
    const spk = (e?.speaker || '').toLowerCase();
    return spk === speakerKey || spk.includes(speakerKey);
  });

  try {
    const synthRes = await synthesize(norm, speakerEntries, {
      speaker: speakerKey,
      gapMs: 80,
      crossfadeMs: 25,
      trim: true,
      normalize: true,
      fallbackSpeaker: false, // RÀNG BUỘC: Không tự động lấy giọng khác, phải đúng giọng đã chọn
    });

    const oovTokens = (synthRes.trace || []).filter((t) => t.status === 'oov').map((t) => t.token);

    if (synthRes.trace && oovTokens.length === synthRes.trace.length) {
      return {
        success: false,
        error: `Các từ trong câu chưa có file âm thanh cho Giọng ${speaker}. Hãy chuyển sang giọng khác hoặc vào mục "Ngữ liệu" để thu âm.`,
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
