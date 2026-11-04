import React, { useState, useEffect } from 'react';
import { X, Minus, Plus, AlignLeft } from 'lucide-react';

export interface PauseSettings {
  period: number; // Dấu chấm
  comma: number; // Dấu phẩy
  semicolon: number; // Dấu chấm phẩy
  newline: number; // Xuống dòng
}

export const DEFAULT_PAUSE_SETTINGS: PauseSettings = {
  period: 0.45,
  comma: 0.25,
  semicolon: 0.3,
  newline: 0.6,
};

const STORAGE_KEY = 'vietvoice_pause_settings';

export function getStoredPauseSettings(): PauseSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        period: typeof parsed.period === 'number' ? parsed.period : DEFAULT_PAUSE_SETTINGS.period,
        comma: typeof parsed.comma === 'number' ? parsed.comma : DEFAULT_PAUSE_SETTINGS.comma,
        semicolon: typeof parsed.semicolon === 'number' ? parsed.semicolon : DEFAULT_PAUSE_SETTINGS.semicolon,
        newline: typeof parsed.newline === 'number' ? parsed.newline : DEFAULT_PAUSE_SETTINGS.newline,
      };
    }
  } catch {}
  return { ...DEFAULT_PAUSE_SETTINGS };
}

export function saveStoredPauseSettings(settings: PauseSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

interface PauseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: PauseSettings) => void;
}

