import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  Volume2,
  Volume,
  VolumeX,
  X,
} from 'lucide-react';

export interface PlayerTrack {
  id?: string;
  text: string;
  speaker: 'Hữu Thọ' | string;
  durationSec: number;
  audioBlob?: Blob;
  audioUrl?: string;
  filename?: string;
}

interface BottomAudioPlayerProps {
  track: PlayerTrack | null;
  isOpen: boolean;
  isPlayingProp?: boolean;
  playTrigger?: number;
  onClose: () => void;
  onDownload?: (track: PlayerTrack) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  onRequestAudio?: (track: PlayerTrack) => void;
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
  isPlayingProp,
  playTrigger = 0,
  onClose,
  onDownload,
  onPlaybackStateChange,
  onRequestAudio,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100); // 0 to 100
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const currentTrackKeyRef = useRef<string | null>(null);
  const lastPlayTriggerRef = useRef<number>(0);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);

  // Đóng popover âm lượng khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        volumeContainerRef.current &&
        !volumeContainerRef.current.contains(e.target as Node)
      ) {
        setIsVolumeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Khởi tạo hoặc cập nhật audio khi track thay đổi
  useEffect(() => {
    if (!track) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      setIsPlaying(false);
      onPlaybackStateChange?.(false);
      return;
    }

    const trackKey = `${track.id || ''}_${track.text}_${track.speaker}_${track.audioBlob ? 'blob' : 'noblob'}`;
    const shouldRecreate = currentTrackKeyRef.current !== trackKey || !activeAudioRef.current;

    if (shouldRecreate) {
      currentTrackKeyRef.current = trackKey;

      // Dừng audio cũ nếu đang phát
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = '';
      }
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }

      let url = '';
      if (track.audioBlob) {
        url = URL.createObjectURL(track.audioBlob);
        activeBlobUrlRef.current = url;
      } else if (track.audioUrl) {
        url = track.audioUrl;
      }

      if (!url) {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(track.durationSec > 0 ? track.durationSec : 1);
        onPlaybackStateChange?.(false);
        return;
      }

      const audio = new Audio(url);
      activeAudioRef.current = audio;
      audio.volume = isMuted ? 0 : volume / 100;
      setCurrentTime(0);
      setDuration(track.durationSec > 0 ? track.durationSec : 1);

      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
          setDuration(audio.duration);
        }
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        onPlaybackStateChange?.(false);
      };

      audio.onerror = (e) => {
        console.error('Lỗi phát âm thanh:', e);
        setIsPlaying(false);
        onPlaybackStateChange?.(false);
      };

      // Nếu có yêu cầu play (playTrigger mới hơn) hoặc isPlayingProp = true
      if (playTrigger > 0 && playTrigger !== lastPlayTriggerRef.current) {
        lastPlayTriggerRef.current = playTrigger;
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
            onPlaybackStateChange?.(true);
          })
          .catch((err) => {
            console.warn('Tự động phát bị chặn hoặc lỗi:', err);
            setIsPlaying(false);
            onPlaybackStateChange?.(false);
          });
      }
    }
  }, [track, playTrigger]);

  // Phản hồi khi playTrigger thay đổi (người dùng bấm Play trên hàng hoặc nút Tạo audio)
  useEffect(() => {
    if (playTrigger <= 0 || playTrigger === lastPlayTriggerRef.current) return;
    lastPlayTriggerRef.current = playTrigger;

    const audio = activeAudioRef.current;
    if (audio && audio.src) {
      if (audio.ended || audio.currentTime >= audio.duration) {
        audio.currentTime = 0;
      }
      audio.volume = isMuted ? 0 : volume / 100;
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          onPlaybackStateChange?.(true);
        })
        .catch((err) => {
          console.warn('Playback bị chặn:', err);
          setIsPlaying(false);
          onPlaybackStateChange?.(false);
        });
    } else if (track && onRequestAudio) {
      onRequestAudio(track);
    }
  }, [playTrigger, track, isMuted, volume]);

  // Đồng bộ dừng khi parent set isPlayingProp = false
  useEffect(() => {
    if (isPlayingProp === undefined) return;
    if (!isPlayingProp && isPlaying && activeAudioRef.current) {
      activeAudioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isPlayingProp]);

  // Điều khiển Play / Pause trực tiếp từ nút tròn ở BottomPlayer
  const handleTogglePlay = () => {
    const audio = activeAudioRef.current;
    if (!audio || !audio.src) {
      if (track && onRequestAudio) {
        onRequestAudio(track);
      }
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      onPlaybackStateChange?.(false);
    } else {
      if (audio.ended || audio.currentTime >= audio.duration) {
        audio.currentTime = 0;
      }
      audio.volume = isMuted ? 0 : volume / 100;
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          onPlaybackStateChange?.(true);
        })
        .catch((err) => {
          console.error('Lỗi khi phát lại audio:', err);
          setIsPlaying(false);
          onPlaybackStateChange?.(false);
        });
    }
  };

  // Skip back 5 giây
  const handleSkipBack = () => {
    const audio = activeAudioRef.current;
    if (audio) {
      audio.currentTime = Math.max(0, audio.currentTime - 5);
      setCurrentTime(audio.currentTime);
    } else {
      setCurrentTime((prev) => Math.max(0, prev - 5));
    }
  };

  // Skip forward 5 giây
  const handleSkipForward = () => {
    const audio = activeAudioRef.current;
    if (audio) {
      audio.currentTime = Math.min(duration, audio.currentTime + 5);
      setCurrentTime(audio.currentTime);
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
    if (activeAudioRef.current) {
      activeAudioRef.current.currentTime = newTime;
    }
  };

  // Bật / tắt tiếng (Mute)
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (activeAudioRef.current) {
      activeAudioRef.current.muted = nextMuted;
    }
  };

  // Điều chỉnh tăng / giảm âm lượng trực tiếp
  const handleVolumeChange = (newVal: number) => {
    const clamped = Math.max(0, Math.min(100, newVal));
    setVolume(clamped);
    if (activeAudioRef.current) {
      activeAudioRef.current.volume = clamped / 100;
      if (clamped > 0 && isMuted) {
        activeAudioRef.current.muted = false;
        setIsMuted(false);
      }
    }
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  // Xử lý kéo trượt âm lượng theo trục dọc
  const calculateVolumeFromEvent = (clientY: number) => {
    if (!volumeBarRef.current) return;
    const rect = volumeBarRef.current.getBoundingClientRect();
    const offsetY = rect.bottom - clientY;
    const ratio = Math.max(0, Math.min(1, offsetY / rect.height));
    const newVol = Math.round(ratio * 100);
    handleVolumeChange(newVol);
  };

  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    setIsDraggingVolume(true);
    calculateVolumeFromEvent(e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingVolume) {
        calculateVolumeFromEvent(e.clientY);
      }
    };
    const handleMouseUp = () => {
      if (isDraggingVolume) {
        setIsDraggingVolume(false);
      }
    };
    if (isDraggingVolume) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVolume]);

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

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="fixed bottom-0 left-0 md:left-[240px] right-0 z-40 bg-white border-t border-[#E8E8F0] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-2.5 flex items-center justify-between min-h-[68px] select-none">
      {/* 1. Bên trái: Tên bản ghi + Giọng đọc Hữu Thọ */}
      <div className="flex items-center gap-3 min-w-0 max-w-[240px] sm:max-w-[300px] md:max-w-[340px] shrink-0">
        <div className="min-w-0 flex-1">
          <div
            className="font-bold text-xs md:text-sm text-[#20213A] truncate leading-tight"
            title={track.text}
          >
            {track.text}
          </div>
          <div className="text-[11px] text-[#85879A] mt-0.5 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5578D8]" />
            <span>Hữu Thọ</span>
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
            className="w-9 h-9 rounded-full bg-[#1E2040] hover:bg-[#6255CF] text-white flex items-center justify-center shadow-sm transition active:scale-95 cursor-pointer"
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

      {/* 3. Bên phải: Nút Tải về + Nút tăng giảm âm lượng kiểu popup capsule dọc + Đóng player */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Nút tải về */}
        <button
          onClick={handleDownload}
          className="p-1.5 text-[#1E2040] hover:text-[#6255CF] transition rounded-lg hover:bg-gray-50"
          title="Tải về file WAV"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Cụm nút tăng giảm âm lượng dọc dạng capsule theo chuẩn hình ảnh */}
        <div className="relative" ref={volumeContainerRef}>
          <button
            type="button"
            onClick={() => setIsVolumeOpen(!isVolumeOpen)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
              isVolumeOpen
                ? 'bg-[#ECEEF8] text-[#1E2040] ring-2 ring-[#ECEEF8]'
                : 'text-[#1E2040] hover:bg-[#ECEEF8]'
            }`}
            title="Điều chỉnh âm lượng"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-500" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Capsule dọc nổi lên trên theo mẫu hình ảnh */}
          {isVolumeOpen && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-10 h-44 bg-white rounded-full shadow-xl border border-[#E8E8F0] flex flex-col items-center justify-between py-3 px-1 z-50 select-none animate-in fade-in zoom-in-95 duration-150">
              {/* Top: Icon loa to */}
              <button
                type="button"
                onClick={() => handleVolumeChange(100)}
                className="text-[#1E2040] hover:text-[#6255CF] transition p-1"
                title="Âm lượng 100%"
              >
                <Volume2 className="w-4 h-4" />
              </button>

              {/* Middle: Thanh trượt dọc màu vàng */}
              <div
                ref={volumeBarRef}
                onMouseDown={handleVolumeMouseDown}
                className="relative w-1.5 flex-1 my-2 bg-[#F0F2F9] rounded-full cursor-pointer flex flex-col justify-end items-center"
                title={`Âm lượng: ${isMuted ? 0 : volume}%`}
              >
                {/* Đường tiến trình màu vàng */}
                <div
                  className="w-full bg-[#EAB308] rounded-full"
                  style={{ height: `${isMuted ? 0 : volume}%` }}
                />
                {/* Nút tròn viền vàng nền trắng */}
                <div
                  className="absolute w-3.5 h-3.5 bg-white border-2 border-[#EAB308] rounded-full shadow-xs -mb-1.5 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                  style={{ bottom: `${isMuted ? 0 : volume}%` }}
                />
              </div>

              {/* Bottom: Icon loa nhỏ */}
              <button
                type="button"
                onClick={handleToggleMute}
                className="text-[#1E2040] hover:text-[#6255CF] transition p-1"
                title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
              >
                <Volume className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Nút tắt player bar */}
        <button
          onClick={onClose}
          className="p-1.5 text-[#1E2040] hover:text-red-500 transition rounded-lg hover:bg-gray-50"
          title="Đóng thanh phát âm thanh"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
