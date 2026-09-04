/**
 * src/hooks/useContextualSuggestions.ts
 *
 * Returns 6 dynamically personalised suggested questions based on what
 * data the user actually has in the store. No hardcoded list.
 *
 * Priority: questions about modules that have data → questions about
 * modules the user hasn't set up yet (onboarding nudges).
 */

import { useMemo } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';

export interface Suggestion {
  emoji: string;
  label: string;
  question: string;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function inDaysISO(d: number) { return new Date(Date.now() + d * 86400000).toISOString().slice(0, 10); }

export function useContextualSuggestions(): Suggestion[] {
  const {
    investments,
    liabilities,
    cashflows,
    goals,
    trackedPayments,
    insurancePolicies,
    accounts,
  } = usePortfolioStore.getState();

  return useMemo(() => {
    const suggestions: Suggestion[] = [];
    const today   = todayISO();
    const in7days = inDaysISO(7);

    // ── Investments ────────────────────────────────────────────────────────
    if (investments.length) {
      const hasLoss = investments.some((i) => {
        const iv = i.type === 'stock'
          ? (i as { quantity: number; buyPrice: number }).quantity * (i as { quantity: number; buyPrice: number }).buyPrice
          : (i as { investedAmount?: number }).investedAmount ?? 0;
        const cv = i.type === 'stock'
          ? (i as { quantity: number; currentPrice: number }).quantity * (i as { quantity: number; currentPrice: number }).currentPrice
          : i.type === 'mutual_fund'
            ? (i as { units: number; nav: number }).units * (i as { units: number; nav: number }).nav
            : (i as { currentValue?: number }).currentValue ?? 0;
        return cv < iv;
      });

      if (hasLoss) {
        suggestions.push({ emoji: '📉', label: 'Investments in loss', question: 'Which of my investments is currently at the biggest loss?' });
      } else {
        suggestions.push({ emoji: '🏆', label: 'Best performer', question: 'Which of my investments is performing the best?' });
      }
      suggestions.push({ emoji: '📈', label: 'Portfolio overview', question: 'Show me my portfolio performance' });
    } else {
      suggestions.push({ emoji: '📈', label: 'How to add investments', question: 'How do I add an investment in FinTrackly?' });
    }

    // ── Payments ──────────────────────────────────────────────────────────
    const dueWeek = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate >= today && p.dueDate <= in7days);
    const overdue = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate < today);
    if (overdue.length) {
      suggestions.push({ emoji: '⚠️', label: 'Overdue payments', question: 'Do I have any overdue payments?' });
    } else if (dueWeek.length) {
      suggestions.push({ emoji: '🔔', label: 'Payments this week', question: 'What payments are due in the next 7 days?' });
    } else if (trackedPayments.length) {
      suggestions.push({ emoji: '📅', label: 'Upcoming payments', question: 'Show me all my upcoming payment obligations' });
    } else {
      suggestions.push({ emoji: '🔔', label: 'How to add a payment', question: 'How do I add a payment in FinTrackly?' });
    }

    // ── Cash flow ─────────────────────────────────────────────────────────
    if (cashflows.length) {
      suggestions.push({ emoji: '💰', label: 'This month savings', question: 'How much money did I save this month?' });
    } else {
      suggestions.push({ emoji: '💸', label: 'How to track expenses', question: 'How do I record income and expenses?' });
    }

    // ── Goals ─────────────────────────────────────────────────────────────
    if (goals.filter((g) => !g.status || g.status === 'active').length) {
      suggestions.push({ emoji: '🎯', label: 'Goal closest to done', question: 'Which of my financial goals is closest to completion?' });
    } else {
      suggestions.push({ emoji: '🎯', label: 'How to set a goal', question: 'How do I create a financial goal?' });
    }

    // ── Liabilities ───────────────────────────────────────────────────────
    if (liabilities.filter((l) => !l.status || l.status === 'active').length) {
      suggestions.push({ emoji: '💳', label: 'Highest interest debt', question: 'Which of my liabilities has the highest interest rate?' });
    } else if (accounts.length) {
      suggestions.push({ emoji: '🏦', label: 'Account balances', question: 'What is my total account balance?' });
    }

    // ── Insurance ─────────────────────────────────────────────────────────
    const renewingSoon = insurancePolicies.filter((p) => {
      const in30 = inDaysISO(30);
      return p.renewalDate && p.renewalDate >= today && p.renewalDate <= in30;
    });
    if (renewingSoon.length) {
      suggestions.push({ emoji: '🛡️', label: 'Insurance renewal', question: 'Which of my insurance policies is renewing next?' });
    } else if (insurancePolicies.length) {
      suggestions.push({ emoji: '🛡️', label: 'Insurance coverage', question: 'What is my total insurance coverage?' });
    }

    // ── General finance if still short ────────────────────────────────────
    const generals: Suggestion[] = [
      { emoji: '💡', label: 'What is P&L?',             question: 'What is unrealized P&L?' },
      { emoji: '💡', label: 'Savings rate formula',     question: 'How is savings rate calculated?' },
      { emoji: '💡', label: 'Debt-to-asset ratio',      question: 'What is debt-to-asset ratio?' },
      { emoji: '💡', label: 'Emergency fund',           question: 'What should my emergency fund target be?' },
      { emoji: '💡', label: 'Portfolio diversification',question: 'What is portfolio diversification?' },
    ];
    for (const g of generals) {
      if (suggestions.length >= 6) break;
      suggestions.push(g);
    }

    return suggestions.slice(0, 6);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    investments, liabilities, cashflows, goals,
    trackedPayments, insurancePolicies, accounts,
  ]);
}
