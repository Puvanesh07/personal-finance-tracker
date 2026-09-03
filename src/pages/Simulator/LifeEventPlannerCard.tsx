/**
 * Life Event Planner — what happens financially if you plan a major life event.
 * Pure math, no Firestore writes.
 */
import { useState, useMemo } from 'react';
import { FiCalendar, FiAlertCircle } from 'react-icons/fi';
import { usePortfolioStore } from '../../store/portfolioStore';
import { calculateNetWorth } from '../../utils/calculations';
import { futureValue } from '../../utils/goalProbability';
import { formatINR } from '../../utils/format';

type EventId = 'wedding' | 'baby' | 'car' | 'house' | 'education' | 'business' | 'relocation' | 'retirement_early';

interface EventDef {
  id: EventId;
  emoji: string;
  label: string;
  description: string;
  costLabel: string;
  costDefault: number;
  costMin: number;
  costMax: number;
  costStep: number;
  yearsLabel: string;
  yearsDefault: number;
  ongoingCostPerMonth: number; // estimated ongoing monthly cost post-event
}

const EVENTS: EventDef[] = [
  { id: 'wedding',         emoji: '💍', label: 'Wedding',       description: 'One-time event cost',               costLabel: 'Wedding budget',    costDefault: 2000000, costMin: 100000,  costMax: 10000000, costStep: 100000, yearsLabel: 'Years until wedding', yearsDefault: 2,  ongoingCostPerMonth: 5000 },
  { id: 'baby',            emoji: '👶', label: 'New Baby',      description: 'Delivery + first-year expenses',     costLabel: 'Initial cost',      costDefault: 500000,  costMin: 50000,   costMax: 3000000,  costStep: 50000,  yearsLabel: 'Years until baby',    yearsDefault: 1,  ongoingCostPerMonth: 20000 },
  { id: 'car',             emoji: '🚗', label: 'Buy a Car',     description: 'Purchase price',                     costLabel: 'Car price',         costDefault: 800000,  costMin: 200000,  costMax: 5000000,  costStep: 50000,  yearsLabel: 'Years to save',       yearsDefault: 2,  ongoingCostPerMonth: 8000 },
  { id: 'house',           emoji: '🏠', label: 'Buy a House',   description: 'Down payment (20%) + stamp duty',   costLabel: 'House price',       costDefault: 5000000, costMin: 1000000, costMax: 50000000, costStep: 500000, yearsLabel: 'Years to save',       yearsDefault: 3,  ongoingCostPerMonth: 0 },
  { id: 'education',       emoji: '📚', label: 'Higher Education', description: 'Tuition + living expenses',      costLabel: 'Total education cost', costDefault: 1500000, costMin: 200000, costMax: 10000000, costStep: 100000, yearsLabel: 'Years until start',  yearsDefault: 3,  ongoingCostPerMonth: 25000 },
  { id: 'business',        emoji: '🏢', label: 'Start Business', description: 'Initial investment + 6-month runway', costLabel: 'Startup capital', costDefault: 1000000, costMin: 100000, costMax: 10000000, costStep: 100000, yearsLabel: 'Years to save',       yearsDefault: 2,  ongoingCostPerMonth: 50000 },
  { id: 'relocation',      emoji: '🌍', label: 'Relocation',    description: 'Moving costs + deposit + setup',     costLabel: 'Moving budget',     costDefault: 300000,  costMin: 50000,   costMax: 2000000,  costStep: 25000,  yearsLabel: 'Years until move',    yearsDefault: 1,  ongoingCostPerMonth: 10000 },
  { id: 'retirement_early',emoji: '🏖️', label: 'Early Retirement', description: 'Corpus needed (25× annual exp)', costLabel: 'Target corpus',   costDefault: 10000000, costMin: 2000000, costMax: 100000000, costStep: 1000000, yearsLabel: 'Years to retire',   yearsDefault: 15, ongoingCostPerMonth: 0 },
];

