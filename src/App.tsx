import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Download
} from 'lucide-react';

interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  tags: string[];
  tone: string;
  avatarBg: string;
  accentColor: string;
  sampleText: string;
}

const VOICES: VoiceOption[] = [
  {
    id: 'nu',
    name: 'Giọng Nữ',
    gender: 'Nữ',
    tags: ['Truyền cảm', 'Tự nhiên', 'Dịu dàng'],
    tone: 'Truyền cảm & Tự nhiên',
    avatarBg: 'from-pink-500 via-rose-500 to-indigo-600',
    accentColor: '#ec4899',
    sampleText: 'Chào mừng bạn đến với VietVoice! Trải nghiệm chuyển đổi văn bản thành giọng nói tiếng Việt tự nhiên, cảm xúc và mượt mà.'
  },
  {
    id: 'nam',
    name: 'Giọng Nam',
    gender: 'Nam',
    tags: ['Trầm ấm', 'Chuyên nghiệp', 'Tự tin'],
    tone: 'Trầm ấm & Chuyên nghiệp',
    avatarBg: 'from-blue-600 via-cyan-500 to-indigo-800',
    accentColor: '#06b6d4',
    sampleText: 'VietVoice cung cấp giọng đọc AI chất lượng phòng thu, tối ưu cho sách nói, podcast, video tin tức và thuyết minh.'
  }
];

