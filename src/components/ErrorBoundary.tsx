/**
 * ErrorBoundary — the last line of defence (finding #18: no error visibility).
 *
 * Before this, any throw during render unmounted the whole tree and left the
 * user on a blank white page with no clue what happened. This catches render
 * errors anywhere below it, shows a recoverable screen, and hands the details
 * to an optional reporter so a telemetry sink (Crashlytics/ Sentry / a custom
 * endpoint) can be plugged in later without touching call sites.
 *
 * Note: the production build drops console.* (vite esbuild.drop), so the
 * reporter — not a console.log — is what a real integration would use.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Invoked with the error + component stack. Must never throw. */
  report?: (error: Error, info: ErrorInfo) => void;
  /** Shown instead of the generic screen when provided. */
  fallback?: ReactNode;
}

type State = { error: Error | null };

export default class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      this.props.report?.(error, info);
    } catch {
      // A broken reporter must never turn one crash into two.
    }
  }

  private reset = () => this.setState({ error: null });

  private hardReload = () => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            FinTrackly hit an unexpected error on this screen. Your data is safe —
            try continuing, or reload if the problem persists.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {error.message || String(error)}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.hardReload}
              className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
