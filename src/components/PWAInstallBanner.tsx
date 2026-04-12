// src/components/PWAInstallBanner.tsx
//
// FIXES:
//  1. Use localStorage instead of sessionStorage so "dismissed" persists
//     across sessions — prevents banner showing every single visit
//  2. Add a 7-day cooldown after dismissal — banner won't re-appear for
//     a week, preventing the "shows 2–4 times per user" problem
//  3. Removed from AuthPage — this component is now only in AppLayout
//     so it only appears when the user is authenticated in the dashboard
//  4. iOS Chrome now shows its OWN install guide (top-right ⋮ → Add to Home Screen)
//     instead of redirecting users to Safari — Chrome on iOS supports PWA install
//     via the browser menu, no need to switch browsers

import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'pwa_install_dismissed_until';
const COOLDOWN_DAYS = 7; // don't show again for 7 days after dismiss

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
  );
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  return (
    isIOS() &&
    /Safari/.test(ua) &&
    !/CriOS/.test(ua) &&
    !/FxiOS/.test(ua) &&
    !/OPiOS/.test(ua)
  );
}

function isIOSChrome() {
  return isIOS() && /CriOS/.test(navigator.userAgent);
}

function isIOSFirefox() {
  return isIOS() && /FxiOS/.test(navigator.userAgent);
}

// Any iOS browser that isn't Safari, Chrome, or Firefox
// (Opera, Edge, etc.) — we show a generic "use Safari or Chrome" hint
function isIOSOtherBrowser() {
  return isIOS() && !isIOSSafari() && !isIOSChrome() && !isIOSFirefox();
}

function isDismissedRecently(): boolean {
  try {
    const until = localStorage.getItem(STORAGE_KEY);
    if (!until) return false;
    return Date.now() < parseInt(until, 10);
  } catch {
    return false;
  }
}

function setDismissedCooldown() {
  try {
    const until = Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(until));
  } catch {
    // ignore storage errors (private mode etc.)
  }
}