const LANGUAGES = [
  { code: 'vi-VN', name: 'Vietnamese (Tiếng Việt)', flag: '🇻🇳' },
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'ja-JP', name: 'Japanese (日本語)', flag: '🇯🇵' },
  { code: 'es-ES', name: 'Spanish (Español)', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French (Français)', flag: '🇫🇷' },
];

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export default function App() {
  // Input & Selection State
  const [text, setText] = useState<string>(
    'Chào mừng bạn đến với VietVoice! Trải nghiệm chuyển đổi văn bản thành giọng nói tiếng Việt tự nhiên, cảm xúc và mượt mà.'
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Vietnamese (Tiếng Việt)');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('nu');
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Audio Playback & Generation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(154); // 02:34 in seconds
  const [volume, setVolume] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speedIndex, setSpeedIndex] = useState<number>(1); // 1.0x

  // Advanced Settings State
  const [pitch, setPitch] = useState<number>(50);
  const [stability, setStability] = useState<number>(75);
  const [clarity, setClarity] = useState<number>(85);
  const [outputFormat, setOutputFormat] = useState<string>('MP3 (320kbps)');

  const playbackTimerRef = useRef<number | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const selectedVoice = useMemo(() => {
    return VOICES.find(v => v.id === selectedVoiceId) || VOICES[0];
  }, [selectedVoiceId]);

  // Waveform bars data (36 bars, symmetric random heights)
  const waveformBars = useMemo(() => {
    const rawHeights = [
      22, 38, 55, 78, 92, 45, 68, 88, 100, 60, 35, 70, 85, 95, 50, 30, 65, 82,
      90, 75, 40, 60, 95, 80, 52, 38, 72, 86, 64, 42, 58, 74, 90, 65, 38, 24
    ];
    return rawHeights;
  }, []);

  // Format seconds to mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Playback timer loop
  useEffect(() => {
    if (isPlaying) {
      const step = 0.5 * SPEED_OPTIONS[speedIndex];
      playbackTimerRef.current = window.setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
            return 0;
          }
          return Math.min(prev + step, duration);
        });
      }, 500);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    }
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [isPlaying, duration, speedIndex]);

  // Web Speech API Integration for natural voice output
  const triggerNativeSpeech = (textToSpeak: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = SPEED_OPTIONS[speedIndex];
      const genderPitchFactor = selectedVoiceId === 'nam' ? 0.8 : 1.15;
      utterance.pitch = Math.max(0.5, Math.min(2.0, (0.8 + (pitch / 100) * 0.4) * genderPitchFactor));
      utterance.volume = isMuted ? 0 : volume / 100;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const langCode = selectedLanguage.includes('Vietnamese') ? 'vi' : 'en';
        const matchedVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langCode));
        if (matchedVoices.length > 0) {
          const matched = matchedVoices.find(v =>
            selectedVoiceId === 'nam'
              ? /nam|male|david|george|mark|minh|khoa/i.test(v.name)
              : /nu|nữ|female|zira|susan|mai|linh|lan|nga/i.test(v.name)
          ) || matchedVoices[0];
          utterance.voice = matched;
        }
      }

      utterance.onend = () => {
        setIsPlaying(false);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
      };

      speechUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Handle Play/Pause
  const handleTogglePlay = () => {
    if (isGenerating) return;

    if (isPlaying) {
      setIsPlaying(false);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.pause();
      }
    } else {
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      } else {
        triggerNativeSpeech(text || selectedVoice.sampleText);
      }
      setIsPlaying(true);
    }
  };

  // Handle Generate
  const handleGenerate = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setIsPlaying(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setTimeout(() => {
      setIsGenerating(false);
      setCurrentTime(0);
      // Recalculate duration based on text length (roughly 130 words per min)
      const words = (text || selectedVoice.sampleText).trim().split(/\s+/).length;
      const calculatedDuration = Math.max(15, Math.min(300, Math.round((words / 2.5))));
      setDuration(calculatedDuration);
      setIsPlaying(true);
      triggerNativeSpeech(text || selectedVoice.sampleText);
    }, 1200);
  };

  // Skip Back 5 seconds
  const handleSkipBack = () => {
    setCurrentTime(prev => Math.max(0, prev - 5));
  };

  // Skip Forward 5 seconds
  const handleSkipForward = () => {
    setCurrentTime(prev => Math.min(duration, prev + 5));
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
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-x-hidden bg-gradient-to-br from-[#1e1b4b] via-[#172554] to-[#0f172a]">
      {/* Dynamic Background Ambient Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2 animate-float-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-[420px] h-[420px] bg-cyan-500/15 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3 animate-pulse-subtle" />
      <div className="absolute top-2/3 left-1/3 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />

      {/* Main Glassmorphic Dashboard Card */}
      <div className="relative z-10 w-full max-w-2xl backdrop-blur-xl bg-white/10 border border-white/15 rounded-3xl shadow-2xl p-6 sm:p-8 transition-all duration-300">
        
        {/* Header Card */}
        <div className="flex items-start justify-between pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-400 to-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/30">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                VietVoice
              </h1>
            </div>
            <p className="mt-1 text-sm sm:text-base text-slate-300 font-normal">
              Text-to-Speech · Natural Voices
            </p>
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Audio and Model Settings"
            className="group relative bg-white/10 hover:bg-white/20 active:scale-95 transition-all duration-200 p-2.5 rounded-full border border-white/10 shadow-sm text-slate-200 hover:text-white"
          >
            <Settings className="w-5 h-5 transition-transform duration-300 group-hover:rotate-45" />
            <span className="sr-only">Settings</span>
          </button>
        </div>

        {/* Input & Voice Selection Section (2-Column Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          
          {/* Left Column: Language & Text Input */}
          <div className="flex flex-col gap-3">
            {/* Language Dropdown */}
            <div className="relative">
              <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">
                Language
              </label>
              <button
                type="button"
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-white transition-all backdrop-blur-md"
              >
                <span className="truncate flex items-center gap-2">
                  <span>{LANGUAGES.find(l => l.name === selectedLanguage)?.flag || '🌐'}</span>
                  {selectedLanguage}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Language Menu */}
              {isLangOpen && (
                <div className="absolute z-30 mt-1.5 w-full rounded-xl bg-[#1e2238]/95 backdrop-blur-xl border border-white/15 shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-150">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setSelectedLanguage(lang.name);
                        setIsLangOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs sm:text-sm text-slate-200 hover:text-white hover:bg-white/10 flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        {lang.name}
                      </span>
                      {selectedLanguage === lang.name && (
                        <Check className="w-4 h-4 text-cyan-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Textarea Input with Character Counter */}
            <div className="relative flex flex-col flex-1">
              <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1 flex items-center justify-between">
                <span>Prompt / Text</span>
                <button
                  onClick={() => setText(selectedVoice.sampleText)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-normal transition"
                >
                  Load Sample
                </button>
              </label>
              <div className="relative flex-1">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 500))}
                  placeholder="Type or paste text here..."
                  rows={4}
                  className="w-full h-full min-h-[115px] resize-none rounded-2xl bg-black/20 border border-white/10 p-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all backdrop-blur-md"
                />
                {/* Character Counter */}
                <div className="absolute bottom-2.5 right-3 text-[11px] font-mono text-slate-400 pointer-events-none bg-black/30 px-2 py-0.5 rounded-full border border-white/5">
                  <span className={text.length >= 480 ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
                    {text.length}
                  </span>
                  /500
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Voice Dropdown & Voice Avatars */}
          <div className="flex flex-col gap-3 justify-between">
            {/* Voice Dropdown */}
            <div className="relative">
              <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">
                Voice
              </label>
              <button
                type="button"
                onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-white transition-all backdrop-blur-md"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedVoice.accentColor }} />
                  <span className="font-semibold">{selectedVoice.name}</span>
                  <span className="text-xs text-slate-400">({selectedVoice.tone.split('&')[0]})</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isVoiceDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Voice Dropdown Options */}
              {isVoiceDropdownOpen && (
                <div className="absolute z-30 mt-1.5 w-full rounded-xl bg-[#1e2238]/95 backdrop-blur-xl border border-white/15 shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-150">
                  {VOICES.map((v) => (
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
              <span className="block text-[11px] font-medium text-slate-300 uppercase tracking-wider mb-2.5">
                Loại Giọng (Voice Type)
              </span>
              <div className="grid grid-cols-2 gap-3">
                {VOICES.map((v) => {
                  const isActive = selectedVoiceId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVoiceId(v.id)}
                      className={`group flex flex-col items-center p-2.5 rounded-xl transition-all duration-200 relative ${
                        isActive
                          ? 'bg-white/15 border border-white/20 shadow-inner'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {/* Avatar Circle with Cartoon Styled Illustration */}
                      <div
                        className={`relative w-12 h-12 rounded-full flex items-center justify-center p-0.5 transition-all duration-300 ${
                          isActive
                            ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent shadow-lg shadow-blue-500/40 scale-105'
                            : 'opacity-75 group-hover:opacity-100 group-hover:scale-105'
                        }`}
                      >
                        <div className={`w-full h-full rounded-full bg-gradient-to-br ${v.avatarBg} flex items-center justify-center overflow-hidden`}>
                          {/* Illustrated cartoon avatar representation */}
                          {v.id === 'nu' && (
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
                          {v.id === 'nam' && (
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
                      <span className={`mt-1.5 text-xs font-medium transition-colors ${
                        isActive ? 'text-white font-bold' : 'text-slate-300 group-hover:text-white'
                      }`}>
                        {v.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
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
          <div className="flex items-center justify-between text-xs text-slate-300 mb-2.5">
            <span className="flex items-center gap-1.5 font-medium text-slate-200">
              <Headphones className="w-3.5 h-3.5 text-cyan-400" />
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
                    className={`w-full max-w-[6px] rounded-full transition-all duration-150 ${
                      isPast ? 'opacity-100' : 'opacity-40 group-hover:opacity-60'
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`relative overflow-hidden group flex items-center gap-2 px-6 py-3 rounded-full font-medium text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 active:scale-95 ${
                isGenerating
                  ? 'bg-indigo-700 cursor-not-allowed opacity-90'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:via-indigo-500 hover:to-indigo-600 hover:shadow-indigo-500/50'
              }`}
            >
              <Sparkles className={`w-4 h-4 transition-transform duration-500 ${isGenerating ? 'animate-spin text-cyan-300' : 'group-hover:rotate-12'}`} />
              <span className="text-sm tracking-wide">
                {isGenerating ? 'Synthesizing...' : 'Generate Voice'}
              </span>
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform" />
            </button>

            {/* Player Controls (Prev, Big Play/Pause, Next) */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Skip Back */}
              <button
                onClick={handleSkipBack}
                title="Skip back 5 seconds"
                className="p-2.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              {/* Big White Circular Play/Pause */}
              <button
                onClick={handleTogglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
                className="w-13 h-13 p-4 rounded-full bg-white text-slate-900 shadow-xl shadow-white/20 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center hover:bg-slate-100"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-slate-900" />
                ) : (
                  <Play className="w-5 h-5 fill-slate-900 ml-0.5" />
                )}
              </button>

              {/* Skip Forward */}
              <button
                onClick={handleSkipForward}
                title="Skip forward 5 seconds"
                className="p-2.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Volume & Speed Controls */}
            <div className="flex items-center gap-3">
              {/* Volume Slider & Toggle */}
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  title={isMuted ? 'Unmute' : 'Mute'}
                  className="text-slate-300 hover:text-white transition"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-cyan-400" />
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
                  className="w-16 h-1 accent-cyan-400"
                  title={`Volume: ${isMuted ? 0 : volume}%`}
                />
              </div>

              {/* Speed Badge */}
              <button
                onClick={handleCycleSpeed}
                title="Toggle playback speed"
                className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white tracking-wider active:scale-95 transition-all"
              >
                {SPEED_OPTIONS[speedIndex].toFixed(2).replace(/\.00$/, '.0')}x
              </button>
            </div>
          </div>

          {/* Scrubber Progress Bar & Timestamps */}
          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs font-mono text-slate-300 select-none min-w-[36px]">
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

            <span className="text-xs font-mono text-slate-300 select-none min-w-[36px] text-right">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Footer info pill */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AI Neural Engine v3.4 Ready</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Active Model: {selectedVoice.name} ({selectedVoice.tone})</span>
            <button
              onClick={() => {
                alert(`Audio export started for ${selectedVoice.name} (${outputFormat})`);
              }}
              className="hover:text-cyan-400 flex items-center gap-1 text-[11px] transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Settings Modal (Frosted Glass) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md backdrop-blur-2xl bg-[#161a33]/90 border border-white/20 rounded-3xl p-6 shadow-2xl relative text-white">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold">Voice Synthesis Settings</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Settings Body */}
            <div className="mt-5 space-y-4 text-sm">
              {/* Pitch */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Pitch Adjustment</span>
                  <span className="font-mono text-cyan-400">{pitch}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={pitch}
                  onChange={(e) => setPitch(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/15 rounded-lg"
                />
              </div>

              {/* Stability */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Voice Stability</span>
                  <span className="font-mono text-indigo-400">{stability}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={stability}
                  onChange={(e) => setStability(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/15 rounded-lg"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Higher stability creates consistent rhythm; lower adds natural emotional variance.</p>
              </div>

              {/* Clarity */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Clarity & Enhancement</span>
                  <span className="font-mono text-pink-400">{clarity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={clarity}
                  onChange={(e) => setClarity(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/15 rounded-lg"
                />
              </div>

              {/* Output Audio Format */}
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  Output Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['MP3 (320kbps)', 'WAV (Lossless)', 'AAC (256kbps)'].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setOutputFormat(fmt)}
                      className={`px-2 py-2 rounded-xl text-xs font-medium border transition ${
                        outputFormat === fmt
                          ? 'bg-blue-600/40 border-cyan-400 text-white shadow-sm'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {fmt.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                onClick={() => {
                  setPitch(50);
                  setStability(75);
                  setClarity(85);
                  setOutputFormat('MP3 (320kbps)');
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
