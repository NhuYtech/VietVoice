import type { Features } from './types';

export const SR = 22050; // tần số lấy mẫu chuẩn của toàn hệ thống
const HOP = 220; // 10 ms
const WIN = 550; // 25 ms
const NFFT = 512;
const NMEL = 26;
const NMFCC = 13;

/* ---------------- Giải mã / phát / mã hóa WAV ---------------- */

export async function decodeBlob(blob: Blob): Promise<Float32Array> {
  const ab = await blob.arrayBuffer();
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(ab.slice(0));
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * SR)), SR);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    ctx.close();
  }
}

let playCtx: AudioContext | null = null;
let playSrc: AudioBufferSourceNode | null = null;

export function stopPlayback() {
  try {
    playSrc?.stop();
    playSrc?.disconnect();
  } catch {
    /* đã dừng */
  }
  playSrc = null;
}

/** Phát nhanh một đoạn mẫu (dùng cho nghe thử từng từ). */
export function playSamples(x: Float32Array, sr = SR, onEnded?: () => void) {
  stopPlayback();
  if (!x || x.length === 0) {
    onEnded?.();
    return;
  }
  if (!playCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    playCtx = new Ctx();
  }
  playCtx.resume().catch(() => {});
  const buf = playCtx.createBuffer(1, Math.max(1, x.length), sr);
  buf.getChannelData(0).set(x);
  const src = playCtx.createBufferSource();
  src.buffer = buf;
  src.connect(playCtx.destination);
  src.onended = () => {
    if (playSrc === src) playSrc = null;
    onEnded?.();
  };
  src.start();
  playSrc = src;
}

