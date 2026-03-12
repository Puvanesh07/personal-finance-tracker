// src/pages/Insights/InsightsPage.tsx

import type {
  CashflowEntry,
  EssentialsConfig,
  Investment,
  Liability,
} from '../../types/investmentTypes';
import { FiSave, FiZap } from 'react-icons/fi';
import { formatINR, formatNumber } from '../../utils/format';
import { useMemo, useState } from 'react';

import { summarizePortfolio } from '../../utils/calculations';
import { usePortfolioStore } from '../../store/portfolioStore';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function calcMonthlyAvg(
  entries: CashflowEntry[],
  type: 'income' | 'expense',
): number {
  const filtered = entries.filter((e) => e.type === type);
  if (!filtered.length) return 0;
  const total = filtered.reduce((acc, e) => acc + e.amount, 0);
  const months = new Set(filtered.map((e) => e.date.substring(0, 7))).size || 1;
  return total / months;
}

function calcLiquidInvestments(investments: Investment[]): number {
  return investments.reduce((acc, i) => {
    if (i.type === 'fixed_deposit') return acc + (i.investedAmount ?? 0);
    if (i.type === 'other') return acc + (i.currentValue ?? 0);
    return acc;
  }, 0);
}

function calcEquityValue(investments: Investment[]): number {
  return investments.reduce((acc, i) => {
    if (i.type === 'stock')
      return acc + (i.quantity ?? 0) * (i.currentPrice ?? 0);
    if (i.type === 'mutual_fund') return acc + (i.units ?? 0) * (i.nav ?? 0);
    return acc;
  }, 0);
}

function calcTaxLossPotential(investments: Investment[]): number {
  return investments.reduce((acc, i) => {
    if (i.type !== 'stock') return acc;
    const loss = (i.buyPrice - i.currentPrice) * i.quantity;
    return loss > 0 ? acc + loss : acc;
  }, 0);
}

