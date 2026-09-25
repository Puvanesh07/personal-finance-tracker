// src/components/investments/TargetAllocationPanel.tsx
//
// FinBoom-style Asset Allocation view (Wealth → Allocation → Asset Allocation):
//   • Target Allocation card  — Default/Custom badge, Edit modal, stacked bar, legend
//   • Current Allocation card — rebalancing banner, donut (total in centre), legend
//   • Target vs Actual table  — gap chips, Add/Reduce actions, expandable holdings
//   • Insights column         — severity-bordered, actionable cards
//
// Macro buckets map 1:1 onto the existing classification engine
// (utils/assetClassification) plus live bank balances for Cash & Savings —
// so every number here stays in sync with the rest of the app automatically.

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiEdit2,
  FiPieChart,
  FiPlusCircle,
  FiRefreshCcw,
  FiTarget,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';

import {
  usePortfolioStore,
  DEFAULT_ALLOCATION_TARGETS,
  type AllocationTargets,
} from '../../store/portfolioStore';
import {
  classifyInvestmentBucket,
  getAllocationTotals,
  type AllocationBucket,
} from '../../utils/assetClassification';
import { calcLiveAccountBalances, currentValue } from '../../utils/calculations';
import { formatINR } from '../../utils/format';
import type { Investment } from '../../types/investmentTypes';

// ── Macro categories ────────────────────────────────────────────────────────

type MacroKey = keyof AllocationTargets;

const MACROS: {
  key: MacroKey;
  label: string;
  color: string;
  hint: string;
}[] = [
  { key: 'equity', label: 'Equity', color: '#6366F1', hint: 'Stocks, mutual funds & ETFs' },
  { key: 'debt', label: 'Debt', color: '#0EA5E9', hint: 'FDs, bonds, PPF, NPS, EPF' },
  { key: 'realEstate', label: 'Real Estate', color: '#F97316', hint: 'Property & land holdings' },
  { key: 'commodities', label: 'Commodities', color: '#F59E0B', hint: 'Gold & silver' },
  { key: 'cash', label: 'Cash & Savings', color: '#10B981', hint: 'Bank balances & liquid cash' },
];

const SUB_LABEL: Record<string, string> = {
  stocks: 'Stocks',
  mutualFunds: 'Mutual Funds',
  etfs: 'ETFs',
  gold: 'Gold',
  silver: 'Silver',
  bonds: 'FD / Bonds',
  other: 'Others',
  realEstate: 'Property',
  bank: 'Bank Accounts',
};

/** Bucket → macro mapping. `other` assets are split: real-estate-ish names go
 *  to Real Estate, everything else stays liquid (Cash & Savings). */
function macroForInvestment(inv: Investment, bucket: AllocationBucket): MacroKey {
  switch (bucket) {
    case 'stocks':
    case 'mutualFunds':
    case 'etfs':
      return 'equity';
    case 'bonds':
      return 'debt';
    case 'gold':
    case 'silver':
      return 'commodities';
    case 'receivables':
      return 'cash';
    default: {
      const text = `${inv.name} ${(inv as any).assetType ?? ''}`.toLowerCase();
      if (/real\s*estate|property|land|plot|flat|apartment|house|site/.test(text)) {
        return 'realEstate';
      }
      return 'cash';
    }
  }
}

type Holding = {
  id: string;
  name: string;
  sub: string;
  value: number;
};

type MacroRow = {
  key: MacroKey;
  label: string;
  color: string;
  value: number;
  pct: number;
  targetPct: number;
  targetValue: number;
  gapPct: number;
  gapValue: number;
  holdings: Holding[];
};

const pctStr = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

// ── Main panel ──────────────────────────────────────────────────────────────

