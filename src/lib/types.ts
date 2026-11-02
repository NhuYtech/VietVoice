export interface Features {
  duration: number; // giây
  sampleRate: number;
  peak: number;
  rms: number;
  energyDb: number[]; // năng lượng ngắn hạn (dB), 10 ms / khung
  f0: number[]; // Hz, 0 = vô thanh, 10 ms / khung
  f0Mean: number;
  f0Min: number;
  f0Max: number;
  voicedRatio: number;
  centroid: number; // Hz, trọng tâm phổ
  zcr: number; // tốc độ đổi dấu
  ltas: number[]; // phổ trung bình dài hạn 26 băng mel (dB)
  mfccMean: number[]; // 13 hệ số MFCC trung bình
}

export interface CorpusEntry {
  id: string; // `${speaker}::${word}`
  word: string; // đã chuẩn hóa (NFC, chữ thường, vd: "bác")
  code: string; // mã theo quy ước VNI (vd: "bac1", "ba0", "cang3")
  speaker: string;
  blob: Blob; // âm thanh gốc đã thu
  source: 'manifest' | 'upload' | 'record';
  addedAt: number;
  duration: number;
  features: Features;
}

export interface TraceItem {
  token: string;
  status: 'ok' | 'fallback' | 'oov';
  entryId?: string;
  speaker?: string;
  duration?: number;
  start?: number;
}

export interface JoinInfo {
  left: string;
  right: string;
  energyJumpDb: number;
  f0JumpSemitone: number | null;
  smooth: boolean;
}

export interface SynthResult {
  text: string;
  speaker: string;
  samples: Float32Array;
  sampleRate: number;
  wav: Blob;
  trace: TraceItem[];
  joins: JoinInfo[];
  durationSec: number;
  elapsedMs: number;
}

