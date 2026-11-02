import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Mic,
  Play,
  Save,
  Square,
  Sparkles,
  Loader2,
  CheckCircle2,
  Download,
  Info,
  FileAudio
} from 'lucide-react';
import type { CorpusEntry } from '../lib/types';
import { addToCorpus } from '../lib/tts';
import { decodeBlob, encodeWav, playSamples, processStudioWordAudio, SR } from '../lib/dsp';
import { encodeVnWord, isVniCode, decodeVnWord } from '../lib/vniCodec';
import { Sub } from './PipelinePanel';

interface ProcessedClip {
  blob: Blob;
  duration: number;
  rmsDb: number;
  peakDb: number;
  samples: Float32Array;
}

export default function CorpusPanel({
  entries,
  refresh,
  speaker = 'Tôi'
}: {
  entries: CorpusEntry[];
  refresh: () => Promise<void>;
  speaker?: string;
}) {
  const [word, setWord] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [clip, setClip] = useState<ProcessedClip | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [vuLevel, setVuLevel] = useState(0);

  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const vuAudioCtx = useRef<AudioContext | null>(null);
  const vuTimer = useRef<number | null>(null);

  // Xử lý mã quy ước VNI theo thời gian thực
  const trimmedWord = word.trim();
  const isInputCode = useMemo(() => isVniCode(trimmedWord), [trimmedWord]);
  const resolvedWord = useMemo(() => (isInputCode ? decodeVnWord(trimmedWord) : trimmedWord), [isInputCode, trimmedWord]);
  const vniCode = useMemo(() => (resolvedWord ? encodeVnWord(resolvedWord) : ''), [resolvedWord]);
  const wavFilename = useMemo(() => (vniCode ? `${vniCode}.wav` : ''), [vniCode]);

  // Tải file .wav theo đúng tên quy ước
  const downloadWav = () => {
    if (!clip || !wavFilename) return;
    const url = URL.createObjectURL(clip.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = wavFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => {
      if (vuTimer.current) clearInterval(vuTimer.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (vuAudioCtx.current) vuAudioCtx.current.close().catch(() => {});
    };
  }, []);

  // Bắt đầu thu âm
  const startRec = async () => {
    setMsg('');
    setClip(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMsg('⚠️ Vui lòng mở trang web qua http://localhost:5174/ để trình duyệt cấp quyền Micro!');
      return;
    }

    if (!word.trim()) {
      setMsg('⚠️ Vui lòng nhập âm hoặc từ cần thu trước khi bắt đầu.');
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

      // VU meter
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

      const startT = Date.now();
      timerRef.current = window.setInterval(() => {
        setRecordSec((Date.now() - startT) / 1000);
      }, 100);

    } catch (err: any) {
      setMsg(`Không thể truy cập Microphone: ${err?.message || err}`);
    }
  };

  // Dừng thu
  const stopRec = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mr.current?.stop();
    setRecording(false);
  };

  // Xử lý sau khi thu
  const handleProcessRecordedAudio = async (rawBlob: Blob) => {
    setBusy(true);
    try {
      const rawSamples = await decodeBlob(rawBlob);
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
      const displayWord = resolvedWord || trimmedWord;
      const fileLabel = wavFilename ? ` [${wavFilename}]` : '';
      setMsg(`Đã thu xong âm "${displayWord}"${fileLabel}: ${processed.duration}s. Bạn có thể nghe lại, tải file hoặc bấm Lưu.`);
    } catch (err: any) {
      setMsg(`Lỗi xử lý âm thanh: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  // Lưu vào hệ thống
  const saveClip = async () => {
    if (!clip || !trimmedWord) return;
    setBusy(true);
    try {
      const spk = speaker || 'Tôi';
      const targetWord = resolvedWord || trimmedWord;
      const e = await addToCorpus(clip.blob, targetWord, spk, 'record');
      setMsg(`✓ Đã lưu thành công âm "${e.word}" (file: ${e.code}.wav) vào hệ thống!`);
      setClip(null);
      setWord('');
      await refresh();
    } catch (err) {
      setMsg(`Lỗi khi lưu: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto py-2">
      <Sub
        title="Thu âm"
        right={
          recording && (
            <span className="flex items-center gap-1.5 text-xs text-rose-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Đang thu: {recordSec.toFixed(1)}s
            </span>
          )
        }
      >
        <div className="space-y-4 pt-1">
          {/* Nhập âm cần thu */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-200">
                Nhập âm hoặc từ cần thu
              </label>
              {wavFilename && (
                <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/30 flex items-center gap-1">
                  <FileAudio className="w-3 h-3 text-cyan-400" />
                  {wavFilename}
                </span>
              )}
            </div>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              disabled={recording}
              placeholder="Nhập từ (vd: ba, bác, cảng, đêm...) hoặc mã (vd: bac1, cang3)"
              className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-400/50 transition font-medium"
            />
            {isInputCode && resolvedWord && resolvedWord !== trimmedWord && (
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                ✓ Nhận diện từ tiếng Việt: <span className="font-bold underline">{resolvedWord}</span>
              </p>
            )}
          </div>

          {/* Hộp quy ước mã hóa & đặt tên file */}
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Quy ước mã hóa từ có dấu & đặt tên file .wav:</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              • Dấu VNI ở cuối từ (0=ngang, 1=sắc, 2=huyền, 3=hỏi, 4=ngã, 5=nặng). VD: <span className="text-white font-mono font-semibold">ba0</span>, <span className="text-white font-mono font-semibold">bac1</span>, <span className="text-white font-mono font-semibold">cang3</span>
            </p>
            <p className="text-slate-300 leading-relaxed">
              • Mũ: <span className="text-white font-mono">â→a+</span>, <span className="text-white font-mono">ô→o+</span>, <span className="text-white font-mono">ê→e+</span> | Móc: <span className="text-white font-mono">ă→aa</span>, <span className="text-white font-mono">ơ→oo</span>, <span className="text-white font-mono">ư→uu</span> | <span className="text-white font-mono">đ→d-</span>
            </p>
          </div>

          {/* Thanh đo âm lượng Micro khi thu */}
          {recording && (
            <div className="space-y-1 py-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Âm lượng micro</span>
                <span className="font-mono">{vuLevel}%</span>
              </div>
              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/10 p-0.5">
                <div
                  className="h-full transition-all duration-75 rounded-full"
                  style={{
                    width: `${vuLevel}%`,
                    background: vuLevel > 80 ? '#f43f5e' : vuLevel > 20 ? '#10b981' : '#f59e0b'
                  }}
                />
              </div>
            </div>
          )}

          {/* Nút Bắt đầu thu / Dừng thu */}
          <div className="flex items-center gap-2.5 pt-1">
            {!recording ? (
              <button
                type="button"
                onClick={startRec}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/30 transition active:scale-95"
              >
                <Mic className="h-4 w-4" /> Bắt đầu thu
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRec}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/30 animate-pulse transition active:scale-95"
              >
                <Square className="h-4 w-4 fill-current" /> Dừng thu
              </button>
            )}

            {clip && !recording && (
              <>
                <button
                  type="button"
                  onClick={() => playSamples(clip.samples)}
                  title="Nghe lại bản vừa thu"
                  className="p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-cyan-300 transition"
                >
                  <Play className="h-4 w-4 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={downloadWav}
                  title={`Tải file ${wavFilename} về máy`}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/40 px-3.5 py-3 text-xs font-semibold text-cyan-200 transition"
                >
                  <Download className="h-4 w-4" /> {wavFilename || 'Tải .wav'}
                </button>
                <button
                  type="button"
                  onClick={saveClip}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> Lưu
                </button>
              </>
            )}
          </div>

          {/* Thông báo trạng thái */}
          {msg && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              msg.startsWith('✓')
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : msg.startsWith('⚠️')
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-white/5 border-white/10 text-cyan-200'
            }`}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0 text-cyan-400" />
              ) : msg.startsWith('✓') ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
              )}
              <span>{msg}</span>
            </div>
          )}
        </div>
      </Sub>
    </div>
  );
}
