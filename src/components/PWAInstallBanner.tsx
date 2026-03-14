import { useEffect, useState } from 'react';

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

function isIOSOtherBrowser() {
  return isIOS() && !isIOSSafari();
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
  const [showIOSWrongBrowser, setShowIOSWrongBrowser] = useState(false);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) {
      setInstalled(true);
      return;
    }
    if (sessionStorage.getItem('pwa_dismissed')) return;

    if (isIOSSafari()) {
      const t = setTimeout(() => setShowIOSSafariGuide(true), 4000);
      return () => clearTimeout(t);
    } else if (isIOSOtherBrowser()) {
      const t = setTimeout(() => setShowIOSWrongBrowser(true), 4000);
      return () => clearTimeout(t);
    } else {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowAndroidPrompt(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      window.addEventListener('appinstalled', () => {
        setShowSuccess(true);
        setShowAndroidPrompt(false);
        setTimeout(() => setInstalled(true), 3000);
      });
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    setShowIOSSafariGuide(false);
    setShowIOSWrongBrowser(false);
    setShowAndroidPrompt(false);
    sessionStorage.setItem('pwa_dismissed', '1');
  }

  async function handleAndroidInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    if (outcome === 'accepted') {
      setShowAndroidPrompt(false);
      setDeferredPrompt(null);
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

  // ── Android Install Banner ───────────────────────────────────────────────
  if (showAndroidPrompt) {
    return (
      <div className='fixed bottom-24 left-0 right-0 z-[90] px-3 md:bottom-6'>
        <div className='max-w-sm mx-auto'>
          <div className='relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50'>
            {/* gradient background */}
            <div className='absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950' />
            <div className='absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent' />
            <Stars />

            {/* border glow */}
            <div className='absolute inset-0 rounded-2xl border border-emerald-500/40 shadow-[inset_0_0_30px_rgba(16,185,129,0.05)]' />

            <div className='relative p-4'>
              {/* Close button */}
              <button
                onClick={dismiss}
                className='absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full bg-slate-800/80 text-slate-400 text-xs font-bold hover:bg-slate-700'
              >
                ×
              </button>

              {/* Top section */}
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

              {/* Features row */}
              <div className='grid grid-cols-3 gap-2 mb-4'>
                {[
                  { emoji: '⚡', text: 'Instant\nAccess' },
                  { emoji: '📴', text: 'Works\nOffline' },
                  { emoji: '🔒', text: '100%\nPrivate' },
                ].map((f) => (
                  <div
                    key={f.text}
                    className='flex flex-col items-center gap-1 rounded-xl bg-slate-800/60 border border-slate-700/50 py-2.5 px-1'
                  >
                    <span className='text-lg'>{f.emoji}</span>
                    <span className='text-[9px] text-slate-400 font-semibold text-center leading-tight whitespace-pre'>
                      {f.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Message */}
              <div className='mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5'>
                <p className='text-xs text-emerald-300 text-center leading-relaxed'>
                  🌟 Track your stocks, farm income & net worth — right from
                  your home screen!
                </p>
              </div>

              {/* Buttons */}
              <div className='flex gap-2'>
                <button
                  onClick={dismiss}
                  className='flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-colors'
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

  // ── iPhone Safari — 3 step guide ────────────────────────────────────────
  if (showIOSSafariGuide) {
    return (
      <div className='fixed bottom-0 left-0 right-0 z-[90]'>
        <div className='mx-3 mb-2'>
          <div className='relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50'>
            <div className='absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950' />
            <div className='absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent' />
            <div className='absolute inset-0 rounded-2xl border border-blue-500/30' />

            <div className='relative p-4'>
              {/* Close */}
              <button
                onClick={dismiss}
                className='absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full bg-slate-800/80 text-slate-400 text-xs font-bold'
              >
                ×
              </button>

              {/* Header */}
              <div className='flex items-center gap-3 mb-4'>
                <div className='h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30'>
                  <span className='text-2xl'>📱</span>
                </div>
                <div>
                  <div className='text-sm font-bold text-white'>
                    Install on iPhone
                  </div>
                  <div className='text-xs text-blue-400 font-semibold mt-0.5'>
                    3 easy steps — takes 10 seconds
                  </div>
                </div>
              </div>

              {/* Message */}
              <div className='mb-4 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2'>
                <p className='text-xs text-blue-300 text-center leading-relaxed'>
                  🌟 Add Fintrackly to your home screen for instant access to
                  your portfolio anytime!
                </p>
              </div>

              {/* Steps */}
              <div className='grid grid-cols-3 gap-2 mb-4'>
                {[
                  {
                    step: '1',
                    emoji: '□↑',
                    title: 'Tap Share',
                    desc: 'Bottom of Safari',
                    color: 'from-blue-500 to-blue-600',
                  },
                  {
                    step: '2',
                    emoji: '➕',
                    title: 'Add to Home',
                    desc: 'Scroll & tap',
                    color: 'from-violet-500 to-violet-600',
                  },
                  {
                    step: '3',
                    emoji: '✅',
                    title: 'Tap Add',
                    desc: 'Top right corner',
                    color: 'from-emerald-500 to-emerald-600',
                  },
                ].map((s) => (
                  <div
                    key={s.step}
                    className='flex flex-col items-center gap-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50 py-3 px-1'
                  >
                    <div
                      className={`h-8 w-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center text-base shadow-sm`}
                    >
                      {s.emoji}
                    </div>
                    <div className='text-[10px] font-bold text-white text-center'>
                      {s.title}
                    </div>
                    <div className='text-[9px] text-slate-500 text-center'>
                      {s.desc}
                    </div>
                  </div>
                ))}
              </div>

              <p className='text-[10px] text-slate-500 text-center'>
                ⓘ Safari only — tap the □↑ icon below
              </p>
            </div>
          </div>
        </div>

        {/* Arrow pointing to Safari share button */}
        <div className='flex justify-center pb-2'>
          <div className='flex flex-col items-center gap-1'>
            <div className='text-[10px] text-emerald-400 font-bold animate-pulse'>
              Tap here ↓
            </div>
            <div className='text-emerald-400 text-xl animate-bounce'>↓</div>
          </div>
        </div>
      </div>
    );
  }

  // ── iPhone Wrong Browser ─────────────────────────────────────────────────
  if (showIOSWrongBrowser) {
    return (
      <div className='fixed bottom-0 left-0 right-0 z-[90]'>
        <div className='mx-3 mb-3'>
          <div className='relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50'>
            <div className='absolute inset-0 bg-gradient-to-br from-slate-900 to-amber-950' />
            <div className='absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent' />
            <div className='absolute inset-0 rounded-2xl border border-amber-500/30' />

            <div className='relative p-4'>
              <button
                onClick={dismiss}
                className='absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full bg-slate-800/80 text-slate-400 text-xs font-bold'
              >
                ×
              </button>

              {/* Header */}
              <div className='flex items-center gap-3 mb-3'>
                <div className='h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 text-2xl'>
                  🧭
                </div>
                <div>
                  <div className='text-sm font-bold text-white'>
                    One small step needed
                  </div>
                  <div className='text-xs text-amber-400 font-semibold mt-0.5'>
                    Open in Safari to install
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className='mb-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5'>
                <p className='text-xs text-amber-200 leading-relaxed text-center'>
                  🍎 Apple only allows app install from{' '}
                  <span className='font-bold text-white'>Safari browser</span>.
                  You're using Chrome right now.
                </p>
              </div>

              {/* Steps */}
              <div className='flex items-center gap-2 mb-3'>
                {[
                  { n: '1', text: 'Copy link below' },
                  { n: '2', text: 'Open Safari' },
                  { n: '3', text: 'Paste & install' },
                ].map((s, i) => (
                  <div key={s.n} className='flex items-center gap-2'>
                    <div className='flex items-center gap-1.5'>
                      <div className='h-5 w-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px] font-bold text-amber-400'>
                        {s.n}
                      </div>
                      <span className='text-[10px] text-slate-400'>
                        {s.text}
                      </span>
                    </div>
                    {i < 2 && <span className='text-slate-600 text-xs'>›</span>}
                  </div>
                ))}
              </div>

              {/* Copy URL */}
              <div className='flex items-center gap-2'>
                <div className='flex-1 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-emerald-400 font-mono'>
                  fintrackly.web.app
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      'https://fintrackly.web.app',
                    );
                  }}
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
