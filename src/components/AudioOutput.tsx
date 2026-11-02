import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Download, Volume2, Music, CheckCircle2, AlertTriangle, FileAudio } from 'lucide-react';
import type { SynthResult } from '../lib/types';
import { playSamples, stopPlayback, SR } from '../lib/dsp';

interface AudioOutputProps {
  result: SynthResult | null;
  selectedVoice: 'Nam 01' | 'Nữ 01';
  onDownload: () => void;
  isLoading?: boolean;
}

export const AudioOutput: React.FC<AudioOutputProps> = ({
  result,
  selectedVoice,
  onDownload,
  isLoading,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const animFrame = useRef<number | null>(null);
  const startTime = useRef<number>(0);

  useEffect(() => {
    // Reset khi có result mới
    setIsPlaying(false);
    setProgress(0);
    stopPlayback();
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
  }, [result]);

  const handleTogglePlay = () => {
    if (!result) return;

    if (isPlaying) {
      stopPlayback();
      setIsPlaying(false);
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    } else {
      setIsPlaying(true);
      startTime.current = performance.now() - progress * result.durationSec * 1000;

      const durationMs = result.durationSec * 1000;
      const updateProg = () => {
        const elapsed = performance.now() - startTime.current;
        const currentRatio = Math.min(1, elapsed / durationMs);
        setProgress(currentRatio);
        if (currentRatio < 1) {
          animFrame.current = requestAnimationFrame(updateProg);
        } else {
          setIsPlaying(false);
          setProgress(0);
        }
      };

      playSamples(result.samples, result.sampleRate, () => {
        setIsPlaying(false);
        setProgress(0);
        if (animFrame.current) cancelAnimationFrame(animFrame.current);
      });

      animFrame.current = requestAnimationFrame(updateProg);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8F0] shadow-sm p-6 mt-6 transition-all">
      <div className="flex items-center justify-between pb-4 border-b border-[#F0F2F9] mb-5">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-[#6255CF]" />
          <h2 className="text-base font-bold text-[#20213A]">Kết quả âm thanh</h2>
        </div>

        {result && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tổng hợp thành công
            </span>
            <span className="text-[#85879A]">({result.elapsedMs.toFixed(0)} ms)</span>
          </div>
        )}
      </div>

      {!result ? (
        /* Empty State */
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F4F5FB] border border-[#E8E8F0] flex items-center justify-center text-[#9CA1B7] mb-3">
            <Volume2 className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-semibold text-[#20213A]">Chưa có âm thanh</h3>
          <p className="text-xs text-[#85879A] mt-1 max-w-sm">
            Nhập văn bản tiếng Việt và chọn giọng đọc để VietVoice bắt đầu chuyển đổi thành giọng nói tự nhiên từ ngữ liệu thu âm.
          </p>
        </div>
      ) : (
        /* Active Audio Player */
        <div className="space-y-5">
          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs p-3.5 rounded-xl bg-[#F8F9FD] border border-[#EAEBF5]">
            <div className="flex items-center gap-2">
              <FileAudio className="w-4 h-4 text-[#6255CF]" />
              <span className="font-semibold text-[#20213A] truncate max-w-xs">
                "{result.text}"
              </span>
            </div>

            <div className="flex items-center gap-4 text-[#555870]">
              <span>
                Giọng đọc: <strong className="text-[#20213A]">{selectedVoice}</strong>
              </span>
              <span>•</span>
              <span>
                Thời lượng: <strong className="text-[#20213A]">{result.durationSec.toFixed(2)}s</strong>
              </span>
              <span>•</span>
              <span>Định dạng: <strong>WAV Lossless</strong></span>
            </div>
          </div>

          {/* Interactive Waveform / Progress Display */}
          <div className="bg-[#FAFBFD] border border-[#E8E8F0] rounded-xl p-5">
            <div className="h-16 flex items-center gap-1 justify-center px-4 relative overflow-hidden">
              {/* Simulated bars based on samples */}
              {Array.from({ length: 48 }).map((_, i) => {
                const sampleIdx = Math.floor((i / 48) * result.samples.length);
                const val = Math.abs(result.samples[sampleIdx] || 0.1);
                const heightPercent = Math.max(15, Math.min(100, Math.round(val * 180 + 20)));
                const isPassed = (i / 48) <= progress;

                return (
                  <div
                    key={i}
                    style={{ height: `${heightPercent}%` }}
                    className={`w-1.5 rounded-full transition-all duration-75 ${
                      isPassed ? 'bg-[#6255CF]' : 'bg-[#D6D8E8]'
                    }`}
                  />
                );
              })}
            </div>

            {/* Scrubber track */}
            <div className="mt-3 flex items-center justify-between text-xs text-[#85879A] font-mono">
              <span>{formatTime(progress * result.durationSec)}</span>
              <div className="flex-1 mx-3 h-1.5 bg-[#EAEBF4] rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-[#6255CF] rounded-full transition-all duration-75"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <span>{formatTime(result.durationSec)}</span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTogglePlay}
                className="w-12 h-12 rounded-xl bg-[#6255CF] hover:bg-[#5144BD] text-white flex items-center justify-center shadow-md shadow-[#6255CF]/20 transition active:scale-95"
                title={isPlaying ? 'Tạm dừng' : 'Phát âm thanh'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <div>
                <p className="text-xs font-bold text-[#20213A]">
                  {isPlaying ? 'Đang phát âm thanh...' : 'Sẵn sàng phát'}
                </p>
                <p className="text-[11px] text-[#85879A]">VietVoice Concatenative Engine • 22.05 kHz</p>
              </div>
            </div>

            <button
              onClick={onDownload}
              className="px-4 py-2.5 rounded-xl border border-[#E8E8F0] hover:border-[#6255CF] hover:bg-[#F7F8FC] text-xs font-semibold text-[#20213A] flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-[#6255CF]" />
              <span>Tải file .WAV</span>
            </button>
          </div>

          {/* Trace Words Detail */}
          <div className="pt-3 border-t border-[#F0F2F9] text-xs">
            <div className="text-[#85879A] mb-2 font-medium">Chi tiết ghép nối từ:</div>
            <div className="flex flex-wrap gap-2">
              {result.trace.map((item, idx) => (
                <div
                  key={idx}
                  className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 ${
                    item.status === 'ok'
                      ? 'bg-white border-[#E2E4F0] text-[#20213A]'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <span className="font-semibold">{item.token}</span>
                  {item.duration && (
                    <span className="text-[10px] text-[#85879A]">
                      ({(item.duration * 1000).toFixed(0)}ms)
                    </span>
                  )}
                  {item.status === 'oov' && (
                    <span className="text-[10px] text-amber-600 font-bold">OOV</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