export const PauseSettingsModal: React.FC<PauseSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [settings, setSettings] = useState<PauseSettings>(getStoredPauseSettings);

  useEffect(() => {
    if (isOpen) {
      setSettings(getStoredPauseSettings());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateVal = (key: keyof PauseSettings, delta: number) => {
    setSettings((prev) => {
      const cur = prev[key];
      const next = Math.max(0.05, Math.min(3.0, Math.round((cur + delta) * 100) / 100));
      return { ...prev, [key]: next };
    });
  };

  const handleResetDefault = () => {
    setSettings({ ...DEFAULT_PAUSE_SETTINGS });
  };

  const handleSave = () => {
    saveStoredPauseSettings(settings);
    onSave?.(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog: max-w-[680px] rộng rãi, bố cục thẻ tinh tế không bao giờ tràn viền */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-[680px] w-full p-6 z-10 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="relative flex items-center justify-center pb-4 border-b border-[#F0F2F9]">
          <h3 className="text-lg font-bold text-[#20213A] text-center">Thiết lập ngắt nghỉ</h3>
          <button
            onClick={onClose}
            className="absolute right-0 top-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#85879A] hover:text-[#20213A] hover:bg-[#F0F2F9] transition cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: Bố cục 2 cột dạng thẻ, nhãn không bị rớt dòng và các nút bấm cân đối */}
        <div className="py-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* 1. Dấu chấm */}
          <div className="flex items-center justify-between gap-3 bg-[#F8F9FD] border border-[#ECEFF8] rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
              <span className="w-6 h-6 rounded-md bg-white border border-[#E2E4F0] text-[#6255CF] flex items-center justify-center text-xs font-bold font-mono shadow-2xs shrink-0">
                •
              </span>
              <span className="text-sm font-semibold text-[#20213A] whitespace-nowrap">
                Dấu chấm
              </span>
            </div>

            <div className="w-[110px] flex items-center border border-[#D5D7E8] rounded-lg overflow-hidden bg-white shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => updateVal('period', -0.05)}
                className="w-7 h-7 flex items-center justify-center text-[#555870] hover:bg-[#F3F4FB] hover:text-[#6255CF] active:bg-[#E8EAF6] transition shrink-0 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 text-center text-xs font-bold text-[#20213A] border-x border-[#E2E4F0] py-1 font-mono">
                {settings.period.toFixed(2).replace(/\.?0+$/, '')}s
              </div>
              <button
                type="button"
                onClick={() => updateVal('period', 0.05)}
                className="w-7 h-7 flex items-center justify-center text-[#555870] hover:bg-[#F3F4FB] hover:text-[#6255CF] active:bg-[#E8EAF6] transition shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 2. Dấu phẩy */}
          <div className="flex items-center justify-between gap-3 bg-[#F8F9FD] border border-[#ECEFF8] rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
              <span className="w-6 h-6 rounded-md bg-white border border-[#E2E4F0] text-[#6255CF] flex items-center justify-center text-xs font-bold font-mono shadow-2xs shrink-0">
                ,
              </span>
              <span className="text-sm font-semibold text-[#20213A] whitespace-nowrap">
                Dấu phẩy
              </span>
            </div>

            <div className="w-[110px] flex items-center border border-[#D5D7E8] rounded-lg overflow-hidden bg-white shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => updateVal('comma', -0.05)}
                className="w-7 h-7 flex items-center justify-center text-[#555870] hover:bg-[#F3F4FB] hover:text-[#6255CF] active:bg-[#E8EAF6] transition shrink-0 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 text-center text-xs font-bold text-[#20213A] border-x border-[#E2E4F0] py-1 font-mono">
                {settings.comma.toFixed(2).replace(/\.?0+$/, '')}s
              </div>
              <button
                type="button"
                onClick={() => updateVal('comma', 0.05)}
                className="w-7 h-7 flex items-center justify-center text-[#555870] hover:bg-[#F3F4FB] hover:text-[#6255CF] active:bg-[#E8EAF6] transition shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3. Dấu chấm phẩy */}
          <div className="flex items-center justify-between gap-3 bg-[#F8F9FD] border border-[#ECEFF8] rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
              <span className="w-6 h-6 rounded-md bg-white border border-[#E2E4F0] text-[#6255CF] flex items-center justify-center text-xs font-bold font-mono shadow-2xs shrink-0">
                ;
              </span>
              <span className="text-sm font-semibold text-[#20213A] whitespace-nowrap">
                Dấu chấm phẩy
              </span>
            </div>

            <div className="w-[110px] flex items-center border border-[#D5D7E8] rounded-lg overflow-hidden bg-white shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => updateVal('semicolon', -0.05)}
                className="w-7 h-7 flex items-center justify-center text-[#555870] hover:bg-[#F3F4FB] hover:text-[#6255CF] active:bg-[#E8EAF6] transition shrink-0 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 text-center text-xs font-bold text-[#20213A] border-x border-[#E2E4F0] py-1 font-mono">
                {settings.semicolon.toFixed(2).replace(/\.?0+$/, '')}s
              </div>
              <button
                type="button"
                onClick={() => updateVal('semicolon', 0.05)}
                className="w-7 h-7 flex items-center justify-center text-[#555870] hover:bg-[#F3F4FB] hover:text-[#6255CF] active:bg-[#E8EAF6] transition shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 4. Xuống dòng */}
          <div className="flex items-center justify-between gap-3 bg-[#F8F9FD] border border-[#ECEFF8] rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
              <span className="w-6 h-6 rounded-md bg-white border border-[#E2E4F0] text-[#6255CF] flex items-center justify-center shrink-0">
                <AlignLeft className="w-3.5 h-3.5" />
              </span>
              <span className="text-sm font-semibold text-[#20213A] whitespace-nowrap">
                Xuống dòng
              </span>
            </div>

            <div className="w-[110px] flex items-center border border-[#D5D7E8] rounded-lg overflow-hidden bg-white shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => updateVal('newline', -0.05)}
                className="w-7 h-7 flex items-center justify-center text-[#555870] hover:bg-[#F3F4FB] hover:text-[#6255CF] active:bg-[#E8EAF6] transition shrink-0 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 text-center text-xs font-bold text-[#20213A] border-x border-[#E2E4F0] py-1 font-mono">
                {settings.newline.toFixed(2).replace(/\.?0+$/, '')}s
              </div>
              <button
                type="button"
                onClick={() => updateVal('newline', 0.05)}
                className="w-7 h-7 flex items-center justify-center text-[#555870] hover:bg-[#F3F4FB] hover:text-[#6255CF] active:bg-[#E8EAF6] transition shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions: Đặt mặc định + Lưu */}
        <div className="pt-4 border-t border-[#F0F2F9] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleResetDefault}
            className="px-5 py-2.5 rounded-xl border border-[#D5D7E8] text-[#3E4259] hover:bg-[#F4F5FB] font-semibold text-xs transition cursor-pointer"
          >
            Đặt mặc định
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-7 py-2.5 rounded-xl bg-[#6255CF] hover:bg-[#5144BD] text-white font-semibold text-xs transition shadow-md shadow-[#6255CF]/25 active:scale-95 cursor-pointer"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
};
