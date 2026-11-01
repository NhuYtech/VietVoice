import { useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
  Loader2,
  Mic,
  Play,
  RotateCw,
  Save,
  Square,
  Trash2,
  Upload,
  Volume2,
  Sliders,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import type { CorpusEntry } from '../lib/types';
import { addToCorpus, getRaw, invalidate, loadManifest, wordFromFilename } from '../lib/tts';
import { clearEntries, deleteEntry } from '../lib/store';
import { decodeBlob, encodeWav, playSamples, processStudioWordAudio, SR } from '../lib/dsp';
import { Sub } from './PipelinePanel';

interface ProcessedClip {
  blob: Blob;
  duration: number;
  rmsDb: number;
  peakDb: number;
  samples: Float32Array;
}

const COMMON_SUGGESTIONS = [
  'xin', 'chào', 'bạn', 'tôi', 'là', 'tiếng', 'việt', 'nam', 'âm', 'thanh', 'giọng', 'nói', 'học', 'tập'
];

export default function CorpusPanel({
  entries,
  refresh
}: {
  entries: CorpusEntry[];
  refresh: () => Promise<void>;
}) {
  const [word, setWord] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [clip, setClip] = useState<ProcessedClip | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [vuLevel, setVuLevel] = useState(0);
  const [applyStudioDSp, setApplyStudioDsp] = useState(true);

  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const vuAudioCtx = useRef<AudioContext | null>(null);
  const vuTimer = useRef<number | null>(null);

  const speakers = [...new Set(entries.map((e) => e.speaker))].sort();
  const shown = entries
    .filter((e) => !filter || e.word.includes(filter.toLowerCase()) || e.speaker.includes(filter))
    .sort((a, b) => a.word.localeCompare(b.word, 'vi') || a.speaker.localeCompare(b.speaker));

  // Tự động dừng AudioContext VU khi unmount
  useEffect(() => {
    return () => {
      if (vuTimer.current) clearInterval(vuTimer.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (vuAudioCtx.current) vuAudioCtx.current.close().catch(() => {});
    };
  }, []);

  // Bắt đầu thu âm chuẩn Studio (tương tự VocalSlice Studio)
  const startRec = async () => {
    setMsg('');
    setClip(null);

    // Kiểm tra Secure Context (Trình duyệt chặn Micro khi vào bằng IP http://192.168.x.x)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMsg(
        '⚠️ Trình duyệt chặn Micro vì bạn đang vào bằng IP (http://192.168.x.x). Vui lòng đổi địa chỉ web thành: http://localhost:5174/ (hoặc http://127.0.0.1:5174/) để mở Micro!'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true
        }
      });

      // Thiết lập Live VU Meter
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        vuAudioCtx.current = new AudioCtx();
        const source = vuAudioCtx.current.createMediaStreamSource(stream);
        const analyser = vuAudioCtx.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const pcmData = new Uint8Array(analyser.frequencyBinCount);

        vuTimer.current = window.setInterval(() => {
          analyser.getByteFrequencyData(pcmData);
          let sum = 0;
          for (let i = 0; i < pcmData.length; i++) sum += pcmData[i];
          const avg = sum / pcmData.length;
          const pct = Math.min(100, Math.round((avg / 128) * 100 * 1.8));
          setVuLevel(pct);
        }, 50);
      }

      chunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (vuTimer.current) {
          clearInterval(vuTimer.current);
          vuTimer.current = null;
        }
        if (vuAudioCtx.current) {
          vuAudioCtx.current.close().catch(() => {});
          vuAudioCtx.current = null;
        }
        setVuLevel(0);

        const rawBlob = new Blob(chunks.current, { type: rec.mimeType });
        await handleProcessRecordedAudio(rawBlob);
      };

      rec.start();
      mr.current = rec;
      setRecording(true);
      setRecordSec(0);

      // Đếm giây thu âm
      const startT = Date.now();
      timerRef.current = window.setInterval(() => {
        setRecordSec((Date.now() - startT) / 1000);
      }, 100);

    } catch (err: any) {
      setMsg(`Không thể truy cập Microphone: ${err?.message || err}`);
    }
  };

  // Dừng thu âm
  const stopRec = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mr.current?.stop();
    setRecording(false);
  };

  // Xử lý cắt khoảng lặng, lọc gió/thực tế và chuẩn hóa biên độ
  const handleProcessRecordedAudio = async (rawBlob: Blob) => {
    setBusy(true);
    setMsg('Đang xử lý âm thanh (Lọc tạp âm, cắt khoảng lặng & chuẩn hóa)...');
    try {
      const rawSamples = await decodeBlob(rawBlob);

      if (applyStudioDSp) {
        // Áp dụng thuật toán Studio: Highpass 75Hz + VAD đệm 100ms + Cosine fade 12ms + Peak -1dBFS
        const processed = processStudioWordAudio(rawSamples, SR, {
          silenceThreshDb: -42.0,
          paddingMs: 100.0,
          filterLow: true
        });
        const wavBlob = encodeWav(processed.audio, SR);
        setClip({
          blob: wavBlob,
          duration: processed.duration,
          rmsDb: processed.rmsDb,
          peakDb: processed.peakDb,
          samples: processed.audio
        });
        setMsg(`Đã thu xong: ${processed.duration}s (RMS: ${processed.rmsDb} dBFS, Peak: ${processed.peakDb} dBFS)`);
      } else {
        const duration = Math.round((rawSamples.length / SR) * 100) / 100;
        setClip({
          blob: rawBlob,
          duration,
          rmsDb: -22,
          peakDb: -1.0,
          samples: rawSamples
        });
        setMsg(`Đã thu xong: ${duration}s (Bản thô chưa lọc)`);
      }
    } catch (err: any) {
      setMsg(`Lỗi xử lý file thu: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  // Lưu clip vào cơ sở dữ liệu IndexedDB của VietVoice
  const saveClip = async () => {
    if (!clip || !word.trim()) return;
    setBusy(true);
    try {
      const e = await addToCorpus(clip.blob, word, speaker, 'record');
      setMsg(`Đã lưu thành công từ "${e.word}" (${e.speaker}) - ${e.duration.toFixed(2)}s vào ngữ liệu!`);
      setClip(null);
      setWord('');
      await refresh();
    } catch (err) {
      setMsg(String(err));
    }
    setBusy(false);
  };

  // Nhập hàng loạt file âm thanh
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const f of Array.from(files)) {
      if (!/\.(wav|mp3|ogg|webm|m4a|flac)$/i.test(f.name)) continue;
      const rel = (f as any).webkitRelativePath as string;
      const parts = rel ? rel.split('/') : [];
      const spk = parts.length >= 3 ? parts[parts.length - 2] : parts.length === 2 ? parts[0] : speaker;
      try {
        await addToCorpus(f, wordFromFilename(f.name), spk, 'upload');
        ok++;
      } catch {
        fail++;
      }
    }
    setMsg(`Đã nạp ${ok} file âm thanh${fail ? `, lỗi ${fail} file` : ''}.`);
    await refresh();
    setBusy(false);
  };

  // Nạp từ manifest.json
  const reload = async () => {
    setBusy(true);
    const added = await loadManifest(new Set(entries.map((e) => e.id)));
    setMsg(added.length ? `Đã nạp ${added.length} mục từ manifest.json.` : 'Không có mục mới (hoặc chưa có public/corpus/manifest.json).');
    await refresh();
    setBusy(false);
  };

  const inputClass = 'w-full rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-400/50';
  const totalSec = entries.reduce((s, e) => s + e.duration, 0);

  return (
    <div className="space-y-4 text-slate-200">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Thống kê ngữ liệu */}
        <Sub title="Thống kê ngữ liệu">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Mục từ', entries.length], ['Từ vựng', new Set(entries.map((e) => e.word)).size], ['Người thu', speakers.length]].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-black/25 p-2.5">
                <div className="text-xl font-bold text-cyan-300">{v}</div>
                <div className="text-[11px] text-slate-400">{k}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
            Tổng thời lượng: <b>{totalSec.toFixed(1)} s</b>. Dữ liệu lưu an toàn trong IndexedDB của trình duyệt.
          </p>
        </Sub>

        {/* Phòng thu âm Studio (Tích hợp từ VocalSlice Studio) */}
        <Sub
          title="Thu âm từ vựng (Studio)"
          right={
            recording && (
              <span className="flex items-center gap-1.5 text-xs text-rose-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                {recordSec.toFixed(1)}s
              </span>
            )
          }
        >
          <div className="space-y-2.5">
            <div>
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="Nhập từ cần thu (vd: xin, chào...)"
                className={inputClass}
              />
              {/* Gợi ý từ nhanh */}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {COMMON_SUGGESTIONS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWord(w)}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/15 text-slate-300 border border-white/5 transition"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <input
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                list="spkList"
                placeholder="Tên người thu âm (vd: an, binh, mai...)"
                className={inputClass}
              />
              <datalist id="spkList">
                {speakers.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>

            {/* Tùy chọn xử lý Studio */}
            <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyStudioDSp}
                onChange={(e) => setApplyStudioDsp(e.target.checked)}
                className="accent-cyan-400"
              />
              <span>Lọc ồn &lt;75Hz, cắt lặng đệm 100ms, fade 12ms</span>
            </label>

            {/* Thanh đo âm lượng micro thời gian thực (VU Meter) */}
            {recording && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Mức âm lượng micro</span>
                  <span className="font-mono">{vuLevel}%</span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full transition-all duration-75 rounded-full"
                    style={{
                      width: `${vuLevel}%`,
                      background: vuLevel > 80 ? '#f43f5e' : vuLevel > 25 ? '#10b981' : '#f59e0b'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Nút điều khiển thu âm */}
            <div className="flex items-center gap-2 pt-1">
              {!recording ? (
                <button
                  type="button"
                  onClick={startRec}
                  className="flex items-center gap-2 rounded-full bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-rose-600/30 transition active:scale-95"
                >
                  <Mic className="h-3.5 w-3.5" /> Bắt đầu thu
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRec}
                  className="flex items-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-amber-500/30 animate-pulse transition active:scale-95"
                >
                  <Square className="h-3.5 w-3.5 fill-current" /> Dừng lại & Lọc âm
                </button>
              )}

              {/* Nghe thử & Lưu */}
              {clip && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => playSamples(clip.samples)}
                    title="Nghe lại bản thu"
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-cyan-300 transition"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={saveClip}
                    disabled={busy || !word.trim()}
                    className="flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/30 transition disabled:opacity-40"
                  >
                    <Save className="h-3.5 w-3.5" /> Lưu từ
                  </button>
                </div>
              )}
            </div>

            {clip && (
              <div className="text-[11px] text-slate-300 bg-white/5 p-2 rounded-lg border border-white/10 flex items-center justify-between font-mono">
                <span>⏱️ {clip.duration}s</span>
                <span>🔊 RMS: {clip.rmsDb}dB</span>
                <span>📶 Peak: {clip.peakDb}dB</span>
              </div>
            )}
          </div>
        </Sub>

        {/* Nhập dữ liệu có sẵn */}
        <Sub title="Nhập dữ liệu có sẵn">
          <div className="space-y-2 text-xs">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/20 p-2.5 hover:bg-white/10 transition">
              <Upload className="h-4 w-4 text-cyan-300" />
              <span>Chọn file âm thanh (tên file = từ)</span>
              <input type="file" multiple accept="audio/*" hidden onChange={(e) => importFiles(e.target.files)} />
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/20 p-2.5 hover:bg-white/10 transition">
              <FolderOpen className="h-4 w-4 text-cyan-300" />
              <span>Chọn thư mục (<code>người-thu/từ.wav</code>)</span>
              <input type="file" {...({ webkitdirectory: '' } as object)} hidden onChange={(e) => importFiles(e.target.files)} />
            </label>
            <button
              type="button"
              onClick={reload}
              className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left hover:bg-white/10 transition"
            >
              <RotateCw className="h-4 w-4 text-cyan-300" />
              <span>Nạp từ <code>public/corpus/manifest.json</code></span>
            </button>
          </div>
        </Sub>
      </div>

      {/* Thông báo trạng thái */}
      {(msg || busy) && (
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-cyan-200 flex items-center gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-cyan-400 shrink-0" /> : <Sparkles className="h-4 w-4 text-cyan-400 shrink-0" />}
          <span>{msg}</span>
        </div>
      )}

      {/* Bảng quản lý Danh mục từ vựng & Giọng đọc */}
      <Sub
        title="Danh mục từ – giọng đã lưu"
        right={
          <div className="flex items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Tìm từ hoặc người thu…"
              className="w-40 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-cyan-400"
            />
            {entries.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Xóa toàn bộ ngữ liệu trong trình duyệt?')) {
                    await clearEntries();
                    entries.forEach((e) => invalidate(e.id));
                    await refresh();
                  }
                }}
                className="text-xs text-rose-300 hover:text-rose-200 transition"
              >
                Xóa tất cả
              </button>
            )}
          </div>
        }
      >
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400 py-3 text-center">
            Ngữ liệu đang trống. Bạn có thể thu âm trực tiếp ở khung trên, hoặc chọn file/thư mục thu âm có sẵn để nạp vào hệ thống.
          </p>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#161a33] text-slate-400">
                <tr>
                  {['Từ vựng', 'Người thu', 'Thời lượng', 'F0 Trung bình', 'Trọng tâm phổ', 'Nguồn', 'Thao tác'].map((h) => (
                    <th key={h} className="px-2.5 py-1.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.id} className="border-t border-white/5 hover:bg-white/5 transition">
                    <td className="px-2.5 py-1.5 font-semibold text-white">{e.word}</td>
                    <td className="px-2.5">{e.speaker}</td>
                    <td className="px-2.5 font-mono">{e.duration.toFixed(2)} s</td>
                    <td className="px-2.5 font-mono">{e.features.f0Mean ? `${e.features.f0Mean} Hz` : '—'}</td>
                    <td className="px-2.5 font-mono">{e.features.centroid} Hz</td>
                    <td className="px-2.5 text-slate-400">{e.source}</td>
                    <td className="space-x-2 px-2.5 text-right">
                      <button
                        type="button"
                        onClick={async () => playSamples(await getRaw(e))}
                        title="Nghe thử bản thu"
                        className="text-cyan-300 hover:text-cyan-200 transition"
                      >
                        <Play className="inline h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteEntry(e.id);
                          invalidate(e.id);
                          await refresh();
                        }}
                        title="Xóa từ này"
                        className="text-rose-400 hover:text-rose-300 transition"
                      >
                        <Trash2 className="inline h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Sub>
    </div>
  );
}
