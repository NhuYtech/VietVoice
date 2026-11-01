import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Settings,
  ChevronDown,
  Sparkles,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  Sliders,
  Check,
  RotateCcw,
  Headphones,
  Download,
  Database,
  Activity,
  Workflow,
  BarChart3,
  Mic,
  Loader2
} from 'lucide-react';
import type { CorpusEntry, SynthResult } from './lib/types';
import { getAllEntries } from './lib/store';
import { loadManifest, normalizeText, synthesize } from './lib/tts';
import logo from './assets/images/logo.png';
import PipelinePanel from './components/PipelinePanel';
import FeaturesPanel from './components/FeaturesPanel';
import CorpusPanel from './components/CorpusPanel';
import EvalPanel from './components/EvalPanel';

interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  tags: string[];
  tone: string;
  avatarBg: string;
  accentColor: string;
  sampleText: string;
  style: 'nu' | 'nam';
}

const AVATARS = [
  { avatarBg: 'from-pink-500 via-rose-500 to-indigo-600', accentColor: '#ec4899', style: 'nu' as const },
  { avatarBg: 'from-blue-600 via-cyan-500 to-indigo-800', accentColor: '#06b6d4', style: 'nam' as const }
];

// Hiển thị khi chưa có ngữ liệu; khi có ngữ liệu, danh sách giọng lấy từ người thu âm thực tế.
const DEFAULT_VOICES: VoiceOption[] = [
  {
    id: 'nu',
    name: 'Giọng Nữ',
    gender: 'Nữ',
    tags: [],
    tone: 'Chưa có ngữ liệu',
    sampleText: '',
    ...AVATARS[0]
  },
  {
    id: 'nam',
    name: 'Giọng Nam',
    gender: 'Nam',
    tags: [],
    tone: 'Chưa có ngữ liệu',
    sampleText: '',
    ...AVATARS[1]
  }
];

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

const SETTINGS_TABS = [
  { id: 'params', label: 'Tham số ghép nối', icon: Sliders },
  { id: 'corpus', label: 'Thu âm', icon: Mic },
  { id: 'features', label: 'Đặc trưng âm thanh', icon: Activity },
  { id: 'eval', label: 'Đánh giá kết quả', icon: BarChart3 },
  { id: 'pipeline', label: 'Sơ đồ & Quy trình', icon: Workflow }
] as const;
type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

const DEFAULT_BARS = [
  22, 38, 55, 78, 92, 45, 68, 88, 100, 60, 35, 70, 85, 95, 50, 30, 65, 82,
  90, 75, 40, 60, 95, 80, 52, 38, 72, 86, 64, 42, 58, 74, 90, 65, 38, 24
];

