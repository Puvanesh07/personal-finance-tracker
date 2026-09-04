/**
 * src/pages/Calendar/FinancialCalendarPage.tsx
 *
 * Financial Calendar — Feature 4.
 * One calendar view for: EMI payments, tracked payments/bills,
 * insurance renewals, salary/income entries, and SIP dates.
 */

import { useMemo, useState } from 'react';
import {
  FiCalendar, FiChevronLeft, FiChevronRight,
  FiShield, FiBell, FiDollarSign, FiTrendingUp,
} from 'react-icons/fi';
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, format, isSameDay,
  isSameMonth, isToday, addMonths, subMonths,
} from 'date-fns';
import { usePortfolioStore } from '../../store/portfolioStore';
import { formatINR } from '../../utils/format';
import { FeatureInfo } from '../../components/ui/FeatureInfo';

// ─── Event types ──────────────────────────────────────────────────────────────

type CalEventType = 'payment' | 'insurance' | 'income' | 'emi' | 'sip';

interface CalEvent {
  id: string;
  date: string;           // YYYY-MM-DD
  label: string;
  amount: number;
  type: CalEventType;
  isPast: boolean;
  isPaid?: boolean;
}

const EVENT_COLORS: Record<CalEventType, string> = {
  payment:   'bg-rose-500',
  insurance: 'bg-sky-500',
  income:    'bg-emerald-500',
  emi:       'bg-amber-500',
  sip:       'bg-violet-500',
};
const EVENT_LIGHT: Record<CalEventType, string> = {
  payment:   'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700/40',
  insurance: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700/40',
  income:    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/40',
  emi:       'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/40',
  sip:       'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700/40',
};
const EVENT_EMOJI: Record<CalEventType, string> = {
  payment:   '💳',
  insurance: '🛡️',
  income:    '💰',
  emi:       '🏦',
  sip:       '📈',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FinancialCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay,  setSelectedDay]  = useState<Date | null>(null);

  const {
    trackedPayments, liabilities, cashflows, insurancePolicies, sipPlans,
  } = usePortfolioStore();

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  // ── Build events for the visible month ± 1 month ──────────────────────────
  const events: CalEvent[] = useMemo(() => {
    const ev: CalEvent[] = [];
    const monthStr = format(currentMonth, 'yyyy-MM');
    const prevStr  = format(subMonths(currentMonth, 1), 'yyyy-MM');
    const nextStr  = format(addMonths(currentMonth, 1), 'yyyy-MM');
    const relevant = (d: string) =>
      d.startsWith(monthStr) || d.startsWith(prevStr) || d.startsWith(nextStr);

    // Tracked payments (bills, EMIs, reminders)
    for (const p of trackedPayments) {
      if (!relevant(p.dueDate)) continue;
      ev.push({
        id: `tp_${p.id}`,
        date: p.dueDate,
        label: p.title,
        amount: p.amount,
        type: 'payment',
        isPast: p.dueDate < todayISO,
        isPaid: p.status === 'paid',
      });
    }

    // Liabilities — EMI day this month
    for (const l of liabilities) {
      if (l.status === 'paid' || l.status === 'returned') continue;
      if (!l.emiDay || !l.emiAmount) continue;
      // Build a date for this month's EMI
      for (const mStr of [prevStr, monthStr, nextStr]) {
        const [yr, mo] = mStr.split('-').map(Number);
        const day      = Math.min(l.emiDay, new Date(yr, mo, 0).getDate());
        const dateStr  = `${mStr}-${String(day).padStart(2, '0')}`;
        ev.push({
          id: `emi_${l.id}_${mStr}`,
          date: dateStr,
          label: `${l.name} EMI`,
          amount: l.emiAmount,
          type: 'emi',
          isPast: dateStr < todayISO,
        });
      }
    }

    // Cashflow entries this month (income only — to show salary)
    for (const c of cashflows) {
      if (!relevant(c.date) || c.type !== 'income') continue;
      ev.push({
        id: `cf_${c.id}`,
        date: c.date,
        label: c.category || 'Income',
        amount: c.amount,
        type: 'income',
        isPast: c.date < todayISO,
      });
    }

    // Insurance renewals
    for (const p of insurancePolicies) {
      if (!p.renewalDate || !relevant(p.renewalDate)) continue;
      ev.push({
        id: `ins_${p.id}`,
        date: p.renewalDate,
        label: `${p.policyName} renewal`,
        amount: p.premiumAmount,
        type: 'insurance',
        isPast: p.renewalDate < todayISO,
      });
    }

    // SIP plans — budget document gives the monthly amount; instruments show on 1st
    const sipBudget = sipPlans.find((s: any) => s.type === 'budget');
    if (sipBudget?.budget > 0) {
      for (const mStr of [prevStr, monthStr, nextStr]) {
        const dateStr = `${mStr}-01`;
        ev.push({
          id: `sip_${mStr}`,
          date: dateStr,
          label: 'Monthly SIP',
          amount: sipBudget.budget,
          type: 'sip',
          isPast: dateStr < todayISO,
        });
      }
    }

    return ev;
  }, [trackedPayments, liabilities, cashflows, insurancePolicies, sipPlans, currentMonth, todayISO]);

  // ── Calendar grid ─────────────────────────────────────────────────────────
  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsForDay = (day: Date) =>
    events.filter((e) => e.date === format(day, 'yyyy-MM-dd'));

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  // ── Monthly totals ─────────────────────────────────────────────────────────
  const mStr = format(currentMonth, 'yyyy-MM');
  const monthEvents = events.filter((e) => e.date.startsWith(mStr));
  const monthIncome    = monthEvents.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const monthPayments  = monthEvents.filter((e) => e.type === 'payment' || e.type === 'emi').reduce((a, e) => a + e.amount, 0);
  const monthInsurance = monthEvents.filter((e) => e.type === 'insurance').reduce((a, e) => a + e.amount, 0);

  return (
    <div className='flex flex-col gap-6 pb-12'>
      {/* Header */}
      <header className='rounded-2xl bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-transparent p-6 border border-sky-500/20'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-lg'>
            <FiCalendar className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2'>Financial Calendar <FeatureInfo feature='calendar' /></h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              All EMIs, bills, insurance, salary and SIPs in one view.
            </p>
          </div>
        </div>
      </header>

      {/* Month summary */}
      <div className='grid grid-cols-3 gap-3'>
        {[
          { icon: FiDollarSign, label: 'Income this month',   value: formatINR(monthIncome),    color: 'text-emerald-600 dark:text-emerald-400' },
          { icon: FiBell,      label: 'Bills & EMIs',        value: formatINR(monthPayments),   color: 'text-rose-600 dark:text-rose-400' },
          { icon: FiShield,    label: 'Insurance premiums',  value: formatINR(monthInsurance),  color: 'text-sky-600 dark:text-sky-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
            <div className='flex items-center gap-1.5 mb-1'>
              <Icon className='h-3.5 w-3.5 text-slate-400' />
              <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400'>{label}</p>
            </div>
            <p className={`text-lg font-black tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden'>
        {/* Nav */}
        <div className='flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800'>
          <button
            type='button'
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className='p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
          >
            <FiChevronLeft className='h-4 w-4 text-slate-600 dark:text-slate-300' />
          </button>
          <h2 className='text-sm font-bold text-slate-900 dark:text-slate-100'>
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            type='button'
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className='p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
          >
            <FiChevronRight className='h-4 w-4 text-slate-600 dark:text-slate-300' />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className='grid grid-cols-7 border-b border-slate-100 dark:border-slate-800'>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
            <div key={d} className='py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400'>
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className='grid grid-cols-7'>
          {days.map((day, i) => {
            const dayEvents  = eventsForDay(day);
            const isThisMonth = isSameMonth(day, currentMonth);
            const isTodayDay  = isToday(day);
            const isSelected  = selectedDay ? isSameDay(day, selectedDay) : false;
            const maxDots     = 3;

            return (
              <button
                key={i}
                type='button'
                onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                className={`relative flex flex-col items-center min-h-[64px] p-1.5 border-b border-r border-slate-100 dark:border-slate-800 transition-colors text-left
                  ${!isThisMonth ? 'opacity-35' : ''}
                  ${isSelected ? 'bg-sky-50 dark:bg-sky-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}
                `}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold mb-0.5
                  ${isTodayDay ? 'bg-sky-600 text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                  {format(day, 'd')}
                </span>
                {/* Event dots */}
                <div className='flex flex-wrap gap-0.5 justify-center'>
                  {dayEvents.slice(0, maxDots).map((e) => (
                    <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${EVENT_COLORS[e.type]} ${e.isPaid ? 'opacity-40' : ''}`} />
                  ))}
                  {dayEvents.length > maxDots && (
                    <span className='text-[8px] text-slate-400 font-bold'>+{dayEvents.length - maxDots}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className='flex flex-wrap gap-3'>
        {(Object.keys(EVENT_EMOJI) as CalEventType[]).map((t) => (
          <span key={t} className='flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400'>
            <span className={`h-2 w-2 rounded-full ${EVENT_COLORS[t]}`} />
            {EVENT_EMOJI[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
          </span>
        ))}
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden'>
          <div className='px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800'>
            <p className='text-sm font-bold text-slate-700 dark:text-slate-200'>
              {format(selectedDay, 'EEEE, d MMMM yyyy')}
            </p>
          </div>
          {selectedEvents.length === 0 ? (
            <p className='px-5 py-6 text-sm text-slate-400 text-center'>No events on this day.</p>
          ) : (
            <div className='divide-y divide-slate-100 dark:divide-slate-800'>
              {selectedEvents.map((e) => (
                <div key={e.id} className={`flex items-center justify-between px-5 py-3 border-l-4 ${EVENT_COLORS[e.type].replace('bg-', 'border-')}`}>
                  <div className='flex items-center gap-3'>
                    <span className='text-lg'>{EVENT_EMOJI[e.type]}</span>
                    <div>
                      <p className={`text-sm font-semibold ${e.isPaid ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {e.label}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${EVENT_LIGHT[e.type]}`}>
                        {e.type}
                      </span>
                    </div>
                  </div>
                  <div className='text-right'>
                    <p className='text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100'>
                      {formatINR(e.amount)}
                    </p>
                    {e.isPaid && <p className='text-[10px] text-emerald-500'>✓ Paid</p>}
                    {e.isPast && !e.isPaid && <p className='text-[10px] text-rose-500'>Overdue</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// suppress
void FiTrendingUp;
