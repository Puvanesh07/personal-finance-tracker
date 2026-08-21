// src/pages/Settings/SettingsPage.tsx
//
// REDESIGNED — Full tabbed Settings page with:
//   1. Profile tab  — edit display name, view email, avatar
//   2. Export/Import tab — CSV export, JSON backup/restore
//   3. App tab       — PWA install, encryption toggle
//   4. Essentials tab — emergency fund config
//   5. Integrations tab — Notion sync
//   6. Danger Zone tab — clear data, delete account
//
// Responsive: stacked pill-tabs on mobile, icon-tabs on desktop sidebar

import {
  DangerZone,
  ExportImport,
} from '../../components/settings/DataManagement';
import {
  FiAlertOctagon,
  FiCheckCircle,
  FiCloud,
  FiCreditCard,
  FiDatabase,
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiLogOut,
  FiMail,
  FiSave,
  FiSettings,
  FiShield,
  FiSmartphone,
  FiUser,
} from 'react-icons/fi';
import { signOut, updateProfile } from 'firebase/auth';
import { useEffect, useState } from 'react';

import EncryptionSettings from './EncryptionSettings';
import { EssentialsSettings } from '../../components/settings/EssentialsSettings';
import { Modal } from '../../components/ui/Modal';
import { NotionSettings } from '../../components/settings/NotionSettings';
import { SubscriptionStatusCard } from '../../components/subscription/SubscriptionStatusCard';
import { TrialUsagePanel } from '../../components/subscription/TrialUsagePanel';
import { auth } from '../../services/firebase';
import { usePortfolioStore } from '../../store/portfolioStore';

// ─── Tab config ─────────────────────────────────────────────────────────────

type TabId =
  | 'profile'
  | 'subscription'
  | 'data'
  | 'app'
  | 'essentials'
  | 'integrations'
  | 'danger';

