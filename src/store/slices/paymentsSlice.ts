// src/store/slices/paymentsSlice.ts
//
// Bill Reminders module (`trackedPayments`): the CRUD, the "mark paid" flow that
// writes the derived cashflow, advances a linked insurance policy and mints the
// next recurring bill, plus the insurance↔bill sync helper. The sync helper is
// owned here because it writes `trackedPayments`, but the insurance slice drives
// it (insurance is the source of truth for a premium bill).
import type { StateCreator } from 'zustand';
import { deleteDoc } from 'firebase/firestore';

import { createId } from '../../utils/id';
import { showUndoToast } from '../../utils/undoToast';
import { todayISO } from '../../utils/dateUtils';
import {
  nextDueDate,
  nextSeriesAmount,
  withinSeriesEnd,
} from '../../utils/paymentTracker';
import { analyseAfterPayment } from '../../services/financialEventEngine';
import { touchedDoc } from '../portfolioPersistence';
import type {
  CashflowEntry,
  InsurancePayment,
  InsurancePolicy,
  TrackedPayment,
} from '../../types/investmentTypes';
import {
  blockIfLimited,
  clean,
  makePersistence,
  now,
  PREMIUM_RECURRENCE,
  safeCompare,
} from '../shared';
import type { PortfolioState } from '../types';

export type PaymentsSlice = Pick<
  PortfolioState,
  | 'trackedPayments'
  | 'addTrackedPayment'
  | 'updateTrackedPayment'
  | 'deleteTrackedPayment'
  | 'markTrackedPaymentPaid'
  | 'syncInsuranceBill'
>;

export const createPaymentsSlice: StateCreator<
  PortfolioState,
  [],
  [],
  PaymentsSlice
