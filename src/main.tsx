import './index.css';

import App from './App';
import AuthWrapper from './Auth/AuthWrapper';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import ReactDOM from 'react-dom/client';

// ── FIX: BrowserRouter must wrap AuthWrapper so routing context
//        is available before auth state resolves. Without this,
//        navigating to /dashboard briefly shows the auth page.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthWrapper>
        <App />
      </AuthWrapper>
    </BrowserRouter>
  </React.StrictMode>,
);

// ── Register Service Worker (PWA offline support) ──────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  });
}
