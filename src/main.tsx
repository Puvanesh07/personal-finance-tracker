import './index.css';
import '@fontsource-variable/geist';

import App from './App';
import AuthWrapper from './Auth/AuthWrapper';
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
    <BrowserRouter>
      <AuthWrapper>
        <App />
      </AuthWrapper>
    </BrowserRouter>
  </React.StrictMode>,
);
