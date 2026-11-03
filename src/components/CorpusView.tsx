import React, { useState, useMemo } from 'react';
import {
  Database,
  Search,
  Mic,
  Play,
  Square,
  Download,
  Trash2,
  RotateCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { CorpusEntry } from '../lib/types';
import type { CorpusItem } from '../data/mockCorpus';
import { encodeVnFilename } from '../lib/vniCodec';
import { playSamples, decodeBlob } from '../lib/dsp';
import { deleteEntry } from '../lib/store';
import { cachedManifestWords, fetchManifestWord, type ManifestItem } from '../lib/tts';
import type { NotificationModalData } from './NotificationModal';

interface CorpusViewProps {
  realEntries: CorpusEntry[];
  onOpenRecordModal: () => void;
  onRefresh: () => void;
  onShowNotification?: (data: NotificationModalData) => void;
}

export const CorpusView: React.FC<CorpusViewProps> = ({
  realEntries,
  onOpenRecordModal,
  onRefresh,
  onShowNotification,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<'all' | 'Nam' | 'Nữ'>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Gộp cả dữ liệu thật trong IndexedDB và danh mục 6.674 từ trong datasetTV
  const combinedList = useMemo<CorpusItem[]>(() => {
    const list: CorpusItem[] = [];
    const realMap = new Map<string, CorpusEntry>();

    (Array.isArray(realEntries) ? realEntries : []).forEach((e) => {
      const spk = (String(e?.speaker).toLowerCase().includes('nam') ? 'Nam' : 'Nữ') as 'Nam' | 'Nữ';
      const cleanW = String(e?.word || '').trim();
      realMap.set(`${spk.toLowerCase()}::${cleanW.toLowerCase()}`, e);

      let createdAtStr = 'Vừa xong';
      try {
        if (e && e.addedAt) {
          const d = new Date(e.addedAt);
          if (!isNaN(d.getTime())) {
            createdAtStr = d.toISOString().slice(0, 16).replace('T', ' ');
          }
        }
      } catch {}

      list.push({
        id: e?.id || `entry-${cleanW}`,
        word: cleanW,
        code: e?.code || encodeVnFilename(cleanW).replace('.wav', '') || 'code',
        speaker: spk,
        filename: encodeVnFilename(cleanW),
        duration: typeof e?.duration === 'number' && !isNaN(e.duration) ? e.duration : 0.45,
        createdAt: createdAtStr,
        isMock: false,
      });
    });

    // Thêm các từ trong datasetTV chưa có trong IndexedDB
    cachedManifestWords.forEach((m, idx) => {
      const spk = (m.speaker || 'nam').toLowerCase() === 'nam' ? 'Nam' : 'Nữ';
      const cleanW = (m.word || '').trim();
      const key = `${spk.toLowerCase()}::${cleanW.toLowerCase()}`;

      if (!realMap.has(key)) {
        list.push({
          id: `manifest-${idx}-${cleanW}`,
          word: cleanW,
          code: m.file.replace(/^wavs\//, '').replace(/\.wav$/, ''),
          speaker: spk,
          filename: m.file.replace(/^wavs\//, ''),
          duration: typeof m.duration === 'number' ? m.duration : 0.45,
          createdAt: 'datasetTV',
          isMock: false,
        });
      }
    });

    return list;
  }, [realEntries, cachedManifestWords]);

  const filtered = useMemo(() => {
    return combinedList.filter((item) => {
      const w = (item?.word || '').toLowerCase();
      const c = (item?.code || '').toLowerCase();
      const f = (item?.filename || '').toLowerCase();
      const s = (searchTerm || '').trim().toLowerCase();
      const matchSearch = !s || w.includes(s) || c.includes(s) || f.includes(s);
      const matchSpeaker = selectedSpeaker === 'all' || item?.speaker === selectedSpeaker;
      return matchSearch && matchSpeaker;
    });
  }, [combinedList, searchTerm, selectedSpeaker]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Nghe thử âm thanh
  const handlePlayWord = async (item: CorpusItem) => {
    if (playingId === item.id) {
      setPlayingId(null);
      return;
    }

    setPlayingId(item.id);
    const itemSpeakerCore = item.speaker === 'Nam' ? 'nam' : 'nu';
    let real = realEntries.find((e) => {
      const eSpk = (e.speaker || '').toLowerCase();
      return e.word.toLowerCase() === item.word.toLowerCase() && (eSpk === itemSpeakerCore || eSpk.includes(itemSpeakerCore));
    });

    // Nếu chưa có trong IndexedDB nhưng có trong manifest: tải tức thì file WAV từ public/corpus/wavs theo đúng giọng
    if (!real || !real.blob) {
      const m = cachedManifestWords.find(
        (w) => w.word.toLowerCase() === item.word.toLowerCase() && (w.speaker || 'nam').toLowerCase() === itemSpeakerCore
      );
      if (m) {
        real = (await fetchManifestWord(m)) || undefined;
      }
    }

    if (real && real.blob) {
      try {
        const samples = await decodeBlob(real.blob);
        playSamples(samples, 22050, () => setPlayingId(null));
      } catch (err) {
        console.error('Lỗi khi phát âm thanh:', err);
        setPlayingId(null);
      }
    } else {
      setPlayingId(null);
      onShowNotification?.({
        type: 'warning',
        title: 'Chưa có file âm thanh',
        message: `Chưa thể phát âm thanh của từ "${item.word}".`,
        confirmText: 'Đã hiểu',
      });
    }
  };

  // Tải file WAV
  const handleDownloadWord = (item: CorpusItem) => {
    const itemSpeakerCore = item.speaker === 'Nam' ? 'nam' : 'nu';
    const real = realEntries.find((e) => {
      const eSpk = (e.speaker || '').toLowerCase();
      return e.word.toLowerCase() === item.word.toLowerCase() && (eSpk === itemSpeakerCore || eSpk.includes(itemSpeakerCore));
    });

    if (real && real.blob) {
      const url = URL.createObjectURL(real.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.filename || `${item.word}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const m = cachedManifestWords.find(
      (w) => w.word.toLowerCase() === item.word.toLowerCase() && (w.speaker || 'nam').toLowerCase() === itemSpeakerCore
    );
    if (m) {
      const a = document.createElement('a');
      a.href = `/corpus/${m.file}`;
      a.download = item.filename || `${item.word}.wav`;
      a.click();
    }
  };

  const handleDeleteReal = (item: CorpusItem) => {
    const itemSpeakerCore = item.speaker === 'Nam' ? 'nam' : 'nu';
    const real = realEntries.find((e) => {
      const eSpk = (e.speaker || '').toLowerCase();
      return e.word.toLowerCase() === item.word.toLowerCase() && (eSpk === itemSpeakerCore || eSpk.includes(itemSpeakerCore));
    });
    const targetId = real?.id || item.id;

    if (onShowNotification) {
      onShowNotification({
        type: 'confirm',
        title: 'Xác nhận xóa từ ngữ liệu',
        message: `Bạn có chắc chắn muốn xóa từ "${item.word}" (Giọng ${item.speaker}) khỏi ngữ liệu?`,
        confirmText: 'Xóa ngay',
        cancelText: 'Hủy bỏ',
        onConfirm: async () => {
          await deleteEntry(targetId);
          onRefresh();
        },
      });
    } else {
      deleteEntry(targetId).then(() => onRefresh());
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
            Hệ thống quản lý ngữ liệu âm thanh với <strong>{combinedList.length.toLocaleString()}</strong> âm tiết tiếng Việt chuẩn (datasetTV) cùng các bản ghi âm người dùng tự thu.
            Tên file được quy ước mã hóa theo bảng mã VNI để đảm bảo tính đồng bộ của đồ án.
          </p>
        </div>

        <button
          onClick={onOpenRecordModal}
          className="px-5 py-3 rounded-xl bg-[#6255CF] hover:bg-[#5144BD] text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-[#6255CF]/20 transition flex-shrink-0 active:scale-95 cursor-pointer"
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
              {filtered.length.toLocaleString()} từ
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#85879A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm từ, mã VNI, tên file..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#E8E8F0] bg-[#FAFBFD] focus:outline-none focus:border-[#6255CF] text-[#20213A] placeholder-[#9CA1B7] w-52 transition"
              />
            </div>

            {/* Voice filter */}
            <div className="flex items-center rounded-xl border border-[#E8E8F0] bg-[#FAFBFD] p-0.5 text-xs font-medium text-[#555870]">
              <button
                onClick={() => {
                  setSelectedSpeaker('all');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  selectedSpeaker === 'all' ? 'bg-white shadow-xs text-[#6255CF] font-bold' : 'hover:text-[#20213A]'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => {
                  setSelectedSpeaker('Nam');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  selectedSpeaker === 'Nam' ? 'bg-white shadow-xs text-[#5578D8] font-bold' : 'hover:text-[#20213A]'
                }`}
              >
                Nam
              </button>
              <button
                onClick={() => {
                  setSelectedSpeaker('Nữ');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  selectedSpeaker === 'Nữ' ? 'bg-white shadow-xs text-[#B16BC1] font-bold' : 'hover:text-[#20213A]'
                }`}
              >
                Nữ
              </button>
            </div>

            <button
              onClick={onRefresh}
              className="p-2 rounded-xl border border-[#E8E8F0] hover:bg-[#FAFBFD] text-[#555870] hover:text-[#6255CF] transition cursor-pointer"
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
                <th className="py-3 px-4 w-14 text-center">STT</th>
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
              {currentPageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-[#85879A]">
                    Không tìm thấy từ ngữ liệu phù hợp với tìm kiếm.
                  </td>
                </tr>
              ) : (
                currentPageItems.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isManifest = item.id.startsWith('manifest-');

                  return (
                    <tr key={item.id} className="hover:bg-[#FAFBFD] transition group">
                      <td className="py-3.5 px-4 text-center font-mono text-[11px] text-[#85879A]">
                        {globalIdx}
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
                            String(item.speaker).includes('Nam')
                              ? 'bg-[#5578D8]/10 text-[#5578D8]'
                              : 'bg-[#B16BC1]/10 text-[#B16BC1]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              String(item.speaker).includes('Nam') ? 'bg-[#5578D8]' : 'bg-[#B16BC1]'
                            }`}
                          />
                          {String(item.speaker).includes('Nam') ? 'Nam' : 'Nữ'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#63667E]">
                        {item.filename}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#20213A]">
                        {(Number(item.duration) || 0.45).toFixed(2)}s
                      </td>
                      <td className="py-3.5 px-4">
                        {isManifest ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                            datasetTV
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                            Ghi âm riêng
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handlePlayWord(item)}
                            className="p-1.5 rounded-lg text-[#555870] hover:text-[#6255CF] hover:bg-[#F0F2F9] transition cursor-pointer"
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
                            className="p-1.5 rounded-lg text-[#555870] hover:text-[#6255CF] hover:bg-[#F0F2F9] transition cursor-pointer"
                            title="Tải file WAV"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {!isManifest && (
                            <button
                              onClick={() => handleDeleteReal(item)}
                              className="p-1.5 rounded-lg text-[#85879A] hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                              title="Xóa từ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#F0F2F9] mt-3">
            <span className="text-xs text-[#85879A]">
              Hiển thị {(currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filtered.length)} trên tổng số{' '}
              <strong>{filtered.length.toLocaleString()}</strong> từ
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-[#E2E4F0] text-[#555870] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-semibold px-3 py-1 bg-[#F0F2F9] rounded-lg text-[#20213A] font-mono">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-[#E2E4F0] text-[#555870] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Trang sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
