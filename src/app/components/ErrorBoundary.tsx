import { Component, ReactNode, ErrorInfo } from 'react';
import { copyToClipboard } from '../lib/clipboard';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional label for context (e.g. "PlanPage") */
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error(`[ErrorBoundary${this.props.context ? ` / ${this.props.context}` : ''}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleCopy = () => {
    const msg = `Error: ${this.state.error?.message}\n\nStack:\n${this.state.error?.stack ?? ''}\n\nComponent:\n${this.state.errorInfo?.componentStack ?? ''}`;
    copyToClipboard(msg);
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const { error } = this.state;

    return (
      <div
        style={{ fontFamily: "'Inter', sans-serif" }}
        className="min-h-screen bg-[#f0f9ff] dark:bg-[#060d1e] flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-100 to-red-50 dark:from-red-500/20 dark:to-red-500/5 border border-red-200 dark:border-red-500/25 flex items-center justify-center">
                <svg className="w-9 h-9 text-red-500" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {/* Animated pulse ring */}
              <div className="absolute inset-0 rounded-3xl border border-red-400/30 dark:border-red-500/20 animate-ping" />
            </div>
          </div>

          {/* Text */}
          <div className="text-center mb-6">
            <h2
              style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1.375rem' }}
              className="text-slate-900 dark:text-white mb-2"
            >
              Что-то пошло не так
            </h2>
            <p className="text-slate-500 dark:text-white/50 text-sm leading-relaxed">
              Произошла непредвиденная ошибка. Ваши данные сохранены — попробуйте перезагрузить страницу.
            </p>
          </div>

          {/* Error details (collapsible) */}
          {error && (
            <details className="mb-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
              <summary className="px-4 py-3 text-sm text-slate-500 dark:text-white/50 cursor-pointer select-none hover:text-slate-700 dark:hover:text-white/70 transition-colors">
                Детали ошибки
              </summary>
              <div className="px-4 pb-4">
                <div className="mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <p className="text-xs font-mono text-red-700 dark:text-red-400 break-all leading-relaxed">
                    {error.message}
                  </p>
                </div>
              </div>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={this.handleCopy}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
            >
              Скопировать лог
            </button>
            <button
              onClick={this.handleReset}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#1e40af] text-white text-sm hover:opacity-90 transition-all shadow-md shadow-[#1d4ed8]/20"
              style={{ fontWeight: 600 }}
            >
              Перезагрузить
            </button>
          </div>

          {/* Go home */}
          <div className="mt-4 text-center">
            <a
              href="/dashboard"
              className="text-xs text-slate-400 dark:text-white/30 hover:text-[#1d4ed8] transition-colors"
            >
              ← Вернуться к списку планов
            </a>
          </div>
        </div>
      </div>
    );
  }
}