export function LifeEventPlannerCard() {
  const [activeEvent, setActiveEvent] = useState<EventId>('wedding');
  const [cost,  setCost]  = useState(2000000);
  const [years, setYears] = useState(2);

  const { investments, liabilities, cashflows, accounts } = usePortfolioStore();
  const { netWorth } = useMemo(() => calculateNetWorth(investments, liabilities), [investments, liabilities]);

  const event = EVENTS.find(e => e.id === activeEvent)!;

  const avgInc = useMemo(() => {
    const inc = cashflows.filter(e => e.type === 'income');
    const mos = new Set(inc.map(e => e.date.slice(0, 7))).size || 1;
    return inc.reduce((a, e) => a + e.amount, 0) / mos;
  }, [cashflows]);

  const avgExp = useMemo(() => {
    const exp = cashflows.filter(e => e.type === 'expense');
    const mos = new Set(exp.map(e => e.date.slice(0, 7))).size || 1;
    return exp.reduce((a, e) => a + e.amount, 0) / mos;
  }, [cashflows]);

  const surplus         = avgInc - avgExp;
  const bankBalance     = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const ongoingImpact   = event.ongoingCostPerMonth;

  // Effective cost for house = down payment
  const effectiveCost = activeEvent === 'house' ? Math.round(cost * 0.22) : cost;

  // Months to save at current surplus
  const monthsToSave = surplus > 0 ? Math.ceil(effectiveCost / surplus) : 9999;
  const yearsFuture  = years;

  // Projected net worth at event date (if no event)
  const projectedNWBase  = futureValue(netWorth > 0 ? netWorth : bankBalance, Math.max(0, surplus), 12, yearsFuture * 12);
  const projectedNWAfter = projectedNWBase - effectiveCost;

  // Monthly savings needed to fund the event
  const monthlySavingsNeeded = effectiveCost > 0 && yearsFuture > 0
    ? effectiveCost / (yearsFuture * 12)
    : 0;

  const canAfford     = surplus >= monthlySavingsNeeded;
  const newSurplus    = surplus - monthlySavingsNeeded - ongoingImpact;

  const warnings: string[] = [];
  const positives: string[] = [];

  if (!canAfford) warnings.push(`You need ₹${Math.round(monthlySavingsNeeded).toLocaleString('en-IN')}/mo savings but current surplus is ₹${Math.round(surplus).toLocaleString('en-IN')}.`);
  if (ongoingImpact > 0) warnings.push(`Ongoing cost after event: ₹${ongoingImpact.toLocaleString('en-IN')}/mo.`);
  if (newSurplus < 0) warnings.push(`Monthly cashflow goes negative (₹${Math.round(Math.abs(newSurplus)).toLocaleString('en-IN')} shortfall) after this event.`);
  if (activeEvent === 'house') positives.push('Real estate can appreciate 6–8% annually.');
  if (canAfford && newSurplus > 0) positives.push(`After the event, you'll still have ₹${Math.round(newSurplus).toLocaleString('en-IN')}/mo surplus.`);

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden'>
      <div className='px-5 py-4 border-b border-slate-100 dark:border-slate-800'>
        <h2 className='text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2'>
          <FiCalendar className='h-4 w-4 text-violet-500' /> Life Event Planner
        </h2>
        <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-0.5'>Plan the financial impact of a major life event</p>
      </div>

      <div className='flex flex-col lg:flex-row gap-4 p-4'>
        {/* Event selector */}
        <div className='lg:w-52 shrink-0'>
          <div className='flex flex-col gap-1'>
            {EVENTS.map(ev => (
              <button key={ev.id} type='button' onClick={() => { setActiveEvent(ev.id); setCost(ev.costDefault); setYears(ev.yearsDefault); }}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all ${activeEvent === ev.id ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <span className='text-base'>{ev.emoji}</span>{ev.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className='flex-1 space-y-4'>
          <div className={`rounded-xl px-4 py-3 ${canAfford ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700/40' : 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/40'}`}>
            <p className='text-sm font-bold text-slate-800 dark:text-slate-200'>{event.emoji} {event.label}</p>
            <p className='text-[11px] text-slate-500 dark:text-slate-400'>{event.description}</p>
          </div>

          {/* Cost slider */}
          <div>
            <div className='flex justify-between text-xs mb-1'>
              <span className='text-slate-600 dark:text-slate-300 font-semibold'>{event.costLabel}</span>
              <span className='font-black text-slate-900 dark:text-slate-100'>{formatINR(cost)}</span>
            </div>
            <input type='range' min={event.costMin} max={event.costMax} step={event.costStep} value={cost} onChange={e => setCost(Number(e.target.value))}
              className='w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 cursor-pointer accent-violet-600' />
          </div>

          {/* Years slider */}
          <div>
            <div className='flex justify-between text-xs mb-1'>
              <span className='text-slate-600 dark:text-slate-300 font-semibold'>{event.yearsLabel}</span>
              <span className='font-black text-slate-900 dark:text-slate-100'>{years} years</span>
            </div>
            <input type='range' min={1} max={20} step={1} value={years} onChange={e => setYears(Number(e.target.value))}
              className='w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 cursor-pointer accent-violet-600' />
          </div>

          {/* Impact grid */}
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
            {[
              { label: 'Effective Cost',    value: formatINR(effectiveCost),             color: 'text-rose-600 dark:text-rose-400' },
              { label: 'Save / Month',      value: `${formatINR(monthlySavingsNeeded)}/mo`, color: canAfford ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400' },
              { label: 'Months to Save',    value: monthsToSave < 9999 ? `${monthsToSave} mo` : 'N/A', color: 'text-slate-700 dark:text-slate-200' },
              { label: 'Net Worth After',   value: formatINR(projectedNWAfter),           color: projectedNWAfter >= 0 ? 'text-slate-700 dark:text-slate-200' : 'text-rose-600 dark:text-rose-400' },
              { label: 'Ongoing / Month',   value: ongoingImpact > 0 ? `${formatINR(ongoingImpact)}/mo` : 'None', color: 'text-slate-500 dark:text-slate-400' },
              { label: 'Surplus After',     value: formatINR(newSurplus),                 color: newSurplus >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className='rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2'>
                <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1'>{label}</p>
                <p className={`text-xs font-black tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Warnings / positives */}
          {(warnings.length > 0 || positives.length > 0) && (
            <div className='space-y-2'>
              {warnings.map((w, i) => (
                <div key={i} className='flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400'>
                  <FiAlertCircle className='h-3.5 w-3.5 shrink-0 mt-0.5' />{w}
                </div>
              ))}
              {positives.map((p, i) => (
                <div key={i} className='flex items-start gap-2 text-[11px] text-emerald-700 dark:text-emerald-400'>
                  <span className='shrink-0'>✓</span>{p}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className='text-[10px] text-slate-400 dark:text-slate-600 text-center pb-3'>
        Estimates only. Consult a financial advisor for major decisions.
      </p>
    </div>
  );
}
