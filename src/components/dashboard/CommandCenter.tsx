/**
 * src/components/dashboard/CommandCenter.tsx
 *
 * Financial Command Center — Feature 5.
 * A single-screen summary widget for the dashboard:
 *   • Financial Health Score (0–100)
 *   • Net Worth + monthly delta
 *   • Cashflow summary
 *   • Goals overview
 *   • AI Insights (top 3 proactive alerts)
 *   • Quick "Ask AI" shortcut
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiZap, FiTrendingUp, FiTrendingDown,
  FiFlag, FiCpu, FiArrowRight,
} from 'react-icons/fi';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useProactiveInsights } from '../../hooks/useProactiveInsights';
import { calculateNetWorth } from '../../utils/calculations';
import { formatINR, formatNumber } from '../../utils/format';

// ─── Health score (mirrors InsightsPage logic, self-contained) ────────────────

function calcHealthScore(
  investments: any[],
  liabilities: any[],
  cashflows: any[],
  essentials: any,
): number {
  // Debt score (0–30): lower debt ratio = better
  const { totalAssets, totalLiabilities } = calculateNetWorth(investments, liabilities);
  const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
  const debtScore = Math.max(0, 30 - Math.round(debtRatio * 60));

  // Emergency fund score (0–20)
  const target   = essentials?.emergencyFundTarget  ?? 0;
  const current  = essentials?.emergencyFundCurrent ?? 0;
  const expEntries = cashflows.filter((e: any) => e.type === 'expense');
  const months   = new Set(expEntries.map((e: any) => e.date.slice(0, 7))).size || 1;
  const avgExp   = expEntries.reduce((a: number, e: any) => a + e.amount, 0) / months;
  const runway   = avgExp > 0 ? current / avgExp : 0;
  const emergencyScore = target > 0
    ? Math.min(20, Math.round((current / target) * 20))
    : Math.min(20, Math.round((runway / 6) * 20));

  // Savings rate score (0–25)
  const incEntries = cashflows.filter((e: any) => e.type === 'income');
  const incMonths  = new Set(incEntries.map((e: any) => e.date.slice(0, 7))).size || 1;
  const avgInc     = incEntries.reduce((a: number, e: any) => a + e.amount, 0) / incMonths;
  const surplus    = avgInc - (expEntries.reduce((a: number, e: any) => a + e.amount, 0) / months);
  const savingsRate = avgInc > 0 ? (surplus / avgInc) * 100 : 0;
  const savingsScore = Math.min(25, Math.max(0, Math.round(savingsRate * 0.6)));

  // Diversification score (0–25)
  const assetTypes = new Set(investments.map((i: any) => i.type)).size;
  const divScore = Math.min(25, assetTypes * 5);

  return Math.min(100, debtScore + emergencyScore + savingsScore + divScore);
}

function healthLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Work';
}
function healthColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r   = 28;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = healthColor(score);
  return (
    <div className='relative flex h-16 w-16 items-center justify-center shrink-0'>
      <svg className='absolute inset-0 -rotate-90' viewBox='0 0 64 64'>
        <circle cx='32' cy='32' r={r} fill='none' strokeWidth='5' stroke='currentColor' className='text-slate-200 dark:text-slate-700' />
        <circle
          cx='32' cy='32' r={r} fill='none' strokeWidth='5'
          stroke={color}
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap='round'
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <span className='text-sm font-black' style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommandCenter() {
  const navigate = useNavigate();
  const {
    investments, liabilities, cashflows, goals, goalContributions,
    essentials, networthSnapshots, trackedPayments, accounts,
  } = usePortfolioStore();

  const proactiveInsights = useProactiveInsights();

  const { totalAssets, totalLiabilities, netWorth } = useMemo(
    () => calculateNetWorth(investments, liabilities),
    [investments, liabilities],
  );

  const score = useMemo(
    () => calcHealthScore(investments, liabilities, cashflows, essentials),
    [investments, liabilities, cashflows, essentials],
  );

  // Monthly cashflow
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthCF = cashflows.filter((e) => e.date.startsWith(thisMonth));
  const income    = thisMonthCF.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const expense   = thisMonthCF.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0);
  const investable   = Math.max(0, income - expense);
  const savingsRate  = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  // Available cash (sum of bank account balances)
  const availableCash = useMemo(
    () => accounts.filter((a) => a.type === 'bank').reduce((s, a) => s + (a.balance ?? 0), 0),
    [accounts],
  );

  // Recent activity — last 5 cashflow entries
  const recentActivity = useMemo(
    () => [...cashflows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [cashflows],
  );
  const sorted    = [...networthSnapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const prevSnap  = sorted[0];
  const nwDelta   = prevSnap ? netWorth - prevSnap.netWorth : 0;

  // Goals summary
  const activeGoals   = goals.filter((g) => !g.status || g.status === 'active');
  const goalsFunded   = activeGoals.reduce((a, g) => {
    const contrib = goalContributions.filter((c) => c.goalId === g.id).reduce((x, c) => x + c.amount, 0);
    return a + g.currentAmount + contrib;
  }, 0);
  const goalsTarget   = activeGoals.reduce((a, g) => a + g.targetAmount, 0);
  const goalsPct      = goalsTarget > 0 ? Math.min(100, (goalsFunded / goalsTarget) * 100) : 0;

  // Emergency fund %
  const efTarget  = essentials?.emergencyFundTarget  ?? 0;
  const efCurrent = essentials?.emergencyFundCurrent ?? 0;
  const efPct     = efTarget > 0 ? Math.min(100, (efCurrent / efTarget) * 100) : 0;

  // Overdue payments
  const todayISO  = now.toISOString().slice(0, 10);
  const overdueCount = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate < todayISO).length;

  const sevCls: Record<string, string> = {
    danger:  'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
    warning: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    good:    'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    info:    'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  const noData = !investments.length && !cashflows.length && !liabilities.length;

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden'>
      {/* ── Header ── */}
      <div className='flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-800/30'>
        <div className='flex items-center gap-2'>
          <FiZap className='h-4 w-4 text-amber-400' />
          <h2 className='text-sm font-bold text-slate-900 dark:text-slate-100'>Financial Command Center</h2>
        </div>
        <button
          type='button'
          onClick={() => navigate('/ai-agent')}
          className='flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 text-xs font-bold transition-colors'
        >
          <FiCpu className='h-3.5 w-3.5' />
          Ask AI
        </button>
      </div>

      {noData ? (
        <p className='px-5 py-8 text-center text-sm text-slate-400'>
          Add investments, cashflow or liabilities to power up the Command Center.
        </p>
      ) : (
        <div className='divide-y divide-slate-100 dark:divide-slate-800'>

          {/* ── Health Score + Net Worth ── */}
          <div className='flex gap-4 px-5 py-4'>
            <div className='flex items-center gap-3'>
              <ScoreRing score={score} />
              <div>
                <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400'>Health Score</p>
                <p className='text-sm font-bold' style={{ color: healthColor(score) }}>{healthLabel(score)}</p>
              </div>
            </div>
            <div className='ml-auto text-right'>
              <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400'>Net Worth</p>
              <p className='text-xl font-black tabular-nums text-slate-900 dark:text-slate-100'>{formatINR(netWorth)}</p>
              {nwDelta !== 0 && (
                <p className={`flex items-center gap-1 justify-end text-xs font-bold ${nwDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {nwDelta >= 0 ? <FiTrendingUp className='h-3 w-3' /> : <FiTrendingDown className='h-3 w-3' />}
                  {nwDelta >= 0 ? '+' : ''}{formatINR(nwDelta)} vs last snapshot
                </p>
              )}
            </div>
          </div>

          {/* ── Cashflow ── */}
          <div className='px-5 py-3'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2'>This Month</p>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
              {[
                { label: 'Income',       value: formatINR(income),       color: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Expenses',     value: formatINR(expense),      color: 'text-rose-600 dark:text-rose-400' },
                { label: 'Savings',      value: formatINR(Math.max(0, income - expense)), color: investable > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500' },
                { label: 'Savings Rate', value: `${savingsRate}%`,       color: savingsRate >= 20 ? 'text-emerald-600 dark:text-emerald-400' : savingsRate >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className='rounded-lg bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-center'>
                  <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400'>{label}</p>
                  <p className={`text-sm font-black tabular-nums ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Available Cash ── */}
          {accounts.length > 0 && (
            <div className='px-5 py-2'>
              <div className='flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-700/30 px-4 py-2.5'>
                <div className='flex items-center gap-2'>
                  <span className='text-base'>🏦</span>
                  <span className='text-xs font-semibold text-slate-600 dark:text-slate-300'>Available Cash</span>
                </div>
                <span className='text-base font-black tabular-nums text-emerald-700 dark:text-emerald-400'>
                  {formatINR(availableCash)}
                </span>
              </div>
            </div>
          )}

          {/* ── Goals ── */}
          {activeGoals.length > 0 && (
            <div className='px-5 py-3'>
              <div className='flex items-center justify-between mb-2'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1'>
                  <FiFlag className='h-3 w-3' /> Goals
                </p>
                <button type='button' onClick={() => navigate('/goals')}
                  className='text-[10px] text-violet-500 hover:underline flex items-center gap-0.5'>
                  View all <FiArrowRight className='h-3 w-3' />
                </button>
              </div>
              <div className='space-y-2'>
                {/* Overall goal progress */}
                <div>
                  <div className='flex justify-between text-xs mb-1'>
                    <span className='text-slate-500 dark:text-slate-400'>{activeGoals.length} active goals</span>
                    <span className='font-bold text-slate-700 dark:text-slate-200'>{formatNumber(goalsPct, 0)}%</span>
                  </div>
                  <div className='h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
                    <div className='h-full rounded-full bg-amber-500 transition-all duration-700' style={{ width: `${goalsPct}%` }} />
                  </div>
                </div>
                {/* Emergency fund if set */}
                {efTarget > 0 && (
                  <div>
                    <div className='flex justify-between text-xs mb-1'>
                      <span className='text-slate-500 dark:text-slate-400'>Emergency Fund</span>
                      <span className='font-bold text-slate-700 dark:text-slate-200'>{formatNumber(efPct, 0)}%</span>
                    </div>
                    <div className='h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
                      <div className={`h-full rounded-full transition-all duration-700 ${efPct < 50 ? 'bg-rose-500' : efPct < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${efPct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── AI Insights ── */}
          {proactiveInsights.length > 0 && (
            <div className='px-5 py-3'>
              <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1'>
                <FiCpu className='h-3 w-3' /> AI Insights
              </p>
              <div className='space-y-1.5'>
                {proactiveInsights.slice(0, 3).map((ins) => (
                  <button
                    key={ins.id}
                    type='button'
                    onClick={() => navigate('/ai-agent')}
                    className={`w-full flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition-all hover:-translate-y-0.5 ${sevCls[ins.severity] ?? sevCls.info}`}
                  >
                    <span className='shrink-0 text-sm'>{ins.emoji}</span>
                    <span className='font-semibold truncate'>{ins.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent Activity ── */}
          {recentActivity.length > 0 && (
            <div className='px-5 py-3'>
              <div className='flex items-center justify-between mb-2'>
                <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400'>Recent Activity</p>
                <button type='button' onClick={() => navigate('/cashflow')}
                  className='text-[10px] text-violet-500 hover:underline flex items-center gap-0.5'>
                  All <FiArrowRight className='h-3 w-3' />
                </button>
              </div>
              <div className='space-y-1'>
                {recentActivity.map((e) => (
                  <div key={e.id} className='flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors'>
                    <div className='flex items-center gap-2 min-w-0'>
                      <span className='text-sm shrink-0'>{e.type === 'income' ? '💰' : '💸'}</span>
                      <span className='text-xs text-slate-600 dark:text-slate-400 truncate'>{e.category}</span>
                    </div>
                    <div className='flex items-center gap-2 shrink-0'>
                      <span className={`text-xs font-bold tabular-nums ${e.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {e.type === 'income' ? '+' : '-'}{formatINR(e.amount)}
                      </span>
                      <span className='text-[9px] text-slate-400'>{e.date.slice(5)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Quick links ── */}
          <div className='flex flex-wrap gap-2 px-5 py-3'>
            {[
              { label: 'Timeline',   path: '/timeline',  emoji: '📈' },
              { label: 'Calendar',   path: '/calendar',  emoji: '📅' },
              { label: 'Budget',     path: '/budget',    emoji: '🎯' },
              { label: 'Simulator',  path: '/simulator', emoji: '🧮' },
            ].map(({ label, path, emoji }) => (
              <button
                key={path}
                type='button'
                onClick={() => navigate(path)}
                className='flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors'
              >
                <span>{emoji}</span> {label}
              </button>
            ))}
            {overdueCount > 0 && (
              <button
                type='button'
                onClick={() => navigate('/payments')}
                className='flex items-center gap-1.5 rounded-full border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-100'
              >
                ⚠️ {overdueCount} overdue
              </button>
            )}
          </div>

          {/* ── Assets / Liabilities mini bar ── */}
          <div className='px-5 py-3'>
            <div className='flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5'>
              <span>Assets {formatINR(totalAssets)}</span>
              <span>Liabilities {formatINR(totalLiabilities)}</span>
            </div>
            <div className='h-2.5 rounded-full overflow-hidden flex'>
              <div className='bg-emerald-500 transition-all duration-700'
                style={{ width: `${totalAssets + totalLiabilities > 0 ? (totalAssets / (totalAssets + totalLiabilities)) * 100 : 50}%` }} />
              <div className='bg-rose-400 flex-1' />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
