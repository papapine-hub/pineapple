import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || '알 수 없는 오류가 발생했습니다.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught application error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string };
        if (parsed.error) {
          friendlyMessage = `데이터 동기화 중 권한 또는 연결 오류가 발생했습니다 (${parsed.operationType ?? 'sync'}): ${parsed.error}`;
        }
      } catch {
        // Non-JSON error message
      }

      return (
        <div className="min-h-screen bg-[#f3f7f2] px-4 py-12 flex items-center justify-center text-[#1b2b21]">
          <div className="w-full max-w-md rounded-2xl border border-[#d1dfd0] bg-white p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-[#2d573b]">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h1 className="text-base font-bold">작업실 연결을 복구해 주세요</h1>
            </div>
            <p className="text-xs leading-relaxed text-[#496051] break-words">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b6e4c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              새로고침하여 다시 연결
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