export function TargetAllocationPanel() {
  const investments = usePortfolioStore((s) => s.investments);
  const pendingPayments = usePortfolioStore((s) => s.pendingPayments);
  const accounts = usePortfolioStore((s) => s.accounts);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const allocationTargets = usePortfolioStore((s) => s.allocationTargets);

  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<MacroKey | null>(null);

  const { rows, total, offCount } = useMemo(() => {
    // Per-investment macro classification + holdings list
    const holdingsByMacro: Record<MacroKey, Holding[]> = {
      equity: [],
      debt: [],
      realEstate: [],
      commodities: [],
      cash: [],
    };
    for (const inv of investments) {
      const value = currentValue(inv);
      if (value <= 0) continue;
      const bucket = classifyInvestmentBucket(inv);
      const macro = macroForInvestment(inv, bucket);
      holdingsByMacro[macro].push({
        id: inv.id,
        name: inv.name,
        sub: SUB_LABEL[bucket] ?? 'Others',
        value,
      });
    }

    // Receivables count as money coming back to you → Cash & Savings
    const totals = getAllocationTotals(investments, pendingPayments);
    if (totals.receivables > 0) {
      holdingsByMacro.cash.push({
        id: '__receivables__',
        name: 'Money owed to you',
        sub: 'Receivables',
        value: totals.receivables,
      });
    }

    // Live bank balances (canonical app-wide rule) → Cash & Savings
    const balances = calcLiveAccountBalances(accounts, cashflows);
    for (const acc of accounts) {
      const bal = balances[acc.id] ?? acc.balance;
      if (bal <= 0) continue;
      holdingsByMacro.cash.push({
        id: acc.id,
        name: acc.name,
        sub: SUB_LABEL.bank,
        value: bal,
      });
    }

    const grandTotal = MACROS.reduce(
      (s, m) => s + holdingsByMacro[m.key].reduce((a, h) => a + h.value, 0),
      0,
    );

    const built: MacroRow[] = MACROS.map((m) => {
      const holdings = holdingsByMacro[m.key].sort((a, b) => b.value - a.value);
      const value = holdings.reduce((a, h) => a + h.value, 0);
      const pct = grandTotal > 0 ? (value / grandTotal) * 100 : 0;
      const targetPct = allocationTargets[m.key] ?? 0;
      const targetValue = (targetPct / 100) * grandTotal;
      return {
        key: m.key,
        label: m.label,
        color: m.color,
        value,
        pct,
        targetPct,
        targetValue,
        gapPct: pct - targetPct,
        gapValue: value - targetValue,
        holdings,
      };
    });

    return {
      rows: built,
      total: grandTotal,
      offCount: built.filter((r) => Math.abs(r.gapPct) > 5).length,
    };
  }, [investments, pendingPayments, accounts, cashflows, allocationTargets]);

  const isDefault = MACROS.every(
    (m) => (allocationTargets[m.key] ?? 0) === DEFAULT_ALLOCATION_TARGETS[m.key],
  );

  const biggestAdd = [...rows].sort((a, b) => b.gapValue - a.gapValue)[0];
  const biggestTrim = [...rows].sort((a, b) => a.gapValue - b.gapValue)[0];

  return (
    <div className='grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]'>
      {/* ── Left column ── */}
      <div className='flex min-w-0 flex-col gap-4 md:gap-5'>
        {/* Target Allocation */}
        <section className='rounded-2xl border border-slate-200/70 bg-slate-50/90 p-5 shadow-lg backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50'>
          <div className='mb-4 flex items-center justify-between gap-3'>
            <div className='flex items-center gap-2.5'>
              <FiTarget className='h-4 w-4 text-indigo-500' />
              <h3 className='text-base font-bold text-slate-900 dark:text-slate-100'>
                Target Allocation
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isDefault
                    ? 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {isDefault ? 'Default' : 'Custom'}
              </span>
            </div>
            <button
              type='button'
              onClick={() => setEditing(true)}
              className='inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-200/70 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-indigo-500/15 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-indigo-400'
            >
              <FiEdit2 className='h-3.5 w-3.5' /> Edit
            </button>
          </div>

          {/* Stacked target bar */}
          <div className='flex h-4 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800'>
            {MACROS.map((m) => {
              const pct = allocationTargets[m.key] ?? 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={m.key}
                  className='h-full transition-all duration-500'
                  style={{ width: `${pct}%`, background: m.color }}
                  title={`${m.label} ${pct}%`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className='mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3'>
            {MACROS.map((m) => (
              <div key={m.key} className='flex items-center gap-2'>
                <span
                  className='inline-block h-2.5 w-2.5 shrink-0 rounded-full'
                  style={{ background: m.color }}
                />
                <span className='text-xs font-semibold text-slate-700 dark:text-slate-200'>
                  {m.label}
                </span>
                <span className='text-xs font-black tabular-nums text-slate-900 dark:text-white'>
                  {allocationTargets[m.key] ?? 0}%
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Current Allocation */}
        <section className='rounded-2xl border border-slate-200/70 bg-slate-50/90 p-5 shadow-lg backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50'>
          <div className='mb-4 flex items-center gap-2.5'>
            <FiPieChart className='h-4 w-4 text-emerald-500' />
            <h3 className='text-base font-bold text-slate-900 dark:text-slate-100'>
              Current Allocation
            </h3>
          </div>

          {/* Rebalancing banner */}
          {total > 0 && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold ${
                offCount > 0
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {offCount > 0 ? (
                <>
                  <FiAlertTriangle className='h-4 w-4 shrink-0' />
                  Needs rebalancing. {offCount} categor{offCount === 1 ? 'y is' : 'ies are'} off
                  by over 5%.
                </>
              ) : (
                <>
                  <FiCheckCircle className='h-4 w-4 shrink-0' />
                  Well balanced — every category is within 5% of its target.
                </>
              )}
            </div>
          )}

          {total === 0 ? (
            <p className='py-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400'>
              Add investments or accounts to see your current allocation.
            </p>
          ) : (
            <div className='grid min-h-0 grid-cols-1 items-center gap-4 sm:grid-cols-[200px_1fr]'>
              {/* Donut with total in the centre */}
              <div className='relative mx-auto h-48 w-48'>
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie
                      data={rows.filter((r) => r.value > 0)}
                      dataKey='value'
                      nameKey='label'
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={3}
                      stroke='none'
                      isAnimationActive
                      animationDuration={900}
                    >
                      {rows
                        .filter((r) => r.value > 0)
                        .map((r) => (
                          <Cell key={r.key} fill={r.color} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => formatINR(Number(value))}
                      contentStyle={{
                        borderRadius: 16,
                        border: '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        backdropFilter: 'blur(8px)',
                        color: '#F8FAFC',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                      }}
                      itemStyle={{ color: '#F8FAFC', fontWeight: 600 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center'>
                  <span className='text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
                    Total
                  </span>
                  <span className='text-base font-black tabular-nums text-slate-900 dark:text-white'>
                    {formatINR(total)}
                  </span>
                </div>
              </div>

              {/* Legend: category · actual % · current value */}
              <div className='flex flex-col gap-1.5'>
                {rows
                  .filter((r) => r.value > 0)
                  .map((r) => (
                    <div
                      key={r.key}
                      className='flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white dark:hover:bg-slate-800/70'
                    >
                      <div className='flex min-w-0 items-center gap-2.5'>
                        <span
                          className='inline-block h-3 w-3 shrink-0 rounded-full'
                          style={{ background: r.color }}
                        />
                        <span className='truncate text-sm font-semibold text-slate-700 dark:text-slate-200'>
                          {r.label}
                        </span>
                      </div>
                      <div className='shrink-0 text-right'>
                        <span className='text-sm font-black tabular-nums text-slate-900 dark:text-white'>
                          {r.pct.toFixed(1)}%
                        </span>
                        <span className='ml-2 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400'>
                          {formatINR(r.value)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        {/* Target vs Actual */}
        <section className='rounded-2xl border border-slate-200/70 bg-slate-50/90 p-5 shadow-lg backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50'>
          <div className='mb-4 flex items-center gap-2.5'>
            <FiRefreshCcw className='h-4 w-4 text-sky-500' />
            <h3 className='text-base font-bold text-slate-900 dark:text-slate-100'>
              Target vs Actual
            </h3>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full min-w-[720px] border-collapse text-sm'>
              <thead>
                <tr className='border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:text-slate-400'>
                  <th className='py-2 pr-2'>Category</th>
                  <th className='px-2 py-2 text-right'>Actual</th>
                  <th className='px-2 py-2 text-right'>Cur Val</th>
                  <th className='px-2 py-2 text-right'>Target</th>
                  <th className='px-2 py-2 text-right'>Tgt Val</th>
                  <th className='px-2 py-2 text-center'>Gap</th>
                  <th className='px-2 py-2 text-right'>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOpen = expanded === r.key;
                  const onTarget = Math.abs(r.gapPct) <= 1;
                  return (
                    <FragmentRow
                      key={r.key}
                      row={r}
                      isOpen={isOpen}
                      onTarget={onTarget}
                      onToggle={() =>
                        setExpanded(isOpen ? null : r.key)
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── Right column: Insights ── */}
      <div className='flex min-w-0 flex-col gap-4'>
        <div className='flex items-center gap-2'>
          <FiTrendingUp className='h-4 w-4 text-emerald-500' />
          <h3 className='text-base font-bold text-slate-900 dark:text-slate-100'>
            Insights
          </h3>
        </div>
        <AllocationInsights
          rows={rows}
          total={total}
          biggestAdd={biggestAdd}
          biggestTrim={biggestTrim}
        />
      </div>

      {editing && (
        <EditTargetsModal
          targets={allocationTargets}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ── Target vs Actual row (expandable) ───────────────────────────────────────

function FragmentRow({
  row,
  isOpen,
  onTarget,
  onToggle,
}: {
  row: MacroRow;
  isOpen: boolean;
  onTarget: boolean;
  onToggle: () => void;
}) {
  const hasHoldings = row.holdings.length > 0;
  return (
    <>
      <tr className='border-b border-slate-100 dark:border-slate-800/60'>
        <td className='py-2.5 pr-2'>
          <button
            type='button'
            onClick={onToggle}
            disabled={!hasHoldings}
            className='flex cursor-pointer items-center gap-1.5 disabled:cursor-default'
          >
            {hasHoldings ? (
              isOpen ? (
                <FiChevronDown className='h-3.5 w-3.5 shrink-0 text-slate-400' />
              ) : (
                <FiChevronRight className='h-3.5 w-3.5 shrink-0 text-slate-400' />
              )
            ) : (
              <span className='inline-block h-3.5 w-3.5 shrink-0' />
            )}
            <span
              className='inline-block h-2.5 w-2.5 shrink-0 rounded-full'
              style={{ background: row.color }}
            />
            <span className='font-bold text-slate-900 dark:text-slate-100'>
              {row.label}
            </span>
          </button>
        </td>
        <td className='px-2 py-2.5 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200'>
          {row.pct.toFixed(1)}%
        </td>
        <td className='px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300'>
          {formatINR(row.value)}
        </td>
        <td className='px-2 py-2.5 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200'>
          {row.targetPct.toFixed(0)}%
        </td>
        <td className='px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300'>
          {formatINR(row.targetValue)}
        </td>
        <td className='px-2 py-2.5 text-center'>
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums ${
              onTarget
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : row.gapPct > 0
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}
          >
            {onTarget ? 'On target' : pctStr(row.gapPct)}
          </span>
        </td>
        <td className='px-2 py-2.5 text-right'>
          {onTarget || row.targetValue <= 0 ? (
            <span className='text-xs font-semibold text-slate-400 dark:text-slate-400'>—</span>
          ) : row.gapValue < 0 ? (
            <span className='text-xs font-black text-emerald-600 dark:text-emerald-400'>
              Add {formatINR(Math.abs(row.gapValue))}
            </span>
          ) : (
            <span className='text-xs font-black text-rose-600 dark:text-rose-400'>
              Reduce {formatINR(row.gapValue)}
            </span>
          )}
        </td>
      </tr>
      {isOpen && hasHoldings && (
        <tr>
          <td colSpan={7} className='bg-slate-100/60 px-4 py-2 dark:bg-slate-800/30'>
            {row.holdings.map((h) => (
              <div
                key={h.id}
                className='flex items-center justify-between gap-3 border-b border-slate-200/60 py-1.5 last:border-0 dark:border-slate-700/40'
              >
                <div className='flex min-w-0 items-center gap-2'>
                  <span className='truncate text-xs font-semibold text-slate-700 dark:text-slate-200'>
                    {h.name}
                  </span>
                  <span className='shrink-0 rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700/70 dark:text-slate-300'>
                    {h.sub}
                  </span>
                </div>
                <span className='shrink-0 text-xs font-black tabular-nums text-slate-900 dark:text-white'>
                  {formatINR(h.value)}
                </span>
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Insights column ─────────────────────────────────────────────────────────

function AllocationInsights({
  rows,
  total,
  biggestAdd,
  biggestTrim,
}: {
  rows: MacroRow[];
  total: number;
  biggestAdd?: MacroRow;
  biggestTrim?: MacroRow;
}) {
  if (total === 0) {
    return (
      <InsightCard severity='info' icon={FiPieChart} title='No data yet'>
        Add assets and bank accounts — allocation insights will appear here
        automatically.
      </InsightCard>
    );
  }

  const equity = rows.find((r) => r.key === 'equity');
  const debt = rows.find((r) => r.key === 'debt');
  const cash = rows.find((r) => r.key === 'cash');
  const cards: React.ReactNode[] = [];

  if (equity && equity.pct > 65) {
    cards.push(
      <InsightCard
        key='equity'
        severity='warn'
        icon={FiAlertTriangle}
        title='Heavy Equity tilt'
      >
        Equity is {equity.pct.toFixed(1)}% of your portfolio (target{' '}
        {equity.targetPct.toFixed(0)}%). High concentration means high volatility —
        consider trimming {formatINR(equity.gapValue)} into safer buckets.
      </InsightCard>,
    );
  }

  if (cash && cash.value <= 0) {
    cards.push(
      <InsightCard
        key='cash'
        severity='danger'
        icon={FiAlertTriangle}
        title='No Cash & Savings'
      >
        You have zero liquid cash tracked. Keep at least {cash.targetPct.toFixed(0)}%
        ({formatINR(cash.targetValue)}) in bank accounts for emergencies — link your
        accounts to track it here.
      </InsightCard>,
    );
  } else if (cash && cash.gapPct < -3) {
    cards.push(
      <InsightCard key='cash' severity='warn' icon={FiAlertTriangle} title='Low cash buffer'>
        Cash & Savings is {cash.pct.toFixed(1)}% vs a {cash.targetPct.toFixed(0)}%
        target. Top up by {formatINR(Math.abs(cash.gapValue))} to stay liquid.
      </InsightCard>,
    );
  }

  if (debt && debt.targetPct > 0 && debt.pct < debt.targetPct - 3) {
    cards.push(
      <InsightCard key='debt' severity='info' icon={FiPlusCircle} title='Boost Debt allocation'>
        Debt (FDs, bonds, PPF/NPS) is {debt.pct.toFixed(1)}% vs{' '}
        {debt.targetPct.toFixed(0)}% target. Add {formatINR(Math.abs(debt.gapValue))} to
        steady your portfolio against equity swings.
      </InsightCard>,
    );
  }

  if (biggestAdd && biggestAdd.gapValue < -1) {
    cards.push(
      <InsightCard
        key='next'
        severity='good'
        icon={FiTarget}
        title='Next investment'
      >
        Route your next {formatINR(Math.abs(biggestAdd.gapValue))} into{' '}
        <strong>{biggestAdd.label}</strong> — it is the furthest below its target.
        {biggestTrim && biggestTrim.gapValue > 1 && biggestTrim.key !== biggestAdd.key && (
          <> Fund it by trimming {formatINR(biggestTrim.gapValue)} from {biggestTrim.label}.</>
        )}
      </InsightCard>,
    );
  }

  if (cards.length === 0) {
    cards.push(
      <InsightCard key='ok' severity='good' icon={FiCheckCircle} title='Allocation on track'>
        Every category is close to its target. Review again after a big market move
        or a new investment.
      </InsightCard>,
    );
  }

  return <>{cards}</>;
}

const SEVERITY_CLS: Record<string, string> = {
  danger:
    'border-l-rose-500 bg-rose-500/5 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300',
  warn:
    'border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
  info: 'border-l-sky-500 bg-sky-500/5 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300',
  good: 'border-l-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

const SEVERITY_ICON_CLS: Record<string, string> = {
  danger: 'text-rose-500',
  warn: 'text-amber-500',
  info: 'text-sky-500',
  good: 'text-emerald-500',
};

function InsightCard({
  severity,
  icon: Icon,
  title,
  children,
}: {
  severity: keyof typeof SEVERITY_CLS;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200/70 border-l-4 p-4 shadow-sm dark:border-slate-800/60 ${SEVERITY_CLS[severity]}`}
    >
      <div className='mb-1.5 flex items-center gap-2'>
        <Icon className={`h-4 w-4 shrink-0 ${SEVERITY_ICON_CLS[severity]}`} />
        <p className='text-sm font-black text-slate-900 dark:text-white'>{title}</p>
      </div>
      <p className='text-[13px] font-medium leading-relaxed text-slate-600 dark:text-slate-200'>
        {children}
      </p>
    </div>
  );
}

// ── Edit targets modal ──────────────────────────────────────────────────────

function EditTargetsModal({
  targets,
  onClose,
}: {
  targets: AllocationTargets;
  onClose: () => void;
}) {
  const setAllocationTargets = usePortfolioStore((s) => s.setAllocationTargets);
  const [draft, setDraft] = useState<Record<MacroKey, string>>({
    equity: String(targets.equity ?? 0),
    debt: String(targets.debt ?? 0),
    realEstate: String(targets.realEstate ?? 0),
    commodities: String(targets.commodities ?? 0),
    cash: String(targets.cash ?? 0),
  });
  const [saving, setSaving] = useState(false);

  const nums = MACROS.map((m) => Math.max(0, Number(draft[m.key]) || 0));
  const sum = nums.reduce((a, b) => a + b, 0);
  const valid = sum === 100;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await setAllocationTargets({
        equity: nums[0],
        debt: nums[1],
        realEstate: nums[2],
        commodities: nums[3],
        cash: nums[4],
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const restoreDefault = () => {
    setDraft({
      equity: String(DEFAULT_ALLOCATION_TARGETS.equity),
      debt: String(DEFAULT_ALLOCATION_TARGETS.debt),
      realEstate: String(DEFAULT_ALLOCATION_TARGETS.realEstate),
      commodities: String(DEFAULT_ALLOCATION_TARGETS.commodities),
      cash: String(DEFAULT_ALLOCATION_TARGETS.cash),
    });
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className='w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900'
      >
        <div className='mb-5 flex items-center justify-between'>
          <h3 className='text-lg font-black text-slate-900 dark:text-white'>
            Edit Target Allocation
          </h3>
          <button
            type='button'
            onClick={onClose}
            className='cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800'
          >
            <FiX className='h-5 w-5' />
          </button>
        </div>

        <div className='flex flex-col gap-3'>
          {MACROS.map((m) => (
            <div key={m.key} className='flex items-center justify-between gap-3'>
              <div className='flex items-center gap-2.5'>
                <span
                  className='inline-block h-3 w-3 rounded-full'
                  style={{ background: m.color }}
                />
                <div>
                  <p className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                    {m.label}
                  </p>
                  <p className='text-[11px] font-medium text-slate-500 dark:text-slate-400'>
                    {m.hint}
                  </p>
                </div>
              </div>
              <div className='flex items-center gap-1'>
                <input
                  type='number'
                  min={0}
                  max={100}
                  step={1}
                  value={draft[m.key]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [m.key]: e.target.value }))
                  }
                  className='w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-right text-sm font-bold tabular-nums text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                />
                <span className='text-sm font-bold text-slate-400'>%</span>
              </div>
            </div>
          ))}
        </div>

        <p
          className={`mt-4 rounded-lg px-3 py-2 text-xs font-bold ${
            valid
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}
        >
          Total: {sum}%{valid ? ' ✓' : ' — must add up to exactly 100%'}
        </p>

        <div className='mt-5 flex items-center justify-between gap-3'>
          <button
            type='button'
            onClick={restoreDefault}
            className='cursor-pointer rounded-lg px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
          >
            Restore default
          </button>
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={onClose}
              className='cursor-pointer rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={() => void save()}
              disabled={!valid || saving}
              className='cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50'
            >
              {saving ? 'Saving…' : 'Save targets'}
            </button>
          </div>
        </div>

        <p className='mt-4 text-center text-[11px] font-medium text-slate-400 dark:text-slate-400'>
          Not sure where to start?{' '}
          <Link
            to='/wealth?tab=assets'
            className='font-bold text-indigo-500 hover:underline'
          >
            Review your assets
          </Link>{' '}
          first, then set targets that match your risk appetite.
        </p>
      </motion.div>
    </div>
  );
}
