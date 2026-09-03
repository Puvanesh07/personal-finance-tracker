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
import { useProactiveInsights } from '../../hooks/useProactiveInsights';
import { useFinancialAnomalies } from '../../hooks/useFinancialAnomalies';
import { calculateNetWorth } from '../../utils/calculations';
import { computeForecast } from '../../utils/cashflowForecast';
import { formatINR, formatNumber } from '../../utils/format';
import { auth } from '../../services/firebase';

// ─── Search Tab ───────────────────────────────────────────────────────────────
export function SearchTab() {
  const [query, setQuery] = useState('');
  const nav = useNavigate();
  const { cashflows, trackedPayments, investments, goals, insurancePolicies, liabilities } = usePortfolioStore();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    type R = { emoji: string; title: string; sub: string; amount?: number; link: string; type: string };
    const items: R[] = [];
    cashflows.filter(e => e.category.toLowerCase().includes(q) || (e.notes ?? '').toLowerCase().includes(q)).slice(0, 5).forEach(e => items.push({ emoji: e.type === 'income' ? '💰' : '💸', title: e.category, sub: e.date, amount: e.amount, link: '/cashflow', type: 'Cashflow' }));
    trackedPayments.filter(p => p.title.toLowerCase().includes(q)).slice(0, 3).forEach(p => items.push({ emoji: '💳', title: p.title, sub: `Due ${p.dueDate}`, amount: p.amount, link: '/payments', type: 'Payment' }));
    investments.filter(i => i.name.toLowerCase().includes(q) || (i.symbol ?? '').toLowerCase().includes(q)).slice(0, 3).forEach(i => items.push({ emoji: '📈', title: i.name, sub: i.type.replace('_', ' '), link: '/investments', type: 'Investment' }));
    goals.filter(g => g.name.toLowerCase().includes(q)).slice(0, 3).forEach(g => items.push({ emoji: '🎯', title: g.name, sub: `Target ${formatINR(g.targetAmount)}`, link: '/goals', type: 'Goal' }));
    liabilities.filter(l => l.name.toLowerCase().includes(q)).slice(0, 2).forEach(l => items.push({ emoji: '🏦', title: l.name, sub: `Outstanding ${formatINR(l.outstanding ?? 0)}`, link: '/liabilities', type: 'Liability' }));
    insurancePolicies.filter(p => p.policyName.toLowerCase().includes(q) || p.provider.toLowerCase().includes(q)).slice(0, 2).forEach(p => items.push({ emoji: '🛡️', title: p.policyName, sub: p.provider, link: '/insurance', type: 'Insurance' }));
    return items.slice(0, 10);
  }, [query, cashflows, trackedPayments, investments, goals, liabilities, insurancePolicies]);

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-violet-500/30 transition-all'>
        <FiSearch className='h-4 w-4 text-slate-400 ml-2 shrink-0' />
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder='Search cashflows, payments, investments, goals…' className='flex-1 bg-transparent px-2 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500' />
        {query && <button type='button' onClick={() => setQuery('')} className='p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'><FiX className='h-4 w-4' /></button>}
      </div>
      {query.length >= 2 ? (
        <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden'>
          {results.length === 0
            ? <div className='px-4 py-8 text-center text-sm text-slate-400'>No results for "{query}"</div>
            : <div className='divide-y divide-slate-100 dark:divide-slate-800'>
                {results.map((r, i) => (
                  <button key={i} type='button' onClick={() => nav(r.link)} className='w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-left'>
                    <div className='flex items-center gap-3 min-w-0'>
                      <span className='text-lg shrink-0'>{r.emoji}</span>
                      <div className='min-w-0'>
                        <p className='text-sm font-semibold text-slate-800 dark:text-slate-200 truncate'>{r.title}</p>
                        <p className='text-[10px] text-slate-400 dark:text-slate-500'>{r.type} · {r.sub}</p>
                      </div>
                    </div>
                    <div className='flex items-center gap-2 shrink-0'>
                      {r.amount !== undefined && <span className='text-sm font-bold tabular-nums text-slate-700 dark:text-slate-300'>{formatINR(r.amount)}</span>}
                      <FiChevronRight className='h-4 w-4 text-slate-400' />
                    </div>
                  </button>
                ))}
              </div>
          }
        </div>
      ) : <div className='text-center py-8 text-sm text-slate-400 dark:text-slate-500'>Type 2+ characters to search across all records</div>}
    </div>
  );
}

