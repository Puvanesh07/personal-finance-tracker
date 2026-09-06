/**
 * src/utils/cashflowForecast.ts
 *
 * Cashflow Forecast Engine — Feature 14 / Level 2.
 * Computes projected cash in/out for the next 7 / 30 / 90 days
 * using live data: bank balances, tracked payments, liability EMIs, SIP plans,
 * and average income from cashflow history.
 *
 * All logic is pure (no store imports) — call with pre-extracted state slices.
 */

import type { TrackedPayment, Liability, CashflowEntry, Account } from '../types/investmentTypes';

export interface ForecastEvent {
  date: string;             // YYYY-MM-DD
  label: string;
  amount: number;
  direction: 'in' | 'out';
  category: 'payment' | 'emi' | 'sip' | 'income' | 'insurance';
  isPast: boolean;
}

export interface ForecastPeriod {
  days: 7 | 30 | 90;
  totalIn: number;
  totalOut: number;
  netFlow: number;
  projectedBalance: number;
  events: ForecastEvent[];
  lowBalanceDate: string | null;   // date when balance may drop below threshold
  lowBalanceAmount: number | null;
}

export interface ForecastResult {
  currentCash: number;
  availableAfterObligations: number;  // currentCash minus upcoming 30-day obligations
  forecast7:  ForecastPeriod;
  forecast30: ForecastPeriod;
  forecast90: ForecastPeriod;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function today(): string { return new Date().toISOString().slice(0, 10); }

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Average monthly income from last 3 months of cashflow history */
function avgMonthlyIncome(cashflows: CashflowEntry[]): number {
  const now      = new Date();
  const cutoff   = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
  const recent   = cashflows.filter((e) => e.type === 'income' && e.date >= cutoff);
  if (!recent.length) return 0;
  const months   = new Set(recent.map((e) => e.date.slice(0, 7))).size || 1;
  return recent.reduce((a, e) => a + e.amount, 0) / months;
}

/** Build forecast events for a window starting today */
function buildEvents(
  days: number,
  trackedPayments: TrackedPayment[],
  liabilities: Liability[],
  sipPlans: any[],
  avgIncome: number,
): ForecastEvent[] {
  const start    = today();
  const end      = addDays(start, days);
  const events:  ForecastEvent[] = [];
  const todayStr = today();

  // ── Tracked payments (bills, EMIs, subscriptions) ───────────────────────
  for (const p of trackedPayments) {
    if (p.status === 'paid') continue;

    // Single occurrence
    if (p.dueDate >= start && p.dueDate <= end) {
      events.push({
        date:      p.dueDate,
        label:     p.title,
        amount:    p.amount,
        direction: 'out',
        category:  'payment',
        isPast:    p.dueDate < todayStr,
      });
    }

    // Project all recurrences using the shared nextDueDate utility
    if (p.recurrence !== 'none') {
      // Determine interval in months or days based on recurrence type
      const addInterval = (d: Date): Date => {
        switch (p.recurrence) {
          case 'weekly':         return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
          case 'every_2_weeks':  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 14);
          case 'monthly':        return new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
          case 'every_2_months': return new Date(d.getFullYear(), d.getMonth() + 2, d.getDate());
          case 'quarterly':      return new Date(d.getFullYear(), d.getMonth() + 3, d.getDate());
          case 'half_yearly':    return new Date(d.getFullYear(), d.getMonth() + 6, d.getDate());
          case 'yearly':         return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
          default:               return new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
        }
      };

      let d = new Date(p.dueDate);
      const maxIterations = 400; // safety cap
      for (let i = 0; i < maxIterations; i++) {
        d = addInterval(d);
        const iso = d.toISOString().slice(0, 10);
        if (iso > end) break;
        if (iso >= start) {
          events.push({
            date: iso, label: p.title, amount: p.amount,
            direction: 'out', category: 'payment', isPast: iso < todayStr,
          });
        }
      }
    }
  }

