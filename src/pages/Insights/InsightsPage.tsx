// src/pages/Insights/InsightsPage.tsx

import type {
  CashflowEntry,
  EssentialsConfig,
  Investment,
  Liability,
} from '../../types/investmentTypes';
import { FiInfo, FiSave, FiZap } from 'react-icons/fi';
import { formatINR, formatNumber } from '../../utils/format';
import { useMemo, useState } from 'react';

import { InsightsLoader } from '../../components/ui/SectionLoader';
import { Modal } from '../../components/ui/Modal';
import { SubscriptionGuard } from '../../components/subscription/SubscriptionGuard';
import { computeAlpha, projectFutureValue } from '../../utils/advancedInsights';
import { LifestyleInflationCard }   from './components/LifestyleInflationCard';
import { SpendingVelocityCard }     from './components/SpendingVelocityCard';
import { MerchantIntelligenceCard } from './components/MerchantIntelligenceCard';
import { PassiveIncomeCard }        from './components/PassiveIncomeCard';
import { HabitsCard }               from './components/HabitsCard';
import {
  calculateNetWorth,
  summarizePortfolio,
} from '../../utils/calculations';
import { usePortfolioStore } from '../../store/portfolioStore';

// ─────────────────────────────────────────────────────────────────────────────
// EDUCATIONAL CONTENT DICTIONARY
// ─────────────────────────────────────────────────────────────────────────────
type MetricInfo = {
  title: string;
  what: React.ReactNode;
  how: React.ReactNode;
  proTip: React.ReactNode;
};