// ─── Today Brief Tab ──────────────────────────────────────────────────────────
export function BriefTab({ onAsk }: { onAsk: (q: string) => void }) {
  const nav = useNavigate();
  const { cashflows, trackedPayments, accounts, investments, liabilities, goals, goalContributions, sipPlans } = usePortfolioStore();
  const anomalies = useFinancialAnomalies();
  const proactive = useProactiveInsights();

  const now       = new Date();
  const today     = now.toISOString().slice(0, 10);
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthCF   = cashflows.filter(e => e.date.startsWith(thisMonth));
  const income    = monthCF.filter(e => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const expense   = monthCF.filter(e => e.type === 'expense').reduce((a, e) => a + e.amount, 0);
  const savRate   = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  const { netWorth } = useMemo(() => calculateNetWorth(investments, liabilities), [investments, liabilities]);
  const bankBal   = accounts.filter(a => a.type === 'bank').reduce((s, a) => s + (a.balance ?? 0), 0);
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
    <div className='flex flex-col gap-4'>
      {/* Greeting */}
      <div className='rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent border border-violet-500/20 px-5 py-4'>
        <p className='text-lg font-bold text-slate-900 dark:text-white'>{greeting}{name ? `, ${name}` : ''} 👋</p>
        <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>{now.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Key numbers */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
        {[
          { emoji: '🏦', label: 'Available Cash',  value: formatINR(forecast.availableAfterObligations), sub: `${formatINR(bankBal)} in bank`, color: 'text-emerald-600 dark:text-emerald-400' },
          { emoji: '💰', label: 'Income (MTD)',     value: formatINR(income),   sub: now.toLocaleDateString('en-IN', { month: 'short' }), color: 'text-emerald-600 dark:text-emerald-400' },
          { emoji: '💸', label: 'Expenses (MTD)',   value: formatINR(expense),  sub: `${savRate}% savings rate`, color: 'text-slate-900 dark:text-slate-100' },
          { emoji: '📊', label: 'Net Worth',        value: formatINR(netWorth), sub: 'total', color: netWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500' },
        ].map(({ emoji, label, value, sub, color }) => (
          <div key={label} className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-3'>
            <div className='flex items-center gap-1.5 mb-1'><span className='text-base'>{emoji}</span><p className='text-[9px] font-bold uppercase tracking-wider text-slate-400'>{label}</p></div>
            <p className={`text-base font-black tabular-nums ${color}`}>{value}</p>
            <p className='text-[9px] text-slate-400 mt-0.5'>{sub}</p>
          </div>
        ))}
      </div>

      {/* Overdue / due today */}
      {(overdue.length > 0 || dueToday.length > 0) && (
        <div className='space-y-2'>
          {overdue.length > 0 && (
            <button type='button' onClick={() => nav('/payments')} className='w-full flex items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-left hover:bg-rose-100 transition-colors'>
              <span className='text-lg'>⚠️</span>
              <div className='flex-1'><p className='text-sm font-bold text-rose-700 dark:text-rose-400'>{overdue.length} overdue payment{overdue.length > 1 ? 's' : ''}</p><p className='text-[11px] text-rose-600 dark:text-rose-500'>{formatINR(overdue.reduce((a, p) => a + p.amount, 0))} total</p></div>
              <FiChevronRight className='h-4 w-4 text-rose-400' />
            </button>
          )}
          {dueToday.map(p => (
            <button key={p.id} type='button' onClick={() => nav('/payments')} className='w-full flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-left hover:bg-amber-100 transition-colors'>
              <span className='text-lg'>🔔</span>
              <div className='flex-1'><p className='text-sm font-bold text-amber-700 dark:text-amber-400'>{p.title} due today</p><p className='text-[11px] text-amber-600 dark:text-amber-500'>{formatINR(p.amount)}</p></div>
              <FiChevronRight className='h-4 w-4 text-amber-400' />
            </button>
          ))}
        </div>
      )}

      {/* Anomaly alerts */}
      {anomalies.length > 0 && (
        <div className='space-y-2'>
          <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500'>Financial Alerts</p>
          {anomalies.map(a => (
            <button key={a.id} type='button' onClick={() => onAsk(a.question)} className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left hover:-translate-y-0.5 hover:shadow-sm transition-all ${alertCls[a.severity]}`}>
              <span className='text-lg shrink-0 mt-0.5'>{a.emoji}</span>
              <div className='min-w-0 flex-1'><p className='text-xs font-bold'>{a.title}</p><p className='text-[10px] opacity-80 mt-0.5 truncate'>{a.body}</p></div>
            </button>
          ))}
        </div>
      )}

      {/* Proactive insights fallback */}
      {proactive.length > 0 && anomalies.length === 0 && (
        <div className='space-y-2'>
          <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500'>Needs Attention</p>
          {proactive.slice(0, 3).map(ins => (
            <button key={ins.id} type='button' onClick={() => onAsk(ins.question)} className='w-full flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors'>
              <span className='text-lg shrink-0'>{ins.emoji}</span>
              <div className='min-w-0 flex-1'><p className='text-xs font-bold text-slate-800 dark:text-slate-200'>{ins.title}</p><p className='text-[10px] text-slate-400 mt-0.5 truncate'>{ins.body}</p></div>
            </button>
          ))}
        </div>
      )}

      {/* 7-day forecast strip */}
      <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden'>
        <div className='flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800'>
          <p className='text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5'><FiCalendar className='h-3.5 w-3.5 text-emerald-500' />Next 7 days</p>
          <button type='button' onClick={() => nav('/forecast')} className='text-[10px] font-bold text-violet-500 hover:underline flex items-center gap-0.5'>Full forecast <FiChevronRight className='h-3 w-3' /></button>
        </div>
        <div className='grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800'>
          {[
            { label: 'Expected In',  value: formatINR(forecast.forecast7.totalIn),   color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Expected Out', value: formatINR(forecast.forecast7.totalOut),  color: 'text-rose-600 dark:text-rose-400' },
            { label: 'Net',          value: formatINR(Math.abs(forecast.forecast7.netFlow)), color: forecast.forecast7.netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className='bg-white dark:bg-slate-900/60 px-3 py-2 text-center'>
              <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5'>{label}</p>
              <p className={`text-sm font-black tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      {recent.length > 0 && (
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden'>
          <div className='flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800'>
            <p className='text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5'><FiActivity className='h-3.5 w-3.5 text-violet-500' />Recent Activity</p>
            <button type='button' onClick={() => nav('/cashflow')} className='text-[10px] font-bold text-violet-500 hover:underline flex items-center gap-0.5'>All <FiChevronRight className='h-3 w-3' /></button>
          </div>
          <div className='divide-y divide-slate-50 dark:divide-slate-800/60'>
            {recent.map(e => (
              <div key={e.id} className='flex items-center justify-between px-4 py-2.5'>
                <div className='flex items-center gap-2.5 min-w-0'>
                  <span className='text-base shrink-0'>{e.type === 'income' ? '💰' : '💸'}</span>
                  <div className='min-w-0'><p className='text-xs font-semibold text-slate-700 dark:text-slate-300 truncate'>{e.category}</p><p className='text-[9px] text-slate-400'>{e.date}{e.notes ? ` · ${e.notes}` : ''}</p></div>
                </div>
                <span className={`text-xs font-bold tabular-nums shrink-0 ${e.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{e.type === 'income' ? '+' : '-'}{formatINR(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals */}
      {goals.filter(g => !g.status || g.status === 'active').length > 0 && (
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden'>
          <div className='flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800'>
            <p className='text-xs font-bold text-slate-700 dark:text-slate-200'>🎯 Goals</p>
            <button type='button' onClick={() => nav('/goals')} className='text-[10px] font-bold text-violet-500 hover:underline flex items-center gap-0.5'>View all <FiChevronRight className='h-3 w-3' /></button>
          </div>
          {goals.filter(g => !g.status || g.status === 'active').slice(0, 3).map(g => {
            const contrib = goalContributions.filter(c => c.goalId === g.id).reduce((a, c) => a + c.amount, 0);
            const pct = g.targetAmount > 0 ? Math.min(100, ((g.currentAmount + contrib) / g.targetAmount) * 100) : 0;
            return (
              <div key={g.id} className='px-4 py-2.5 border-b border-slate-50 dark:border-slate-800/60 last:border-0'>
                <div className='flex justify-between text-xs mb-1.5'><span className='font-semibold text-slate-700 dark:text-slate-300 truncate'>{g.name}</span><span className='text-slate-500 dark:text-slate-400 shrink-0 ml-2'>{formatNumber(pct, 0)}%</span></div>
                <div className='h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'><div className='h-full rounded-full bg-amber-500 transition-all' style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