function clearDismissed() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Animated stars background ─────────────────────────────────────────────
function Stars() {
  return (
    <div className='absolute inset-0 overflow-hidden rounded-2xl pointer-events-none'>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className='absolute w-1 h-1 bg-emerald-400/40 rounded-full animate-pulse'
          style={{
            top: `${15 + i * 14}%`,
            left: `${10 + i * 15}%`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: `${1.5 + i * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}

export function PWAInstallBanner() {
  const [showIOSSafariGuide, setShowIOSSafariGuide] = useState(false);
  const [showIOSChromeGuide, setShowIOSChromeGuide] = useState(false);
  const [showIOSOtherBrowser, setShowIOSOtherBrowser] = useState(false);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Ensure we only fire the show logic once per component mount
  const hasSetup = useRef(false);

  useEffect(() => {
    if (hasSetup.current) return;
    hasSetup.current = true;

    // Already installed as PWA — never show banner
    if (isInStandaloneMode()) {
      setInstalled(true);
      return;
    }

    // User dismissed recently — respect the cooldown
    if (isDismissedRecently()) {
      setDismissed(true);
      return;
    }

    // Delay showing by 5 seconds so the user can orient themselves first
    const SHOW_DELAY = 5000;

    if (isIOSSafari()) {
      // Safari: Share button → Add to Home Screen
      const t = setTimeout(() => setShowIOSSafariGuide(true), SHOW_DELAY);
      return () => clearTimeout(t);
    } else if (isIOSChrome()) {
      // Chrome on iOS: top-right ⋮ menu → Add to Home Screen
      const t = setTimeout(() => setShowIOSChromeGuide(true), SHOW_DELAY);
      return () => clearTimeout(t);
    } else if (isIOSOtherBrowser()) {
      // Opera/Edge/etc on iOS — generic hint
      const t = setTimeout(() => setShowIOSOtherBrowser(true), SHOW_DELAY);
      return () => clearTimeout(t);
    } else {
      // Android / Desktop Chrome — listen for native install prompt
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setTimeout(() => setShowAndroidPrompt(true), SHOW_DELAY);
      };

      const installedHandler = () => {
        setShowSuccess(true);
        setShowAndroidPrompt(false);
        clearDismissed();
        setTimeout(() => setInstalled(true), 3000);
      };

      window.addEventListener('beforeinstallprompt', handler);
      window.addEventListener('appinstalled', installedHandler);

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        window.removeEventListener('appinstalled', installedHandler);
      };
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    setShowIOSSafariGuide(false);
    setShowIOSChromeGuide(false);
    setShowIOSOtherBrowser(false);
    setShowAndroidPrompt(false);
    setDeferredPrompt(null);
    setDismissedCooldown();
  }

  async function handleAndroidInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowAndroidPrompt(false);
        setDeferredPrompt(null);
        // appinstalled event will fire and handle the rest
      } else {
        // User declined the native prompt — dismiss with cooldown
        dismiss();
      }
    } catch {
      dismiss();
    } finally {
      setInstalling(false);
    }
  }

  if (installed || dismissed) return null;

  // ── Success Toast ────────────────────────────────────────────────────────
  if (showSuccess) {
    return (
      <div className='fixed bottom-24 left-0 right-0 z-[90] px-4 md:bottom-6'>
        <div className='max-w-sm mx-auto'>
          <div className='rounded-2xl bg-emerald-600 p-4 shadow-2xl shadow-emerald-500/30 flex items-center gap-3'>
            <div className='text-3xl'>🎉</div>
            <div>
              <div className='text-sm font-bold text-white'>
                Fintrackly Installed!
              </div>
              <div className='text-xs text-emerald-100 mt-0.5'>
                Find it on your home screen and enjoy!
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Android / Desktop Chrome — native install prompt ─────────────────────
  if (showAndroidPrompt) {
    return (
      <div className='fixed bottom-24 left-0 right-0 z-[90] px-3 md:bottom-6'>
        <div className='max-w-sm mx-auto'>
          <div className='relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50'>
            <div className='absolute inset-0 bg-gradient-to-br from-slate-50 dark:from-slate-900 via-slate-100 dark:via-slate-900 to-emerald-950' />
            <div className='absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent' />
            <Stars />
            <div className='absolute inset-0 rounded-2xl border border-emerald-500/40 shadow-[inset_0_0_30px_rgba(16,185,129,0.05)]' />

            <div className='relative p-4'>
              <button
                onClick={dismiss}
                className='absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-bold hover:bg-slate-300 dark:bg-slate-700'
                aria-label='Dismiss'
              >
                ×
              </button>

              <div className='flex items-center gap-3 mb-4'>
                <div className='relative'>
                  <div className='h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/40'>
                    <span className='text-2xl'>📊</span>
                  </div>
                  <div className='absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-md'>
                    <span className='text-[10px]'>✓</span>
                  </div>
                </div>
                <div>
                  <div className='text-base font-bold text-white leading-tight'>
                    Get Fintrackly App
                  </div>
                  <div className='text-xs text-emerald-400 font-semibold mt-0.5'>
                    Free · No ads · Private
                  </div>
                </div>
              </div>

              <div className='grid grid-cols-3 gap-2 mb-4'>
                {[
                  { emoji: '⚡', text: 'Instant\nAccess' },
                  { emoji: '📴', text: 'Works\nOffline' },
                  { emoji: '🔒', text: '100%\nPrivate' },
                ].map((f) => (
                  <div
                    key={f.text}
                    className='flex flex-col items-center gap-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700/50 py-2.5 px-1'
                  >
                    <span className='text-lg'>{f.emoji}</span>
                    <span className='text-[9px] text-slate-500 dark:text-slate-400 font-semibold text-center leading-tight whitespace-pre'>
                      {f.text}
                    </span>
                  </div>
                ))}
              </div>

              <div className='mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5'>
                <p className='text-xs text-emerald-300 text-center leading-relaxed'>
                  🌟 Track your stocks, farm income & net worth — right from
                  your home screen!
                </p>
              </div>

              <div className='flex gap-2'>
                <button
                  onClick={dismiss}
                  className='flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-300 dark:bg-slate-700 transition-colors'
                >
                  Maybe Later
                </button>
                <button
                  onClick={handleAndroidInstall}
                  disabled={installing}
                  className='flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-emerald-500 transition-all active:scale-95 disabled:opacity-70'
                >
                  {installing ? '⏳ Installing...' : '🚀 Install Free App'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── iPhone / iPad — Safari guide ─────────────────────────────────────────
  // Share button (□↑) at the bottom → Add to Home Screen
  if (showIOSSafariGuide) {
    return (
      <div className='fixed bottom-0 left-0 right-0 z-[90]'>
        <div className='mx-3 mb-2'>
          <div className='relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50'>
            <div className='absolute inset-0 bg-gradient-to-br from-slate-50 dark:from-slate-900 via-slate-100 dark:via-slate-900 to-blue-950' />
            <div className='absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent' />
            <div className='absolute inset-0 rounded-2xl border border-blue-500/30' />

            <div className='relative p-4'>
              <button
                onClick={dismiss}
                className='absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-bold'
                aria-label='Dismiss'
              >
                ×
              </button>

              <div className='flex items-center gap-3 mb-4'>
                <div className='h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30'>
                  <span className='text-2xl'>📱</span>
                </div>
                <div>
                  <div className='text-sm font-bold text-white'>
                    Install on iPhone · Safari
                  </div>
                  <div className='text-xs text-blue-400 font-semibold mt-0.5'>
                    3 easy steps — takes 10 seconds
                  </div>
                </div>
              </div>

              <div className='mb-4 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2'>
                <p className='text-xs text-blue-300 text-center leading-relaxed'>
                  🌟 Add Fintrackly to your home screen for instant access!
                </p>
              </div>

              <div className='grid grid-cols-3 gap-2 mb-4'>
                {[
                  {
                    emoji: '□↑',
                    title: 'Tap Share',
                    desc: 'Bottom toolbar',
                    color: 'from-blue-500 to-blue-600',
                  },
                  {
                    emoji: '➕',
                    title: 'Add to Home',
                    desc: 'Scroll & tap',
                    color: 'from-violet-500 to-violet-600',
                  },
                  {
                    emoji: '✅',
                    title: 'Tap Add',
                    desc: 'Top right corner',
                    color: 'from-emerald-500 to-emerald-600',
                  },
                ].map((s) => (
                  <div
                    key={s.title}
                    className='flex flex-col items-center gap-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700/50 py-3 px-1'
                  >
                    <div
                      className={`h-8 w-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center text-base shadow-sm`}
                    >
                      {s.emoji}
                    </div>
                    <div className='text-[10px] font-bold text-white text-center'>
                      {s.title}
                    </div>
                    <div className='text-[9px] text-slate-900 dark:text-slate-500 text-center'>
                      {s.desc}
                    </div>
                  </div>
                ))}
              </div>

              <div className='flex items-center justify-between'>
                <p className='text-[10px] text-slate-900 dark:text-slate-500'>
                  ⓘ Tap the □↑ Share icon at the bottom of Safari
                </p>
                <button
                  onClick={dismiss}
                  className='text-[10px] text-slate-900 dark:text-slate-500 underline'
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow pointing down to Safari toolbar */}
        <div className='flex justify-center pb-2'>
          <div className='flex flex-col items-center gap-1'>
            <div className='text-[10px] text-blue-400 font-bold animate-pulse'>
              Tap Share ↓
            </div>
            <div className='text-blue-400 text-xl animate-bounce'>↓</div>
          </div>
        </div>
      </div>
    );
  }

  // ── iPhone / iPad — Chrome guide ──────────────────────────────────────────
  // Top-right ⋮ menu → Add to Home Screen
  // Chrome on iOS fully supports PWA install — no need to switch to Safari
  if (showIOSChromeGuide) {
    return (
      <div className='fixed bottom-0 left-0 right-0 z-[90]'>
        <div className='mx-3 mb-3'>
          <div className='relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50'>
            <div className='absolute inset-0 bg-gradient-to-br from-slate-50 dark:from-slate-900 via-slate-100 dark:via-slate-900 to-indigo-950' />
            <div className='absolute inset-0 bg-gradient-to-t from-indigo-500/10 to-transparent' />
            <div className='absolute inset-0 rounded-2xl border border-indigo-500/30' />

            <div className='relative p-4'>
              <button
                onClick={dismiss}
                className='absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-bold'
                aria-label='Dismiss'
              >
                ×
              </button>

              <div className='flex items-center gap-3 mb-4'>
                <div className='h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30'>
                  <span className='text-2xl'>📱</span>
                </div>
                <div>
                  <div className='text-sm font-bold text-white'>
                    Install on iPhone · Chrome
                  </div>
                  <div className='text-xs text-indigo-400 font-semibold mt-0.5'>
                    3 easy steps — takes 10 seconds
                  </div>
                </div>
              </div>

              <div className='mb-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-3 py-2'>
                <p className='text-xs text-indigo-300 text-center leading-relaxed'>
                  🌟 Add Fintrackly to your home screen directly from Chrome!
                </p>
              </div>

              <div className='grid grid-cols-3 gap-2 mb-4'>
                {[
                  {
                    emoji: '⋮',
                    title: 'Tap Menu',
                    desc: 'Top right corner',
                    color: 'from-indigo-500 to-indigo-600',
                  },
                  {
                    emoji: '➕',
                    title: 'Add to Home',
                    desc: 'Tap in the list',
                    color: 'from-violet-500 to-violet-600',
                  },
                  {
                    emoji: '✅',
                    title: 'Tap Add',
                    desc: 'Confirm dialog',
                    color: 'from-emerald-500 to-emerald-600',
                  },
                ].map((s) => (
                  <div
                    key={s.title}
                    className='flex flex-col items-center gap-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700/50 py-3 px-1'
                  >
                    <div
                      className={`h-8 w-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center text-base shadow-sm font-bold text-white`}
                    >
                      {s.emoji}
                    </div>
                    <div className='text-[10px] font-bold text-white text-center'>
                      {s.title}
                    </div>
                    <div className='text-[9px] text-slate-900 dark:text-slate-500 text-center'>
                      {s.desc}
                    </div>
                  </div>
                ))}
              </div>

              <div className='flex items-center justify-between'>
                <p className='text-[10px] text-slate-900 dark:text-slate-500'>
                  ⓘ Tap the <span className='font-bold text-slate-500 dark:text-slate-400'>⋮</span>{' '}
                  icon at the top-right of Chrome
                </p>
                <button
                  onClick={dismiss}
                  className='text-[10px] text-slate-900 dark:text-slate-500 underline'
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow pointing up to Chrome menu */}
        <div className='absolute top-3 right-4 flex flex-col items-center gap-1 pointer-events-none'>
          <div
            className='text-indigo-400 text-xl animate-bounce'
            style={{ transform: 'rotate(180deg)' }}
          >
            ↓
          </div>
          <div className='text-[10px] text-indigo-400 font-bold animate-pulse'>
            Tap ⋮ here
          </div>
        </div>
      </div>
    );
  }

  // ── iPhone — Other browser (Opera, Edge, etc.) ────────────────────────────
  // Generic hint to use Chrome or Safari
  if (showIOSOtherBrowser) {
    return (
      <div className='fixed bottom-0 left-0 right-0 z-[90]'>
        <div className='mx-3 mb-3'>
          <div className='relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50'>
            <div className='absolute inset-0 bg-gradient-to-br from-slate-50 dark:from-slate-900 to-amber-950' />
            <div className='absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent' />
            <div className='absolute inset-0 rounded-2xl border border-amber-500/30' />

            <div className='relative p-4'>
              <button
                onClick={dismiss}
                className='absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-bold'
                aria-label='Dismiss'
              >
                ×
              </button>

              <div className='flex items-center gap-3 mb-3'>
                <div className='h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 text-2xl'>
                  📱
                </div>
                <div>
                  <div className='text-sm font-bold text-white'>
                    Install Fintrackly
                  </div>
                  <div className='text-xs text-amber-400 font-semibold mt-0.5'>
                    Open in Safari or Chrome to install
                  </div>
                </div>
              </div>

              <div className='mb-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5'>
                <p className='text-xs text-amber-200 leading-relaxed text-center'>
                  To add Fintrackly to your home screen, open this page in{' '}
                  <span className='font-bold text-white'>Safari</span> or{' '}
                  <span className='font-bold text-white'>Chrome</span> on your
                  iPhone.
                </p>
              </div>

              <div className='flex items-center gap-2'>
                <div className='flex-1 px-3 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-emerald-400 font-mono'>
                  fintrackly.web.app
                </div>
                <button
                  onClick={() =>
                    navigator.clipboard?.writeText('https://fintrackly.web.app')
                  }
                  className='px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 transition-all active:scale-95'
                >
                  📋 Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
