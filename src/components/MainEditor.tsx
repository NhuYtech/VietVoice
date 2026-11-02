import React, { useState } from 'react';
import { Volume2, Play, Square, Trash2, Mic, AlertCircle, CheckCircle2, Music, Sparkles, Sliders, Clock } from 'lucide-react';
import { PauseSettingsModal } from './PauseSettingsModal';
import type { CorpusEntry } from '../lib/types';
import { inspectVocabulary } from '../services/ttsService';

interface MainEditorProps {
  text: string;
  onChangeText: (val: string) => void;
  selectedVoice: 'Nam' | 'Nữ';
  onSelectVoice: (voice: 'Nam' | 'Nữ') => void;
  onConvert: () => void;
  isConverting: boolean;
  entries: CorpusEntry[];
  onPlayPreviewVoice: (voice: 'Nam' | 'Nữ') => void;
  isPlayingPreview: 'Nam' | 'Nữ' | null;
  onOpenRecordModal?: (word?: string) => void;
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
  onOpenRecordModal,
}) => {
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Kiểm tra từ vựng hỗ trợ
  const vocabCheck = inspectVocabulary(text, selectedVoice, entries);

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8F0] shadow-sm overflow-hidden">
      {/* Top Toolbar */}
      <div className="px-6 py-3.5 border-b border-[#E8E8F0] flex items-center justify-between bg-[#FAFAFD]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E4F0] text-xs font-semibold text-[#20213A] w-[170px] shrink-0 select-none">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                selectedVoice === 'Nam' ? 'bg-[#5578D8]' : 'bg-[#B16BC1]'
              }`}
            />
            <span className="whitespace-nowrap">Đang chọn: Giọng {selectedVoice}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E2E4F0] text-xs font-medium text-[#555870]">
            <Music className="w-3.5 h-3.5 text-[#6255CF]" />
            <span>Định dạng: <strong>WAV (22.05 kHz Lossless)</strong></span>
          </div>

          <button
            type="button"
            onClick={() => setIsPauseModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#F3F4FB] border border-[#E2E4F0] hover:border-[#6255CF]/50 text-xs font-medium text-[#555870] hover:text-[#6255CF] transition shadow-2xs cursor-pointer select-none"
            title="Thiết lập thời gian ngắt nghỉ giữa các câu, dấu chấm, dấu phẩy"
          >
            <Sliders className="w-3.5 h-3.5 text-[#6255CF]" />
            <span>Thiết lập ngắt nghỉ</span>
          </button>
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
      <div className="p-7">
        <textarea
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Nhập văn bản tiếng Việt bạn muốn chuyển thành âm thanh..."
          rows={6}
          className="w-full resize-none text-[17px] text-[#20213A] placeholder-[#9AA0B4] focus:outline-none leading-relaxed bg-transparent min-h-[160px]"
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

        {/* Vocabulary availability helper tags & voice constraints */}
        {text.trim() && (
          <div className="mt-3.5 space-y-2.5">
            <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#EAEBF5] text-xs flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#555870]">Kiểm tra ngữ liệu:</span>
              {vocabCheck.tokens.length === 0 ? null : (
                <>
                  {vocabCheck.wordChecks && vocabCheck.wordChecks.length > 0 ? (
                    vocabCheck.wordChecks.map((check, idx) => {
                      if (check.inCurrentVoice) {
                        return (
                          <span
                            key={`${check.token}-${idx}`}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200"
                            title={`Từ '${check.token}' có sẵn bản thu âm Giọng ${selectedVoice}`}
                          >
                            <span className="text-emerald-600 font-bold">✓</span> {check.token}
                          </span>
                        );
                      }
                      if (check.inOtherVoice) {
                        return (
                          <button
                            key={`${check.token}-${idx}`}
                            type="button"
                            onClick={() => onSelectVoice(check.correctVoice!)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition cursor-pointer shadow-xs"
                            title={`Bản thu của từ '${check.token}' là Giọng ${check.correctVoice}. Nhấn để chọn Giọng ${check.correctVoice}!`}
                          >
                            <span className="text-amber-600 font-bold">⚠️</span> {check.token}
                            <span className="text-[10px] text-amber-700 font-normal underline ml-0.5">
                              (Cần giọng {check.correctVoice})
                            </span>
                          </button>
                        );
                      }
                      return (
                        <button
                          key={`${check.token}-${idx}`}
                          type="button"
                          onClick={() => onOpenRecordModal && onOpenRecordModal(check.token)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition cursor-pointer shadow-xs"
                          title={`Từ '${check.token}' chưa có bản thu âm. Nhấn để thu âm ngay!`}
                        >
                          <span className="text-rose-500 font-bold">✕</span> {check.token}
                          <span className="text-[10px] text-rose-600 font-normal underline ml-0.5">
                            (Chưa có bản ghi)
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    vocabCheck.tokens.map((tok, idx) => {
                      const isAvailable = vocabCheck.matchedWords.includes(tok);
                      return (
                        <span
                          key={`${tok}-${idx}`}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 ${
                            isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {isAvailable ? '✓' : '✕'} {tok}
                        </span>
                      );
                    })
                  )}
                </>
              )}
            </div>

            {/* Thông báo bắt buộc chọn đúng giọng đọc của file thu âm */}
            {vocabCheck.hasWrongVoice && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold text-amber-900">Ràng buộc giọng đọc: </span>
                    {vocabCheck.wrongVoiceMessage}
                  </div>
                </div>

                {vocabCheck.suggestedVoice && (
                  <button
                    type="button"
                    onClick={() => onSelectVoice(vocabCheck.suggestedVoice!)}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold text-xs transition shadow-sm flex items-center gap-1.5 flex-shrink-0"
                  >
                    <span>Chọn Giọng {vocabCheck.suggestedVoice} ngay</span>
                    <span>→</span>
                  </button>
                )}
              </div>
            )}

            {/* Thông báo từ chưa có bản ghi âm */}
            {vocabCheck.hasMissing && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-rose-50 to-red-50 border border-rose-300 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold text-rose-900">Chưa có bản ghi: </span>
                    {vocabCheck.missingMessage ||
                      `Từ "${vocabCheck.missingTokens.join(', ')}" chưa có bản thu âm trong hệ thống ngữ liệu. Vui lòng thu âm từ này trước khi chuyển đổi!`}
                  </div>
                </div>

                {onOpenRecordModal && (
                  <button
                    type="button"
                    onClick={() => onOpenRecordModal(vocabCheck.missingTokens[0])}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-semibold text-xs transition shadow-sm flex items-center gap-1.5 flex-shrink-0"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Thu âm từ này ngay</span>
                  </button>
                )}
              </div>
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
                onClick={() => onSelectVoice('Nam')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-colors duration-150 flex items-center justify-between relative ${
                  selectedVoice === 'Nam'
                    ? 'border-[#6255CF] bg-[#6255CF]/[0.04] shadow-sm'
                    : vocabCheck.hasWrongVoice && vocabCheck.suggestedVoice === 'Nam'
                    ? 'border-amber-400 bg-amber-50/50 hover:border-amber-500'
                    : 'border-[#E8E8F0] bg-white hover:border-[#D0D2E5]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3B65D6] to-[#5578D8] flex items-center justify-center text-white shadow-sm">
                    <span className="text-sm font-bold">N</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#20213A]">Nam</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#5578D8]/10 text-[#3B65D6]">
                        Giọng nam
                      </span>
                      {vocabCheck.hasWrongVoice && vocabCheck.suggestedVoice === 'Nam' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                          Cần chọn giọng này
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#85879A] mt-0.5">Giọng đọc nam trầm ấm</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayPreviewVoice('Nam');
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555870] hover:text-[#6255CF] hover:bg-[#F0F2F9] transition"
                  title="Nghe thử giọng Nam"
                >
                  {isPlayingPreview === 'Nam' ? (
                    <Square className="w-4 h-4 fill-current text-[#6255CF]" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>

              {/* CARD 2 — FEMALE VOICE */}
              <div
                onClick={() => onSelectVoice('Nữ')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-colors duration-150 flex items-center justify-between relative ${
                  selectedVoice === 'Nữ'
                    ? 'border-[#6255CF] bg-[#6255CF]/[0.04] shadow-sm'
                    : vocabCheck.hasWrongVoice && vocabCheck.suggestedVoice === 'Nữ'
                    ? 'border-amber-400 bg-amber-50/50 hover:border-amber-500'
                    : 'border-[#E8E8F0] bg-white hover:border-[#D0D2E5]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9B53AD] to-[#B16BC1] flex items-center justify-center text-white shadow-sm">
                    <span className="text-sm font-bold">F</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#20213A]">Nữ</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#B16BC1]/10 text-[#9B53AD]">
                        Giọng nữ
                      </span>
                      {vocabCheck.hasWrongVoice && vocabCheck.suggestedVoice === 'Nữ' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                          Cần chọn giọng này
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#85879A] mt-0.5">Giọng đọc nữ tự nhiên</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayPreviewVoice('Nữ');
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555870] hover:text-[#6255CF] hover:bg-[#F0F2F9] transition"
                  title="Nghe thử giọng Nữ"
                >
                  {isPlayingPreview === 'Nữ' ? (
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
              className={`px-7 py-3.5 rounded-xl font-semibold text-sm flex items-center gap-2.5 text-white transition-all shadow-md ${
                isConverting || !text.trim()
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

      {/* Modal thiết lập ngắt nghỉ */}
      <PauseSettingsModal
        isOpen={isPauseModalOpen}
        onClose={() => setIsPauseModalOpen(false)}
      />
    </div>
  );
};
