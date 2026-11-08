import type { CorpusEntry, SynthResult } from '../lib/types';
import { synthesize, normalizeText, cachedManifestWords } from '../lib/tts';
import { INITIAL_CONVERSION_HISTORY, MOCK_CORPUS_ITEMS, type ConversionHistoryItem } from '../data/mockCorpus';
import { getStoredPauseSettings } from '../components/PauseSettingsModal';

const STORAGE_KEY = 'vietvoice_conversion_history';

export const historyAudioCache = new Map<string, Blob>();

/**
 * Tự động tìm Blob âm thanh trong cache hoặc tổng hợp nhanh tức thì nếu thiếu
 */
export async function resolveTrackAudioBlob(
  track: { id?: string; text: string; speaker: 'Hữu Thọ' | 'Nam' | string; audioBlob?: Blob },
  entries: CorpusEntry[]
): Promise<Blob | null> {
  if (track.audioBlob) return track.audioBlob;
  if (track.id && historyAudioCache.has(track.id)) {
    return historyAudioCache.get(track.id)!;
  }
  const cleanKey = `${(track.text || '').trim().toLowerCase()}__${track.speaker}`;
  if (historyAudioCache.has(cleanKey)) {
    return historyAudioCache.get(cleanKey)!;
  }
  try {
    const synthRes = await performSynthesis(track.text, 'Hữu Thọ', entries);
    if (synthRes.success && synthRes.result?.wav) {
      if (track.id) historyAudioCache.set(track.id, synthRes.result.wav);
      historyAudioCache.set(cleanKey, synthRes.result.wav);
      return synthRes.result.wav;
    }
  } catch (err) {
    console.error('Không thể tự động tổng hợp âm thanh:', err);
  }
  return null;
}


/**
 * Lấy lịch sử chuyển đổi từ LocalStorage (hoặc khởi tạo với dữ liệu mẫu)
 */
export function getStoredHistory(): ConversionHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const real = parsed.filter((it: any) => it && !String(it.id).startsWith('hist-'));
    return real.map((item: any, idx: number) => ({
      id: String(item?.id || `conv-${idx}`),
      text: String(item?.text || ''),
      speaker: 'Hữu Thọ' as 'Hữu Thọ',
      duration: typeof item?.duration === 'number' && !isNaN(item.duration) ? item.duration : 0.6,
      createdAt: String(item?.createdAt || ''),
      filename: String(item?.filename || 'vietvoice_audio.wav'),
      status: item?.status === 'failed' ? 'failed' : 'completed',
    }));
  } catch (err) {
    return [];
  }
}

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
  speaker: 'Hữu Thọ' | 'Nam' = 'Hữu Thọ',
  duration: number,
  audioBlob?: Blob,
  audioUrl?: string,
  status: 'converting' | 'completed' | 'failed' = 'completed'
): ConversionHistoryItem {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const cleanText = (text || '').trim().slice(0, 15).replace(/\s+/g, '_').toLowerCase();
  const filename = `vietvoice_huutho_${cleanText || 'audio'}.wav`;

  const newItem: ConversionHistoryItem = {
    id: `conv-${Date.now()}`,
    text: (text || '').trim(),
    speaker: 'Hữu Thọ',
    duration: typeof duration === 'number' && !isNaN(duration) ? duration : 0.6,
    createdAt: dateStr,
    audioBlob,
    audioUrl,
    filename,
    status,
  };

  const current = getStoredHistory();
  const updated = [newItem, ...current];
  saveHistory(updated);
  if (audioBlob) {
    historyAudioCache.set(newItem.id, audioBlob);
    historyAudioCache.set(`${newItem.text.trim().toLowerCase()}__${newItem.speaker}`, audioBlob);
  }
  return newItem;
}

/**
 * Xóa một mục lịch sử
 */
export function removeHistoryEntry(id: string): ConversionHistoryItem[] {
  const current = getStoredHistory();
  const updated = current.filter((item) => item.id !== id);
  saveHistory(updated);
  historyAudioCache.delete(id);
  return updated;
}

/**
 * Xóa nhiều mục lịch sử cùng lúc
 */
export function removeHistoryEntries(ids: string[]): ConversionHistoryItem[] {
  const idSet = new Set(ids);
  const current = getStoredHistory();
  const updated = current.filter((item) => !idSet.has(item.id));
  saveHistory(updated);
  ids.forEach((id) => historyAudioCache.delete(id));
  return updated;
}

/**
 * Chuẩn hóa tên speaker cho thư viện tts (Hữu Thọ tương ứng mã 'nam')
 */
export function mapSpeakerToCore(_speaker?: string): string {
  return 'nam';
}

export interface WordVoiceCheck {
  token: string;
  inCurrentVoice: boolean;
  inOtherVoice?: boolean;
  isAvailableAnywhere: boolean;
  correctVoice?: 'Hữu Thọ';
}

/**
 * Kiểm tra từ vựng có trong bộ dữ liệu thu âm của Hữu Thọ hay không
 */
