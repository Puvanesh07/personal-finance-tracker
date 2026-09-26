// src/store/slices/liabilitiesSlice.ts
//
// Liabilities module: debts/EMIs and the receivables ledger
// (`pendingPayments`). A recorded EMI is written as an atomic batch — principal
// as a net-worth-neutral transfer and interest as a real expense — so the
// funding account and the outstanding balance can never half-apply.
import type { StateCreator } from 'zustand';
import { deleteDoc } from 'firebase/firestore';

import { createId } from '../../utils/id';
import { showUndoToast } from '../../utils/undoToast';
import { todayISO } from '../../utils/dateUtils';
import { touchedDoc } from '../portfolioPersistence';
import type {
  CashflowEntry,
  Liability,
  LiabilityPayment,
  PendingPayment,
} from '../../types/investmentTypes';
import {
  blockIfLimited,
  clean,
  makePersistence,
  now,
  round2,
  safeCompare,
} from '../shared';
import type { PortfolioState } from '../types';

export type LiabilitiesSlice = Pick<
  PortfolioState,
  | 'liabilities'
  | 'pendingPayments'
  | 'addLiability'
  | 'updateLiability'
  | 'deleteLiability'
  | 'recordLiabilityPayment'
  | 'deleteLiabilityPayment'
  | 'addPendingPayment'
  | 'updatePendingPayment'
  | 'deletePendingPayment'
  | 'markPendingPaymentReceived'
>;

export const createLiabilitiesSlice: StateCreator<
  PortfolioState,
  [],
  [],
  LiabilitiesSlice
