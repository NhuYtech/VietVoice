import React, { useState } from 'react';
import { Database, Search, Mic, Play, Square, Download, Trash2, Plus, RotateCw, CheckCircle2, FileAudio, Info } from 'lucide-react';
import type { CorpusEntry } from '../lib/types';
import { MOCK_CORPUS_ITEMS, type CorpusItem } from '../data/mockCorpus';
import { encodeVnFilename } from '../lib/vniCodec';
import { playSamples, decodeBlob } from '../lib/dsp';
import { deleteEntry } from '../lib/store';

interface CorpusViewProps {
  realEntries: CorpusEntry[];
  onOpenRecordModal: () => void;
  onRefresh: () => void;
}

export const CorpusView: React.FC<CorpusViewProps> = ({
  realEntries,
  onOpenRecordModal,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<'all' | 'Nam 01' | 'Nữ 01'>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Gộp cả dữ liệu thật (từ IndexedDB) và dữ liệu mẫu UI để hiển thị
  const combinedList: CorpusItem[] = [
    // Real entries
    ...(Array.isArray(realEntries) ? realEntries : []).map((e) => {
      let createdAtStr = '2026-11-02 12:00';
      try {
        if (e && e.addedAt) {
          const d = new Date(e.addedAt);
          if (!isNaN(d.getTime())) {
            createdAtStr = d.toISOString().slice(0, 16).replace('T', ' ');
          }
        }
      } catch {
        createdAtStr = '2026-11-02 12:00';
      }

      const cleanWord = String(e?.word || '');
      const codeStr = e?.code || encodeVnFilename(cleanWord).replace('.wav', '') || 'code';
      const spkStr = (e?.speaker === 'nam' || e?.speaker === 'Nam 01' ? 'Nam 01' : 'Nữ 01') as 'Nam 01' | 'Nữ 01';

      return {
        id: e?.id || `entry-${Math.random()}`,
        word: cleanWord,
        code: codeStr,
        speaker: spkStr,
        filename: encodeVnFilename(cleanWord),
        duration: typeof e?.duration === 'number' && !isNaN(e.duration) ? e.duration : 0.6,
        createdAt: createdAtStr,
        isMock: false,
      };
    }),
    // Mock entries
    ...MOCK_CORPUS_ITEMS,
  ];

  const filtered = combinedList.filter((item) => {
    const w = (item?.word || '').toLowerCase();
    const c = (item?.code || '').toLowerCase();
    const f = (item?.filename || '').toLowerCase();
    const s = (searchTerm || '').toLowerCase();
    const matchSearch = w.includes(s) || c.includes(s) || f.includes(s);
    const matchSpeaker = selectedSpeaker === 'all' || item?.speaker === selectedSpeaker;
    return matchSearch && matchSpeaker;
  });

  const handlePlayWord = async (item: CorpusItem) => {
    if (playingId === item.id) {
      setPlayingId(null);
      return;
    }

    if (!item.isMock) {
      const real = realEntries.find((e) => e.id === item.id);
      if (real) {
        try {
          const samples = await decodeBlob(real.blob);
          setPlayingId(item.id);
          playSamples(samples, 22050, () => setPlayingId(null));
        } catch {
          setPlayingId(null);
        }
      }
    } else {
      // Giả lập phát từ mẫu
      alert(`Đang phát âm thanh mẫu từ: "${item.word}" (${item.speaker} - ${item.filename})`);
    }
  };

  const handleDownloadWord = (item: CorpusItem) => {
    if (!item.isMock) {
      const real = realEntries.find((e) => e.id === item.id);
      if (real) {
        const url = URL.createObjectURL(real.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.filename;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
    }

    // Mock download dummy WAV
    const dummy = new Blob(['RIFF....WAVEfmt '], { type: 'audio/wav' });
    const url = URL.createObjectURL(dummy);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteReal = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa từ này khỏi ngữ liệu đã thu?')) {
      await deleteEntry(id);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white rounded-2xl border border-[#E8E8F0] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-[#6255CF]" />
            <h2 className="text-lg font-bold text-[#20213A]">Ngữ liệu song song văn bản — âm thanh</h2>
          </div>
          <p className="text-xs text-[#85879A] max-w-2xl leading-relaxed">
            Hệ thống quản lý các file âm thanh thu âm tương ứng với từng từ tiếng Việt theo hai giọng đọc (Nam 01 và Nữ 01).
            Tên file được quy ước mã hóa theo bảng mã VNI để đảm bảo tính đồng bộ của đồ án.
          </p>
        </div>

        <button
          onClick={onOpenRecordModal}
          className="px-5 py-3 rounded-xl bg-[#6255CF] hover:bg-[#5144BD] text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-[#6255CF]/20 transition flex-shrink-0 active:scale-95"
        >
          <Mic className="w-4 h-4" />
          <span>Thu âm từ mới</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-[#E8E8F0] shadow-sm p-6">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#F0F2F9]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#20213A]">Danh sách từ vựng</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F3F4FA] font-semibold text-[#85879A]">
              {filtered.length} từ
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#85879A] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm từ, mã VNI, tên file..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#E8E8F0] bg-[#FAFBFD] focus:outline-none focus:border-[#6255CF] text-[#20213A] placeholder-[#9CA1B7] w-52"
              />
            </div>

            {/* Voice filter */}
            <div className="flex items-center rounded-xl border border-[#E8E8F0] bg-[#FAFBFD] p-0.5 text-xs font-medium text-[#555870]">
              <button
                onClick={() => setSelectedSpeaker('all')}
                className={`px-3 py-1 rounded-lg transition ${
                  selectedSpeaker === 'all' ? 'bg-white shadow-xs text-[#6255CF] font-bold' : 'hover:text-[#20213A]'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setSelectedSpeaker('Nam 01')}
                className={`px-3 py-1 rounded-lg transition ${
                  selectedSpeaker === 'Nam 01' ? 'bg-white shadow-xs text-[#5578D8] font-bold' : 'hover:text-[#20213A]'
                }`}
              >
                Nam 01
              </button>
              <button
                onClick={() => setSelectedSpeaker('Nữ 01')}
                className={`px-3 py-1 rounded-lg transition ${
                  selectedSpeaker === 'Nữ 01' ? 'bg-white shadow-xs text-[#B16BC1] font-bold' : 'hover:text-[#20213A]'
                }`}
              >
                Nữ 01
              </button>
            </div>

            <button
              onClick={onRefresh}
              className="p-2 rounded-xl border border-[#E8E8F0] hover:bg-[#FAFBFD] text-[#555870] hover:text-[#6255CF] transition"
              title="Làm mới danh sách"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Corpus Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs text-[#555870]">
            <thead className="bg-[#FAFBFD] text-[#85879A] uppercase text-[10px] tracking-wider border-y border-[#E8E8F0]">
              <tr>
                <th className="py-3 px-4 w-12 text-center">STT</th>
                <th className="py-3 px-4 font-bold text-[#20213A]">Từ tiếng Việt</th>
                <th className="py-3 px-4">Mã hóa VNI</th>
                <th className="py-3 px-4 w-28">Giọng đọc</th>
                <th className="py-3 px-4">Tên file (.wav)</th>
                <th className="py-3 px-4 w-24">Thời lượng</th>
                <th className="py-3 px-4 w-28">Nguồn</th>
                <th className="py-3 px-4 w-24 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F9]">
              {filtered.map((item, idx) => (
                <tr key={item.id} className="hover:bg-[#FAFBFD] transition group">
                  <td className="py-3.5 px-4 text-center font-mono text-[11px] text-[#85879A]">
                    {idx + 1}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-[#20213A] text-sm">
                    {item.word}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#F0F2F9] text-[#6255CF] font-semibold border border-[#E2E4F0]">
                      {item.code}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                        item.speaker === 'Nam 01'
                          ? 'bg-[#5578D8]/10 text-[#5578D8]'
                          : 'bg-[#B16BC1]/10 text-[#B16BC1]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.speaker === 'Nam 01' ? 'bg-[#5578D8]' : 'bg-[#B16BC1]'
                        }`}
                      />
                      {item.speaker}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-[#63667E]">
                    {item.filename}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-[#20213A]">
                    {(Number(item.duration) || 0).toFixed(2)}s
                  </td>
                  <td className="py-3.5 px-4">
                    {item.isMock ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F3F4FA] text-[#85879A] border border-[#E5E6F2]">
                        Mẫu minh họa
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                        Bản thu thật
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handlePlayWord(item)}
                        className="p-1.5 rounded-lg text-[#555870] hover:text-[#6255CF] hover:bg-[#F0F2F9] transition"
                        title="Nghe phát âm"
                      >
                        {playingId === item.id ? (
                          <Square className="w-3.5 h-3.5 fill-current text-[#6255CF]" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>

                      <button
                        onClick={() => handleDownloadWord(item)}
                        className="p-1.5 rounded-lg text-[#555870] hover:text-[#6255CF] hover:bg-[#F0F2F9] transition"
                        title="Tải file WAV"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {!item.isMock && (
                        <button
                          onClick={() => handleDeleteReal(item.id)}
                          className="p-1.5 rounded-lg text-[#85879A] hover:text-red-500 hover:bg-red-50 transition"
                          title="Xóa từ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

