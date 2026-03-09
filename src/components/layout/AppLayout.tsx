import { NavLink, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { 
  FiHome, FiTrendingUp, FiCreditCard, FiActivity, 
  FiFlag, FiCamera, FiBarChart2, FiSettings, FiSun, FiMoon 
} from 'react-icons/fi'
import { useThemeStore } from '../../store/themeStore'

function linkClassName(isActive: boolean, mode: 'light' | 'dark') {
  const base = 'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ease-out'
  
  if (isActive) {
    return `${base} ${
      mode === 'dark'
        ? 'bg-emerald-500/10 text-emerald-400 shadow-[inset_4px_0_0_0_rgba(16,185,129,1)]'
        : 'bg-emerald-50 text-emerald-700 shadow-[inset_4px_0_0_0_rgba(16,185,129,1)]'
    }`
  }
  
  return `${base} ${
    mode === 'dark'
      ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
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
    <div className={`min-h-screen transition-colors duration-500 ${isDark ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'}`}>
      <div className="flex h-screen w-full overflow-hidden p-2 sm:p-4 gap-4">
        
        {/* Sidebar */}
        <aside
          className={`flex h-full w-64 flex-col justify-between rounded-2xl border transition-all duration-500 shadow-lg backdrop-blur-sm ${
            isDark
              ? 'border-slate-800/60 bg-slate-900/80'
              : 'border-slate-200/60 bg-white/80'
          }`}
        >
          <div className="flex flex-col h-full px-4 py-6">
            {/* Header / Logo Area */}
            <div className="mb-8 flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30 shadow-lg text-white">
                  <FiTrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    Wealth<span className="text-emerald-500">Track</span>
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Personal Portfolio</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-2 custom-scrollbar">
              <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Main Menu
              </div>
              <NavLink to="/dashboard" className={({ isActive }) => linkClassName(isActive, mode)}>
                <FiHome className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/investments" className={({ isActive }) => linkClassName(isActive, mode)}>
                <FiTrendingUp className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span>Investments</span>
              </NavLink>
              <NavLink to="/liabilities" className={({ isActive }) => linkClassName(isActive, mode)}>
                <FiCreditCard className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span>Liabilities</span>
              </NavLink>
              <NavLink to="/cashflow" className={({ isActive }) => linkClassName(isActive, mode)}>
                <FiActivity className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span>Cashflow</span>
              </NavLink>
              <NavLink to="/goals" className={({ isActive }) => linkClassName(isActive, mode)}>
                <FiFlag className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span>Goals</span>
              </NavLink>

              <div className="mt-6 mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Analytics & Tools
              </div>
              <NavLink to="/snapshots" className={({ isActive }) => linkClassName(isActive, mode)}>
                <FiCamera className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span>Snapshots</span>
              </NavLink>
              <NavLink to="/reports" className={({ isActive }) => linkClassName(isActive, mode)}>
                <FiBarChart2 className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span>Reports</span>
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => linkClassName(isActive, mode)}>
                <FiSettings className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span>Settings</span>
              </NavLink>
            </nav>

            {/* Bottom Actions / Theme Toggle */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                className={`group flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
                  isDark
                    ? 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-white hover:shadow-md'
                    : 'bg-slate-100/50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm'
                }`}
                onClick={() => toggle()}
              >
                <span className="flex items-center gap-3">
                  <div className="relative flex h-6 w-6 items-center justify-center overflow-hidden">
                    <FiSun className={`absolute h-5 w-5 text-amber-500 transition-all duration-500 ${isDark ? 'translate-y-10 opacity-0' : 'translate-y-0 opacity-100 rotate-0'}`} />
                    <FiMoon className={`absolute h-5 w-5 text-indigo-400 transition-all duration-500 ${isDark ? 'translate-y-0 opacity-100 rotate-360' : '-translate-y-10 opacity-0'}`} />
                  </div>
                  <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </span>
                <div className={`h-4 w-8 rounded-full p-0.5 transition-colors duration-300 ${isDark ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`h-3 w-3 rounded-full bg-white transition-transform duration-300 ${isDark ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden rounded-2xl transition-all duration-500 relative">
          <div className={`h-full w-full overflow-y-auto rounded-2xl border shadow-xl transition-colors duration-500 animate-fade-in-up ${
            isDark 
              ? 'border-slate-800/80 bg-[#0B1120]' 
              : 'border-slate-200/80 bg-white'
            }`}
          >
            <div className="p-6 md:p-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}