import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Download, Volume2, Volume1, VolumeX, X } from 'lucide-react';

export interface PlayerTrack {
  id?: string;
  text: string;
  speaker: 'Nam' | 'Nữ';
  durationSec: number;
  audioBlob?: Blob;
  audioUrl?: string;
  filename?: string;
}

interface BottomAudioPlayerProps {
  track: PlayerTrack | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (track: PlayerTrack) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const BottomAudioPlayer: React.FC<BottomAudioPlayerProps> = ({
  track,
  isOpen,
  onClose,
  onDownload,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100); // 0 to 100
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Khởi tạo audio element hoặc cập nhật URL khi track thay đổi
  useEffect(() => {
    if (!track) return;

    let objectUrl = '';
    if (track.audioBlob) {
      objectUrl = URL.createObjectURL(track.audioBlob);
    } else if (track.audioUrl) {
      objectUrl = track.audioUrl;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;
    if (objectUrl) {
      audio.src = objectUrl;
    } else {
      audio.src = '';
    }

    audio.currentTime = 0;
    audio.volume = isMuted ? 0 : volume / 100;
    setCurrentTime(0);
    setDuration(track.durationSec > 0 ? track.durationSec : 1);

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(audio.duration);
      } else {
        setDuration(track.durationSec > 0 ? track.durationSec : 1);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    if (objectUrl) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      if (track.audioBlob && objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [track]);

  // Điều khiển Play / Pause
  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (audio.src) {
        audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      } else {
        // Fallback simulation nếu không có file thật
        setIsPlaying(true);
        const interval = setInterval(() => {
          setCurrentTime((prev) => {
            if (prev >= duration) {
              clearInterval(interval);
              setIsPlaying(false);
              return 0;
            }
            return prev + 0.1;
          });
        }, 100);
      }
    }
  };

  // Skip back 5 giây
  const handleSkipBack = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
      setCurrentTime(audioRef.current.currentTime);
    } else {
      setCurrentTime((prev) => Math.max(0, prev - 5));
    }
  };

  // Skip forward 5 giây
  const handleSkipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5);
      setCurrentTime(audioRef.current.currentTime);
    } else {
      setCurrentTime((prev) => Math.min(duration, prev + 5));
    }
  };

  // Tua audio trên thanh progress bar
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * duration;
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Bật / tắt tiếng (Mute)
  const handleToggleMute = () => {
    if (audioRef.current) {
      const nextMuted = !isMuted;
      audioRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    } else {
      setIsMuted(!isMuted);
    }
  };

  // Điều chỉnh tăng / giảm âm lượng trực tiếp
  const handleVolumeChange = (newVal: number) => {
    const clamped = Math.max(0, Math.min(100, newVal));
    setVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped / 100;
      if (clamped > 0 && isMuted) {
        audioRef.current.muted = false;
        setIsMuted(false);
      }
    }
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  // Tải file âm thanh
  const handleDownload = () => {
    if (!track) return;
    if (onDownload) {
      onDownload(track);
      return;
    }
    if (track.audioBlob) {
      const url = URL.createObjectURL(track.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = track.filename || 'vietvoice_audio.wav';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (!isOpen || !track) return null;

  const isFemale = track.speaker === 'Nữ';
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="fixed bottom-0 left-0 md:left-[240px] right-0 z-40 bg-white border-t border-[#E8E8F0] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-2.5 flex items-center justify-between min-h-[68px] select-none">
      {/* 1. Bên trái: Tên bản ghi + Giọng (Nam / Nữ) */}
      <div className="flex items-center gap-3 min-w-0 max-w-[240px] sm:max-w-[300px] md:max-w-[340px] shrink-0">
        <div className="min-w-0 flex-1">
          <div
            className="font-bold text-xs md:text-sm text-[#20213A] truncate leading-tight"
            title={track.text}
          >
            {track.text}
          </div>
          <div className="text-[11px] text-[#85879A] mt-0.5 font-medium flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isFemale ? 'bg-[#B16BC1]' : 'bg-[#5578D8]'
              }`}
            />
            <span>{isFemale ? 'Nữ' : 'Nam'}</span>
          </div>
        </div>
      </div>

      {/* 2. Ở giữa: Bộ điều khiển Play/Pause + Tua + Thanh tiến trình thời gian */}
      <div className="flex-1 max-w-xl mx-3 sm:mx-6 flex flex-col items-center justify-center">
        {/* Hàng nút điều khiển */}
        <div className="flex items-center gap-4 mb-1">
          {/* Nút lùi 5s */}
          <button
            onClick={handleSkipBack}
            className="p-1 text-[#85879A] hover:text-[#20213A] transition"
            title="Lùi 5 giây"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Nút Play / Pause tròn màu tím/xanh than */}
          <button
            onClick={handleTogglePlay}
            className="w-9 h-9 rounded-full bg-[#1E2040] hover:bg-[#6255CF] text-white flex items-center justify-center shadow-sm transition active:scale-95"
            title={isPlaying ? 'Tạm dừng' : 'Phát'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </button>

          {/* Nút tiến 5s */}
          <button
            onClick={handleSkipForward}
            className="p-1 text-[#85879A] hover:text-[#20213A] transition"
            title="Tiến 5 giây"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hàng thanh thời gian & slider */}
        <div className="w-full flex items-center gap-2.5">
          <span className="text-[11px] font-mono text-[#85879A] w-9 text-right">
            {formatTime(currentTime)}
          </span>

          <div
            ref={progressBarRef}
            onClick={handleSeek}
            className="relative flex-1 h-1 bg-[#E8E8F0] hover:h-1.5 rounded-full cursor-pointer flex items-center group transition-all"
          >
            <div
              className="h-full bg-[#6255CF] rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Vòng tròn slider thumb màu vàng viền trắng */}
            <div
              className="absolute w-3 h-3 bg-white border-2 border-[#EAB308] rounded-full shadow-xs -ml-1.5 transition-transform group-hover:scale-125"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          <span className="text-[11px] font-mono text-[#85879A] w-9 text-left">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 3. Bên phải: Nút Tải về + Nút tăng giảm âm lượng + Đóng player */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
        {/* Nút tải về */}
        <button
          onClick={handleDownload}
          className="p-1.5 text-[#555870] hover:text-[#6255CF] transition rounded-lg hover:bg-gray-50"
          title="Tải về file WAV"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Cụm nút tăng giảm âm lượng */}
        <div className="flex items-center gap-1.5 bg-[#FAFBFD] px-2 py-1 rounded-xl border border-[#E8E8F0]">
          <button
            type="button"
            onClick={handleToggleMute}
            className="p-1 text-[#555870] hover:text-[#6255CF] transition"
            title={isMuted ? 'Bật âm thanh' : `Âm lượng: ${volume}% (Nhấp để tắt tiếng)`}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
            ) : volume < 50 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-16 sm:w-20 h-1.5 bg-[#E2E4F0] rounded-lg appearance-none cursor-pointer accent-[#6255CF]"
            title={`Điều chỉnh âm lượng: ${isMuted ? 0 : volume}%`}
          />
        </div>

        {/* Nút tắt player bar */}
        <button
          onClick={onClose}
          className="p-1.5 text-[#85879A] hover:text-red-500 transition rounded-lg hover:bg-gray-50 ml-1"
          title="Đóng thanh phát âm thanh"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
