// src/pages/Reports/ReportsPage.tsx

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  FiActivity,
  FiArrowUpRight,
  FiBarChart2,
  FiCreditCard,
  FiDownload,
  FiFlag,
  FiPieChart,
  FiShield,
  FiTrendingDown,
  FiTrendingUp,
} from 'react-icons/fi';
import React, { useMemo, useState } from 'react';

import { exportAllSectionsAsCSV } from '../../utils/exportUtils';
import {
  buildReportHealthInsights,
  computeAlpha,
  projectFutureValue,
} from '../../utils/advancedInsights';
import { formatINR } from '../../utils/format';
import {
  calculateNetWorth,
  summarizePortfolio,
} from '../../utils/calculations';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';
import { FeatureInfo } from '../../components/ui/FeatureInfo';
import { useThemeStore } from '../../store/themeStore';
import { SubscriptionGuard } from '../../components/subscription/SubscriptionGuard';

import {
  calculateTotalIncome,
  calculateTotalExpenses,
} from '../../services/financialMetricsEngine';

// ─── Reusable UI Components ──────────────────────────────────────────────────

function StatRow({
  label,
  value,
  accent = false,
  positive,
}: {
  label: string;
  value: string;
  accent?: boolean;
  positive?: boolean;
}) {
  let cls = 'text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100';
  if (positive === true)
    cls = 'text-sm font-bold tabular-nums text-emerald-400';
  if (positive === false) cls = 'text-sm font-bold tabular-nums text-rose-400';
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-4 py-3 ${accent ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-100/90 dark:bg-slate-800/40 hover:bg-slate-200 dark:bg-slate-800/70'} transition-colors`}
    >
      <span className='text-sm text-slate-500 dark:text-slate-400'>{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  color,
  to,
  fullWidth = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  to?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 p-5 flex flex-col gap-4 ${fullWidth ? 'md:col-span-2' : ''}`}
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2.5'>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}
          >
            {icon}
          </div>
          <h2 className='text-base font-bold text-slate-900 dark:text-slate-100'>{title}</h2>
        </div>
        {to && (
          <button
            onClick={() => navigate(to)}
            className='flex items-center cursor-pointer gap-1 text-xs font-bold text-slate-900 dark:text-slate-500 hover:text-emerald-400 transition-colors rounded-lg px-2 py-1 hover:bg-slate-200 dark:bg-slate-800'
          >
            View <FiArrowUpRight className='h-3.5 w-3.5' />
          </button>
        )}
      </div>
      <div
        className={`flex flex-col gap-2 ${fullWidth ? 'md:flex-row md:gap-6' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Main Reports Page ───────────────────────────────────────────────────────

export function ReportsPage() {
  const portStore = usePortfolioStore();
  const themeMode = useThemeStore((s) => s.mode);

  const [timeframe, setTimeframe] = useState<'all' | 'ytd' | 'month'>('all');

  const chartTooltipStyle = useMemo(
    () =>
      themeMode === 'dark'
        ? {
            background: '#0f172a',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            color: '#f1f5f9',
          }
        : {
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            fontSize: 12,
            color: '#0f172a',
          },
    [themeMode],
  );

  // ── Timeframe Filter Logic
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const currentYearStart = new Date(now.getFullYear(), 0, 1)
    .toISOString()
    .split('T')[0];

  const isWithinTimeframe = (dateStr: string) => {
    if (!dateStr) return false;
    if (timeframe === 'all') return true;
    if (timeframe === 'month') return dateStr >= currentMonthStart;
    if (timeframe === 'ytd') return dateStr >= currentYearStart;
    return false;
  };

  // ── 1. Investments & Liabilities
  const summary = useMemo(
    () => summarizePortfolio(portStore.investments),
    [portStore.investments],
  );
  const realizedProfit = portStore.soldTrades.reduce((a, t) => a + t.profit, 0);
  const {
    totalAssets: netWorthAssets,
    totalLiabilities: liabilitiesTotal,
    netWorth,
  } = calculateNetWorth(portStore.investments, portStore.liabilities);
  const totalAccountBalance = portStore.accounts.reduce(
    (a, acc) => a + (acc.balance || 0),
    0,
  );

  // ── 2. Cashflow (Time Filtered)
  const filteredCashflows = useMemo(
    () => portStore.cashflows.filter((c) => isWithinTimeframe(c.date)),
    [portStore.cashflows, timeframe],
  );
  const tfIncome = calculateTotalIncome(filteredCashflows);
  const tfExpense = calculateTotalExpenses(filteredCashflows);

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCashflows
      .filter((c) => c.type === 'income')
      .forEach((c) => (map[c.category] = (map[c.category] || 0) + c.amount));
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredCashflows]);

  const totalAssets = netWorthAssets;

  // ── Insurance & Goals (Static Snapshots)
  const totalInsuranceCoverage = portStore.insurancePolicies.reduce(
    (a, p) => a + p.coverageAmount,
    0,
  );
  const yearlyPremium = portStore.insurancePolicies.reduce(
    (a, p) =>
      a +
      (p.premiumFrequency === 'monthly'
        ? p.premiumAmount * 12
        : p.premiumAmount),
    0,
  );
  const completedGoals = portStore.goals.filter(
    (g) => g.currentAmount >= g.targetAmount,
  ).length;

  const COLORS = [
    '#10b981',
    '#3b82f6',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
    '#64748b',
  ];
  const health = buildReportHealthInsights({
    netWorth,
    liabilities: liabilitiesTotal,
    cashflowIncome: tfIncome,
    cashflowExpense: tfExpense,
  });
  const benchmarkAlpha = computeAlpha(
    summary.investedTotal > 0
      ? ((summary.totalValue - summary.investedTotal) / summary.investedTotal) * 100
      : 0,
    12,
  );
  const future10 = projectFutureValue(summary.totalValue, 12, 10);
  const sectorHeatmap = useMemo(() => {
    const bySector = portStore.investments
      .filter((i) => i.type === 'stock')
      .reduce(
        (acc, i) => {
          const k = (i.sector || 'Unknown').toUpperCase();
          acc[k] = (acc[k] || 0) + i.currentPrice * i.quantity;
          return acc;
        },
        {} as Record<string, number>,
      );
    return Object.entries(bySector)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [portStore.investments]);

  return (
    <SubscriptionGuard feature='advanced_reports'>
    <div className='flex flex-col gap-6 pb-10 animate-in fade-in duration-300'>
      {/* ── Advanced Header ── */}
      <header className='flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'>
            <FiBarChart2 className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2'>
              Advanced Reports
              <FeatureInfo feature='reports' />
            </h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              Comprehensive snapshot of all your financial & operational data.
            </p>
          </div>
        </div>
        <div className='flex items-center gap-3 flex-wrap'>
          <div className='flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700'>
            {[
              { id: 'month', label: 'This Month' },
              { id: 'ytd', label: 'YTD' },
              { id: 'all', label: 'All Time' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeframe(t.id as any)}
                className={`px-4 py-2 text-xs cursor-pointer font-bold rounded-lg transition-colors ${timeframe === t.id ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportAllSectionsAsCSV(portStore)}
            className='flex items-center cursor-pointer gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors'
          >
            <FiDownload className='h-4 w-4' /> Export CSV
          </button>
        </div>
      </header>

      {/* ── Net Worth Banner ── */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        {[
          {
            label: 'Total Assets',
            value: formatINR(totalAssets),
            color: 'text-slate-900 dark:text-slate-100',
            bg: 'bg-slate-100 dark:bg-slate-800/50 border border-slate-300/60 dark:border-slate-700/50',
          },
          {
            label: 'Total Liabilities',
            value: formatINR(liabilitiesTotal),
            color: 'text-rose-400',
            bg: 'bg-rose-500/5 border border-rose-500/20',
          },
          {
            label: 'Current Net Worth',
            value: formatINR(netWorth),
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border border-emerald-500/30 shadow-lg shadow-emerald-500/10',
          },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl p-5 ${item.bg}`}>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
              {item.label}
            </p>
            <p
              className={`text-3xl font-black tabular-nums mt-2 ${item.color}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Portfolio health index
          </p>
          <p className={`mt-1 text-lg font-black ${health.healthIndex >= 70 ? 'text-emerald-600 dark:text-emerald-400' : health.healthIndex >= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {health.healthIndex.toFixed(0)}/100
          </p>
          <p className='mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            {health.healthIndex >= 70
              ? 'Low Risk'
              : health.healthIndex >= 45
                ? 'Medium Risk'
                : 'High Risk'}
          </p>
        </div>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Debt / Net worth
          </p>
          <p className='mt-1 text-lg font-black text-slate-900 dark:text-slate-100'>
            {health.debtToNetWorth.toFixed(1)}%
          </p>
        </div>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Cashflow coverage
          </p>
          <p className='mt-1 text-lg font-black text-indigo-600 dark:text-indigo-400'>
            {health.cashflowCoverage.toFixed(1)}%
          </p>
        </div>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Alpha vs Benchmark
          </p>
          <p className={`mt-1 text-lg font-black ${benchmarkAlpha >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {benchmarkAlpha.toFixed(2)}%
          </p>
        </div>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Future Value 10Y
          </p>
          <p className='mt-1 text-lg font-black text-slate-900 dark:text-slate-100'>
            {formatINR(future10.nominal)}
          </p>
          <p className='text-[10px] text-slate-500 dark:text-slate-400'>
            Real {formatINR(future10.real)}
          </p>
        </div>
      </div>
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 p-4'>
        <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3'>Sector concentration heatmap</p>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-2'>
          {sectorHeatmap.length ? sectorHeatmap.map(([name, value], idx) => (
            <div key={name} className='rounded-lg border border-slate-300/70 dark:border-slate-700/70 px-3 py-2 bg-white/80 dark:bg-slate-800/60'>
              <p className='text-[11px] font-bold text-slate-700 dark:text-slate-200'>{name}</p>
              <div className='mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden'>
                <div className='h-full bg-emerald-500' style={{ width: `${Math.max(8, 100 - idx * 12)}%` }} />
              </div>
              <p className='mt-1 text-[10px] text-slate-500 dark:text-slate-400'>{formatINR(value)}</p>
            </div>
          )) : <p className='text-sm text-slate-500 dark:text-slate-400'>Add stock sectors to view heatmap.</p>}
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
        {/* ── Cashflow (Advanced) ── */}
        <SectionCard
          icon={<FiActivity className='h-5 w-5 text-purple-400' />}
          title={`Cashflow (${timeframe.toUpperCase()})`}
          color='bg-purple-500/10'
          to='/cashflow'
          fullWidth
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow
              label='Period Income'
              value={formatINR(tfIncome)}
              positive={tfIncome > 0}
            />
            <StatRow label='Period Expense' value={formatINR(tfExpense)} />
            <StatRow
              label='Net Cashflow Savings'
              value={`${tfIncome - tfExpense >= 0 ? '+' : ''}${formatINR(tfIncome - tfExpense)}`}
              positive={tfIncome >= tfExpense}
              accent
            />
            <StatRow
              label='Transaction Count'
              value={`${filteredCashflows.length} records`}
            />
          </div>
          {incomeByCategory.length > 0 && (
            <div className='flex-1 w-full'>
              <p className='text-xs text-center font-bold text-slate-500 dark:text-slate-400 mb-2'>
                Income Sources
              </p>
              <div className='w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4'>
                <div className='flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6'>
                  {/* Donut */}
                  <div className='h-[180px] sm:h-[200px] w-full sm:w-[45%] shrink-0'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <PieChart>
                        <Pie
                          data={incomeByCategory}
                          dataKey='value'
                          nameKey='name'
                          cx='50%'
                          cy='50%'
                          innerRadius={40}
                          outerRadius={68}
                          paddingAngle={1.5}
                          strokeWidth={0}
                        >
                          {incomeByCategory.map((_, i) => (
                            <Cell
                              key={i}
                              fill={COLORS[i % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any, _n: any, p: any) => [
                            formatINR(Number(v) || 0),
                            p?.payload?.name ?? 'Income',
                          ]}
                          labelFormatter={() => ''}
                          contentStyle={chartTooltipStyle}
                          cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend */}
                  <div className='w-full sm:flex-1 min-w-0 flex flex-col gap-1.5'>
                    {incomeByCategory
                      .slice()
                      .sort((a, b) => b.value - a.value)
                      .map((item, i) => {
                        const color = COLORS[i % COLORS.length];
                        const total = incomeByCategory.reduce(
                          (s, x) => s + (Number(x.value) || 0),
                          0,
                        );
                        const pct =
                          total > 0
                            ? ((Number(item.value) || 0) / total) * 100
                            : 0;
                        const label =
                          String(item.name ?? 'Uncategorized').length > 24
                            ? String(item.name).slice(0, 22) + '…'
                            : String(item.name ?? 'Uncategorized');
                        return (
                          <div
                            key={item.name + '-' + i}
                            className='flex items-center gap-2.5 min-w-0 rounded-lg px-2 py-1.5 -mx-1 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors'
                          >
                            <span
                              className='w-3 h-3 rounded-sm shrink-0 ring-1 ring-black/5 dark:ring-white/10'
                              style={{ backgroundColor: color }}
                              aria-hidden
                            />
                            <span
                              className='text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 min-w-0 truncate flex-1'
                              title={String(item.name ?? '')}
                            >
                              {label}
                            </span>
                            <span className='text-xs sm:text-sm tabular-nums font-semibold text-slate-500 dark:text-slate-400 shrink-0 w-11 text-right'>
                              {pct.toFixed(0)}%
                            </span>
                            <span className='text-xs sm:text-sm tabular-nums font-bold text-slate-900 dark:text-slate-100 shrink-0 w-24 text-right'>
                              {formatINR(Number(item.value) || 0)}
                            </span>
                          </div>
                        );
                      })}
                    {incomeByCategory.length > 8 && (
                      <p className='text-[10px] text-slate-400 dark:text-slate-500 pt-1 -mb-1 px-2'>
                        Showing {incomeByCategory.length} sources — only top 8
                        are coloured distinctly.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionCard>


        {/* ── Investments ── */}
        <SectionCard
          icon={<FiTrendingUp className='h-5 w-5 text-emerald-400' />}
          title='Investments'
          color='bg-emerald-500/10'
          to='/investments'
        >
          <StatRow
            label='Current Portfolio Value'
            value={formatINR(summary.totalValue)}
            accent
          />
          <StatRow
            label='Total Invested Capital'
            value={formatINR(summary.investedTotal)}
          />
          <StatRow
            label='Unrealized P&L'
            value={`${summary.profitLossTotal >= 0 ? '+' : ''}${formatINR(summary.profitLossTotal)}`}
            positive={summary.profitLossTotal >= 0}
          />
          <StatRow
            label='Realized Profit'
            value={`${realizedProfit >= 0 ? '+' : ''}${formatINR(realizedProfit)}`}
            positive={realizedProfit >= 0}
          />
          <StatRow
            label='Expected Fixed Interest'
            value={formatINR(summary.expectedInterest.total)}
          />
        </SectionCard>

        {/* ── Asset Allocation Pie ── */}
        <SectionCard
          icon={<FiPieChart className='h-5 w-5 text-violet-400' />}
          title='Asset Allocation'
          color='bg-violet-500/10'
          to='/investments'
        >
          <div className='h-[200px] w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={(
                    Object.keys(summary.byType) as Array<
                      keyof typeof summary.byType
                    >
                  )
                    .map((t) => ({ name: t, value: summary.byType[t].current }))
                    .filter((x) => x.value > 0)}
                  dataKey='value'
                  nameKey='name'
                  cx='50%'
                  cy='50%'
                  innerRadius={50}
                  outerRadius={80}
                  labelLine={false}
                >
                  {['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'].map(
                    (color, i) => (
                      <Cell key={i} fill={color} />
                    ),
                  )}
                </Pie>
                <Tooltip
                  formatter={(v: any) => formatINR(Number(v) || 0)}
                  contentStyle={chartTooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className='text-xs text-center text-slate-900 dark:text-slate-500 mt-2'>
            Distribution of your invested capital.
          </p>
        </SectionCard>

        {/* ── Liabilities ── */}
        <SectionCard
          icon={<FiTrendingDown className='h-5 w-5 text-rose-400' />}
          title='Liabilities'
          color='bg-rose-500/10'
          to='/liabilities'
        >
          <StatRow
            label='Total Loans'
            value={`${portStore.liabilities.length} active`}
          />
          <StatRow
            label='Original Borrowed'
            value={formatINR(
              portStore.liabilities.reduce((a, l) => a + (l.principal || 0), 0),
            )}
          />
          <StatRow
            label='Paid Off'
            value={formatINR(
              portStore.liabilities.reduce(
                (a, l) => a + ((l.principal || 0) - (l.outstanding || 0)),
                0,
              ),
            )}
            positive
          />
          <StatRow
            label='Remaining Outstanding'
            value={formatINR(liabilitiesTotal)}
            positive={false}
            accent
          />
        </SectionCard>

        {/* ── Accounts ── */}
        <SectionCard
          icon={<FiCreditCard className='h-5 w-5 text-blue-400' />}
          title='Bank Accounts'
          color='bg-blue-500/10'
          to='/accounts'
        >
          <StatRow
            label='Linked Accounts'
            value={`${portStore.accounts.length}`}
          />
          {portStore.accounts.slice(0, 3).map((acc) => (
            <StatRow
              key={acc.id}
              label={acc.name}
              value={formatINR(acc.balance || 0)}
            />
          ))}
          <StatRow
            label='Total Liquid Balance'
            value={formatINR(totalAccountBalance)}
            accent
          />
        </SectionCard>

        {/* ── Goals ── */}
        <SectionCard
          icon={<FiFlag className='h-5 w-5 text-amber-400' />}
          title='Financial Goals'
          color='bg-amber-500/10'
          to='/goals'
        >
          <StatRow label='Active Goals' value={`${portStore.goals.length}`} />
          <StatRow
            label='Total Target Required'
            value={formatINR(
              portStore.goals.reduce((a, g) => a + g.targetAmount, 0),
            )}
          />
          <StatRow
            label='Current Saved Capital'
            value={formatINR(
              portStore.goals.reduce((a, g) => a + g.currentAmount, 0),
            )}
            accent
          />
          <StatRow
            label='Fully Completed'
            value={`${completedGoals}`}
            positive={completedGoals > 0}
          />
        </SectionCard>

        {/* ── Insurance ── */}
        <SectionCard
          icon={<FiShield className='h-5 w-5 text-sky-400' />}
          title='Insurance Coverage'
          color='bg-sky-500/10'
          to='/insurance'
        >
          <StatRow
            label='Active Policies'
            value={`${portStore.insurancePolicies.length}`}
          />
          <StatRow
            label='Total Sum Assured'
            value={formatINR(totalInsuranceCoverage)}
            accent
          />
          <StatRow
            label='Annual Premium Cost'
            value={formatINR(yearlyPremium)}
          />
          <StatRow
            label='Policies'
            value={['life', 'health', 'vehicle']
              .map((t) =>
                portStore.insurancePolicies.filter((p) => p.type === t).length >
                0
                  ? t
                  : null,
              )
              .filter(Boolean)
              .join(', ')
              .toUpperCase()}
          />
        </SectionCard>
      </div>
    </div>
    </SubscriptionGuard>
  );
}
