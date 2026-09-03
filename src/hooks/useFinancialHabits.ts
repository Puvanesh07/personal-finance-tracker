/**
 * src/hooks/useFinancialHabits.ts
 * Financial Habits & Streaks — Tier 2.
 * Tracks: savings streak, no-spend days, investment streak, budget streak.
 */
import { useMemo } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';

export interface HabitStreak {
  label: string;
  emoji: string;
  current: number;     // current streak (days or months)
  best: number;        // best streak ever
  unit: 'days' | 'months';
  lastDate: string;
  active: boolean;
}

export interface FinancialHabitsResult {
  streaks: HabitStreak[];
  totalScore: number;        // 0-100 habit score
  noSpendDaysThisMonth: number;
  savingsDaysThisMonth: number;
  consecutiveSavingsMonths: number;
  consecutiveInvestmentMonths: number;
  message: string;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function thisMonthKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

export function useFinancialHabits(): FinancialHabitsResult {
  const { cashflows, investments } = usePortfolioStore();

  return useMemo(() => {
    const today     = todayISO();
    const thisMonth = thisMonthKey();
    const now       = new Date();

    // ── No-spend days this month ──────────────────────────────────────────
    const thisMonthExpDates = new Set(
      cashflows.filter(e => e.type === 'expense' && e.date.startsWith(thisMonth)).map(e => e.date),
    );
    const daysElapsed = now.getDate();
    let noSpendDays = 0;
    for (let d = 1; d <= daysElapsed; d++) {
      const iso = `${thisMonth}-${String(d).padStart(2, '0')}`;
      if (!thisMonthExpDates.has(iso)) noSpendDays++;
    }

    // ── Current no-spend streak ───────────────────────────────────────────
    let noSpendStreak = 0;
    let noSpendBest   = 0;
    let tempNoSpend   = 0;
    const allDates = new Set(cashflows.filter(e => e.type === 'expense').map(e => e.date));
    // Walk back from today
    for (let i = 0; i <= 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if (!allDates.has(iso)) {
        tempNoSpend++;
        if (i === noSpendStreak) noSpendStreak = tempNoSpend;
        noSpendBest = Math.max(noSpendBest, tempNoSpend);
      } else {
        if (i === 0) break; // spent today
        break;
      }
    }
    // Best overall
    let runNoSpend = 0;
    const sortedExpDates = [...allDates].sort();
    if (sortedExpDates.length > 1) {
      for (let i = 0; i < sortedExpDates.length - 1; i++) {
        const a = new Date(sortedExpDates[i]).getTime();
        const b = new Date(sortedExpDates[i + 1]).getTime();
        const gap = Math.round((b - a) / 86_400_000) - 1;
        runNoSpend = Math.max(runNoSpend, gap);
      }
    }
    noSpendBest = Math.max(noSpendBest, runNoSpend);

    // ── Consecutive savings months ────────────────────────────────────────
    const monthMap = new Map<string, { income: number; expense: number }>();
    for (const e of cashflows) {
      const m = e.date.slice(0, 7);
      if (!monthMap.has(m)) monthMap.set(m, { income: 0, expense: 0 });
      const b = monthMap.get(m)!;
      if (e.type === 'income') b.income += e.amount;
      else b.expense += e.amount;
    }
    const sortedMonths = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let savingsStreak = 0;
    let savingsBest   = 0;
    let tempSavings   = 0;
    for (let i = sortedMonths.length - 1; i >= 0; i--) {
      const [, d] = sortedMonths[i];
      if (d.income > d.expense) {
        tempSavings++;
        if (i === sortedMonths.length - 1 - savingsStreak + 1 || savingsStreak === 0) savingsStreak = tempSavings;
        savingsBest = Math.max(savingsBest, tempSavings);
      } else {
        if (i === sortedMonths.length - 1) break;
        break;
      }
    }
    // Simpler recalculation
    savingsStreak = 0;
    for (let i = sortedMonths.length - 1; i >= 0; i--) {
      const [, d] = sortedMonths[i];
      if (d.income > d.expense) savingsStreak++;
      else break;
    }
    savingsBest = 0;
    let run = 0;
    for (const [, d] of sortedMonths) {
      if (d.income > d.expense) { run++; savingsBest = Math.max(savingsBest, run); }
      else run = 0;
    }

    // ── Investment streak (months with any investment added) ──────────────
    const invMonths = new Set(investments.map(i => i.createdAt.slice(0, 7)));
    const allInvMonthsSorted = [...invMonths].sort();
    let invStreak = 0;
    for (let i = allInvMonthsSorted.length - 1; i >= 0; i--) {
      const m = allInvMonthsSorted[i];
      const [y, mo] = m.split('-').map(Number);
      const expected = new Date(now.getFullYear(), now.getMonth() - (allInvMonthsSorted.length - 1 - i), 1);
      const expKey   = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}`;
      if (m === expKey || i === allInvMonthsSorted.length - 1) invStreak++;
      else break;
      void y; void mo;
    }
    let invBest = 0; let invRun = 0;
    for (let i = 0; i < allInvMonthsSorted.length - 1; i++) {
      const [y1, m1] = allInvMonthsSorted[i].split('-').map(Number);
      const [y2, m2] = allInvMonthsSorted[i + 1].split('-').map(Number);
      if ((y2 * 12 + m2) - (y1 * 12 + m1) === 1) { invRun++; invBest = Math.max(invBest, invRun + 1); }
      else invRun = 0;
    }
    if (allInvMonthsSorted.length === 1) invBest = 1;

    // ── Savings days this month ───────────────────────────────────────────
    const thisMonthIncDates = new Set(
      cashflows.filter(e => e.type === 'income' && e.date.startsWith(thisMonth)).map(e => e.date),
    );
    let savingsDays = 0;
    for (let d = 1; d <= daysElapsed; d++) {
      const iso = `${thisMonth}-${String(d).padStart(2, '0')}`;
      if (thisMonthIncDates.has(iso) && !thisMonthExpDates.has(iso)) savingsDays++;
    }

    // ── Build streaks array ───────────────────────────────────────────────
    const lastMonth = sortedMonths[sortedMonths.length - 1]?.[0] ?? today;
    const lastInvDate = investments.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt.slice(0, 10) ?? today;

    const streaks: HabitStreak[] = [
      {
        label:    'Savings Streak',
        emoji:    '💰',
        current:  savingsStreak,
        best:     savingsBest,
        unit:     'months',
        lastDate: lastMonth,
        active:   savingsStreak > 0,
      },
      {
        label:    'No-Spend Streak',
        emoji:    '🚫',
        current:  noSpendStreak,
        best:     noSpendBest,
        unit:     'days',
        lastDate: today,
        active:   noSpendStreak > 0,
      },
      {
        label:    'Investment Streak',
        emoji:    '📈',
        current:  invStreak,
        best:     Math.max(invBest, invStreak),
        unit:     'months',
        lastDate: lastInvDate,
        active:   invStreak > 0,
      },
    ];

    // ── Score ─────────────────────────────────────────────────────────────
    const savingsScore  = Math.min(40, savingsStreak * 8);
    const noSpendScore  = Math.min(30, noSpendStreak * 3);
    const invScore      = Math.min(30, invStreak * 6);
    const totalScore    = savingsScore + noSpendScore + invScore;

    const message =
      totalScore >= 70 ? 'Excellent financial habits! Keep going.'
      : totalScore >= 40 ? 'Good habits forming. Stay consistent.'
      : 'Start building habits — even one no-spend day counts.';

    return {
      streaks, totalScore,
      noSpendDaysThisMonth: noSpendDays,
      savingsDaysThisMonth: savingsDays,
      consecutiveSavingsMonths: savingsStreak,
      consecutiveInvestmentMonths: invStreak,
      message,
    };
  }, [cashflows, investments]);
}
