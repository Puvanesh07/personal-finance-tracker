// src/pages/Snapshots/SnapshotsPage.tsx
//
// REVAMPED: Full snapshot coverage — investments, cashflow, accounts, goals,
// insurance, lending, SIP, liabilities, realized profits, and net worth.
// Each snapshot card is expandable to show all captured section data.

import {
  FiActivity,
  FiArrowDown,
  FiArrowUp,
  FiCamera,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiCreditCard,
  FiDollarSign,
  FiFlag,
  FiLayers,
  FiMinus,
  FiShield,
  FiTag,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi';
import { useMemo, useState } from 'react';

import { SnapshotsSkeleton } from '../../components/loader/skeletons';
import { formatINR } from '../../utils/format';
import {
  calculateNetWorth,
  summarizePortfolio,
} from '../../utils/calculations';
import { usePortfolioStore } from '../../store/portfolioStore';
import type { NetWorthSnapshot } from '../../types/investmentTypes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(val: number | undefined): string {
  if (val === undefined || val === null) return '—';
  return `${val.toFixed(1)}%`;
}

function money(val: number | undefined): string {
  if (val === undefined || val === null) return '—';
  return formatINR(val);
}

function num(val: number | undefined): string {
  if (val === undefined || val === null) return '—';
  return String(val);
}

// ─── Live preview stat chip ───────────────────────────────────────────────────
function PreviewChip({
  icon,
  label,
  value,
  color = 'text-slate-700 dark:text-slate-200',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className='flex items-center gap-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/50 px-3 py-2.5'>
      <span className='shrink-0 text-slate-500 dark:text-slate-400'>{icon}</span>
      <div className='min-w-0'>
        <p className='text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500 truncate'>
          {label}
        </p>
        <p className={`text-xs font-bold tabular-nums truncate ${color}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── Section data row inside expanded snapshot ────────────────────────────────
function SectionRow({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className='flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800/50 last:border-0'>
      <span className='text-[11px] text-slate-500 dark:text-slate-400'>{label}</span>
      <div className='text-right'>
        <span className={`text-[11px] font-bold tabular-nums ${color ?? 'text-slate-800 dark:text-slate-200'}`}>
          {value}
        </span>
        {sub && (
          <p className='text-[9px] text-slate-400 dark:text-slate-500'>{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Section panel inside expanded snapshot ───────────────────────────────────
function SectionPanel({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className='rounded-xl border border-slate-200/60 dark:border-slate-700/50 bg-white dark:bg-slate-900/40 overflow-hidden'>
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800/50 ${accent}`}>
        <span className='text-sm'>{icon}</span>
        <span className='text-[10px] font-black uppercase tracking-widest'>{title}</span>
      </div>
      <div className='px-3 py-1'>{children}</div>
    </div>
  );
}