> = (set, get) => {
  const { saveDoc } = makePersistence(get);

  return {
    trackedPayments: [],

    // Create-or-update the pending Bill Reminder linked to an insurance policy.
    // Idempotent — one linked pending bill per policy, so no duplicates.
    syncInsuranceBill: async (uid, policy) => {
      if (!policy.renewalDate || !(policy.premiumAmount > 0)) return;
      const recurrence = PREMIUM_RECURRENCE[policy.premiumFrequency] ?? 'yearly';
      const title = `Insurance Premium — ${policy.policyName || policy.provider || 'Policy'}`;
      const linked = get().trackedPayments.find(
        (p) => p.insurancePolicyId === policy.id && p.status === 'pending',
      );
      if (linked) {
        const updated = clean({
          ...linked,
          title,
          paymentType: 'insurance' as const,
          amount: policy.premiumAmount,
          dueDate: policy.renewalDate,
          recurrence,
          endDate: policy.maturityDate,
          // A premium change re-anchors the escalation base for future bills.
          seriesStartDate: policy.renewalDate,
          seriesBaseAmount: policy.premiumAmount,
          notes: `Auto-synced from insurance policy ${policy.policyNumber || policy.id}`,
          insurancePolicyId: policy.id,
          updatedAt: now(),
        }) as TrackedPayment;
        await saveDoc(uid, 'trackedPayments', updated);
        set((s) => ({
          trackedPayments: s.trackedPayments
            .map((x) => (x.id === updated.id ? updated : x))
            .sort((a, b) => safeCompare(a.dueDate, b.dueDate)),
        }));
        return;
      }
      const t = now();
      const bill = clean({
        id: createId('tp'),
        title,
        paymentType: 'insurance' as const,
        amount: policy.premiumAmount,
        dueDate: policy.renewalDate,
        status: 'pending' as const,
        reminderDays: [1, 3, 7],
        recurrence,
        endDate: policy.maturityDate,
        seriesStartDate: policy.renewalDate,
        seriesIndex: 0,
        seriesBaseAmount: policy.premiumAmount,
        insurancePolicyId: policy.id,
        notes: `Auto-created from insurance policy ${policy.policyNumber || policy.id}`,
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as TrackedPayment;
      await saveDoc(uid, 'trackedPayments', bill);
      set((s) => ({
        trackedPayments: [...s.trackedPayments, bill].sort((a, b) =>
          safeCompare(a.dueDate, b.dueDate),
        ),
      }));
    },

    addTrackedPayment: async (payment) => {
      const uid = get().uid;
      if (!uid) return;
      if (blockIfLimited('payments', get().pendingPayments.length + get().trackedPayments.length)) return;
      const t = now();
      const recurring = (payment.recurrence ?? 'none') !== 'none';
      const withMeta = clean({
        ...payment,
        reminderDays: payment.reminderDays?.length
          ? payment.reminderDays
          : [1, 3, 7],
        recurrence: payment.recurrence ?? 'none',
        // Anchor a new recurring series at its first bill so later amounts
        // escalate from the starting amount, never from drifted values.
        ...(recurring
          ? {
              seriesStartDate: payment.dueDate,
              seriesIndex: 0,
              seriesBaseAmount: payment.amount,
            }
          : {}),
        id: createId('tp'),
        status: 'pending' as const,
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as TrackedPayment;
      await saveDoc(uid, 'trackedPayments', withMeta);
      set((s) => ({
        trackedPayments: [...s.trackedPayments, withMeta].sort((a, b) =>
          safeCompare(a.dueDate, b.dueDate),
        ),
      }));
    },

    updateTrackedPayment: async (id, patch) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().trackedPayments.find((x) => x.id === id);
      if (!existing) return;
      let updated = clean({
        ...existing,
        ...(patch as Partial<TrackedPayment>),
        id,
        updatedAt: now(),
      }) as TrackedPayment;
      // Editing the FIRST bill of a series re-anchors the escalation base;
      // already-created historical bills are separate docs and stay untouched.
      if (
        updated.recurrence !== 'none' &&
        (updated.seriesIndex ?? 0) === 0
      ) {
        updated = clean({
          ...updated,
          seriesStartDate: updated.dueDate,
          seriesBaseAmount: updated.amount,
        }) as TrackedPayment;
      }
      await saveDoc(uid, 'trackedPayments', updated);
      set((s) => ({
        trackedPayments: s.trackedPayments
          .map((x) => (x.id === id ? updated : x))
          .sort((a, b) => safeCompare(a.dueDate, b.dueDate)),
      }));
    },

    deleteTrackedPayment: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      const removed = get().trackedPayments.find((x) => x.id === id);
      await deleteDoc(touchedDoc(uid, 'trackedPayments', id));
      set((s) => ({
        trackedPayments: s.trackedPayments.filter((x) => x.id !== id),
      }));
      if (removed)
        showUndoToast('Payment reminder deleted', () =>
          get().restoreEntity('trackedPayments', removed),
        );
    },

    markTrackedPaymentPaid: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().trackedPayments.find((x) => x.id === id);
      if (!existing) return;
      const paidAt = todayISO();
      const updated = clean({
        ...existing,
        status: 'paid' as const,
        paidAt,
        updatedAt: now(),
      }) as TrackedPayment;
      await saveDoc(uid, 'trackedPayments', updated);

      // ── Also write a cashflow expense entry so it appears in Cashflow ────
      const cfId = `cf_payment_${existing.id}`;
      const cashflowItem = clean({
        type: 'expense' as const,
        date: paidAt,
        category: existing.title || existing.paymentType || 'Payment',
        amount: existing.amount,
        notes: existing.notes,
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

      const nextDate =
        existing.recurrence !== 'none'
          ? nextDueDate(existing.dueDate, existing.recurrence)
          : null;
      // Stop generating once the series end date is reached.
      const nextIndex = (existing.seriesIndex ?? 0) + 1;
      const canGenerate =
        nextDate !== null && withinSeriesEnd(existing.endDate, nextDate);

      // ── Insurance-linked bill paid → advance the policy (source of truth) ──
      let policyPatch: Partial<InsurancePolicy> | null = null;
      let policyIdToSync: string | null = null;
      let premiumPayment: InsurancePayment | null = null;
      if (existing.insurancePolicyId) {
        const pol = get().insurancePolicies.find(
          (p) => p.id === existing.insurancePolicyId,
        );
        if (pol) {
          const recurrence = PREMIUM_RECURRENCE[pol.premiumFrequency] ?? 'yearly';
          let renewal = pol.renewalDate;
          // Advance renewalDate past the paid bill (handles missed/edited bills).
          for (let i = 0; i < 400 && renewal <= existing.dueDate; i++) {
            const nxt = nextDueDate(renewal, recurrence);
            if (!nxt) break;
            renewal = nxt;
          }
          policyPatch = { renewalDate: renewal, lastPaymentDate: paidAt };
          policyIdToSync = pol.id;

          // ── Mirror it into the policy's Payment History too, so "mark paid" in
          //    Bill Reminder is visible on the Insurance side. The bill id is the
          //    unique reference: if the premium was already recorded from the
          //    Insurance page (addInsurancePayment settles the bill there), this
          //    is skipped and no second payment row is created. ──
          // Payments are lazy-loaded, so make sure the dedupe check sees them all.
          await get().loadInsurancePayments();
          const alreadyLogged = get().insurancePayments.some(
            (p) => p.trackedPaymentId === existing.id,
          );
          if (!alreadyLogged) {
            premiumPayment = clean({
              id: createId('inspay'),
              policyId: pol.id,
              amount: existing.amount,
              paidAt,
              note: 'Marked paid from Bill Reminders',
              trackedPaymentId: existing.id,
              createdAt: now(),
              updatedAt: now(),
              userId: uid,
            }) as InsurancePayment;
            await saveDoc(uid, 'insurancePayments', premiumPayment);
          }
        }
      }

      const nextPayments: TrackedPayment[] = [];
      if (nextDate && canGenerate) {
        const t = now();
        const next = clean({
          title: existing.title,
          paymentType: existing.paymentType,
          amount: nextSeriesAmount(existing, nextDate, nextIndex),
          dueDate: nextDate,
          reminderDays: existing.reminderDays,
          recurrence: existing.recurrence,
          endDate: existing.endDate,
          increaseAmount: existing.increaseAmount,
          increaseEvery: existing.increaseEvery,
          seriesStartDate: existing.seriesStartDate ?? existing.dueDate,
          seriesIndex: nextIndex,
          seriesBaseAmount: existing.seriesBaseAmount ?? existing.amount,
          insurancePolicyId: existing.insurancePolicyId,
          notes: existing.notes,
          id: createId('tp'),
          status: 'pending' as const,
          createdAt: t,
          updatedAt: t,
          userId: uid,
        }) as TrackedPayment;
        await saveDoc(uid, 'trackedPayments', next);
        nextPayments.push(next);
      }

      set((s) => ({
        trackedPayments: s.trackedPayments
          .map((x) => (x.id === id ? updated : x))
          .concat(nextPayments)
          .sort((a, b) => safeCompare(a.dueDate, b.dueDate)),
        cashflows: alreadyInCF
          ? s.cashflows
          : [cashflowItem, ...s.cashflows].sort((a, b) => safeCompare(b.date, a.date)),
        // Mirror of the paid bill into Insurance Payment History (if any).
        insurancePayments: premiumPayment
          ? [premiumPayment, ...s.insurancePayments].sort((a, b) =>
              safeCompare(b.paidAt, a.paidAt),
            )
          : s.insurancePayments,
      }));

      // Persist the advanced policy and re-sync its next premium bill.
      if (policyIdToSync && policyPatch) {
        await get().updateInsurancePolicy(policyIdToSync, policyPatch);
      }

      void analyseAfterPayment(existing);
    },
  };
};
