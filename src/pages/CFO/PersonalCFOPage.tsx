import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiActivity, FiAlertCircle, FiArrowRight, FiBarChart2,
  FiCalendar, FiCheckCircle, FiCpu, FiFlag, FiRefreshCw,
  FiShield, FiTrendingUp, FiZap,
} from 'react-icons/fi';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useProactiveInsights } from '../../hooks/useProactiveInsights';
import { useFinancialAnomalies } from '../../hooks/useFinancialAnomalies';
import { calculateNetWorth } from '../../utils/calculations';
import { computeSpendingVelocity } from '../../utils/spendingVelocity';
import { computeFinancialDNA } from '../../utils/financialDNA';
import { generateMonthlyPlan } from '../../utils/aiFinancialPlan';
import { computeMilestones } from '../../utils/milestones';
import { formatINR, formatNumber } from '../../utils/format';

const CATEGORY_COLORS: Record<string, string> = {
  essential:  'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
  investment: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  goal:       'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  emergency:  'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
  debt:       'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  flexible:   'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
};

function HealthRing({ score }: { score: number }) {
  const r = 28; const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className='relative flex h-16 w-16 items-center justify-center shrink-0'>
      <svg className='absolute inset-0 -rotate-90' viewBox='0 0 64 64'>
        <circle cx='32' cy='32' r={r} fill='none' strokeWidth='5' stroke='currentColor' className='text-slate-200 dark:text-slate-700' />
        <circle cx='32' cy='32' r={r} fill='none' strokeWidth='5' stroke={color}
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap='round' />
      </svg>
      <span className='text-sm font-black' style={{ color }}>{score}</span>
    </div>
  );
}

function calcHealthScore(investments: any[], liabilities: any[], cashflows: any[], essentials: any): number {
  const { totalAssets, totalLiabilities } = calculateNetWorth(investments, liabilities);
  const debtRatio    = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
  const debtScore    = Math.max(0, 30 - Math.round(debtRatio * 60));
  const target       = essentials?.emergencyFundTarget  ?? 0;
  const current      = essentials?.emergencyFundCurrent ?? 0;
  const expE         = cashflows.filter((e: any) => e.type === 'expense');
  const months       = new Set(expE.map((e: any) => e.date.slice(0, 7))).size || 1;
  const avgExp       = expE.reduce((a: number, e: any) => a + e.amount, 0) / months;
  const runway       = avgExp > 0 ? current / avgExp : 0;
  const emergScore   = target > 0 ? Math.min(20, Math.round((current / target) * 20)) : Math.min(20, Math.round((runway / 6) * 20));
  const incE         = cashflows.filter((e: any) => e.type === 'income');
  const incM         = new Set(incE.map((e: any) => e.date.slice(0, 7))).size || 1;
  const avgInc       = incE.reduce((a: number, e: any) => a + e.amount, 0) / incM;
  const surplus      = avgInc - (expE.reduce((a: number, e: any) => a + e.amount, 0) / months);
  const savingsRate  = avgInc > 0 ? (surplus / avgInc) * 100 : 0;
  const savingsScore = Math.min(25, Math.max(0, Math.round(savingsRate * 0.6)));
  const assetTypes   = new Set(investments.map((i: any) => i.type)).size;
  const divScore     = Math.min(25, assetTypes * 5);
  return Math.min(100, debtScore + emergScore + savingsScore + divScore);
}

