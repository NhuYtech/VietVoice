import { SR, decodeBlob, encodeWav, extractFeatures, estimateF0, fadeEdges, normalizeRms, trimSilence } from './dsp';
import { putEntry } from './store';
import type { CorpusEntry, JoinInfo, SynthResult, TraceItem } from './types';
import { encodeVnWord, isVniCode, decodeVnWord, wordAndCodeFromFilename } from './vniCodec';
import type { PauseSettings } from '../components/PauseSettingsModal';
import { DEFAULT_PAUSE_SETTINGS } from '../components/PauseSettingsModal';

/* Bước 1: chuẩn hóa văn bản (hỗ trợ cả tiếng Việt có dấu và mã VNI quy ước a+, d-, o+...) */
export function normalizeText(s: string): string {
  return s
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
function computeSegmentGaps(
  rawText: string,
  picked: { item: TraceItem }[],
  pauseSettings: PauseSettings,
  defaultGapMs: number
): number[] {
  const gaps: number[] = new Array(picked.length).fill(defaultGapMs);
  if (picked.length <= 1) return gaps;

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
      gaps[k] = Math.round((pauseSettings.newline ?? 0.6) * 1000);
    } else if (/[.!?]/.test(between)) {
      gaps[k] = Math.round((pauseSettings.period ?? 0.45) * 1000);
    } else if (between.includes(';') || between.includes(':')) {
      gaps[k] = Math.round((pauseSettings.semicolon ?? 0.3) * 1000);
    } else if (between.includes(',') || between.includes(' - ') || between.includes(' — ')) {
      gaps[k] = Math.round((pauseSettings.comma ?? 0.25) * 1000);
    } else {
      gaps[k] = defaultGapMs;
    }
  }

  return gaps;
}

export async function getProcessed(e: CorpusEntry, trim: boolean, normalize: boolean): Promise<Float32Array> {
  const key = `${e.id}|${trim}|${normalize}`;
  let x = procCache.get(key);
  if (!x) {
    x = await getRaw(e);
    if (trim) x = trimSilence(x);
    if (normalize) x = normalizeRms(x);
    x = fadeEdges(x, 5);
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
  for (let k = 0; k < 8; k++) {
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
  const missingTokensToFetch: string[] = [];
  const existingWordSet = new Set(entries.map((e) => normalizeText(e.word)));

  for (const tok of tokens) {
    const mKey = `${targetSpeaker}::${tok}`;
    const codeKey = `${targetSpeaker}::${encodeVnWord(tok)}`;
    if (!existingWordSet.has(tok) && (manifestLookup.has(mKey) || manifestLookup.has(codeKey))) {
      missingTokensToFetch.push(tok);
    }
  }

  // Tải tuần tự các từ còn thiếu để tránh nghẽn CPU và bảo đảm 100% âm thanh được giải mã chuẩn xác
  if (missingTokensToFetch.length > 0) {
    for (const tok of missingTokensToFetch) {
      const m = manifestLookup.get(`${targetSpeaker}::${tok}`) || manifestLookup.get(`${targetSpeaker}::${encodeVnWord(tok)}`);
      if (m) {
        try {
          const entry = await fetchManifestWord(m);
          if (entry) {
            entries.push(entry);
            existingWordSet.add(tok);
            existingWordSet.add(normalizeText(entry.word));
          }
        } catch (fetchErr) {
          console.warn(`Không thể nạp từ "${tok}" từ manifest:`, fetchErr);
        }
      }
    }
  }

  const mine = new Map<string, CorpusEntry>();
  const others = new Map<string, CorpusEntry>();
  let maxN = 1;
  const optSpkLower = opts.speaker.toLowerCase();
  for (const e of entries) {
    const isMine = (e.speaker || '').toLowerCase() === optSpkLower || (e.speaker || '').toLowerCase().includes(optSpkLower);
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
        const item: TraceItem = { token: key, status, entryId: e.id, speaker: e.speaker };
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

  const segs: Float32Array[] = [];
  for (const p of picked) {
    const x = await getProcessed(p.entry, opts.trim, opts.normalize);
    p.item.duration = x.length / SR;
    segs.push(x);
  }

  const rawText = opts.rawText || text;
  const pauseSettings = opts.pauseSettings || DEFAULT_PAUSE_SETTINGS;
  const segmentGaps = computeSegmentGaps(rawText, picked, pauseSettings, opts.gapMs);

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
    joins.push({
      left: picked[k - 1].item.token,
      right: picked[k].item.token,
      energyJumpDb: Math.round(dB * 10) / 10,
      f0JumpSemitone: st === null ? null : Math.round(st * 10) / 10,
      smooth: dB < 12 && (st === null || st < 4),
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
  source: CorpusEntry['source']
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
  const raw = await decodeBlob(blob);
  const entry: CorpusEntry = {
    id: entryId(spk, w),
    word: w,
    code,
    speaker: spk,
    blob,
    source,
    addedAt: Date.now(),
    duration: raw.length / SR,
    features: extractFeatures(raw),
  };
  await putEntry(entry);
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
  word: string;
  speaker: string;
  file: string;
  duration?: number;
}

export let cachedManifestWords: ManifestItem[] = [];
export const manifestLookup = new Map<string, ManifestItem>();

/** Nạp danh mục bộ dữ liệu từ public/corpus/manifest.json siêu nhanh (không tải trước hàng nghìn file). */
export async function loadManifest(existing: Set<string>): Promise<CorpusEntry[]> {
  try {
    const res = await fetch('/corpus/manifest.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    cachedManifestWords = data.words || [];
    manifestLookup.clear();
    for (const m of cachedManifestWords) {
      const spk = (m.speaker || 'nam').toLowerCase();
      const normW = normalizeText(m.word);
      manifestLookup.set(`${spk}::${normW}`, m);
      const code = encodeVnWord(normW);
      if (code && code !== normW) {
        manifestLookup.set(`${spk}::${code}`, m);
      }
    }
  } catch (err) {
    console.warn('Không thể nạp manifest:', err);
  }
  return [];
}

/** Tải và nạp âm thanh của một từ từ manifest vào IndexedDB theo nhu cầu */
export async function fetchManifestWord(m: ManifestItem): Promise<CorpusEntry | null> {
  try {
    // Không dùng encodeURIComponent trên tên file vì dấu '+' trong tên file (như xa+y0.wav, d-o+i3.wav)
    // sẽ bị biến thành '%2B' khiến web server trả về index.html thay vì file âm thanh thật
    const cleanPath = m.file.replace(/^\/+/, '');
    const fileUrl = `/corpus/${cleanPath}`;
    const res = await fetch(fileUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      console.warn(`File âm thanh ${m.file} không tồn tại trên server:`, fileUrl);
      return null;
    }
    const blob = await res.blob();
    if (blob.size < 100) return null;
    const entry = await addToCorpus(blob, m.word, m.speaker, 'manifest');
    return entry;
  } catch (err) {
    console.error('Lỗi khi tải file từ ngữ liệu manifest:', m.word, err);
    return null;
  }
}

