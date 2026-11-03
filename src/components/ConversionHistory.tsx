import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  RotateCw,
  Play,
  Download,
  Trash2,
  Filter,
  Square,
  Pause,
  ChevronDown,
  Calendar,
  MoreVertical,
  Check,
  Copy,
} from 'lucide-react';
import type { ConversionHistoryItem } from '../data/mockCorpus';
import type { NotificationModalData } from './NotificationModal';
import type { PlayerTrack } from './BottomAudioPlayer';

interface ConversionHistoryProps {
  items: ConversionHistoryItem[];
  onDelete: (idOrIds: string | string[]) => void;
  onRefresh: () => void;
  currentPlayingId?: string | null;
  isPlayingAudio?: boolean;
  onTogglePlay?: (item: ConversionHistoryItem) => void;
  onPlayTrack?: (track: PlayerTrack) => void;
  onSelectSampleText?: (text: string) => void;
  onShowNotification?: (data: NotificationModalData) => void;
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return 'Vừa xong';
  if (
    dateStr.includes('phút trước') ||
    dateStr.includes('giờ trước') ||
    dateStr.includes('ngày trước') ||
    dateStr.includes('Vừa xong')
  ) {
    return dateStr;
  }
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return dateStr;
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export const ConversionHistory: React.FC<ConversionHistoryProps> = ({
  items,
  onDelete,
  onRefresh,
  currentPlayingId,
  isPlayingAudio,
  onTogglePlay,
  onPlayTrack,
  onSelectSampleText,
  onShowNotification,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'converting' | 'completed' | 'failed'>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const filterRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng popover khi click ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setIsCalendarOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeItems = Array.isArray(items) ? items : [];

  const filtered = safeItems.filter((item) => {
    const matchText = String(item?.text || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchStatus =
      statusFilter === 'all' ||
      item?.status === statusFilter ||
      (!item?.status && statusFilter === 'completed');
    const matchDate = !selectedDate || String(item?.createdAt || '').startsWith(selectedDate);
    return matchText && matchStatus && matchDate;
  });

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    onDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handlePlayHistoryAudio = (item: ConversionHistoryItem) => {
    if (item.status === 'converting') return;
    setPlayingId(item.id);

    if (onPlayTrack) {
      onPlayTrack({
        id: item.id,
        text: item.text,
        speaker: item.speaker,
        durationSec: Number(item.duration) || 0.72,
        audioBlob: item.audioBlob,
        filename: item.filename,
      });
      return;
    }

    if (item.audioBlob) {
      const url = URL.createObjectURL(item.audioBlob);
      const audio = new Audio(url);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      audio.play().catch(() => setPlayingId(null));
    } else {
      onShowNotification?.({
        type: 'info',
        title: 'Phát âm thanh',
        message: `Đang phát: "${item.text}" (${item.speaker})`,
        confirmText: 'Đóng',
      });
    }
  };

  const handleDownloadItem = (item: ConversionHistoryItem) => {
    if (item.status === 'converting') return;
    if (item.audioBlob) {
      const url = URL.createObjectURL(item.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.filename || 'vietvoice_audio.wav';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const dummy = new Blob(['RIFF....WAVEfmt '], { type: 'audio/wav' });
      const url = URL.createObjectURL(dummy);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.filename || 'vietvoice_audio.wav';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E8E8F0] shadow-sm mt-6 overflow-hidden">
      {/* 1. Header Toolbar */}
      <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        {/* Left: Collapse chevron + Title */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-left group focus:outline-none"
        >
          <ChevronDown
            className={`w-4 h-4 text-[#1E2040] transition-transform duration-200 ${
              isCollapsed ? '-rotate-90' : ''
            }`}
          />
          <h2 className="text-[14px] md:text-[15px] font-bold text-[#1E2040] tracking-tight group-hover:text-[#6255CF] transition">
            Danh sách chuyển đổi
          </h2>
        </button>

        {/* Right Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#85879A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm"
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E2E4F0] bg-white focus:outline-none focus:border-[#6255CF] text-[#20213A] placeholder-[#9CA1B7] w-36 sm:w-44 transition"
            />
          </div>

          {/* Calendar Button & Popover */}
          <div className="relative" ref={calendarRef}>
            <button
              onClick={() => {
                setIsCalendarOpen(!isCalendarOpen);
                setIsFilterOpen(false);
              }}
              className={`p-2 rounded-lg border transition ${
                selectedDate
                  ? 'border-[#6255CF] bg-[#F7F6FD] text-[#6255CF]'
                  : 'border-[#E2E4F0] text-[#555870] hover:text-[#20213A] hover:bg-gray-50'
              }`}
              title="Lọc theo ngày"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>

            {isCalendarOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-[#E2E4F0] shadow-lg p-3 z-30 animate-in fade-in zoom-in-95">
                <div className="text-xs font-semibold text-[#20213A] mb-2">Lọc theo ngày</div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setIsCalendarOpen(false);
                  }}
                  className="w-full text-xs p-1.5 rounded-lg border border-[#E2E4F0] text-[#20213A] focus:outline-none focus:border-[#6255CF]"
                />
                {selectedDate && (
                  <button
                    onClick={() => {
                      setSelectedDate('');
                      setIsCalendarOpen(false);
                    }}
                    className="mt-2 w-full text-center text-[11px] text-[#6255CF] hover:underline"
                  >
                    Xóa lọc ngày
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Filter Button & Popover - Phân loại theo Trạng thái */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => {
                setIsFilterOpen(!isFilterOpen);
                setIsCalendarOpen(false);
              }}
              className={`p-2 rounded-lg border transition ${
                statusFilter !== 'all'
                  ? 'border-[#6255CF] bg-[#F7F6FD] text-[#6255CF]'
                  : 'border-[#E2E4F0] text-[#555870] hover:text-[#20213A] hover:bg-gray-50'
              }`}
              title="Phân loại trạng thái"
            >
              <Filter className="w-3.5 h-3.5" />
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl border border-[#E2E4F0] shadow-lg p-1.5 z-30 animate-in fade-in zoom-in-95 text-xs">
                <div className="px-2 py-1 text-[11px] font-bold text-[#85879A] uppercase tracking-wider">
                  Trạng thái
                </div>
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setIsFilterOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left ${
                    statusFilter === 'all'
                      ? 'bg-[#F7F6FD] text-[#6255CF] font-semibold'
                      : 'text-[#20213A] hover:bg-gray-50'
                  }`}
                >
                  <span>Tất cả</span>
                  {statusFilter === 'all' && <Check className="w-3.5 h-3.5 text-[#6255CF]" />}
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('converting');
                    setIsFilterOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left ${
                    statusFilter === 'converting'
                      ? 'bg-[#F7F6FD] text-[#6255CF] font-semibold'
                      : 'text-[#20213A] hover:bg-gray-50'
                  }`}
                >
                  <span>Đang chuyển đổi</span>
                  {statusFilter === 'converting' && <Check className="w-3.5 h-3.5 text-[#6255CF]" />}
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('completed');
                    setIsFilterOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left ${
                    statusFilter === 'completed'
                      ? 'bg-[#F7F6FD] text-[#6255CF] font-semibold'
                      : 'text-[#20213A] hover:bg-gray-50'
                  }`}
                >
                  <span>Thành công</span>
                  {statusFilter === 'completed' && <Check className="w-3.5 h-3.5 text-[#6255CF]" />}
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('failed');
                    setIsFilterOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left ${
                    statusFilter === 'failed'
                      ? 'bg-[#F7F6FD] text-[#6255CF] font-semibold'
                      : 'text-[#20213A] hover:bg-gray-50'
                  }`}
                >
                  <span>Thất bại</span>
                  {statusFilter === 'failed' && <Check className="w-3.5 h-3.5 text-[#6255CF]" />}
                </button>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg border border-[#E2E4F0] text-[#555870] hover:text-[#6255CF] hover:bg-gray-50 transition"
            title="Làm mới danh sách"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Batch Selection Action Bar */}
      {!isCollapsed && selectedIds.size > 0 && (
        <div className="bg-[#F7F6FD] border-t border-[#E8E8F0] px-5 py-2 flex items-center justify-between text-xs text-[#6255CF]">
          <div className="font-semibold flex items-center gap-2">
            <span>Đã chọn {selectedIds.size} mục</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[#85879A] hover:underline text-[11px]"
            >
              (Bỏ chọn)
            </button>
          </div>
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-semibold px-2 py-1 rounded-md hover:bg-red-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa đã chọn</span>
          </button>
        </div>
      )}

      {/* 2. List Body: Cuộn riêng trong danh sách chuyển đổi, giữ nguyên phần MainEditor bên trên */}
      {!isCollapsed && (
        <div
          className="border-t border-[#F0F2F9] divide-y divide-[#F0F2F9] overflow-y-auto max-h-[300px] sm:max-h-[340px] overscroll-contain"
          ref={menuRef}
        >
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#85879A]">
              Không tìm thấy mục chuyển đổi nào phù hợp.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isFemale = item.speaker === 'Nữ';
              const isPlaying = Boolean(isPlayingAudio && currentPlayingId === item.id);
              const isSelected = selectedIds.has(item.id);
              const isConvertingItem = item.status === 'converting';

              return (
                <div
                  key={item.id}
                  className={`relative flex items-center justify-between px-5 py-3 transition hover:bg-[#FAFAFD] ${
                    isSelected ? 'bg-[#FAF8FE]' : ''
                  }`}
                >
                  {/* Left Side: Checkbox & Main Info */}
                  <div className="flex items-center gap-3.5 min-w-0 max-w-[42%] pr-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectOne(item.id)}
                      className="w-4 h-4 rounded border-[#D0D2E5] text-[#6255CF] focus:ring-[#6255CF] cursor-pointer shrink-0"
                    />

                    {/* Text Title & Subtitle */}
                    <div className="min-w-0 flex-1">
                      <div
                        className="font-semibold text-xs md:text-sm text-[#20213A] truncate leading-snug"
                        title={item.text}
                      >
                        {item.text}
                      </div>
                      <div className="text-[11px] text-[#85879A] mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>{formatRelativeTime(item.createdAt)}</span>
                        <span>•</span>
                        <span>{item.text.length} ký tự</span>
                        <span>•</span>
                        <span>{(Number(item.duration) || 0.72).toFixed(2)}s</span>
                        <span>•</span>
                        <span className="font-medium text-[#555870]">WAV</span>
                        <span className="sm:hidden font-semibold text-[#6255CF]">
                          • {isFemale ? 'Nữ' : 'Nam'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Side: Nữ / Nam ở CHÍNH GIỮA hàng */}
                  <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center justify-center">
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        isFemale
                          ? 'bg-[#B16BC1]/10 text-[#B16BC1] border border-[#B16BC1]/20'
                          : 'bg-[#5578D8]/10 text-[#5578D8] border border-[#5578D8]/20'
                      }`}
                    >
                      {isFemale ? 'Nữ' : 'Nam'}
                    </span>
                  </div>

                  {/* Right Side: Status badge & Play / Download / More Actions */}
                  <div className="flex items-center gap-3 shrink-0 relative">
                    {/* Phân loại trạng thái */}
                    {item.status === 'converting' ? (
                      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <div className="w-2.5 h-2.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                        Đang chuyển đổi
                      </span>
                    ) : item.status === 'failed' ? (
                      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Thất bại
                      </span>
                    ) : (
                      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Thành công
                      </span>
                    )}

                    {/* Circular Play Button */}
                    <button
                      onClick={() => {
                        if (onTogglePlay) {
                          onTogglePlay(item);
                        } else {
                          handlePlayHistoryAudio(item);
                        }
                      }}
                      disabled={isConvertingItem}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition shadow-xs cursor-pointer ${
                        isConvertingItem
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : isPlaying
                          ? 'bg-[#6255CF] text-white ring-2 ring-[#6255CF]/30'
                          : 'bg-[#1E2040] hover:bg-[#6255CF] text-white'
                      }`}
                      title={
                        isConvertingItem
                          ? 'Đang chuyển đổi...'
                          : isPlaying
                          ? 'Tạm dừng phát'
                          : 'Phát âm thanh'
                      }
                    >
                      {isPlaying ? (
                        <Pause className="w-3 h-3 fill-current" />
                      ) : (
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Download Button */}
                    <button
                      onClick={() => handleDownloadItem(item)}
                      disabled={isConvertingItem}
                      className={`p-1.5 transition rounded-lg hover:bg-gray-50 ${
                        isConvertingItem ? 'text-gray-300 cursor-not-allowed' : 'text-[#555870] hover:text-[#6255CF]'
                      }`}
                      title="Tải về file WAV"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* More Vertical Button */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveMenuId(activeMenuId === item.id ? null : item.id)
                        }
                        className="p-1.5 text-[#85879A] hover:text-[#1E2040] transition rounded-lg hover:bg-gray-50"
                        title="Tùy chọn khác"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === item.id && (
                        <div
                          className={`absolute right-0 ${
                            idx >= filtered.length - 2 && filtered.length > 2
                              ? 'bottom-full mb-1'
                              : 'top-full mt-1'
                          } w-44 bg-white rounded-xl border border-[#E2E4F0] shadow-xl py-1.5 z-40 animate-in fade-in zoom-in-95 text-xs font-medium`}
                        >
                          {onSelectSampleText && (
                            <button
                              onClick={() => {
                                onSelectSampleText(item.text);
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-[#20213A] hover:bg-[#F7F6FD] hover:text-[#6255CF] text-left transition"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Dùng lại văn bản</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              handleDownloadItem(item);
                              setActiveMenuId(null);
                            }}
                            disabled={isConvertingItem}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[#20213A] hover:bg-[#F7F6FD] hover:text-[#6255CF] text-left transition disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải xuống WAV</span>
                          </button>

                          <div className="my-1 border-t border-[#F0F2F9]" />

                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              onDelete(item.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 text-left transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa mục này</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
