/**
 * src/services/aiAgentActionExecutor.ts
 *
 * Executes a confirmed ParsedAction against the Zustand store.
 * Called ONLY after the user taps "Confirm" in the ActionConfirmCard.
 *
 * Covers all CRUD operations:
 *   CREATE  — cashflow, payment, goal, liability, investment, insurance,
 *              account, lending (borrower + transaction)
 *   UPDATE  — payment, goal, liability, investment
 *   DELETE  — payment, goal, liability, investment, insurance, account,
 *              lending borrower
 *   OTHER   — mark_payment_paid, search_records
 */

import { usePortfolioStore } from '../store/portfolioStore';
import type { ParsedAction } from './aiAgentActionParser';

export interface ExecuteResult {
  success: boolean;
  message: string;
  linkTo?: string;
}

const fmt = (n: number) => n.toLocaleString('en-IN');

export async function executeAction(action: ParsedAction): Promise<ExecuteResult> {
  const store = usePortfolioStore.getState();

  try {
    switch (action.kind) {

      // ── ADD cashflow ───────────────────────────────────────────────────────
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
          message: `✅ ${label} of ₹${fmt(action.amount)} (${action.category}) added for ${action.date}.`,
          linkTo: '/cashflow',
        };
      }

      // ── ADD payment ────────────────────────────────────────────────────────
      case 'add_payment': {
        await store.addTrackedPayment({
          title:        action.title,
          amount:       action.amount,
          dueDate:      action.dueDate,
          paymentType:  action.paymentType as import('../types/investmentTypes').PaymentTrackerType,
          recurrence:   action.recurrence,
          reminderDays: [1, 3, 7],
          ...(action.notes ? { notes: action.notes } : {}),
        });
        return {
          success: true,
          message: `✅ Payment "${action.title}" of ₹${fmt(action.amount)} added — due ${action.dueDate}.`,
          linkTo: '/payments',
        };
      }

      // ── ADD goal ───────────────────────────────────────────────────────────
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
          message: `✅ Goal "${action.name}" created — target ₹${fmt(action.targetAmount)}${action.dueDate ? ` by ${action.dueDate}` : ''}.`,
          linkTo: '/goals',
        };
      }

      // ── ADD liability ──────────────────────────────────────────────────────
      case 'add_liability': {
        await store.addLiability({
          type:        action.type,
          name:        action.name,
          principal:   action.principal,
          outstanding: action.outstanding,
          status:      'active',
          ...(action.interestRate !== undefined ? { interestRate: action.interestRate } : {}),
          ...(action.emiAmount    !== undefined ? { emiAmount:    action.emiAmount }    : {}),
        });
        return {
          success: true,
          message: `✅ Liability "${action.name}" of ₹${fmt(action.principal)} added.`,
          linkTo: '/liabilities',
        };
      }

      // ── ADD investment ─────────────────────────────────────────────────────
      case 'add_investment': {
        const baseFields = {
          name:     action.name,
          status:   'active' as const,
          platform: action.platform ?? 'manual',
          ...(action.notes ? { notes: action.notes } : {}),
        };

        if (action.investmentType === 'stock') {
          await store.addInvestment({
            type:         'stock',
            symbol:       action.symbol ?? action.name,
            quantity:     action.quantity ?? 0,
            buyPrice:     action.buyPrice ?? 0,
            currentPrice: action.currentPrice ?? action.buyPrice ?? 0,
            ...baseFields,
          } as any);
          return {
            success: true,
            message: `✅ Stock ${action.name} added — ${action.quantity} shares @ ₹${fmt(action.buyPrice ?? 0)}.`,
            linkTo: '/investments',
          };
        }

        if (action.investmentType === 'mutual_fund') {
          await store.addInvestment({
            type:           'mutual_fund',
            units:          action.units ?? 0,
            nav:            action.nav ?? 0,
            investedAmount: action.investedAmount ?? 0,
            ...baseFields,
          } as any);
          return {
            success: true,
            message: `✅ Mutual fund "${action.name}" added — ₹${fmt(action.investedAmount ?? 0)} invested.`,
            linkTo: '/investments',
          };
        }

        if (action.investmentType === 'fixed_deposit') {
          const startDate    = action.startDate ?? new Date().toISOString().slice(0, 10);
          const durationMos  = action.durationMonths ?? 12;
          const maturityDate = action.maturityDate ?? (() => {
            const d = new Date(startDate);
            d.setMonth(d.getMonth() + durationMos);
            return d.toISOString().slice(0, 10);
          })();
          await store.addInvestment({
            type:           'fixed_deposit',
            bankName:       action.bankName ?? 'Bank',
            investedAmount: action.investedAmount ?? 0,
            interestRate:   action.interestRate ?? 0,
            durationMonths: durationMos,
            startDate,
            maturityDate,
            ...baseFields,
          } as any);
          return {
            success: true,
            message: `✅ FD of ₹${fmt(action.investedAmount ?? 0)} added${action.interestRate ? ` at ${action.interestRate}%` : ''}.`,
            linkTo: '/investments',
          };
        }

        if (action.investmentType === 'bond') {
          const startDate    = action.startDate ?? new Date().toISOString().slice(0, 10);
          const durationMos  = action.durationMonths ?? 12;
          const maturityDate = action.maturityDate ?? (() => {
            const d = new Date(startDate);
            d.setMonth(d.getMonth() + durationMos);
            return d.toISOString().slice(0, 10);
          })();
          await store.addInvestment({
            type:           'bond',
            investedAmount: action.investedAmount ?? 0,
            interestRate:   action.interestRate ?? 0,
            durationMonths: durationMos,
            startDate,
            maturityDate,
            ...baseFields,
          } as any);
          return {
            success: true,
            message: `✅ Bond "${action.name}" of ₹${fmt(action.investedAmount ?? 0)} added.`,
            linkTo: '/investments',
          };
        }

        // other
        await store.addInvestment({
          type:           'other',
          assetType:      (action.assetType ?? 'other') as any,
          investedAmount: action.investedAmount ?? 0,
          currentValue:   action.currentValue ?? action.investedAmount ?? 0,
          ...baseFields,
        } as any);
        return {
          success: true,
          message: `✅ Investment "${action.name}" of ₹${fmt(action.investedAmount ?? 0)} added.`,
          linkTo: '/investments',
        };
      }

      // ── ADD insurance ──────────────────────────────────────────────────────
      case 'add_insurance': {
        await store.addInsurancePolicy({
          policyName:        action.policyName,
          provider:          action.provider,
          type:              action.type,
          premiumAmount:     action.premiumAmount,
          premiumFrequency:  action.premiumFrequency,
          coverageAmount:    action.coverageAmount,
          renewalDate:       action.renewalDate,
          ...(action.notes ? { notes: action.notes } : {}),
        });
        return {
          success: true,
          message: `✅ Insurance "${action.policyName}" added — premium ₹${fmt(action.premiumAmount)} ${action.premiumFrequency}.`,
          linkTo: '/insurance',
        };
      }

      // ── ADD account ────────────────────────────────────────────────────────
      case 'add_account': {
        await store.addAccount({
          name:                action.name,
          type:                action.type,
          balance:             action.balance,
          openingBalance:      action.openingBalance ?? action.balance,
          openingBalanceDate:  action.openingBalanceDate ?? new Date().toISOString().slice(0, 10),
        });
        return {
          success: true,
          message: `✅ Account "${action.name}" added with balance ₹${fmt(action.balance)}.`,
          linkTo: '/accounts',
        };
      }

      // ── ADD lending borrower ───────────────────────────────────────────────
      case 'add_lending_borrower': {
        await store.addLendingBorrower({
          name:   action.name,
          status: 'active',
          ...(action.phone        ? { phone: action.phone }               : {}),
          ...(action.interestRate ? { interestRate: action.interestRate } : {}),
          ...(action.notes        ? { notes: action.notes }               : {}),
        });
        return {
          success: true,
          message: `✅ Borrower "${action.name}" added.`,
          linkTo: '/lending',
        };
      }

      // ── ADD lending transaction ────────────────────────────────────────────
      case 'add_lending_transaction': {
        const hint     = action.borrowerNameHint.toLowerCase();
        const borrower = store.lendingBorrowers.find(
          (b) => b.status === 'active' && b.name.toLowerCase().includes(hint),
        );
        if (!borrower) {
          return {
            success: false,
            message: `❌ No active borrower matching "${action.borrowerNameHint}" found. Add the borrower first or check the Lending page.`,
            linkTo: '/lending',
          };
        }
        await store.addLendingTransaction({
          borrowerId: borrower.id,
          type:       action.txType,
          amount:     action.amount,
          date:       action.date,
          ...(action.notes ? { notes: action.notes } : {}),
        });
        return {
          success: true,
          message: `✅ ₹${fmt(action.amount)} ${action.txType.replace(/_/g, ' ')} recorded for "${borrower.name}".`,
          linkTo: '/lending',
        };
      }

      // ── UPDATE payment ─────────────────────────────────────────────────────
      case 'update_payment': {
        const hint    = action.titleHint.toLowerCase();
        const matches = store.trackedPayments.filter(
          (p) => p.title.toLowerCase().includes(hint),
        );
        if (!matches.length) {
          return {
            success: false,
            message: `❌ No payment matching "${action.titleHint}" found.`,
            linkTo: '/payments',
          };
        }
        const target = matches[0];
        await store.updateTrackedPayment(target.id, {
          ...(action.patch.amount    !== undefined ? { amount:  action.patch.amount }   : {}),
          ...(action.patch.dueDate   !== undefined ? { dueDate: action.patch.dueDate }  : {}),
          ...(action.patch.title     !== undefined ? { title:   action.patch.title }    : {}),
          ...(action.patch.recurrence !== undefined
            ? { recurrence: action.patch.recurrence as 'none' | 'monthly' | 'yearly' }
            : {}),
        });
        return {
          success: true,
          message: `✅ Payment "${target.title}" updated.`,
          linkTo: '/payments',
        };
      }

      // ── UPDATE goal ────────────────────────────────────────────────────────
      case 'update_goal': {
        const hint    = action.nameHint.toLowerCase();
        const matches = store.goals.filter(
          (g) => g.name.toLowerCase().includes(hint),
        );
        if (!matches.length) {
          return { success: false, message: `❌ No goal matching "${action.nameHint}" found.`, linkTo: '/goals' };
        }
        const target = matches[0];
        await store.updateGoal(target.id, {
          ...(action.patch.targetAmount  !== undefined ? { targetAmount:  action.patch.targetAmount }  : {}),
          ...(action.patch.currentAmount !== undefined ? { currentAmount: action.patch.currentAmount } : {}),
          ...(action.patch.dueDate       !== undefined ? { dueDate:       action.patch.dueDate }       : {}),
          ...(action.patch.name          !== undefined ? { name:          action.patch.name }          : {}),
        });
        return {
          success: true,
          message: `✅ Goal "${target.name}" updated.`,
          linkTo: '/goals',
        };
      }

      // ── UPDATE liability ───────────────────────────────────────────────────
      case 'update_liability': {
        const hint    = action.nameHint.toLowerCase();
        const matches = store.liabilities.filter(
          (l) => l.name.toLowerCase().includes(hint),
        );
        if (!matches.length) {
          return { success: false, message: `❌ No liability matching "${action.nameHint}" found.`, linkTo: '/liabilities' };
        }
        const target = matches[0];
        await store.updateLiability(target.id, {
          ...(action.patch.outstanding  !== undefined ? { outstanding:  action.patch.outstanding }  : {}),
          ...(action.patch.emiAmount    !== undefined ? { emiAmount:    action.patch.emiAmount }    : {}),
          ...(action.patch.interestRate !== undefined ? { interestRate: action.patch.interestRate } : {}),
          ...(action.patch.status       !== undefined
            ? { status: action.patch.status as 'active' | 'paid' | 'paused' }
            : {}),
        });
        return {
          success: true,
          message: `✅ Liability "${target.name}" updated.`,
          linkTo: '/liabilities',
        };
      }

      // ── UPDATE investment ──────────────────────────────────────────────────
      case 'update_investment': {
        const hint    = action.nameHint.toLowerCase();
        const matches = store.investments.filter(
          (i) =>
            i.name.toLowerCase().includes(hint) ||
            (i.symbol ?? '').toLowerCase().includes(hint),
        );
        if (!matches.length) {
          return { success: false, message: `❌ No investment matching "${action.nameHint}" found.`, linkTo: '/investments' };
        }
        const target = matches[0];
        await store.updateInvestment(target.id, {
          ...(action.patch.currentPrice !== undefined ? { currentPrice: action.patch.currentPrice } : {}),
          ...(action.patch.quantity     !== undefined ? { quantity:     action.patch.quantity }     : {}),
          ...(action.patch.nav          !== undefined ? { nav:          action.patch.nav }          : {}),
          ...(action.patch.units        !== undefined ? { units:        action.patch.units }        : {}),
          ...(action.patch.notes        !== undefined ? { notes:        action.patch.notes }        : {}),
        } as any);
        return {
          success: true,
          message: `✅ Investment "${target.name}" updated.`,
          linkTo: '/investments',
        };
      }

      // ── DELETE payment ─────────────────────────────────────────────────────
      case 'delete_payment': {
        const hint = action.nameHint.toLowerCase();
        const match = store.trackedPayments.find((p) => p.title.toLowerCase().includes(hint));
        if (!match) {
          return { success: false, message: `❌ No payment matching "${action.nameHint}" found.`, linkTo: '/payments' };
        }
        await store.deleteTrackedPayment(match.id);
        return { success: true, message: `✅ Payment "${match.title}" deleted.`, linkTo: '/payments' };
      }

      // ── DELETE goal ────────────────────────────────────────────────────────
      case 'delete_goal': {
        const hint  = action.nameHint.toLowerCase();
        const match = store.goals.find((g) => g.name.toLowerCase().includes(hint));
        if (!match) {
          return { success: false, message: `❌ No goal matching "${action.nameHint}" found.`, linkTo: '/goals' };
        }
        await store.deleteGoal(match.id);
        return { success: true, message: `✅ Goal "${match.name}" deleted.`, linkTo: '/goals' };
      }

      // ── DELETE liability ───────────────────────────────────────────────────
      case 'delete_liability': {
        const hint  = action.nameHint.toLowerCase();
        const match = store.liabilities.find((l) => l.name.toLowerCase().includes(hint));
        if (!match) {
          return { success: false, message: `❌ No liability matching "${action.nameHint}" found.`, linkTo: '/liabilities' };
        }
        await store.deleteLiability(match.id);
        return { success: true, message: `✅ Liability "${match.name}" deleted.`, linkTo: '/liabilities' };
      }

      // ── DELETE investment ──────────────────────────────────────────────────
      case 'delete_investment': {
        const hint  = action.nameHint.toLowerCase();
        const match = store.investments.find(
          (i) => i.name.toLowerCase().includes(hint) || (i.symbol ?? '').toLowerCase().includes(hint),
        );
        if (!match) {
          return { success: false, message: `❌ No investment matching "${action.nameHint}" found.`, linkTo: '/investments' };
        }
        await store.deleteInvestment(match.id);
        return { success: true, message: `✅ Investment "${match.name}" deleted.`, linkTo: '/investments' };
      }

      // ── DELETE insurance ───────────────────────────────────────────────────
      case 'delete_insurance': {
        const hint  = action.nameHint.toLowerCase();
        const match = store.insurancePolicies.find(
          (p) =>
            p.policyName.toLowerCase().includes(hint) ||
            p.provider.toLowerCase().includes(hint),
        );
        if (!match) {
          return { success: false, message: `❌ No insurance policy matching "${action.nameHint}" found.`, linkTo: '/insurance' };
        }
        await store.deleteInsurancePolicy(match.id);
        return { success: true, message: `✅ Insurance "${match.policyName}" deleted.`, linkTo: '/insurance' };
      }

      // ── DELETE account ─────────────────────────────────────────────────────
      case 'delete_account': {
        const hint  = action.nameHint.toLowerCase();
        const match = store.accounts.find((a) => a.name.toLowerCase().includes(hint));
        if (!match) {
          return { success: false, message: `❌ No account matching "${action.nameHint}" found.`, linkTo: '/accounts' };
        }
        await store.deleteAccount(match.id);
        return { success: true, message: `✅ Account "${match.name}" deleted.`, linkTo: '/accounts' };
      }

      // ── DELETE lending borrower ────────────────────────────────────────────
      case 'delete_lending_borrower': {
        const hint  = action.nameHint.toLowerCase();
        const match = store.lendingBorrowers.find((b) => b.name.toLowerCase().includes(hint));
        if (!match) {
          return { success: false, message: `❌ No borrower matching "${action.nameHint}" found.`, linkTo: '/lending' };
        }
        await store.deleteLendingBorrower(match.id);
        return { success: true, message: `✅ Borrower "${match.name}" deleted.`, linkTo: '/lending' };
      }

      // ── MARK payment paid ──────────────────────────────────────────────────
      case 'mark_payment_paid': {
        const hint    = action.titleHint.toLowerCase();
        const pending = store.trackedPayments.filter(
          (p) => p.status === 'pending' && p.title.toLowerCase().includes(hint),
        );
        if (!pending.length) {
          return {
            success: false,
            message: `❌ No pending payment matching "${action.titleHint}" found.`,
            linkTo: '/payments',
          };
        }
        const target = pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        await store.markTrackedPaymentPaid(target.id);
        return {
          success: true,
          message: `✅ "${target.title}" (₹${fmt(target.amount)}) marked as paid.`,
          linkTo: '/payments',
        };
      }

      // ── SEARCH ─────────────────────────────────────────────────────────────
      case 'search_records': {
        const q   = action.query.toLowerCase();
        const mod = action.module.toLowerCase();
        let results: string[] = [];

        if (mod.includes('payment') || mod === 'records') {
          const hits = store.trackedPayments.filter(
            (p) => p.title.toLowerCase().includes(q) || p.paymentType.toLowerCase().includes(q),
          );
          results.push(...hits.map((p) => `💳 ${p.title} — ₹${fmt(p.amount)} due ${p.dueDate} (${p.status})`));
        }
        if (mod.includes('goal') || mod === 'records') {
          const hits = store.goals.filter((g) => g.name.toLowerCase().includes(q));
          results.push(...hits.map((g) => `🎯 ${g.name} — target ₹${fmt(g.targetAmount)}`));
        }
        if (mod.includes('invest') || mod === 'records') {
          const hits = store.investments.filter(
            (i) => i.name.toLowerCase().includes(q) || (i.symbol ?? '').toLowerCase().includes(q),
          );
          results.push(...hits.map((i) => `📈 ${i.name} (${i.type})`));
        }
        if (mod.includes('insurance') || mod.includes('policy') || mod === 'records') {
          const hits = store.insurancePolicies.filter(
            (p) => p.policyName.toLowerCase().includes(q) || p.provider.toLowerCase().includes(q),
          );
          results.push(...hits.map((p) => `🛡️ ${p.policyName} — ${p.provider}`));
        }
        if (mod.includes('account') || mod === 'records') {
          const hits = store.accounts.filter((a) => a.name.toLowerCase().includes(q));
          results.push(...hits.map((a) => `🏦 ${a.name} — ₹${fmt(a.balance)}`));
        }
        if (mod.includes('borrow') || mod.includes('lend') || mod === 'records') {
          const hits = store.lendingBorrowers.filter((b) => b.name.toLowerCase().includes(q));
          results.push(...hits.map((b) => `🤝 ${b.name} (${b.status})`));
        }

        if (!results.length) {
          return { success: false, message: `🔍 No results found for "${action.query}".` };
        }
        return {
          success: true,
          message: `🔍 Found ${results.length} result${results.length > 1 ? 's' : ''}:\n\n${results.slice(0, 8).join('\n')}`,
        };
      }

      default:
        return { success: false, message: '❌ Unknown action type.' };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `❌ ${msg}` };
  }
}
