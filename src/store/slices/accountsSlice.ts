// src/store/slices/accountsSlice.ts
//
// Bank / wallet accounts module. `balance` is a stored anchor; every consumer
// derives the live figure via calcLiveAccountBalances, so edits here keep the
// anchor and its mirror consistent (and the built-in Cash-in-Hand re-anchors its
// opening balance so the live value lands on the entered amount).
import type { StateCreator } from 'zustand';
import { deleteDoc } from 'firebase/firestore';

import { createId } from '../../utils/id';
import { showUndoToast } from '../../utils/undoToast';
import { todayISO } from '../../utils/dateUtils';
import {
  calcLiveAccountBalances,
  IN_HAND_CASH_ID,
  IN_HAND_CASH_NAME,
} from '../../utils/calculations';
import { touchedDoc } from '../portfolioPersistence';
import type { Account } from '../../types/investmentTypes';
import {
  blockIfLimited,
  clean,
  makePersistence,
  now,
} from '../shared';
import type { PortfolioState } from '../types';

export type AccountsSlice = Pick<
  PortfolioState,
  'accounts' | 'addAccount' | 'updateAccount' | 'deleteAccount' | 'setInHandAmount'
>;

export const createAccountsSlice: StateCreator<
  PortfolioState,
  [],
  [],
  AccountsSlice
> = (set, get) => {
  const { saveDoc } = makePersistence(get);

  return {
    accounts: [],

    addAccount: async (account) => {
      const uid = get().uid;
      if (!uid) return;
      // The built-in Cash-in-Hand record never uses up a plan slot.
      const usedSlots = get().accounts.filter((a) => a.id !== IN_HAND_CASH_ID).length;
      if (blockIfLimited('accounts', usedSlots)) return;
      const t = now();
      const raw = clean({
        ...account,
        id: createId('acc'),
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as Account;
      await saveDoc(uid, 'accounts', raw);
      set((s) => ({ accounts: [raw, ...s.accounts] }));
    },

    updateAccount: async (id, patch) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().accounts.find((x) => x.id === id);
      if (!existing) return;
      const cutoffMoved =
        patch.openingBalanceDate !== undefined &&
        patch.openingBalanceDate !== existing.openingBalanceDate;
      const raw = clean({
        ...existing,
        ...patch,
        id,
        // `balance` is only a mirror of the anchor (see calcLiveAccountBalances),
        // so it follows openingBalance instead of drifting away from it.
        balance: patch.openingBalance ?? patch.balance ?? existing.balance,
        updatedAt: now(),
        ...(cutoffMoved ? { cutoffChangedAt: now() } : {}),
      }) as Account;
      await saveDoc(uid, 'accounts', raw);
      set((s) => ({ accounts: s.accounts.map((x) => (x.id === id ? raw : x)) }));
    },

    deleteAccount: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      // Cash in Hand is part of the model, not a user account — clear it instead.
      if (id === IN_HAND_CASH_ID) return get().setInHandAmount(0);
      const removed = get().accounts.find((x) => x.id === id);
      await deleteDoc(touchedDoc(uid, 'accounts', id));
      set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) }));
      if (removed)
        showUndoToast('Account deleted', () =>
          get().restoreEntity('accounts', removed),
        );
    },

    setInHandAmount: async (amount) => {
      const uid = get().uid;
      if (!uid) return;
      const value = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
      const t = now();
      const existing = get().accounts.find((a) => a.id === IN_HAND_CASH_ID);

      if (!existing) {
        const created = clean({
          id: IN_HAND_CASH_ID,
          name: IN_HAND_CASH_NAME,
          type: 'cash' as const,
          balance: value,
          openingBalance: value,
          openingBalanceDate: todayISO(),
          createdAt: t,
          updatedAt: t,
          userId: uid,
        }) as Account;
        await saveDoc(uid, 'accounts', created);
        set((s) => ({ accounts: [created, ...s.accounts] }));
        return;
      }

      // Re-anchor the opening balance so the *live* balance (opening ± linked
      // cashflow entries) lands exactly on the entered figure — cash spent from
      // this account is still tracked like any other account.
      const live = calcLiveAccountBalances(get().accounts, get().cashflows);
      const currentOpening = existing.openingBalance ?? existing.balance ?? 0;
      const cashflowDelta = (live[existing.id] ?? currentOpening) - currentOpening;
      const openingBalance = Math.round((value - cashflowDelta) * 100) / 100;

      const updated = clean({
        ...existing,
        name: existing.name || IN_HAND_CASH_NAME,
        type: 'cash' as const,
        balance: value,
        openingBalance,
        updatedAt: t,
      }) as Account;
      await saveDoc(uid, 'accounts', updated);
      set((s) => ({
        accounts: s.accounts.map((x) => (x.id === updated.id ? updated : x)),
      }));
    },
  };
};
