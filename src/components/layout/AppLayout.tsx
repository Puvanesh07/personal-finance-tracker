// src/components/layout/AppLayout.tsx

import {
  FiActivity,
  FiBarChart2,
  FiCamera,
  FiCreditCard,
  FiFlag,
  FiHome,
  FiLogOut,
  FiSettings,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';
import { NavLink, Outlet } from 'react-router-dom';

import { AiFillCalculator } from 'react-icons/ai';
import { Modal } from '../ui/Modal';
import { auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';
import { useState } from 'react';

// Desktop sidebar styling
function desktopLinkClass(isActive: boolean) {
  const base =
    'flex flex-row items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 text-sm font-semibold';
  return isActive
    ? `${base} bg-emerald-500/10 text-emerald-400 shadow-[inset_4px_0_0_0_rgba(16,185,129,1)]`
    : `${base} text-slate-400 hover:bg-slate-800 hover:text-slate-100`;
}

// Mobile bottom bar styling (Glassy & Scrollable)
function mobileLinkClass(isActive: boolean) {
  const base =
    'flex flex-col items-center justify-center gap-1.5 min-w-[72px] px-2 py-3 transition-colors shrink-0';
  return isActive
    ? `${base} text-emerald-400`
    : `${base} text-slate-400 hover:text-slate-200`;
}

export function AppLayout() {
  const [logoutOpen, setLogoutOpen] = useState(false);

  const confirmLogout = async () => {
    await signOut(auth);
    setLogoutOpen(false);
  };

  return (
    // Use h-[100dvh] to perfectly fit mobile screens including browser UI bars
    <div className='h-[100dvh] w-full overflow-hidden bg-slate-950 text-slate-50 flex relative'>
      {/* ── DESKTOP SIDEBAR (Hidden on mobile) ────────────────────────── */}
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
              to='/liabilities'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiCreditCard className='h-4 w-4 shrink-0' />
              <span>Liabilities</span>
            </NavLink>

            <NavLink
              to='/cashflow'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiActivity className='h-4 w-4 shrink-0' />
              <span>Cashflow</span>
            </NavLink>

            <NavLink
              to='/goals'
              className={({ isActive }) => desktopLinkClass(isActive)}
            >
              <FiFlag className='h-4 w-4 shrink-0' />
              <span>Goals</span>
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

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <main className='flex-1 overflow-y-auto'>
        {/* pb-24 ensures the very bottom of the page content isn't hidden behind the mobile tab bar */}
        <div className='p-4 pb-24 md:p-8 max-w-7xl mx-auto min-h-full'>
          <Outlet />
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV (Glassy & Horizontal Scroll) ─────────── */}
      <nav className='md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center overflow-x-auto no-scrollbar bg-slate-900/80 backdrop-blur-xl border-t border-slate-800/80 pb-safe'>
        <div className='flex px-2 py-1 mx-auto min-w-max'>
          <NavLink
            to='/dashboard'
            className={({ isActive }) => mobileLinkClass(isActive)}
          >
            <FiHome className='h-5 w-5' />
            <span className='text-[10px] font-bold tracking-wide'>Home</span>
          </NavLink>

          <NavLink
            to='/investments'
            className={({ isActive }) => mobileLinkClass(isActive)}
          >
            <FiTrendingUp className='h-5 w-5' />
            <span className='text-[10px] font-bold tracking-wide'>Assets</span>
          </NavLink>

          <NavLink
            to='/liabilities'
            className={({ isActive }) => mobileLinkClass(isActive)}
          >
            <FiCreditCard className='h-5 w-5' />
            <span className='text-[10px] font-bold tracking-wide'>Loans</span>
          </NavLink>

          <NavLink
            to='/cashflow'
            className={({ isActive }) => mobileLinkClass(isActive)}
          >
            <FiActivity className='h-5 w-5' />
            <span className='text-[10px] font-bold tracking-wide'>Cash</span>
          </NavLink>

          <NavLink
            to='/goals'
            className={({ isActive }) => mobileLinkClass(isActive)}
          >
            <FiFlag className='h-5 w-5' />
            <span className='text-[10px] font-bold tracking-wide'>Goals</span>
          </NavLink>

          {/* Divider */}
          <div className='w-px bg-slate-800 my-3 mx-1 shrink-0' />

          <NavLink
            to='/insights'
            className={({ isActive }) => mobileLinkClass(isActive)}
          >
            <FiZap
              className={`h-5 w-5 ${location.pathname.includes('insights') ? '' : 'text-amber-400'}`}
            />
            <span className='text-[10px] font-bold tracking-wide'>
              Insights
            </span>
          </NavLink>

          <NavLink
            to='/tools'
            className={({ isActive }) => mobileLinkClass(isActive)}
          >
            <AiFillCalculator className='h-5 w-5' />
            <span className='text-[10px] font-bold tracking-wide'>Tools</span>
          </NavLink>

          <NavLink
            to='/snapshots'
            className={({ isActive }) => mobileLinkClass(isActive)}
          >
            <FiCamera className='h-5 w-5' />
            <span className='text-[10px] font-bold tracking-wide'>Snaps</span>
          </NavLink>

          <NavLink
            to='/reports'
            className={({ isActive }) => mobileLinkClass(isActive)}
          >
            <FiBarChart2 className='h-5 w-5' />
            <span className='text-[10px] font-bold tracking-wide'>Reports</span>
          </NavLink>

          <NavLink
            to='/settings'
            className={({ isActive }) => mobileLinkClass(isActive)}
          >
            <FiSettings className='h-5 w-5' />
            <span className='text-[10px] font-bold tracking-wide'>
              Settings
            </span>
          </NavLink>

          {/* Divider */}
          <div className='w-px bg-slate-800 my-3 mx-1 shrink-0' />

          <button
            onClick={() => setLogoutOpen(true)}
            className='flex flex-col items-center justify-center gap-1.5 min-w-[72px] px-2 py-3 transition-colors shrink-0 text-rose-400 hover:text-rose-300'
          >
            <FiLogOut className='h-5 w-5' />
            <span className='text-[10px] font-bold tracking-wide'>Logout</span>
          </button>
        </div>
      </nav>

      {/* ── LOGOUT MODAL ────────────────────────────────────────── */}
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
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800'
            >
              Cancel
            </button>
            <button
              onClick={confirmLogout}
              className='rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700'
            >
              Yes, Logout
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
