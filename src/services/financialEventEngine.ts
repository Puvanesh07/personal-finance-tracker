/**
 * src/services/financialEventEngine.ts
 * Financial Event Engine — Tier 3.
 *
 * A lightweight pub/sub event bus that fires after every store mutation.
 * Components subscribe to alerts; the engine checks budget, goals, risk,
 * anomalies and health score on each relevant data change.
 *
 * Usage:
 *   financialEventEngine.on('alert', handler)
 *   financialEventEngine.emit('transaction_added', payload)
 *   financialEventEngine.off('alert', handler)
 */

export type FinancialEventType =
  | 'transaction_added'
  | 'payment_paid'
  | 'investment_added'
  | 'goal_updated'
  | 'liability_added'
  | 'account_updated';

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface FinancialAlert {
  id: string;
  timestamp: number;
  severity: AlertSeverity;
  title: string;
  body: string;
  emoji: string;
  category: 'budget' | 'goal' | 'risk' | 'cashflow' | 'health' | 'milestone';
  linkTo?: string;
}

type AlertListener = (alert: FinancialAlert) => void;

class FinancialEventEngine {
  private listeners = new Map<string, Set<AlertListener>>();
  private recentAlerts: FinancialAlert[] = [];
  private maxAlerts = 20;

  on(event: string, listener: AlertListener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: AlertListener) {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, alert: FinancialAlert) {
    this.recentAlerts.unshift(alert);
    if (this.recentAlerts.length > this.maxAlerts) {
      this.recentAlerts = this.recentAlerts.slice(0, this.maxAlerts);
    }
    this.listeners.get(event)?.forEach(l => l(alert));
  }

  getRecent(limit = 10): FinancialAlert[] {
    return this.recentAlerts.slice(0, limit);
  }

  clearRecent() { this.recentAlerts = []; }
}

export const financialEventEngine = new FinancialEventEngine();

// ─── Core analysis functions called after every mutation ──────────────────────

import type { CashflowEntry, Investment, Liability, TrackedPayment } from '../types/investmentTypes';
import { calculateNetWorth, currentValue, investedValue } from '../utils/calculations';
import { computeSpendingVelocity } from '../utils/spendingVelocity';

let _budgetMap: Record<string, number> = {};
export function setBudgetMap(b: Record<string, number>) { _budgetMap = b; }

export function analyseAfterTransaction(
  cashflows:  CashflowEntry[],
  investments: Investment[],
  liabilities: Liability[],
  trackedPayments: TrackedPayment[],
  newEntry?: CashflowEntry,
) {
  const now  = Date.now();
  const fmt  = (n: number) => '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');

  // 1. Budget check — did this category exceed budget?
  if (newEntry?.type === 'expense' && _budgetMap[newEntry.category] > 0) {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const catTotal  = cashflows
      .filter(e => e.type === 'expense' && e.date.startsWith(thisMonth) && e.category === newEntry.category)
      .reduce((a, e) => a + e.amount, 0);
    const budget = _budgetMap[newEntry.category];
    const pct    = (catTotal / budget) * 100;

    if (pct >= 100) {
      financialEventEngine.emit('alert', {
        id: `budget_exceeded_${newEntry.category}_${thisMonth}`,
        timestamp: now, severity: 'warning', category: 'budget',
        emoji: '⚠️',
        title: `"${newEntry.category}" budget exceeded`,
        body: `Spent ${fmt(catTotal)} of ${fmt(budget)} budget (${Math.round(pct)}%).`,
        linkTo: '/budget',
      });
    } else if (pct >= 80) {
      financialEventEngine.emit('alert', {
        id: `budget_near_${newEntry.category}_${thisMonth}`,
        timestamp: now, severity: 'info', category: 'budget',
        emoji: '📊',
        title: `"${newEntry.category}" budget ${Math.round(pct)}% used`,
        body: `${fmt(budget - catTotal)} remaining this month.`,
        linkTo: '/budget',
      });
    }
  }

  // 2. Spending velocity spike
  const velocity = computeSpendingVelocity(cashflows);
  if (velocity.verdict === 'critical') {
    financialEventEngine.emit('alert', {
      id: `velocity_critical_${new Date().toISOString().slice(0, 7)}`,
      timestamp: now, severity: 'critical', category: 'cashflow',
      emoji: '🔴',
      title: 'Spending critically above pace',
      body: velocity.message,
      linkTo: '/insights',
    });
  }

  // 3. Net worth change
  const { netWorth } = calculateNetWorth(investments, liabilities);
  if (netWorth < 0) {
    financialEventEngine.emit('alert', {
      id: `negative_networth_${now}`,
      timestamp: now, severity: 'critical', category: 'risk',
      emoji: '🚨',
      title: 'Net worth is negative',
      body: `Your liabilities exceed your assets by ${fmt(Math.abs(netWorth))}.`,
      linkTo: '/liabilities',
    });
  }

  // 4. Overdue payments
  const today   = new Date().toISOString().slice(0, 10);
  const overdue = trackedPayments.filter(p => p.status === 'pending' && p.dueDate < today);
  if (overdue.length > 0 && newEntry) {
    financialEventEngine.emit('alert', {
      id: `overdue_reminder_${today}`,
      timestamp: now, severity: 'warning', category: 'cashflow',
      emoji: '🔔',
      title: `${overdue.length} overdue payment${overdue.length > 1 ? 's' : ''}`,
      body: overdue.map(p => p.title).slice(0, 3).join(', '),
      linkTo: '/payments',
    });
  }
}

export function analyseAfterPayment(payment: TrackedPayment) {
  financialEventEngine.emit('alert', {
    id: `paid_${payment.id}`,
    timestamp: Date.now(), severity: 'success', category: 'cashflow',
    emoji: '✅',
    title: `"${payment.title}" marked as paid`,
    body: `₹${Math.round(payment.amount).toLocaleString('en-IN')} payment recorded.`,
    linkTo: '/payments',
  });
}

export function analyseAfterInvestment(investment: Investment) {
  const val = currentValue(investment);
  const inv = investedValue(investment);
  const pl  = val - inv;
  if (pl !== 0) {
    financialEventEngine.emit('alert', {
      id: `inv_added_${investment.id}`,
      timestamp: Date.now(), severity: 'success', category: 'milestone',
      emoji: '📈',
      title: `Investment added: ${investment.name}`,
      body: `Current value ₹${Math.round(val).toLocaleString('en-IN')}${pl > 0 ? ` (+₹${Math.round(pl).toLocaleString('en-IN')})` : ''}.`,
      linkTo: '/investments',
    });
  }
}
