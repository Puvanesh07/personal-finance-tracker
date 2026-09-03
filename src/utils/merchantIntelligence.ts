/**
 * src/utils/merchantIntelligence.ts
 * Merchant Intelligence â€” Tier 2.
 * Groups cashflow expenses by category, computes monthly + annual totals,
 * detects subscriptions and recurring merchants.
 */
import type { CashflowEntry } from '../types/investmentTypes';

export interface MerchantStat {
  category: string;
  emoji: string;
  monthlyAvg: number;
  annualTotal: number;
  annualProjected: number;
  occurrences: number;
  months: string[];          // YYYY-MM list
  isRecurring: boolean;      // appears in 3+ consecutive months
  lastDate: string;
  trend: 'up' | 'down' | 'stable';
  trendPct: number;          // % change recent vs prior period
}

const EMOJI_MAP: Record<string, string> = {
  'Food & Dining': 'ðŸ½ï¸', 'Groceries': 'ðŸ›’', 'Transport': 'ðŸš—', 'Petrol': 'â›½',
  'Healthcare': 'ðŸ¥', 'Education': 'ðŸ“š', 'Entertainment': 'ðŸŽ¬', 'Shopping': 'ðŸ›ï¸',
  'Subscriptions': 'ðŸ“±', 'Utilities': 'ðŸ’¡', 'Insurance': 'ðŸ›¡ï¸', 'EMI & Loans': 'ðŸ¦',
  'Travel & Vacations': 'âœˆï¸', 'Personal Care': 'ðŸ’†', 'Housing & Rent': 'ðŸ ', 'Rent': 'ðŸ˜ï¸',
  'Dining': 'ðŸœ', 'Investment': 'ðŸ“ˆ', 'Credit Card Payment': 'ðŸ’³',
  'Taxes': 'ðŸ§¾', 'Cash Withdrawal': 'ðŸ’µ', 'Transfers & Remittance': 'ðŸ’¸',
  'Childcare': 'ðŸ‘¶', 'Other Expense': 'ðŸ“¦',
};

function emojiFor(cat: string): string {
  return EMOJI_MAP[cat] ?? 'ðŸ·ï¸';
}

export function computeMerchantIntelligence(cashflows: CashflowEntry[]): {
  stats: MerchantStat[];
  totalAnnualProjected: number;
  topCategory: string | null;
  subscriptionTotal: number;
  subscriptionCount: number;
} {
  
  // Group by category
  const catMap = new Map<string, CashflowEntry[]>();
  for (const e of cashflows) {
    if (e.type !== 'expense') continue;
    const arr = catMap.get(e.category) ?? [];
    arr.push(e);
    catMap.set(e.category, arr);
  }

  const allMonths = [...new Set(cashflows.filter(e => e.type === 'expense').map(e => e.date.slice(0, 7)))].sort();
  const numMonths = allMonths.length || 1;

  const stats: MerchantStat[] = [];

  for (const [cat, entries] of catMap) {
    const months     = [...new Set(entries.map(e => e.date.slice(0, 7)))].sort();
    const total      = entries.reduce((a, e) => a + e.amount, 0);
    const monthlyAvg = total / numMonths;
    const annualProj = monthlyAvg * 12;

    // Trend: compare last 2 months vs prior 2
    const recent2months = allMonths.slice(-2);
    const prior2months  = allMonths.slice(-4, -2);
    const recentTotal   = entries.filter(e => recent2months.includes(e.date.slice(0, 7))).reduce((a, e) => a + e.amount, 0);
    const priorTotal    = entries.filter(e => prior2months.includes(e.date.slice(0, 7))).reduce((a, e) => a + e.amount, 0);
    const trendPct      = priorTotal > 0 ? ((recentTotal - priorTotal) / priorTotal) * 100 : 0;
    const trend         = trendPct > 10 ? 'up' : trendPct < -10 ? 'down' : 'stable';

    // Recurring: appears in 3+ months
    const monthDates  = months.map(m => { const [y, mo] = m.split('-').map(Number); return y * 12 + mo; });
    let consecutive   = 0;
    for (let i = 1; i < monthDates.length; i++) {
      if (monthDates[i] - monthDates[i - 1] === 1) consecutive++;
    }
    const isRecurring = consecutive >= 2 || months.length >= 3;

    const lastDate = entries.sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? '';

    stats.push({
      category: cat, emoji: emojiFor(cat),
      monthlyAvg, annualTotal: total, annualProjected: annualProj,
      occurrences: entries.length, months, isRecurring,
      lastDate, trend, trendPct,
    });
  }

  const sorted = stats.sort((a, b) => b.monthlyAvg - a.monthlyAvg);

  const subscriptions = sorted.filter(s => s.isRecurring);
  const subscriptionTotal = subscriptions.reduce((a, s) => a + s.monthlyAvg, 0);

  return {
    stats: sorted,
    totalAnnualProjected: sorted.reduce((a, s) => a + s.annualProjected, 0),
    topCategory: sorted[0]?.category ?? null,
    subscriptionTotal,
    subscriptionCount: subscriptions.length,
  };
}
