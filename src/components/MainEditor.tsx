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
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { PauseSettingsModal, type PauseSettings } from './PauseSettingsModal';
import type { NotificationModalData } from './NotificationModal';
import type { CorpusEntry } from '../lib/types';
import { inspectVocabulary } from '../services/ttsService';
import { normalizeNumbersInText, hasNumbers } from '../lib/numberNormalizer';

interface MainEditorProps {
  text: string;
  onChangeText: (val: string) => void;
  selectedVoice?: 'Hữu Thọ' | string;
  onSelectVoice?: (voice: 'Hữu Thọ') => void;
  onConvert: () => void;
  isConverting: boolean;
  onPreview?: () => void;
  isPreviewing?: boolean;
  entries: CorpusEntry[];
  manifestCount?: number;
  onPlayPreviewVoice?: (voice: 'Hữu Thọ') => void;
  isPlayingPreview?: 'Hữu Thọ' | null;
  onOpenRecordModal?: (word?: string) => void;
  onShowNotification?: (data: NotificationModalData) => void;
}

export const MainEditor: React.FC<MainEditorProps> = ({
  text,
  onChangeText,
  selectedVoice = 'Hữu Thọ',
  onSelectVoice,
  onConvert,
  isConverting,
  onPreview,
  isPreviewing = false,
  entries,
  manifestCount,
  onPlayPreviewVoice,
  isPlayingPreview,
  onOpenRecordModal,
  onShowNotification,
}) => {
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [copiedNormalized, setCopiedNormalized] = useState(false);

  const handleCopyNormalized = (normalizedStr: string) => {
    if (!normalizedStr) return;
    navigator.clipboard.writeText(normalizedStr);
    setCopiedNormalized(true);
    setTimeout(() => setCopiedNormalized(false), 2000);
  };
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Kiểm tra từ vựng hỗ trợ
  const vocabCheck = inspectVocabulary(text, 'Hữu Thọ', entries);

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8F0] shadow-sm overflow-hidden">
      {/* Top Toolbar */}
      <div className="px-6 py-3.5 border-b border-[#E8E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFD]">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Giọng đọc Hữu Thọ */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2E4F0] text-xs font-semibold text-[#20213A] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#5578D8]" />
            <span>Giọng đọc: <strong className="text-[#5578D8]">Hữu Thọ</strong></span>
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
      <div className="px-6 py-3.5">
        <textarea
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Nhập văn bản tại đây..."
          rows={3}
          className="w-full resize-none text-[16px] text-[#20213A] placeholder-[#9AA0B4] focus:outline-none leading-relaxed bg-transparent min-h-[76px]"
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

        {/* Quick Sample Chips: Tiền tệ, Ngày tháng, Giờ giấc, Phần trăm */}
        {!text.trim() && (
          <div className="mt-3 pt-2.5 border-t border-[#F0F2F9] flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#85879A] text-[11px] font-medium flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-[#6255CF]" />
              Gợi ý thử nhanh:
            </span>
            {[
              { label: '500k', text: 'giá 500k' },
              { label: '100.000đ', text: '100.000đ' },
              { label: '04/11', text: 'ngày 04/11' },
              { label: '10h30', text: 'lúc 10h30' },
              { label: '50%', text: 'đạt 50%' },
              { label: 'Ví dụ tổng hợp', text: 'giá 500k hoặc 100.000đ vào ngày 04/11 lúc 10h30 đạt 50%' },
            ].map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => onChangeText(sample.text)}
                className="px-2.5 py-1 rounded-lg bg-[#F4F5FB] hover:bg-[#6255CF] text-[#555870] hover:text-white border border-[#E8E8F0] hover:border-[#6255CF] font-medium transition cursor-pointer text-[11px] shadow-2xs active:scale-95"
                title={`Nhấn để điền thử mẫu: "${sample.text}"`}
              >
                {sample.label}
              </button>
            ))}
          </div>
        )}

        {/* Vocabulary availability helper tags */}
        {text.trim() && (
          <div className="mt-3.5 space-y-2.5">
            {hasNumbers(text) && (() => {
              const normText = normalizeNumbersInText(text);
              return (
                <div
                  onClick={() => handleCopyNormalized(normText)}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#F3F1FD] border border-[#DDD7FD] text-xs text-[#20213A] shadow-2xs cursor-pointer select-none hover:bg-[#ECE8FD] hover:border-[#6255CF]/50 transition group"
                  title="Nhấn vào để sao chép văn bản đã đọc số"
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <span className="font-semibold text-[#6255CF] flex items-center gap-1.5 shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-[#6255CF]" />
                      Đọc số tự động:
                    </span>
                    <span className="text-[#3A3D52] font-medium italic truncate">
                      "{normText}"
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyNormalized(normText);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer select-none ${copiedNormalized
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-[#6255CF] border border-[#DDD7FD] group-hover:border-[#6255CF] group-hover:bg-[#6255CF] group-hover:text-white shadow-2xs'
                        }`}
                      title="Sao chép toàn bộ văn bản đọc số"
                    >
                      {copiedNormalized ? (
                        <>
                          <Check className="w-3 h-3 text-white" />
                          <span>Đã sao chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChangeText(normText);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white text-[#555870] border border-[#DDD7FD] hover:bg-[#6255CF] hover:text-white hover:border-[#6255CF] transition cursor-pointer select-none shadow-2xs"
                      title="Thay thế ô nhập bằng văn bản đã đọc số"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              );
            })()}
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
                            title={`Từ '${check.token}' có sẵn bản thu âm Giọng Hữu Thọ`}
                          >
                            <span className="text-emerald-600 font-bold">✓</span> {check.token}
                          </span>
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
      <div className="px-6 py-4 bg-[#F9FAFD] border-t border-[#E8E8F0] flex flex-wrap items-center justify-center gap-3">
        {/* Nút Nghe thử trước khi tạo */}
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            disabled={isConverting || isPreviewing || !text.trim()}
            className={`min-w-[160px] h-12 px-6 py-3 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all border-2 ${isConverting || isPreviewing || !text.trim()
                ? 'border-[#D5D7E5] text-[#9EA1B7] bg-[#F1F2F8] cursor-not-allowed opacity-75'
                : 'border-[#6255CF] text-[#6255CF] bg-white hover:bg-[#F2EFFD] active:scale-[0.98] shadow-xs cursor-pointer'
              }`}
            title="Nghe thử âm thanh đoạn văn trước khi tạo chính thức và lưu vào lịch sử"
          >
            {isPreviewing ? (
              <>
                <div className="w-4 h-4 border-2 border-[#6255CF]/30 border-t-[#6255CF] rounded-full animate-spin" />
                <span>Đang nghe thử...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-[#6255CF] text-[#6255CF]" />
                <span>Nghe thử</span>
              </>
            )}
          </button>
        )}
        {/* Nút Tạo audio */}
        <button
          onClick={onConvert}
          disabled={isConverting || !text.trim()}
          className={`min-w-[260px] h-12 px-10 py-3 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2.5 text-white transition-all shadow-md ${isConverting || !text.trim()
              ? 'bg-[#B0B2C5] cursor-not-allowed opacity-75'
              : 'bg-[#6255CF] hover:bg-[#5144BD] shadow-[#6255CF]/25 hover:shadow-lg hover:shadow-[#6255CF]/35 active:scale-[0.98] cursor-pointer'
            }`}
        >
          {isConverting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Đang tạo audio...</span>
            </>
          ) : (
            <>
              <Volume2 className="w-5 h-5" />
              <span>Tạo audio</span>
            </>
          )}
        </button>
      </div>

      {/* Modal thiết lập ngắt nghỉ */}
      <PauseSettingsModal
        isOpen={isPauseModalOpen}
        onClose={() => setIsPauseModalOpen(false)}
        onSave={() => {
          onShowNotification?.({
            type: 'success',
            title: 'Đã lưu ngắt nghỉ',
            message: 'Thiết lập thời gian ngắt nghỉ đã được áp dụng.',
            confirmText: 'OK',
          });
        }}
      />
    </div>
  );
};
