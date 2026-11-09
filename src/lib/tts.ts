import { SR, decodeBlob, encodeWav, extractFeatures, estimateF0, fadeEdges, normalizeRms, trimSilence, applyHighpassFilter, smartTrimWordAudio, applyStudioLimiter, normalizeSpeechRms, masterSpeechAudio } from './dsp';
import { putEntry } from './store';
import type { CorpusEntry, JoinInfo, SynthResult, TraceItem } from './types';
import { encodeVnWord, isVniCode, decodeVnWord, wordAndCodeFromFilename } from './vniCodec';
import { normalizeNumbersInText, hasNumbers } from './numberNormalizer';
import type { PauseSettings } from '../components/PauseSettingsModal';
import { DEFAULT_PAUSE_SETTINGS } from '../components/PauseSettingsModal';

/* Bước 1: chuẩn hóa văn bản (hỗ trợ cả tiếng Việt có dấu và mã VNI quy ước a+, d-, o+...) */
export function normalizeText(s: string): string {
  let text = s;
  if (!isVniCode(text) && hasNumbers(text)) {
    text = normalizeNumbersInText(text);
  }
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\+\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const entryId = (speaker: string, word: string) => `${speaker}::${word}`;

/* Bộ nhớ đệm âm thanh gốc / đã tiền xử lý */
const rawCache = new Map<string, Float32Array>();
const procCache = new Map<string, Float32Array>();

export async function getRaw(e: CorpusEntry): Promise<Float32Array> {
  let x = rawCache.get(e.id);
  if (!x) {
    x = await decodeBlob(e.blob);
    rawCache.set(e.id, x);
  }
  return x;
}

export function invalidate(id: string) {
  rawCache.delete(id);
  [...procCache.keys()].filter((k) => k.startsWith(id + '|')).forEach((k) => procCache.delete(k));
}

export interface SynthOptions {
  speaker: string;
  gapMs: number; // khoảng lặng giữa các từ (0 = chồng crossfade)
  crossfadeMs: number;
  trim: boolean;
  normalize: boolean;
  fallbackSpeaker: boolean;
  pauseSettings?: PauseSettings;
  rawText?: string;
}

/**
 * Tính toán khoảng ngắt nghỉ giữa các từ dựa vào dấu câu (chấm, phẩy, chấm phẩy, xuống dòng)
 */
export interface GapDetail {
  gapMs: number;
  punctuation?: string;
  pauseLabel?: string;
}

function computeSegmentGaps(
  rawText: string,
  picked: { item: TraceItem }[],
  pauseSettings: PauseSettings,
  defaultGapMs: number
): { gaps: number[]; details: GapDetail[] } {
  const gaps: number[] = new Array(picked.length).fill(defaultGapMs);
  const details: GapDetail[] = new Array(picked.length).fill(null).map(() => ({ gapMs: defaultGapMs }));
  if (picked.length <= 1) return { gaps, details };

  let searchIdx = 0;
  const positions: { start: number; end: number }[] = [];
  const lowerText = rawText.toLowerCase();

  for (const p of picked) {
    const tok = p.item.token.toLowerCase();
    const idx = lowerText.indexOf(tok, searchIdx);
    if (idx !== -1) {
      positions.push({ start: idx, end: idx + tok.length });
      searchIdx = idx + tok.length;
    } else {
      positions.push({ start: searchIdx, end: searchIdx });
    }
  }

  for (let k = 1; k < picked.length; k++) {
    const prevEnd = positions[k - 1].end;
    const currStart = positions[k].start;
    const between = currStart >= prevEnd ? rawText.slice(prevEnd, currStart) : '';

    if (between.includes('\n')) {
      const g = Math.round((pauseSettings.newline ?? 0.6) * 1000);
      gaps[k] = g;
      details[k] = { gapMs: g, punctuation: '↵', pauseLabel: 'Xuống dòng' };
    } else if (/[.!?]/.test(between)) {
      const m = between.match(/[.!?]/);
      const punct = m ? m[0] : '.';
      const g = Math.round((pauseSettings.period ?? 0.45) * 1000);
      gaps[k] = g;
      const label = punct === '?' ? 'Dấu hỏi' : punct === '!' ? 'Dấu chấm than' : 'Dấu chấm';
      details[k] = { gapMs: g, punctuation: punct, pauseLabel: label };
    } else if (between.includes(';') || between.includes(':')) {
      const m = between.match(/[;:]/);
      const punct = m ? m[0] : ';';
      const g = Math.round((pauseSettings.semicolon ?? 0.3) * 1000);
      gaps[k] = g;
      const label = punct === ':' ? 'Dấu hai chấm' : 'Dấu chấm phẩy';
      details[k] = { gapMs: g, punctuation: punct, pauseLabel: label };
    } else if (between.includes(',') || between.includes(' - ') || between.includes(' — ') || between.includes(' – ')) {
      const g = Math.round((pauseSettings.comma ?? 0.25) * 1000);
      gaps[k] = g;
      details[k] = { gapMs: g, punctuation: ',', pauseLabel: 'Dấu phẩy' };
    } else {
      gaps[k] = defaultGapMs;
      details[k] = { gapMs: defaultGapMs };
    }
  }

  return { gaps, details };
}

export async function getProcessed(e: CorpusEntry, trim: boolean, normalize: boolean): Promise<Float32Array> {
  const key = `${e.id}|${trim}|${normalize}`;
  let x = procCache.get(key);
  if (!x) {
    x = await getRaw(e);
    // 1. Cân bằng tần số: Lọc hạ tần 60Hz loại bỏ tiếng quạt, gió, ù mic rất thấp
    x = applyHighpassFilter(x, SR, 60);
    // 2. Cắt khoảng lặng thông minh gọn gàng (đệm an toàn 12ms đầu, 16ms cuối không bị mất phụ âm)
    if (trim) {
      x = smartTrimWordAudio(x, SR, { silenceThreshDb: -42, leadPadMs: 12, tailPadMs: 16 });
    }
    // 3. Chuẩn hóa năng lượng tiếng nói đồng đều giữa mọi từ (-15.5 dBFS) triệt tiêu "chữ lớn chữ nhỏ"
    if (normalize) {
      x = normalizeSpeechRms(x, SR, -15.5);
    }
    x = fadeEdges(x, 2);
    procCache.set(key, x);
  }
  return x;
}

function rmsDb(x: Float32Array, atEnd: boolean): number {
  const n = Math.min(x.length, Math.round(0.02 * SR));
  const s = atEnd ? x.length - n : 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += x[s + i] * x[s + i];
  return 20 * Math.log10(Math.sqrt(sum / Math.max(1, n)) + 1e-5);
}

function edgeF0(x: Float32Array, atEnd: boolean): number {
  for (let k = 0; k < 3; k++) {
    const s = atEnd ? Math.max(0, x.length - 882 - k * 220) : k * 220;
    const f = estimateF0(x, s);
    if (f > 0) return f;
  }
  return 0;
}

/** Bước 2–5: tra cứu longest-match → tiền xử lý → ghép nối → kiểm tra điểm nối. */
export async function synthesize(text: string, entries: CorpusEntry[], opts: SynthOptions): Promise<SynthResult> {
  const t0 = performance.now();
  const tokens = normalizeText(text).split(' ').filter(Boolean);

  // Tự động nạp manifest nếu chưa kịp nạp khi khởi động
  if (manifestLookup.size === 0) {
    await loadManifest(new Set()).catch(() => []);
  }

  // Tải tức thì các từ trong câu nếu có trong manifest datasetTV mà chưa tải
  const targetSpeaker = opts.speaker.toLowerCase();
  const existingWordSet = new Set(entries.map((e) => normalizeText(e.word)));

  // Thu thập danh sách các từ còn thiếu ĐỘC NHẤT (không trùng lặp)
  const uniqueMissingTokens = Array.from(new Set(tokens.filter((tok) => !existingWordSet.has(tok))));

  const manifestItemsToFetch = new Map<string, ManifestItem>();
  for (const tok of uniqueMissingTokens) {
    const m =
      manifestLookup.get(`${targetSpeaker}::${tok}`) ||
      manifestLookup.get(`${targetSpeaker}::${encodeVnWord(tok)}`) ||
      manifestLookup.get(`hữu thọ::${tok}`) ||
      manifestLookup.get(`hữu thọ::${encodeVnWord(tok)}`) ||
      manifestLookup.get(`nam::${tok}`);
    if (m) {
      const key = m.code || m.word;
      manifestItemsToFetch.set(key, m);
    }
  }

  // Tải song song đa luồng (Concurrent Parallel Batch Fetching)
  // Tận dụng tối đa HTTP/2 multiplexing tới Cloudinary CDN để tải nhanh gấp 10-20 lần
  if (manifestItemsToFetch.size > 0) {
    const items = Array.from(manifestItemsToFetch.values());
    const CONCURRENCY = 12;

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const chunk = items.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(chunk.map((m) => fetchManifestWord(m)));
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value) {
          const entry = res.value;
          entries.push(entry);
          existingWordSet.add(normalizeText(entry.word));
          if (entry.code) existingWordSet.add(normalizeText(entry.code));
        }
      }
    }
  }

  const mine = new Map<string, CorpusEntry>();
  const others = new Map<string, CorpusEntry>();
  let maxN = 1;
  const optSpkLower = opts.speaker.toLowerCase();
  for (const e of entries) {
    const eSpk = (e.speaker || '').toLowerCase();
    const isMine =
      eSpk === optSpkLower ||
      eSpk.includes(optSpkLower) ||
      (optSpkLower.includes('thọ') && (eSpk.includes('thọ') || eSpk === 'nam')) ||
      (optSpkLower === 'nam' && eSpk.includes('thọ'));
    const target = isMine ? mine : others;
    target.set(normalizeText(e.word), e);
    target.set(e.word, e);
    const c = e.code || encodeVnWord(e.word);
    if (c) {
      target.set(c, e);
      target.set(normalizeText(c), e);
    }
    maxN = Math.max(maxN, e.word.split(' ').length);
  }

  const trace: TraceItem[] = [];
  const picked: { entry: CorpusEntry; item: TraceItem }[] = [];
  for (let i = 0; i < tokens.length; ) {
    let done = false;
    for (let n = Math.min(maxN, tokens.length - i); n >= 1 && !done; n--) {
      const key = tokens.slice(i, i + n).join(' ');
      let e = mine.get(key) || mine.get(encodeVnWord(key));
      if (!e && isVniCode(key)) {
        e = mine.get(decodeVnWord(key));
      }
      let status: TraceItem['status'] = 'ok';
      if (!e && opts.fallbackSpeaker) {
        e = others.get(key) || others.get(encodeVnWord(key));
        if (!e && isVniCode(key)) {
          e = others.get(decodeVnWord(key));
        }
        status = 'fallback';
      }
      if (e) {
        const item: TraceItem = {
          token: key,
          status,
          entryId: e.id,
          speaker: e.speaker,
          code: e.code,
          source: e.source,
          blob: e.blob,
        };
        trace.push(item);
        picked.push({ entry: e, item });
        i += n;
        done = true;
      }
    }
    if (!done) {
      trace.push({ token: tokens[i], status: 'oov' });
      i++;
    }
  }

  const segs: Float32Array[] = await Promise.all(
    picked.map(async (p) => {
      const x = await getProcessed(p.entry, opts.trim, opts.normalize);
      p.item.duration = x.length / SR;
      return x;
    })
  );

  const rawText = opts.rawText ? normalizeNumbersInText(opts.rawText) : text;
  const pauseSettings = opts.pauseSettings || DEFAULT_PAUSE_SETTINGS;
  const { gaps: segmentGaps, details: gapDetails } = computeSegmentGaps(rawText, picked, pauseSettings, opts.gapMs);

  const cf = Math.round((opts.crossfadeMs / 1000) * SR);
  const starts: number[] = [];
  let prevEnd = 0;
  segs.forEach((x, k) => {
    let s = 0;
    if (k > 0) {
      const curGapMs = segmentGaps[k] ?? opts.gapMs;
      const gapSamples = Math.round((curGapMs / 1000) * SR);
      s = curGapMs > 0 ? prevEnd + gapSamples : Math.max(0, prevEnd - Math.min(cf, x.length, segs[k - 1].length));
    }
    starts.push(s);
    prevEnd = s + x.length;
  });
  const out = new Float32Array(Math.max(1, prevEnd));
  segs.forEach((x, k) => {
    const s = starts[k];
    const overlap = k > 0 ? Math.max(0, starts[k - 1] + segs[k - 1].length - s) : 0;
    for (let i = 0; i < overlap; i++) out[s + i] *= Math.cos((i / overlap) * (Math.PI / 2)); // equal-power
    for (let i = 0; i < x.length; i++) {
      const g = i < overlap ? Math.sin((i / overlap) * (Math.PI / 2)) : 1;
      out[s + i] += x[i] * g;
    }
    picked[k].item.start = s / SR;
  });

  const joins: JoinInfo[] = [];
  for (let k = 1; k < segs.length; k++) {
    const dB = Math.abs(rmsDb(segs[k], false) - rmsDb(segs[k - 1], true));
    const f1 = edgeF0(segs[k - 1], true);
    const f2 = edgeF0(segs[k], false);
    const st = f1 > 0 && f2 > 0 ? Math.abs(12 * Math.log2(f2 / f1)) : null;
    const prevEndSec = (starts[k - 1] + segs[k - 1].length) / SR;
    const currStartSec = starts[k] / SR;
    const detail = gapDetails[k] || { gapMs: opts.gapMs };
    const actualGapMs = Math.max(0, Math.round((currStartSec - prevEndSec) * 1000));

    joins.push({
      left: picked[k - 1].item.token,
      right: picked[k].item.token,
      energyJumpDb: Math.round(dB * 10) / 10,
      f0JumpSemitone: st === null ? null : Math.round(st * 10) / 10,
      smooth: dB < 12 && (st === null || st < 4),
      punctuation: detail.punctuation,
      pauseLabel: detail.pauseLabel,
      gapMs: actualGapMs || detail.gapMs,
      pauseStartSec: Math.round(prevEndSec * 100) / 100,
      pauseEndSec: Math.round(currStartSec * 100) / 100,
    });
  }

  return {
    text,
    speaker: opts.speaker,
    samples: out,
    sampleRate: SR,
    wav: encodeWav(out, SR),
    trace,
    joins,
    durationSec: out.length / SR,
    elapsedMs: Math.round(performance.now() - t0),
  };
}

