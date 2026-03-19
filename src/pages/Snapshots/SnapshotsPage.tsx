// src/pages/Snapshots/SnapshotsPage.tsx
//
// UPDATED: Full snapshot page covering all financial sections
// PURPOSE: A snapshot freezes your entire financial picture at a point in time.
//   Think of it like a financial photograph — you can compare today vs 3 months ago
//   and see exactly how your net worth changed, which assets grew, which debts shrunk.

import {
  FiActivity,
  FiCamera,
  FiCreditCard,
  FiFlag,
  FiShield,
  FiTag,
  FiTrendingUp,
} from 'react-icons/fi';
import { isSameMonth, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';

import { GiWheat } from 'react-icons/gi';
import { SnapshotsSkeleton } from '../../components/loader/skeletons';
import { formatINR } from '../../utils/format';
import { summarizePortfolio } from '../../utils/calculations';
import { useAgriStore } from '../../store/agricultureStore';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Mini stat for snapshot card ───────────────────────────────────────────
function SnapStat({
  label,
  value,
  color = 'text-slate-200',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className='flex flex-col gap-0.5'>
      <p className='text-[9px] font-bold uppercase tracking-wider text-slate-500'>
        {label}
      </p>
      <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

// ── Section icon map ──────────────────────────────────────────────────────
function SectionIcon({ type }: { type: string }) {
  const map: Record<string, { icon: React.ReactNode; bg: string }> = {
    investments: {
      icon: <FiTrendingUp className='h-3.5 w-3.5 text-emerald-400' />,
      bg: 'bg-emerald-500/10',
    },
    cashflow: {
      icon: <FiActivity className='h-3.5 w-3.5 text-purple-400' />,
      bg: 'bg-purple-500/10',
    },
    accounts: {
      icon: <FiCreditCard className='h-3.5 w-3.5 text-blue-400' />,
      bg: 'bg-blue-500/10',
    },
    insurance: {
      icon: <FiShield className='h-3.5 w-3.5 text-sky-400' />,
      bg: 'bg-sky-500/10',
    },
    goals: {
      icon: <FiFlag className='h-3.5 w-3.5 text-amber-400' />,
      bg: 'bg-amber-500/10',
    },
    agriculture: {
      icon: <GiWheat className='h-3.5 w-3.5 text-green-400' />,
      bg: 'bg-green-500/10',
    },
  };
  const { icon, bg } = map[type] ?? map.investments;
  return (
    <div
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${bg}`}
    >
      {icon}
    </div>
  );
}

export function SnapshotsPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const networthSnapshots = usePortfolioStore((s) => s.networthSnapshots);
  const takeNetWorthSnapshot = usePortfolioStore((s) => s.takeNetWorthSnapshot);
  const investments = usePortfolioStore((s) => s.investments);
  const liabilities = usePortfolioStore((s) => s.liabilities);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const accounts = usePortfolioStore((s) => s.accounts);
  const goals = usePortfolioStore((s) => s.goals);
  const insurancePolicies = usePortfolioStore((s) => s.insurancePolicies) || [];

  const agriState = useAgriStore();

  const [label, setLabel] = useState('');
  const [taking, setTaking] = useState(false);

  // Current live numbers to show "what will be snapshot-ed"
  const portfolioSummary = useMemo(
    () => summarizePortfolio(investments),
    [investments],
  );
  const liabilitiesTotal = useMemo(
    () => liabilities.reduce((a, l) => a + (l.outstanding || 0), 0),
    [liabilities],
  );
  const netWorth = portfolioSummary.totalValue - liabilitiesTotal;
  const accountBalance = useMemo(
    () => accounts.reduce((a, acc) => a + (acc.balance || 0), 0),
    [accounts],
  );
  const now = new Date();
  const thisMonthCf = useMemo(
    () =>
      cashflows.filter((c) => {
        try {
          return isSameMonth(parseISO(c.date), now);
        } catch {
          return false;
        }
      }),
    [cashflows],
  );
  const monthIncome = thisMonthCf
    .filter((c) => c.type === 'income')
    .reduce((a, c) => a + c.amount, 0);
  const monthExpense = thisMonthCf
    .filter((c) => c.type === 'expense')
    .reduce((a, c) => a + c.amount, 0);
  const agriNetProfit = useMemo(() => {
    const inc =
      (agriState.cropCycles || []).reduce(
        (a, c) => a + (c.harvestIncome || 0),
        0,
      ) +
      (agriState.milkRecords || []).reduce(
        (a, m) => a + m.liters * m.pricePerLiter,
        0,
      ) +
      (agriState.coconutRecords || []).reduce(
        (a, c) => a + (c.harvestIncome || 0),
        0,
      );
    const exp = (agriState.agriExpenses || []).reduce(
      (a, e) => a + e.amount,
      0,
    );
    return inc - exp;
  }, [agriState]);
  const totalInsuranceCoverage = insurancePolicies.reduce(
    (a, p) => a + p.coverageAmount,
    0,
  );
  const goalsProgress =
    goals.length > 0
      ? (goals.reduce((a, g) => a + g.currentAmount, 0) /
          Math.max(
            1,
            goals.reduce((a, g) => a + g.targetAmount, 0),
          )) *
        100
      : 0;

  async function handleTakeSnapshot() {
    setTaking(true);
    try {
      await takeNetWorthSnapshot(label.trim() || undefined);
      setLabel('');
    } finally {
      setTaking(false);
    }
  }

  // Net worth change vs previous snapshot
  const sorted = [...networthSnapshots].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const latest = sorted[0];
  const previous = sorted[1];
  const nwChange =
    latest && previous ? latest.netWorth - previous.netWorth : null;

  if (!ready) return <SnapshotsSkeleton />;

  return (
    <div className='flex flex-col gap-6 pb-10'>
      {/* ── Header ── */}
      <header className='rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5 border border-emerald-500/20 shadow-sm'>
        <div className='flex flex-col xl:flex-row xl:items-center justify-between gap-5'>
          <div className='flex items-center gap-4'>
            <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'>
              <FiCamera className='h-6 w-6' />
            </div>
            <div>
              <h1 className='text-2xl font-bold text-white'>
                Net Worth Snapshots
              </h1>
              <p className='text-sm text-slate-400 mt-0.5'>
                Freeze your financial picture at any moment and track how you
                grow over time.
              </p>
            </div>
          </div>
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-3'>
            <div className='relative group'>
              <FiTag className='absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors' />
              <input
                className='w-full sm:w-60 rounded-xl border border-slate-700/80 bg-slate-900/60 py-2.5 pl-10 pr-4 text-sm outline-none text-slate-100 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-600'
                placeholder='Label (e.g. Q1 2026, Pre-Wedding…)'
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <button
              className='flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-60'
              type='button'
              onClick={() => void handleTakeSnapshot()}
              disabled={taking}
            >
              {taking ? (
                <span className='h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin' />
              ) : (
                <FiCamera className='h-4 w-4' />
              )}
              {taking ? 'Saving…' : 'Take Snapshot'}
            </button>
          </div>
        </div>
      </header>

      {/* ── What is a Snapshot? ── */}
      <div className='rounded-2xl border border-slate-800 bg-slate-900/40 p-5'>
        <div className='flex items-start gap-3 mb-4'>
          <span className='text-2xl shrink-0'>📸</span>
          <div>
            <h2 className='text-base font-bold text-slate-100'>
              What is a Snapshot?
            </h2>
            <p className='text-sm text-slate-400 mt-1 leading-relaxed'>
              A snapshot is like a{' '}
              <strong className='text-slate-200'>financial photograph</strong> —
              it records your complete financial position right now: your
              investments, cash, debts, goals, insurance, and farm income all
              frozen at this exact moment.
            </p>
            <p className='text-sm text-slate-400 mt-2 leading-relaxed'>
              <strong className='text-emerald-400'>Example:</strong> You take a
              snapshot today labelled "Pre-Marriage". Six months later you take
              another labelled "Post-Marriage". You can instantly see that your
              net worth grew from ₹8.5L → ₹11.2L, your investments grew 32%, and
              your liabilities dropped by ₹1L. Without snapshots, you'd have no
              way to compare these moments.
            </p>
          </div>
        </div>

        {/* Current live preview */}
        <div className='border-t border-slate-800/60 pt-4'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-500 mb-3'>
            📊 Current snapshot will capture
          </p>
          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3'>
            {[
              {
                section: 'investments',
                label: 'Investments',
                value: formatINR(portfolioSummary.totalValue),
              },
              {
                section: 'cashflow',
                label: 'This Month Net',
                value: `${monthIncome - monthExpense >= 0 ? '+' : ''}${formatINR(monthIncome - monthExpense)}`,
              },
              {
                section: 'accounts',
                label: 'Liquid Cash',
                value: formatINR(accountBalance),
              },
              {
                section: 'goals',
                label: 'Goals Progress',
                value: `${goalsProgress.toFixed(0)}%`,
              },
              {
                section: 'insurance',
                label: 'Coverage',
                value: formatINR(totalInsuranceCoverage),
              },
              {
                section: 'agriculture',
                label: 'Farm Profit',
                value: `${agriNetProfit >= 0 ? '+' : ''}${formatINR(agriNetProfit)}`,
              },
            ].map((item) => (
              <div
                key={item.section}
                className='flex items-center gap-2.5 rounded-xl bg-slate-800/50 px-3 py-2.5'
              >
                <SectionIcon type={item.section} />
                <div className='min-w-0'>
                  <p className='text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate'>
                    {item.label}
                  </p>
                  <p className='text-xs font-bold text-slate-200 tabular-nums truncate'>
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {/* Net Worth highlight */}
          <div className='mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3'>
            <div>
              <p className='text-xs font-bold uppercase tracking-wider text-emerald-400/70'>
                Net Worth (will be captured)
              </p>
              <p className='text-2xl font-black text-emerald-400 tabular-nums'>
                {formatINR(netWorth)}
              </p>
            </div>
            {nwChange !== null && (
              <div className='sm:ml-auto text-right'>
                <p className='text-xs text-slate-400'>vs previous snapshot</p>
                <p
                  className={`text-lg font-bold tabular-nums ${nwChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {nwChange >= 0 ? '▲ +' : '▼ '}
                  {formatINR(Math.abs(nwChange))}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Snapshot History Table ── */}
      <div className='overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-lg'>
        <div className='flex items-center justify-between px-5 py-4 border-b border-slate-800/60'>
          <h2 className='text-base font-bold text-slate-100 flex items-center gap-2'>
            <FiCamera className='h-4 w-4 text-emerald-400' />
            Snapshot History
            {networthSnapshots.length > 0 && (
              <span className='text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full ml-1'>
                {networthSnapshots.length} snapshots
              </span>
            )}
          </h2>
        </div>

        {networthSnapshots.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 px-6 text-center gap-4'>
            <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800'>
              <FiCamera className='h-7 w-7 text-slate-600' />
            </div>
            <div>
              <p className='text-base font-bold text-slate-300'>
                No snapshots yet
              </p>
              <p className='text-sm text-slate-500 mt-1 max-w-sm'>
                Take your first snapshot to start tracking your financial growth
                over time. Give it a meaningful label like "Start 2026" or
                "Before investing".
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className='hidden md:block overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b border-slate-800/60 bg-slate-800/20'>
                    <th className='px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                      Date & Time
                    </th>
                    <th className='px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                      Label
                    </th>
                    <th className='px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                      Total Assets
                    </th>
                    <th className='px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                      Liabilities
                    </th>
                    <th className='px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                      Net Worth
                    </th>
                    <th className='px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-800/40'>
                  {sorted.map((s, idx) => {
                    const dateObj = new Date(s.createdAt);
                    const prev = sorted[idx + 1];
                    const change = prev ? s.netWorth - prev.netWorth : null;
                    const isLatest = idx === 0;
                    return (
                      <tr
                        key={s.id}
                        className={`transition-colors hover:bg-slate-800/30 ${isLatest ? 'bg-emerald-500/3' : ''}`}
                      >
                        <td className='px-5 py-4'>
                          <div className='flex items-center gap-2'>
                            {isLatest && (
                              <span className='h-2 w-2 rounded-full bg-emerald-400 shrink-0' />
                            )}
                            <div>
                              <p className='text-sm font-semibold text-slate-200'>
                                {dateObj.toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                              <p className='text-xs text-slate-500'>
                                {dateObj.toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className='px-5 py-4'>
                          {s.label ? (
                            <span className='inline-flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700/60 px-2.5 py-1 text-xs font-semibold text-slate-300'>
                              <FiTag className='h-3 w-3 text-slate-400' />
                              {s.label}
                            </span>
                          ) : (
                            <span className='text-slate-600 text-xs'>—</span>
                          )}
                        </td>
                        <td className='px-5 py-4 text-right'>
                          <span className='text-sm font-semibold tabular-nums text-emerald-400'>
                            {formatINR(s.totalAssets)}
                          </span>
                        </td>
                        <td className='px-5 py-4 text-right'>
                          <span className='text-sm font-semibold tabular-nums text-rose-400'>
                            {formatINR(s.totalLiabilities)}
                          </span>
                        </td>
                        <td className='px-5 py-4 text-right'>
                          <span className='text-base font-black tabular-nums text-slate-100'>
                            {formatINR(s.netWorth)}
                          </span>
                        </td>
                        <td className='px-5 py-4 text-right'>
                          {change !== null ? (
                            <div className='flex flex-col items-end'>
                              <span
                                className={`text-sm font-bold tabular-nums ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                              >
                                {change >= 0 ? '+' : ''}
                                {formatINR(change)}
                              </span>
                              {prev && prev.netWorth > 0 && (
                                <span
                                  className={`text-[10px] font-semibold ${change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}
                                >
                                  {change >= 0 ? '▲' : '▼'}{' '}
                                  {Math.abs(
                                    (change / prev.netWorth) * 100,
                                  ).toFixed(1)}
                                  %
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className='text-xs text-slate-600'>
                              First snapshot
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className='md:hidden flex flex-col divide-y divide-slate-800/40'>
              {sorted.map((s, idx) => {
                const dateObj = new Date(s.createdAt);
                const prev = sorted[idx + 1];
                const change = prev ? s.netWorth - prev.netWorth : null;
                const isLatest = idx === 0;
                return (
                  <div
                    key={s.id}
                    className={`p-4 ${isLatest ? 'bg-emerald-500/3' : ''}`}
                  >
                    <div className='flex items-start justify-between gap-3 mb-3'>
                      <div className='flex items-center gap-2'>
                        {isLatest && (
                          <span className='h-2 w-2 rounded-full bg-emerald-400 shrink-0' />
                        )}
                        <div>
                          <p className='text-sm font-semibold text-slate-200'>
                            {dateObj.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p className='text-xs text-slate-500'>
                            {dateObj.toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      {s.label && (
                        <span className='inline-flex items-center gap-1 rounded-lg bg-slate-800 border border-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300'>
                          <FiTag className='h-2.5 w-2.5' /> {s.label}
                        </span>
                      )}
                    </div>
                    <div className='grid grid-cols-3 gap-3'>
                      <SnapStat
                        label='Assets'
                        value={formatINR(s.totalAssets)}
                        color='text-emerald-400'
                      />
                      <SnapStat
                        label='Liabilities'
                        value={formatINR(s.totalLiabilities)}
                        color='text-rose-400'
                      />
                      <SnapStat
                        label='Net Worth'
                        value={formatINR(s.netWorth)}
                        color='text-slate-100'
                      />
                    </div>
                    {change !== null && (
                      <div
                        className={`mt-2 text-xs font-bold ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {change >= 0 ? '▲ +' : '▼ '}
                        {formatINR(Math.abs(change))} vs prev snapshot
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
