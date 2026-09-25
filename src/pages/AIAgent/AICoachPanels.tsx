/**
 * src/pages/AIAgent/AICoachPanels.tsx
 * Sub-panels for the rewamped AI Coach page.
 * Split from AIAgentPage.tsx to keep individual files manageable.
 */
import { useMemo, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiActivity, FiCalendar, FiChevronRight, FiSearch, FiX,
} from 'react-icons/fi';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useShallow } from 'zustand/react/shallow';
import { useProactiveInsights } from '../../hooks/useProactiveInsights';
import { useFinancialAnomalies } from '../../hooks/useFinancialAnomalies';
import { calculateNetWorth, getLiveBankTotal } from '../../utils/calculations';
import { computeForecast } from '../../utils/cashflowForecast';
import { formatINR, formatNumber } from '../../utils/format';
import { auth } from '../../services/firebase';

// ─── Search Tab ───────────────────────────────────────────────────────────────
export function SearchTab() {
  const [query, setQuery] = useState('');
  const nav = useNavigate();
  const { cashflows, trackedPayments, investments, goals, insurancePolicies, liabilities } = usePortfolioStore(
    useShallow((s) => ({
      cashflows: s.cashflows,
      trackedPayments: s.trackedPayments,
      investments: s.investments,
      goals: s.goals,
      insurancePolicies: s.insurancePolicies,
      liabilities: s.liabilities,
    })),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    type R = { emoji: string; title: string; sub: string; amount?: number; link: string; type: string };
    const items: R[] = [];
    cashflows.filter(e => e.category.toLowerCase().includes(q) || (e.notes ?? '').toLowerCase().includes(q)).slice(0, 5).forEach(e => items.push({ emoji: e.type === 'income' ? '💰' : '💸', title: e.category, sub: e.date, amount: e.amount, link: '/cashflow', type: 'Cashflow' }));
    trackedPayments.filter(p => p.title.toLowerCase().includes(q)).slice(0, 3).forEach(p => items.push({ emoji: '💳', title: p.title, sub: `Due ${p.dueDate}`, amount: p.amount, link: '/payments', type: 'Payment' }));
    investments.filter(i => i.name.toLowerCase().includes(q) || (i.symbol ?? '').toLowerCase().includes(q)).slice(0, 3).forEach(i => items.push({ emoji: '📈', title: i.name, sub: i.type.replace('_', ' '), link: '/wealth?tab=assets', type: 'Investment' }));
    goals.filter(g => g.name.toLowerCase().includes(q)).slice(0, 3).forEach(g => items.push({ emoji: '🎯', title: g.name, sub: `Target ${formatINR(g.targetAmount)}`, link: '/essentials?tab=goals', type: 'Goal' }));
    liabilities.filter(l => l.name.toLowerCase().includes(q)).slice(0, 2).forEach(l => items.push({ emoji: '🏦', title: l.name, sub: `Outstanding ${formatINR(l.outstanding ?? 0)}`, link: '/wealth?tab=liabilities', type: 'Liability' }));
    insurancePolicies.filter(p => p.policyName.toLowerCase().includes(q) || p.provider.toLowerCase().includes(q)).slice(0, 2).forEach(p => items.push({ emoji: '🛡️', title: p.policyName, sub: p.provider, link: '/insurance', type: 'Insurance' }));
    return items.slice(0, 10);
  }, [query, cashflows, trackedPayments, investments, goals, liabilities, insurancePolicies]);

  return (
    <div className='flex flex-col gap-2 sm:gap-3'>
      <div className='flex items-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 p-1 shadow-sm focus-within:ring-2 focus-within:ring-violet-500/30 transition-all sm:gap-2 sm:rounded-2xl sm:p-1.5'>
        <FiSearch className='h-4 w-4 shrink-0 pl-1.5 text-slate-400 sm:ml-2 sm:pl-0' />
        {/* 16px on phones — iOS zooms the whole page for smaller inputs, which
            throws the pinned layout around the keyboard out of place. */}
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} type='search'
          data-field enterKeyHint='search' autoCapitalize='sentences' autoComplete='off' aria-label='Search your records'
          placeholder='Search cashflows, payments, investments, goals…'
          className='flex-1 min-w-0 bg-transparent px-1.5 py-1.5 text-[14px] text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 sm:px-2 sm:py-2 sm:text-sm' />
        {query && <button type='button' onClick={() => setQuery('')} aria-label='Clear search' className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200'><FiX className='h-4 w-4' /></button>}
      </div>
      {query.length >= 2 ? (
        <div className='overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 sm:rounded-2xl'>
          {results.length === 0
            ? <div className='px-3 py-6 text-center text-[13px] text-slate-400 sm:px-4 sm:py-8 sm:text-sm'>No results for "{query}"</div>
            : <div className='divide-y divide-slate-100 dark:divide-slate-800'>
                {results.map((r, i) => (
                  <button key={i} type='button' onClick={() => nav(r.link)} className='w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors sm:gap-3 sm:px-4 sm:py-3'>
                    <div className='flex min-w-0 items-center gap-2 sm:gap-3'>
                      <span className='text-base shrink-0 sm:text-lg'>{r.emoji}</span>
                      <div className='min-w-0'>
                        <p className='truncate text-[13px] font-semibold text-slate-800 dark:text-slate-200 sm:text-sm'>{r.title}</p>
                        <p className='truncate text-[10px] text-slate-400 dark:text-slate-500'>{r.type} · {r.sub}</p>
                      </div>
                    </div>
                    <div className='flex shrink-0 items-center gap-1.5 sm:gap-2'>
                      {r.amount !== undefined && <span className='text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300 sm:text-sm'>{formatINR(r.amount)}</span>}
                      <FiChevronRight className='h-4 w-4 text-slate-400' />
                    </div>
                  </button>
                ))}
              </div>
          }
        </div>
      ) : <div className='py-6 text-center text-[13px] text-slate-400 dark:text-slate-500 sm:py-8 sm:text-sm'>Type 2+ characters to search across all records</div>}
    </div>
  );
}