/* Nhập dữ liệu vào ngữ liệu */
export async function addToCorpus(
  blob: Blob,
  word: string,
  speaker: string,
  source: CorpusEntry['source'],
  fastTrack = false
): Promise<CorpusEntry> {
  let w = normalizeText(word);
  if (!w) throw new Error('Từ không hợp lệ');

  // Nếu người dùng nhập mã quy ước (vd: bac1, cang3, ba0), tự động giải mã thành từ có dấu
  if (isVniCode(w)) {
    const decoded = decodeVnWord(w);
    if (decoded) w = normalizeText(decoded);
  }

  const code = encodeVnWord(w);
  const spk = speaker.trim() || 'default';
  const id = entryId(spk, w);

  let raw = rawCache.get(id);
  if (!raw) {
    raw = await decodeBlob(blob);
    rawCache.set(id, raw);
  }

  let features: import('./types').Features;
  if (fastTrack) {
    // Chế độ siêu tốc: chỉ trích xuất các đặc trưng cơ bản (<0.01ms), bỏ qua STFT/MFCC/Pitch nặng nề
    let peak = 0;
    let sq = 0;
    for (let i = 0; i < raw.length; i++) {
      const v = Math.abs(raw[i]);
      if (v > peak) peak = v;
      sq += v * v;
    }
    const rms = Math.sqrt(sq / Math.max(1, raw.length));
    features = {
      duration: Math.round((raw.length / SR) * 1000) / 1000,
      sampleRate: SR,
      peak: Math.round(peak * 1000) / 1000,
      rms: Math.round(rms * 10000) / 10000,
      energyDb: [],
      f0: [],
      f0Mean: 0,
      f0Min: 0,
      f0Max: 0,
      voicedRatio: 0,
      centroid: 0,
      zcr: 0,
      ltas: [],
      mfccMean: [],
    };
  } else {
    features = extractFeatures(raw);
  }

  const entry: CorpusEntry = {
    id,
    word: w,
    code,
    speaker: spk,
    blob,
    source,
    addedAt: Date.now(),
    duration: raw.length / SR,
    features,
  };

  // Lưu ngầm vào IndexedDB (không chặn hàm tổng hợp âm thanh)
  putEntry(entry).catch((err) => {
    console.warn(`Lỗi lưu IndexedDB cho từ "${w}":`, err);
  });
  invalidate(entry.id);
  rawCache.set(entry.id, raw);
  return entry;
}

