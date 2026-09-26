// src/store/slices/insuranceSlice.ts
//
// Insurance module: policies (the source of truth for a premium) and their
// payment history. Every add/update re-syncs the linked recurring Bill Reminder
// through the payments slice, and recording a premium settles that bill so the
// renewal advance, next-bill generation and cashflow entry happen exactly once.
import type { StateCreator } from 'zustand';
import { deleteDoc } from 'firebase/firestore';

import { createId } from '../../utils/id';
import { touchedDoc } from '../portfolioPersistence';
import type {
  CashflowEntry,
  InsurancePayment,
  InsurancePolicy,
} from '../../types/investmentTypes';
import {
  blockIfLimited,
  clean,
  makePersistence,
  now,
  safeCompare,
} from '../shared';
import type { PortfolioState } from '../types';

export type InsuranceSlice = Pick<
  PortfolioState,
  | 'insurancePolicies'
  | 'insurancePayments'
  | 'addInsurancePolicy'
  | 'updateInsurancePolicy'
  | 'deleteInsurancePolicy'
  | 'addInsurancePayment'
  | 'deleteInsurancePayment'
>;

export const createInsuranceSlice: StateCreator<
  PortfolioState,
  [],
  [],
  InsuranceSlice
> = (set, get) => {
  const { saveDoc } = makePersistence(get);

  return {
    insurancePolicies: [],
    insurancePayments: [],

    addInsurancePolicy: async (policy) => {
      const uid = get().uid;
      if (!uid) return;
      if (blockIfLimited('insurance', get().insurancePolicies.length)) return;
      const t = now();
      const withMeta = clean({
        ...policy,
        id: createId('ins_pol'),
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as InsurancePolicy;
      await saveDoc(uid, 'insurancePolicies', withMeta);
      set((s) => ({
        insurancePolicies: [withMeta, ...s.insurancePolicies].sort((a, b) =>
          safeCompare(a.renewalDate, b.renewalDate),
        ),
      }));
      // Insurance is the source of truth → auto-create its recurring Bill Reminder.
      await get().syncInsuranceBill(uid, withMeta);
    },

    updateInsurancePolicy: async (id, patch) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().insurancePolicies.find((x) => x.id === id);
      if (!existing) return;
      const updated = clean({
        ...existing,
        ...patch,
        id,
        updatedAt: now(),
      }) as InsurancePolicy;
      await saveDoc(uid, 'insurancePolicies', updated);
      set((s) => ({
        insurancePolicies: s.insurancePolicies.map((x) =>
          x.id === id ? updated : x,
        ),
      }));
      // Propagate premium / date / frequency changes into the linked future bill.
      await get().syncInsuranceBill(uid, updated);
    },

    deleteInsurancePolicy: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      await deleteDoc(touchedDoc(uid, 'insurancePolicies', id));
      set((s) => ({
        insurancePolicies: s.insurancePolicies.filter((x) => x.id !== id),
      }));
      // Remove the policy's PENDING bills; paid history stays untouched.
      const linkedPending = get().trackedPayments.filter(
        (p) => p.insurancePolicyId === id && p.status === 'pending',
      );
      for (const bill of linkedPending) {
        await get().deleteTrackedPayment(bill.id);
      }
    },

    addInsurancePayment: async (payment) => {
      const uid = get().uid;
      if (!uid) return;
      const t = now();

      const policy = get().insurancePolicies.find((p) => p.id === payment.policyId);
      const linkedBill = get().trackedPayments.find(
        (p) =>
          p.insurancePolicyId === payment.policyId && p.status === 'pending',
      );

      const withMeta = clean({
        ...payment,
        id: createId('inspay'),
        // Unique cross-reference to the Bill Reminder this premium settled. When
        // markTrackedPaymentPaid sees it, it skips writing its own history row —
        // so the payment is never duplicated on the Insurance side.
        trackedPaymentId: linkedBill?.id,
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as InsurancePayment;
      await saveDoc(uid, 'insurancePayments', withMeta);
      // In state BEFORE the bill is settled — the dedupe check reads the store.
      // The loaded flag is set too, so that check can't refetch and overwrite it.
      set((s) => ({
        _insurancePaymentsLoaded: true,
        insurancePayments: [withMeta, ...s.insurancePayments].sort((a, b) =>
          safeCompare(b.paidAt, a.paidAt),
        ),
      }));

      // ── Settle the linked pending Bill Reminder. markTrackedPaymentPaid
      //    writes its own cashflow entry, advances the policy renewal date and
      //    generates the next premium bill — so nothing is duplicated here. ──
      let settledByBill = false;
      if (linkedBill) {
        await get().markTrackedPaymentPaid(linkedBill.id);
        settledByBill = true;
      }

      // ── Cashflow expense entry (skipped when the bill reminder already wrote one)
      const policyName = policy?.policyName?.trim() || 'Insurance Policy';
      const cfId = `cf_inspay_${withMeta.id}`;
      const cashflowItem = clean({
        type: 'expense' as const,
        date: withMeta.paidAt,
        category: `Insurance — ${policyName} Premium`,
        amount: withMeta.amount,
        notes: withMeta.note
          ? `${policyName} premium payment · ${withMeta.note}`
          : `${policyName} premium payment`,
        id: cfId,
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as CashflowEntry;
      const alreadyInCF = settledByBill || get().cashflows.some((c) => c.id === cfId);
      if (!alreadyInCF) {
        await saveDoc(uid, 'cashflows', cashflowItem);
      }

      set((s) => ({
        cashflows: alreadyInCF
          ? s.cashflows
          : [cashflowItem, ...s.cashflows].sort((a, b) => safeCompare(b.date, a.date)),
      }));
    },

    deleteInsurancePayment: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      await deleteDoc(touchedDoc(uid, 'insurancePayments', id));
      set((s) => ({
        insurancePayments: s.insurancePayments.filter((x) => x.id !== id),
      }));
    },
  };
};