export default function PersonalCFOPage() {
  const nav = useNavigate();
  const {
    investments, liabilities, cashflows, goals, goalContributions,
    accounts, essentials, trackedPayments, networthSnapshots, sipPlans,
  } = usePortfolioStore();

  const proactive  = useProactiveInsights();
  const anomalies  = useFinancialAnomalies();
  const [planOpen, setPlanOpen] = useState(false);

  const { netWorth, totalAssets, totalLiabilities } = useMemo(
    () => calculateNetWorth(investments, liabilities), [investments, liabilities],
  );
  const healthScore = useMemo(
    () => calcHealthScore(investments, liabilities, cashflows, essentials),
    [investments, liabilities, cashflows, essentials],
  );
  const velocity = useMemo(() => computeSpendingVelocity(cashflows), [cashflows]);
  const plan     = useMemo(
    () => generateMonthlyPlan(cashflows, investments, liabilities, goals, goalContributions, essentials, accounts),
    [cashflows, investments, liabilities, goals, goalContributions, essentials, accounts],
  );
  const dna = useMemo(
    () => computeFinancialDNA(cashflows, investments, liabilities, essentials),
    [cashflows, investments, liabilities, essentials],
  );
  const milestones = useMemo(
    () => computeMilestones(investments, liabilities, cashflows, essentials, accounts),
    [investments, liabilities, cashflows, essentials, accounts],
  );

  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const income    = cashflows.filter(e => e.type === 'income' && e.date.startsWith(thisMonth)).reduce((a, e) => a + e.amount, 0);
  const expense   = cashflows.filter(e => e.type === 'expense' && e.date.startsWith(thisMonth)).reduce((a, e) => a + e.amount, 0);
  const prevSnap  = [...networthSnapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const nwDelta   = prevSnap ? netWorth - prevSnap.netWorth : 0;
  const overdue   = trackedPayments.filter(p => p.status === 'pending' && p.dueDate < now.toISOString().slice(0, 10));
  const unlockedMilestones = milestones.filter(m => m.unlocked).length;
  void sipPlans;

  const activeGoals = goals.filter(g => !g.status || g.status === 'active');
  const goalsPct    = useMemo(() => {
    const funded = activeGoals.reduce((a, g) => {
      const c = goalContributions.filter(c => c.goalId === g.id).reduce((s, c) => s + c.amount, 0);
      return a + g.currentAmount + c;
    }, 0);
    const target = activeGoals.reduce((a, g) => a + g.targetAmount, 0);
    return target > 0 ? Math.min(100, (funded / target) * 100) : 0;
  }, [activeGoals, goalContributions]);

  const allAlerts = [...anomalies, ...proactive].slice(0, 4);

  return (
    <div className='flex flex-col gap-5 pb-12'>
      {/* Header */}
      <header className='rounded-2xl bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-900 dark:to-slate-800 p-6 border border-slate-600/30 text-white'>
        <div className='flex items-center justify-between gap-4'>
          <div>
            <p className='text-sm text-slate-300 font-semibold'>Personal CFO Dashboard</p>
            <h1 className='text-2xl font-black mt-0.5'>
              {now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h1>
          </div>
          <button type='button' onClick={() => nav('/ai-agent')}
            className='flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-bold text-white transition-colors'>
            <FiCpu className='h-3.5 w-3.5' /> Ask AI
          </button>
        </div>
      </header>

      {/* Health + Net Worth row */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        {/* Health Score */}
        <div className='col-span-2 sm:col-span-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 flex items-center gap-3'>
          <HealthRing score={healthScore} />
          <div>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400'>Health</p>
            <p className={`text-sm font-bold ${healthScore >= 75 ? 'text-emerald-600 dark:text-emerald-400' : healthScore >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {healthScore >= 75 ? 'Excellent' : healthScore >= 50 ? 'Good' : 'Needs Work'}
            </p>
          </div>
        </div>

        {[
          { label: 'Net Worth',    value: formatINR(netWorth),   sub: nwDelta !== 0 ? `${nwDelta >= 0 ? '+' : ''}${formatINR(nwDelta)} vs last snap` : 'Total wealth',    color: netWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500' },
          { label: 'Income (MTD)', value: formatINR(income),     sub: `Expenses: ${formatINR(expense)}`,  color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Milestones',   value: `${unlockedMilestones}/${milestones.length}`, sub: 'achievements', color: 'text-amber-600 dark:text-amber-400' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
            <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1'>{label}</p>
            <p className={`text-base font-black tabular-nums ${color}`}>{value}</p>
            <p className='text-[10px] text-slate-400 mt-0.5'>{sub}</p>
          </div>
        ))}
      </div>

      {/* Main 3-column grid */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-5'>

        {/* Left: Plan of the month */}
        <div className='lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden'>
          <div className='flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800'>
            <p className='text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2'>
              <FiBarChart2 className='h-4 w-4 text-violet-500' /> Plan: {plan.month}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${plan.status.includes('Healthy') ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : plan.status.includes('Tight') ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
                {plan.status}
              </span>
            </p>
            <button type='button' onClick={() => setPlanOpen(p => !p)} className='text-[10px] font-bold text-violet-500 hover:underline'>
              {planOpen ? 'Collapse' : 'View all'}
            </button>
          </div>
          <div className='divide-y divide-slate-50 dark:divide-slate-800/60'>
            {plan.items.slice(0, planOpen ? undefined : 4).map((item, i) => (
              <div key={i} className='flex items-center justify-between px-5 py-2.5'>
                <div className='flex items-center gap-2.5 min-w-0'>
                  <span className='text-base shrink-0'>{item.emoji}</span>
                  <div className='min-w-0'>
                    <p className='text-xs font-semibold text-slate-800 dark:text-slate-200 truncate'>{item.label}</p>
                    {item.note && <p className='text-[10px] text-slate-400 truncate'>{item.note}</p>}
                  </div>
                </div>
                <div className='flex items-center gap-2 shrink-0'>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[item.category]}`}>{formatNumber(item.pct, 0)}%</span>
                  <span className='text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums'>{formatINR(item.amount)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className='px-5 py-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800'>
            <p className='text-[11px] text-slate-600 dark:text-slate-400'>
              💡 <strong>Top action:</strong> {plan.topRecommendation}
            </p>
          </div>
        </div>

        {/* Right: Alerts + DNA snippet */}
        <div className='flex flex-col gap-3'>
          {/* Alerts */}
          <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden'>
            <div className='px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2'>
              <FiAlertCircle className='h-3.5 w-3.5 text-amber-500' />
              <p className='text-xs font-bold text-slate-700 dark:text-slate-200'>Alerts ({allAlerts.length})</p>
            </div>
            {allAlerts.length === 0 ? (
              <div className='px-4 py-4 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400'>
                <FiCheckCircle className='h-4 w-4' /> All clear — no alerts!
              </div>
            ) : (
              <div className='divide-y divide-slate-50 dark:divide-slate-800/60'>
                {allAlerts.slice(0, 4).map((a, i) => (
                  <button key={i} type='button' onClick={() => nav('/ai-agent')}
                    className='w-full flex items-start gap-2 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left'>
                    <span className='text-base shrink-0'>{a.emoji}</span>
                    <div className='min-w-0'>
                      <p className='text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate'>{a.title}</p>
                      <p className='text-[10px] text-slate-400 truncate'>{a.body}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Overdue payments */}
          {overdue.length > 0 && (
            <button type='button' onClick={() => nav('/payments')}
              className='flex items-center gap-3 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-left hover:bg-rose-100 transition-colors'>
              <span className='text-lg'>⚠️</span>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-bold text-rose-700 dark:text-rose-400'>{overdue.length} overdue payment{overdue.length > 1 ? 's' : ''}</p>
                <p className='text-[11px] text-rose-600 dark:text-rose-500 truncate'>{overdue.map(p => p.title).slice(0, 2).join(', ')}</p>
              </div>
              <FiArrowRight className='h-4 w-4 text-rose-400 shrink-0' />
            </button>
          )}

          {/* DNA archetype */}
          <div className='rounded-2xl border border-violet-200 dark:border-violet-700/40 bg-violet-50 dark:bg-violet-900/10 px-4 py-3 flex items-center gap-3'>
            <span className='text-2xl'>{dna.overallEmoji}</span>
            <div className='min-w-0 flex-1'>
              <p className='text-[10px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400'>Your Archetype</p>
              <p className='text-sm font-bold text-slate-800 dark:text-slate-200 truncate'>{dna.archetype}</p>
            </div>
            <button type='button' onClick={() => nav('/dna')} className='text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline shrink-0 flex items-center gap-0.5'>
              View DNA <FiArrowRight className='h-3 w-3' />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Spending velocity + Goals + Quick links */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        {/* Spending velocity */}
        <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-3'><FiActivity className='h-3.5 w-3.5 text-emerald-500' /> Spending Velocity</p>
          <p className='text-lg font-black text-slate-900 dark:text-slate-100 tabular-nums'>{formatINR(velocity.spentSoFar)}</p>
          <p className='text-[10px] text-slate-400 mt-0.5'>{velocity.daysElapsed}d elapsed · {formatINR(velocity.dailyBurnRate)}/day</p>
          <div className='mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
            <div className={`h-full rounded-full transition-all ${velocity.verdict === 'critical' ? 'bg-rose-500' : velocity.verdict === 'over' ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, velocity.budgetUsedPct)}%` }} />
          </div>
          <p className='text-[10px] text-slate-400 mt-1'>{formatNumber(velocity.budgetUsedPct, 0)}% of avg · {velocity.daysRemaining}d left</p>
        </div>

        {/* Goals */}
        <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-3'><FiFlag className='h-3.5 w-3.5 text-amber-500' /> Goals ({activeGoals.length})</p>
          {activeGoals.length === 0 ? (
            <p className='text-xs text-slate-400'>No active goals. <button type='button' onClick={() => nav('/goals')} className='text-violet-500 hover:underline'>Add one</button></p>
          ) : (
            <>
              <div className='h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-1'>
                <div className='h-full rounded-full bg-amber-500 transition-all' style={{ width: `${goalsPct}%` }} />
              </div>
              <p className='text-[10px] text-slate-400'>{formatNumber(goalsPct, 0)}% funded overall</p>
              {activeGoals.slice(0, 2).map(g => (
                <p key={g.id} className='text-[11px] text-slate-600 dark:text-slate-400 mt-1 truncate'>🎯 {g.name}</p>
              ))}
            </>
          )}
        </div>

        {/* Quick links */}
        <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-3'><FiZap className='h-3.5 w-3.5 text-violet-500' /> Quick Access</p>
          <div className='grid grid-cols-2 gap-1.5'>
            {[
              { label: 'DNA', path: '/dna', emoji: '🧬' },
              { label: 'Milestones', path: '/milestones', emoji: '🏆' },
              { label: 'Forecast', path: '/forecast', emoji: '📈' },
              { label: 'Simulator', path: '/simulator', emoji: '🧮' },
              { label: 'Insights', path: '/insights', emoji: '💡' },
              { label: 'Budget', path: '/budget', emoji: '🎯' },
            ].map(({ label, path, emoji }) => (
              <button key={path} type='button' onClick={() => nav(path)}
                className='flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-700/60 px-2.5 py-2 text-left transition-colors'>
                <span className='text-sm'>{emoji}</span>
                <span className='text-[11px] font-semibold text-slate-600 dark:text-slate-300'>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Assets/Liabilities bar */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
        <div className='flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2'>
          <span className='flex items-center gap-1'><FiTrendingUp className='h-3 w-3 text-emerald-500' /> Assets {formatINR(totalAssets)}</span>
          <span className='flex items-center gap-1'><FiShield className='h-3 w-3 text-rose-500' /> Liabilities {formatINR(totalLiabilities)}</span>
        </div>
        <div className='h-3 rounded-full overflow-hidden flex'>
          <div className='bg-emerald-500 transition-all duration-700'
            style={{ width: `${totalAssets + totalLiabilities > 0 ? (totalAssets / (totalAssets + totalLiabilities)) * 100 : 50}%` }} />
          <div className='bg-rose-400 flex-1' />
        </div>
        <div className='flex justify-between text-[10px] text-slate-400 mt-1'>
          <span>{formatNumber(totalAssets + totalLiabilities > 0 ? (totalAssets / (totalAssets + totalLiabilities)) * 100 : 0, 0)}% assets</span>
          <span>Net Worth: <strong className={netWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>{formatINR(netWorth)}</strong></span>
        </div>
      </div>

      <p className='text-[10px] text-center text-slate-400 dark:text-slate-600'>
        Personal CFO · All calculations from your Firestore data · <button type='button' onClick={() => nav('/settings')} className='hover:underline'>Settings</button>
      </p>

      {/* Suppress unused */}
      {void FiCalendar}{void FiRefreshCw}
    </div>
  );
}