export function inspectVocabularyWithVoice(
  text: string,
  _selectedVoice: 'Hữu Thọ' | 'Nam' = 'Hữu Thọ',
  entries: CorpusEntry[]
): {
  tokens: string[];
  wordChecks: WordVoiceCheck[];
  hasWrongVoice: boolean;
  wrongVoiceWords: string[];
  suggestedVoice?: 'Hữu Thọ';
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

  // Tập hợp toàn bộ từ có bản thu âm của Hữu Thọ
  const availableSet = new Set<string>();

  // Từ trong IndexedDB / bản ghi âm thêm mới
  for (const e of safeEntries) {
    const w = (e?.word || '').toLowerCase();
    if (!w) continue;
    availableSet.add(w);
    w.split(/\s+/).forEach((part) => availableSet.add(part));
  }

  // Từ mẫu trong Ngữ liệu
  for (const m of MOCK_CORPUS_ITEMS) {
    const w = (m.word || '').toLowerCase();
    if (!w) continue;
    availableSet.add(w);
    w.split(/\s+/).forEach((part) => availableSet.add(part));
  }

  // Toàn bộ 6.674 từ trong bộ dữ liệu datasetTV của Hữu Thọ
  for (const m of cachedManifestWords) {
    const w = (m.word || '').toLowerCase();
    if (!w) continue;
    availableSet.add(w);
    w.split(/\s+/).forEach((part) => availableSet.add(part));
  }

  const wordChecks: WordVoiceCheck[] = [];
  const missingTokens: string[] = [];

  for (const tok of tokens) {
    const inCurrent = availableSet.has(tok);

    if (inCurrent) {
      wordChecks.push({
        token: tok,
        inCurrentVoice: true,
        isAvailableAnywhere: true,
        correctVoice: 'Hữu Thọ',
      });
    } else {
      wordChecks.push({
        token: tok,
        inCurrentVoice: false,
        isAvailableAnywhere: false,
      });
      missingTokens.push(tok);
    }
  }

  const hasMissing = missingTokens.length > 0;
  const canConvert = tokens.length > 0 && !hasMissing;

  let missingMessage: string | undefined;
  if (hasMissing) {
    missingMessage = `Từ "${missingTokens.join(', ')}" chưa có bản thu âm của Hữu Thọ.`;
  }

  return {
    tokens,
    wordChecks,
    hasWrongVoice: false,
    wrongVoiceWords: [],
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
  speaker: 'Hữu Thọ' | 'Nam' = 'Hữu Thọ',
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
 * Thực hiện tổng hợp âm thanh từ ngữ liệu thu âm thật của giọng Hữu Thọ
 */
export async function performSynthesis(
  text: string,
  speaker: 'Hữu Thọ' | 'Nam' = 'Hữu Thọ',
  entries: CorpusEntry[]
): Promise<{
  success: boolean;
  result?: SynthResult;
  error?: string;
  missingTokens?: string[];
  suggestedVoice?: 'Hữu Thọ';
}> {
  const norm = normalizeText(text || '');
  if (!norm) {
    return { success: false, error: 'Vui lòng nhập văn bản tiếng Việt hợp lệ.' };
  }

  // Kiểm tra từ có bản thu âm chưa
  const voiceCheck = inspectVocabularyWithVoice(text, speaker, entries);
  if (voiceCheck.hasMissing) {
    return {
      success: false,
      error:
        voiceCheck.missingMessage ||
        `Từ "${voiceCheck.missingTokens.join(', ')}" chưa có bản thu âm.`,
      missingTokens: voiceCheck.missingTokens,
    };
  }

  const speakerKey = 'nam';
  const safeEntries = Array.isArray(entries) ? entries : [];

  // Chỉ lấy đúng các mục của Hữu Thọ (key 'nam')
  const speakerEntries = safeEntries.filter((e) => {
    const spk = (e?.speaker || '').toLowerCase();
    return spk === speakerKey || spk.includes(speakerKey) || spk.includes('hữu thọ');
  });

  const pauseSettings = getStoredPauseSettings();
  try {
    const synthRes = await synthesize(norm, speakerEntries, {
      speaker: speakerKey,
      gapMs: 35, // Khoảng cách tự nhiên 35ms giữa các từ
      crossfadeMs: 20,
      trim: true, // Cắt khoảng lặng thông minh (có đệm an toàn 40ms, bảo toàn nguyên âm/phụ âm)
      normalize: true, // Cân bằng biên độ nhẹ nhàng, hạ âm nếu quá to, chống rè
      fallbackSpeaker: true,
      pauseSettings,
      rawText: text,
    });

    const oovTokens = (synthRes.trace || []).filter((t) => t.status === 'oov').map((t) => t.token);

    if (synthRes.trace && oovTokens.length === synthRes.trace.length) {
      return {
        success: false,
        error: `Các từ này chưa có file âm thanh cho Giọng Hữu Thọ.`,
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
