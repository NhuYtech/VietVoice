import React, { useState, useRef } from 'react';
import {
  Layers,
  Volume2,
  Play,
  Pause,
  Sliders,
  CheckCircle2,
  Database,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  Cpu,
  Sparkles,
} from 'lucide-react';
import type { SynthResult, TraceItem, JoinInfo } from '../lib/types';

interface ConcatenationInspectorProps {
  result: SynthResult | null;
  selectedVoice?: 'Hữu Thọ' | string;
  onSelectWordToRecord?: (word: string) => void;
}

export const ConcatenationInspector: React.FC<ConcatenationInspectorProps> = ({
  result,
  selectedVoice = 'Hữu Thọ',
}) => {
  const [playingWordIdx, setPlayingWordIdx] = useState<number | null>(null);
  const [isTableExpanded, setIsTableExpanded] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!result || !result.trace || result.trace.length === 0) {
    return null;
  }

  // Lọc các từ hợp lệ (được ghép nối)
  const validWords = result.trace.filter((t) => t.status !== 'oov');

  // Hàm phát âm thanh của riêng từng từ gốc
  const handlePlaySingleWord = (item: TraceItem, index: number) => {
    if (playingWordIdx === index) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingWordIdx(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (!item.blob) {
      return;
    }

    const url = URL.createObjectURL(item.blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingWordIdx(index);

    audio.onended = () => {
      setPlayingWordIdx(null);
      URL.revokeObjectURL(url);
      audioRef.current = null;
    };

    audio.onerror = () => {
      setPlayingWordIdx(null);
      URL.revokeObjectURL(url);
      audioRef.current = null;
    };

    audio.play().catch(() => {
      setPlayingWordIdx(null);
    });
  };

  return (
    <div className="mt-4 bg-white rounded-2xl border border-[#E2E4F0] shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-[#F7F7FD] via-[#F2F1FC] to-[#FAFAFD] border-b border-[#E8E8F0] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#6255CF]/10 text-[#6255CF] flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1E2040]">
                Biểu diễn ghép nối ngữ liệu
              </h3>
            </div>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#E2E4F0] text-[#44465B] shadow-2xs">
            <Database className="w-3.5 h-3.5 text-[#6255CF]" />
            <span>Nguồn: <strong>Kho dữ liệu trực tuyến</strong></span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#E2E4F0] text-[#44465B] shadow-2xs">
            <Cpu className="w-3.5 h-3.5 text-emerald-600" />
            <span>DSP: <strong>{result.elapsedMs || 12}ms</strong></span>
          </div>
          <button
            type="button"
            onClick={() => setIsTableExpanded(!isTableExpanded)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#6255CF]/10 hover:bg-[#6255CF]/20 text-[#6255CF] font-medium transition cursor-pointer text-xs"
            title="Đóng / mở rộng chi tiết"
          >
            {isTableExpanded ? (
              <>
                <span>Thu gọn</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Chi tiết</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Visual Timeline Section */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#30324E]">
            <span>Sơ đồ trục thời gian ghép nối:</span>
          </div>
        </div>

        {/* Timeline Horizontal Scroll Container */}
        <div className="overflow-x-auto pb-3 pt-1">
          <div className="flex items-center gap-1 min-w-max">
            {validWords.map((wordItem, idx) => {
              const join = result.joins && result.joins[idx];
              const isPlayingThis = playingWordIdx === idx;
              const startVal = typeof wordItem.start === 'number' ? wordItem.start : 0;
              const durVal = typeof wordItem.duration === 'number' ? wordItem.duration : 0;
              const endVal = startVal + durVal;
              const startSec = startVal.toFixed(2);
              const endSec = endVal.toFixed(2);
              const durMs = Math.round(durVal * 1000);

              return (
                <React.Fragment key={`${wordItem.token}-${idx}`}>
                  {/* Single Word Unit Card */}
                  <div
                    className={`relative rounded-xl border p-2.5 transition-all shadow-xs flex flex-col justify-between min-w-[145px] ${isPlayingThis
                      ? 'bg-purple-50 border-[#6255CF] ring-2 ring-[#6255CF]/30'
                      : 'bg-white hover:bg-[#F9FAFD] border-[#DFE2EE]'
                      }`}
                  >
                    {/* Index & Play Solo Button */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EEF0F8] text-[#555870]">
                        #{idx + 1}
                      </span>
                      {wordItem.blob && (
                        <button
                          type="button"
                          onClick={() => handlePlaySingleWord(wordItem, idx)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition cursor-pointer shadow-2xs ${isPlayingThis
                            ? 'bg-[#6255CF] text-white animate-pulse'
                            : 'bg-[#F0EFFD] text-[#6255CF] hover:bg-[#6255CF] hover:text-white'
                            }`}
                          title={`Nghe thử file âm thanh gốc độc lập của từ "${wordItem.token}"`}
                        >
                          {isPlayingThis ? (
                            <Pause className="w-3 h-3 fill-current" />
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Word & VNI Code */}
                    <div className="mb-2">
                      <div className="text-[14px] font-bold text-[#1E2040] leading-tight truncate">
                        "{wordItem.token}"
                      </div>
                      <div className="text-[10px] font-mono text-[#6F728F] truncate">
                        VNI: {wordItem.code || wordItem.token}
                      </div>
                    </div>

                    {/* Timestamp & Duration */}
                    <div className="pt-1.5 border-t border-[#EEF0F8] flex flex-col gap-0.5 text-[10px]">
                      <div className="flex items-center justify-between text-[#7A7D94]">
                        <span>Vị trí:</span>
                        <span className="font-mono font-medium text-[#20223A]">
                          {startSec}s ➔ {endSec}s
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#7A7D94]">Độ dài:</span>
                        <span className="font-semibold text-[#6255CF] font-mono">
                          {durMs}ms ({durVal.toFixed(2)}s)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Join Point Connector (Mối nối âm học) HOẶC Khối Dấu câu ngắt nghỉ */}
                  {idx < validWords.length - 1 && (
                    join?.punctuation ? (
                      /* Khối Dấu câu ngắt nghỉ nổi bật trên Timeline */
                      <div className="flex flex-col items-center justify-center px-1.5 py-1">
                        <div className="flex items-center gap-1">
                          <span className="h-[2px] w-2.5 bg-[#6255CF]/30" />
                          <div
                            className="px-3 py-2 rounded-xl border-2 border-indigo-300 bg-gradient-to-b from-[#F5F3FF] via-[#EEF2FF] to-[#EDE9FE] shadow-sm flex flex-col items-center min-w-[118px] select-none"
                            title={`${join.pauseLabel || 'Dấu câu'} "${join.punctuation}": Ngắt nghỉ ${join.gapMs || 0}ms từ ${join.pauseStartSec?.toFixed(2)}s đến ${join.pauseEndSec?.toFixed(2)}s`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[15px] font-extrabold text-[#6255CF] font-mono leading-none bg-white px-2 py-0.5 rounded shadow-2xs border border-indigo-200">
                                {join.punctuation}
                              </span>
                              <span className="text-[10px] font-bold text-indigo-950 bg-white/90 px-1.5 py-0.5 rounded border border-indigo-200">
                                {join.pauseLabel || 'Dấu câu'}
                              </span>
                            </div>
                            <div className="text-[11px] text-indigo-800 font-mono font-bold flex items-center gap-1">
                              <span>⏸️</span>
                              <span>Nghỉ {join.gapMs}ms</span>
                            </div>
                            <div className="text-[9px] text-[#6366F1] font-mono mt-0.5 font-medium">
                              {join.pauseStartSec !== undefined && join.pauseEndSec !== undefined
                                ? `${join.pauseStartSec.toFixed(2)}s ➔ ${join.pauseEndSec.toFixed(2)}s`
                                : `${join.gapMs || 0}ms`}
                            </div>
                          </div>
                          <span className="h-[2px] w-2.5 bg-[#6255CF]/30" />
                        </div>
                        <span className="text-[8px] text-[#7C3AED] font-semibold mt-1">Ngắt câu theo thiết lập</span>
                      </div>
                    ) : (
                      /* Điểm nối mượt bình thường giữa 2 từ liên tiếp */
                      <div className="flex flex-col items-center justify-center px-1 py-1" title="Điểm nối thuật toán (DSP Crossfade 20ms)">
                        <div className="flex items-center gap-0.5 text-[#85879A]">
                          <span className="h-[2px] w-2 bg-[#D3D6E5]" />
                          <div
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-0.5 shadow-2xs ${join?.smooth
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            title={`Điểm nối giữa "${wordItem.token}" và "${validWords[idx + 1]?.token}": Chênh lệch năng lượng: ${join?.energyJumpDb || 0} dB, Lệch cao độ F0: ${join?.f0JumpSemitone !== null ? `${join?.f0JumpSemitone} st` : 'N/A'}`}
                          >
                            <span>⚡</span>
                            <span>Nối #{idx + 1}</span>
                          </div>
                          <span className="h-[2px] w-2 bg-[#D3D6E5]" />
                        </div>
                        <span className="text-[8px] text-[#9A9DB5] mt-0.5">20ms fade</span>
                      </div>
                    )
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Detailed Verification Table */}
        {isTableExpanded && (
          <div className="mt-4 pt-4 border-t border-[#EAEBF5]">
            <div className="text-xs font-semibold text-[#30324E] mb-2.5 flex items-center justify-between">
              <span>Bảng thông số kiểm tra chi tiết từng từ ghép:</span>
              <span className="text-[11px] font-normal text-[#6B6E87]">
                Tổng thời lượng: <strong>{result.durationSec.toFixed(2)}s</strong> (Hữu Thọ)
              </span>
            </div>

            <div className="border border-[#E2E4F0] rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F9FD] border-b border-[#E2E4F0] text-[#555870] font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="px-3.5 py-2">STT</th>
                      <th className="px-3.5 py-2">Từ vựng</th>
                      <th className="px-3.5 py-2">Mã VNI</th>
                      <th className="px-3.5 py-2">Thời điểm bắt đầu</th>
                      <th className="px-3.5 py-2">Thời lượng file gốc</th>
                      <th className="px-3.5 py-2">Nguồn lưu trữ</th>
                      <th className="px-3.5 py-2 text-center">Nghe file gốc</th>
                      <th className="px-3.5 py-2">Mối nối sau (Acoustic Join)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF0F8] text-[#30324E]">
                    {validWords.map((item, idx) => {
                      const join = result.joins && result.joins[idx];
                      const isPlayingThis = playingWordIdx === idx;
                      return (
                        <tr
                          key={`table-${item.token}-${idx}`}
                          className={`hover:bg-[#F9FAFE] transition ${isPlayingThis ? 'bg-purple-50/70' : ''
                            }`}
                        >
                          <td className="px-3.5 py-2 font-mono text-[#85879A]">#{idx + 1}</td>
                          <td className="px-3.5 py-2 font-bold text-[#1E2040]">"{item.token}"</td>
                          <td className="px-3.5 py-2 font-mono text-[#6255CF]">
                            {item.code || item.token}
                          </td>
                          <td className="px-3.5 py-2 font-mono text-[#555870]">
                            {typeof item.start === 'number' ? `${item.start.toFixed(2)}s` : '0.00s'}
                          </td>
                          <td className="px-3.5 py-2 font-mono text-[#555870]">
                            {typeof item.duration === 'number'
                              ? `${(item.duration * 1000).toFixed(0)} ms`
                              : '-'}
                          </td>
                          <td className="px-3.5 py-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <Database className="w-2.5 h-2.5" />
                              {item.source === 'record' ? 'Ghi âm IndexedDB' : 'Cloudinary (Atlas)'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            {item.blob ? (
                              <button
                                type="button"
                                onClick={() => handlePlaySingleWord(item, idx)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${isPlayingThis
                                  ? 'bg-[#6255CF] text-white'
                                  : 'bg-[#F2F1FC] hover:bg-[#6255CF] text-[#6255CF] hover:text-white'
                                  }`}
                                title={`Nghe riêng file âm thanh gốc của từ "${item.token}"`}
                              >
                                {isPlayingThis ? (
                                  <>
                                    <Pause className="w-3 h-3 fill-current" />
                                    <span>Đang phát</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>Phát solo</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="text-[#A0A3BD] text-[11px]">N/A</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2">
                            {join ? (
                              <div className="text-[11px] leading-tight space-y-0.5">
                                {join.punctuation ? (
                                  <div className="flex items-center gap-1.5 font-bold text-indigo-700">
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 border border-indigo-200 text-indigo-900 font-mono text-xs font-extrabold">
                                      {join.punctuation}
                                    </span>
                                    <span>{join.pauseLabel || 'Dấu câu'} (Nghỉ {join.gapMs}ms)</span>
                                  </div>
                                ) : (
                                  <span
                                    className={`font-semibold ${join.smooth ? 'text-emerald-600' : 'text-amber-600'
                                      }`}
                                  >
                                    {join.smooth ? '✓ Mượt mà' : '⚡ Độ lệch nhẹ'}
                                  </span>
                                )}
                                <div className="text-[10px] text-[#7E8299] font-mono">
                                  ΔE: {join.energyJumpDb} dB | ΔF0:{' '}
                                  {join.f0JumpSemitone !== null
                                    ? `${join.f0JumpSemitone} st`
                                    : 'Vô thanh'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#9EA1B7] italic">(Từ kết thúc câu)</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

