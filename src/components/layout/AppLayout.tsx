// src/components/layout/AppLayout.tsx
import {
  FiActivity,
  FiBarChart2,
  FiCamera,
  FiChevronRight,
  FiCreditCard,
  FiDollarSign,
  FiFlag,
  FiGrid,
  FiHome,
  FiLock,
  FiLogOut,
  FiSettings,
  FiShield,
  FiTrendingUp,
  FiX,
  FiZap,
} from 'react-icons/fi';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { AiFillCalculator } from 'react-icons/ai';
import { BsBank2 } from 'react-icons/bs';
import { GiWheat } from 'react-icons/gi';
import { Modal } from '../ui/Modal';
import { NotificationBell } from '../notifications/NotificationBell';
import { PWAInstallBanner } from '../PWAInstallBanner';
import { auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';
import { useLiabilityReminders } from '../../hooks/useLiabilityReminders';
import { useNotificationEngine } from '../../hooks/useNotificationEngine';

const NAV_GROUPS = [
  {
    label: 'Portfolio',
    items: [
      {
        to: '/dashboard',
        icon: FiHome,
        label: 'Dashboard',
        accent: 'text-sky-400',
        bg: 'bg-sky-500/10',
      },
      {
        to: '/investments',
        icon: FiTrendingUp,
        label: 'Investments',
        accent: 'text-indigo-400',
        bg: 'bg-indigo-500/10',
      },
      {
        to: '/profits',
        icon: FiDollarSign,
        label: 'Profits',
        accent: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
      },
      {
        to: '/liabilities',
        icon: FiCreditCard,
        label: 'Liabilities',
        accent: 'text-rose-400',
        bg: 'bg-rose-500/10',
      },
      {
        to: '/insurance',
        icon: FiShield,
        label: 'Insurance',
        accent: 'text-blue-400',
        bg: 'bg-blue-500/10',
      },
      {
        to: '/cashflow',
        icon: FiActivity,
        label: 'Cashflow',
        accent: 'text-teal-400',
        bg: 'bg-teal-500/10',
      },
      {
        to: '/accounts',
        icon: BsBank2,
        label: 'Accounts',
        accent: 'text-violet-400',
        bg: 'bg-violet-500/10',
      },
      {
        to: '/goals',
        icon: FiFlag,
        label: 'Goals',
        accent: 'text-amber-400',
        bg: 'bg-amber-500/10',
      },
      {
        to: '/credentials',
        icon: FiLock,
        label: 'Credentials',
        accent: 'text-fuchsia-400',
        bg: 'bg-fuchsia-500/10',
      }, // ← NEW
      {
        to: '/agriculture',
        icon: GiWheat,
        label: 'Agriculture',
        accent: 'text-lime-400',
        bg: 'bg-lime-500/10',
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        to: '/insights',
        icon: FiZap,
        label: 'Insights',
        accent: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        to: '/tools',
        icon: AiFillCalculator,
        label: 'Tools',
        accent: 'text-purple-400',
        bg: 'bg-purple-500/10',
      },
      {
        to: '/snapshots',
        icon: FiCamera,
        label: 'Snapshots',
        accent: 'text-pink-400',
        bg: 'bg-pink-500/10',
      },
      {
        to: '/reports',
        icon: FiBarChart2,
        label: 'Reports',
        accent: 'text-orange-400',
        bg: 'bg-orange-500/10',
      },
    ],
  },
];

const ALL_NAV_ITEMS = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  {
    to: '/settings',
    icon: FiSettings,
    label: 'Settings',
    accent: 'text-slate-300',
    bg: 'bg-slate-700/30',
  },
];

function desktopLinkClass(isActive: boolean, accent: string, bg: string) {
  const base =
    'group flex flex-row items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 text-sm font-semibold w-full overflow-hidden';
  return isActive
    ? `${base} ${bg} ${accent} shadow-[inset_4px_0_0_0_currentColor]`
    : `${base} text-slate-400 hover:bg-slate-800 hover:text-slate-100`;
}

function iconOnlyLinkClass(isActive: boolean, accent: string, bg: string) {
  const base =
    'flex items-center justify-center rounded-xl w-10 h-10 transition-all duration-150 mx-auto';
  return isActive
    ? `${base} ${bg} ${accent}`
    : `${base} text-slate-500 hover:bg-slate-800 hover:text-slate-200`;
}

