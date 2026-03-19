// src/pages/Settings/SettingsPage.tsx
// UPDATED: Attractive, user-friendly layout with cleaner sections
//          Install App card opens the PWA install prompt or links to correct tab

import {
  FiCheckCircle,
  FiDownload,
  FiExternalLink,
  FiLogOut,
  FiMail,
  FiSettings,
  FiSmartphone,
  FiUser,
} from 'react-icons/fi';
import { useEffect, useState } from 'react';

import { DataManagement } from '../../components/settings/DataManagement';
import { EssentialsSettings } from '../../components/settings/EssentialsSettings';
import { Modal } from '../../components/ui/Modal';
import { NotionSettings } from '../../components/settings/NotionSettings';
import { auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';

export function SettingsPage() {
  const user = auth.currentUser;
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompted, setInstallPrompted] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches)
      setIsInstalled(true);
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    return () =>
      window.removeEventListener(
        'beforeinstallprompt',
        handler as EventListener,
      );
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
    setInstallPrompted(true);
  };

  const confirmLogout = async () => {
    try {
      await signOut(auth);
      setLogoutOpen(false);
    } catch {}
  };

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);

  return (
    <div className='flex flex-col gap-6 pb-10'>
      {/* Header */}
      <header className='flex items-center gap-4 rounded-2xl bg-gradient-to-r from-slate-800/80 to-slate-900/40 p-5 border border-slate-700/60 shadow-sm'>
        <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg'>
          <FiSettings className='h-6 w-6' />
        </div>
        <div>
          <h1 className='text-2xl font-bold text-white'>Settings</h1>
          <p className='text-sm text-slate-400 mt-0.5'>
            Manage your account, data, integrations, and app installation.
          </p>
        </div>
      </header>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3'>
        {/* ── User Profile ── */}
        <div className='flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm'>
          <div className='flex items-center justify-between border-b border-slate-800/60 pb-4'>
            <div className='flex items-center gap-2.5'>
              <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800'>
                <FiUser className='h-4 w-4 text-slate-400' />
              </div>
              <h2 className='text-base font-bold text-slate-100'>
                User Profile
              </h2>
            </div>
            <button
              onClick={() => setLogoutOpen(true)}
              className='flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors'
            >
              <FiLogOut className='h-3 w-3' /> Sign Out
            </button>
          </div>

          {/* Avatar */}
          <div className='flex items-center gap-4'>
            <div className='relative shrink-0'>
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt='Profile'
                  className='h-16 w-16 rounded-full border-2 border-emerald-500/30 object-cover shadow-xl'
                />
              ) : (
                <div className='flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 border-2 border-slate-700'>
                  <FiUser className='h-7 w-7 text-slate-400' />
                </div>
              )}
              <span className='absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-slate-900 bg-emerald-500' />
            </div>
            <div className='min-w-0'>
              <p className='font-bold text-slate-100 truncate'>
                {user?.displayName || 'FinTrackly User'}
              </p>
              <p className='flex items-center gap-1 text-xs text-slate-400 mt-0.5 truncate'>
                <FiMail className='h-3 w-3 shrink-0' />{' '}
                {user?.email || 'No email'}
              </p>
              <span className='mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full'>
                <FiCheckCircle className='h-3 w-3' /> Google Auth
              </span>
            </div>
          </div>

          {/* UID */}
          <div className='rounded-xl bg-slate-800/50 px-4 py-3'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1'>
              User ID
            </p>
            <p className='font-mono text-xs text-emerald-400 break-all'>
              {user?.uid?.slice(0, 12)}…
            </p>
            <p className='text-[10px] text-slate-500 mt-1'>
              Your data is encrypted and synced via Firebase.
            </p>
          </div>
        </div>

        {/* ── Install App ── */}
        <div className='flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm'>
          <div className='flex items-center gap-2.5 border-b border-slate-800/60 pb-4'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800'>
              <FiSmartphone className='h-4 w-4 text-slate-400' />
            </div>
            <h2 className='text-base font-bold text-slate-100'>Install App</h2>
          </div>

          <p className='text-sm text-slate-400'>
            Add FinTrackly to your home screen for instant access. Works like a
            native app — offline support, no browser UI.
          </p>

          {isInstalled ? (
            <div className='flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3'>
              <FiCheckCircle className='h-5 w-5 shrink-0 text-emerald-400' />
              <div>
                <p className='text-sm font-bold text-emerald-300'>
                  App Installed ✓
                </p>
                <p className='text-xs text-emerald-400/70 mt-0.5'>
                  FinTrackly is running as a native app.
                </p>
              </div>
            </div>
          ) : deferredPrompt ? (
            <button
              onClick={handleInstall}
              className='flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-500 hover:to-emerald-600 transition-all'
            >
              <FiDownload className='h-4 w-4' />
              Install FinTrackly
            </button>
          ) : (
            <div className='flex flex-col gap-3'>
              {/* Android step */}
              <div className='flex items-start gap-3 rounded-xl bg-slate-800/50 px-4 py-3'>
                <span className='text-lg shrink-0'>🤖</span>
                <div>
                  <p className='text-xs font-bold text-slate-200'>
                    Android / Chrome
                  </p>
                  <p className='text-xs text-slate-400 mt-0.5'>
                    Tap the <strong className='text-slate-200'>⋮ menu</strong> →{' '}
                    <strong className='text-slate-200'>
                      "Add to Home screen"
                    </strong>
                  </p>
                  {isAndroid && (
                    <button
                      onClick={() =>
                        window.open(window.location.href, '_blank')
                      }
                      className='mt-2 flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors'
                    >
                      Open in Chrome <FiExternalLink className='h-3 w-3' />
                    </button>
                  )}
                </div>
              </div>

              {/* iOS step */}
              <div className='flex items-start gap-3 rounded-xl bg-slate-800/50 px-4 py-3'>
                <span className='text-lg shrink-0'>🍎</span>
                <div>
                  <p className='text-xs font-bold text-slate-200'>
                    iPhone / Safari
                  </p>
                  <p className='text-xs text-slate-400 mt-0.5'>
                    Tap <strong className='text-slate-200'>Share ⬆</strong> →{' '}
                    <strong className='text-slate-200'>
                      "Add to Home Screen"
                    </strong>
                  </p>
                  {isIOS && (
                    <button
                      onClick={() =>
                        window.open(window.location.href, '_blank')
                      }
                      className='mt-2 flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors'
                    >
                      Open in Safari <FiExternalLink className='h-3 w-3' />
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop step */}
              <div className='flex items-start gap-3 rounded-xl bg-slate-800/50 px-4 py-3'>
                <span className='text-lg shrink-0'>💻</span>
                <div>
                  <p className='text-xs font-bold text-slate-200'>
                    Desktop Chrome / Edge
                  </p>
                  <p className='text-xs text-slate-400 mt-0.5'>
                    Click{' '}
                    <strong className='text-slate-200'>⊕ install icon</strong>{' '}
                    in the address bar
                  </p>
                </div>
              </div>
            </div>
          )}

          {installPrompted && !isInstalled && (
            <p className='text-xs text-slate-500 text-center'>
              Prompt dismissed — refresh the page to try again.
            </p>
          )}
        </div>

        {/* ── Other Sections ── */}
        <NotionSettings />
        <EssentialsSettings />
        <DataManagement />
      </div>

      {/* Logout Modal */}
      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title='Confirm Sign Out'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-400'>
            Are you sure you want to sign out?
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-5'>
            <button
              onClick={() => setLogoutOpen(false)}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800'
            >
              Cancel
            </button>
            <button
              onClick={confirmLogout}
              className='rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700'
            >
              Yes, Sign Out
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
