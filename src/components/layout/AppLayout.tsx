import { NavLink, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useThemeStore } from '../../store/themeStore'

function linkClassName(isActive: boolean, mode: 'light' | 'dark') {
  const base = 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition'
  if (isActive) {
    return `${base} ${mode === 'dark' ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-white'}`
  }
  return `${base} ${
    mode === 'dark'
      ? 'text-slate-200 hover:bg-slate-800 hover:text-white'
      : 'text-slate-700 hover:bg-slate-100'
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
    <div className={isDark ? 'min-h-full bg-slate-950 text-slate-50' : 'min-h-full bg-slate-50 text-slate-900'}>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[240px_1fr]">
        <aside
          className={
            isDark
              ? 'rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm'
              : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
          }
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <div className="text-base font-semibold">{isDark ? 'Personal Finance (Dark)' : 'Personal Finance'}</div>
              <div className="text-xs text-slate-500">Frontend-only tracker</div>
            </div>
            <button
              type="button"
              className={
                isDark
                  ? 'rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-700'
                  : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100'
              }
              onClick={() => toggle()}
            >
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/investments"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              Investments
            </NavLink>
            <NavLink
              to="/liabilities"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              Liabilities
            </NavLink>
            <NavLink
              to="/cashflow"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              Cashflow
            </NavLink>
            <NavLink
              to="/goals"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              Goals
            </NavLink>
            <NavLink
              to="/snapshots"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              Snapshots
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              Reports
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => linkClassName(isActive, mode)}
            >
              Settings
            </NavLink>
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

