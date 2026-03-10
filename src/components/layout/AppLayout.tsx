// src/components/layout/AppLayout.tsx
import { NavLink, Outlet } from 'react-router-dom'
import {
  FiHome, FiTrendingUp, FiCreditCard, FiActivity,
  FiFlag, FiCamera, FiBarChart2, FiSettings, FiLogOut, FiZap
} from 'react-icons/fi'
import { AiFillCalculator } from 'react-icons/ai'
import { signOut } from 'firebase/auth'
import { auth } from '../../services/firebase'
import { useState } from 'react'
import { Modal } from '../ui/Modal'

function desktopLinkClass(isActive: boolean) {
  const base =
    'flex flex-row items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 text-sm font-semibold'

  return isActive
    ? `${base} bg-emerald-500/10 text-emerald-400 shadow-[inset_4px_0_0_0_rgba(16,185,129,1)]`
    : `${base} text-slate-400 hover:bg-slate-800 hover:text-slate-100`
}



export function AppLayout() {

  const [logoutOpen, setLogoutOpen] = useState(false)

  const handleLogout = () => {
    setLogoutOpen(true)
  }

  const confirmLogout = async () => {
    await signOut(auth)
    setLogoutOpen(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col md:flex-row h-screen w-full overflow-hidden">

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex h-full w-64 flex-col border-r border-slate-800/60 bg-slate-900/80 p-6">

        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 text-white">
            <FiTrendingUp className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-base font-bold tracking-tight text-white">
              Fin<span className="text-emerald-500">Trackly</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Personal Portfolio
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">

          <NavLink to="/dashboard" className={({ isActive }) => desktopLinkClass(isActive)}>
            <FiHome className="h-4 w-4" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/investments" className={({ isActive }) => desktopLinkClass(isActive)}>
            <FiTrendingUp className="h-4 w-4" />
            <span>Investments</span>
          </NavLink>

          <NavLink to="/liabilities" className={({ isActive }) => desktopLinkClass(isActive)}>
            <FiCreditCard className="h-4 w-4" />
            <span>Liabilities</span>
          </NavLink>

          <NavLink to="/cashflow" className={({ isActive }) => desktopLinkClass(isActive)}>
            <FiActivity className="h-4 w-4" />
            <span>Cashflow</span>
          </NavLink>

          <NavLink to="/goals" className={({ isActive }) => desktopLinkClass(isActive)}>
            <FiFlag className="h-4 w-4" />
            <span>Goals</span>
          </NavLink>

          <div className="mt-6 mb-2 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Intelligence
          </div>

          <NavLink to="/insights" className={({ isActive }) => desktopLinkClass(isActive)}>
            <FiZap className="h-4 w-4 text-amber-400" />
            <span>Insights</span>
          </NavLink>

          <div className="mt-4 mb-2 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Analytics
          </div>

          <NavLink to="/tools" className={({ isActive }) => desktopLinkClass(isActive)}>
            <AiFillCalculator className="h-4 w-4" />
            <span>Investment Tools</span>
          </NavLink>

          <NavLink to="/snapshots" className={({ isActive }) => desktopLinkClass(isActive)}>
            <FiCamera className="h-4 w-4" />
            <span>Snapshots</span>
          </NavLink>

          <NavLink to="/reports" className={({ isActive }) => desktopLinkClass(isActive)}>
            <FiBarChart2 className="h-4 w-4" />
            <span>Reports</span>
          </NavLink>

          <NavLink to="/settings" className={({ isActive }) => desktopLinkClass(isActive)}>
            <FiSettings className="h-4 w-4" />
            <span>Settings</span>
          </NavLink>

        </nav>

        {/* Logout Button */}
        <div className="mt-auto pt-4 border-t border-slate-800/60">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-rose-400 transition-all hover:bg-rose-500/10 hover:text-rose-300"
          >
            <FiLogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>

      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto pb-12 md:pb-0">
        <div className="p-4 md:p-10 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* LOGOUT CONFIRM MODAL */}
      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Confirm Logout"
      >
        <div className="space-y-6">

          <p className="text-sm text-slate-400">
            Are you sure you want to logout?
          </p>

          <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">

            <button
              onClick={() => setLogoutOpen(false)}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              onClick={confirmLogout}
              className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700"
            >
              Yes, Logout
            </button>

          </div>
        </div>
      </Modal>

    </div>
  )
}