const TABS: {
  id: TabId;
  label: string;
  icon: React.ElementType;
  color?: string;
}[] = [
  { id: 'profile', label: 'Profile', icon: FiUser },
  { id: 'subscription', label: 'Subscription', icon: FiCreditCard },
  { id: 'data', label: 'Export / Import', icon: FiDatabase },
  { id: 'app', label: 'App & Security', icon: FiSmartphone },
  { id: 'essentials', label: 'Essentials', icon: FiShield },
  { id: 'integrations', label: 'Integrations', icon: FiCloud },
  {
    id: 'danger',
    label: 'Danger Zone',
    icon: FiAlertOctagon,
    color: 'text-rose-400',
  },
];

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab() {
  const user = auth.currentUser;
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleSaveName = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      await updateProfile(user, { displayName: name.trim() });
      setSaved(true);
      setEditingName(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to update name:', err);
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/';
    } catch {}
  };

  // First letter of display name, or first letter of email, or 'U'
  const firstLetter = (user?.displayName ||
    user?.email ||
    'U')[0].toUpperCase();

  const [imgError, setImgError] = useState(false);
  const showInitials = !user?.photoURL || imgError;

  return (
    <div className='flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500'>
      {/* Avatar + Name Block */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6'>
        {/* Avatar */}
        <div className='relative shrink-0'>
          {showInitials ? (
            <div className='h-24 w-24 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-emerald-700/30 flex items-center justify-center shadow-xl'>
              <span className='text-4xl font-black text-emerald-400 select-none'>
                {firstLetter}
              </span>
            </div>
          ) : (
            <img
              src={user!.photoURL!}
              alt='Profile'
              className='h-24 w-24 rounded-2xl border-2 border-emerald-500/30 object-cover shadow-xl'
              onError={() => setImgError(true)}
            />
          )}
          <span className='absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-slate-100 dark:border-slate-900 bg-emerald-500 shadow' />
        </div>

        {/* Info */}
        <div className='flex-1 min-w-0 text-center sm:text-left'>
          {/* Display Name */}
          {editingName ? (
            <div className='flex items-center gap-2'>
              <input
                className='flex-1 rounded-xl border border-emerald-500/40 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-slate-100'
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
                placeholder='Your display name'
              />
              <button
                onClick={handleSaveName}
                disabled={saving || !name.trim()}
                className='inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors'
              >
                <FiSave className='h-3.5 w-3.5' />
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditingName(false);
                  setName(user?.displayName || '');
                }}
                className='rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 transition-colors'
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className='flex items-center justify-center sm:justify-start gap-3'>
              <h2 className='truncate text-xl font-black text-slate-900 dark:text-slate-100'>
                {user?.displayName || 'FinTrackly User'}
              </h2>
              <button
                onClick={() => setEditingName(true)}
                className='flex cursor-pointer items-center gap-1 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors'
              >
                <FiEdit2 className='h-3 w-3' /> Edit
              </button>
            </div>
          )}

          {saved && (
            <p className='mt-1 text-xs font-semibold text-emerald-400 animate-pulse'>
              ✓ Name updated successfully
            </p>
          )}

          {/* Email */}
          <p className='mt-2 flex items-center justify-center sm:justify-start gap-1.5 text-sm text-slate-500 dark:text-slate-400'>
            <FiMail className='h-3.5 w-3.5' />
            {user?.email || 'No email linked'}
          </p>

          {/* Auth badge */}
          <div className='mt-3 flex items-center justify-center sm:justify-start gap-2'>
            <span className='inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400'>
              <FiCheckCircle className='h-3 w-3' />
              {user?.providerData?.[0]?.providerId === 'google.com'
                ? 'Google Auth'
                : 'Email Auth'}
            </span>
          </div>
        </div>
      </div>

      {/* UID card */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 p-5'>
        <p className='text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-2'>
          Account ID
        </p>
        <p className='font-mono text-xs text-emerald-400 break-all'>
          {user?.uid}
        </p>
        <p className='mt-2 text-[11px] text-slate-900 dark:text-slate-500'>
          Your data is stored securely on Firebase, tied to this unique ID.
        </p>
      </div>

      {/* Sign out */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/40 p-5 flex items-center justify-between gap-4'>
        <div>
          <p className='text-sm font-bold text-slate-900 dark:text-slate-200'>
            Sign Out
          </p>
          <p className='text-xs text-slate-900 dark:text-slate-500 mt-0.5'>
            You will need to log in again to access your data.
          </p>
        </div>
        <button
          onClick={() => setLogoutOpen(true)}
          className='flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-400 hover:bg-rose-500/20 transition-colors whitespace-nowrap'
        >
          <FiLogOut className='h-4 w-4' /> Sign Out
        </button>
      </div>

      {/* Logout modal */}
      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title='Confirm Sign Out'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            Are you sure you want to sign out?
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
            <button
              onClick={() => setLogoutOpen(false)}
              className='rounded-xl cursor-pointer px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800'
            >
              Cancel
            </button>
            <button
              onClick={confirmLogout}
              className='rounded-xl cursor-pointer bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700'
            >
              Yes, Sign Out
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── App & Security Tab (PWA + Encryption) ───────────────────────────────────

function AppSecurityTab() {
  const { uid } = usePortfolioStore();
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

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);

  return (
    <div className='flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500'>
      {/* Install App */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 p-6'>
        <div className='flex items-center gap-3 mb-4'>
          <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800'>
            <FiSmartphone className='h-4 w-4 text-slate-600 dark:text-slate-700 dark:text-slate-300' />
          </div>
          <div>
            <h2 className='text-base font-bold text-slate-900 dark:text-slate-100'>Install App</h2>
            <p className='text-xs text-slate-900 dark:text-slate-500'>
              Add to home screen for native-like experience
            </p>
          </div>
        </div>

        {isInstalled ? (
          <div className='flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3'>
            <FiCheckCircle className='h-5 w-5 shrink-0 text-emerald-400' />
            <div>
              <p className='text-sm font-bold text-emerald-700 dark:text-emerald-300'>
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
            className='flex cursor-pointer w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3.5 text-sm font-bold text-white shadow-lg hover:from-emerald-500 hover:to-emerald-600 transition-all'
          >
            <FiDownload className='h-4 w-4' />
            Install FinTrackly
          </button>
        ) : (
          <div className='flex flex-col gap-3'>
            <div className='flex items-start gap-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 px-4 py-3'>
              <span className='text-lg shrink-0'>🤖</span>
              <div>
                <p className='text-xs font-bold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
                  Android / Chrome
                </p>
                <p className='text-xs text-slate-500 dark:text-slate-400 mt-0.5'>
                  Tap the <strong className='text-slate-900 dark:text-slate-800 dark:text-slate-200'>⋮ menu</strong> →{' '}
                  <strong className='text-slate-900 dark:text-slate-800 dark:text-slate-200'>
                    "Add to Home screen"
                  </strong>
                </p>
                {isAndroid && (
                  <button
                    onClick={() => window.open(window.location.href, '_blank')}
                    className='mt-2 flex cursor-pointer items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300'
                  >
                    Open in Chrome <FiExternalLink className='h-3 w-3' />
                  </button>
                )}
              </div>
            </div>
            <div className='flex items-start gap-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 px-4 py-3'>
              <span className='text-lg shrink-0'>🍎</span>
              <div>
                <p className='text-xs font-bold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
                  iPhone / Safari
                </p>
                <p className='text-xs text-slate-500 dark:text-slate-400 mt-0.5'>
                  Tap <strong className='text-slate-900 dark:text-slate-800 dark:text-slate-200'>Share ⬆</strong> →{' '}
                  <strong className='text-slate-900 dark:text-slate-800 dark:text-slate-200'>
                    "Add to Home Screen"
                  </strong>
                </p>
                {isIOS && (
                  <button
                    onClick={() => window.open(window.location.href, '_blank')}
                    className='mt-2 flex cursor-pointer items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300'
                  >
                    Open in Safari <FiExternalLink className='h-3 w-3' />
                  </button>
                )}
              </div>
            </div>
            <div className='flex items-start gap-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 px-4 py-3'>
              <span className='text-lg shrink-0'>💻</span>
              <div>
                <p className='text-xs font-bold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
                  Desktop Chrome / Edge
                </p>
                <p className='text-xs text-slate-500 dark:text-slate-400 mt-0.5'>
                  Click{' '}
                  <strong className='text-slate-900 dark:text-slate-800 dark:text-slate-200'>⊕ install icon</strong> in
                  the address bar
                </p>
              </div>
            </div>
          </div>
        )}
        {installPrompted && !isInstalled && (
          <p className='mt-3 text-xs text-slate-900 dark:text-slate-500 text-center'>
            Prompt dismissed — refresh the page to try again.
          </p>
        )}
      </div>

      {/* Encryption */}
      <EncryptionSettings uid={uid} />
    </div>
  );
}

// ─── Danger Zone Tab ─────────────────────────────────────────────────────────

function DangerZoneTab() {
  return (
    <div className='animate-in fade-in slide-in-from-bottom-2 duration-500'>
      <div className='mb-5 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4'>
        <FiAlertOctagon className='h-5 w-5 shrink-0 text-rose-400' />
        <div>
          <p className='text-sm font-bold text-rose-300'>Danger Zone</p>
          <p className='text-xs text-rose-400/70 mt-0.5'>
            Actions here are permanent and cannot be undone. Please be careful.
          </p>
        </div>
      </div>
      <DangerZone />
    </div>
  );
}

// ─── Main SettingsPage ────────────────────────────────────────────────────────

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab />;
      case 'subscription':
        return (
          <div className='animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col gap-6'>
            <SubscriptionStatusCard />
            <TrialUsagePanel />
          </div>
        );
      case 'data':
        return (
          <div className='animate-in fade-in slide-in-from-bottom-2 duration-500'>
            <ExportImport />
          </div>
        );
      case 'app':
        return <AppSecurityTab />;
      case 'essentials':
        return <EssentialsSettings />;
      case 'integrations':
        return (
          <div className='animate-in fade-in slide-in-from-bottom-2 duration-500'>
            <div className='mb-4'>
              <h2 className='flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100'>
                <FiCloud className='text-emerald-400' /> Integrations
              </h2>
              <p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>
                Connect third-party tools to sync your portfolio data
                automatically.
              </p>
            </div>
            <NotionSettings />
          </div>
        );
      case 'danger':
        return <DangerZoneTab />;
    }
  };

  return (
    <div className='flex flex-col gap-6 pb-10'>
      {/* ── Page Header ── */}
      <header className='flex items-center gap-4 rounded-2xl border border-slate-300/70 bg-gradient-to-r from-slate-200/80 to-slate-100/60 p-5 shadow-sm dark:border-slate-700/60 dark:from-slate-800/80 dark:to-slate-900/40'>
        <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-400 to-slate-300 text-white shadow-lg dark:from-slate-600 dark:to-slate-800'>
          <FiSettings className='h-6 w-6' />
        </div>
        <div>
          <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>Settings</h1>
          <p className='mt-0.5 text-sm text-slate-600 dark:text-slate-400'>
            Manage your profile, data, security, and app preferences.
          </p>
        </div>
      </header>

      {/* ── Layout: sidebar tabs on md+, scrollable tabs on mobile ── */}
      <div className='flex flex-col md:flex-row gap-6'>
        {/* ── MOBILE / TABLET: Horizontal scrollable pills ── */}
        <div className='md:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none'>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? tab.id === 'danger'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'border border-slate-300/60 bg-slate-200/70 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700/50 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${tab.color || ''}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── DESKTOP: Vertical sidebar tabs ── */}
        <aside className='hidden md:flex flex-col gap-1 w-52 shrink-0'>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-left transition-all ${
                  isActive
                    ? tab.id === 'danger'
                      ? 'bg-rose-500/15 text-rose-400 shadow-[inset_4px_0_0_0_rgba(244,63,94,1)]'
                      : 'bg-emerald-500/10 text-emerald-400 shadow-[inset_4px_0_0_0_rgba(16,185,129,1)]'
                    : `text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${tab.id === 'danger' ? 'hover:text-rose-400 dark:hover:text-rose-400' : ''}`
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? '' : tab.color || ''}`}
                />
                {tab.label}
              </button>
            );
          })}
        </aside>

        {/* ── Content panel ── */}
        <div className='flex-1 min-w-0'>{renderContent()}</div>
      </div>
    </div>
  );
}