/** Đọc từ vựng từ tên file .wav (hỗ trợ cả quy ước VNI như bac1.wav, cang3.wav, ba0.wav hoặc tên thông thường) */
export const wordFromFilename = (name: string): string => {
  const { word } = wordAndCodeFromFilename(name);
  return normalizeText(word);
};

export interface ManifestItem {
  id?: string;
  word: string;
  speaker: string;
  file: string;
  code?: string;
  audioUrl?: string;
  cloudinaryPublicId?: string;
  duration?: number;
}

export let cachedManifestWords: ManifestItem[] = [];
export const manifestLookup = new Map<string, ManifestItem>();

/** Nạp danh mục bộ dữ liệu từ MongoDB Backend API (fallback sang /corpus/manifest.json nếu offline). */
export async function loadManifest(existing: Set<string>): Promise<CorpusEntry[]> {
  try {
    let words: ManifestItem[] = [];

    // 1. Nạp tức thì siêu tốc (<5ms) từ manifest static để UI có ngay 6.674 từ
    try {
      const res = await fetch('/corpus/manifest.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.words) && data.words.length > 0) {
          words = data.words;
          cachedManifestWords = words;
        }
      }
    } catch (e) {
      // bỏ qua
    }

    // 2. Đồng bộ thêm từ MongoDB Backend
    try {
      const res = await fetch('/api/audio/manifest');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.words) && data.words.length > 0) {
          words = data.words;
          console.log(`[VietVoice] Đã nạp ${words.length} từ từ MongoDB Database!`);
        }
      }
    } catch (apiErr) {
      console.warn('[VietVoice] Backend MongoDB chưa phản hồi, giữ manifest sẵn có:', apiErr);
    }

    cachedManifestWords = words.map((w: any) => ({
      ...w,
      speaker: w.speaker && w.speaker.toLowerCase() !== 'nam' ? w.speaker : 'Hữu Thọ',
    }));
    manifestLookup.clear();
    for (const m of cachedManifestWords) {
      const spk = (m.speaker || 'Hữu Thọ').toLowerCase();
      const normW = normalizeText(m.word);
      manifestLookup.set(`${spk}::${normW}`, m);
      manifestLookup.set(`hữu thọ::${normW}`, m);
      manifestLookup.set(`huu tho::${normW}`, m);
      manifestLookup.set(`nam::${normW}`, m);
      const code = m.code || encodeVnWord(normW);
      if (code && code !== normW) {
        manifestLookup.set(`${spk}::${code.toLowerCase()}`, m);
        manifestLookup.set(`hữu thọ::${code.toLowerCase()}`, m);
        manifestLookup.set(`huu tho::${code.toLowerCase()}`, m);
        manifestLookup.set(`nam::${code.toLowerCase()}`, m);
      }
    }
  } catch (err) {
    console.warn('Không thể nạp manifest:', err);
  }
  return cachedManifestWords.length as any;
}

/** Tải và nạp âm thanh của một từ từ Cloudinary (hoặc local manifest) vào IndexedDB theo nhu cầu */
export async function fetchManifestWord(m: ManifestItem): Promise<CorpusEntry | null> {
  try {
    // Ưu tiên audioUrl từ Cloudinary CDN được lưu trong MongoDB
    let fileUrl = m.audioUrl;
    if (!fileUrl) {
      const code = m.code || (m.file ? m.file.replace(/^wavs\//, '').replace(/\.wav$/, '') : m.word);
      const publicId = m.cloudinaryPublicId || code.replace(/\+/g, '_');
      fileUrl = `https://res.cloudinary.com/wximbfoz/video/upload/${publicId}.wav`;
    }

    const res = await fetch(fileUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      console.warn(`File âm thanh ${m.file} không tồn tại trên server:`, fileUrl);
      return null;
    }
    const blob = await res.blob();
    if (blob.size < 100) return null;
    const entry = await addToCorpus(blob, m.word, m.speaker || 'Hữu Thọ', 'manifest', true);
    return entry;
  } catch (err) {
    console.error('Lỗi khi tải file từ ngữ liệu manifest:', m.word, err);
    return null;
  }
}
