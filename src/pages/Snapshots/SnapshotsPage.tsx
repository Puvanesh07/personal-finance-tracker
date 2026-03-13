import { FiCamera, FiClock, FiTag } from 'react-icons/fi';

import type { NetWorthSnapshot } from '../../types/investmentTypes';
import { SnapshotsSkeleton } from '../../components/loader/skeletons';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useState } from 'react';

export function SnapshotsPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const snapshots = usePortfolioStore((s) => s.networthSnapshots);
  const takeNetWorthSnapshot = usePortfolioStore((s) => s.takeNetWorthSnapshot);

  const [label, setLabel] = useState('');

  async function handleTakeSnapshot() {
    await takeNetWorthSnapshot(label);
    setLabel('');
  }

  if (!ready) return <SnapshotsSkeleton />;

  return (
    <div className='flex flex-col gap-6 pb-8'>
      {/* Premium Gradient Header */}
      <header className='flex flex-col xl:flex-row xl:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'>
            <FiCamera className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white'>
              Net Worth Snapshots
            </h1>
            <p className='mt-1 text-sm font-medium text-slate-600 dark:text-slate-300'>
              Freeze your net worth at key moments and track history over time.
            </p>
          </div>
        </div>

        <div className='flex flex-col sm:flex-row items-center gap-3'>
          <div className='relative group w-full sm:w-64'>
            <FiTag className='absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-500' />
            <input
              className='w-full rounded-xl border border-slate-200/80 bg-white/80 py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:border-emerald-500'
              placeholder='Snapshot Label (e.g., Q3 End)'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <button
            className='group relative flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40'
            type='button'
            onClick={() => void handleTakeSnapshot()}
          >
            <div className='absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0' />
            <FiCamera className='relative h-4 w-4' />
            <span className='relative'>Take Snapshot</span>
          </button>
        </div>
      </header>

      {/* Glassmorphism Data Table */}
      <div className='overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50'>
        <div className='overflow-x-auto custom-scrollbar'>
          <table className='min-w-full text-left text-sm whitespace-nowrap'>
            <thead className='border-b border-slate-200/60 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/30 dark:text-slate-400'>
              <tr>
                <th className='px-5 py-4'>Timestamp</th>
                <th className='px-5 py-4'>Snapshot Label</th>
                <th className='px-5 py-4 text-right'>Total Assets</th>
                <th className='px-5 py-4 text-right'>Total Liabilities</th>
                <th className='px-5 py-4 text-right'>Net Worth</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100/60 dark:divide-slate-800/60'>
              {snapshots.length === 0 ? (
                <tr>
                  <td
                    className='px-5 py-10 text-center text-slate-500'
                    colSpan={5}
                  >
                    <div className='flex flex-col items-center justify-center gap-2'>
                      <div className='rounded-full bg-slate-100 p-3 dark:bg-slate-800'>
                        <FiClock className='h-6 w-6 text-slate-400' />
                      </div>
                      <p>
                        No snapshots taken yet. Capture your current portfolio
                        to start your history.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                snapshots.map((s: NetWorthSnapshot) => {
                  const dateObj = new Date(s.createdAt);
                  return (
                    <tr
                      key={s.id}
                      className='transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    >
                      <td className='px-5 py-4'>
                        <div className='font-medium text-slate-900 dark:text-slate-50'>
                          {dateObj.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div className='text-xs text-slate-500 dark:text-slate-400'>
                          {dateObj.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className='px-5 py-4'>
                        {s.label ? (
                          <span className='inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300'>
                            {s.label}
                          </span>
                        ) : (
                          <span className='text-slate-400'>—</span>
                        )}
                      </td>
                      <td className='px-5 py-4 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400'>
                        {formatINR(s.totalAssets)}
                      </td>
                      <td className='px-5 py-4 text-right font-medium tabular-nums text-rose-600 dark:text-rose-400'>
                        {formatINR(s.totalLiabilities)}
                      </td>
                      <td className='px-5 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-slate-50'>
                        {formatINR(s.netWorth)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
