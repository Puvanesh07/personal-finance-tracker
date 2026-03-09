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
          ? 'rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg transition-transform duration-200 hover:scale-[1.02]'
          : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-lg transition-transform duration-200 hover:scale-[1.02]'
      }
    >
      {(title ?? right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className={isDark ? 'text-sm font-medium text-slate-100' : 'text-sm font-medium text-slate-800'}>
            {title}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </header>
      )}
      {children}
    </section>
  )
}

