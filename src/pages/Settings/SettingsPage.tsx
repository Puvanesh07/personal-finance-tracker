import {
  FiCheckCircle,
  FiDownload,
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
    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handler as EventListener,
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setInstallPrompted(true);
  };

  const handleSignOut = () => {
    setLogoutOpen(true);
  };

  const confirmLogout = async () => {
    try {
      await signOut(auth);
      setLogoutOpen(false);
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  return (
    <div className='flex flex-col gap-6 pb-8'>
      {/* Premium Gradient Header */}
      <header className='flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg shadow-slate-500/30 dark:from-slate-700 dark:to-slate-900'>
            <FiSettings className='h-6 w-6' />
          </div>

          <div>
            <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white'>
              Settings
            </h1>

            <p className='mt-1 text-sm font-medium text-slate-600 dark:text-slate-300'>
              Manage application data, local storage, and integrations.
            </p>
          </div>
        </div>
      </header>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3'>
        {/* User Profile */}
        <div className='flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-bold text-slate-900 dark:text-white'>
              User Profile
            </h2>

            <button
              onClick={handleSignOut}
              className='flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20'
            >
              <FiLogOut className='h-3.5 w-3.5' />
              Sign Out
            </button>
          </div>

          <div className='flex flex-col items-center gap-4 py-4'>
            <div className='relative'>
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt='Profile'
                  className='h-20 w-20 rounded-full border-4 border-emerald-500/20 object-cover shadow-xl'
                />
              ) : (
                <div className='flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800'>
                  <FiUser className='h-10 w-10 text-slate-400' />
                </div>
              )}

              <div className='absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900'></div>
            </div>

            <div className='text-center'>
              <h3 className='text-xl font-bold text-slate-900 dark:text-white'>
                {user?.displayName || 'FinTrackly User'}
              </h3>

              <div className='mt-1 flex items-center justify-center gap-1.5 text-sm text-slate-500 dark:text-slate-400'>
                <FiMail className='h-3.5 w-3.5' />
                {user?.email || 'No email linked'}
              </div>
            </div>
          </div>

          <div className='rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50'>
            <p className='text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              Account Security
            </p>

            <p className='mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400'>
              Logged in via Google Authentication. Your data is encrypted and
              tied to your unique User ID:
              <span className='ml-1 font-mono text-emerald-600 dark:text-emerald-400'>
                {user?.uid.slice(0, 8)}...
              </span>
            </p>
          </div>
        </div>

        {/* Other Sections */}
        <NotionSettings />
        <EssentialsSettings />
        <DataManagement />

        {/* Install App */}
        <div className='flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50'>
          <div className='flex items-center gap-2'>
            <FiSmartphone className='h-5 w-5 text-slate-500 dark:text-slate-400' />
            <h2 className='text-lg font-bold text-slate-900 dark:text-white'>
              Install App
            </h2>
          </div>

          <div className='h-px w-full bg-slate-200/60 dark:bg-slate-800/60' />

          <p className='text-xs text-slate-500 dark:text-slate-400 leading-relaxed'>
            Add this app to your home screen for instant access. Opens like a
            native app with no browser tabs.
          </p>

          {isInstalled ? (
            <div className='flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10'>
              <FiCheckCircle className='h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400' />
              <div>
                <p className='text-sm font-bold text-emerald-700 dark:text-emerald-300'>
                  App Installed
                </p>
                <p className='text-xs text-emerald-600 dark:text-emerald-400 mt-0.5'>
                  FinTrackly is installed on your device.
                </p>
              </div>
            </div>
          ) : deferredPrompt ? (
            <button
              onClick={handleInstall}
              className='flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/50 px-4 py-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400'
            >
              <FiDownload className='h-4 w-4' />
              Install App
            </button>
          ) : installPrompted ? (
            <div className='rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50'>
              <p className='text-xs text-slate-500 dark:text-slate-400 text-center'>
                Installation prompt was dismissed. Refresh the page to try
                again.
              </p>
            </div>
          ) : (
            <div className='rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50'>
              <p className='text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2'>
                How to Install
              </p>
              <ul className='space-y-1 text-xs text-slate-500 dark:text-slate-400'>
                <li>
                  • <strong>Chrome / Edge:</strong> Click the install icon (⊕)
                  in the address bar
                </li>
                <li>
                  • <strong>Safari (iOS):</strong> Tap Share → "Add to Home
                  Screen"
                </li>
                <li>
                  • <strong>Firefox:</strong> Tap the menu → "Install"
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}

      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title='Confirm Sign Out'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-500 dark:text-slate-300'>
            Are you sure you want to sign out?
          </p>

          <div className='flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800'>
            <button
              onClick={() => setLogoutOpen(false)}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
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
