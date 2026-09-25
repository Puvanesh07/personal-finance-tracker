// src/components/dashboard/SummaryCards.tsx
//
// Hero KPI row. Reuses calculateNetWorth (single source of truth) — no
// duplicated math. Rebuilt with a softer, clearer look: each metric carries an
// icon so it is instantly understandable, and the palette is gentler.

import type { ReactNode } from 'react';
import { FiArrowUpRight, FiDollarSign, FiPieChart, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import { formatINR } from '../../utils/format';
import { calculateNetWorth } from '../../utils/calculations';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

function MetricCard({
  label,
  value,
  icon,
  variant = 'default',
  trend,
  badge,
  navigateTo,
  sub,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  variant?: 'default' | 'primary' | 'danger';
  trend?: 'up' | 'down' | 'neutral';
  badge?: string;
  navigateTo?: string;
  sub?: string;
}) {
  const navigate = useNavigate();

  let shell =
    'border-slate-200/70 bg-white/80 dark:border-slate-800/70 dark:bg-slate-900/40';
  let textClass = 'text-slate-900 dark:text-slate-50';
  let labelClass = 'text-slate-500 dark:text-slate-400';
  let chipClass = 'bg-slate-500/10 text-slate-500 dark:text-slate-400';
  let subClass = 'text-slate-400 dark:text-slate-500';

  if (variant === 'primary') {
    shell = 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/95 to-teal-600/95 shadow-emerald-500/20';
    textClass = 'text-white';
    labelClass = 'text-emerald-50';
    chipClass = 'bg-white/20 text-white';
    subClass = 'text-emerald-50/90';
  } else if (variant === 'danger') {
    shell = 'border-rose-500/30 bg-gradient-to-br from-rose-500/95 to-rose-600/95 shadow-rose-500/20';
    textClass = 'text-white';
    labelClass = 'text-rose-50';
    chipClass = 'bg-white/20 text-white';
    subClass = 'text-rose-50/90';
  }

  let valueColor = textClass;
  if (variant === 'default' && trend === 'up') valueColor = 'text-emerald-600 dark:text-emerald-400';
  if (variant === 'default' && trend === 'down') valueColor = 'text-rose-600 dark:text-rose-400';

  return (
    <div
      onClick={() => navigateTo && navigate(navigateTo)}
      className={`group relative cursor-pointer overflow-hidden rounded-3xl border p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${shell}`}
    >
      <div className='flex items-start justify-between gap-3'>
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${chipClass}`}>
          {icon}
        </span>
        <FiArrowUpRight
          className={`h-4 w-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${
            variant === 'default' ? 'text-slate-400' : 'text-white/70'
          }`}
        />
      </div>

      <div className={`mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${labelClass}`}>
        {label}
        {badge && (
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
              variant === 'default'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-white/20 text-white'
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className={`mt-1 text-2xl font-black tabular-nums tracking-tight ${valueColor}`}>
        {value}
      </div>
      {sub && <div className={`mt-1 text-[11px] font-medium ${subClass}`}>{sub}</div>}
    </div>
  );
}

export function SummaryCards() {
  const investments = usePortfolioStore((s) => s.investments);
  const liabilities = usePortfolioStore((s) => s.liabilities);
  const pendingPayments = usePortfolioStore((s) => s.pendingPayments);
  const accounts = usePortfolioStore((s) => s.accounts);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const essentials = usePortfolioStore((s) => s.essentials);

  // Net Worth = Total Assets − Total Liabilities + Cashflow Savings
  // (assets include live bank-account balances; savings = off-account cashflow net)
  const { totalAssets, totalLiabilities, netWorth } = useMemo(
    () => calculateNetWorth(investments, liabilities, pendingPayments, accounts, cashflows),
    [investments, liabilities, pendingPayments, accounts, cashflows],
  );

  // ── Monthly Cash Flow (stock vs flow): Net Worth stays a point-in-time
  //    snapshot; cash flow is shown alongside + as next-month projection. ──
  const cashflow = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    const thisMonth = cashflows.filter((c) => (c.date ?? '').startsWith(ym));
    let income = thisMonth.filter((c) => c.type === 'income').reduce((s, c) => s + c.amount, 0);
    let expense = thisMonth.filter((c) => c.type === 'expense').reduce((s, c) => s + c.amount, 0);
    // No activity logged this month → fall back to the Financial Profile
    if (income === 0 && expense === 0) {
      income = essentials?.monthlyIncome ?? 0;
      expense = essentials?.monthlyExpense ?? 0;
      return { income, expense, net: income - expense, fromProfile: income > 0 || expense > 0 };
    }
    return { income, expense, net: income - expense, fromProfile: false };
  }, [cashflows, essentials]);

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      <MetricCard
        label='Total Assets'
        value={formatINR(totalAssets)}
        icon={<FiPieChart className='h-5 w-5' />}
        navigateTo='/wealth?tab=assets'
        sub='Investments + balances + receivables'
      />
      <MetricCard
        label='Total Liabilities'
        value={formatINR(totalLiabilities)}
        icon={<FiTrendingDown className='h-5 w-5' />}
        variant={totalLiabilities > 0 ? 'danger' : 'default'}
        navigateTo='/wealth?tab=liabilities'
        sub='Loans & outstanding debt'
      />
      <MetricCard
        label='Net Worth'
        value={formatINR(netWorth)}
        icon={<FiDollarSign className='h-5 w-5' />}
        variant='primary'
        navigateTo='/wealth?tab=networth'
        badge='incl. savings'
        sub={`Projected next month ${formatINR(netWorth + cashflow.net)}`}
      />
      <MetricCard
        label='Monthly Cash Flow'
        value={`${cashflow.net >= 0 ? '+' : '−'}${formatINR(Math.abs(cashflow.net))}`}
        icon={<FiTrendingUp className='h-5 w-5' />}
        trend={cashflow.net > 0 ? 'up' : cashflow.net < 0 ? 'down' : 'neutral'}
        navigateTo='/cashflow'
        badge={cashflow.fromProfile ? 'from profile' : 'this month'}
        sub={`${formatINR(cashflow.income)} in · ${formatINR(cashflow.expense)} out`}
      />
    </div>
  );
}
