// src/store/slices/snapshotsSlice.ts
//
// Point-in-time reporting module: the net-worth snapshot (a read-only roll-up of
// every other module) and the capped AI insight snapshot store. This slice only
// reads across modules — it never mutates another collection.
import type { StateCreator } from 'zustand';
import { getDocs, limit, orderBy, query, writeBatch } from 'firebase/firestore';

import { createId } from '../../utils/id';
import { todayISO } from '../../utils/dateUtils';
import {
  calculateNetWorth,
  getLiveBankTotal,
  summarizePortfolio,
} from '../../utils/calculations';
import { db, userCol } from '../portfolioPersistence';
import type {
  InsightSnapshot,
  NetWorthSnapshot,
  SipBudgetPlan,
  SipInstrumentPlan,
} from '../../types/investmentTypes';
import { clean, makePersistence, now } from '../shared';
import type { PortfolioState } from '../types';

export type SnapshotsSlice = Pick<
  PortfolioState,
  'networthSnapshots' | 'latestInsight' | 'takeNetWorthSnapshot' | 'saveInsightSnapshot'
>;

export const createSnapshotsSlice: StateCreator<
  PortfolioState,
  [],
  [],
  SnapshotsSlice
> = (set, get) => {
  const { saveDoc } = makePersistence(get);

  return {
    networthSnapshots: [],
    latestInsight: null,

    takeNetWorthSnapshot: async (label) => {
      const uid = get().uid;
      if (!uid) return;
      const state = get();

      // ── Core net worth ───────────────────────────────────────────────────────
      const { totalAssets, totalLiabilities, netWorth, receivablesTotal, receivablesPrincipal, receivablesInterest } = calculateNetWorth(
        state.investments,
        state.liabilities,
        state.pendingPayments,
        state.accounts,
        state.cashflows,
      );

      // ── Investment breakdown ─────────────────────────────────────────────────
      const portfolioSummary = summarizePortfolio(state.investments);
      const realizedProfit = (state.soldTrades ?? []).reduce((s, t) => s + (t.profit || 0), 0);

      // ── Cashflow — current month ─────────────────────────────────────────────
      const todayStr = todayISO();
      const ym = todayStr.slice(0, 7); // "YYYY-MM"
      const thisMonthCf = (state.cashflows ?? []).filter((c) => (c.date ?? '').startsWith(ym));
      const monthIncome = thisMonthCf.filter((c) => c.type === 'income').reduce((s, c) => s + c.amount, 0);
      const monthExpense = thisMonthCf.filter((c) => c.type === 'expense').reduce((s, c) => s + c.amount, 0);

      // ── Liquid cash ──────────────────────────────────────────────────────────
      const accountBalance = getLiveBankTotal(state.accounts ?? [], state.cashflows ?? []);

      // ── Goals ────────────────────────────────────────────────────────────────
      const goals = state.goals ?? [];
      const goalsSaved = goals.reduce((s, g) => s + (g.currentAmount || 0), 0);
      const goalsTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
      const goalsProgress = goalsTarget > 0 ? Math.min(100, (goalsSaved / goalsTarget) * 100) : 0;

      // ── Insurance ────────────────────────────────────────────────────────────
      const insurancePolicies = state.insurancePolicies ?? [];
      const insuranceCoverage = insurancePolicies.reduce((s, p) => s + (p.coverageAmount || 0), 0);

      // ── SIP ──────────────────────────────────────────────────────────────────
      const sipPlans = state.sipPlans ?? [];
      const sipBudget = sipPlans.find(
        (x): x is SipBudgetPlan => x.type === 'budget',
      );
      const sipInstruments = sipPlans.filter(
        (x): x is SipInstrumentPlan => x.type === 'instrument',
      );
      const sipMonthlyBudget = sipBudget?.budget || 0;

      // ── Liabilities breakdown ────────────────────────────────────────────────
      const activeLiabilities = (state.liabilities ?? []).filter(
        (l) => l.status !== 'paid' && l.status !== 'returned',
      );
      const totalEmiMonthly = activeLiabilities.reduce((s, l) => s + (l.emiAmount || 0), 0);

      const date = todayStr;
      const t = now();
      const deterministicId = label?.trim() ? createId('nws') : `networthSnapshot_${date}`;

      const snap: NetWorthSnapshot = clean({
        id: deterministicId,
        createdAt: t,
        userId: uid,
        ...(label?.trim() ? { label: label.trim() } : {}),
        // Core
        totalAssets,
        totalLiabilities,
        netWorth,
        // Investments
        investmentValue: portfolioSummary.totalValue,
        investedTotal: portfolioSummary.investedTotal,
        unrealizedPnl: portfolioSummary.profitLossTotal,
        realizedProfit,
        // Cashflow
        monthIncome,
        monthExpense,
        monthNet: monthIncome - monthExpense,
        // Cash
        accountBalance,
        // Goals
        goalsProgress,
        goalsCount: goals.length,
        goalsSaved,
        goalsTarget,
        // Insurance
        insuranceCoverage,
        insurancePoliciesCount: insurancePolicies.length,
        // SIP
        sipMonthlyBudget,
        sipInstrumentsCount: sipInstruments.length,
        // Liabilities
        liabilitiesCount: activeLiabilities.length,
        totalEmiMonthly,
        // Receivables
        receivablesTotal,
        receivablesPrincipal,
        receivablesInterest,
        receivablesCount: (state.pendingPayments ?? []).filter((p) => p.status !== 'received').length,
      }) as NetWorthSnapshot;

      await saveDoc(uid, 'networthSnapshots', snap);
      set((s) => ({
        networthSnapshots: [
          snap,
          ...s.networthSnapshots.filter((x) => x.id !== snap.id),
        ],
      }));
    },

    saveInsightSnapshot: async (data) => {
      const uid = get().uid;
      if (!uid) return;
      const t = now();
      const snapshot = clean({
        ...data,
        id: createId('ins'),
        userId: uid,
        createdAt: t,
      }) as InsightSnapshot;
      await saveDoc(uid, 'insights', snapshot);
      // Delete any older insight docs — cap the collection to 1 document
      try {
        const older = await getDocs(
          query(userCol(uid, 'insights'), orderBy('createdAt', 'desc'), limit(10)),
        );
        const toDelete = older.docs.slice(1); // keep only the newest
        if (toDelete.length > 0) {
          const batch = writeBatch(db);
          toDelete.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch {
        // Non-critical — ignore cleanup errors
      }
      set({ latestInsight: snapshot });
    },
  };
};