// ─── Today Brief Tab ──────────────────────────────────────────────────────────
export function BriefTab({ onAsk }: { onAsk: (q: string) => void }) {
  const nav = useNavigate();
  const { cashflows, trackedPayments, accounts, investments, liabilities, pendingPayments, goals, goalContributions, sipPlans } = usePortfolioStore(
    useShallow((s) => ({
      cashflows: s.cashflows,
      trackedPayments: s.trackedPayments,
      accounts: s.accounts,
      investments: s.investments,
      liabilities: s.liabilities,
      pendingPayments: s.pendingPayments,
      goals: s.goals,
      goalContributions: s.goalContributions,
      sipPlans: s.sipPlans,
    })),
  );
  const anomalies = useFinancialAnomalies();
  const proactive = useProactiveInsights();

  const now       = new Date();
  const today     = now.toISOString().slice(0, 10);
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthCF   = cashflows.filter(e => e.date.startsWith(thisMonth));
  const income    = monthCF.filter(e => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const expense   = monthCF.filter(e => e.type === 'expense').reduce((a, e) => a + e.amount, 0);
  const savRate   = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  const { netWorth } = useMemo(() => calculateNetWorth(investments, liabilities, pendingPayments, accounts, cashflows), [investments, liabilities, pendingPayments, accounts, cashflows]);
  const bankBal   = getLiveBankTotal(accounts, cashflows);
  const forecast  = useMemo(() => computeForecast(accounts, trackedPayments, liabilities, cashflows, sipPlans), [accounts, trackedPayments, liabilities, cashflows, sipPlans]);
  const overdue   = trackedPayments.filter(p => p.status === 'pending' && p.dueDate < today);
  const dueToday  = trackedPayments.filter(p => p.status === 'pending' && p.dueDate === today);
  const recent    = useMemo(() => [...cashflows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6), [cashflows]);
  const h         = now.getHours();
  const greeting  = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const name      = auth.currentUser?.displayName?.split(' ')[0] ?? '';

  const alertCls: Record<string, string> = {
    critical: 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400',
    warning:  'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    info:     'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  };

  return (
    <div className='flex flex-col gap-2.5 sm:gap-4'>
      {/* Greeting */}
      <div className='rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent px-3.5 py-2.5 sm:rounded-2xl sm:px-5 sm:py-4'>
        <p className='truncate text-[15px] font-bold text-slate-900 dark:text-white sm:text-lg'>{greeting}{name ? `, ${name}` : ''} 👋</p>
        <p className='mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 sm:text-sm'>{now.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Key numbers */}
      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2'>
        {[
          { emoji: '🏦', label: 'Available Cash',  value: formatINR(forecast.availableAfterObligations), sub: `${formatINR(bankBal)} in bank`, color: 'text-emerald-600 dark:text-emerald-400' },
          { emoji: '💰', label: 'Income (MTD)',     value: formatINR(income),   sub: now.toLocaleDateString('en-IN', { month: 'short' }), color: 'text-emerald-600 dark:text-emerald-400' },
          { emoji: '💸', label: 'Expenses (MTD)',   value: formatINR(expense),  sub: `${savRate}% savings rate`, color: 'text-slate-900 dark:text-slate-100' },
          { emoji: '📊', label: 'Net Worth',        value: formatINR(netWorth), sub: 'total', color: netWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500' },
        ].map(({ emoji, label, value, sub, color }) => (
          <div key={label} className='min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-2.5 sm:p-3'>
            <div className='mb-1 flex min-w-0 items-center gap-1'><span className='text-[13px] shrink-0 sm:text-base'>{emoji}</span><p className='truncate text-[9px] font-bold uppercase tracking-wider text-slate-400'>{label}</p></div>
            <p className={`truncate text-[15px] font-black tabular-nums sm:text-base ${color}`}>{value}</p>
            <p className='mt-0.5 truncate text-[9px] text-slate-400'>{sub}</p>
          </div>
        ))}
      </div>

      {/* Overdue / due today */}
      {(overdue.length > 0 || dueToday.length > 0) && (
        <div className='space-y-2'>
          {overdue.length > 0 && (
            <button type='button' onClick={() => nav('/payments')} className='flex w-full items-center gap-2.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-3 py-2.5 text-left hover:bg-rose-100 transition-colors sm:gap-3 sm:px-4 sm:py-3'>
              <span className='text-base shrink-0 sm:text-lg'>⚠️</span>
              <div className='min-w-0 flex-1'><p className='truncate text-[13px] font-bold text-rose-700 dark:text-rose-400 sm:text-sm'>{overdue.length} overdue payment{overdue.length > 1 ? 's' : ''}</p><p className='text-[11px] text-rose-600 dark:text-rose-500'>{formatINR(overdue.reduce((a, p) => a + p.amount, 0))} total</p></div>
              <FiChevronRight className='h-4 w-4 shrink-0 text-rose-400' />
            </button>
          )}
          {dueToday.map(p => (
            <button key={p.id} type='button' onClick={() => nav('/payments')} className='flex w-full items-center gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-left hover:bg-amber-100 transition-colors sm:gap-3 sm:px-4 sm:py-3'>
              <span className='text-base shrink-0 sm:text-lg'>🔔</span>
              <div className='min-w-0 flex-1'><p className='truncate text-[13px] font-bold text-amber-700 dark:text-amber-400 sm:text-sm'>{p.title} due today</p><p className='text-[11px] text-amber-600 dark:text-amber-500'>{formatINR(p.amount)}</p></div>
              <FiChevronRight className='h-4 w-4 shrink-0 text-amber-400' />
            </button>
          ))}
        </div>
      )}

      {/* Anomaly alerts */}
      {anomalies.length > 0 && (
        <div className='space-y-2'>
          <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500'>Financial Alerts</p>
          {anomalies.map(a => (
            <button key={a.id} type='button' onClick={() => onAsk(a.question)} className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm sm:gap-3 sm:px-4 sm:py-3 ${alertCls[a.severity]}`}>
              <span className='text-base shrink-0 sm:text-lg'>{a.emoji}</span>
              <div className='min-w-0 flex-1'><p className='text-xs font-bold'>{a.title}</p><p className='mt-0.5 truncate text-[10px] opacity-80'>{a.body}</p></div>
            </button>
          ))}
        </div>
      )}

      {/* Proactive insights fallback */}
      {proactive.length > 0 && anomalies.length === 0 && (
        <div className='space-y-2'>
          <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500'>Needs Attention</p>
          {proactive.slice(0, 3).map(ins => (
            <button key={ins.id} type='button' onClick={() => onAsk(ins.question)} className='flex w-full items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors sm:gap-3 sm:px-4 sm:py-3'>
              <span className='text-base shrink-0 sm:text-lg'>{ins.emoji}</span>
              <div className='min-w-0 flex-1'><p className='text-xs font-bold text-slate-800 dark:text-slate-200'>{ins.title}</p><p className='mt-0.5 truncate text-[10px] text-slate-400'>{ins.body}</p></div>
            </button>
          ))}
        </div>
      )}

      {/* 7-day forecast strip */}
      <div className='overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40'>
        <div className='flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-3 py-2 sm:px-4 sm:py-2.5'>
          <p className='flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 sm:text-xs'><FiCalendar className='h-3.5 w-3.5 shrink-0 text-emerald-500' />Next 7 days</p>
          <button type='button' onClick={() => nav('/forecast')} className='flex shrink-0 items-center gap-0.5 py-1 text-[10px] font-bold text-violet-500 hover:underline'>Full forecast <FiChevronRight className='h-3 w-3' /></button>
        </div>
        <div className='grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800'>
          {[
            { label: 'Expected In',  value: formatINR(forecast.forecast7.totalIn),   color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Expected Out', value: formatINR(forecast.forecast7.totalOut),  color: 'text-rose-600 dark:text-rose-400' },
            { label: 'Net',          value: formatINR(Math.abs(forecast.forecast7.netFlow)), color: forecast.forecast7.netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className='min-w-0 bg-white dark:bg-slate-900/60 px-1.5 py-2 text-center sm:px-3'>
              <p className='mb-0.5 truncate text-[8px] font-bold uppercase tracking-wider text-slate-400 sm:text-[9px]'>{label}</p>
              <p className={`truncate text-[12px] font-black tabular-nums sm:text-sm ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      {recent.length > 0 && (
        <div className='overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40'>
          <div className='flex items-center justify-between gap-2 border-b border-slate-50 dark:border-slate-800/60 px-3 py-2 sm:px-4 sm:py-2.5'>
            <p className='flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 sm:text-xs'><FiActivity className='h-3.5 w-3.5 shrink-0 text-violet-500' />Recent Activity</p>
            <button type='button' onClick={() => nav('/cashflow')} className='flex shrink-0 items-center gap-0.5 py-1 text-[10px] font-bold text-violet-500 hover:underline'>All <FiChevronRight className='h-3 w-3' /></button>
          </div>
          <div className='divide-y divide-slate-50 dark:divide-slate-800/60'>
            {recent.map(e => (
              <div key={e.id} className='flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5'>
                <div className='flex min-w-0 items-center gap-2'>
                  <span className='text-[15px] shrink-0'>{e.type === 'income' ? '💰' : '💸'}</span>
                  <div className='min-w-0'><p className='truncate text-xs font-semibold text-slate-700 dark:text-slate-300'>{e.category}</p><p className='truncate text-[9px] text-slate-400'>{e.date}{e.notes ? ` · ${e.notes}` : ''}</p></div>
                </div>
                <span className={`shrink-0 text-[11px] font-bold tabular-nums sm:text-xs ${e.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{e.type === 'income' ? '+' : '-'}{formatINR(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals */}
      {goals.filter(g => !g.status || g.status === 'active').length > 0 && (
        <div className='overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40'>
          <div className='flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-3 py-2 sm:px-4 sm:py-2.5'>
            <p className='truncate text-[11px] font-bold text-slate-700 dark:text-slate-200 sm:text-xs'>🎯 Goals</p>
            <button type='button' onClick={() => nav('/essentials?tab=goals')} className='flex shrink-0 items-center gap-0.5 py-1 text-[10px] font-bold text-violet-500 hover:underline'>View all <FiChevronRight className='h-3 w-3' /></button>
          </div>
          {goals.filter(g => !g.status || g.status === 'active').slice(0, 3).map(g => {
            const contrib = goalContributions.filter(c => c.goalId === g.id).reduce((a, c) => a + c.amount, 0);
            const pct = g.targetAmount > 0 ? Math.min(100, ((g.currentAmount + contrib) / g.targetAmount) * 100) : 0;
            return (
              <div key={g.id} className='border-b border-slate-50 px-3 py-2.5 last:border-0 dark:border-slate-800/60 sm:px-4'>
                <div className='mb-1.5 flex items-baseline justify-between gap-2 text-xs'><span className='min-w-0 truncate font-semibold text-slate-700 dark:text-slate-300'>{g.name}</span><span className='shrink-0 text-slate-500 dark:text-slate-400'>{formatNumber(pct, 0)}%</span></div>
                <div className='h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'><div className='h-full rounded-full bg-amber-500 transition-all' style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
