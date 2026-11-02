import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary bắt được lỗi:', error, errorInfo);
  }

  private handleReset = () => {
    // Xóa cache localStorage nếu nghi ngờ dữ liệu hỏng
    try {
      this.setState({ hasError: false, error: null });
      window.location.reload();
    } catch {}
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center p-6 text-[#20213A]">
          <div className="bg-white rounded-2xl border border-[#E8E8F0] shadow-xl p-8 max-w-md w-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold mb-2">Đã xảy ra sự cố hiển thị</h2>
            <p className="text-xs text-[#85879A] mb-6 leading-relaxed">
              Hệ thống đã tự động ngăn chặn màn hình trắng. Bạn có thể nhấn nút bên dưới để làm mới ứng dụng.
            </p>
            {this.state.error && (
              <div className="text-left font-mono text-[11px] bg-[#F8F9FD] border border-[#EAEBF5] p-3 rounded-xl mb-6 text-red-600 break-words max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full py-3 rounded-xl bg-[#6255CF] hover:bg-[#5144BD] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-[#6255CF]/20 transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Tải lại trang</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

