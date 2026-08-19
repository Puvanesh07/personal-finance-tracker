import { FiX } from 'react-icons/fi';
import type { PropsWithChildren } from 'react';

export function Modal({
  open,
  title,
  onClose,
  children,
}: PropsWithChildren<{ open: boolean; title: string; onClose: () => void }>) {
  if (!open) return null;

  return (
    <div
      className='fixed inset-0 z-50 flex items-start justify-center overflow-x-hidden overflow-y-auto bg-slate-100 dark:bg-slate-900/60 backdrop-blur-md [scrollbar-gutter:stable]'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role='dialog'
      aria-modal='true'
    >
      {/* Outer wrapper — centres vertically when content is short, scrolls when tall */}
      <div className='flex min-h-full w-full items-start justify-center p-3 sm:items-center sm:p-4'>
        <div className='my-2 flex w-full max-w-2xl flex-col rounded-2xl border border-slate-300/80 bg-white shadow-2xl backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/95 sm:my-4 sm:animate-fade-in-up'>
          {/* ── Fixed header ── */}
          <header className='flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-100/80 dark:bg-slate-800/30 px-5 py-4 rounded-t-2xl'>
            <div className='text-base font-bold tracking-tight text-slate-900 dark:text-slate-100'>
              {title}
            </div>
            <button
              type='button'
              className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-400'
              onClick={onClose}
              title='Close'
            >
              <FiX className='h-4 w-4' />
            </button>
          </header>

          {/* ── Scrollable body — max 80vh so it never overflows viewport ── */}
          <div className='max-h-[80dvh] overflow-y-auto overscroll-contain p-5 sm:p-6 text-slate-900 dark:text-slate-100'>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
