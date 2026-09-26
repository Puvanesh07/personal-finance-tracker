// src/components/dashboard/DashboardCard.tsx
//
// Shared, modern card shell for the dashboard. Gives every widget the same
// soft surface, rounded corners, icon chip header and action pill so the page
// reads as one cohesive, premium system instead of mismatched boxes.
//
// Purely presentational — it holds no financial logic; cards pass their own
// source-of-truth values as children.

import type { ReactNode } from 'react';
import { FiArrowUpRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

/** Soft accent tokens for the header icon chip. */
export const ACCENT = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
} as const;

export function DashboardCard({
  icon,
  accent = ACCENT.slate,
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = '',
}: {
  icon?: ReactNode;
  accent?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-3.5 shadow-sm ring-1 ring-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:border-slate-300/70 dark:border-slate-800/70 dark:bg-slate-900/40 dark:ring-white/[0.03] dark:hover:border-slate-700 sm:p-4 ${className}`}
    >
      <header className='mb-3 flex items-start justify-between gap-2.5'>
        <div className='flex min-w-0 items-center gap-2'>
          {icon && (
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4 ${accent}`}
            >
              {icon}
            </span>
          )}
          <div className='min-w-0'>
            <h2 className='truncate text-[13px] font-bold tracking-tight text-slate-800 dark:text-slate-100'>
              {title}
            </h2>
            {subtitle && (
              <p className='mt-0.5 truncate text-[11px] font-medium text-slate-400 dark:text-slate-500'>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div className='shrink-0'>{action}</div>}
      </header>

      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Consistent header action: a soft pill that navigates to a module. */
export function CardGo({
  to,
  onClick,
  label,
}: {
  to?: string;
  onClick?: () => void;
  label?: string;
}) {
  const navigate = useNavigate();
  const handle = () => {
    if (onClick) onClick();
    else if (to) navigate(to);
  };
  return (
    <button
      type='button'
      onClick={handle}
      className='flex cursor-pointer items-center gap-1 rounded-full border border-slate-200/70 bg-slate-50/80 px-2.5 py-1 text-[10px] font-bold text-slate-500 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-800 dark:border-slate-700/60 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
    >
      {label && <span>{label}</span>}
      <FiArrowUpRight className='h-3 w-3' />
    </button>
  );
}
