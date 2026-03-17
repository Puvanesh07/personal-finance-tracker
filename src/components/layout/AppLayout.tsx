// src/components/layout/AppLayout.tsx
//
// FIXES:
//  1. PWAInstallBanner moved HERE from AuthPage — it now shows only for
//     authenticated users inside the app, not on the public landing page
//  2. This prevents unauthenticated visitors from being spammed with the
//     install prompt before they've even signed in

import {
  FiActivity,
  FiBarChart2,
  FiCamera,
  FiCreditCard,
  FiDollarSign,
  FiFlag,
  FiGrid,
  FiHome,
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
import { PWAInstallBanner } from '../PWAInstallBanner';
import { auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';

function desktopLinkClass(isActive: boolean) {
  const base =
    'flex flex-row items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 text-sm font-semibold';
  return isActive
    ? `${base} bg-emerald-500/10 text-emerald-400 shadow-[inset_4px_0_0_0_rgba(16,185,129,1)]`
    : `${base} text-slate-400 hover:bg-slate-800 hover:text-slate-100`;
}

export function AppLayout() {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const confirmLogout = async () => {
    await signOut(auth);
    setLogoutOpen(false);
    window.location.href = '/';
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const MOBILE_MENU_ITEMS = [
    { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
    { to: '/investments', icon: FiTrendingUp, label: 'Investments' },
    {
      to: '/profits',
      icon: FiDollarSign,
      label: 'Profits',
      color: 'text-emerald-400',
    },
    { to: '/liabilities', icon: FiCreditCard, label: 'Liabilities' },
    { to: '/accounts', icon: BsBank2, label: 'Accounts' },
    { to: '/cashflow', icon: FiActivity, label: 'Cashflow' },
    { to: '/goals', icon: FiFlag, label: 'Goals' },
    {
      to: '/insights',
      icon: FiZap,
      label: 'Insights',
      color: 'text-amber-400',
    },
    { to: '/tools', icon: AiFillCalculator, label: 'Tools' },
    { to: '/snapshots', icon: FiCamera, label: 'Snaps' },
    { to: '/reports', icon: FiBarChart2, label: 'Reports' },
    {
      to: '/agriculture',
      icon: GiWheat,
      label: 'Farm',
      color: 'text-green-400',
    },
    { to: '/settings', icon: FiSettings, label: 'Settings' },
  ];

  return (
    <div className='h-[100dvh] w-full overflow-hidden bg-slate-950 text-slate-50 flex relative'>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes smoothFloat {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-6px); }
            }
            .animate-float {
              animation: smoothFloat 3s ease-in-out infinite;
            }
          `,
        }}
      />

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className='hidden md:flex h-full w-60 shrink-0 flex-col border-r border-slate-800/60 bg-slate-900/80 px-4 py-5'>
        {/* Logo */}
        <div className='mb-5 flex items-center gap-3 px-1'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 text-white'>
            <FiTrendingUp className='h-4 w-4' />
          </div>
          <div>
            <h1 className='text-sm font-bold tracking-tight text-white leading-tight'>
              Fin<span className='text-emerald-500'>Trackly</span>
            </h1>
            <p className='text-[11px] text-slate-400 font-medium'>
              Personal Portfolio
            </p>
          </div>
        </div>

        {/* Desktop Nav */}
        <div className='flex flex-1 flex-col overflow-y-auto custom-scrollbar -mx-2 px-2'>
          <nav className='flex flex-col gap-0.5'>
            <NavLink
              to='/dashboard'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiHome className='h-4 w-4 shrink-0' />
              <span>Dashboard</span>
            </NavLink>
            <NavLink
              to='/investments'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiTrendingUp className='h-4 w-4 shrink-0' />
              <span>Investments</span>
            </NavLink>
            <NavLink
              to='/profits'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiDollarSign className='h-4 w-4 shrink-0 text-emerald-400' />
              <span>Profits</span>
            </NavLink>
            <NavLink
              to='/liabilities'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiCreditCard className='h-4 w-4 shrink-0' />
              <span>Liabilities</span>
            </NavLink>
            <NavLink
              to='/insurance'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiShield className='h-4 w-4 shrink-0' />
              <span>Insurance</span>
            </NavLink>

            <NavLink
              to='/cashflow'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiActivity className='h-4 w-4 shrink-0' />
              <span>Cashflow</span>
            </NavLink>
            <NavLink
              to='/accounts'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <BsBank2 className='h-4 w-4 shrink-0' />
              <span>Accounts</span>
            </NavLink>
            <NavLink
              to='/goals'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiFlag className='h-4 w-4 shrink-0' />
              <span>Goals</span>
            </NavLink>
            <NavLink
              to='/agriculture'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <GiWheat className='h-4 w-4 shrink-0 text-green-400' />
              <span>Agriculture</span>
            </NavLink>

            <div className='mt-4 mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-600'>
              Intelligence
            </div>
            <NavLink
              to='/insights'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiZap className='h-4 w-4 shrink-0 text-amber-400' />
              <span>Insights</span>
            </NavLink>

            <div className='mt-4 mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-600'>
              Analytics
            </div>
            <NavLink
              to='/tools'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <AiFillCalculator className='h-4 w-4 shrink-0' />
              <span>Tools</span>
            </NavLink>
            <NavLink
              to='/snapshots'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiCamera className='h-4 w-4 shrink-0' />
              <span>Snapshots</span>
            </NavLink>
            <NavLink
              to='/reports'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiBarChart2 className='h-4 w-4 shrink-0' />
              <span>Reports</span>
            </NavLink>
            <NavLink
              to='/settings'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiSettings className='h-4 w-4 shrink-0' />
              <span>Settings</span>
            </NavLink>
          </nav>
        </div>

        {/* Desktop Logout */}
        <div className='pt-3 border-t border-slate-800/60 mt-2'>
          <button
            onClick={() => setLogoutOpen(true)}
            className='flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-400 transition-all hover:bg-rose-500/10 hover:text-rose-300'
          >
            <FiLogOut className='h-4 w-4 shrink-0' />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className='flex-1 overflow-y-auto relative flex flex-col'>
        <div className='p-4 pb-28 md:p-8 md:pb-8 max-w-7xl mx-auto min-h-full w-full'>
          <Outlet />
        </div>
      </main>

      {/* ── MOBILE FAB ── */}
      <div
        className={`md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] transition-transform duration-300 ease-out ${
          isMobileMenuOpen ? 'translate-y-2' : ''
        }`}
      >
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`relative flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-colors duration-300 active:scale-90 ${
            isMobileMenuOpen
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)] animate-float'
          }`}
        >
          <div
            className={`transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-90 scale-100' : 'rotate-0 scale-90'}`}
          >
            {isMobileMenuOpen ? (
              <FiX className='h-5 w-5' />
            ) : (
              <FiGrid className='h-5 w-5' />
            )}
          </div>
        </button>
      </div>

      {/* ── MOBILE OVERLAY ── */}
      {isMobileMenuOpen && (
        <div
          className='md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-300'
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── MOBILE BOTTOM SHEET ── */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-slate-900 border-t border-slate-800 rounded-t-3xl pt-5 pb-24 px-6 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isMobileMenuOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className='w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-8' />

        <div className='grid grid-cols-4 gap-y-8 gap-x-2'>
          {MOBILE_MENU_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {({ isActive }) => (
                <div className='flex flex-col items-center gap-2 transition-transform active:scale-95'>
                  <div
                    className={`flex h-[56px] w-[56px] items-center justify-center rounded-2xl transition-colors ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-700'
                    }`}
                  >
                    <item.icon
                      className={`h-[22px] w-[22px] ${!isActive && item.color ? item.color : ''}`}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-bold tracking-wide ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}
                  >
                    {item.label}
                  </span>
                </div>
              )}
            </NavLink>
          ))}

          {/* Logout */}
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              setTimeout(() => setLogoutOpen(true), 250);
            }}
            className='flex flex-col items-center gap-2 transition-transform active:scale-95'
          >
            <div className='flex h-[56px] w-[56px] items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400'>
              <FiLogOut className='h-[22px] w-[22px]' />
            </div>
            <span className='text-[10px] font-bold tracking-wide text-rose-400'>
              Logout
            </span>
          </button>
        </div>
      </div>

      {/* ── LOGOUT MODAL ── */}
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

      {/* ── PWA INSTALL BANNER ──
           Placed here so it only shows to authenticated users in the app.
           Uses localStorage + 7-day cooldown so it won't spam users. */}
      <PWAInstallBanner />
    </div>
  );
}
