import { useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import type { CorpusEntry, SynthResult } from '../lib/types';
import { dtwLogSpectralDistance, f0Similarity, normalizeRms, pitchTrack, playSamples, SR } from '../lib/dsp';
import { getProcessed, getRaw } from '../lib/tts';
import { Sub } from './PipelinePanel';

interface Row {
  e: CorpusEntry;
  durRaw: number;
  durSyn: number;
  lsd: number;
  f0: { rmse: number; corr: number } | null;
}
interface Rating { text: string; speaker: string; nat: number; intel: number; at: number }

const loadRatings = (): Rating[] => {
  try {
    return JSON.parse(localStorage.getItem('vv-ratings') || '[]');
  } catch {
    return [];
  }
};
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

const Stars = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} onClick={() => onChange(n)} className={`h-8 w-8 rounded-lg border text-sm font-semibold ${n <= value ? 'border-cyan-400 bg-blue-600/40' : 'border-white/10 bg-white/5'}`}>{n}</button>
    ))}
  </div>
);

export default function EvalPanel({ entries, last }: { entries: CorpusEntry[]; last: SynthResult | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [nat, setNat] = useState(0);
  const [intel, setIntel] = useState(0);
  const [ratings, setRatings] = useState<Rating[]>(loadRatings);

  const run = async () => {
    setBusy(true);
    const out: Row[] = [];
    for (const e of entries.slice(0, 60)) {
      const raw = await getRaw(e);
      const syn = await getProcessed(e, true, true);
      const ref = normalizeRms(raw); // cùng mức RMS để chỉ đo khác biệt do xử lý
      out.push({ e, durRaw: raw.length / SR, durSyn: syn.length / SR, lsd: dtwLogSpectralDistance(ref, syn), f0: f0Similarity(pitchTrack(ref), pitchTrack(syn)) });
      setRows([...out]);
      await new Promise((r) => setTimeout(r));
    }
    setBusy(false);
  };

  const submit = () => {
    if (!last || !nat || !intel) return;
    const next = [...ratings, { text: last.text, speaker: last.speaker, nat, intel, at: Date.now() }];
    setRatings(next);
    localStorage.setItem('vv-ratings', JSON.stringify(next));
    setNat(0);
    setIntel(0);
  };

  const smooth = last?.joins.filter((j) => j.smooth).length ?? 0;
  const f0rows = rows.filter((r) => r.f0);

  return (
    <div className="space-y-4 text-sm">
      <Sub title="1 · Đánh giá chủ quan (MOS) – kết quả tổng hợp gần nhất">
        {last ? (
          <div className="space-y-3">
            <p className="text-slate-300">
              “{last.text}” — <b>{last.speaker}</b>, {last.durationSec.toFixed(2)} s
              <button onClick={() => playSamples(last.samples, last.sampleRate)} className="ml-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-900"><Play className="h-3 w-3" /> Nghe</button>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="mb-1 text-xs text-slate-400">Độ tự nhiên (1 rất kém … 5 rất tự nhiên)</div><Stars value={nat} onChange={setNat} /></div>
              <div><div className="mb-1 text-xs text-slate-400">Độ dễ hiểu (1 … 5)</div><Stars value={intel} onChange={setIntel} /></div>
            </div>
            <button onClick={submit} disabled={!nat || !intel} className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-2 text-sm disabled:opacity-40">Lưu đánh giá</button>
          </div>
        ) : (
          <p className="text-slate-400">Hãy tổng hợp một câu trước.</p>
        )}
        {ratings.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl bg-black/25 p-3">
            <span>n = <b>{ratings.length}</b></span>
            <span>MOS tự nhiên: <b className="text-cyan-300">{mean(ratings.map((r) => r.nat)).toFixed(2)}</b></span>
            <span>MOS dễ hiểu: <b className="text-cyan-300">{mean(ratings.map((r) => r.intel)).toFixed(2)}</b></span>
            <button onClick={() => { localStorage.removeItem('vv-ratings'); setRatings([]); }} className="ml-auto text-xs text-rose-300">Xóa</button>
          </div>
        )}
      </Sub>

      <Sub title="2 · Chất lượng điểm nối – kết quả gần nhất">
        {last && last.joins.length > 0 ? (
          <>
            <p className="mb-2 text-xs text-slate-400">{smooth}/{last.joins.length} điểm nối mượt (nhảy năng lượng &lt; 12 dB và nhảy F0 &lt; 4 semitone).</p>
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400"><tr><th className="p-1.5">Nối</th><th>Nhảy năng lượng</th><th>Nhảy F0</th><th>Kết luận</th></tr></thead>
              <tbody>
                {last.joins.map((j, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="p-1.5 font-semibold">{j.left} → {j.right}</td>
                    <td className="font-mono">{j.energyJumpDb} dB</td>
                    <td className="font-mono">{j.f0JumpSemitone === null ? '— (vô thanh)' : `${j.f0JumpSemitone} st`}</td>
                    <td className={j.smooth ? 'text-emerald-400' : 'text-amber-300'}>{j.smooth ? 'Mượt' : 'Có thể nghe thấy'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-slate-400">Cần chuỗi từ ≥ 2 từ để có điểm nối.</p>
        )}
      </Sub>

      <Sub
        title="3 · Từ tổng hợp so với bản thu gốc"
        right={<button onClick={run} disabled={busy || !entries.length} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-1.5 text-xs disabled:opacity-40">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Chạy đánh giá</button>}
      >
        {rows.length === 0 ? (
          <p className="text-slate-400">Bấm “Chạy đánh giá” để tính độ đo cho tối đa 60 mục.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-4 rounded-xl bg-black/25 p-3">
              <span>LSD TB: <b className="text-cyan-300">{mean(rows.map((r) => r.lsd)).toFixed(2)} dB</b></span>
              <span>Δ thời lượng TB: <b className="text-cyan-300">{mean(rows.map((r) => ((r.durRaw - r.durSyn) / r.durRaw) * 100)).toFixed(1)}%</b></span>
              <span>RMSE F0 TB: <b className="text-cyan-300">{mean(f0rows.map((r) => r.f0!.rmse)).toFixed(1)} Hz</b></span>
              <span>Tương quan F0 TB: <b className="text-cyan-300">{mean(f0rows.map((r) => r.f0!.corr)).toFixed(3)}</b></span>
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#1a1f3c] text-slate-400"><tr><th className="p-1.5">Từ</th><th>Giọng</th><th>Gốc</th><th>Tổng hợp</th><th>LSD</th><th>RMSE F0</th><th>Tương quan</th><th>A/B</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.e.id} className="border-t border-white/5">
                      <td className="p-1.5 font-semibold">{r.e.word}</td>
                      <td>{r.e.speaker}</td>
                      <td className="font-mono">{r.durRaw.toFixed(2)} s</td>
                      <td className="font-mono">{r.durSyn.toFixed(2)} s</td>
                      <td className="font-mono">{r.lsd.toFixed(2)}</td>
                      <td className="font-mono">{r.f0 ? `${r.f0.rmse.toFixed(1)} Hz` : '—'}</td>
                      <td className="font-mono">{r.f0 ? r.f0.corr.toFixed(3) : '—'}</td>
                      <td className="space-x-2">
                        <button onClick={async () => playSamples(await getRaw(r.e))} className="text-cyan-300">Gốc</button>
                        <button onClick={async () => playSamples(await getProcessed(r.e, true, true))} className="text-pink-300">TH</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          LSD = khoảng cách log-spectral trên 26 băng mel, căn thời gian bằng DTW (thấp = giống). Vì ghép nối dùng lại nguyên bản thu, độ tự nhiên từng từ ≈ bản gốc;
          hạn chế nằm ở <b>điểm nối</b> và <b>ngữ điệu cấp câu</b> – xem mục 1 và 2.
        </p>
      </Sub>
    </div>
  );
}

