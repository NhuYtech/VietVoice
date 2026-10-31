import { useRef, useState } from 'react';
import { FolderOpen, Loader2, Mic, Play, RotateCw, Save, Square, Trash2, Upload } from 'lucide-react';
import type { CorpusEntry } from '../lib/types';
import { addToCorpus, getRaw, invalidate, loadManifest, wordFromFilename } from '../lib/tts';
import { clearEntries, deleteEntry } from '../lib/store';
import { decodeBlob, playSamples } from '../lib/dsp';
import { Sub } from './PipelinePanel';

export default function CorpusPanel({ entries, refresh }: { entries: CorpusEntry[]; refresh: () => Promise<void> }) {
  const [word, setWord] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<Blob | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const speakers = [...new Set(entries.map((e) => e.speaker))].sort();
  const shown = entries
    .filter((e) => !filter || e.word.includes(filter.toLowerCase()) || e.speaker.includes(filter))
    .sort((a, b) => a.word.localeCompare(b.word, 'vi') || a.speaker.localeCompare(b.speaker));

  const startRec = async () => {
    setMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setClip(new Blob(chunks.current, { type: rec.mimeType }));
      };
      rec.start();
      mr.current = rec;
      setRecording(true);
      setClip(null);
    } catch {
      setMsg('Không truy cập được micro. Hãy cấp quyền hoặc dùng nhập file.');
    }
  };

  const saveClip = async () => {
    if (!clip) return;
    setBusy(true);
    try {
      const e = await addToCorpus(clip, word, speaker, 'record');
      setMsg(`Đã lưu “${e.word}” (${e.speaker}) – ${e.duration.toFixed(2)} s.`);
      setClip(null);
      setWord('');
      await refresh();
    } catch (err) {
      setMsg(String(err));
    }
    setBusy(false);
  };

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
    setMsg(`Nhập ${ok} file${fail ? `, lỗi ${fail}` : ''}.`);
    await refresh();
    setBusy(false);
  };

  const reload = async () => {
    setBusy(true);
    const added = await loadManifest(new Set(entries.map((e) => e.id)));
    setMsg(added.length ? `Đã nạp ${added.length} mục từ manifest.json.` : 'Không có mục mới (hoặc chưa có public/corpus/manifest.json).');
    await refresh();
    setBusy(false);
  };

  const input = 'w-full rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-400/50';
  const totalSec = entries.reduce((s, e) => s + e.duration, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Sub title="Thống kê">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Mục', entries.length], ['Từ', new Set(entries.map((e) => e.word)).size], ['Giọng', speakers.length]].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-black/25 p-2.5">
                <div className="text-xl font-bold text-cyan-300">{v}</div>
                <div className="text-[11px] text-slate-400">{k}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">{totalSec.toFixed(1)} s, lưu trong IndexedDB.</p>
        </Sub>

        <Sub title="Thu âm một từ">
          <div className="space-y-2">
            <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Từ (vd: xin chào)" className={input} />
            <input value={speaker} onChange={(e) => setSpeaker(e.target.value)} list="spk" placeholder="Người thu (vd: an)" className={input} />
            <datalist id="spk">{speakers.map((s) => <option key={s} value={s} />)}</datalist>
            <div className="flex gap-2">
              {!recording ? (
                <button onClick={startRec} className="flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm hover:bg-rose-500"><Mic className="h-4 w-4" /> Thu</button>
              ) : (
                <button onClick={() => { mr.current?.stop(); setRecording(false); }} className="flex animate-pulse items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm"><Square className="h-4 w-4" /> Dừng</button>
              )}
              {clip && (
                <>
                  <button onClick={async () => playSamples(await decodeBlob(clip))} className="rounded-full border border-white/15 bg-white/10 px-3 py-2"><Play className="h-4 w-4" /></button>
                  <button onClick={saveClip} disabled={busy || !word.trim()} className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm disabled:opacity-50"><Save className="h-4 w-4" /> Lưu</button>
                </>
              )}
            </div>
          </div>
        </Sub>

        <Sub title="Nhập dữ liệu có sẵn">
          <div className="space-y-2 text-xs">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/20 p-2.5 hover:bg-white/10">
              <Upload className="h-4 w-4 text-cyan-300" /> File âm thanh (tên file = từ)
              <input type="file" multiple accept="audio/*" hidden onChange={(e) => importFiles(e.target.files)} />
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/20 p-2.5 hover:bg-white/10">
              <FolderOpen className="h-4 w-4 text-cyan-300" /> Thư mục <code>người-thu/từ.wav</code>
              <input type="file" {...({ webkitdirectory: '' } as object)} hidden onChange={(e) => importFiles(e.target.files)} />
            </label>
            <button onClick={reload} className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left hover:bg-white/10">
              <RotateCw className="h-4 w-4 text-cyan-300" /> Nạp <code>public/corpus/manifest.json</code>
            </button>
          </div>
        </Sub>
      </div>

      {(msg || busy) && (
        <p className="flex items-center gap-2 text-sm text-cyan-200">{busy && <Loader2 className="h-4 w-4 animate-spin" />} {msg}</p>
      )}

      <Sub
        title="Danh mục từ – giọng"
        right={
          <div className="flex items-center gap-2">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Lọc…" className="w-28 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs" />
            {entries.length > 0 && (
              <button
                onClick={async () => {
                  if (confirm('Xóa toàn bộ ngữ liệu trong trình duyệt?')) {
                    await clearEntries();
                    entries.forEach((e) => invalidate(e.id));
                    await refresh();
                  }
                }}
                className="text-xs text-rose-300 hover:text-rose-200"
              >
                Xóa tất cả
              </button>
            )}
          </div>
        }
      >
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400">Ngữ liệu trống. Đặt file vào <code>public/corpus/&lt;người-thu&gt;/&lt;từ&gt;.wav</code>, chạy <code>npm run corpus</code> rồi bấm “Nạp”, hoặc thu/tải file lên.</p>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#1a1f3c] text-slate-400">
                <tr>{['Từ', 'Giọng', 'Thời lượng', 'F0 TB', 'Trọng tâm phổ', 'Nguồn', ''].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-2 py-1.5 font-semibold">{e.word}</td>
                    <td className="px-2">{e.speaker}</td>
                    <td className="px-2 font-mono">{e.duration.toFixed(2)} s</td>
                    <td className="px-2 font-mono">{e.features.f0Mean ? `${e.features.f0Mean} Hz` : '—'}</td>
                    <td className="px-2 font-mono">{e.features.centroid} Hz</td>
                    <td className="px-2 text-slate-400">{e.source}</td>
                    <td className="space-x-2 px-2 text-right">
                      <button onClick={async () => playSamples(await getRaw(e))} title="Nghe"><Play className="inline h-3.5 w-3.5 text-cyan-300" /></button>
                      <button onClick={async () => { await deleteEntry(e.id); invalidate(e.id); await refresh(); }} title="Xóa"><Trash2 className="inline h-3.5 w-3.5 text-rose-300" /></button>
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

