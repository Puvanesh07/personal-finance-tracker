// src/components/layout/AppLayout.tsx
import { NavLink, Outlet } from 'react-router-dom'
import { 
  FiHome, FiTrendingUp, FiCreditCard, FiActivity, 
  FiFlag, FiCamera, FiBarChart2, FiSettings 
} from 'react-icons/fi'

/**
 * Optimized Mobile-First Link Styling
 * Reduces font weight to medium (500) and line-height for mobile.
 */
function linkClassName(isActive: boolean) {
  const base = 'group flex flex-col md:flex-row items-center gap-0.5 md:gap-3 rounded-xl px-1 md:px-4 py-2 md:py-3 transition-all duration-300'
  
  // Mobile: text-[10px], font-medium, leading-tight
  // Desktop: md:text-sm, md:font-semibold
  const textStyles = 'text-[10px] md:text-sm font-medium md:font-semibold leading-tight'
  
  if (isActive) {
    return `${base} ${textStyles} bg-emerald-500/10 text-emerald-400 md:shadow-[inset_4px_0_0_0_rgba(16,185,129,1)]`
  }
  return `${base} ${textStyles} text-slate-400 hover:bg-slate-800 hover:text-slate-100`
}

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col md:flex-row h-screen w-full overflow-hidden">
      
      {/* LAPTOP SIDEBAR (Full 7+ Options) */}
      <aside className="hidden md:flex h-full w-64 flex-col border-r border-slate-800/60 bg-slate-900/80 p-6">
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

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          <NavLink to="/dashboard" className={({ isActive }) => linkClassName(isActive)}><FiHome className="h-4 w-4" /> <span>Dashboard</span></NavLink>
          <NavLink to="/investments" className={({ isActive }) => linkClassName(isActive)}><FiTrendingUp className="h-4 w-4" /> <span>Investments</span></NavLink>
          <NavLink to="/liabilities" className={({ isActive }) => linkClassName(isActive)}><FiCreditCard className="h-4 w-4" /> <span>Liabilities</span></NavLink>
          <NavLink to="/cashflow" className={({ isActive }) => linkClassName(isActive)}><FiActivity className="h-4 w-4" /> <span>Cashflow</span></NavLink>
          <NavLink to="/goals" className={({ isActive }) => linkClassName(isActive)}><FiFlag className="h-4 w-4" /> <span>Goals</span></NavLink>
          <div className="mt-6 mb-2 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-600">Analytics</div>
          <NavLink to="/snapshots" className={({ isActive }) => linkClassName(isActive)}><FiCamera className="h-4 w-4" /> <span>Snapshots</span></NavLink>
          <NavLink to="/reports" className={({ isActive }) => linkClassName(isActive)}><FiBarChart2 className="h-4 w-4" /> <span>Reports</span></NavLink>
          <NavLink to="/settings" className={({ isActive }) => linkClassName(isActive)}><FiSettings className="h-4 w-4" /> <span>Settings</span></NavLink>
        </nav>
      </aside>

      {/* MOBILE CONTENT CONTAINER */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="p-4 md:p-10 max-w-7xl mx-auto">
          {/* Outlet renders the page modules */}
          <Outlet />
        </div>
      </main>

      {/* MOBILE BOTTOM TAB BAR (Reduced to 5 Options) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/50 flex items-center justify-around px-1 z-50">
        <NavLink to="/dashboard" className={({ isActive }) => linkClassName(isActive)}>
          <FiHome className="h-4 w-4" />
          <span className="mt-0.5">Home</span>
        </NavLink>
        <NavLink to="/investments" className={({ isActive }) => linkClassName(isActive)}>
          <FiTrendingUp className="h-4 w-4" />
          <span className="mt-0.5">Stocks</span>
        </NavLink>
        <NavLink to="/cashflow" className={({ isActive }) => linkClassName(isActive)}>
          <FiActivity className="h-4 w-4" />
          <span className="mt-0.5">Cash</span>
        </NavLink>
        <NavLink to="/goals" className={({ isActive }) => linkClassName(isActive)}>
          <FiFlag className="h-4 w-4" />
          <span className="mt-0.5">Goals</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => linkClassName(isActive)}>
          <FiSettings className="h-4 w-4" />
          <span className="mt-0.5">Set</span>
        </NavLink>
      </nav>
    </div>
  )
}