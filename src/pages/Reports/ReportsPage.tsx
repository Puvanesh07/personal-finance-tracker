// src/pages/Reports/ReportsPage.tsx

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  FiActivity,
  FiArrowUpRight,
  FiBarChart2,
  FiBriefcase,
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
import { formatINR } from '../../utils/format';
import { summarizePortfolio } from '../../utils/calculations';
import { useAgriStore } from '../../store/agricultureStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

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
  let cls = 'text-sm font-bold tabular-nums text-slate-100';
  if (positive === true)
    cls = 'text-sm font-bold tabular-nums text-emerald-400';
  if (positive === false) cls = 'text-sm font-bold tabular-nums text-rose-400';
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-4 py-3 ${accent ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800/40 hover:bg-slate-800/70'} transition-colors`}
    >
      <span className='text-sm text-slate-400'>{label}</span>
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
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-4 ${fullWidth ? 'md:col-span-2' : ''}`}
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2.5'>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}
          >
            {icon}
          </div>
          <h2 className='text-base font-bold text-slate-100'>{title}</h2>
        </div>
        {to && (
          <button
            onClick={() => navigate(to)}
            className='flex items-center cursor-pointer gap-1 text-xs font-bold text-slate-500 hover:text-emerald-400 transition-colors rounded-lg px-2 py-1 hover:bg-slate-800'
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
  const agriStore = useAgriStore();
  const attStore = useAttendanceStore();

  const [timeframe, setTimeframe] = useState<'all' | 'ytd' | 'month'>('all');

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
  const liabilitiesTotal = portStore.liabilities.reduce(
    (a, l) => a + (l.outstanding || 0),
    0,
  );
  const totalAccountBalance = portStore.accounts.reduce(
    (a, acc) => a + (acc.balance || 0),
    0,
  );

  // ── 2. Cashflow (Time Filtered)
  const filteredCashflows = useMemo(
    () => portStore.cashflows.filter((c) => isWithinTimeframe(c.date)),
    [portStore.cashflows, timeframe],
  );
  const tfIncome = filteredCashflows
    .filter((c) => c.type === 'income')
    .reduce((a, c) => a + c.amount, 0);
  const tfExpense = filteredCashflows
    .filter((c) => c.type === 'expense')
    .reduce((a, c) => a + c.amount, 0);

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCashflows
      .filter((c) => c.type === 'income')
      .forEach((c) => (map[c.category] = (map[c.category] || 0) + c.amount));
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredCashflows]);

  // ── 3. Lending & Financing (Time Filtered)
  const lendingStats = useMemo(() => {
    let tfGiven = 0,
      tfReturned = 0,
      tfInterest = 0;
    const validIds = new Set(portStore.lendingBorrowers.map((b) => b.id));

    // Filtered by timeframe for period metrics
    portStore.lendingTransactions
      .filter((t) => isWithinTimeframe(t.date) && validIds.has(t.borrowerId))
      .forEach((t) => {
        if (t.type === 'principal_given') tfGiven += t.amount;
        if (t.type === 'principal_returned') tfReturned += t.amount;
        if (t.type === 'interest_paid') tfInterest += t.amount;
      });

    // All time for outstanding balance calculation
    let allTimeGiven = 0,
      allTimeReturned = 0;
    portStore.lendingTransactions
      .filter((t) => validIds.has(t.borrowerId))
      .forEach((t) => {
        if (t.type === 'principal_given') allTimeGiven += t.amount;
        if (t.type === 'principal_returned') allTimeReturned += t.amount;
      });

    return {
      tfGiven,
      tfReturned,
      tfInterest,
      outstanding: allTimeGiven - allTimeReturned,
    };
  }, [portStore.lendingTransactions, portStore.lendingBorrowers, timeframe]);

  // ── 4. Agriculture & Produce (Time Filtered)
  const agriStats = useMemo(() => {
    const crops = agriStore.cropCycles.filter((c) =>
      isWithinTimeframe(c.actualHarvestDate || c.expectedHarvestDate),
    );
    const milk = agriStore.milkRecords.filter((m) => isWithinTimeframe(m.date));
    const coconut = agriStore.coconutRecords.filter((c) =>
      isWithinTimeframe(c.date),
    );
    const livestock = agriStore.livestockEvents.filter((l) =>
      isWithinTimeframe(l.date),
    );
    const expenses = agriStore.agriExpenses.filter((e) =>
      isWithinTimeframe(e.date),
    );
    const produce = agriStore.produceSales.filter((p) =>
      isWithinTimeframe(p.date),
    ); // Includes Produce Sales!

    const cropInc = crops.reduce((s, c) => s + (c.harvestIncome || 0), 0);
    const milkInc = milk.reduce((s, m) => s + m.liters * m.pricePerLiter, 0);
    const cocoInc = coconut.reduce((s, c) => s + (c.harvestIncome || 0), 0);
    const liveInc = livestock
      .filter((l) => l.eventType === 'sale')
      .reduce((s, l) => s + (l.price || 0), 0);
    const produceInc = produce.reduce((s, p) => s + (p.totalAmount || 0), 0);

    const cropExp = crops.reduce((s, c) => s + (c.investedAmount || 0), 0);
    const cocoExp = coconut.reduce((s, c) => s + (c.investmentAmount || 0), 0);
    const liveExp = livestock
      .filter((l) => l.eventType === 'purchase')
      .reduce((s, l) => s + (l.price || 0), 0);
    const farmExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    const totalInc = cropInc + milkInc + cocoInc + liveInc + produceInc;
    const totalExp = cropExp + cocoExp + liveExp + farmExp;

    return { totalInc, totalExp, netProfit: totalInc - totalExp, produceInc };
  }, [agriStore, timeframe]);

  // ── 5. Labor & Attendance (Time Filtered)
  const attStats = useMemo(() => {
    const records = attStore.attendanceRecords.filter((r) =>
      isWithinTimeframe(r.date),
    );
    const advances = attStore.transactions.filter(
      (t) => t.type === 'advance' && isWithinTimeframe(t.date),
    );

    const wages = records.reduce(
      (s, r) => s + (r.present ? (r.wage || 0) + (r.extraWork || 0) : 0),
      0,
    );
    const advTotal = advances.reduce((s, t) => s + (t.amount || 0), 0);
    const days = records.filter((r) => r.present).length;

    return { wages, advTotal, days };
  }, [attStore, timeframe]);

  // ── Net Worth Calculation (Includes Lending Asset)
  const totalAssets =
    summary.totalValue + totalAccountBalance + lendingStats.outstanding;
  const netWorth = totalAssets - liabilitiesTotal;

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

  return (
    <div className='flex flex-col gap-6 pb-10 animate-in fade-in duration-300'>
      {/* ── Advanced Header ── */}
      <header className='flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'>
            <FiBarChart2 className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-white'>Advanced Reports</h1>
            <p className='text-sm text-slate-400 mt-0.5'>
              Comprehensive snapshot of all your financial & operational data.
            </p>
          </div>
        </div>
        <div className='flex items-center gap-3 flex-wrap'>
          <div className='flex bg-slate-800 p-1 rounded-xl border border-slate-700'>
            {[
              { id: 'month', label: 'This Month' },
              { id: 'ytd', label: 'YTD' },
              { id: 'all', label: 'All Time' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeframe(t.id as any)}
                className={`px-4 py-2 text-xs cursor-pointer font-bold rounded-lg transition-colors ${timeframe === t.id ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => exportAllSectionsAsCSV(portStore, agriStore)}
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
            label: 'Total Assets (Incl. Lending)',
            value: formatINR(totalAssets),
            color: 'text-slate-100',
            bg: 'bg-slate-800/50 border border-slate-700/50',
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
            <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>
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
            <div className='flex-1 w-full h-[200px] bg-slate-900/50 rounded-xl border border-slate-800 p-2'>
              <p className='text-xs text-center font-bold text-slate-400 mb-1'>
                Income Sources
              </p>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie
                    data={incomeByCategory}
                    dataKey='value'
                    nameKey='name'
                    cx='50%'
                    cy='50%'
                    outerRadius={60}
                    label={({ name, percent }) =>
                      `${name} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {incomeByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => formatINR(Number(v) || 0)}
                    contentStyle={{
                      background: '#0f172a',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        {/* ── Agriculture & Produce (Advanced) ── */}
        <SectionCard
          icon={<span className='text-lg'>🌾</span>}
          title={`Agriculture & Farming (${timeframe.toUpperCase()})`}
          color='bg-green-500/10'
          to='/agriculture'
          fullWidth
        >
          <div className='flex-1 w-full space-y-2'>
            <StatRow
              label='Total Farm Revenue'
              value={formatINR(agriStats.totalInc)}
              positive={agriStats.totalInc > 0}
            />
            <StatRow
              label='Farm Expenses & Investments'
              value={formatINR(agriStats.totalExp)}
            />
            <StatRow
              label='Net Farm Profit'
              value={`${agriStats.netProfit >= 0 ? '+' : ''}${formatINR(agriStats.netProfit)}`}
              positive={agriStats.netProfit >= 0}
              accent
            />
            <StatRow
              label='Produce Sales Contribution'
              value={formatINR(agriStats.produceInc)}
              positive={agriStats.produceInc > 0}
            />
          </div>
          <div className='flex-1 w-full bg-slate-900/50 rounded-xl border border-slate-800 p-4 flex flex-col justify-center'>
            <div className='flex items-center gap-3 mb-2 text-sm text-slate-300'>
              <span className='w-3 h-3 rounded-full bg-emerald-500'></span>{' '}
              Crops & Produce
            </div>
            <div className='flex items-center gap-3 mb-2 text-sm text-slate-300'>
              <span className='w-3 h-3 rounded-full bg-blue-500'></span> Dairy &
              Milk
            </div>
            <div className='flex items-center gap-3 text-sm text-slate-300'>
              <span className='w-3 h-3 rounded-full bg-amber-500'></span>{' '}
              Coconut & Livestock
            </div>
            <p className='text-xs text-slate-500 mt-4 italic'>
              Revenue from these streams auto-factors into your Net Worth.
            </p>
          </div>
        </SectionCard>

        {/* ── Lending & Financing ── */}
        <SectionCard
          icon={<FiBriefcase className='h-5 w-5 text-indigo-400' />}
          title='Lending & Financing'
          color='bg-indigo-500/10'
          to='/cashflow'
        >
          <StatRow
            label={`Interest Earned (${timeframe})`}
            value={formatINR(lendingStats.tfInterest)}
            positive={lendingStats.tfInterest > 0}
          />
          <StatRow
            label={`Principal Lent (${timeframe})`}
            value={formatINR(lendingStats.tfGiven)}
          />
          <StatRow
            label='Total Active Borrowers'
            value={`${portStore.lendingBorrowers.filter((b) => b.status === 'active').length} accounts`}
          />
          <StatRow
            label='Outstanding Capital (All Time)'
            value={formatINR(lendingStats.outstanding)}
            accent
          />
        </SectionCard>

        {/* ── Labor & Attendance ── */}
        <SectionCard
          icon={<span className='text-lg'>👷</span>}
          title={`Labor & Attendance (${timeframe.toUpperCase()})`}
          color='bg-sky-500/10'
          to='/agriculture'
        >
          <StatRow
            label='Active Workforce'
            value={`${attStore.employees.length} workers`}
          />
          <StatRow label='Days Logged' value={`${attStats.days} shifts`} />
          <StatRow
            label='Total Wages Generated'
            value={formatINR(attStats.wages)}
          />
          <StatRow
            label='Advances Provided'
            value={formatINR(attStats.advTotal)}
            accent
          />
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
                  contentStyle={{
                    background: '#0f172a',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className='text-xs text-center text-slate-500 mt-2'>
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
  );
}
