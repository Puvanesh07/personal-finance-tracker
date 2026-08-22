// src/components/layout/AppLayout.tsx
import {
  FiChevronRight,
  FiGrid,
  FiLogOut,
  FiSearch,
  FiSettings,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { ALL_NAV_ITEMS, NAV_GROUPS } from '../../navigation/appNav';
import { CommandPalette } from './CommandPalette';
import { FeedbackModal } from './FeedbackModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { Modal } from '../ui/Modal';
import { NotificationBell } from '../notifications/NotificationBell';
import { NotificationPermissionBanner } from '../notifications/NotificationPermissionBanner';
import { TrialBanner } from '../subscription/TrialBanner';
import { UpgradeModal } from '../subscription/UpgradeModal';
import { ThemeToggle } from './ThemeToggle';
import { PWAInstallBanner } from '../PWAInstallBanner';
import { auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';
import { useAppHotkeys } from '../../hooks/useAppHotkeys';
import { useLiabilityReminders } from '../../hooks/useLiabilityReminders';
import { useNotificationEngine } from '../../hooks/useNotificationEngine';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useSubscription } from '../../context/SubscriptionContext';

function desktopLinkClass(isActive: boolean, accent: string, bg: string) {
  const base =
    'group flex flex-row items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 text-sm font-semibold w-full overflow-hidden';
  return isActive
    ? `${base} ${bg} ${accent} shadow-[inset_4px_0_0_0_currentColor]`
    : `${base} text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100`;
}

function iconOnlyLinkClass(isActive: boolean, accent: string, bg: string) {
  const base =
    'flex items-center justify-center rounded-xl w-10 h-10 transition-all duration-150 mx-auto';
  return isActive
    ? `${base} ${bg} ${accent}`
    : `${base} text-slate-500 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200`;
}

export function AppLayout() {
  useLiabilityReminders();
  useNotificationEngine();
  useOfflineSync();

  const { canCreateTransactions, loading: subscriptionLoading } = useSubscription();
  const isLocked = !subscriptionLoading && !canCreateTransactions;

  useEffect(() => {
    document.body.classList.toggle('subscription-locked', isLocked);
    return () => document.body.classList.remove('subscription-locked');
  }, [isLocked]);

  useEffect(() => {
    if (!isLocked) return;

    const handler = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest('[data-premium-action]');
      if (!target || target.closest('[data-premium-exempt]')) return;
      event.preventDefault();
      event.stopPropagation();
      toast.error('Your trial has expired. Subscribe to continue.');
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isLocked]);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const location = useLocation();
  const user = auth.currentUser;

  const focusInvestmentsSearch = useCallback(() => {
    window.dispatchEvent(new CustomEvent('fintrackly:focus-investments-search'));
  }, []);

  useAppHotkeys({
    onOpenPalette: () => setPaletteOpen(true),
    onOpenShortcuts: () => setShortcutsOpen(true),
    onFocusInvestmentsSearch: focusInvestmentsSearch,
    investmentsPath: '/investments',
    currentPath: location.pathname,
  });

  const firstLetter = (user?.displayName ||
    user?.email ||
    'U')[0].toUpperCase();
  const [sidebarImgError, setSidebarImgError] = useState(false);

  const confirmLogout = async () => {
    await signOut(auth);
    setLogoutOpen(false);
    window.location.href = '/';
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setPaletteOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <div className='relative flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50'>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes smoothFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } } .animate-float { animation: smoothFloat 3s ease-in-out infinite; } .scrollbar-none::-webkit-scrollbar { display: none; } .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }`,
        }}
      />

      <aside className='hidden lg:flex h-full w-[220px] shrink-0 flex-col border-r border-slate-200/70 dark:border-slate-800/60 bg-white/95 dark:bg-slate-900/80 px-3 py-5'>
        <div className='mb-6 flex items-center gap-3 px-2'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 text-white'>
            <FiTrendingUp className='h-4 w-4' />
          </div>
          <div>
            <h1 className='text-sm font-black tracking-tight text-slate-900 leading-tight dark:text-white'>
              Fin<span className='text-emerald-600 dark:text-emerald-500'>Trackly</span>
            </h1>
            <p className='text-[11px] font-medium text-slate-500 dark:text-slate-500'>
              Personal Portfolio
            </p>
          </div>
        </div>

        <nav className='flex flex-1 flex-col gap-5 overflow-y-auto scrollbar-none'>
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className='mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500'>
                {group.label}
              </p>
              <div className='flex flex-col gap-0.5'>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={({ isActive }) =>
                      desktopLinkClass(isActive, item.accent, item.bg)
                    }
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${item.accent}`} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className='mt-4 border-t border-slate-200/70 dark:border-slate-800/60 pt-4 flex flex-col gap-1'>
          <NavLink
            to='/settings'
            title='Settings'
            className={({ isActive }) =>
              desktopLinkClass(
                isActive,
                'text-slate-600 dark:text-slate-300',
                'bg-slate-200 dark:bg-slate-700/30',
              )
            }
          >
            <FiSettings className='h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400' />
            <span>Settings</span>
          </NavLink>
          <button
            onClick={() => setLogoutOpen(true)}
            title='Sign out of your account'
            className='flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors'
          >
            <FiLogOut className='h-4 w-4 shrink-0' />
            <span>Logout</span>
          </button>
        </div>

        <NavLink
          to='/settings'
          className='mt-3 flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2.5 hover:bg-slate-200 dark:bg-slate-800 transition-colors'
        >
          {user?.photoURL && !sidebarImgError ? (
            <img
              src={user.photoURL}
              alt=''
              className='h-8 w-8 rounded-full object-cover'
              onError={() => setSidebarImgError(true)}
            />
          ) : (
            <div className='h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-700/30 border border-emerald-500/20 flex items-center justify-center'>
              <span className='text-[11px] font-black text-emerald-400'>
                {firstLetter}
              </span>
            </div>
          )}
          <div className='min-w-0 flex-1'>
            <p className='truncate text-xs font-bold text-slate-900 dark:text-slate-200'>
              {user?.displayName || 'My Account'}
            </p>
            <p className='truncate text-[10px] text-slate-500'>{user?.email}</p>
          </div>
          <FiChevronRight className='h-3 w-3 text-slate-500 dark:text-slate-600 shrink-0' />
        </NavLink>
      </aside>

      <aside className='hidden md:flex lg:hidden h-full w-16 shrink-0 flex-col border-r border-slate-200/70 dark:border-slate-800/60 bg-white/95 dark:bg-slate-900/80 py-5 items-center gap-1'>
        <div className='mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 text-white'>
          <FiTrendingUp className='h-4 w-4' />
        </div>
        <div className='flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-none w-full items-center'>
          {ALL_NAV_ITEMS.filter((i) => i.to !== '/settings').map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                iconOnlyLinkClass(isActive, item.accent, item.bg)
              }
            >
              {() => <item.icon className={`h-4 w-4 ${item.accent}`} />}
            </NavLink>
          ))}
        </div>
        <div className='flex flex-col gap-1 border-t border-slate-200/70 dark:border-slate-800/60 pt-3 w-full items-center'>
          <NavLink
            to='/settings'
            title='Settings'
            className={({ isActive }) =>
              iconOnlyLinkClass(isActive, 'text-slate-600 dark:text-slate-700 dark:text-slate-300', 'bg-slate-300 dark:bg-slate-700/30')
            }
          >
            <FiSettings className='h-4 w-4 text-slate-500 dark:text-slate-400' />
          </NavLink>
          <button
            onClick={() => setLogoutOpen(true)}
            title='Logout'
            className='flex items-center justify-center rounded-xl w-10 h-10 text-rose-400 hover:bg-rose-500/10 transition-colors mx-auto'
          >
            <FiLogOut className='h-4 w-4' />
          </button>
        </div>
      </aside>

      <main className='relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]'>
        <div className='sticky top-0 z-50 flex items-center justify-end gap-2 px-4 py-2.5 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/60 dark:bg-slate-950/80 dark:border-slate-800/40 md:px-6'>
          <button
            type='button'
            onClick={() => setPaletteOpen(true)}
            title='Search pages (Ctrl+K)'
            className='flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/50 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
          >
            <FiSearch className='h-3.5 w-3.5' />
            <span className='hidden sm:inline'>Jump…</span>
            <kbd className='hidden md:inline rounded bg-slate-200/80 dark:bg-slate-800 px-1 py-0.5 text-[9px] font-mono text-slate-500'>
              ⌘K
            </kbd>
          </button>
          <button
            type='button'
            onClick={() => setShortcutsOpen(true)}
            title='Keyboard shortcuts (? )'
            className='rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/50 px-2.5 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
          >
            ?
          </button>
          <ThemeToggle />
          <NotificationBell />
        </div>
        <div className='mx-auto min-h-full w-full max-w-7xl overflow-x-hidden p-4 pb-28 md:p-6 md:pb-8'>
          <TrialBanner />
          <Outlet />

          <div className='mt-16 md:mt-20 border-t border-slate-200/70 dark:border-slate-800/60 pt-8'>
            <footer className='flex flex-col md:flex-row md:items-center md:justify-between gap-5 text-sm'>
              <nav className='flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-500 dark:text-slate-500'>
                <NavLink
                  to='/privacy'
                  className='font-medium hover:text-slate-900 dark:hover:text-slate-300 transition-colors'
                >
                  Privacy
                </NavLink>
                <NavLink
                  to='/feedback'
                  className='font-medium hover:text-slate-900 dark:hover:text-slate-300 transition-colors'
                >
                  Support
                </NavLink>
                <NavLink
                  to='/contact'
                  className='font-medium hover:text-slate-900 dark:hover:text-slate-300 transition-colors'
                >
                  Contact Us
                </NavLink>
                <NavLink
                  to='/terms'
                  className='font-medium hover:text-slate-900 dark:hover:text-slate-300 transition-colors'
                >
                  Terms & Conditions
                </NavLink>
              </nav>
              <p className='text-xs text-slate-500 dark:text-slate-500 md:text-right font-medium'>
                © 2026 Fintrackly · Made in India
              </p>
            </footer>
          </div>
        </div>
      </main>

      <div
        className={`md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-y-2' : ''}`}
      >
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`relative flex h-[54px] w-[54px] items-center justify-center rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-colors duration-300 active:scale-90 ${isMobileMenuOpen ? 'bg-slate-200 dark:bg-slate-800 text-white border border-slate-300 dark:border-slate-700' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)] animate-float'}`}
        >
          <div
            className={`transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-90' : 'rotate-0 scale-90'}`}
          >
            {isMobileMenuOpen ? (
              <FiX className='h-5 w-5' />
            ) : (
              <FiGrid className='h-5 w-5' />
            )}
          </div>
        </button>
      </div>

      {isMobileMenuOpen && (
        <div
          className='md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200'
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl pt-4 pb-24 px-4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isMobileMenuOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className='w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-5' />
        <div className='grid grid-cols-4 gap-y-4 gap-x-2'>
          {ALL_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {({ isActive }) => (
                <div className='flex flex-col items-center gap-1.5 transition-transform active:scale-95'>
                  <div
                    className={`flex h-[50px] w-[50px] items-center justify-center rounded-2xl transition-all ${isActive ? `${item.bg} ${item.accent} border border-current/20 shadow-lg` : `bg-slate-200/80 dark:bg-slate-800/80 ${item.accent} border border-slate-300/60 dark:border-slate-700/50`}`}
                  >
                    <item.icon className='h-[20px] w-[20px]' />
                  </div>
                  <span
                    className={`text-[9px] font-bold tracking-wide text-center leading-tight mt-0.5 ${isActive ? item.accent : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    {item.label}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title='Confirm Logout'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            Are you sure you want to logout?
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
            <button
              onClick={() => setLogoutOpen(false)}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 transition-colors'
            >
              Cancel
            </button>
            <button
              onClick={confirmLogout}
              className='rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors'
            >
              Yes, Logout
            </button>
          </div>
        </div>
      </Modal>

      <PWAInstallBanner />
      <NotificationPermissionBanner />
      <UpgradeModal />
      <FeedbackModal />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
