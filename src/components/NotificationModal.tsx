import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, HelpCircle, X } from 'lucide-react';

export type NotificationType = 'success' | 'warning' | 'error' | 'info' | 'confirm';

export interface NotificationModalData {
  type: NotificationType;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface NotificationModalProps {
  data: NotificationModalData | null;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ data, onClose }) => {
  useEffect(() => {
    if (!data) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (data.onCancel) {
          data.onCancel();
        }
        onClose();
      } else if (e.key === 'Enter') {
        if (data.action) {
          data.action.onClick();
          onClose();
        } else if (data.onConfirm) {
          data.onConfirm();
          onClose();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, onClose]);

  if (!data) return null;

  const getIcon = () => {
    switch (data.type) {
      case 'success':
        return <CheckCircle2 className="w-7 h-7 text-emerald-600" />;
      case 'warning':
        return <AlertCircle className="w-7 h-7 text-amber-500" />;
      case 'error':
        return <AlertTriangle className="w-7 h-7 text-rose-600" />;
      case 'confirm':
        return <HelpCircle className="w-7 h-7 text-[#6255CF]" />;
      case 'info':
      default:
        return <Info className="w-7 h-7 text-[#6255CF]" />;
    }
  };

  const getIconBg = () => {
    switch (data.type) {
      case 'success':
        return 'bg-emerald-50 border-emerald-100';
      case 'warning':
        return 'bg-amber-50 border-amber-100';
      case 'error':
        return 'bg-rose-50 border-rose-100';
      case 'confirm':
        return 'bg-indigo-50 border-indigo-100';
      case 'info':
      default:
        return 'bg-purple-50 border-purple-100';
    }
  };

  const getDefaultTitle = () => {
    switch (data.type) {
      case 'success':
        return 'Thành công';
      case 'warning':
        return 'Lưu ý';
      case 'error':
        return 'Lỗi';
      case 'confirm':
        return 'Xác nhận';
      case 'info':
      default:
        return 'Thông báo';
    }
  };

  const title = data.title || getDefaultTitle();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => {
          if (data.onCancel) data.onCancel();
          onClose();
        }}
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-[390px] w-full p-5 z-10 transition-all transform animate-in zoom-in-95 fade-in duration-200 overflow-hidden"
      >
        {/* Top Close Button */}
        <button
          onClick={() => {
            if (data.onCancel) data.onCancel();
            onClose();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          aria-label="Đóng popup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Icon Badge */}
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 mb-3 shadow-xs ${getIconBg()}`}
          >
            {getIcon()}
          </div>

          {/* Text Content */}
          <div className="w-full text-center">
            <h3 className="text-base font-bold text-[#20213A] text-center">{title}</h3>
            <div className="mt-2 text-sm text-[#555870] leading-relaxed break-words whitespace-pre-line text-center">
              {data.message}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-center gap-2.5">
          {data.type === 'confirm' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (data.onCancel) data.onCancel();
                  onClose();
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition"
              >
                {data.cancelText || 'Hủy'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (data.onConfirm) data.onConfirm();
                  onClose();
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold text-xs transition shadow-sm"
              >
                {data.confirmText || 'Đồng ý'}
              </button>
            </>
          ) : (
            <>
              {data.action ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs transition"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      data.action!.onClick();
                      onClose();
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#6255CF] hover:bg-[#5144BD] active:scale-95 text-white font-semibold text-xs transition shadow-md shadow-[#6255CF]/20"
                  >
                    {data.action.label}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#6255CF] hover:bg-[#5144BD] active:scale-95 text-white font-semibold text-xs transition shadow-md shadow-[#6255CF]/20"
                >
                  {data.confirmText || 'Đóng'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

