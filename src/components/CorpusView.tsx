import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const [dbStatus, setDbStatus] = useState<'connected' | 'checking' | 'offline'>('checking');
  const [dbCount, setDbCount] = useState<number | null>(null);
  const activeWordAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => {
        if (d?.status === 'ok') {
          setDbStatus('connected');
          setDbCount(d.totalAudios || 6674);
        } else {
          setDbStatus('offline');
        }
      })
      .catch(() => setDbStatus('offline'));
  }, []);

  // Gộp cả dữ liệu thật trong IndexedDB và danh mục 6.674 từ trong datasetTV
  const combinedList = useMemo<CorpusItem[]>(() => {
    const list: CorpusItem[] = [];
    const realMap = new Map<string, CorpusEntry>();

    (Array.isArray(realEntries) ? realEntries : []).forEach((e) => {
      const spk = e?.speaker && e.speaker.toLowerCase() !== 'nam' ? e.speaker : 'Hữu Thọ';
      const cleanW = String(e?.word || '').trim();
      const c = e?.code || encodeVnFilename(cleanW).replace('.wav', '') || 'code';
      realMap.set(`${spk.toLowerCase()}::${c.toLowerCase()}`, e);
      realMap.set(`${spk.toLowerCase()}::${cleanW.toLowerCase()}`, e);
      realMap.set(`nam::${c.toLowerCase()}`, e);
      realMap.set(`nam::${cleanW.toLowerCase()}`, e);

      let createdAtStr = 'Vừa xong';
      try {
        if (e && e.addedAt) {
          const d = new Date(e.addedAt);
          if (!isNaN(d.getTime())) {
            createdAtStr = d.toISOString().slice(0, 16).replace('T', ' ');
          }
        }
      } catch { }

      list.push({
        id: e?.id || `entry-${cleanW}`,
        word: cleanW,
        code: c,
        speaker: spk,
        filename: encodeVnFilename(cleanW),
        duration: typeof e?.duration === 'number' && !isNaN(e.duration) ? e.duration : 0.45,
        createdAt: createdAtStr,
        isMock: false,
        source: e.source,
      });
    });

    // Thêm các từ trong MongoDB / Cloudinary chưa có trong IndexedDB
    cachedManifestWords.forEach((m, idx) => {
      const spk: 'Hữu Thọ' = 'Hữu Thọ';
      const cleanW = (m.word || '').trim();
      const c = m.code || (m.file ? m.file.replace(/^wavs\//, '').replace(/\.wav$/, '') : cleanW);
      const key = `nam::${c.toLowerCase()}`;

      if (!realMap.has(key)) {
        list.push({
          id: m.id || `manifest-${idx}-${cleanW}`,
          word: cleanW,
          code: c,
          speaker: spk,
          filename: m.file ? m.file.replace(/^wavs\//, '') : `${c}.wav`,
          duration: typeof m.duration === 'number' ? m.duration : 0.45,
          createdAt: m.audioUrl ? 'MongoDB • Cloudinary' : 'datasetTV',
          isMock: false,
          audioUrl: m.audioUrl,
          source: 'manifest',
        });
      }
    });

    return list;
  }, [realEntries, cachedManifestWords]);

  const availableSpeakers = useMemo(() => {
    const set = new Set<string>();
    set.add('Hữu Thọ');
    combinedList.forEach((it) => {
      if (it.speaker && it.speaker.trim()) set.add(it.speaker.trim());
    });
    return Array.from(set);
  }, [combinedList]);

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
      if (activeWordAudioRef.current) {
        activeWordAudioRef.current.pause();
        activeWordAudioRef.current = null;
      }
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
        if (activeWordAudioRef.current) {
          activeWordAudioRef.current.pause();
          activeWordAudioRef.current = null;
        }
        const audioUrl = URL.createObjectURL(real.blob);
        const audio = new Audio(audioUrl);
        activeWordAudioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (activeWordAudioRef.current === audio) activeWordAudioRef.current = null;
          setPlayingId(null);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          if (activeWordAudioRef.current === audio) activeWordAudioRef.current = null;
          setPlayingId(null);
        };
        await audio.play();
      } catch (err) {
        console.error('Lỗi khi phát âm thanh:', err);
        setPlayingId(null);
      }
    } else {
      setPlayingId(null);
      onShowNotification?.({
        type: 'warning',
        title: 'Chưa thể phát',
        message: `Chưa có file âm thanh cho từ "${item.word}".`,
        confirmText: 'Đóng',
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
      const code = m.code || (m.file ? m.file.replace(/^wavs\//, '').replace(/\.wav$/, '') : m.word);
      const publicId = m.cloudinaryPublicId || code.replace(/\+/g, '_');
      a.href = m.audioUrl || `https://res.cloudinary.com/wximbfoz/video/upload/${publicId}.wav`;
      a.download = item.filename || `${item.word}.wav`;
      a.target = '_blank';
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
        title: 'Xóa từ ngữ liệu',
        message: `Xóa từ "${item.word}" (${item.speaker})?`,
        confirmText: 'Xóa',
        cancelText: 'Hủy',
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
    <div className="flex-1 min-h-0 flex flex-col space-y-3">
      {/* Overview Banner */}
      <div className="bg-white rounded-2xl border border-[#E8E8F0] px-5 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Database className="w-4 h-4 text-[#6255CF]" />
            <h2 className="text-sm md:text-base font-bold text-[#20213A]">Ngữ liệu song song văn bản — âm thanh</h2>
          </div>
          {/* <p className="text-xs text-[#85879A] max-w-2xl leading-relaxed">
            Hệ thống quản lý ngữ liệu âm thanh với <strong>{combinedList.length.toLocaleString()}</strong> âm tiết tiếng Việt chuẩn (datasetTV) cùng các bản ghi âm riêng.
          </p> */}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {dbStatus === 'connected' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Đã kết nối
            </span>
          ) : dbStatus === 'checking' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              Đang kiểm tra...
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Ngắt kết nối
            </span>
          )}
          <button
            onClick={onOpenRecordModal}
            className="px-4 py-2 rounded-xl bg-[#6255CF] hover:bg-[#5144BD] text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-[#6255CF]/20 transition flex-shrink-0 active:scale-95 cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Thu âm từ mới</span>
          </button>
        </div>
      </div>

      {/* Main Table Card: flex-1 min-h-0 tự co giãn theo chiều cao khả dụng */}
      <div className="bg-white rounded-2xl border border-[#E8E8F0] shadow-sm p-4 sm:p-5 flex-1 min-h-0 flex flex-col overflow-hidden">
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
                placeholder="Tìm kiếm..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#E8E8F0] bg-[#FAFBFD] focus:outline-none focus:border-[#6255CF] text-[#20213A] placeholder-[#9CA1B7] w-52 transition"
              />
            </div>

            {/* Voice filter */}
            <div className="flex items-center rounded-xl border border-[#E8E8F0] bg-[#FAFBFD] p-0.5 text-xs font-medium text-[#555870] flex-wrap gap-0.5">
              <button
                onClick={() => {
                  setSelectedSpeaker('all');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${selectedSpeaker === 'all' ? 'bg-white shadow-xs text-[#6255CF] font-bold' : 'hover:text-[#20213A]'
                  }`}
              >
                Tất cả
              </button>
              {availableSpeakers.map((spk) => (
                <button
                  key={spk}
                  onClick={() => {
                    setSelectedSpeaker(spk);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${selectedSpeaker === spk ? 'bg-white shadow-xs text-[#5578D8] font-bold' : 'hover:text-[#20213A]'
                    }`}
                >
                  {spk}
                </button>
              ))}
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

        {/* Corpus Table: Chỉ cuộn riêng danh sách từ vựng này */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto mt-3 rounded-xl border border-[#E8E8F0] shadow-2xs overscroll-contain">
          <table className="w-full text-left text-xs text-[#555870] min-w-[1020px] table-fixed select-none">
            <thead className="bg-[#FAFBFD] text-[#85879A] uppercase text-[10px] tracking-wider border-b border-[#E8E8F0] sticky top-0 z-10 shadow-2xs select-none">
              <tr>
                <th className="py-3.5 px-3.5 w-14 min-w-[56px] text-center whitespace-nowrap font-bold">STT</th>
                <th className="py-3.5 px-3.5 min-w-[140px] w-[16%] font-bold text-[#20213A] whitespace-nowrap">Từ tiếng Việt</th>
                <th className="py-3.5 px-3.5 min-w-[110px] w-[12%] whitespace-nowrap">Mã hóa VNI</th>
                <th className="py-3.5 px-3.5 min-w-[100px] w-[11%] whitespace-nowrap">Giọng đọc</th>
                <th className="py-3.5 px-3.5 min-w-[170px] w-[18%] whitespace-nowrap">Tên file (.wav)</th>
                <th className="py-3.5 px-3.5 min-w-[120px] w-[13%] whitespace-nowrap">Thời lượng</th>
                <th className="py-3.5 px-3.5 min-w-[140px] w-[15%] whitespace-nowrap">Nguồn</th>
                <th className="py-3.5 px-3.5 min-w-[110px] w-[11%] text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F9] bg-white">
              {currentPageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-[#85879A]">
                    Không tìm thấy từ ngữ liệu phù hợp với tìm kiếm.
                  </td>
                </tr>
              ) : (
                currentPageItems.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isRecorded = item.source === 'record' || item.source === 'upload';
                  const isManifest = !isRecorded;

                  return (
                    <tr key={item.id} className="hover:bg-[#FAFBFD] transition group">
                      <td className="py-3.5 px-3.5 text-center font-mono text-[11px] text-[#85879A] whitespace-nowrap align-middle">
                        {globalIdx}
                      </td>
                      <td className="py-3.5 px-3.5 font-bold text-[#20213A] text-sm whitespace-nowrap align-middle truncate">
                        {item.word}
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap align-middle">
                        <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-[#F0F2F9] text-[#6255CF] font-semibold border border-[#E2E4F0] inline-block">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap align-middle">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-[11px] whitespace-nowrap bg-[#5578D8]/10 text-[#5578D8]">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#5578D8]" />
                          Hữu Thọ
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-[11px] text-[#63667E] whitespace-nowrap align-middle truncate">
                        {item.filename}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-[11px] text-[#20213A] whitespace-nowrap align-middle">
                        {(Number(item.duration) || 0.45).toFixed(2)}s
                      </td>
                      <td className="py-3.5 px-3.5 whitespace-nowrap align-middle">
                        {isRecorded ? (
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 inline-block whitespace-nowrap">
                            Ghi âm riêng
                          </span>
                        ) : item.audioUrl || (item.createdAt && item.createdAt.includes('Cloudinary')) ? (
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-purple-50 text-[#6255CF] font-semibold border border-[#E0D8FF] inline-block whitespace-nowrap">
                            Cloudinary
                          </span>
                        ) : (
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200 inline-block whitespace-nowrap">
                            datasetTV
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap align-middle">
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

        {/* Pagination Bar: Cố định ở đáy card */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#F0F2F9] mt-2 shrink-0">
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
