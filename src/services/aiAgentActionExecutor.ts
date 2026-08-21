/**
 * src/services/aiAgentActionExecutor.ts
 *
 * Executes a confirmed ParsedAction against the Zustand store.
 * Called ONLY after the user taps "Confirm" in the ActionConfirmCard.
 */

import { usePortfolioStore } from '../store/portfolioStore';
import type { ParsedAction } from './aiAgentActionParser';

export interface ExecuteResult {
  success: boolean;
  message: string;
  /** Route the user can navigate to after success */
  linkTo?: string;
}

export async function executeAction(action: ParsedAction): Promise<ExecuteResult> {
  const store = usePortfolioStore.getState();

  try {
    switch (action.kind) {

      // ── Add cashflow (income or expense) ───────────────────────────────────
      case 'add_cashflow_income':
      case 'add_cashflow_expense': {
        await store.addCashflow({
          type:     action.kind === 'add_cashflow_income' ? 'income' : 'expense',
          date:     action.date,
          category: action.category,
          amount:   action.amount,
          ...(action.notes ? { notes: action.notes } : {}),
        });
        const label = action.kind === 'add_cashflow_income' ? 'Income' : 'Expense';
        return {
          success: true,
          message: `✅ ${label} of ₹${action.amount.toLocaleString('en-IN')} (${action.category}) added for ${action.date}.`,
          linkTo: '/cashflow',
        };
      }

      // ── Add payment reminder ───────────────────────────────────────────────
      case 'add_payment': {
        await store.addTrackedPayment({
          title:        action.title,
          amount:       action.amount,
          dueDate:      action.dueDate,
          paymentType:  action.paymentType as import('../types/investmentTypes').PaymentTrackerType,
          recurrence:   action.recurrence,
          reminderDays: [1, 3],
        });
        return {
          success: true,
          message: `✅ Payment reminder "${action.title}" of ₹${action.amount.toLocaleString('en-IN')} added, due ${action.dueDate}.`,
          linkTo: '/payments',
        };
      }

      // ── Add goal ───────────────────────────────────────────────────────────
      case 'add_goal': {
        await store.addGoal({
          name:          action.name,
          targetAmount:  action.targetAmount,
          currentAmount: 0,
          status:        'active',
          ...(action.dueDate ? { dueDate: action.dueDate } : {}),
        });
        return {
          success: true,
          message: `✅ Goal "${action.name}" with target ₹${action.targetAmount.toLocaleString('en-IN')} created.`,
          linkTo: '/goals',
        };
      }

      // ── Add liability ──────────────────────────────────────────────────────
      case 'add_liability': {
        await store.addLiability({
          type:        action.type,
          name:        action.name,
          principal:   action.principal,
          outstanding: action.outstanding,
          status:      'active',
          ...(action.interestRate !== undefined ? { interestRate: action.interestRate } : {}),
          ...(action.emiAmount    !== undefined ? { emiAmount: action.emiAmount }    : {}),
        });
        return {
          success: true,
          message: `✅ Liability "${action.name}" of ₹${action.principal.toLocaleString('en-IN')} added.`,
          linkTo: '/liabilities',
        };
      }

      // ── Mark payment as paid ───────────────────────────────────────────────
      case 'mark_payment_paid': {
        const hint    = action.titleHint.toLowerCase();
        const pending = store.trackedPayments.filter(
          (p) => p.status === 'pending' && p.title.toLowerCase().includes(hint),
        );

        if (!pending.length) {
          return {
            success: false,
            message: `❌ No pending payment matching "${action.titleHint}" found. Check the Payments page.`,
            linkTo: '/payments',
          };
        }

        // Mark the soonest due one
        const target = pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        await store.markTrackedPaymentPaid(target.id);
        return {
          success: true,
          message: `✅ "${target.title}" (₹${target.amount.toLocaleString('en-IN')}) marked as paid.`,
          linkTo: '/payments',
        };
      }

      default:
        return { success: false, message: '❌ Unknown action type.' };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Trial limit / subscription errors come through as toast-friendly messages
    return { success: false, message: `❌ ${msg}` };
  }
}
