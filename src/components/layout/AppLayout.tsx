import { NavLink, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { FiHome, FiTrendingUp, FiCreditCard, FiActivity, FiFlag, FiCamera, FiBarChart2, FiSettings, FiSun, FiMoon } from 'react-icons/fi'
import { useThemeStore } from '../../store/themeStore'

function linkClassName(isActive: boolean, mode: 'light' | 'dark') {
  const base = 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition'
  if (isActive) {
    return `${base} ${
      mode === 'dark'
        ? 'bg-slate-100 text-slate-900'
        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    }`
  }
  return `${base} ${
    mode === 'dark'
      ? 'text-slate-200 hover:bg-slate-800 hover:text-white'
      : 'text-slate-700 hover:bg-slate-100 hover:text-emerald-700'
  }`
}

export function AppLayout() {
  const mode = useThemeStore((s) => s.mode)
  const toggle = useThemeStore((s) => s.toggle)
  const isDark = mode === 'dark'

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.classList.toggle('dark', isDark)
      window.localStorage.setItem('pf-theme', mode)
    }
  }, [isDark, mode])

  return (
    <div className={isDark ? 'min-h-full bg-slate-950 text-slate-50' : 'min-h-full bg-slate-100 text-slate-900'}>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:h-screen md:grid-cols-[260px_1fr] md:gap-8">
        <aside
          className={
            isDark
              ? 'flex h-full flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-md'
              : 'flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-md'
          }
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <div className="text-base font-semibold tracking-tight text-emerald-500">
                Personal Finance
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Frontend-only tracker</div>
            </div>
            <button
              type="button"
              className={
                isDark
                  ? 'rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-700'
                  : 'rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100'
              }
              onClick={() => toggle()}
            >
              <span className="flex items-center gap-1">
                {isDark ? <FiSun className="h-3.5 w-3.5" /> : <FiMoon className="h-3.5 w-3.5" />}
                <span>{isDark ? 'Light' : 'Dark'}</span>
              </span>
            </button>
          </div>

          <nav className="flex flex-col gap-1 text-sm">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              <FiHome className="h-4 w-4 text-emerald-500" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink
              to="/investments"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              <FiTrendingUp className="h-4 w-4 text-emerald-500" />
              <span>Investments</span>
            </NavLink>
            <NavLink
              to="/liabilities"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              <FiCreditCard className="h-4 w-4 text-emerald-500" />
              <span>Liabilities</span>
            </NavLink>
            <NavLink
              to="/cashflow"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              <FiActivity className="h-4 w-4 text-emerald-500" />
              <span>Cashflow</span>
            </NavLink>
            <NavLink
              to="/goals"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              <FiFlag className="h-4 w-4 text-emerald-500" />
              <span>Goals</span>
            </NavLink>
            <NavLink
              to="/snapshots"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              <FiCamera className="h-4 w-4 text-emerald-500" />
              <span>Snapshots</span>
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              <FiBarChart2 className="h-4 w-4 text-emerald-500" />
              <span>Reports</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              <FiSettings className="h-4 w-4 text-emerald-500" />
              <span>Settings</span>
            </NavLink>
          </nav>
        </aside>

        <main className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:h-full md:overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

