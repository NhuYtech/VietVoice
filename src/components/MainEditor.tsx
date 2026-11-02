import React from 'react';
import { Volume2, Play, Square, Trash2, Mic, AlertCircle, CheckCircle2, Music, Sparkles } from 'lucide-react';
import type { CorpusEntry } from '../lib/types';
import { inspectVocabulary } from '../services/ttsService';

interface MainEditorProps {
  text: string;
  onChangeText: (val: string) => void;
  selectedVoice: 'Nam 01' | 'Nữ 01';
  onSelectVoice: (voice: 'Nam 01' | 'Nữ 01') => void;
  onConvert: () => void;
  isConverting: boolean;
  entries: CorpusEntry[];
  onPlayPreviewVoice: (voice: 'Nam 01' | 'Nữ 01') => void;
  isPlayingPreview: 'Nam 01' | 'Nữ 01' | null;
}

const EXAMPLES = [
  'Xin chào',
  'Việt Nam',
  'Công nghệ thông tin',
  'Chào mừng bạn đến với VietVoice',
];

export const MainEditor: React.FC<MainEditorProps> = ({
  text,
  onChangeText,
  selectedVoice,
  onSelectVoice,
  onConvert,
  isConverting,
  entries,
  onPlayPreviewVoice,
  isPlayingPreview,
}) => {
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Kiểm tra từ vựng hỗ trợ
  const vocabCheck = inspectVocabulary(text, selectedVoice, entries);

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8F0] shadow-sm overflow-hidden transition-all">
      {/* Top Toolbar */}
      <div className="px-6 py-3.5 border-b border-[#E8E8F0] flex items-center justify-between bg-[#FAFAFD]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E4F0] text-xs font-semibold text-[#20213A]">
            <span
              className={`w-2 h-2 rounded-full ${selectedVoice === 'Nam 01' ? 'bg-[#5578D8]' : 'bg-[#B16BC1]'
                }`}
            />
            <span>Đang chọn: {selectedVoice}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E2E4F0] text-xs font-medium text-[#555870]">
            <Music className="w-3.5 h-3.5 text-[#6255CF]" />
            <span>Định dạng: <strong>WAV (22.05 kHz Lossless)</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {text && (
            <button
              onClick={() => onChangeText('')}
              className="flex items-center gap-1 text-xs text-[#85879A] hover:text-red-500 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition"
              title="Xóa toàn bộ văn bản"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa văn bản</span>
            </button>
          )}
        </div>
      </div>

      {/* Large Text Area */}
      <div className="p-6">
        <textarea
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Nhập văn bản tiếng Việt bạn muốn chuyển thành âm thanh..."
          rows={5}
          className="w-full resize-none text-base text-[#20213A] placeholder-[#9AA0B4] focus:outline-none leading-relaxed bg-transparent"
        />

        {/* Word / Char Counters & Status */}
        <div className="flex items-center justify-between pt-2 border-t border-[#F0F2F9] text-xs text-[#85879A]">
          <div className="flex items-center gap-4">
            <span>{charCount} ký tự</span>
            <span>•</span>
            <span>{wordCount} từ</span>
          </div>

          <div className="text-[11px] text-[#85879A]">
            Hệ thống hỗ trợ các từ có trong bộ dữ liệu thu âm.
          </div>
        </div>

        {/* Vocabulary availability helper tags */}
        {text.trim() && (
          <div className="mt-3 p-3 rounded-xl bg-[#F8F9FD] border border-[#EAEBF5] text-xs flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#555870]">Kiểm tra ngữ liệu:</span>
            {vocabCheck.tokens.length === 0 ? null : (
              <>
                {vocabCheck.tokens.map((tok, idx) => {
                  const isAvailable = vocabCheck.matchedWords.includes(tok);
                  return (
                    <span
                      key={`${tok}-${idx}`}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 ${isAvailable
                          ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100/80 text-amber-800 border border-amber-200'
                        }`}
                      title={isAvailable ? 'Đã có trong ngữ liệu' : 'Chưa có trong ngữ liệu thu âm'}
                    >
                      {isAvailable ? '✓' : '!'} {tok}
                    </span>
                  );
                })}

                {vocabCheck.missingWords.length > 0 && (
                  <span className="text-[11px] text-amber-700 ml-1">
                    (Có {vocabCheck.missingWords.length} từ chưa có trong ngữ liệu)
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Example Suggestions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#85879A] mr-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#6255CF]" />
            Gợi ý mẫu:
          </span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => onChangeText(ex)}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#F3F4FA] hover:bg-[#EAEBF5] text-[#484B63] transition font-medium border border-[#E5E6F2]"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Voice Selection & Main Action Bar */}
      <div className="px-6 py-5 bg-[#F9FAFD] border-t border-[#E8E8F0]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Voice Cards */}
          <div className="flex-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#63667E] mb-2.5">
              Chọn giọng đọc
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* CARD 1 — MALE VOICE */}
              <div
                onClick={() => onSelectVoice('Nam 01')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${selectedVoice === 'Nam 01'
                    ? 'border-[#6255CF] bg-[#6255CF]/[0.04] shadow-sm'
                    : 'border-[#E8E8F0] bg-white hover:border-[#D0D2E5]'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3B65D6] to-[#5578D8] flex items-center justify-center text-white shadow-sm">
                    <span className="text-sm font-bold">N</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#20213A]">Nam 01</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#5578D8]/10 text-[#3B65D6]">
                        Giọng nam
                      </span>
                    </div>
                    <p className="text-xs text-[#85879A] mt-0.5">Giọng đọc nam trầm ấm</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayPreviewVoice('Nam 01');
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555870] hover:text-[#6255CF] hover:bg-[#F0F2F9] transition"
                  title="Nghe thử giọng Nam 01"
                >
                  {isPlayingPreview === 'Nam 01' ? (
                    <Square className="w-4 h-4 fill-current text-[#6255CF]" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>

              {/* CARD 2 — FEMALE VOICE */}
              <div
                onClick={() => onSelectVoice('Nữ 01')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${selectedVoice === 'Nữ 01'
                    ? 'border-[#6255CF] bg-[#6255CF]/[0.04] shadow-sm'
                    : 'border-[#E8E8F0] bg-white hover:border-[#D0D2E5]'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9B53AD] to-[#B16BC1] flex items-center justify-center text-white shadow-sm">
                    <span className="text-sm font-bold">F</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#20213A]">Nữ 01</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#B16BC1]/10 text-[#9B53AD]">
                        Giọng nữ
                      </span>
                    </div>
                    <p className="text-xs text-[#85879A] mt-0.5">Giọng đọc nữ tự nhiên</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayPreviewVoice('Nữ 01');
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555870] hover:text-[#6255CF] hover:bg-[#F0F2F9] transition"
                  title="Nghe thử giọng Nữ 01"
                >
                  {isPlayingPreview === 'Nữ 01' ? (
                    <Square className="w-4 h-4 fill-current text-[#6255CF]" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Main Action Button */}
          <div className="flex items-end justify-end pt-2 lg:pt-0">
            <button
              onClick={onConvert}
              disabled={isConverting || !text.trim()}
              className={`px-7 py-3.5 rounded-xl font-semibold text-sm flex items-center gap-2.5 text-white transition-all shadow-md ${isConverting || !text.trim()
                  ? 'bg-[#B0B2C5] cursor-not-allowed opacity-75'
                  : 'bg-[#6255CF] hover:bg-[#5144BD] shadow-[#6255CF]/25 hover:shadow-lg hover:shadow-[#6255CF]/30 active:scale-[0.98]'
                }`}
            >
              {isConverting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang chuyển đổi...</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>Chuyển thành âm thanh</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

