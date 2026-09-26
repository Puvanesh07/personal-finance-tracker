// src/store/slices/goalsSlice.ts
//
// Goals module: goal definitions and their contributions. A contribution that
// moves money between two tracked accounts emits a net-worth-neutral transfer
// cashflow in the SAME atomic batch, keyed deterministically so edits never
// duplicate and a delete reverses exactly that one entry.
import type { StateCreator } from 'zustand';
import { deleteDoc } from 'firebase/firestore';

import { createId } from '../../utils/id';
import { showUndoToast } from '../../utils/undoToast';
import { touchedDoc } from '../portfolioPersistence';
import type { Goal, GoalContribution } from '../../types/investmentTypes';
import {
  blockIfLimited,
  clean,
  goalTransferCashflow,
  makePersistence,
  now,
  safeCompare,
} from '../shared';
import type { PortfolioState } from '../types';

export type GoalsSlice = Pick<
  PortfolioState,
  | 'goals'
  | 'goalContributions'
  | 'addGoal'
  | 'updateGoal'
  | 'deleteGoal'
  | 'addGoalContribution'
  | 'deleteGoalContribution'
>;

export const createGoalsSlice: StateCreator<
  PortfolioState,
  [],
  [],
  GoalsSlice
> = (set, get) => {
  const { saveDoc, saveDocsAtomically } = makePersistence(get);

  return {
    goals: [],
    goalContributions: [],

    addGoal: async (goal) => {
      const uid = get().uid;
      if (!uid) return;
      if (blockIfLimited('goals', get().goals.length)) return;
      const t = now();
      const withMeta = clean({
        ...(goal as any),
        id: createId('goal'),
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as Goal;
      await saveDoc(uid, 'goals', withMeta);
      set((s) => ({ goals: [withMeta, ...s.goals] }));
    },

    updateGoal: async (id, patch) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().goals.find((x) => x.id === id);
      if (!existing) return;
      const updated = clean({
        ...existing,
        ...(patch as any),
        id,
        updatedAt: now(),
      }) as Goal;
      await saveDoc(uid, 'goals', updated);
      set((s) => ({ goals: s.goals.map((x) => (x.id === id ? updated : x)) }));
    },

    deleteGoal: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      const removed = get().goals.find((x) => x.id === id);
      await deleteDoc(touchedDoc(uid, 'goals', id));
      set((s) => ({ goals: s.goals.filter((x) => x.id !== id) }));
      if (removed)
        showUndoToast('Goal deleted', () =>
          get().restoreEntity('goals', removed),
        );
    },

    addGoalContribution: async (contribution) => {
      const uid = get().uid;
      if (!uid) return;
      const t = now();
      const withMeta = clean({
        ...contribution,
        id: createId('gc'),
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as GoalContribution;

      // When the contribution moves real money between two tracked accounts,
      // emit a net-worth-neutral transfer in the SAME atomic batch (C5), so the
      // ledger and the source/destination balances can never half-apply.
      const isTransfer = !!(withMeta.accountId && withMeta.toAccountId);
      const cf = isTransfer ? goalTransferCashflow(uid, withMeta) : null;
      if (cf) {
        await saveDocsAtomically(uid, [
          { col: 'goalContributions', data: withMeta },
          { col: 'cashflows', data: cf },
        ]);
      } else {
        await saveDoc(uid, 'goalContributions', withMeta);
      }

      set((s) => ({
        goalContributions: [withMeta, ...s.goalContributions].sort((a, b) =>
          safeCompare(b.date, a.date),
        ),
        ...(cf
          ? {
              cashflows: [cf, ...s.cashflows].sort((a, b) =>
                safeCompare(b.date, a.date),
              ),
            }
          : {}),
      }));
    },

    deleteGoalContribution: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      const cfId = `cf_goal_${id}`;
      const hadTransfer = get().cashflows.some((c) => c.id === cfId);
      if (hadTransfer) {
        await saveDocsAtomically(uid, [], [
          { col: 'goalContributions', id },
          { col: 'cashflows', id: cfId },
        ]);
      } else {
        await deleteDoc(touchedDoc(uid, 'goalContributions', id));
      }
      set((s) => ({
        goalContributions: s.goalContributions.filter((x) => x.id !== id),
        cashflows: s.cashflows.filter((c) => c.id !== cfId),
      }));
    },
  };
};
