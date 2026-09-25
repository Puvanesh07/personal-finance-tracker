import './index.css';
import '@fontsource-variable/instrument-sans';

import App from './App';
import AuthWrapper from './Auth/AuthWrapper';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import ReactDOM from 'react-dom/client';
// This virtual module is provided by vite-plugin-pwa to handle service worker registration
import { registerSW } from 'virtual:pwa-register';

/** Recover from stale cached chunks after a new deployment. */
const CHUNK_RELOAD_KEY = 'fintrackly-chunk-reload';

function recoverFromStaleChunkLoad() {
  const reloadOnce = () => {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    window.location.reload();
  };

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnce();
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      typeof reason === 'string'
        ? reason
        : reason instanceof Error
          ? reason.message
          : '';
    if (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Importing a module script failed')
    ) {
      event.preventDefault();
      reloadOnce();
    }
  });
}

recoverFromStaleChunkLoad();

/**
 * Error visibility (finding #18). Firebase Crashlytics has no Web SDK, so this
 * is the lightweight surface: log render/async errors with enough context to
 * reproduce, in a single place a real telemetry sink can later replace. In
 * production `console.*` is stripped by the build, so this is a no-op there
 * unless a reporter endpoint is wired in — it never crashes the app itself.
 */
function reportError(error: unknown, source: string) {
  try {
    console.error(`[fintrackly:${source}]`, error);
  } catch {
    /* logging must never throw */
  }
}
window.addEventListener('error', (event) => reportError(event.error ?? event.message, 'window'));
window.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'promise'));

// This SPA manages scroll itself (AppLayout resets to the top on every route
// change), so disable the browser's native scroll restoration — otherwise it
// re-applies the previous offset on reload / back-forward and pages open lower
// down instead of at the top.
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

/**
 * PWA Update Logic:
 * Since vite.config.ts is set to 'autoUpdate', this will automatically
 * check for new versions of the app and update the Service Worker.
 */
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App is ready to work offline.');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary report={(error, info) => reportError(`${error.message}\n${info.componentStack}`, 'render')}>
      <BrowserRouter>
        <AuthWrapper>
          <App />
        </AuthWrapper>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
