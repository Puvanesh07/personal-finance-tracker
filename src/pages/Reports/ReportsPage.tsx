// src/pages/Reports/ReportsPage.tsx
// UPDATED: Full reports page with all sections — investments, cashflow, accounts,
//          insurance, goals, agriculture summary, plus export buttons

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
import { isSameMonth, parseISO } from 'date-fns';

import { exportAllSectionsAsCSV } from '../../utils/exportUtils';
import { formatINR } from '../../utils/format';
import { summarizePortfolio } from '../../utils/calculations';
import { useAgriStore } from '../../store/agricultureStore';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';

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
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  to?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className='rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-4'>
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
            className='flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-400 transition-colors rounded-lg px-2 py-1 hover:bg-slate-800'
          >
            View <FiArrowUpRight className='h-3.5 w-3.5' />
          </button>
        )}
      </div>
      <div className='flex flex-col gap-2'>{children}</div>
    </div>
  );
}

export function ReportsPage() {
  const investments = usePortfolioStore((s) => s.investments);
  const liabilities = usePortfolioStore((s) => s.liabilities);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const goals = usePortfolioStore((s) => s.goals);
  const accounts = usePortfolioStore((s) => s.accounts);
  const soldTrades = usePortfolioStore((s) => s.soldTrades);
  const insurancePolicies = usePortfolioStore((s) => s.insurancePolicies) || [];
  const state = usePortfolioStore();
  const agriState = useAgriStore();

  const summary = useMemo(() => summarizePortfolio(investments), [investments]);

  const liabilitiesTotal = useMemo(
    () => liabilities.reduce((a, l) => a + (l.outstanding || 0), 0),
    [liabilities],
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
  const allIncome = cashflows
    .filter((c) => c.type === 'income')
    .reduce((a, c) => a + c.amount, 0);
  const allExpense = cashflows
    .filter((c) => c.type === 'expense')
    .reduce((a, c) => a + c.amount, 0);

  const totalInsuranceCoverage = insurancePolicies.reduce(
    (a, p) => a + p.coverageAmount,
    0,
  );
  const yearlyPremium = insurancePolicies.reduce(
    (a, p) =>
      a +
      (p.premiumFrequency === 'monthly'
        ? p.premiumAmount * 12
        : p.premiumAmount),
    0,
  );
  const expiringSoon = insurancePolicies.filter((p) => {
    const d = new Date(p.renewalDate);
    const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    return diff >= 0 && diff <= 30;
  });

  const completedGoals = goals.filter(
    (g) => g.currentAmount >= g.targetAmount,
  ).length;
  const totalGoalTarget = goals.reduce((a, g) => a + g.targetAmount, 0);
  const totalGoalCurrent = goals.reduce((a, g) => a + g.currentAmount, 0);

  const totalAccountBalance = accounts.reduce(
    (a, acc) => a + (acc.balance || 0),
    0,
  );

  const agriNetProfit = useMemo(() => {
    const income =
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
    const expense = (agriState.agriExpenses || []).reduce(
      (a, e) => a + e.amount,
      0,
    );
    return { income, expense, net: income - expense };
  }, [agriState]);

  const realizedProfit = soldTrades.reduce((a, t) => a + t.profit, 0);

  return (
    <div className='flex flex-col gap-6 pb-10'>
      {/* Header */}
      <header className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5 border border-emerald-500/20 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'>
            <FiBarChart2 className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-white'>
              Reports & Analytics
            </h1>
            <p className='text-sm text-slate-400 mt-0.5'>
              Full snapshot of your financial health across all sections.
            </p>
          </div>
        </div>
        <button
          onClick={() => exportAllSectionsAsCSV(state, agriState)}
          className='flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-800 transition-colors'
        >
          <FiDownload className='h-4 w-4 text-emerald-400' /> Export All CSV
        </button>
      </header>

      {/* Net Worth Banner */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        {[
          {
            label: 'Total Assets',
            value: formatINR(summary.totalValue),
            color: 'text-slate-100',
            bg: 'bg-slate-800/50',
          },
          {
            label: 'Total Liabilities',
            value: formatINR(liabilitiesTotal),
            color: 'text-rose-400',
            bg: 'bg-rose-500/5 border border-rose-500/20',
          },
          {
            label: 'Net Worth',
            value: formatINR(summary.totalValue - liabilitiesTotal),
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border border-emerald-500/20',
          },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl p-4 ${item.bg}`}>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>
              {item.label}
            </p>
            <p
              className={`text-2xl font-black tabular-nums mt-1 ${item.color}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
        {/* Investments */}
        <SectionCard
          icon={<FiTrendingUp className='h-4 w-4 text-emerald-400' />}
          title='Investments'
          color='bg-emerald-500/10'
          to='/investments'
        >
          <StatRow
            label='Portfolio Value'
            value={formatINR(summary.totalValue)}
          />
          <StatRow
            label='Total Invested'
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
          <StatRow label='Holdings' value={`${investments.length} assets`} />
          <StatRow
            label='Expected Interest'
            value={formatINR(summary.expectedInterest.total)}
            accent
          />
        </SectionCard>

        {/* Cashflow */}
        <SectionCard
          icon={<FiActivity className='h-4 w-4 text-purple-400' />}
          title='Cashflow'
          color='bg-purple-500/10'
          to='/cashflow'
        >
          <StatRow
            label='This Month Income'
            value={formatINR(monthIncome)}
            positive={monthIncome > 0}
          />
          <StatRow label='This Month Expense' value={formatINR(monthExpense)} />
          <StatRow
            label='Monthly Savings'
            value={`${monthIncome - monthExpense >= 0 ? '+' : ''}${formatINR(monthIncome - monthExpense)}`}
            positive={monthIncome >= monthExpense}
          />
          <StatRow label='All-Time Income' value={formatINR(allIncome)} />
          <StatRow label='All-Time Expense' value={formatINR(allExpense)} />
          <StatRow label='Total Transactions' value={`${cashflows.length}`} />
        </SectionCard>

        {/* Accounts */}
        <SectionCard
          icon={<FiCreditCard className='h-4 w-4 text-blue-400' />}
          title='Accounts'
          color='bg-blue-500/10'
          to='/accounts'
        >
          <StatRow
            label='Total Balance'
            value={formatINR(totalAccountBalance)}
            accent
          />
          <StatRow label='Accounts' value={`${accounts.length} linked`} />
          {accounts.slice(0, 4).map((acc) => (
            <StatRow
              key={acc.id}
              label={acc.name}
              value={formatINR(acc.balance || 0)}
            />
          ))}
          {accounts.length > 4 && (
            <p className='text-xs text-slate-500 text-center'>
              +{accounts.length - 4} more accounts
            </p>
          )}
        </SectionCard>

        {/* Goals */}
        <SectionCard
          icon={<FiFlag className='h-4 w-4 text-amber-400' />}
          title='Financial Goals'
          color='bg-amber-500/10'
          to='/goals'
        >
          <StatRow label='Total Goals' value={`${goals.length}`} />
          <StatRow
            label='Completed'
            value={`${completedGoals} / ${goals.length}`}
            positive={completedGoals > 0}
          />
          <StatRow label='Total Target' value={formatINR(totalGoalTarget)} />
          <StatRow
            label='Total Saved'
            value={formatINR(totalGoalCurrent)}
            accent
          />
          <StatRow
            label='Progress'
            value={
              totalGoalTarget > 0
                ? `${((totalGoalCurrent / totalGoalTarget) * 100).toFixed(0)}%`
                : '—'
            }
          />
        </SectionCard>

        {/* Insurance */}
        <SectionCard
          icon={<FiShield className='h-4 w-4 text-sky-400' />}
          title='Insurance & Protection'
          color='bg-sky-500/10'
          to='/insurance'
        >
          <StatRow
            label='Active Policies'
            value={`${insurancePolicies.length}`}
          />
          <StatRow
            label='Total Coverage'
            value={formatINR(totalInsuranceCoverage)}
            accent
          />
          <StatRow label='Yearly Premium' value={formatINR(yearlyPremium)} />
          {expiringSoon.length > 0 && (
            <StatRow
              label='⏰ Renewing (30 days)'
              value={`${expiringSoon.length} policy`}
              positive={false}
            />
          )}
          {['life', 'health', 'vehicle'].map((type) => {
            const count = insurancePolicies.filter(
              (p) => p.type === type,
            ).length;
            if (count === 0) return null;
            return (
              <StatRow
                key={type}
                label={type.charAt(0).toUpperCase() + type.slice(1)}
                value={`${count} policy`}
              />
            );
          })}
        </SectionCard>

        {/* Agriculture */}
        <SectionCard
          icon={<span className='text-sm'>🌾</span>}
          title='Agriculture'
          color='bg-green-500/10'
          to='/agriculture'
        >
          <StatRow
            label='Total Revenue'
            value={formatINR(agriNetProfit.income)}
            positive={agriNetProfit.income > 0}
          />
          <StatRow
            label='Total Expenses'
            value={formatINR(agriNetProfit.expense)}
          />
          <StatRow
            label='Net Profit'
            value={`${agriNetProfit.net >= 0 ? '+' : ''}${formatINR(agriNetProfit.net)}`}
            positive={agriNetProfit.net >= 0}
            accent
          />
          <StatRow
            label='Active Crops'
            value={`${(agriState.cropCycles || []).filter((c) => !c.actualHarvestDate).length}`}
          />
          <StatRow
            label='Milk Records'
            value={`${(agriState.milkRecords || []).length}`}
          />
        </SectionCard>

        {/* Liabilities */}
        <SectionCard
          icon={<FiTrendingDown className='h-4 w-4 text-rose-400' />}
          title='Liabilities'
          color='bg-rose-500/10'
          to='/liabilities'
        >
          <StatRow label='Total Loans' value={`${liabilities.length}`} />
          <StatRow
            label='Outstanding'
            value={formatINR(liabilitiesTotal)}
            positive={false}
          />
          <StatRow
            label='Original Principal'
            value={formatINR(
              liabilities.reduce((a, l) => a + (l.principal || 0), 0),
            )}
          />
          <StatRow
            label='Paid Off'
            value={formatINR(
              liabilities.reduce(
                (a, l) => a + ((l.principal || 0) - (l.outstanding || 0)),
                0,
              ),
            )}
            positive
          />
          {liabilities.slice(0, 3).map((l) => (
            <StatRow
              key={l.id}
              label={l.name}
              value={formatINR(l.outstanding || 0)}
            />
          ))}
        </SectionCard>

        {/* Asset Allocation */}
        <SectionCard
          icon={<FiPieChart className='h-4 w-4 text-violet-400' />}
          title='Asset Allocation'
          color='bg-violet-500/10'
          to='/investments'
        >
          {(
            ['stock', 'mutual_fund', 'fixed_deposit', 'bond', 'other'] as const
          ).map((type) => {
            const val = summary.byType[type].current;
            const pct =
              summary.totalValue > 0
                ? ((val / summary.totalValue) * 100).toFixed(1)
                : '0.0';
            const labels: Record<string, string> = {
              stock: 'Stocks',
              mutual_fund: 'Mutual Funds',
              fixed_deposit: 'Fixed Deposits',
              bond: 'Bonds',
              other: 'Others',
            };
            if (val === 0) return null;
            return (
              <StatRow
                key={type}
                label={labels[type]}
                value={`${pct}%  ${formatINR(val)}`}
              />
            );
          })}
          <StatRow
            label='Total Portfolio'
            value={formatINR(summary.totalValue)}
            accent
          />
        </SectionCard>
      </div>
    </div>
  );
}