  // ── Liability EMIs ───────────────────────────────────────────────────────
  for (const l of liabilities) {
    if (!l.emiAmount || !l.emiDay || l.status === 'paid' || l.status === 'returned') continue;
    const now2 = new Date();
    for (let m = 0; m <= Math.ceil(days / 28) + 1; m++) {
      const year  = now2.getFullYear() + Math.floor((now2.getMonth() + m) / 12);
      const month = (now2.getMonth() + m) % 12;
      const maxDay = daysInMonth(year, month);
      const day   = Math.min(l.emiDay, maxDay);
      const iso   = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (iso < start || iso > end) continue;
      events.push({
        date: iso, label: `${l.name} EMI`, amount: l.emiAmount,
        direction: 'out', category: 'emi', isPast: iso < todayStr,
      });
    }
  }

  // ── SIP on 1st of each month ─────────────────────────────────────────────
  const sipBudget = sipPlans.find((s: any) => s.type === 'budget');
  if (sipBudget?.budget > 0) {
    const now3 = new Date();
    for (let m = 0; m <= Math.ceil(days / 28) + 2; m++) {
      const d2  = new Date(now3.getFullYear(), now3.getMonth() + m, 1);
      const iso = d2.toISOString().slice(0, 10);
      if (iso < start || iso > end) continue;
      events.push({
        date: iso, label: 'Monthly SIP', amount: sipBudget.budget,
        direction: 'out', category: 'sip', isPast: iso < todayStr,
      });
    }
  }

  // ── Projected income (monthly average, expected on ~1st) ─────────────────
  if (avgIncome > 0) {
    const now4 = new Date();
    for (let m = 0; m <= Math.ceil(days / 28) + 2; m++) {
      const d3  = new Date(now4.getFullYear(), now4.getMonth() + m, 1);
      const iso = d3.toISOString().slice(0, 10);
      if (iso < start || iso > end) continue;
      events.push({
        date: iso, label: 'Expected Income', amount: avgIncome,
        direction: 'in', category: 'income', isPast: iso < todayStr,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function buildPeriod(
  days: 7 | 30 | 90,
  currentCash: number,
  events: ForecastEvent[],
  lowBalanceThreshold = 20_000,
): ForecastPeriod {
  const periodEvents = events.filter((e) => {
    const end = addDays(today(), days);
    return e.date >= today() && e.date <= end;
  });

  const totalIn  = periodEvents.filter((e) => e.direction === 'in').reduce((a, e) => a + e.amount, 0);
  const totalOut = periodEvents.filter((e) => e.direction === 'out').reduce((a, e) => a + e.amount, 0);

  // Running balance to find low-balance date
  let running = currentCash;
  let lowDate: string | null = null;
  let lowAmt:  number | null = null;

  const sorted = [...periodEvents].sort((a, b) => a.date.localeCompare(b.date));
  for (const ev of sorted) {
    running += ev.direction === 'in' ? ev.amount : -ev.amount;
    if (running < lowBalanceThreshold && lowDate === null) {
      lowDate = ev.date;
      lowAmt  = running;
    }
  }

  return {
    days,
    totalIn,
    totalOut,
    netFlow: totalIn - totalOut,
    projectedBalance: currentCash + totalIn - totalOut,
    events: periodEvents,
    lowBalanceDate:   lowDate,
    lowBalanceAmount: lowAmt,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeForecast(
  accounts:        Account[],
  trackedPayments: TrackedPayment[],
  liabilities:     Liability[],
  cashflows:       CashflowEntry[],
  sipPlans:        any[],
  lowBalanceThreshold = 20_000,
): ForecastResult {
  const currentCash = accounts
    .filter((a) => a.type === 'bank')
    .reduce((s, a) => s + (a.balance ?? 0), 0);

  const avgInc  = avgMonthlyIncome(cashflows);
  const allEvts = buildEvents(90, trackedPayments, liabilities, sipPlans, avgInc);

  const f7  = buildPeriod(7,  currentCash, allEvts, lowBalanceThreshold);
  const f30 = buildPeriod(30, currentCash, allEvts, lowBalanceThreshold);
  const f90 = buildPeriod(90, currentCash, allEvts, lowBalanceThreshold);

  // Available cash = currentCash minus next-30-days obligations
  const obligations30 = f30.totalOut;
  const available     = Math.max(0, currentCash - obligations30);

  return {
    currentCash,
    availableAfterObligations: available,
    forecast7:  f7,
    forecast30: f30,
    forecast90: f90,
  };
}