// ─── Expanded detail for one snapshot ────────────────────────────────────────
function SnapshotDetail({ snap }: { snap: NetWorthSnapshot }) {
  const hasInv = snap.investmentValue !== undefined;
  const hasCf  = snap.monthIncome !== undefined;
  const hasAcc = snap.accountBalance !== undefined;
  const hasGoals = snap.goalsProgress !== undefined;
  const hasIns = snap.insuranceCoverage !== undefined;
  const hasLending = snap.lendingOutstanding !== undefined;
  const hasSip = snap.sipMonthlyBudget !== undefined;
  const hasLiab = snap.liabilitiesCount !== undefined;

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/50 mt-3'>
      {/* Investments */}
      {hasInv && (
        <SectionPanel
          icon={<FiTrendingUp className='text-emerald-400' />}
          title='Investments'
          accent='bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
        >
          <SectionRow label='Portfolio Value' value={money(snap.investmentValue)} color='text-emerald-500' />
          <SectionRow label='Amount Invested' value={money(snap.investedTotal)} />
          <SectionRow
            label='Unrealised P&L'
            value={snap.unrealizedPnl !== undefined ? `${snap.unrealizedPnl >= 0 ? '+' : ''}${money(snap.unrealizedPnl)}` : '—'}
            color={snap.unrealizedPnl !== undefined ? (snap.unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500') : undefined}
          />
          {snap.realizedProfit !== undefined && (
            <SectionRow
              label='Realised Profit'
              value={`${snap.realizedProfit >= 0 ? '+' : ''}${money(snap.realizedProfit)}`}
              color={snap.realizedProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}
            />
          )}
        </SectionPanel>
      )}

      {/* Cashflow */}
      {hasCf && (
        <SectionPanel
          icon={<FiActivity className='text-purple-400' />}
          title='Cashflow (This Month)'
          accent='bg-purple-500/5 text-purple-600 dark:text-purple-400'
        >
          <SectionRow label='Income' value={money(snap.monthIncome)} color='text-emerald-500' />
          <SectionRow label='Expenses' value={money(snap.monthExpense)} color='text-rose-500' />
          <SectionRow
            label='Net Savings'
            value={snap.monthNet !== undefined ? `${snap.monthNet >= 0 ? '+' : ''}${money(snap.monthNet)}` : '—'}
            color={snap.monthNet !== undefined ? (snap.monthNet >= 0 ? 'text-emerald-500' : 'text-rose-500') : undefined}
          />
        </SectionPanel>
      )}

      {/* Accounts */}
      {hasAcc && (
        <SectionPanel
          icon={<FiCreditCard className='text-blue-400' />}
          title='Liquid Cash'
          accent='bg-blue-500/5 text-blue-600 dark:text-blue-400'
        >
          <SectionRow label='Account Balance' value={money(snap.accountBalance)} color='text-blue-400' />
        </SectionPanel>
      )}

      {/* Goals */}
      {hasGoals && (
        <SectionPanel
          icon={<FiFlag className='text-amber-400' />}
          title='Goals'
          accent='bg-amber-500/5 text-amber-600 dark:text-amber-400'
        >
          <SectionRow label='Progress' value={pct(snap.goalsProgress)} color='text-amber-400' />
          <SectionRow label='Total Saved' value={money(snap.goalsSaved)} />
          <SectionRow label='Total Target' value={money(snap.goalsTarget)} />
          {snap.goalsCount !== undefined && (
            <SectionRow label='Active Goals' value={num(snap.goalsCount)} />
          )}
        </SectionPanel>
      )}

      {/* Insurance */}
      {hasIns && (
        <SectionPanel
          icon={<FiShield className='text-sky-400' />}
          title='Insurance'
          accent='bg-sky-500/5 text-sky-600 dark:text-sky-400'
        >
          <SectionRow label='Total Coverage' value={money(snap.insuranceCoverage)} color='text-sky-400' />
          {snap.insurancePoliciesCount !== undefined && (
            <SectionRow label='Active Policies' value={num(snap.insurancePoliciesCount)} />
          )}
        </SectionPanel>
      )}

      {/* Lending */}
      {hasLending && (
        <SectionPanel
          icon={<FiUsers className='text-violet-400' />}
          title='Lending'
          accent='bg-violet-500/5 text-violet-600 dark:text-violet-400'
        >
          <SectionRow label='Outstanding' value={money(snap.lendingOutstanding)} color='text-violet-400' />
          {snap.lendingBorrowersCount !== undefined && (
            <SectionRow label='Active Borrowers' value={num(snap.lendingBorrowersCount)} />
          )}
        </SectionPanel>
      )}

      {/* SIP */}
      {hasSip && (
        <SectionPanel
          icon={<FiLayers className='text-teal-400' />}
          title='SIP Plan'
          accent='bg-teal-500/5 text-teal-600 dark:text-teal-400'
        >
          <SectionRow label='Monthly Budget' value={money(snap.sipMonthlyBudget)} color='text-teal-400' />
          {snap.sipInstrumentsCount !== undefined && (
            <SectionRow label='Instruments' value={num(snap.sipInstrumentsCount)} />
          )}
        </SectionPanel>
      )}

      {/* Liabilities */}
      {hasLiab && (
        <SectionPanel
          icon={<FiDollarSign className='text-rose-400' />}
          title='Liabilities'
          accent='bg-rose-500/5 text-rose-600 dark:text-rose-400'
        >
          <SectionRow label='Active Loans' value={num(snap.liabilitiesCount)} />
          {snap.totalEmiMonthly !== undefined && snap.totalEmiMonthly > 0 && (
            <SectionRow label='Monthly EMI' value={money(snap.totalEmiMonthly)} color='text-rose-400' />
          )}
          <SectionRow label='Total Outstanding' value={money(snap.totalLiabilities)} color='text-rose-400' />
        </SectionPanel>
      )}

      {/* Legacy snapshots that only have net worth */}
      {!hasInv && !hasCf && !hasAcc && !hasGoals && !hasIns && !hasLending && !hasSip && !hasLiab && (
        <div className='col-span-full text-center py-4 text-xs text-slate-400 dark:text-slate-500'>
          This snapshot was taken before detailed section tracking was added. Only net worth data is available.
        </div>
      )}
    </div>
  );
}

// ─── Snapshot row (desktop table + expandable detail) ────────────────────────
function SnapshotRow({
  snap,
  prev,
  isLatest,
}: {
  snap: NetWorthSnapshot;
  prev: NetWorthSnapshot | null;
  isLatest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const dateObj = new Date(snap.createdAt);
  const change = prev ? snap.netWorth - prev.netWorth : null;
  const changePct = change !== null && prev && prev.netWorth !== 0
    ? (change / Math.abs(prev.netWorth)) * 100
    : null;

  return (
    <>
      {/* Desktop row */}
      <tr
        className={`border-b border-slate-100 dark:border-slate-800/40 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer ${isLatest ? 'bg-emerald-500/[0.03]' : ''}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className='px-5 py-4'>
          <div className='flex items-center gap-2'>
            {isLatest && (
              <span className='h-2 w-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.5)]' />
            )}
            <div>
              <p className='text-sm font-semibold text-slate-900 dark:text-slate-200'>
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
          {snap.label ? (
            <span className='inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300'>
              <FiTag className='h-3 w-3 text-slate-400' />
              {snap.label}
            </span>
          ) : (
            <span className='text-xs text-slate-400 dark:text-slate-600'>—</span>
          )}
        </td>
        <td className='px-5 py-4 text-right'>
          <span className='text-sm font-semibold tabular-nums text-emerald-500'>
            {money(snap.totalAssets)}
          </span>
        </td>
        <td className='px-5 py-4 text-right'>
          <span className='text-sm font-semibold tabular-nums text-rose-400'>
            {money(snap.totalLiabilities)}
          </span>
        </td>
        <td className='px-5 py-4 text-right'>
          <span className='text-base font-black tabular-nums text-slate-900 dark:text-slate-100'>
            {money(snap.netWorth)}
          </span>
        </td>
        <td className='px-5 py-4 text-right'>
          {change !== null ? (
            <div className='flex flex-col items-end'>
              <span className={`flex items-center gap-0.5 text-sm font-bold tabular-nums ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {change >= 0 ? <FiArrowUp className='h-3 w-3' /> : <FiArrowDown className='h-3 w-3' />}
                {money(Math.abs(change))}
              </span>
              {changePct !== null && (
                <span className={`text-[10px] font-semibold ${change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {change >= 0 ? '+' : ''}{changePct.toFixed(1)}%
                </span>
              )}
            </div>
          ) : (
            <span className='text-xs text-slate-400 dark:text-slate-600'>First</span>
          )}
        </td>
        <td className='px-4 py-4'>
          <button
            type='button'
            title={expanded ? 'Collapse' : 'Expand details'}
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors'
          >
            {expanded ? <FiChevronUp className='h-4 w-4' /> : <FiChevronDown className='h-4 w-4' />}
          </button>
        </td>
      </tr>
      {/* Expanded detail */}
      {expanded && (
        <tr className='bg-slate-50/70 dark:bg-slate-900/40'>
          <td colSpan={7} className='px-5 pb-5 pt-1'>
            <SnapshotDetail snap={snap} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Mobile card ──────────────────────────────────────────────────────────────
function SnapshotMobileCard({
  snap,
  prev,
  isLatest,
}: {
  snap: NetWorthSnapshot;
  prev: NetWorthSnapshot | null;
  isLatest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const dateObj = new Date(snap.createdAt);
  const change = prev ? snap.netWorth - prev.netWorth : null;

  return (
    <div className={`border-b border-slate-100 dark:border-slate-800/40 last:border-0 ${isLatest ? 'bg-emerald-500/[0.03]' : ''}`}>
      <button
        type='button'
        className='w-full p-4 text-left'
        onClick={() => setExpanded((v) => !v)}
      >
        <div className='flex items-start justify-between gap-3 mb-3'>
          <div className='flex items-center gap-2'>
            {isLatest && <span className='h-2 w-2 rounded-full bg-emerald-400 shrink-0' />}
            <div>
              <p className='text-sm font-semibold text-slate-900 dark:text-slate-200'>
                {dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <p className='text-xs text-slate-500'>
                {dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {snap.label && (
              <span className='inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300'>
                <FiTag className='h-2.5 w-2.5' />
                {snap.label}
              </span>
            )}
            {expanded ? <FiChevronUp className='h-4 w-4 text-slate-400' /> : <FiChevronDown className='h-4 w-4 text-slate-400' />}
          </div>
        </div>

        {/* Core numbers */}
        <div className='grid grid-cols-3 gap-3 mb-2'>
          <div>
            <p className='text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5'>Assets</p>
            <p className='text-xs font-bold tabular-nums text-emerald-400'>{money(snap.totalAssets)}</p>
          </div>
          <div>
            <p className='text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5'>Liabilities</p>
            <p className='text-xs font-bold tabular-nums text-rose-400'>{money(snap.totalLiabilities)}</p>
          </div>
          <div>
            <p className='text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5'>Net Worth</p>
            <p className='text-sm font-black tabular-nums text-slate-900 dark:text-slate-100'>{money(snap.netWorth)}</p>
          </div>
        </div>

        {change !== null && (
          <p className={`text-xs font-bold flex items-center gap-1 ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {change >= 0 ? <FiArrowUp className='h-3 w-3' /> : <FiArrowDown className='h-3 w-3' />}
            {money(Math.abs(change))} vs prev snapshot
          </p>
        )}
      </button>

      {expanded && (
        <div className='px-4 pb-4'>
          <SnapshotDetail snap={snap} />
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function SnapshotsPage() {
  const ready               = usePortfolioStore((s) => s.ready);
  const networthSnapshots   = usePortfolioStore((s) => s.networthSnapshots);
  const takeNetWorthSnapshot = usePortfolioStore((s) => s.takeNetWorthSnapshot);
  const investments         = usePortfolioStore((s) => s.investments);
  const liabilities         = usePortfolioStore((s) => s.liabilities);
  const cashflows           = usePortfolioStore((s) => s.cashflows);
  const accounts            = usePortfolioStore((s) => s.accounts);
  const goals               = usePortfolioStore((s) => s.goals);
  const insurancePolicies   = usePortfolioStore((s) => s.insurancePolicies) ?? [];
  const lendingBorrowers    = usePortfolioStore((s) => s.lendingBorrowers) ?? [];
  const lendingTransactions = usePortfolioStore((s) => s.lendingTransactions) ?? [];
  const sipPlans            = usePortfolioStore((s) => s.sipPlans) ?? [];
  const soldTrades          = usePortfolioStore((s) => s.soldTrades) ?? [];

  const [label, setLabel]   = useState('');
  const [taking, setTaking] = useState(false);

  // ── Live preview numbers ─────────────────────────────────────────────────
  const portfolioSummary = useMemo(() => summarizePortfolio(investments), [investments]);
  const { totalAssets, totalLiabilities, netWorth } = useMemo(
    () => calculateNetWorth(investments, liabilities),
    [investments, liabilities],
  );

  const accountBalance = useMemo(
    () => accounts.reduce((a, acc) => a + (acc.balance || 0), 0),
    [accounts],
  );

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthCf = useMemo(
    () => cashflows.filter((c) => (c.date ?? '').startsWith(ym)),
    [cashflows, ym],
  );
  const monthIncome  = thisMonthCf.filter((c) => c.type === 'income').reduce((a, c) => a + c.amount, 0);
  const monthExpense = thisMonthCf.filter((c) => c.type === 'expense').reduce((a, c) => a + c.amount, 0);

  const totalInsuranceCoverage = insurancePolicies.reduce((a, p) => a + p.coverageAmount, 0);

  const goalsTarget = goals.reduce((a, g) => a + g.targetAmount, 0);
  const goalsSaved  = goals.reduce((a, g) => a + g.currentAmount, 0);
  const goalsProgress = goalsTarget > 0 ? (goalsSaved / goalsTarget) * 100 : 0;

  const activeBorrowers = lendingBorrowers.filter((b) => b.status === 'active');
  const validBorrowerIds = new Set(activeBorrowers.map((b) => b.id));
  const lendingOutstanding = useMemo(() => {
    const given    = lendingTransactions.filter((tx) => validBorrowerIds.has(tx.borrowerId) && tx.type === 'principal_given').reduce((s, tx) => s + (tx.amount || 0), 0);
    const returned = lendingTransactions.filter((tx) => validBorrowerIds.has(tx.borrowerId) && tx.type === 'principal_returned').reduce((s, tx) => s + (tx.amount || 0), 0);
    return Math.max(0, given - returned);
  }, [lendingTransactions, validBorrowerIds]);

  const sipBudget = sipPlans.find((x: any) => x.type === 'budget');
  const sipMonthly = sipBudget?.budget || 0;

  const realizedProfit = useMemo(
    () => soldTrades.reduce((s, t) => s + (t.profit || 0), 0),
    [soldTrades],
  );

  const activeLiabilities = liabilities.filter(
    (l) => l.status !== 'paid' && l.status !== 'returned',
  );

  async function handleTakeSnapshot() {
    setTaking(true);
    try {
      await takeNetWorthSnapshot(label.trim() || undefined);
      setLabel('');
    } finally {
      setTaking(false);
    }
  }

  // ── Sorted snapshots ─────────────────────────────────────────────────────
  const sorted = useMemo(
    () => [...networthSnapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [networthSnapshots],
  );
  const latest   = sorted[0];
  const previous = sorted[1];
  const nwChange = latest && previous ? latest.netWorth - previous.netWorth : null;

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
              <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>
                Net Worth Snapshots
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
                Freeze your entire financial picture at any moment — investments, cashflow, goals, insurance, lending, SIP, and more.
              </p>
            </div>
          </div>
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-3'>
            <div className='relative group'>
              <FiTag className='absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors' />
              <input
                className='w-full sm:w-60 rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-900/60 py-2.5 pl-10 pr-4 text-sm outline-none text-slate-900 dark:text-slate-100 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-600'
                placeholder='Label (e.g. Q1 2026, Pre-Wedding…)'
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !taking) void handleTakeSnapshot(); }}
              />
            </div>
            <button
              className='flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-60 cursor-pointer'
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

      {/* ── What will be captured ── */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5'>
        <div className='flex items-start gap-3 mb-4'>
          <span className='text-2xl shrink-0'>📸</span>
          <div>
            <h2 className='text-base font-bold text-slate-900 dark:text-slate-100'>
              What is a Snapshot?
            </h2>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed'>
              A snapshot is a <strong className='text-slate-900 dark:text-slate-200'>financial photograph</strong> — it records your complete financial position right now, covering every section of the app in a single frozen moment.
              Compare snapshots over time to see exactly how your net worth evolved, which assets grew, which debts shrank, and how your savings rate changed.
            </p>
          </div>
        </div>

        <div className='border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-500 mb-3'>
            📊 What will be captured right now
          </p>
          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5'>
            <PreviewChip
              icon={<FiTrendingUp className='h-3.5 w-3.5' />}
              label='Investments'
              value={formatINR(portfolioSummary.totalValue)}
              color='text-emerald-500'
            />
            <PreviewChip
              icon={<FiActivity className='h-3.5 w-3.5' />}
              label='Month Net'
              value={`${monthIncome - monthExpense >= 0 ? '+' : ''}${formatINR(monthIncome - monthExpense)}`}
              color={monthIncome - monthExpense >= 0 ? 'text-emerald-500' : 'text-rose-400'}
            />
            <PreviewChip
              icon={<FiCreditCard className='h-3.5 w-3.5' />}
              label='Liquid Cash'
              value={formatINR(accountBalance)}
              color='text-blue-400'
            />
            <PreviewChip
              icon={<FiFlag className='h-3.5 w-3.5' />}
              label='Goals Progress'
              value={`${goalsProgress.toFixed(0)}%`}
              color='text-amber-400'
            />
            <PreviewChip
              icon={<FiShield className='h-3.5 w-3.5' />}
              label='Coverage'
              value={formatINR(totalInsuranceCoverage)}
              color='text-sky-400'
            />
            <PreviewChip
              icon={<FiUsers className='h-3.5 w-3.5' />}
              label='Lending Out'
              value={formatINR(lendingOutstanding)}
              color='text-violet-400'
            />
            <PreviewChip
              icon={<FiLayers className='h-3.5 w-3.5' />}
              label='SIP Budget'
              value={formatINR(sipMonthly)}
              color='text-teal-400'
            />
            <PreviewChip
              icon={<FiCheckCircle className='h-3.5 w-3.5' />}
              label='Realised P&L'
              value={`${realizedProfit >= 0 ? '+' : ''}${formatINR(realizedProfit)}`}
              color={realizedProfit >= 0 ? 'text-emerald-500' : 'text-rose-400'}
            />
            <PreviewChip
              icon={<FiMinus className='h-3.5 w-3.5' />}
              label='Active Loans'
              value={`${activeLiabilities.length}`}
              color='text-rose-400'
            />
          </div>

          {/* Net worth highlight */}
          <div className='mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3'>
            <div>
              <p className='text-xs font-bold uppercase tracking-wider text-emerald-500/70'>
                Net Worth (will be captured)
              </p>
              <p className='text-xs text-slate-500 dark:text-slate-400 mt-0.5'>
                Total Assets ({formatINR(totalAssets)}) − Total Liabilities ({formatINR(totalLiabilities)})
              </p>
              <p className='text-2xl font-black text-emerald-400 tabular-nums mt-0.5'>
                {formatINR(netWorth)}
              </p>
            </div>
            {nwChange !== null && (
              <div className='sm:ml-auto text-right'>
                <p className='text-xs text-slate-500 dark:text-slate-400'>vs previous snapshot</p>
                <p className={`text-lg font-bold tabular-nums flex items-center justify-end gap-1 ${nwChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {nwChange >= 0 ? <FiArrowUp className='h-4 w-4' /> : <FiArrowDown className='h-4 w-4' />}
                  {formatINR(Math.abs(nwChange))}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Snapshot History ── */}
      <div className='overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shadow-sm'>
        <div className='flex items-center justify-between px-5 py-4 border-b border-slate-200/70 dark:border-slate-800/60'>
          <h2 className='text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2'>
            <FiCamera className='h-4 w-4 text-emerald-400' />
            Snapshot History
            {networthSnapshots.length > 0 && (
              <span className='text-xs font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full ml-1'>
                {networthSnapshots.length} {networthSnapshots.length === 1 ? 'snapshot' : 'snapshots'}
              </span>
            )}
          </h2>
          {networthSnapshots.length > 0 && (
            <p className='text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block'>
              Click any row to expand section details
            </p>
          )}
        </div>

        {networthSnapshots.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 px-6 text-center gap-4'>
            <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 dark:bg-slate-800'>
              <FiCamera className='h-7 w-7 text-slate-400 dark:text-slate-500' />
            </div>
            <div>
              <p className='text-base font-bold text-slate-700 dark:text-slate-300'>No snapshots yet</p>
              <p className='text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm'>
                Take your first snapshot to start tracking your financial growth over time.
                Give it a meaningful label like "Start 2026" or "Before investing".
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className='hidden md:block overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b border-slate-200/70 dark:border-slate-800/60 bg-slate-100/60 dark:bg-slate-800/20'>
                    {['Date & Time', 'Label', 'Total Assets', 'Liabilities', 'Net Worth', 'Change', ''].map((h) => (
                      <th
                        key={h}
                        className='px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 last:w-10'
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((snap, idx) => (
                    <SnapshotRow
                      key={snap.id}
                      snap={snap}
                      prev={sorted[idx + 1] ?? null}
                      isLatest={idx === 0}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className='md:hidden flex flex-col'>
              {sorted.map((snap, idx) => (
                <SnapshotMobileCard
                  key={snap.id}
                  snap={snap}
                  prev={sorted[idx + 1] ?? null}
                  isLatest={idx === 0}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
