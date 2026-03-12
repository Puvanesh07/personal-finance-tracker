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
      className='fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-md overflow-y-auto'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role='dialog'
      aria-modal='true'
    >
      {/* Outer wrapper — centres vertically when content is short, scrolls when tall */}
      <div className='flex min-h-full w-full items-start sm:items-center justify-center p-3 sm:p-4'>
        <div className='w-full max-w-2xl animate-fade-in-up rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur-xl flex flex-col my-2 sm:my-4'>
          {/* ── Fixed header ── */}
          <header className='flex shrink-0 items-center justify-between gap-3 border-b border-slate-800/60 bg-slate-800/30 px-5 py-4 rounded-t-2xl'>
            <div className='text-base font-bold tracking-tight text-slate-100'>
              {title}
            </div>
            <button
              type='button'
              className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-400'
              onClick={onClose}
              title='Close'
            >
              <FiX className='h-4 w-4' />
            </button>
          </header>

          {/* ── Scrollable body — max 80vh so it never overflows viewport ── */}
          <div className='overflow-y-auto overscroll-contain p-5 sm:p-6 max-h-[80vh]'>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