const METRIC_KNOWLEDGE_BASE: Record<string, MetricInfo> = {
  net_worth: {
    title: 'Net Worth',
    what: 'Net Worth is the ultimate measure of your financial health. It is calculated simply as: Total Assets (everything you own) minus Total Liabilities (everything you owe).',
    how: (
      <ul className='list-disc list-outside space-y-1 ml-4'>
        <li>Increase your income and savings rate.</li>
        <li>Aggressively pay down high-interest debt.</li>
        <li>
          Invest your savings in appreciating assets (equity, real estate)
          rather than depreciating ones (cars, gadgets).
        </li>
      </ul>
    ),
    proTip:
      'Focus on the long-term trend, not daily fluctuations. A negative net worth is common early in your career (e.g., due to education or home loans), but the goal is a consistent upward trajectory.',
  },
  total_assets: {
    title: 'Total Assets',
    what: 'This represents the total current market value of everything you own. It includes your stocks, mutual funds, fixed deposits, real estate, gold, and cash balances.',
    how: (
      <ul className='list-disc list-outside space-y-1 ml-4'>
        <li>Consistently invest a portion of your monthly income.</li>
        <li>Reinvest dividends and interest to benefit from compounding.</li>
        <li>
          Diversify across asset classes to protect your total value from market
          crashes.
        </li>
      </ul>
    ),
    proTip:
      'Not all assets are equal. "Income-generating assets" (like dividend stocks or rental properties) and "Appreciating assets" (like equity MFs) build wealth faster than "Dead assets" (like idle cash in a savings account).',
  },
  liabilities: {
    title: 'Liabilities',
    what: 'Liabilities represent all your outstanding financial obligations and debts, including home loans, car loans, personal loans, and credit card balances.',
    how: (
      <ul className='list-disc list-outside space-y-1 ml-4'>
        <li>Always pay your credit card bills in full every month.</li>
        <li>
          Use the "Avalanche Method": Pay off debts with the highest interest
          rates first.
        </li>
        <li>Avoid taking loans for depreciating assets.</li>
      </ul>
    ),
    proTip:
      'Understand Good Debt vs. Bad Debt. A home loan (Good Debt) builds an asset and offers tax benefits under Section 24(b) and 80C. Credit card debt at 36%+ p.a. (Bad Debt) destroys wealth rapidly.',
  },
  debt_asset_ratio: {
    title: 'Debt-to-Asset Ratio',
    what: 'This ratio shows what percentage of your assets are financed by debt. Formula: (Total Liabilities ÷ Total Assets) × 100.',
    how: (
      <ul className='list-disc list-outside space-y-1 ml-4'>
        <li>
          <strong>Below 30%:</strong> Very healthy. You are in a highly solvent
          position.
        </li>
        <li>
          <strong>30% - 60%:</strong> Moderate. Usually acceptable if you have a
          home loan.
        </li>
        <li>
          <strong>Above 60%:</strong> High risk. Focus heavily on debt reduction
          before making new investments.
        </li>
      </ul>
    ),
    proTip:
      'If your ratio is high and interest rates are rising, prioritize prepaying floating-rate loans to reduce your financial burden.',
  },
  emergency_fund: {
    title: 'Emergency Fund',
    what: 'A liquid cash buffer set aside specifically for unplanned expenses or financial emergencies (like medical emergencies, sudden car repairs, or job loss).',
    how: (
      <ul className='list-disc list-outside space-y-1 ml-4'>
        <li>Aim for 3 to 6 months of living expenses.</li>
        <li>
          If you have dependents or variable income (freelancer/business), aim
          for 9 to 12 months.
        </li>
        <li>Keep this money strictly accessible within 24-48 hours.</li>
      </ul>
    ),
    proTip:
      'Do not chase high returns with this money! Park your emergency fund in a mix of Sweep-in FDs and Liquid Mutual Funds. The goal here is capital protection and liquidity, not growth.',
  },
  monthly_savings: {
    title: 'Monthly Savings',
    what: 'The difference between your monthly income and monthly expenses. This is the primary fuel for your wealth-building engine.',
    how: (
      <ul className='list-disc list-outside space-y-1 ml-4'>
        <li>
          Follow the <strong>50/30/20 Rule</strong>: 50% Needs, 30% Wants, 20%
          Savings (minimum).
        </li>
        <li>
          Track your expenses to identify and cut unnecessary subscriptions or
          impulse purchases.
        </li>
        <li>
          Automate your savings: Set up SIPs that deduct money on the 1st of
          every month (Pay Yourself First).
        </li>
      </ul>
    ),
    proTip:
      'If your savings rate is below 20%, focus on increasing income through upskilling or side hustles, while aggressively trimming "Wants".',
  },
  equity_pct: {
    title: 'Equity Allocation (%)',
    what: 'The percentage of your total portfolio invested in the stock market (direct stocks and equity mutual funds). Equity is the primary driver of long-term, inflation-beating growth.',
    how: (
      <ul className='list-disc list-outside space-y-1 ml-4'>
        <li>
          A common rule of thumb is "100 minus your age" (e.g., if you are 30,
          keep 70% in equity).
        </li>
        <li>
          If equity is &lt;20%: Your portfolio might not beat inflation.
          Consider increasing your SIPs in Index Funds.
        </li>
        <li>
          If equity is &gt;80%: Your portfolio is highly volatile. Ensure you
          have a solid emergency fund to ride out market crashes.
        </li>
      </ul>
    ),
    proTip:
      'Rebalance your portfolio once a year. If a bull market pushes your equity to 90%, sell some and buy debt (like FDs or Bonds) to lock in profits and restore your target allocation.',
  },
  tax_loss: {
    title: 'Tax Loss Harvesting',
    what: 'A strategy where you intentionally sell investments that are down in value to "realize" a loss. You can then use this loss to offset capital gains from your winning stocks, reducing your tax bill.',
    how: (
      <ol className='list-decimal list-inside space-y-1 ml-1'>
        <li>Identify stocks/MFs trading below your purchase price.</li>
        <li>Sell them to realize the capital loss.</li>
        <li>
          Apply these losses against Capital Gains (STCG/LTCG) realized in the
          same financial year.
        </li>
        <li>
          (Optional) Reinvest in similar assets a few days later to maintain
          your allocation.
        </li>
      </ol>
    ),
    proTip:
      'In India, Short-Term Capital Losses (STCL) can offset both STCG and LTCG. Long-Term Capital Losses (LTCL) can only offset LTCG. Unabsorbed losses can be carried forward for 8 years if you file your ITR on time.',
  },
};

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

  const hasAnyFinancialData = totalValue > 0 || totalLiabilities > 0;
  const debtRatio = !hasAnyFinancialData
    ? 0
    : totalValue > 0
      ? Math.min(1, totalLiabilities / totalValue)
      : 1;
  const debtScore = !hasAnyFinancialData ? 0 : Math.max(0, 30 - debtRatio * 60);

  const liquidInvestments = calcLiquidInvestments(investments);
  const emergencySaved = essentials.emergencyFundCurrent ?? 0;
  const emergencyTarget = essentials.emergencyFundTarget ?? 0;
  const totalLiquid = liquidInvestments + emergencySaved;
  const avgExpense = calcMonthlyAvg(cashflows, 'expense');

  let runway = 0;
  let emergencyScore = 0;

  if (avgExpense > 0) {
    runway = totalLiquid / avgExpense;
    emergencyScore = Math.min(20, (runway / 6) * 20);
  } else if (emergencyTarget > 0) {
    const pct = Math.min(1, totalLiquid / emergencyTarget);
    emergencyScore = pct * 20;
    runway = pct * 6;
  } else if (totalLiquid > 0) {
    emergencyScore = 5;
  }

  const avgIncome = calcMonthlyAvg(cashflows, 'income');
  const savingsRate =
    avgIncome > 0 && avgExpense > 0
      ? ((avgIncome - avgExpense) / avgIncome) * 100
      : 0;
  const savingsScore = Math.min(25, Math.max(0, (savingsRate / 30) * 25));

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
  let annualExpense: number;
  if (monthlyExpense > 0) {
    annualExpense = monthlyExpense * 12;
  } else if (emergencyTarget > 0) {
    annualExpense = emergencyTarget * 2;
  } else {
    return {
      target: 0,
      yearsToFIRE: null,
      achievable: false,
      uncalculable: true,
    };
  }

  const target = annualExpense * 25;
  const monthlyRate = expectedReturnPct / 12 / 100;

  if (netWorth >= target) {
    return { target, yearsToFIRE: 0, achievable: true, uncalculable: false };
  }

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
        <span className='text-[10px] text-slate-900 dark:text-slate-500'>
          /100
        </span>
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
      <div className='flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1'>
        <span>{label}</span>
        <span style={{ color, fontFamily: 'monospace' }}>
          {value}/{max}
        </span>
      </div>
      <div className='h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden'>
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
  onInfoClick,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
  onInfoClick?: () => void;
}) {
  return (
    <div
      className='rounded-xl p-3.5 flex flex-col gap-1 relative bg-white dark:bg-slate-900 shadow-sm'
      style={{
        border: `1px solid ${color}22`,
        borderTop: `2px solid ${color}`,
      }}
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-1.5'>
          <span className='text-base'>{icon}</span>
          <span className='text-[10px] text-slate-900 dark:text-slate-500 uppercase tracking-wider font-semibold'>
            {label}
          </span>
        </div>
        {/* Info Icon Button */}
        {onInfoClick && (
          <button
            onClick={onInfoClick}
            className='text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1 -mr-1 -mt-1 rounded-full hover:bg-slate-200/80 dark:hover:bg-slate-800/80 cursor-pointer'
            title='More information'
          >
            <FiInfo className='h-3.5 w-3.5' />
          </button>
        )}
      </div>
      <div
        className='text-base font-bold text-slate-900 dark:text-slate-100'
        style={{ fontFamily: 'monospace' }}
      >
        {value}
      </div>
      {sub && (
        <div className='text-[11px] text-slate-900 dark:text-slate-500'>
          {sub}
        </div>
      )}
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
    <div className='rounded-xl p-3.5 bg-slate-50 dark:bg-slate-950'>
      <div className='text-[10px] text-slate-900 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1.5'>
        {label}
      </div>
      <div
        className='text-base font-bold'
        style={{ color, fontFamily: 'monospace' }}
      >
        {value}
      </div>
      <div className='text-[11px] text-slate-900 dark:text-slate-500 mt-0.5'>
        {sub}
      </div>
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

  // Single state to manage which metric's info modal is open
  const [infoModalKey, setInfoModalKey] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(
      investments,
      liabilities,
    );
    const totalValue = totalAssets;
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
    const portfolioReturnPct =
      totalValue > 0
        ? ((totalValue - (latestInsight?.totalTaxLossPotential || totalValue * 0.85)) / totalValue) * 100
        : 0;
    const alpha = computeAlpha(portfolioReturnPct, 12);
    const fv10 = projectFutureValue(totalValue, 12, 10);
    const sectorMap = investments
      .filter((i) => i.type === 'stock')
      .reduce(
        (acc, i) => {
          const key = (i.sector || 'Unknown').toUpperCase();
          acc[key] = (acc[key] || 0) + i.currentPrice * i.quantity;
          return acc;
        },
        {} as Record<string, number>,
      );
    const topSector = Object.entries(sectorMap).sort((a, b) => b[1] - a[1])[0];
    const topSectorPct = totalValue > 0 && topSector ? (topSector[1] / totalValue) * 100 : 0;

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
      alpha,
      fv10,
      topSector: topSector?.[0] || '—',
      topSectorPct,
    };
  }, [investments, liabilities, cashflows, essentials, latestInsight]);

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

  if (!ready) return <InsightsLoader />;

  const noData =
    investments.length === 0 &&
    cashflows.length === 0 &&
    liabilities.length === 0 &&
    (essentials.emergencyFundCurrent ?? 0) === 0 &&
    (essentials.emergencyFundTarget ?? 0) === 0;

  const hasExpenseData = metrics.avgExpense > 0;

  const emergencyCardValue = hasExpenseData
    ? `${formatNumber(health.runway, 1)} mo`
    : health.emergencyTarget > 0
      ? `${formatNumber(Math.min(100, (health.totalLiquid / health.emergencyTarget) * 100), 0)}%`
      : formatINR(health.totalLiquid);

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
    if (hasExpenseData)
      return health.runway >= 6
        ? '#22c55e'
        : health.runway >= 3
          ? '#f59e0b'
          : '#ef4444';
    if (health.emergencyTarget > 0) {
      const pct = health.totalLiquid / health.emergencyTarget;
      return pct >= 1 ? '#22c55e' : pct >= 0.5 ? '#f59e0b' : '#ef4444';
    }
    return '#ef4444';
  })();

  const activeModalData = infoModalKey
    ? METRIC_KNOWLEDGE_BASE[infoModalKey]
    : null;

  return (
    <SubscriptionGuard feature='portfolio_analytics'>
    <div className='flex flex-col gap-6 pb-10 max-w-5xl mx-auto'>
      {/* Header */}
      <header className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent p-5 border border-amber-500/20 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30'>
            <FiZap className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>
              Financial Insights
            </h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              {latestInsight
                ? `Last snapshot saved ${new Date(latestInsight.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'Track your financial health, emergency fund, and FIRE progress.'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || investments.length === 0}
          className='flex items-center gap-2 cursor-pointer rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-40 hover:-translate-y-0.5 transition-all'
          type='button'
        >
          <FiSave className='h-4 w-4' />
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Snapshot'}
        </button>
      </header>

      {noData ? (
        <div className='rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/40 p-14 text-center'>
          <div className='text-5xl mb-4'>📊</div>
          <p className='text-base font-semibold text-slate-600 dark:text-slate-700 dark:text-slate-300 mb-1'>
            No data yet
          </p>
          <p className='text-sm text-slate-900 dark:text-slate-500 max-w-xs mx-auto'>
            Add investments, cashflow entries, or set your emergency fund in{' '}
            <span className='text-emerald-400 font-semibold'>
              Settings → Essentials
            </span>{' '}
            to see your insights.
          </p>
        </div>
      ) : (
        <div className='flex flex-col gap-6'>
          {/* ── Health Score + Breakdown ── */}
          <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 p-5'>
            <h2 className='text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4'>
              Financial Health Score
            </h2>
            <div className='flex flex-col sm:flex-row gap-6 items-start'>
              <div className='flex flex-col items-center gap-2 shrink-0'>
                <ScoreRing score={health.total} />
                <span
                  className='text-sm font-bold px-3 py-1 rounded-full'
                  style={{ background: `${healthColor}22`, color: healthColor }}
                >
                  {healthLabel}
                </span>
              </div>
              <div className='flex-1 w-full flex flex-col gap-0.5'>
                <MiniBar
                  label='Debt Management (30 pts)'
                  value={health.debtScore}
                  max={30}
                  color='#60a5fa'
                />
                <MiniBar
                  label='Emergency Fund (20 pts)'
                  value={health.emergencyScore}
                  max={20}
                  color='#a78bfa'
                />
                <MiniBar
                  label='Savings Rate (25 pts)'
                  value={health.savingsScore}
                  max={25}
                  color='#34d399'
                />
                <MiniBar
                  label='Diversification (25 pts)'
                  value={health.divScore}
                  max={25}
                  color='#f59e0b'
                />
              </div>
              <div className='grid grid-cols-2 sm:grid-cols-1 gap-2 shrink-0 w-full sm:w-36'>
                {[
                  {
                    label: '🏦 Debt',
                    hint:
                      liabilities.length === 0
                        ? 'No liabilities ✓'
                        : `${formatNumber(health.debtRatio * 100, 0)}% of assets`,
                    color: '#60a5fa',
                  },
                  {
                    label: '🛡 Emergency',
                    hint: hasExpenseData
                      ? `${formatNumber(health.runway, 1)} mo runway`
                      : health.emergencyTarget > 0
                        ? `${formatNumber(Math.min(100, (health.totalLiquid / health.emergencyTarget) * 100), 0)}% of target`
                        : 'Set in Essentials',
                    color: '#a78bfa',
                  },
                  {
                    label: '💸 Savings',
                    hint:
                      metrics.avgIncome > 0
                        ? `${formatNumber(health.savingsRate, 0)}% rate`
                        : 'Add cashflow',
                    color: '#34d399',
                  },
                  {
                    label: '📦 Assets',
                    hint: `${health.assetClassCount}/5 classes`,
                    color: '#f59e0b',
                  },
                ].map(({ label, hint, color }) => (
                  <div
                    key={label}
                    className='rounded-lg p-2.5 bg-slate-200/70 dark:bg-slate-800/60 flex flex-col gap-0.5'
                  >
                    <p className='text-[10px] font-bold' style={{ color }}>
                      {label}
                    </p>
                    <p className='text-[10px] text-slate-500 dark:text-slate-400 leading-tight'>
                      {hint}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Key Metrics ── */}
          <div>
            <h2 className='text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3'>
              Key Metrics
            </h2>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
              <MetricCard
                icon='💰'
                label='Net Worth'
                value={formatINR(metrics.netWorth)}
                color={metrics.netWorth >= 0 ? '#22c55e' : '#ef4444'}
                onInfoClick={() => setInfoModalKey('net_worth')}
              />
              <MetricCard
                icon='🏦'
                label='Total Assets'
                value={formatINR(metrics.totalValue)}
                color='#64748b'
                onInfoClick={() => setInfoModalKey('total_assets')}
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
                onInfoClick={() => setInfoModalKey('liabilities')}
              />
              <MetricCard
                icon='📊'
                label='Debt / Asset'
                value={
                  metrics.totalValue === 0 && metrics.totalLiabilities === 0
                    ? '—'
                    : `${formatNumber(health.debtRatio * 100, 1)}%`
                }
                sub={
                  health.debtRatio < 0.3
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
                onInfoClick={() => setInfoModalKey('debt_asset_ratio')}
              />
              <MetricCard
                icon='🛡'
                label='Emergency Fund'
                value={emergencyCardValue}
                sub={emergencyCardSub}
                color={emergencyColor}
                onInfoClick={() => setInfoModalKey('emergency_fund')}
              />
              <MetricCard
                icon='📈'
                label='Monthly Savings'
                value={formatINR(Math.abs(metrics.monthlySavings))}
                sub={
                  metrics.monthlySavings < 0
                    ? '⚠ Spending > income'
                    : metrics.avgIncome > 0
                      ? `${formatNumber(health.savingsRate, 0)}% of income`
                      : 'Add cashflow data'
                }
                color={metrics.monthlySavings >= 0 ? '#22c55e' : '#ef4444'}
                onInfoClick={() => setInfoModalKey('monthly_savings')}
              />
              <MetricCard
                icon='📈'
                label='Equity %'
                value={
                  investments.length > 0
                    ? `${formatNumber(metrics.equityPct, 1)}%`
                    : '—'
                }
                sub={
                  metrics.equityPct > 80
                    ? 'Over-weight equity'
                    : metrics.equityPct < 20
                      ? 'Under-weight equity'
                      : 'Balanced'
                }
                color={
                  investments.length === 0
                    ? '#64748b'
                    : metrics.equityPct > 80 || metrics.equityPct < 20
                      ? '#f59e0b'
                      : '#22c55e'
                }
                onInfoClick={() => setInfoModalKey('equity_pct')}
              />
              <MetricCard
                icon='🧾'
                label='Tax Loss Harvest'
                value={
                  investments.length > 0 ? formatINR(metrics.taxLoss) : '—'
                }
                sub={
                  metrics.taxLoss > 0
                    ? 'Harvest opportunity'
                    : 'No losses to harvest'
                }
                color={
                  metrics.taxLoss > 0
                    ? '#f59e0b'
                    : investments.length === 0
                      ? '#64748b'
                      : '#22c55e'
                }
                onInfoClick={() => setInfoModalKey('tax_loss')}
              />
              <MetricCard
                icon='⚖️'
                label='Alpha'
                value={`${formatNumber(metrics.alpha, 2)}%`}
                sub='vs 12% benchmark'
                color={metrics.alpha >= 0 ? '#22c55e' : '#ef4444'}
              />
              <MetricCard
                icon='⏳'
                label='Future Value 10Y'
                value={formatINR(metrics.fv10.nominal)}
                sub={`Real ${formatINR(metrics.fv10.real)}`}
                color='#60a5fa'
              />
              <MetricCard
                icon='🧩'
                label='Top Sector Risk'
                value={metrics.topSector}
                sub={metrics.topSector === '—' ? 'No stock sector data' : `${formatNumber(metrics.topSectorPct, 1)}% of portfolio`}
                color={metrics.topSectorPct > 35 ? '#ef4444' : '#f59e0b'}
              />
            </div>
          </div>

          {/* ── FIRE Projection ── */}
          <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 p-5'>
            <div className='flex items-center gap-2 mb-4'>
              <span className='text-xl'>🔥</span>
              <h2 className='text-base font-bold text-slate-900 dark:text-slate-100'>
                FIRE Projection
              </h2>
              <span className='text-xs text-slate-900 dark:text-slate-500 hidden sm:block'>
                Financial Independence, Retire Early
              </span>
            </div>
            {fire.uncalculable ? (
              <div className='rounded-xl bg-slate-200/70 dark:bg-slate-800/60 p-4 text-center'>
                <p className='text-sm text-slate-500 dark:text-slate-400'>
                  Add cashflow entries or set an Emergency Fund Target in{' '}
                  <span className='text-emerald-400 font-semibold'>
                    Settings → Essentials
                  </span>{' '}
                  to calculate your FIRE projection.
                </p>
              </div>
            ) : (
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
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
                      ? '🎉 Done!'
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

          {/* ── Tier 2 Intelligence Cards ── */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
            <SpendingVelocityCard />
            <HabitsCard />
          </div>
          <LifestyleInflationCard />
          <MerchantIntelligenceCard />
          <PassiveIncomeCard />

          {/* ── Action Items / Alerts ── */}
          {(metrics.topDebt ||
            (investments.length > 0 &&
              (metrics.equityPct > 80 || metrics.equityPct < 20)) ||
            (health.totalLiquid === 0 && health.emergencyTarget === 0)) && (
            <div>
              <h2 className='text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3'>
                Action Items
              </h2>
              <div className='flex flex-col gap-3'>
                {metrics.topDebt && (
                  <div
                    className='flex gap-3 items-start rounded-2xl p-4 bg-slate-100 dark:bg-slate-900/60'
                    style={{
                      border: '1px solid #ef444422',
                      borderLeft: '3px solid #ef4444',
                    }}
                  >
                    <span className='text-xl shrink-0'>⚠️</span>
                    <div>
                      <p className='text-sm font-semibold text-slate-900 dark:text-slate-100'>
                        Priority Debt: {metrics.topDebt.name}
                      </p>
                      <p className='text-xs text-slate-500 dark:text-slate-400 mt-1'>
                        {formatINR(metrics.topDebt.outstanding)} outstanding{' '}
                        {metrics.topDebt.interestRate
                          ? ` at ${metrics.topDebt.interestRate}% p.a.`
                          : ''}{' '}
                        — pay this down first to improve your score.
                      </p>
                    </div>
                  </div>
                )}
                {investments.length > 0 &&
                  (metrics.equityPct > 80 || metrics.equityPct < 20) && (
                    <div
                      className='flex gap-3 items-start rounded-2xl p-4 bg-slate-100 dark:bg-slate-900/60'
                      style={{
                        border: '1px solid #f59e0b22',
                        borderLeft: '3px solid #f59e0b',
                      }}
                    >
                      <span className='text-xl shrink-0'>⚖️</span>
                      <div>
                        <p className='text-sm font-semibold text-slate-900 dark:text-slate-100'>
                          Rebalancing Recommended
                        </p>
                        <p className='text-xs text-slate-500 dark:text-slate-400 mt-1'>
                          Equity is at {formatNumber(metrics.equityPct, 1)}% of
                          total assets.{' '}
                          {metrics.equityPct > 80
                            ? 'Consider adding bonds or FDs to reduce risk.'
                            : 'Consider adding stocks or mutual funds for better growth.'}
                        </p>
                      </div>
                    </div>
                  )}
                {health.totalLiquid === 0 && health.emergencyTarget === 0 && (
                  <div
                    className='flex gap-3 items-start rounded-2xl p-4 bg-slate-100 dark:bg-slate-900/60'
                    style={{
                      border: '1px solid #a78bfa22',
                      borderLeft: '3px solid #a78bfa',
                    }}
                  >
                    <span className='text-xl shrink-0'>🛡️</span>
                    <div>
                      <p className='text-sm font-semibold text-slate-900 dark:text-slate-100'>
                        Set Up Your Emergency Fund
                      </p>
                      <p className='text-xs text-slate-500 dark:text-slate-400 mt-1'>
                        A 6-month emergency fund is the foundation of financial
                        health. Go to{' '}
                        <span className='text-violet-400 font-semibold'>
                          Settings → Essentials
                        </span>{' '}
                        to set your target.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Dynamic Educational Information Modal ── */}
      <Modal
        open={!!infoModalKey}
        onClose={() => setInfoModalKey(null)}
        title={activeModalData ? `💡 ${activeModalData.title} Explained` : ''}
      >
        {activeModalData && (
          <div className='space-y-5 text-sm text-slate-600 dark:text-slate-700 dark:text-slate-300'>
            <p>
              <strong>What it is:</strong> {activeModalData.what}
            </p>

            <div>
              <h4 className='font-bold text-slate-900 dark:text-slate-100 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1'>
                How to improve it:
              </h4>
              {activeModalData.how}
            </div>

            <div className='bg-amber-950/30 p-4 rounded-xl border border-amber-900/50'>
              <h4 className='font-bold text-amber-500 mb-2 flex items-center gap-2'>
                <FiZap className='w-4 h-4' /> Pro Tip
              </h4>
              <p className='text-xs text-amber-200/80 leading-relaxed'>
                {activeModalData.proTip}
              </p>
            </div>

            <div className='pt-2 flex justify-end'>
              <button
                onClick={() => setInfoModalKey(null)}
                className='cursor-pointer rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
    </SubscriptionGuard>
  );
}
