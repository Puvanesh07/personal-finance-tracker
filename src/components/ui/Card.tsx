import type { PropsWithChildren, ReactNode } from 'react';

export function Card({
  title,
  right,
  children,
}: PropsWithChildren<{ title?: ReactNode; right?: ReactNode }>) {
  return (
    <section className='flex h-full flex-col rounded-2xl border border-slate-200/70 bg-slate-50/90 p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-slate-300/80 hover:shadow-xl dark:border-slate-800/60 dark:bg-slate-900/50 dark:shadow-xl dark:hover:border-slate-700/80 dark:hover:shadow-2xl'>
      {(title ?? right) && (
        <header className='mb-4 flex items-center justify-between gap-4 border-b border-slate-200/80 pb-3 dark:border-slate-800/50'>
          <div className='text-base font-semibold text-slate-900 dark:text-slate-100'>
            {title}
          </div>
          {right ? <div className='shrink-0'>{right}</div> : null}
        </header>
      )}
      <div className='flex-1'>{children}</div>
    </section>
  );
}
