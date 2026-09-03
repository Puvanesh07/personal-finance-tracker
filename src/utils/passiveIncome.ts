/**
 * src/utils/passiveIncome.ts
 * Passive Income Tracker â€” Tier 2.
 * Identifies passive income streams from cashflows + investments (dividends, interest, rental).
 */
import type { CashflowEntry, Investment } from '../types/investmentTypes';

export interface PassiveStream {
  label: string;
  emoji: string;
  monthlyAvg: number;
  annualTotal: number;
  lastDate: string;
  source: 'cashflow' | 'investment';
}

export interface PassiveIncomeResult {
  streams: PassiveStream[];
  totalMonthly: number;
  totalAnnual: number;
  coverageOfExpensesPct: number;    // passive / avg monthly expense * 100
  fiNumber: number;                 // 25Ã— annual expenses (FIRE corpus needed)
  passiveTowardFIPct: number;       // (annual passive / FI number) * 100
}

const PASSIVE_KEYWORDS = [
  { pattern: /dividend/i,        label: 'Dividends',      emoji: 'ðŸ“Š' },
  { pattern: /interest/i,        label: 'Interest',       emoji: 'ðŸ¦' },
  { pattern: /rental|rent.*received/i, label: 'Rental Income', emoji: 'ðŸ ' },
  { pattern: /capital.?gain/i,   label: 'Capital Gains',  emoji: 'ðŸ“ˆ' },
  { pattern: /royalt/i,          label: 'Royalties',      emoji: 'ðŸŽµ' },
  { pattern: /pension/i,         label: 'Pension',        emoji: 'ðŸ‘´' },
  { pattern: /annuit/i,          label: 'Annuity',        emoji: 'ðŸ“‹' },
];

export function computePassiveIncome(
  cashflows: CashflowEntry[],
  investments: Investment[],
  avgMonthlyExpense: number,
): PassiveIncomeResult {
  const streamMap = new Map<string, { total: number; months: Set<string>; lastDate: string; emoji: string }>();

  // From cashflow income entries
  for (const e of cashflows) {
    if (e.type !== 'income') continue;
    for (const kw of PASSIVE_KEYWORDS) {
      if (kw.pattern.test(e.category) || kw.pattern.test(e.notes ?? '')) {
        const s = streamMap.get(kw.label) ?? { total: 0, months: new Set(), lastDate: '', emoji: kw.emoji };
        s.total += e.amount;
        s.months.add(e.date.slice(0, 7));
        if (e.date > s.lastDate) s.lastDate = e.date;
        streamMap.set(kw.label, s);
        break;
      }
    }
  }

  // From investments: FD/bond interest (accruing)
  const fdBondInterest = investments
    .filter(i => i.type === 'fixed_deposit' || i.type === 'bond')
    .reduce((a, i) => {
      const rate = (i as any).interestRate ?? 0;
      const principal = (i as any).investedAmount ?? 0;
      return a + (principal * rate) / 100 / 12; // monthly interest
    }, 0);

  if (fdBondInterest > 0) {
    const existing = streamMap.get('FD/Bond Interest') ?? { total: 0, months: new Set(), lastDate: new Date().toISOString().slice(0,10), emoji: 'ðŸ¦' };
    existing.total += fdBondInterest * 12; // annualise
    streamMap.set('FD/Bond Interest', existing);
  }

    const numMonths = new Set(cashflows.filter(e => e.type === 'income').map(e => e.date.slice(0, 7))).size || 1;

  const streams: PassiveStream[] = [...streamMap.entries()].map(([label, s]) => {
    const monthCount = s.months.size || 1;
    const monthlyAvg = s.total / Math.max(monthCount, numMonths);
    return {
      label, emoji: s.emoji,
      monthlyAvg, annualTotal: s.total,
      lastDate: s.lastDate, source: 'cashflow' as const,
    };
  }).sort((a, b) => b.monthlyAvg - a.monthlyAvg);

  const totalMonthly = streams.reduce((a, s) => a + s.monthlyAvg, 0);
  const totalAnnual  = totalMonthly * 12;
  const fiNumber     = avgMonthlyExpense * 12 * 25;
  const coveragePct  = avgMonthlyExpense > 0 ? (totalMonthly / avgMonthlyExpense) * 100 : 0;
  const fiPct        = fiNumber > 0 ? (totalAnnual / fiNumber) * 100 : 0;

  return {
    streams, totalMonthly, totalAnnual,
    coverageOfExpensesPct: coveragePct,
    fiNumber, passiveTowardFIPct: fiPct,
  };
}