export function AppLayout() {
  useLiabilityReminders();
  useNotificationEngine();

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const user = auth.currentUser;

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
  }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <div className='h-[100dvh] w-full overflow-hidden bg-slate-950 text-slate-50 flex relative'>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes smoothFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } } .animate-float { animation: smoothFloat 3s ease-in-out infinite; } .scrollbar-none::-webkit-scrollbar { display: none; } .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }`,
        }}
      />

      <aside className='hidden lg:flex h-full w-[220px] shrink-0 flex-col border-r border-slate-800/60 bg-slate-900/80 px-3 py-5'>
        <div className='mb-6 flex items-center gap-3 px-2'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 text-white'>
            <FiTrendingUp className='h-4 w-4' />
          </div>
          <div>
            <h1 className='text-sm font-black tracking-tight text-white leading-tight'>
              Fin<span className='text-emerald-500'>Trackly</span>
            </h1>
            <p className='text-[11px] text-slate-500 font-medium'>
              Personal Portfolio
            </p>
          </div>
        </div>

        <nav className='flex flex-1 flex-col gap-5 overflow-y-auto scrollbar-none'>
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className='mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600'>
                {group.label}
              </p>
              <div className='flex flex-col gap-0.5'>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
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

        <div className='mt-4 border-t border-slate-800/60 pt-4 flex flex-col gap-1'>
          <NavLink
            to='/settings'
            className={({ isActive }) =>
              desktopLinkClass(isActive, 'text-slate-300', 'bg-slate-700/30')
            }
          >
            <FiSettings className='h-4 w-4 shrink-0 text-slate-400' />
            <span>Settings</span>
          </NavLink>
          <button
            onClick={() => setLogoutOpen(true)}
            className='flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors'
          >
            <FiLogOut className='h-4 w-4 shrink-0' />
            <span>Logout</span>
          </button>
        </div>

        <NavLink
          to='/settings'
          className='mt-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/50 px-3 py-2.5 hover:bg-slate-800 transition-colors'
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
            <p className='text-xs font-bold text-slate-200 truncate'>
              {user?.displayName || 'My Account'}
            </p>
            <p className='text-[10px] text-slate-500 truncate'>{user?.email}</p>
          </div>
          <FiChevronRight className='h-3 w-3 text-slate-600 shrink-0' />
        </NavLink>
      </aside>

      <aside className='hidden md:flex lg:hidden h-full w-16 shrink-0 flex-col border-r border-slate-800/60 bg-slate-900/80 py-5 items-center gap-1'>
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
        <div className='flex flex-col gap-1 border-t border-slate-800/60 pt-3 w-full items-center'>
          <NavLink
            to='/settings'
            title='Settings'
            className={({ isActive }) =>
              iconOnlyLinkClass(isActive, 'text-slate-300', 'bg-slate-700/30')
            }
          >
            <FiSettings className='h-4 w-4 text-slate-400' />
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

      <main className='flex-1 overflow-y-auto relative flex flex-col'>
        <div className='sticky top-0 z-50 flex items-center justify-end gap-2 px-4 py-2.5 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/40 md:px-6'>
          <NotificationBell />
        </div>
        <div className='p-4 pb-28 md:p-6 md:pb-8 max-w-7xl mx-auto min-h-full w-full'>
          <Outlet />
        </div>
      </main>

      <div
        className={`md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-y-2' : ''}`}
      >
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`relative flex h-[54px] w-[54px] items-center justify-center rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-colors duration-300 active:scale-90 ${isMobileMenuOpen ? 'bg-slate-800 text-white border border-slate-700' : 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)] animate-float'}`}
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
        className={`md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-slate-900 border-t border-slate-800 rounded-t-3xl pt-4 pb-24 px-4 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isMobileMenuOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className='w-10 h-1 bg-slate-700 rounded-full mx-auto mb-5' />
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
                    className={`flex h-[50px] w-[50px] items-center justify-center rounded-2xl transition-all ${isActive ? `${item.bg} ${item.accent} border border-current/20 shadow-lg` : `bg-slate-800/80 ${item.accent} border border-slate-700/50`}`}
                  >
                    <item.icon className='h-[20px] w-[20px]' />
                  </div>
                  <span
                    className={`text-[9px] font-bold tracking-wide text-center leading-tight mt-0.5 ${isActive ? item.accent : 'text-slate-400'}`}
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
          <p className='text-sm text-slate-400'>
            Are you sure you want to logout?
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-5'>
            <button
              onClick={() => setLogoutOpen(false)}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800 transition-colors'
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
    </div>
  );
}