export function encodeWav(x: Float32Array, sr = SR): Blob {
  const buffer = new ArrayBuffer(44 + x.length * 2);
  const v = new DataView(buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + x.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) {
    const s = Math.max(-1, Math.min(1, x[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/* ---------------- Năng lượng, cắt lặng, chuẩn hóa ---------------- */

export function frameRms(x: Float32Array, hop = HOP, win = WIN): Float32Array {
  const n = Math.max(1, Math.ceil(x.length / hop));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = i * hop;
    const e = Math.min(x.length, s + win);
    let sum = 0;
    for (let j = s; j < e; j++) sum += x[j] * x[j];
    out[i] = e > s ? Math.sqrt(sum / (e - s)) : 0;
  }
  return out;
}

function speechThreshold(e: Float32Array): number {
  const sorted = Float32Array.from(e).sort();
  const noise = sorted[Math.floor(sorted.length * 0.1)] || 0;
  const max = sorted[sorted.length - 1] || 0;
  return Math.max(noise * 2.5, max * 0.04);
}

/** Cắt khoảng lặng đầu/cuối dựa trên năng lượng ngắn hạn. */
export function trimSilence(x: Float32Array, padMs = 20): Float32Array {
  const e = frameRms(x);
  const thr = speechThreshold(e);
  let a = -1;
  let b = -1;
  for (let i = 0; i < e.length; i++) {
    if (e[i] > thr) {
      if (a < 0) a = i;
      b = i;
    }
  }
  if (a < 0) return x;
  const pad = Math.round((padMs / 1000) * SR);
  return x.slice(Math.max(0, a * HOP - pad), Math.min(x.length, b * HOP + WIN + pad));
}

/** Chuẩn hóa RMS phần có tiếng về một mức chung, có giới hạn đỉnh. */
export function normalizeRms(x: Float32Array, target = 0.1): Float32Array {
  const e = frameRms(x);
  const thr = speechThreshold(e);
  let sum = 0;
  let cnt = 0;
  for (const v of e) {
    if (v > thr) {
      sum += v * v;
      cnt++;
    }
  }
  const rms = cnt ? Math.sqrt(sum / cnt) : 0;
  if (rms < 1e-6) return x;
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const gain = Math.min(target / rms, 0.95 / (peak || 1));
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * gain;
  return out;
}

export function fadeEdges(x: Float32Array, ms = 5): Float32Array {
  const out = x.slice();
  const n = Math.min(Math.round((ms / 1000) * SR), Math.floor(out.length / 2));
  for (let i = 0; i < n; i++) {
    const g = i / n;
    out[i] *= g;
    out[out.length - 1 - i] *= g;
  }
  return out;
}

/* ---------------- Studio Audio Processor (Tương tự VocalSlice Studio) ---------------- */

/** Loại bỏ tiếng quạt, xì xào, gió và tiếng thốc micro dưới cutoff (mặc định 75Hz) */
export function applyHighpassFilter(audio: Float32Array, sampleRate = SR, cutoff = 75): Float32Array {
  const w0 = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(w0) / Math.SQRT2;
  const cosw0 = Math.cos(w0);

  const b0 = (1 + cosw0) / 2;
  const b1 = -(1 + cosw0);
  const b2 = (1 + cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;

  const out = new Float32Array(audio.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < audio.length; i++) {
    const x0 = audio[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

/** Vuốt êm cosine fade-in và fade-out chống tiếng lụp bụp / click ở mép cắt */
export function applyCosineFades(audio: Float32Array, sampleRate = SR, fadeMs = 12): Float32Array {
  const fadeSamples = Math.floor(sampleRate * (fadeMs / 1000));
  if (audio.length <= fadeSamples * 2) return audio;
  const out = audio.slice();
  for (let i = 0; i < fadeSamples; i++) {
    const fadeIn = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
    const fadeOut = 0.5 * (1 + Math.cos((Math.PI * i) / fadeSamples));
    out[i] *= fadeIn;
    out[out.length - 1 - i] *= fadeOut;
  }
  return out;
}

/** Chuẩn hóa biên độ đỉnh về targetPeakDb (-1.0 dBFS) để đồng đều âm lượng phòng thu */
export function normalizePeak(audio: Float32Array, targetPeakDb = -1.0): Float32Array {
  let maxVal = 0;
  for (let i = 0; i < audio.length; i++) {
    const abs = Math.abs(audio[i]);
    if (abs > maxVal) maxVal = abs;
  }
  if (maxVal <= 1e-6) return audio;
  const targetAmp = Math.pow(10, targetPeakDb / 20);
  const scale = targetAmp / maxVal;
  const out = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) {
    out[i] = Math.max(-1, Math.min(1, audio[i] * scale));
  }
  return out;
}

/** 
 * Tự động cắt khoảng lặng có đệm an toàn 100ms (padding) + lọc Highpass 75Hz + Cosine Fade + Peak Normalize
 * Thuật toán tương tự trim_single_word_audio trong VocalSlice Studio
 */
export function processStudioWordAudio(
  rawAudio: Float32Array,
  sampleRate = SR,
  opts?: { silenceThreshDb?: number; paddingMs?: number; filterLow?: boolean }
): { audio: Float32Array; duration: number; rmsDb: number; peakDb: number } {
  const silenceThreshDb = opts?.silenceThreshDb ?? -42.0;
  const paddingMs = opts?.paddingMs ?? 100.0;
  const filterLow = opts?.filterLow ?? true;

  let audio = filterLow ? applyHighpassFilter(rawAudio, sampleRate, 75) : rawAudio;

  const frameLen = Math.floor(sampleRate * 0.02); // 20ms
  const hopLen = Math.floor(sampleRate * 0.01);   // 10ms
  const totalSamples = audio.length;

  if (totalSamples < frameLen) {
    return { audio, duration: totalSamples / sampleRate, rmsDb: -30, peakDb: -6 };
  }

  const numFrames = 1 + Math.floor((totalSamples - frameLen) / hopLen);
  const energiesDb: number[] = [];
  let firstSpeech = -1;
  let lastSpeech = -1;

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopLen;
    const end = start + frameLen;
    let sum = 0;
    for (let j = start; j < end; j++) sum += audio[j] * audio[j];
    const rms = Math.sqrt(sum / frameLen + 1e-12);
    const db = 20 * Math.log10(rms);
    energiesDb.push(db);
    if (db >= silenceThreshDb) {
      if (firstSpeech === -1) firstSpeech = i;
      lastSpeech = i;
    }
  }

  let trimmed: Float32Array;
  if (firstSpeech === -1) {
    trimmed = audio;
  } else {
    const padSamples = Math.floor(sampleRate * (paddingMs / 1000));
    const startSamp = Math.max(0, firstSpeech * hopLen - padSamples);
    const endSamp = Math.min(totalSamples, (lastSpeech + 1) * hopLen + padSamples);
    trimmed = audio.slice(startSamp, endSamp);
  }

  if (trimmed.length < Math.floor(sampleRate * 0.08)) {
    trimmed = audio;
  }

  trimmed = applyCosineFades(trimmed, sampleRate, 12);
  trimmed = normalizePeak(trimmed, -1.0);

  let sqSum = 0;
  let peak = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const v = trimmed[i];
    sqSum += v * v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  const rmsVal = Math.sqrt(sqSum / trimmed.length + 1e-12);
  const rmsDb = Math.round(20 * Math.log10(rmsVal) * 10) / 10;
  const peakDb = Math.round(20 * Math.log10(peak + 1e-6) * 10) / 10;
  const duration = Math.round((trimmed.length / sampleRate) * 100) / 100;

  return { audio: trimmed, duration, rmsDb, peakDb };
}

/* ---------------- FFT / STFT / Mel / MFCC ---------------- */

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

const hann = (() => {
  const w = new Float64Array(NFFT);
  for (let i = 0; i < NFFT; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (NFFT - 1));
  return w;
})();

/** Phổ công suất ngắn hạn: mỗi khung NFFT/2+1 bin. */
export function stft(x: Float32Array, hop = HOP): Float32Array[] {
  const frames: Float32Array[] = [];
  const re = new Float64Array(NFFT);
  const im = new Float64Array(NFFT);
  const count = Math.max(1, Math.ceil((x.length - NFFT) / hop) + 1);
  for (let f = 0; f < count; f++) {
    const s = f * hop;
    for (let i = 0; i < NFFT; i++) {
      re[i] = (x[s + i] || 0) * hann[i];
      im[i] = 0;
    }
    fft(re, im);
    const p = new Float32Array(NFFT / 2 + 1);
    for (let k = 0; k < p.length; k++) p[k] = re[k] * re[k] + im[k] * im[k];
    frames.push(p);
  }
  return frames;
}

const hzToMel = (f: number) => 2595 * Math.log10(1 + f / 700);
const melToHz = (m: number) => 700 * (Math.pow(10, m / 2595) - 1);

const melBank = (() => {
  const bins = NFFT / 2 + 1;
  const maxMel = hzToMel(SR / 2);
  const pts = Array.from({ length: NMEL + 2 }, (_, i) =>
    Math.floor(((NFFT + 1) * melToHz((i * maxMel) / (NMEL + 1))) / SR)
  );
  return Array.from({ length: NMEL }, (_, m) => {
    const f = new Float32Array(bins);
    for (let k = pts[m]; k < pts[m + 1]; k++) f[k] = (k - pts[m]) / Math.max(1, pts[m + 1] - pts[m]);
    for (let k = pts[m + 1]; k < pts[m + 2]; k++) f[k] = (pts[m + 2] - k) / Math.max(1, pts[m + 2] - pts[m + 1]);
    return f;
  });
})();

export function melSpectrogram(x: Float32Array): Float32Array[] {
  return stft(x, HOP).map((p) => {
    const out = new Float32Array(NMEL);
    for (let m = 0; m < NMEL; m++) {
      let s = 0;
      const f = melBank[m];
      for (let k = 0; k < f.length; k++) s += f[k] * p[k];
      out[m] = 10 * Math.log10(s + 1e-10);
    }
    return out;
  });
}

function mfccFromMel(mel: Float32Array): number[] {
  const out: number[] = [];
  for (let c = 0; c < NMFCC; c++) {
    let s = 0;
    for (let m = 0; m < NMEL; m++) s += mel[m] * Math.cos((Math.PI * c * (m + 0.5)) / NMEL);
    out.push(s);
  }
  return out;
}

/* ---------------- Cao độ F0 (tự tương quan chuẩn hóa) ---------------- */

const F0_WIN = 882; // 40 ms
const LAG_MIN = Math.floor(SR / 400);
const LAG_MAX = Math.floor(SR / 70);

export function estimateF0(x: Float32Array, s: number): number {
  const n = Math.min(F0_WIN, x.length - s);
  if (n <= LAG_MAX) return 0;
  let e0 = 0;
  for (let i = 0; i < n; i++) e0 += x[s + i] * x[s + i];
  if (Math.sqrt(e0 / n) < 0.004) return 0;
  const nac = new Float32Array(LAG_MAX + 1);
  let best = 0;
  for (let lag = LAG_MIN; lag <= LAG_MAX; lag++) {
    let c = 0;
    let el = 0;
    let e1 = 0;
    const m = n - lag;
    for (let i = 0; i < m; i++) {
      c += x[s + i] * x[s + i + lag];
      el += x[s + i + lag] * x[s + i + lag];
      e1 += x[s + i] * x[s + i];
    }
    nac[lag] = c / Math.sqrt(e1 * el + 1e-12);
    if (nac[lag] > best) best = nac[lag];
  }
  if (best < 0.45) return 0;
  for (let lag = LAG_MIN + 1; lag < LAG_MAX; lag++) {
    if (nac[lag] >= 0.9 * best && nac[lag] >= nac[lag - 1] && nac[lag] >= nac[lag + 1]) return SR / lag;
  }
  return 0;
}

function medianSmooth(v: number[], k = 5): number[] {
  const h = Math.floor(k / 2);
  return v.map((cur, i) => {
    if (cur === 0) return 0;
    const w: number[] = [];
    for (let j = i - h; j <= i + h; j++) if (v[j] > 0) w.push(v[j]);
    w.sort((a, b) => a - b);
    return w[Math.floor(w.length / 2)];
  });
}

export function pitchTrack(x: Float32Array): number[] {
  const n = Math.max(1, Math.ceil(x.length / HOP));
  const raw: number[] = [];
  for (let i = 0; i < n; i++) raw.push(estimateF0(x, i * HOP));
  return medianSmooth(raw);
}

/* ---------------- Trích rút đặc trưng tổng hợp ---------------- */

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export function extractFeatures(x: Float32Array): Features {
  const energyDb = Array.from(frameRms(x), (v) => round(20 * Math.log10(v + 1e-5), 1));
  const f0 = pitchTrack(x).map((v) => round(v, 1));
  const voiced = f0.filter((v) => v > 0);

  let peak = 0;
  let sq = 0;
  let zc = 0;
  for (let i = 0; i < x.length; i++) {
    peak = Math.max(peak, Math.abs(x[i]));
    sq += x[i] * x[i];
    if (i > 0 && x[i] * x[i - 1] < 0) zc++;
  }

  const spec = stft(x, HOP);
  const meanPower = new Float64Array(NFFT / 2 + 1);
  spec.forEach((p) => p.forEach((v, k) => (meanPower[k] += v / spec.length)));
  let num = 0;
  let den = 0;
  meanPower.forEach((p, k) => {
    num += ((k * SR) / NFFT) * p;
    den += p;
  });

  const mel = melSpectrogram(x);
  const ltas = new Array<number>(NMEL).fill(0);
  const mfcc = new Array<number>(NMFCC).fill(0);
  mel.forEach((m) => {
    m.forEach((v, i) => (ltas[i] += v / mel.length));
    mfccFromMel(m).forEach((v, i) => (mfcc[i] += v / mel.length));
  });

  return {
    duration: round(x.length / SR, 3),
    sampleRate: SR,
    peak: round(peak, 3),
    rms: round(Math.sqrt(sq / Math.max(1, x.length)), 4),
    energyDb,
    f0,
    f0Mean: voiced.length ? round(voiced.reduce((a, b) => a + b, 0) / voiced.length, 1) : 0,
    f0Min: voiced.length ? Math.min(...voiced) : 0,
    f0Max: voiced.length ? Math.max(...voiced) : 0,
    voicedRatio: round(voiced.length / Math.max(1, f0.length), 2),
    centroid: den > 0 ? Math.round(num / den) : 0,
    zcr: round(zc / Math.max(1, x.length), 4),
    ltas: ltas.map((v) => round(v, 1)),
    mfccMean: mfcc.map((v) => round(v, 2)),
  };
}

/* ---------------- Độ đo so sánh (đánh giá khách quan) ---------------- */

/** Khoảng cách log-spectral (dB) có căn chỉnh thời gian bằng DTW. */
export function dtwLogSpectralDistance(a: Float32Array, b: Float32Array): number {
  const A = melSpectrogram(a);
  const B = melSpectrogram(b);
  const n = A.length;
  const m = B.length;
  const cost = (i: number, j: number) => {
    let s = 0;
    for (let k = 0; k < NMEL; k++) {
      const d = A[i][k] - B[j][k];
      s += d * d;
    }
    return Math.sqrt(s / NMEL);
  };
  const INF = 1e12;
  const D = Array.from({ length: n }, () => new Float64Array(m).fill(INF));
  const L = Array.from({ length: n }, () => new Int32Array(m));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const c = cost(i, j);
      if (i === 0 && j === 0) {
        D[i][j] = c;
        L[i][j] = 1;
        continue;
      }
      let best = INF;
      let len = 0;
      if (i > 0 && D[i - 1][j] < best) {
        best = D[i - 1][j];
        len = L[i - 1][j];
      }
      if (j > 0 && D[i][j - 1] < best) {
        best = D[i][j - 1];
        len = L[i][j - 1];
      }
      if (i > 0 && j > 0 && D[i - 1][j - 1] <= best) {
        best = D[i - 1][j - 1];
        len = L[i - 1][j - 1];
      }
      D[i][j] = best + c;
      L[i][j] = len + 1;
    }
  }
  return D[n - 1][m - 1] / L[n - 1][m - 1];
}

function resampleCurve(v: number[], n: number): number[] {
  if (v.length === 0) return new Array(n).fill(0);
  return Array.from({ length: n }, (_, i) => v[Math.min(v.length - 1, Math.round((i * (v.length - 1)) / (n - 1)))]);
}

/** RMSE F0 (Hz) và tương quan trên các khung cùng hữu thanh sau khi chuẩn hóa thời gian. */
export function f0Similarity(a: number[], b: number[]): { rmse: number; corr: number } | null {
  const N = 100;
  const ra = resampleCurve(a, N);
  const rb = resampleCurve(b, N);
  const pa: number[] = [];
  const pb: number[] = [];
  for (let i = 0; i < N; i++) {
    if (ra[i] > 0 && rb[i] > 0) {
      pa.push(ra[i]);
      pb.push(rb[i]);
    }
  }
  if (pa.length < 5) return null;
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = mean(pa);
  const mb = mean(pb);
  let se = 0;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < pa.length; i++) {
    se += (pa[i] - pb[i]) ** 2;
    sab += (pa[i] - ma) * (pb[i] - mb);
    saa += (pa[i] - ma) ** 2;
    sbb += (pb[i] - mb) ** 2;
  }
  return { rmse: Math.sqrt(se / pa.length), corr: saa * sbb > 0 ? sab / Math.sqrt(saa * sbb) : 1 };
}

