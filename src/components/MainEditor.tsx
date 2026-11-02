import React, { useState } from 'react';
import {
  Volume2,
  Play,
  Square,
  Trash2,
  Mic,
  AlertCircle,
  Music,
  Sliders,
  ChevronDown,
} from 'lucide-react';
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
      <div className="px-6 py-3.5 border-b border-[#E8E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFD]">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Combobox chọn Giọng Nam / Nữ */}
          <div className="relative inline-flex items-center">
            <span
              className={`absolute left-3 w-2 h-2 rounded-full pointer-events-none z-10 ${
                selectedVoice === 'Nam' ? 'bg-[#5578D8]' : 'bg-[#B16BC1]'
              }`}
            />
            <select
              value={selectedVoice}
              onChange={(e) => onSelectVoice(e.target.value as 'Nam' | 'Nữ')}
              className="pl-7 pr-8 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#E2E4F0] hover:border-[#6255CF]/60 text-[#20213A] focus:outline-none focus:border-[#6255CF] cursor-pointer appearance-none shadow-2xs transition"
              title="Chọn giọng đọc"
            >
              <option value="Nam">Giọng Nam</option>
              <option value="Nữ">Giọng Nữ</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#85879A] absolute right-2.5 pointer-events-none" />
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

        {/* Vocabulary availability helper tags */}
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
                  ) : null}
                </>
              )}
            </div>

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
      </div>

      {/* Main Action Bar */}
      <div className="px-6 py-4 bg-[#F9FAFD] border-t border-[#E8E8F0] flex items-center justify-end">
        {/* Nút Tạo audio */}
        <button
          onClick={onConvert}
          disabled={isConverting || !text.trim()}
          className={`px-7 py-3 rounded-xl font-semibold text-sm flex items-center gap-2.5 text-white transition-all shadow-md ${
            isConverting || !text.trim()
              ? 'bg-[#B0B2C5] cursor-not-allowed opacity-75'
              : 'bg-[#6255CF] hover:bg-[#5144BD] shadow-[#6255CF]/25 hover:shadow-lg hover:shadow-[#6255CF]/30 active:scale-[0.98]'
          }`}
        >
          {isConverting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Đang tạo audio...</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>Tạo audio</span>
            </>
          )}
        </button>
      </div>

      {/* Modal thiết lập ngắt nghỉ */}
      <PauseSettingsModal
        isOpen={isPauseModalOpen}
        onClose={() => setIsPauseModalOpen(false)}
      />
    </div>
  );
};
