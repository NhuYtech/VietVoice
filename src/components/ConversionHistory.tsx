import React, { useState } from 'react';
import { Search, RotateCw, Play, Download, Trash2, Clock, Filter, Volume2, Square } from 'lucide-react';
import type { ConversionHistoryItem } from '../data/mockCorpus';
import { playSamples } from '../lib/dsp';

interface ConversionHistoryProps {
  items: ConversionHistoryItem[];
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onSelectSampleText?: (text: string) => void;
}

export const ConversionHistory: React.FC<ConversionHistoryProps> = ({
  items,
  onDelete,
  onRefresh,
  onSelectSampleText,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<'all' | 'Nam 01' | 'Nữ 01'>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const filtered = items.filter((item) => {
    const matchText = item.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchVoice = voiceFilter === 'all' || item.speaker === voiceFilter;
    return matchText && matchVoice;
  });

  const handlePlayHistoryAudio = (item: ConversionHistoryItem) => {
    if (playingId === item.id) {
      setPlayingId(null);
      return;
    }

    if (item.audioBlob) {
      const url = URL.createObjectURL(item.audioBlob);
      const audio = new Audio(url);
      setPlayingId(item.id);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      audio.play().catch(() => setPlayingId(null));
    } else {
      // Dữ liệu mẫu minh họa lịch sử
      alert(`Đang phát mẫu âm thanh: "${item.text}" (${item.speaker})`);
    }
  };

  const handleDownloadItem = (item: ConversionHistoryItem) => {
    if (item.audioBlob) {
      const url = URL.createObjectURL(item.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Mock download dummy WAV
      const dummy = new Blob(['RIFF....WAVEfmt '], { type: 'audio/wav' });
      const url = URL.createObjectURL(dummy);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8F0] shadow-sm p-6 mt-6 transition-all">
      {/* Title & Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#F0F2F9]">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#6255CF]" />
          <h2 className="text-base font-bold text-[#20213A]">Danh sách chuyển đổi</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F3F4FA] font-semibold text-[#85879A]">
            {filtered.length} mục
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#85879A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm nội dung..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#E8E8F0] bg-[#FAFBFD] focus:outline-none focus:border-[#6255CF] text-[#20213A] placeholder-[#9CA1B7] w-48"
            />
          </div>

          {/* Voice Filter */}
          <div className="flex items-center rounded-xl border border-[#E8E8F0] bg-[#FAFBFD] p-0.5 text-xs font-medium text-[#555870]">
            <button
              onClick={() => setVoiceFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition ${
                voiceFilter === 'all'
                  ? 'bg-white shadow-xs text-[#6255CF] font-bold'
                  : 'hover:text-[#20213A]'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setVoiceFilter('Nam 01')}
              className={`px-2.5 py-1 rounded-lg transition ${
                voiceFilter === 'Nam 01'
                  ? 'bg-white shadow-xs text-[#5578D8] font-bold'
                  : 'hover:text-[#20213A]'
              }`}
            >
              Nam 01
            </button>
            <button
              onClick={() => setVoiceFilter('Nữ 01')}
              className={`px-2.5 py-1 rounded-lg transition ${
                voiceFilter === 'Nữ 01'
                  ? 'bg-white shadow-xs text-[#B16BC1] font-bold'
                  : 'hover:text-[#20213A]'
              }`}
            >
              Nữ 01
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl border border-[#E8E8F0] hover:bg-[#FAFBFD] text-[#555870] hover:text-[#6255CF] transition"
            title="Làm mới danh sách"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#85879A]">
          Chưa có dữ liệu chuyển đổi.
        </div>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs text-[#555870]">
            <thead className="bg-[#FAFBFD] text-[#85879A] uppercase text-[10px] tracking-wider border-y border-[#E8E8F0]">
              <tr>
                <th className="py-3 px-4 w-12 text-center">STT</th>
                <th className="py-3 px-4">Nội dung</th>
                <th className="py-3 px-4 w-28">Giọng đọc</th>
                <th className="py-3 px-4 w-24">Thời lượng</th>
                <th className="py-3 px-4 w-36">Ngày tạo</th>
                <th className="py-3 px-4 w-28 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F9]">
              {filtered.map((item, idx) => (
                <tr key={item.id} className="hover:bg-[#FAFBFD] transition group">
                  <td className="py-3.5 px-4 text-center font-mono text-[11px] text-[#85879A]">
                    {idx + 1}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-[#20213A]">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-sm" title={item.text}>
                        {item.text}
                      </span>
                      {onSelectSampleText && (
                        <button
                          onClick={() => onSelectSampleText(item.text)}
                          className="opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 rounded bg-[#F0F2F9] text-[#6255CF] hover:bg-[#6255CF] hover:text-white transition"
                        >
                          Dùng lại
                        </button>
                      )}
                    </div>
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
                  <td className="py-3.5 px-4 font-mono text-[11px] text-[#20213A]">
                    {item.duration.toFixed(2)}s
                  </td>
                  <td className="py-3.5 px-4 text-[#85879A] text-[11px]">
                    {item.createdAt}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handlePlayHistoryAudio(item)}
                        className="p-1.5 rounded-lg text-[#555870] hover:text-[#6255CF] hover:bg-[#F0F2F9] transition"
                        title="Phát lại"
                      >
                        {playingId === item.id ? (
                          <Square className="w-3.5 h-3.5 fill-current text-[#6255CF]" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>

                      <button
                        onClick={() => handleDownloadItem(item)}
                        className="p-1.5 rounded-lg text-[#555870] hover:text-[#6255CF] hover:bg-[#F0F2F9] transition"
                        title="Tải về"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1.5 rounded-lg text-[#85879A] hover:text-red-500 hover:bg-red-50 transition"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
