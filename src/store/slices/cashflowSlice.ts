// src/store/slices/cashflowSlice.ts
//
// Cashflow module: income/expense/transfer entries and the bulk statement
// import/rollback. Balance maths stays on the read side (calcLiveAccountBalances);
// writes here never touch `accounts.balance` on purpose.
import type { StateCreator } from 'zustand';
import { deleteDoc } from 'firebase/firestore';

import { createId } from '../../utils/id';
import { showUndoToast } from '../../utils/undoToast';
import { analyseAfterTransaction } from '../../services/financialEventEngine';
import { touchedDoc } from '../portfolioPersistence';
import type { CashflowEntry } from '../../types/investmentTypes';
import {
  blockIfLimited,
  clean,
  makePersistence,
  now,
  safeCompare,
} from '../shared';
import type { PortfolioState } from '../types';

export type CashflowSlice = Pick<
  PortfolioState,
  | 'cashflows'
  | 'addCashflow'
  | 'updateCashflow'
  | 'deleteCashflow'
  | 'deleteCashflows'
  | 'importCashflows'
  | 'deleteCashflowsByBatch'
>;

export const createCashflowSlice: StateCreator<
  PortfolioState,
  [],
  [],
  CashflowSlice
> = (set, get) => {
  const { saveDoc, saveDocsAtomically } = makePersistence(get);

  return {
    cashflows: [],

    addCashflow: async (entry) => {
      const uid = get().uid;
      if (!uid) return;
      if (blockIfLimited('cashflows', get().cashflows.length)) return;
      const t = now();
      const withMeta = clean({
        ...entry,
        id: createId('cf'),
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as CashflowEntry;
      await saveDoc(uid, 'cashflows', withMeta);

      // NOTE: no account-balance write here on purpose. `balance` is an anchor the
      // user sets; the live figure every screen uses is opening balance ± linked
      // cashflows (calcLiveAccountBalances). Folding the delta into `balance` on
      // add double-counted it, and neither edit nor delete ever put it back.
      set((s) => ({
        cashflows: [withMeta, ...s.cashflows].sort((a, b) =>
          safeCompare(b.date, a.date),
        ),
      }));
      // ── Fire event engine ────────────────────────────────────────────────
      void analyseAfterTransaction(
        get().cashflows, get().investments, get().liabilities, get().trackedPayments, withMeta,
        get().accounts, get().pendingPayments,
      );
    },

    updateCashflow: async (id, patch) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().cashflows.find((x) => x.id === id);
      if (!existing) return;
      const updated = clean({
        ...existing,
        ...patch,
        id,
        updatedAt: now(),
      }) as CashflowEntry;
      await saveDoc(uid, 'cashflows', updated);

      set((s) => ({
        cashflows: s.cashflows.map((x) => (x.id === id ? updated : x)),
      }));
    },

    deleteCashflow: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      const removed = get().cashflows.find((x) => x.id === id);
      await deleteDoc(touchedDoc(uid, 'cashflows', id));
      set((s) => ({
        cashflows: s.cashflows.filter((x) => x.id !== id),
      }));
      if (removed)
        showUndoToast('Transaction deleted', () =>
          get().restoreEntity('cashflows', removed),
        );
    },

    deleteCashflows: async (ids) => {
      const uid = get().uid;
      if (!uid || ids.length === 0) return;
      const idSet = new Set(ids);
      const removed = get().cashflows.filter((x) => idSet.has(x.id));
      await Promise.all(
        ids.map((id) => deleteDoc(touchedDoc(uid, 'cashflows', id))),
      );
      set((s) => ({
        cashflows: s.cashflows.filter((x) => !idSet.has(x.id)),
      }));
      if (removed.length)
        showUndoToast(
          `${removed.length} transaction${removed.length > 1 ? 's' : ''} deleted`,
          async () => {
            for (const cf of removed) await get().restoreEntity('cashflows', cf);
          },
        );
    },

    importCashflows: async (drafts, importBatchId) => {
      const uid = get().uid;
      if (!uid || drafts.length === 0) return { imported: 0 };
      // Honor the same trial gates addCashflow enforces — stop at the first
      // blocked row (one toast, not one per remaining row).
      const accepted: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>[] =
        [];
      for (const d of drafts) {
        if (blockIfLimited('cashflows', get().cashflows.length + accepted.length))
          break;
        accepted.push(d);
      }
      if (accepted.length === 0) return { imported: 0 };
      const t = now();
      const withMeta = accepted.map(
        (entry) =>
          clean({
            ...entry,
            id: createId('cf'),
            createdAt: t,
            updatedAt: t,
            userId: uid,
            importBatchId,
          }) as CashflowEntry,
      );
      // Firestore caps a batch at ~500 writes, so commit in chunks — each chunk
      // is still all-or-nothing, and mirroring a chunk into state only after it
      // commits keeps the UI truthful if a later chunk fails.
      for (let i = 0; i < withMeta.length; i += 400) {
        const chunk = withMeta.slice(i, i + 400);
        await saveDocsAtomically(
          uid,
          chunk.map((c) => ({ col: 'cashflows', data: c })),
        );
        set((s) => ({
          cashflows: [...chunk, ...s.cashflows].sort((a, b) =>
            safeCompare(b.date, a.date),
          ),
        }));
      }
      return { imported: withMeta.length };
    },

    deleteCashflowsByBatch: async (importBatchId) => {
      const uid = get().uid;
      if (!uid || !importBatchId) return { removed: 0 };
      const removed = get().cashflows.filter(
        (x) => x.importBatchId === importBatchId,
      );
      if (removed.length === 0) return { removed: 0 };
      const idSet = new Set(removed.map((x) => x.id));
      for (let i = 0; i < removed.length; i += 400) {
        const chunk = removed.slice(i, i + 400);
        await saveDocsAtomically(
          uid,
          [],
          chunk.map((x) => ({ col: 'cashflows', id: x.id })),
        );
      }
      set((s) => ({ cashflows: s.cashflows.filter((x) => !idSet.has(x.id)) }));
      showUndoToast(
        `Import of ${removed.length} transaction${removed.length > 1 ? 's' : ''} removed`,
        async () => {
          for (const cf of removed) await get().restoreEntity('cashflows', cf);
        },
      );
      return { removed: removed.length };
    },
  };
};
