import type { PropsWithChildren, ReactNode } from 'react'
import { useThemeStore } from '../../store/themeStore'

export function Card({
  title,
  right,
  children,
}: PropsWithChildren<{ title?: ReactNode; right?: ReactNode }>) {
  const mode = useThemeStore((s) => s.mode)
  const isDark = mode === 'dark'
  
  return (
    <section
      className={
        isDark
          ? 'flex flex-col h-full rounded-2xl border border-slate-800/60 bg-slate-900/50 p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-700/80'
          : 'flex flex-col h-full rounded-2xl border border-slate-200/60 bg-white/80 p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-slate-300'
      }
    >
      {(title ?? right) && (
        <header className="mb-4 flex items-center justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800/50">
          <div className={isDark ? 'text-base font-semibold text-slate-100' : 'text-base font-semibold text-slate-800'}>
            {title}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </header>
      )}
      <div className="flex-1">
        {children}
      </div>
    </section>
  )
}