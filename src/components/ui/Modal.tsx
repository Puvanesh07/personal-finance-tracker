import type { PropsWithChildren } from 'react'
import { FiX } from 'react-icons/fi'

export function Modal({
  open,
  title,
  onClose,
  children,
}: PropsWithChildren<{ open: boolean; title: string; onClose: () => void }>) {
  if (!open) return null
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md transition-opacity"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl animate-fade-in-up overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/90">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200/60 bg-slate-50/50 px-6 py-4 dark:border-slate-800/60 dark:bg-slate-800/30">
          <div className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100">{title}</div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/50 text-slate-600 transition-colors hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-500/20 dark:hover:text-rose-400"
            onClick={onClose}
            title="Close"
          >
            <FiX className="h-4 w-4" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}