function getTopDebt(liabilities: Liability[]): Liability | undefined {
  if (!liabilities.length) return undefined;
  return [...liabilities].sort(
    (a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0),
  )[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH SCORE
// ─────────────────────────────────────────────────────────────────────────────
function calcHealthScore(
  investments: Investment[],
  liabilities: Liability[],
  cashflows: CashflowEntry[],
  essentials: EssentialsConfig,
) {
  const { totalValue } = summarizePortfolio(investments);
  const totalLiabilities = liabilities.reduce(
    (acc, l) => acc + (l.outstanding ?? 0),
    0,
  );

  // 1. Debt Score (30pts)
  // Rules:
  //   No assets AND no liabilities = no data = 0pts (not 30 - you have not earned it)
  //   Has assets, zero liabilities  = debtRatio 0 = full 30pts
  //   No assets but has liabilities = debtRatio 1 (worst) = 0pts
  //   debtRatio >= 0.5 (50%+)       = 0pts
  const hasAnyFinancialData = totalValue > 0 || totalLiabilities > 0;
  const debtRatio = !hasAnyFinancialData
    ? 0
    : totalValue > 0
      ? Math.min(1, totalLiabilities / totalValue)
      : 1;
  const debtScore = !hasAnyFinancialData ? 0 : Math.max(0, 30 - debtRatio * 60);

  // 2. Emergency Fund Score (20pts)
  const liquidInvestments = calcLiquidInvestments(investments);
  const emergencySaved = essentials.emergencyFundCurrent ?? 0;
  const emergencyTarget = essentials.emergencyFundTarget ?? 0;
  const totalLiquid = liquidInvestments + emergencySaved;
  const avgExpense = calcMonthlyAvg(cashflows, 'expense');

  let runway = 0;
  let emergencyScore = 0;

  if (avgExpense > 0) {
    // FIX: use actual expense data for runway
    runway = totalLiquid / avgExpense;
    emergencyScore = Math.min(20, (runway / 6) * 20);
  } else if (emergencyTarget > 0) {
    // FIX: no expense data → score by % of target reached (target ≈ 6 months expenses)
    const pct = Math.min(1, totalLiquid / emergencyTarget);
    emergencyScore = pct * 20;
    runway = pct * 6; // implied runway
  } else if (totalLiquid > 0) {
    // Has liquid assets but no reference point — minimal credit
    emergencyScore = 5;
  }

  // 3. Savings Rate Score (25pts)
  const avgIncome = calcMonthlyAvg(cashflows, 'income');
  const savingsRate =
    avgIncome > 0 && avgExpense > 0
      ? ((avgIncome - avgExpense) / avgIncome) * 100
      : 0;
  const savingsScore = Math.min(25, Math.max(0, (savingsRate / 30) * 25));

  // 4. Diversification Score (25pts)
  // FIX: old code counted unique type strings — meaningless. Now awards 5pts per asset class.
  const hasEquity = investments.some(
    (i) => i.type === 'stock' || i.type === 'mutual_fund',
  );
  const hasDebt = investments.some(
    (i) => i.type === 'bond' || i.type === 'fixed_deposit',
  );
  const hasRealAssets = investments.some(
    (i) =>
      i.type === 'other' &&
      ['gold', 'silver', 'real_estate'].includes((i as any).assetType ?? ''),
  );
  const hasAltAssets = investments.some(
    (i) =>
      i.type === 'other' &&
      ['crypto', 'international_equity'].includes((i as any).assetType ?? ''),
  );
  const hasCash = totalLiquid > 0;
  const assetClassCount = [
    hasEquity,
    hasDebt,
    hasRealAssets,
    hasAltAssets,
    hasCash,
  ].filter(Boolean).length;
  const divScore = Math.min(25, assetClassCount * 5);

  return {
    total: Math.round(debtScore + emergencyScore + savingsScore + divScore),
    debtScore: Math.round(debtScore),
    emergencyScore: Math.round(emergencyScore),
    savingsScore: Math.round(savingsScore),
    divScore: Math.round(divScore),
    debtRatio,
    runway,
    savingsRate,
    totalLiquid,
    emergencyTarget,
    emergencySaved,
    avgExpense,
    avgIncome,
    assetClassCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRE PROJECTION
// ─────────────────────────────────────────────────────────────────────────────
function calcFIRE(
  netWorth: number,
  monthlySavings: number,
  monthlyExpense: number,
  emergencyTarget: number,
  expectedReturnPct = 10,
) {
  // FIX: never hardcode ₹6L fallback — derive from emergency target or return uncalculable
  let annualExpense: number;
  if (monthlyExpense > 0) {
    annualExpense = monthlyExpense * 12;
  } else if (emergencyTarget > 0) {
    annualExpense = emergencyTarget * 2; // target ≈ 6mo expenses → annual = target * 2
  } else {
    return {
      target: 0,
      yearsToFIRE: null,
      achievable: false,
      uncalculable: true,
    };
  }

  const target = annualExpense * 25; // 4% safe withdrawal rule (25x)
  const monthlyRate = expectedReturnPct / 12 / 100;

  // FIX: already at FIRE?
  if (netWorth >= target) {
    return { target, yearsToFIRE: 0, achievable: true, uncalculable: false };
  }

  // FIX: negative/zero savings with negative netWorth → never achievable, avoid infinite loop
  if (monthlySavings <= 0 && netWorth <= 0) {
    return {
      target,
      yearsToFIRE: null,
      achievable: false,
      uncalculable: false,
    };
  }

  let current = netWorth;
  let months = 0;
  while (current < target && months < 600) {
    current = (current + Math.max(0, monthlySavings)) * (1 + monthlyRate);
    months++;
  }

  return {
    target,
    yearsToFIRE: months < 600 ? Math.round(months / 12) : null,
    achievable: months < 600,
    uncalculable: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div
      className='relative'
      style={{ width: 112, height: 112, flexShrink: 0 }}
    >
      <svg width='112' height='112' viewBox='0 0 112 112'>
        <circle
          cx='56'
          cy='56'
          r={r}
          fill='none'
          stroke='#1e293b'
          strokeWidth='10'
        />
        <circle
          cx='56'
          cy='56'
          r={r}
          fill='none'
          stroke={color}
          strokeWidth='10'
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap='round'
          transform='rotate(-90 56 56)'
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className='absolute inset-0 flex flex-col items-center justify-center'>
        <span
          className='text-2xl font-bold'
          style={{ color, fontFamily: 'monospace' }}
        >
          {score}
        </span>
        <span className='text-[10px] text-slate-500'>/100</span>
      </div>
    </div>
  );
}

function MiniBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className='mb-2.5'>
      <div className='flex justify-between text-[11px] text-slate-400 mb-1'>
        <span>{label}</span>
        <span style={{ color, fontFamily: 'monospace' }}>
          {value}/{max}
        </span>
      </div>
      <div className='h-1.5 bg-slate-800 rounded-full overflow-hidden'>
        <div
          className='h-full rounded-full transition-all duration-700'
          style={{ width: `${(value / max) * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div
      className='rounded-xl p-3.5 flex flex-col gap-1'
      style={{
        background: '#0f172a',
        border: `1px solid ${color}22`,
        borderTop: `2px solid ${color}`,
      }}
    >
      <div className='flex items-center gap-1.5'>
        <span className='text-base'>{icon}</span>
        <span className='text-[10px] text-slate-500 uppercase tracking-wider font-semibold'>
          {label}
        </span>
      </div>
      <div
        className='text-base font-bold text-slate-100'
        style={{ fontFamily: 'monospace' }}
      >
        {value}
      </div>
      {sub && <div className='text-[11px] text-slate-500'>{sub}</div>}
    </div>
  );
}

function FireCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className='rounded-xl p-3.5 bg-slate-950'>
      <div className='text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5'>
        {label}
      </div>
      <div
        className='text-base font-bold'
        style={{ color, fontFamily: 'monospace' }}
      >
        {value}
      </div>
      <div className='text-[11px] text-slate-500 mt-0.5'>{sub}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const {
    investments,
    liabilities,
    cashflows,
    latestInsight,
    saveInsightSnapshot,
    ready,
    essentials,
  } = usePortfolioStore();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const metrics = useMemo(() => {
    const { totalValue } = summarizePortfolio(investments);
    const totalLiabilities = liabilities.reduce(
      (acc, l) => acc + (l.outstanding ?? 0),
      0,
    );
    const netWorth = totalValue - totalLiabilities;
    const health = calcHealthScore(
      investments,
      liabilities,
      cashflows,
      essentials,
    );
    const avgIncome = calcMonthlyAvg(cashflows, 'income');
    const avgExpense = calcMonthlyAvg(cashflows, 'expense');
    const monthlySavings = avgIncome - avgExpense;
    const equityValue = calcEquityValue(investments);
    const equityPct = totalValue > 0 ? (equityValue / totalValue) * 100 : 0;
    const taxLoss = calcTaxLossPotential(investments);
    const topDebt = getTopDebt(liabilities);
    const fire = calcFIRE(
      netWorth,
      monthlySavings,
      avgExpense,
      essentials.emergencyFundTarget ?? 0,
    );

    return {
      totalValue,
      totalLiabilities,
      netWorth,
      health,
      avgIncome,
      avgExpense,
      monthlySavings,
      equityPct,
      taxLoss,
      topDebt,
      fire,
    };
  }, [investments, liabilities, cashflows, essentials]);

  const { health, fire } = metrics;
  const healthLabel =
    health.total >= 75
      ? 'Excellent'
      : health.total >= 50
        ? 'Fair'
        : 'Needs Attention';
  const healthColor =
    health.total >= 75 ? '#22c55e' : health.total >= 50 ? '#f59e0b' : '#ef4444';

  async function handleSave() {
    setSaving(true);
    try {
      await saveInsightSnapshot({
        debtToAssetRatio: health.debtRatio,
        emergencyRunwayMonths: health.runway,
        totalTaxLossPotential: metrics.taxLoss,
        equityAllocationPct: metrics.equityPct,
        ...(metrics.topDebt ? { topDebtPriorityId: metrics.topDebt.id } : {}),
        rebalanceRequired:
          investments.length > 0 &&
          (metrics.equityPct > 80 || metrics.equityPct < 20),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (!ready)
    return (
      <div className='flex items-center justify-center h-60 text-slate-500'>
        Loading insights…
      </div>
    );

  const noData =
    investments.length === 0 &&
    cashflows.length === 0 &&
    liabilities.length === 0 &&
    (essentials.emergencyFundCurrent ?? 0) === 0 &&
    (essentials.emergencyFundTarget ?? 0) === 0;

  // ── Emergency card smart display ──────────────────────────────────────────
  const hasExpenseData = metrics.avgExpense > 0;

  const emergencyCardValue = hasExpenseData
    ? `${formatNumber(health.runway, 1)} mo`
    : health.emergencyTarget > 0
      ? `${formatNumber(Math.min(100, (health.totalLiquid / health.emergencyTarget) * 100), 0)}%`
      : formatINR(health.totalLiquid);

  // emergencySaved is the explicit field from Essentials (₹10,000)
  // totalLiquid = liquidInvestments + emergencySaved — use emergencySaved for display clarity
  const displaySaved =
    health.emergencySaved + calcLiquidInvestments(investments);
  const emergencyCardSub = hasExpenseData
    ? health.runway >= 6
      ? 'Well covered (6+ mo)'
      : health.runway >= 3
        ? 'Partial (3–6 mo goal)'
        : 'Target: 6 months'
    : health.emergencyTarget > 0
      ? `${formatINR(displaySaved)} saved of ${formatINR(health.emergencyTarget)} target`
      : health.totalLiquid > 0
        ? 'Set a target in Essentials'
        : 'Not set up yet';

  const emergencyColor = (() => {
    if (hasExpenseData) {
      return health.runway >= 6
        ? '#22c55e'
        : health.runway >= 3
          ? '#f59e0b'
          : '#ef4444';
    }
    if (health.emergencyTarget > 0) {
      const pct = health.totalLiquid / health.emergencyTarget;
      return pct >= 1 ? '#22c55e' : pct >= 0.5 ? '#f59e0b' : '#ef4444';
    }
    return '#ef4444';
  })();

  return (
    <div className='max-w-full mx-auto pb-4'>
      {/* Header */}
      <header className='flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm mb-6'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'>
            <FiZap className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white'>
              Financial Insights
            </h1>
            <p className='mt-1 text-sm font-medium text-slate-600 dark:text-slate-300'>
              {latestInsight
                ? `Last saved ${new Date(latestInsight.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'Analyse your portfolio health and track FIRE progress.'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || investments.length === 0}
          className='group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0'
          type='button'
        >
          <div className='absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0' />
          <FiSave className='relative h-4 w-4' />
          <span className='relative whitespace-nowrap'>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Snapshot'}
          </span>
        </button>
      </header>

      {noData ? (
        <div className='bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-12 text-center'>
          <div className='text-4xl mb-3'>📊</div>
          <div className='text-sm font-semibold text-slate-300 mb-1'>
            No data yet
          </div>
          <div className='text-xs text-slate-500 max-w-xs mx-auto'>
            Add investments, cashflow entries, or set your emergency fund in
            Settings → Essentials to see insights.
          </div>
        </div>
      ) : (
        <div className='flex flex-col gap-4'>
          {/* Health Score */}
          <div className='bg-slate-900 max-w-2xl mx-auto w-full border border-slate-800 rounded-2xl p-4'>
            <div className='flex gap-4 items-center flex-wrap'>
              <ScoreRing score={health.total} />
              <div className='flex-1 min-w-[160px]'>
                <div className='flex items-center gap-2 mb-3'>
                  <span className='text-sm font-bold text-slate-100'>
                    Health Score
                  </span>
                  <span
                    className='text-[11px] font-semibold px-2 py-0.5 rounded-full'
                    style={{
                      background: `${healthColor}22`,
                      color: healthColor,
                    }}
                  >
                    {healthLabel}
                  </span>
                </div>
                <MiniBar
                  label='Debt Management'
                  value={health.debtScore}
                  max={30}
                  color='#60a5fa'
                />
                <MiniBar
                  label='Emergency Fund'
                  value={health.emergencyScore}
                  max={20}
                  color='#a78bfa'
                />
                <MiniBar
                  label='Savings Rate'
                  value={health.savingsScore}
                  max={25}
                  color='#34d399'
                />
                <MiniBar
                  label='Diversification'
                  value={health.divScore}
                  max={25}
                  color='#f59e0b'
                />
              </div>
            </div>
            {/* Score hints row */}
            <div className='mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2'>
              {[
                {
                  label: 'Debt',
                  hint:
                    liabilities.length === 0
                      ? 'No liabilities ✓'
                      : `${formatNumber(health.debtRatio * 100, 0)}% of assets`,
                  color: '#60a5fa',
                },
                {
                  label: 'Emergency',
                  hint: hasExpenseData
                    ? `${formatNumber(health.runway, 1)} mo runway`
                    : health.emergencyTarget > 0
                      ? `${formatNumber(Math.min(100, (health.totalLiquid / health.emergencyTarget) * 100), 0)}% of target`
                      : 'Set target in Essentials',
                  color: '#a78bfa',
                },
                {
                  label: 'Savings',
                  hint:
                    metrics.avgIncome > 0
                      ? `${formatNumber(health.savingsRate, 0)}% rate`
                      : 'Add cashflow data',
                  color: '#34d399',
                },
                {
                  label: 'Assets',
                  hint: `${health.assetClassCount}/5 classes`,
                  color: '#f59e0b',
                },
              ].map(({ label, hint, color }) => (
                <div
                  key={label}
                  className='rounded-lg p-2 bg-slate-800/50 text-center'
                >
                  <div
                    className='text-[10px] font-bold uppercase tracking-wider mb-0.5'
                    style={{ color }}
                  >
                    {label}
                  </div>
                  <div className='text-[10px] text-slate-400'>{hint}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-2.5'>
            <MetricCard
              icon='💰'
              label='Net Worth'
              value={formatINR(metrics.netWorth)}
              color={metrics.netWorth >= 0 ? '#22c55e' : '#ef4444'}
            />
            <MetricCard
              icon='🏦'
              label='Total Assets'
              value={formatINR(metrics.totalValue)}
              color='#64748b'
            />
            <MetricCard
              icon='📉'
              label='Liabilities'
              value={formatINR(metrics.totalLiabilities)}
              color={
                metrics.totalLiabilities === 0
                  ? '#22c55e'
                  : health.debtRatio > 0.5
                    ? '#ef4444'
                    : '#f59e0b'
              }
            />
            <MetricCard
              icon='📊'
              label='Debt/Asset'
              value={
                metrics.totalValue === 0 && metrics.totalLiabilities === 0
                  ? '—'
                  : `${formatNumber(health.debtRatio * 100, 1)}%`
              }
              sub={
                metrics.totalValue === 0 && metrics.totalLiabilities === 0
                  ? 'No data'
                  : health.debtRatio < 0.3
                    ? 'Healthy'
                    : health.debtRatio < 0.6
                      ? 'Moderate'
                      : 'High'
              }
              color={
                health.debtRatio < 0.3
                  ? '#22c55e'
                  : health.debtRatio < 0.6
                    ? '#f59e0b'
                    : '#ef4444'
              }
            />

            <MetricCard
              icon='🛡️'
              label='Emergency'
              value={emergencyCardValue}
              sub={emergencyCardSub}
              color={emergencyColor}
            />
            <MetricCard
              icon='💹'
              label='Savings/mo'
              value={formatINR(metrics.monthlySavings)}
              sub={
                metrics.avgIncome > 0
                  ? `${formatNumber((metrics.monthlySavings / metrics.avgIncome) * 100, 0)}% of income`
                  : 'Add cashflow data'
              }
              color={
                metrics.monthlySavings > 0
                  ? '#22c55e'
                  : metrics.avgIncome === 0
                    ? '#64748b'
                    : '#ef4444'
              }
            />
            <MetricCard
              icon='📈'
              label='Equity'
              value={
                investments.length > 0
                  ? `${formatNumber(metrics.equityPct, 1)}%`
                  : '—'
              }
              sub={
                investments.length === 0
                  ? 'No investments yet'
                  : metrics.equityPct > 80
                    ? 'Over-weight'
                    : metrics.equityPct < 20
                      ? 'Under-weight'
                      : 'Balanced'
              }
              color={
                investments.length === 0
                  ? '#64748b'
                  : metrics.equityPct > 80 || metrics.equityPct < 20
                    ? '#f59e0b'
                    : '#22c55e'
              }
            />
            <MetricCard
              icon='🧾'
              label='Tax Loss'
              value={investments.length > 0 ? formatINR(metrics.taxLoss) : '—'}
              sub={
                investments.length === 0
                  ? 'No investments yet'
                  : metrics.taxLoss > 0
                    ? 'Harvest opportunity'
                    : 'No losses'
              }
              color={
                metrics.taxLoss > 0
                  ? '#f59e0b'
                  : investments.length === 0
                    ? '#64748b'
                    : '#22c55e'
              }
            />
          </div>

          {/* FIRE Projection */}
          <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
            <div className='flex items-center gap-2 mb-3'>
              <span className='text-sm font-bold text-slate-100'>
                🔥 FIRE Projection
              </span>
              <span className='text-[11px] text-slate-500'>
                Financial Independence, Retire Early
              </span>
            </div>
            {fire.uncalculable ? (
              <div className='rounded-xl bg-slate-800/60 p-4 text-center'>
                <p className='text-xs text-slate-400'>
                  Add cashflow entries or set an Emergency Fund Target in{' '}
                  <span className='text-emerald-400 font-semibold'>
                    Settings → Essentials
                  </span>{' '}
                  to calculate your FIRE projection.
                </p>
              </div>
            ) : (
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-2.5'>
                <FireCard
                  label='Target Corpus'
                  value={formatINR(fire.target)}
                  sub='25× annual expenses'
                  color='#f1f5f9'
                />
                <FireCard
                  label='Years to FIRE'
                  value={
                    fire.yearsToFIRE === 0
                      ? '🎉 Achieved!'
                      : fire.achievable
                        ? `${fire.yearsToFIRE} yrs`
                        : '50+ yrs'
                  }
                  sub={
                    fire.yearsToFIRE === 0
                      ? 'Net worth ≥ target'
                      : 'at 10% p.a. return'
                  }
                  color={
                    fire.yearsToFIRE === 0
                      ? '#22c55e'
                      : fire.achievable
                        ? '#22c55e'
                        : '#ef4444'
                  }
                />
                <FireCard
                  label='Monthly Savings'
                  value={formatINR(Math.max(0, metrics.monthlySavings))}
                  sub={
                    metrics.monthlySavings < 0
                      ? '⚠ Spending > income'
                      : 'contributed monthly'
                  }
                  color={metrics.monthlySavings >= 0 ? '#f1f5f9' : '#ef4444'}
                />
                <FireCard
                  label='Progress'
                  value={
                    fire.target > 0
                      ? `${formatNumber(Math.min(100, Math.max(0, (metrics.netWorth / fire.target) * 100)), 1)}%`
                      : '0%'
                  }
                  sub='of FIRE corpus'
                  color='#60a5fa'
                />
              </div>
            )}
          </div>

          {/* Priority Debt Alert */}
          {metrics.topDebt && (
            <div
              className='bg-slate-900 rounded-2xl p-4 flex gap-3 items-start'
              style={{
                border: '1px solid #ef444422',
                borderLeft: '3px solid #ef4444',
              }}
            >
              <span className='text-2xl'>⚠️</span>
              <div>
                <div className='text-sm font-semibold text-slate-100'>
                  Priority Debt: {metrics.topDebt.name}
                </div>
                <div className='text-[12px] text-slate-400 mt-1'>
                  {formatINR(metrics.topDebt.outstanding)} outstanding
                  {metrics.topDebt.interestRate
                    ? ` at ${metrics.topDebt.interestRate}% p.a.`
                    : ''}{' '}
                  — pay this down first to improve your health score.
                </div>
              </div>
            </div>
          )}

          {/* Rebalance Alert — only when investments actually exist */}
          {investments.length > 0 &&
            (metrics.equityPct > 80 || metrics.equityPct < 20) && (
              <div
                className='bg-slate-900 rounded-2xl p-4 flex gap-3 items-start'
                style={{
                  border: '1px solid #f59e0b22',
                  borderLeft: '3px solid #f59e0b',
                }}
              >
                <span className='text-2xl'>⚖️</span>
                <div>
                  <div className='text-sm font-semibold text-slate-100'>
                    Rebalancing Recommended
                  </div>
                  <div className='text-[12px] text-slate-400 mt-1'>
                    Equity is at {formatNumber(metrics.equityPct, 1)}% of total
                    assets.{' '}
                    {metrics.equityPct > 80
                      ? 'Consider adding debt instruments (bonds, FDs) to reduce risk.'
                      : 'Consider increasing equity (stocks, mutual funds) for better long-term growth.'}
                  </div>
                </div>
              </div>
            )}

          {/* Emergency Fund setup nudge */}
          {health.totalLiquid === 0 && health.emergencyTarget === 0 && (
            <div
              className='bg-slate-900 rounded-2xl p-4 flex gap-3 items-start'
              style={{
                border: '1px solid #a78bfa22',
                borderLeft: '3px solid #a78bfa',
              }}
            >
              <span className='text-2xl'>🛡️</span>
              <div>
                <div className='text-sm font-semibold text-slate-100'>
                  Set Up Your Emergency Fund
                </div>
                <div className='text-[12px] text-slate-400 mt-1'>
                  A 6-month emergency fund is the foundation of financial
                  health. Go to{' '}
                  <span className='text-violet-400 font-semibold'>
                    Settings → Essentials
                  </span>{' '}
                  to set your target and track progress here.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
