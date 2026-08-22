/**
 * src/components/InstallAppModal.tsx
 *
 * "Install App" modal — triggered from sidebar or Settings.
 * Mirrors the design from the reference image:
 *   - App icon + name + tagline
 *   - Feature bullets
 *   - Browser-specific instructions (Android native prompt / iOS Safari / iOS Chrome)
 *   - "Not now" dismiss
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiDownload, FiMonitor, FiSmartphone, FiX, FiZap } from 'react-icons/fi';

// ── Platform detection (same helpers as PWAInstallBanner) ────────────────────

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  return isIOS() && /Safari/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
}

function isIOSChrome() {
  return isIOS() && /CriOS/.test(navigator.userAgent);
}

// ── Modal component ───────────────────────────────────────────────────────────

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
}

export function InstallAppModal({ open, onClose }: InstallAppModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installing, setInstalling]         = useState(false);
  const [installed, setInstalled]           = useState(false);
  const promptCaptured = useRef(false);

  // Capture the native install prompt (Android / Desktop Chrome)
  useEffect(() => {
    if (promptCaptured.current) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      promptCaptured.current = true;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const handler = () => setInstalled(true);
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const alreadyInstalled = isInStandaloneMode() || installed;
  const ios              = isIOS();
  const iosSafari        = isIOSSafari();
  const iosChrome        = isIOSChrome();
  const canNativeInstall = !ios && !!deferredPrompt;

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        onClose();
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key='backdrop'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className='fixed inset-0 z-[400] bg-black/50 backdrop-blur-sm'
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key='modal'
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className='fixed inset-0 z-[401] flex items-center justify-center p-4 pointer-events-none'
          >
            <div
              className='pointer-events-auto w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-[0_24px_64px_-4px_rgba(0,0,0,0.35)] overflow-hidden'
              role='dialog'
              aria-modal='true'
              aria-label='Install Fintrackly'
            >
              {/* ── Header ── */}
              <div className='flex items-start gap-3 p-5 pb-4'>
                {/* App icon */}
                <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 text-white text-2xl select-none'>
                  📊
                </div>
                <div className='flex-1 min-w-0 pt-0.5'>
                  <p className='text-base font-bold text-slate-900 dark:text-slate-100 leading-tight'>
                    Install Fintrackly
                  </p>
                  <p className='text-xs text-slate-500 dark:text-slate-400 mt-0.5'>
                    Add to your home screen
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className='shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors'
                  aria-label='Close'
                >
                  <FiX className='h-4 w-4' />
                </button>
              </div>

              {/* ── Already installed ── */}
              {alreadyInstalled ? (
                <div className='px-5 pb-5'>
                  <div className='rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-500/30 p-4 text-center'>
                    <p className='text-2xl mb-2'>✅</p>
                    <p className='text-sm font-bold text-emerald-700 dark:text-emerald-400'>
                      Already Installed!
                    </p>
                    <p className='text-xs text-slate-500 dark:text-slate-400 mt-1'>
                      Fintrackly is running as an installed app.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className='mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  {/* ── Feature bullets ── */}
                  <div className='px-5 pb-3 space-y-2'>
                    {[
                      { icon: FiZap,       text: 'Opens instantly — no browser, no tabs' },
                      { icon: FiMonitor,   text: 'Faster loads with offline caching' },
                      { icon: FiSmartphone,text: 'Same app, same data — nothing changes' },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className='flex items-center gap-2.5 text-[12.5px] text-slate-600 dark:text-slate-300'>
                        <Icon className='h-3.5 w-3.5 shrink-0 text-emerald-500' />
                        {text}
                      </div>
                    ))}
                  </div>

                  <div className='mx-5 my-3 border-t border-slate-100 dark:border-slate-800' />

                  {/* ── Instructions ── */}
                  <div className='px-5 pb-4'>
                    <p className='text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3'>
                      To install, use your browser menu:
                    </p>

                    {/* Android / Desktop — native prompt available */}
                    {canNativeInstall && (
                      <button
                        onClick={handleNativeInstall}
                        disabled={installing}
                        className='w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 py-3 text-sm font-bold text-white transition-colors shadow-md shadow-emerald-500/20 mb-3'
                      >
                        <FiDownload className='h-4 w-4' />
                        {installing ? 'Installing…' : 'Install App'}
                      </button>
                    )}

                    {/* iOS Safari */}
                    {(iosSafari || (!canNativeInstall && !ios)) && (
                      <div className='space-y-2'>
                        <InstallStep
                          num={1}
                          icon='⋮'
                          text={
                            iosSafari
                              ? <>Tap the <strong className='text-slate-800 dark:text-slate-200'>□↑ Share</strong> button in Safari</>
                              : <>Tap the <strong className='text-slate-800 dark:text-slate-200'>⋮ menu</strong> in your browser</>
                          }
                        />
                        <InstallStep
                          num={2}
                          icon='➕'
                          text={
                            <>Tap <strong className='text-slate-800 dark:text-slate-200'>Install app</strong> or <strong className='text-slate-800 dark:text-slate-200'>Add to Home Screen</strong></>
                          }
                        />
                      </div>
                    )}

                    {/* iOS Chrome */}
                    {iosChrome && !iosSafari && (
                      <div className='space-y-2'>
                        <InstallStep
                          num={1}
                          icon='⋮'
                          text={<>Tap the <strong className='text-slate-800 dark:text-slate-200'>⋮ menu</strong> at the top right of Chrome</>}
                        />
                        <InstallStep
                          num={2}
                          icon='➕'
                          text={<>Tap <strong className='text-slate-800 dark:text-slate-200'>Add to Home Screen</strong></>}
                        />
                      </div>
                    )}

                    {/* Prompt ready indicator */}
                    {!canNativeInstall && !ios && (
                      <div className='mt-3 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500'>
                        <span className='h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse' />
                        Prompt ready ✓
                      </div>
                    )}
                  </div>

                  {/* ── Footer ── */}
                  <div className='border-t border-slate-100 dark:border-slate-800 px-5 py-3'>
                    <button
                      onClick={onClose}
                      className='w-full text-sm font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1'
                    >
                      Not now
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Step row ──────────────────────────────────────────────────────────────────

function InstallStep({
  num,
  text,
}: {
  num: number;
  icon?: string;
  text: React.ReactNode;
}) {
  return (
    <div className='flex items-start gap-3'>
      <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-[10px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5'>
        {num}
      </span>
      <p className='text-[12.5px] text-slate-600 dark:text-slate-300 leading-relaxed'>
        {text}
      </p>
    </div>
  );
}