export default function App() {
  // Corpus (ngữ liệu thu âm thật) & kết quả tổng hợp
  const [entries, setEntries] = useState<CorpusEntry[]>([]);
  const [lastResult, setLastResult] = useState<SynthResult | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>('params');
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Input & Selection State
  const [text, setText] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('nu');
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Audio Playback & Generation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTimeState] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speedIndex, setSpeedIndex] = useState<number>(1); // 1.0x

  // Concatenation settings
  const [gapMs, setGapMs] = useState<number>(120);
  const [crossfadeMs, setCrossfadeMs] = useState<number>(20);
  const [trim, setTrim] = useState<boolean>(true);
  const [normalize, setNormalize] = useState<boolean>(true);
  const [fallbackSpeaker, setFallbackSpeaker] = useState<boolean>(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string>('');

  const refreshEntries = useCallback(async () => {
    setEntries(await getAllEntries());
  }, []);

  // Nạp ngữ liệu từ IndexedDB + public/corpus/manifest.json (nếu có)
  useEffect(() => {
    (async () => {
      const existing = await getAllEntries();
      setEntries(existing);
      const added = await loadManifest(new Set(existing.map((e) => e.id)));
      if (added.length) await refreshEntries();
    })();
  }, [refreshEntries]);

  const voices: VoiceOption[] = useMemo(() => {
    const speakers = [...new Set(entries.map((e) => e.speaker))].sort();
    if (!speakers.length) return DEFAULT_VOICES;
    return speakers.map((s, i) => {
      const own = entries.filter((e) => e.speaker === s);
      return {
        id: s,
        name: `Giọng ${s}`,
        gender: `${own.length} từ`,
        tags: [],
        tone: 'Giọng thu âm thật',
        sampleText: own.slice(0, 3).map((e) => e.word).join(' '),
        ...AVATARS[i % 2]
      };
    });
  }, [entries]);

  useEffect(() => {
    if (!voices.some((v) => v.id === selectedVoiceId)) setSelectedVoiceId(voices[0].id);
  }, [voices, selectedVoiceId]);

  const selectedVoice = useMemo(() => {
    return voices.find(v => v.id === selectedVoiceId) || voices[0];
  }, [voices, selectedVoiceId]);

  // Danh sách từ có sẵn cho giọng đang chọn (để gợi ý/bấm chọn nhanh trên UI chính)
  const availableWords = useMemo(() => {
    const own = entries.filter((e) => e.speaker === selectedVoiceId).map((e) => e.word);
    const all = own.length ? own : entries.map((e) => e.word);
    return [...new Set(all)].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [entries, selectedVoiceId]);

  // Kiểm tra trực tiếp từ nhập vào có nằm trong dataset không (chỉ cảnh báo khi không có)
  const datasetWarning = useMemo(() => {
    const normalized = normalizeText(text);
    if (!normalized) return '';
    if (!entries.length) {
      return 'Từ này không nằm trong dataset.';
    }
    const validWords = new Set<string>();
    let maxN = 1;
    for (const e of entries) {
      if (fallbackSpeaker || e.speaker === selectedVoiceId) {
        validWords.add(e.word);
        maxN = Math.max(maxN, e.word.split(' ').length);
      }
    }
    const tokens = normalized.split(' ').filter(Boolean);
    const missing: string[] = [];
    for (let i = 0; i < tokens.length;) {
      let matched = false;
      for (let n = Math.min(maxN, tokens.length - i); n >= 1; n--) {
        const candidate = tokens.slice(i, i + n).join(' ');
        if (validWords.has(candidate)) {
          i += n;
          matched = true;
          break;
        }
      }
      if (!matched) {
        missing.push(tokens[i]);
        i++;
      }
    }
    return missing.length
      ? `Từ không nằm trong dataset: "${missing.join(', ')}"`
      : '';
  }, [text, entries, selectedVoiceId, fallbackSpeaker]);

  // Waveform bars lấy từ tín hiệu tổng hợp thật (36 cột, biên độ đỉnh)
  const waveformBars = useMemo(() => {
    if (!lastResult) return DEFAULT_BARS;
    const x = lastResult.samples;
    const n = DEFAULT_BARS.length;
    const size = Math.max(1, Math.floor(x.length / n));
    const peaks = Array.from({ length: n }, (_, b) => {
      let m = 0;
      for (let i = b * size; i < Math.min(x.length, (b + 1) * size); i++) m = Math.max(m, Math.abs(x[i]));
      return m;
    });
    const max = Math.max(...peaks) || 1;
    return peaks.map((p) => Math.max(8, Math.round((p / max) * 100)));
  }, [lastResult]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const setCurrentTime = (t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTimeState(t);
  };

  // Audio element thật phát file WAV đã tổng hợp
  useEffect(() => {
    const a = new Audio();
    a.onended = () => {
      setIsPlaying(false);
      setCurrentTimeState(0);
    };
    audioRef.current = a;
    return () => {
      a.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = isMuted ? 0 : volume / 100;
    a.playbackRate = SPEED_OPTIONS[speedIndex];
  }, [volume, isMuted, speedIndex, lastResult]);

  // Cập nhật thanh tiến trình theo thời gian phát thật
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      if (audioRef.current) setCurrentTimeState(audioRef.current.currentTime);
    }, 50);
    return () => clearInterval(id);
  }, [isPlaying]);

  // Handle Generate: tổng hợp ghép nối từ các file thu âm
  const handleGenerate = async () => {
    if (isGenerating) return;
    const input = text.trim();
    if (!input) {
      setStatusMsg('Hãy nhập một từ hoặc chuỗi từ thuộc danh sách ngữ liệu.');
      return;
    }
    if (!entries.length) {
      setStatusMsg('Chưa có ngữ liệu. Bấm biểu tượng Cài đặt (⚙️) → "Thu âm" để thu âm từ vựng.');
      return;
    }
    setIsGenerating(true);
    setStatusMsg('');
    audioRef.current?.pause();
    setIsPlaying(false);
    try {
      const result = await synthesize(input, entries, {
        speaker: selectedVoiceId,
        gapMs,
        crossfadeMs,
        trim,
        normalize,
        fallbackSpeaker
      });
      const oov = result.trace.filter((t) => t.status === 'oov').map((t) => t.token);
      if (result.trace.every((t) => t.status === 'oov')) {
        setStatusMsg(`Không có từ nào thuộc danh sách ngữ liệu: ${oov.join(', ')}`);
        return;
      }
      if (oov.length) setStatusMsg(`Bỏ qua từ ngoài danh sách: ${oov.join(', ')}`);
      setLastResult(result);
      setDuration(result.durationSec);
      setCurrentTimeState(0);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(result.wav);
      const a = audioRef.current!;
      a.src = urlRef.current;
      a.playbackRate = SPEED_OPTIONS[speedIndex];
      a.volume = isMuted ? 0 : volume / 100;
      await a.play();
      setIsPlaying(true);
    } catch (e) {
      setStatusMsg(`Lỗi tổng hợp: ${String(e)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Play/Pause: tự động tạo âm thanh nếu chưa có hoặc văn bản thay đổi
  const handleTogglePlay = () => {
    if (isGenerating) return;
    const a = audioRef.current;
    const isSameTextAndVoice =
      lastResult &&
      lastResult.text.trim() === text.trim() &&
      lastResult.speaker === selectedVoiceId;

    if (!isSameTextAndVoice || !a) {
      handleGenerate();
      return;
    }
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
    } else {
      a.play();
      setIsPlaying(true);
    }
  };

  // Export: tải file WAV đã tổng hợp
  const handleExport = () => {
    if (!lastResult) {
      setStatusMsg('Chưa có âm thanh để xuất. Hãy bấm nút Play để phát trước.');
      return;
    }
    const link = document.createElement('a');
    link.href = urlRef.current;
    link.download = `vietvoice_${lastResult.speaker}_${lastResult.text.slice(0, 20).replace(/\s+/g, '_')}.wav`;
    link.click();
  };

  // Skip Back 5 seconds
  const handleSkipBack = () => {
    setCurrentTime(Math.max(0, currentTime - 5));
  };

  // Skip Forward 5 seconds
  const handleSkipForward = () => {
    setCurrentTime(Math.min(duration, currentTime + 5));
  };

  // Handle Speed Cycle
  const handleCycleSpeed = () => {
    setSpeedIndex(prev => (prev + 1) % SPEED_OPTIONS.length);
  };

  // Scrubber / Waveform Seek
  const handleSeek = (newFraction: number) => {
    const target = Math.max(0, Math.min(duration, newFraction * duration));
    setCurrentTime(target);
  };

  const progressFraction = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-x-hidden bg-gradient-to-br from-[#5372ec] via-[#3a89e6] to-[#17a8db]">
      {/* Dynamic Background Ambient Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#60a5fa]/30 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2 animate-float-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-[420px] h-[420px] bg-[#06b6d4]/25 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3 animate-pulse-subtle" />
      <div className="absolute top-2/3 left-1/3 w-80 h-80 bg-[#38bdf8]/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />

      {/* Main Glassmorphic Dashboard Card (UI duy nhất) */}
      <div className="relative z-10 w-full max-w-2xl backdrop-blur-xl bg-white/[0.14] border border-white/25 rounded-3xl shadow-2xl p-6 sm:p-8 transition-all duration-300">

        {/* Header Card */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="VietVoice Logo"
              className="w-10 h-10 rounded-2xl object-cover shadow-lg shadow-indigo-500/25"
            />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              VietVoice
            </h1>
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Audio and Model Settings"
            title="Cài đặt, Ngữ liệu, Đặc trưng & Đánh giá"
            className="group relative bg-white/10 hover:bg-white/20 active:scale-95 transition-all duration-200 p-2.5 rounded-full border border-white/10 shadow-sm text-slate-900 hover:text-black"
          >
            <Settings className="w-5 h-5 transition-transform duration-300 group-hover:rotate-45" />
            <span className="sr-only">Settings</span>
          </button>
        </div>

        {/* Input & Voice Selection Section (2-Column Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">

          {/* Left Column: Language & Text Input */}
          <div className="flex flex-col gap-3">
            {/* Language Box (Mặc định Tiếng Việt) */}
            <div>
              <label className="block text-xs font-semibold text-slate-900 mb-1.5 ml-1">
                Language
              </label>
              <div className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-white backdrop-blur-md">
                <span className="truncate flex items-center gap-2">
                  <span>🇻🇳</span>
                  <span>Tiếng Việt</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  Mặc định
                </span>
              </div>
            </div>

            {/* Textarea Input with Character Counter */}
            <div className="relative flex flex-col flex-1">
              <label className="block text-xs font-semibold text-slate-900 mb-1.5 ml-1 flex items-center justify-between">
                <span>Prompt / Text</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSettingsTab('corpus');
                      setIsSettingsOpen(true);
                    }}
                    className="text-[11px] text-slate-900 hover:text-black underline font-medium transition"
                  >
                    + Thu âm ({entries.length})
                  </button>
                  {selectedVoice.sampleText && (
                    <button
                      onClick={() => setText(selectedVoice.sampleText)}
                      className="text-[11px] text-slate-900 hover:text-black underline font-medium transition"
                    >
                      Load Sample
                    </button>
                  )}
                </div>
              </label>
              <div className="relative flex-1">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 500))}
                  placeholder="Nhập một từ hoặc chuỗi từ thuộc danh sách..."
                  rows={4}
                  className="w-full h-full min-h-[115px] resize-none rounded-2xl bg-black/20 border border-white/10 p-3.5 text-sm text-white placeholder-slate-700/80 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all backdrop-blur-md"
                />
                {/* Character Counter */}
                <div className="absolute bottom-2.5 right-3 text-[11px] font-mono text-slate-900 pointer-events-none bg-white/40 px-2 py-0.5 rounded-full border border-white/20">
                  <span className={text.length >= 480 ? 'text-amber-700 font-bold' : 'text-slate-900 font-semibold'}>
                    {text.length}
                  </span>
                  <span className="text-slate-900">/500</span>
                </div>
              </div>
              {availableWords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 max-h-14 overflow-y-auto">
                  {availableWords.slice(0, 24).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setText((prev) => (prev ? `${prev.trimEnd()} ${w}` : w))}
                      className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 hover:bg-white/20 border border-white/10 text-slate-900 font-medium transition"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {(datasetWarning || statusMsg) && (
              <p className="text-[11px] text-amber-300 font-medium ml-1">
                ⚠️ {datasetWarning || statusMsg}
              </p>
            )}
          </div>

          {/* Right Column: Voice Dropdown & Voice Avatars */}
          <div className="flex flex-col gap-3 justify-between">
            {/* Voice Dropdown */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-900 mb-1.5 ml-1">
                Voice Type
              </label>
              <button
                type="button"
                onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-white transition-all backdrop-blur-md"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedVoice.accentColor }} />
                  <span className="font-semibold">{selectedVoice.name}</span>
                  <span className="text-xs text-slate-900 font-medium">({selectedVoice.tone.split('&')[0]})</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-900 transition-transform duration-200 ${isVoiceDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Voice Dropdown Options */}
              {isVoiceDropdownOpen && (
                <div className="absolute z-30 mt-1.5 w-full rounded-xl bg-[#1e2238]/95 backdrop-blur-xl border border-white/15 shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-150">
                  {voices.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVoiceId(v.id);
                        setIsVoiceDropdownOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs sm:text-sm text-slate-200 hover:text-white hover:bg-white/10 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${v.avatarBg} flex items-center justify-center text-[10px] font-bold text-white`}>
                          {v.name[0]}
                        </div>
                        <div>
                          <div className="font-medium">{v.name}</div>
                          <div className="text-[10px] text-slate-400">{v.tone}</div>
                        </div>
                      </div>
                      {selectedVoiceId === v.id && (
                        <Check className="w-4 h-4 text-blue-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Voice Avatars Row */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="grid grid-cols-2 gap-3">
                {voices.map((v) => {
                  const isActive = selectedVoiceId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVoiceId(v.id)}
                      className={`group flex flex-col items-center p-2.5 rounded-xl transition-all duration-200 relative ${isActive
                        ? 'bg-white/15 border border-white/20 shadow-inner'
                        : 'hover:bg-white/5 border border-transparent'
                        }`}
                    >
                      {/* Avatar Circle with Cartoon Styled Illustration */}
                      <div
                        className={`relative w-12 h-12 rounded-full flex items-center justify-center p-0.5 transition-all duration-300 ${isActive
                          ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent shadow-lg shadow-blue-500/40 scale-105'
                          : 'opacity-75 group-hover:opacity-100 group-hover:scale-105'
                          }`}
                      >
                        <div className={`w-full h-full rounded-full bg-gradient-to-br ${v.avatarBg} flex items-center justify-center overflow-hidden`}>
                          {/* Illustrated cartoon avatar representation */}
                          {v.style === 'nu' && (
                            <svg className="w-9 h-9" viewBox="0 0 36 36" fill="none">
                              <circle cx="18" cy="18" r="16" fill="url(#nu-grad)" fillOpacity="0.4" />
                              <circle cx="18" cy="14" r="7" fill="#fed7aa" />
                              <path d="M12 11c0-4 12-4 12 0v4c0 1-1 3-3 3h-6c-2 0-3-2-3-3v-4z" fill="#78350f" />
                              <circle cx="15.5" cy="14.5" r="1" fill="#1e293b" />
                              <circle cx="20.5" cy="14.5" r="1" fill="#1e293b" />
                              <path d="M16 17c.8.6 3.2.6 4 0" stroke="#b91c1c" strokeWidth="1.2" strokeLinecap="round" />
                              <path d="M9 30c0-6 4-9 9-9s9 3 9 9" fill="#fb7185" />
                              <defs>
                                <linearGradient id="nu-grad" x1="0" y1="0" x2="36" y2="36">
                                  <stop stopColor="#f43f5e" />
                                  <stop offset="1" stopColor="#818cf8" />
                                </linearGradient>
                              </defs>
                            </svg>
                          )}
                          {v.style === 'nam' && (
                            <svg className="w-9 h-9" viewBox="0 0 36 36" fill="none">
                              <circle cx="18" cy="18" r="16" fill="url(#nam-grad)" fillOpacity="0.4" />
                              <circle cx="18" cy="14" r="7" fill="#ffedd5" />
                              <path d="M11 12c1-4 13-5 14 0v3h-14v-3z" fill="#1e293b" />
                              <circle cx="15" cy="14.5" r="1" fill="#0f172a" />
                              <circle cx="21" cy="14.5" r="1" fill="#0f172a" />
                              <path d="M16.5 17.5h3" stroke="#9a3412" strokeWidth="1.2" strokeLinecap="round" />
                              <path d="M9 30c0-6 4-9 9-9s9 3 9 9" fill="#0284c7" />
                              <defs>
                                <linearGradient id="nam-grad" x1="0" y1="0" x2="36" y2="36">
                                  <stop stopColor="#0284c7" />
                                  <stop offset="1" stopColor="#6366f1" />
                                </linearGradient>
                              </defs>
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Name & Active Indicator */}
                      <span className={`mt-1.5 text-xs transition-colors ${isActive ? 'text-white font-bold' : 'text-slate-900 font-semibold group-hover:text-black'
                        }`}>
                        {v.name}
                      </span>
                      <span className="text-[10px] text-slate-800 font-medium">
                        {v.gender}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Audio Waveform Card */}
        <div className="mt-5 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md relative overflow-hidden group">
          <div className="flex items-center justify-between text-xs text-slate-900 mb-2.5">
            <span className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Headphones className="w-3.5 h-3.5 text-slate-900" />
              Waveform Visualizer
            </span>
            <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded-full border border-cyan-500/20">
              {isPlaying ? 'ACTIVE WAVE' : 'READY'}
            </span>
          </div>

          {/* Interactive Waveform Bar Container */}
          <div
            className="relative h-20 w-full flex items-center justify-between gap-[3px] sm:gap-1.5 cursor-pointer px-1 py-2 select-none"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const fraction = clickX / rect.width;
              handleSeek(fraction);
            }}
          >
            {waveformBars.map((height, idx) => {
              const barFraction = idx / waveformBars.length;
              const isPast = barFraction <= progressFraction;

              // Dynamic scaling if playing
              const dynamicHeight = isPlaying
                ? Math.min(100, Math.max(15, height + (Math.sin(idx * 0.8 + currentTime * 8) * 25)))
                : height;

              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center justify-center h-full transition-all duration-100"
                >
                  <div
                    style={{
                      height: `${dynamicHeight}%`,
                      background: isPast
                        ? 'linear-gradient(to top, #06b6d4, #ec4899)'
                        : 'rgba(255, 255, 255, 0.18)',
                      boxShadow: isPast && isPlaying
                        ? '0 0 12px rgba(6, 182, 212, 0.45)'
                        : 'none'
                    }}
                    className={`w-full max-w-[6px] rounded-full transition-all duration-150 ${isPast ? 'opacity-100' : 'opacity-40 group-hover:opacity-60'
                      }`}
                  />
                </div>
              );
            })}

            {/* Neon Blue Dot Timeline Indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_14px_#38bdf8] pointer-events-none transition-all duration-150 flex items-center justify-center"
              style={{
                left: `calc(${progressFraction * 100}% - 8px)`
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            </div>
          </div>
        </div>

        {/* Media Control Bar */}
        <div className="mt-6 flex flex-col gap-4">

          {/* Main Controls Row */}
          <div className="relative flex items-center justify-between min-h-[56px]">

            {/* Left: Volume Slider & Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white/15 border border-white/25 px-2.5 sm:px-3 py-1.5 rounded-full backdrop-blur-md shadow-sm">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  title={isMuted ? 'Unmute' : 'Mute'}
                  className="p-1 rounded-full bg-amber-400/20 hover:bg-amber-400/35 text-amber-300 hover:text-amber-200 transition"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-amber-300" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value));
                    if (isMuted) setIsMuted(false);
                  }}
                  className="w-14 sm:w-20 h-1.5 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #fbbf24 0%, #f472b6 ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.28) ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.28) 100%)`
                  }}
                  title={`Volume: ${isMuted ? 0 : volume}%`}
                />
              </div>

              {isGenerating && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-cyan-300 font-medium animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang phát...
                </span>
              )}
            </div>

            {/* Center: Pinned Dead-Center Player Controls (Prev, Big Play/Pause, Next) */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 pointer-events-auto">
              {/* Skip Back */}
              <button
                onClick={handleSkipBack}
                title="Tua lại 5 giây"
                className="p-2.5 rounded-full text-slate-900 hover:text-black hover:bg-white/10 active:scale-90 transition-all"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              {/* Big White Circular Play/Pause */}
              <button
                onClick={handleTogglePlay}
                disabled={isGenerating}
                title={isPlaying ? 'Tạm dừng' : 'Phát âm thanh'}
                className="w-14 h-14 p-4 rounded-full bg-white text-slate-900 shadow-xl shadow-white/20 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-75"
              >
                {isGenerating ? (
                  <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-slate-900" />
                ) : (
                  <Play className="w-6 h-6 fill-slate-900 ml-0.5" />
                )}
              </button>

              {/* Skip Forward */}
              <button
                onClick={handleSkipForward}
                title="Tua đi 5 giây"
                className="p-2.5 rounded-full text-slate-900 hover:text-black hover:bg-white/10 active:scale-90 transition-all"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Right: Speed Badge with fixed dimensions */}
            <div className="flex items-center justify-end">
              <button
                onClick={handleCycleSpeed}
                title="Tốc độ phát"
                className="w-14 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white tracking-wider tabular-nums active:scale-95 transition-all"
              >
                {SPEED_OPTIONS[speedIndex].toFixed(2).replace(/\.00$/, '.0')}x
              </button>
            </div>
          </div>

          {/* Scrubber Progress Bar & Timestamps */}
          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs font-mono text-slate-900 font-bold select-none min-w-[36px]">
              {formatTime(currentTime)}
            </span>

            <div className="relative flex-1 group">
              <input
                type="range"
                min="0"
                max={duration}
                step="0.1"
                value={currentTime}
                onChange={(e) => setCurrentTime(Number(e.target.value))}
                className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #38bdf8 0%, #a855f7 ${progressFraction * 100}%, rgba(255, 255, 255, 0.15) ${progressFraction * 100}%, rgba(255, 255, 255, 0.15) 100%)`
                }}
              />
            </div>

            <span className="text-xs font-mono text-slate-900 font-bold select-none min-w-[36px] text-right">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Footer info pill */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-900 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-900">Concatenative Engine · {entries.length} mục ngữ liệu</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-slate-900 font-medium">Voice: {selectedVoice.name} ({selectedVoice.tone})</span>
            <button
              onClick={handleExport}
              className="text-slate-900 hover:text-black flex items-center gap-1 text-[11px] font-semibold transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-900" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Settings & System Modal (Frosted Glass) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-3xl max-h-[88vh] flex flex-col backdrop-blur-2xl bg-[#161a33]/95 border border-white/20 rounded-3xl p-6 shadow-2xl relative text-white">

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <img
                  src={logo}
                  alt="VietVoice Logo"
                  className="w-6 h-6 rounded-lg object-cover shadow-sm"
                />
                <h3 className="text-lg font-bold">VietVoice</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-navigation inside Settings Modal */}
            <div className="flex flex-wrap gap-1.5 py-3 border-b border-white/10">
              {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSettingsTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${settingsTab === id
                    ? 'bg-blue-600/40 border-cyan-400 text-white shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Settings Body */}
            <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-4 text-sm">
              {settingsTab === 'params' && (
                <>
                  {/* Khoảng lặng giữa các từ */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Khoảng lặng giữa các từ</span>
                      <span className="font-mono text-cyan-400">{gapMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="500"
                      step="10"
                      value={gapMs}
                      onChange={(e) => setGapMs(Number(e.target.value))}
                      className="w-full h-1.5 bg-white/15 rounded-lg"
                    />
                  </div>

                  {/* Crossfade */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Crossfade (khi khoảng lặng = 0)</span>
                      <span className="font-mono text-indigo-400">{crossfadeMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      step="5"
                      value={crossfadeMs}
                      onChange={(e) => setCrossfadeMs(Number(e.target.value))}
                      className="w-full h-1.5 bg-white/15 rounded-lg"
                    />
                    <p className="text-[11px] text-slate-400 mt-0.5">Chồng hai từ liền kề bằng crossfade equal-power để điểm nối mượt hơn.</p>
                  </div>

                  {/* Tiền xử lý */}
                  <div className="space-y-2">
                    {[
                      { label: 'Cắt khoảng lặng đầu/cuối từng từ', value: trim, set: setTrim },
                      { label: 'Chuẩn hóa mức RMS giữa các từ', value: normalize, set: setNormalize },
                      { label: 'Dùng giọng khác nếu giọng đã chọn thiếu từ', value: fallbackSpeaker, set: setFallbackSpeaker }
                    ].map((opt) => (
                      <label key={opt.label} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={opt.value}
                          onChange={(e) => opt.set(e.target.checked)}
                          className="accent-cyan-400"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>

                  {/* Output Audio Format */}
                  <div>
                    <label className="block text-xs text-slate-300 mb-1.5">
                      Output Format
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="px-2 py-2 rounded-xl text-xs font-medium border bg-blue-600/40 border-cyan-400 text-white shadow-sm text-center">
                        WAV (PCM 16-bit, 22.05 kHz, mono)
                      </div>
                    </div>
                  </div>
                </>
              )}

              {settingsTab === 'corpus' && (
                <CorpusPanel entries={entries} refresh={refreshEntries} speaker={selectedVoice.name.replace('Giọng ', '')} />
              )}

              {settingsTab === 'features' && (
                <FeaturesPanel entries={entries} />
              )}

              {settingsTab === 'eval' && (
                <EvalPanel entries={entries} last={lastResult} />
              )}

              {settingsTab === 'pipeline' && (
                <PipelinePanel />
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                onClick={() => {
                  setGapMs(120);
                  setCrossfadeMs(20);
                  setTrim(true);
                  setNormalize(true);
                  setFallbackSpeaker(true);
                }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-semibold text-white hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-indigo-500/30 transition"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
