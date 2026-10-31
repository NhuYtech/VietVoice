import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import type { CorpusEntry } from '../lib/types';
import { getProcessed, getRaw } from '../lib/tts';
import { playSamples, SR } from '../lib/dsp';
import { BarChart, LineChart, Spectrogram, Waveform } from './Plots';
import { Sub } from './PipelinePanel';

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="rounded-xl bg-black/25 p-2.5">
    <div className="font-mono text-sm font-semibold text-cyan-300">{v}</div>
    <div className="text-[11px] text-slate-400">{k}</div>
  </div>
);

export default function FeaturesPanel({ entries }: { entries: CorpusEntry[] }) {
  const [id, setId] = useState('');
  const [raw, setRaw] = useState<Float32Array | null>(null);
  const [proc, setProc] = useState<Float32Array | null>(null);
  const e = entries.find((x) => x.id === id) ?? entries[0];

  useEffect(() => {
    if (!e) return;
    getRaw(e).then(setRaw);
    getProcessed(e, true, true).then(setProc);
  }, [e?.id]);

  const explain = (
    <Sub title="Đặc trưng ↔ trích rút ↔ tái tổng hợp">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400"><tr><th className="p-2">Đặc trưng</th><th className="p-2">Cách trích rút</th><th className="p-2">Vai trò khi tái tổng hợp</th></tr></thead>
          <tbody className="align-top [&_td]:border-t [&_td]:border-white/5 [&_td]:p-2">
            <tr><td className="font-semibold">Dạng sóng PCM</td><td>Giải mã → mono, lấy mẫu lại 22.05 kHz</td><td>Nguyên liệu trực tiếp của ghép nối (đơn vị = từ)</td></tr>
            <tr><td className="font-semibold">Năng lượng / RMS</td><td>RMS khung 25 ms, bước 10 ms; ngưỡng = max(2.5·nền ồn, 4%·max)</td><td>Cắt lặng; chuẩn hóa độ to; đo nhảy năng lượng tại điểm nối</td></tr>
            <tr><td className="font-semibold">Phổ (STFT, mel, MFCC)</td><td>Hann 512, FFT, 26 bộ lọc mel, log, DCT → 13 MFCC</td><td>Mô tả âm sắc; đo log-spectral distance (DTW) so với bản gốc</td></tr>
            <tr><td className="font-semibold">Cao độ F0</td><td>Tự tương quan chuẩn hóa 40 ms, 70–400 Hz, lọc trung vị 5</td><td>Đo nhảy F0 (semitone) tại điểm nối; cơ sở chỉnh ngữ điệu (PSOLA) nếu mở rộng</td></tr>
            <tr><td className="font-semibold">Thời lượng</td><td>Số mẫu sau cắt lặng / fs</td><td>Tính vị trí đặt từ, khoảng lặng, tổng độ dài</td></tr>
            <tr><td className="font-semibold">ZCR, trọng tâm phổ</td><td>Đếm đổi dấu; Σf·P(f)/ΣP(f)</td><td>Phân biệt hữu thanh/vô thanh, độ “sáng” giọng</td></tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-300">
        <b>Tái tổng hợp:</b> y[n] = Σₖ wₖ[n−sₖ]·xₖ[n−sₖ]; xₖ là từ thứ k đã tiền xử lý, sₖ = vị trí bắt đầu (kết thúc(k−1) + khoảng lặng, hoặc chồng crossfade
        equal-power cos/sin để giữ công suất).
      </p>
    </Sub>
  );

  if (!e) return <div className="space-y-4"><p className="text-sm text-slate-400">Chưa có ngữ liệu để hiển thị đặc trưng – hãy nạp ở mục Ngữ liệu.</p>{explain}</div>;
  const f = e.features;

  return (
    <div className="space-y-4">
      <Sub
        title="Mục ngữ liệu"
        right={
          <select value={e.id} onChange={(ev) => setId(ev.target.value)} className="rounded-lg border border-white/10 bg-[#1e2238] p-1.5 text-xs">
            {entries.map((x) => <option key={x.id} value={x.id}>{x.word} — {x.speaker}</option>)}
          </select>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat k="Thời lượng" v={`${f.duration.toFixed(2)} s`} />
          <Stat k="F0 trung bình" v={f.f0Mean ? `${f.f0Mean} Hz` : '—'} />
          <Stat k="Dải F0" v={f.f0Max ? `${f.f0Min}–${f.f0Max}` : '—'} />
          <Stat k="Hữu thanh" v={`${Math.round(f.voicedRatio * 100)}%`} />
          <Stat k="RMS" v={f.rms.toFixed(3)} />
          <Stat k="Peak" v={f.peak.toFixed(2)} />
          <Stat k="Trọng tâm phổ" v={`${f.centroid} Hz`} />
          <Stat k="ZCR" v={f.zcr.toFixed(3)} />
        </div>
        <button onClick={() => raw && playSamples(raw)} className="mt-3 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs hover:bg-white/20">
          <Play className="h-3.5 w-3.5" /> Nghe bản gốc
        </button>
      </Sub>

      <div className="grid gap-4 md:grid-cols-2">
        <Sub title="Dạng sóng gốc">{raw && <Waveform samples={raw} />}<p className="mt-1 text-[11px] text-slate-400">x[n], fs = {SR} Hz.</p></Sub>
        <Sub title="Sau tiền xử lý (cắt lặng + RMS + fade)">{proc && <Waveform samples={proc} color="#f472b6" />}<p className="mt-1 text-[11px] text-slate-400">Đoạn thực sự dùng để ghép.</p></Sub>
        <Sub title="Spectrogram (STFT Hann 512)">{raw && <Spectrogram samples={raw} height={130} />}</Sub>
        <Sub title="Cao độ F0 theo thời gian"><LineChart data={f.f0} breakAtZero unit=" Hz" color="#fbbf24" height={130} /></Sub>
        <Sub title="Năng lượng ngắn hạn (dB)"><LineChart data={f.energyDb} unit=" dB" color="#34d399" /></Sub>
        <Sub title="Phổ trung bình 26 băng mel (dB)"><BarChart data={f.ltas} /></Sub>
        <Sub title="MFCC trung bình (13 hệ số)">
          <BarChart data={f.mfccMean} color="#a78bfa" />
          <p className="mt-1 font-mono text-[10px] text-slate-400">[{f.mfccMean.map((v) => v.toFixed(1)).join(', ')}]</p>
        </Sub>
      </div>
      {explain}
    </div>
  );
}