> = (set, get) => {
  const { saveDoc, saveDocsAtomically } = makePersistence(get);

  return {
    liabilities: [],
    pendingPayments: [],

    addLiability: async (liability) => {
      const uid = get().uid;
      if (!uid) return;
      if (blockIfLimited('liabilities', get().liabilities.length)) return;
      const t = now();
      const withMeta = clean({
        ...(liability as any),
        id: createId('lia'),
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as Liability;
      await saveDoc(uid, 'liabilities', withMeta);
      set((s) => ({ liabilities: [withMeta, ...s.liabilities] }));
    },

    updateLiability: async (id, patch) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().liabilities.find((x) => x.id === id);
      if (!existing) return;
      const updated = clean({
        ...existing,
        ...(patch as any),
        id,
        updatedAt: now(),
      }) as Liability;
      await saveDoc(uid, 'liabilities', updated);
      set((s) => ({
        liabilities: s.liabilities.map((x) => (x.id === id ? updated : x)),
      }));
    },

    deleteLiability: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      const removed = get().liabilities.find((x) => x.id === id);
      await deleteDoc(touchedDoc(uid, 'liabilities', id));
      set((s) => ({ liabilities: s.liabilities.filter((x) => x.id !== id) }));
      if (removed)
        showUndoToast('Liability deleted', () =>
          get().restoreEntity('liabilities', removed),
        );
    },

    recordLiabilityPayment: async (liabilityId, payment) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().liabilities.find((x) => x.id === liabilityId);
      if (!existing) return;

      const principal = Math.max(0, Number(payment.principal) || 0);
      const interest = Math.max(0, Number(payment.interest) || 0);
      const amount = Number(payment.amount) || principal + interest;
      const paymentId = createId('lia_pay');
      const t = now();

      const pay: LiabilityPayment = clean({
        id: paymentId,
        date: payment.date,
        amount,
        principal,
        interest,
        accountId: payment.accountId,
        note: payment.note,
        createdAt: t,
      }) as LiabilityPayment;

      const newOutstanding = round2(Math.max(0, (existing.outstanding ?? 0) - principal));
      const updatedLiability = clean({
        ...existing,
        outstanding: newOutstanding,
        payments: [...(existing.payments ?? []), pay],
        ...(newOutstanding <= 0 ? { status: 'paid' as const } : {}),
        updatedAt: t,
      }) as Liability;

      // Derived cashflows only when a funding account is chosen (real money moved).
      // Principal is a `transfer` (reduces the bank, NOT spending); interest is a
      // true expense. Together the account drops by the full EMI while the debt
      // drops by principal — so net worth falls by the interest only (C1).
      const cfs: CashflowEntry[] = [];
      if (payment.accountId) {
        if (principal > 0) {
          cfs.push(clean({
            id: `cf_emip_${paymentId}`,
            type: 'transfer' as const,
            date: payment.date,
            category: `${existing.name} — Principal`,
            amount: principal,
            notes: payment.note,
            accountId: payment.accountId,
            createdAt: t,
            updatedAt: t,
            userId: uid,
          }) as CashflowEntry);
        }
        if (interest > 0) {
          cfs.push(clean({
            id: `cf_emii_${paymentId}`,
            type: 'expense' as const,
            date: payment.date,
            category: `${existing.name} — Interest`,
            amount: interest,
            notes: payment.note,
            accountId: payment.accountId,
            createdAt: t,
            updatedAt: t,
            userId: uid,
          }) as CashflowEntry);
        }
      }

      await saveDocsAtomically(uid, [
        { col: 'liabilities', data: updatedLiability },
        ...cfs.map((c) => ({ col: 'cashflows', data: c })),
      ]);

      set((s) => ({
        liabilities: s.liabilities.map((x) =>
          x.id === liabilityId ? updatedLiability : x,
        ),
        cashflows: cfs.length
          ? [...cfs, ...s.cashflows].sort((a, b) => safeCompare(b.date, a.date))
          : s.cashflows,
      }));
    },

    deleteLiabilityPayment: async (liabilityId, paymentId) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().liabilities.find((x) => x.id === liabilityId);
      if (!existing) return;
      const pay = (existing.payments ?? []).find((p) => p.id === paymentId);
      if (!pay) return;

      const restoredOutstanding = round2((existing.outstanding ?? 0) + pay.principal);
      const updatedLiability = clean({
        ...existing,
        outstanding: restoredOutstanding,
        payments: (existing.payments ?? []).filter((p) => p.id !== paymentId),
        ...(existing.status === 'paid' && restoredOutstanding > 0
          ? { status: 'active' as const }
          : {}),
        updatedAt: now(),
      }) as Liability;

      // Remove the two derived cashflows (delete on a missing doc is a no-op).
      const cfIds = [`cf_emip_${paymentId}`, `cf_emii_${paymentId}`];
      await saveDocsAtomically(
        uid,
        [{ col: 'liabilities', data: updatedLiability }],
        cfIds.map((id) => ({ col: 'cashflows', id })),
      );

      set((s) => ({
        liabilities: s.liabilities.map((x) =>
          x.id === liabilityId ? updatedLiability : x,
        ),
        cashflows: s.cashflows.filter((c) => !cfIds.includes(c.id)),
      }));
    },

    addPendingPayment: async (payment) => {
      const uid = get().uid;
      if (!uid) return;
      if (blockIfLimited('payments', get().pendingPayments.length + get().trackedPayments.length)) return;
      const t = now();
      const withMeta = clean({
        ...payment,
        id: createId('pp'),
        status: 'pending' as const,
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as PendingPayment;
      await saveDoc(uid, 'pendingPayments', withMeta);
      set((s) => ({
        pendingPayments: [withMeta, ...s.pendingPayments].sort((a, b) =>
          safeCompare(a.expectedPaymentDate, b.expectedPaymentDate),
        ),
      }));
    },

    updatePendingPayment: async (id, patch) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().pendingPayments.find((x) => x.id === id);
      if (!existing) return;
      const updated = clean({
        ...existing,
        ...(patch as Partial<PendingPayment>),
        id,
        updatedAt: now(),
      }) as PendingPayment;
      await saveDoc(uid, 'pendingPayments', updated);

      set((s) => ({
        pendingPayments: s.pendingPayments
          .map((x) => (x.id === id ? updated : x))
          .sort((a, b) =>
            safeCompare(a.expectedPaymentDate, b.expectedPaymentDate),
          ),
      }));
    },

    deletePendingPayment: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      await deleteDoc(touchedDoc(uid, 'pendingPayments', id));
      set((s) => ({
        pendingPayments: s.pendingPayments.filter((x) => x.id !== id),
      }));
    },

    markPendingPaymentReceived: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().pendingPayments.find((x) => x.id === id);
      if (!existing) return;
      if (existing.status === 'received') return;

      const receivedAt = todayISO();
      const updated = clean({
        ...existing,
        status: 'received' as const,
        receivedAt,
        updatedAt: now(),
      }) as PendingPayment;
      await saveDoc(uid, 'pendingPayments', updated);

      // ── Also write a cashflow income entry so it appears in Cashflow ────
      const cfId = `cf_receivable_${existing.id}`;
      const cashflowItem = clean({
        type: 'income' as const,
        date: receivedAt,
        category: `Receivable — ${existing.buyerName}`,
        amount: existing.amount,
        notes: existing.itemDescription
          ? `${existing.itemDescription}${existing.notes ? ` · ${existing.notes}` : ''}`
          : existing.notes,
        id: cfId,
        createdAt: now(),
        updatedAt: now(),
        userId: uid,
      }) as CashflowEntry;
      // Only add if not already present (idempotent)
      const alreadyInCF = get().cashflows.some((c) => c.id === cfId);
      if (!alreadyInCF) {
        await saveDoc(uid, 'cashflows', cashflowItem);
      }

      set((s) => ({
        pendingPayments: s.pendingPayments
          .map((x) => (x.id === id ? updated : x))
          .sort((a, b) => safeCompare(a.expectedPaymentDate, b.expectedPaymentDate)),
        cashflows: alreadyInCF
          ? s.cashflows
          : [cashflowItem, ...s.cashflows].sort((a, b) => safeCompare(b.date, a.date)),
      }));
    },
  };
};
