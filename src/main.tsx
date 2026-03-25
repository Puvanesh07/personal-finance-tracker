import './index.css';

import App from './App';
import AuthWrapper from './Auth/AuthWrapper';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import ReactDOM from 'react-dom/client';
// This virtual module is provided by vite-plugin-pwa to handle service worker registration
import { registerSW } from 'virtual:pwa-register';

/**
 * PWA Update Logic:
 * Since vite.config.ts is set to 'autoUpdate', this will automatically
 * check for new versions of the app and update the Service Worker.
 */
const updateSW = registerSW({
  onNeedRefresh() {
    // Optional: You can trigger a custom UI alert here to tell the user
    // "New content available, click to refresh", or just let autoUpdate handle it.
    if (confirm('New version available. Reload to update?')) {
      updateSW(true);
    }
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
