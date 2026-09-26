// src/utils/autoSyncConfirm.ts
/**
 * Shared confirmation gate for every "automatic sync" action.
 *
 * The app derives rows in one collection from an action on another — for
 * example marking a recurring bill as "Paid" also:
 *   • writes an expense Cashflow,
 *   • generates the next-due TrackedPayment, and
 *   • advances the linked Insurance Policy.
 *
 * Users asked to be able to veto that cascade, so every such action first
 * calls `confirmAutoSync(...)`. If they decline, the caller skips the sync
 * side-effects entirely (or bails out before running the action). Native
 * `window.confirm` is used so the gate is a) available everywhere with no
 * modal plumbing, b) impossible to spam-click through (it blocks), and c)
 * straightforward to stub in unit tests.
 */

export type AutoSyncPrompt = {
  /** Short headline shown on the first line, e.g. "Sync bond interest". */
  title: string;
  /** One-sentence explanation of what triggered this prompt. */
  description: string;
  /** Concrete list of the rows that will be created/updated. Each entry is
   *  rendered as a "• <line>" bullet inside the dialog. */
  affects: string[];
  /** When true the dialog warns that the change cannot be undone with a
   *  single click. Purely informational — the underlying code path still
   *  offers Undo toasts where they exist. */
  irreversible?: boolean;
};

/**
 * Build the exact user-visible text. Exported separately so unit tests can
 * assert on wording without having to mock `window.confirm`.
 */
export function formatAutoSyncMessage(prompt: AutoSyncPrompt): string {
  const lines: string[] = [prompt.title, '', prompt.description, ''];
  lines.push('What will change:');
  for (const line of prompt.affects) lines.push(`  • ${line}`);
  if (prompt.irreversible) {
    lines.push('', '⚠ This change cannot be easily undone.');
  }
  lines.push('', 'Choose OK to sync now, or Cancel to leave everything as-is.');
  return lines.join('\n');
}

/**
 * Returns `true` only when the user explicitly accepted the sync. Callers
 * MUST short-circuit on `false` and skip the auto-generated writes.
 */
export function confirmAutoSync(prompt: AutoSyncPrompt): boolean {
  const message = formatAutoSyncMessage(prompt);
  // `window.confirm` may be undefined in non-browser test environments; the
  // tests override it explicitly, so a bare global check is enough here.
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return false;
  }
  return window.confirm(message);
}

/** Convenience builder for the most common sync sites. Keeps UI code terse. */
export function buildMarkPaidPrompt(payment: {
  title: string;
  amount: number;
  recurrence: string;
  isLinkedToInsurance?: boolean;
}): AutoSyncPrompt {
  const affects: string[] = [
    `Mark "${payment.title}" (₹${payment.amount.toLocaleString('en-IN')}) as paid.`,
    `Add an expense to Cashflow for ₹${payment.amount.toLocaleString('en-IN')}.`,
  ];
  if (payment.recurrence && payment.recurrence !== 'none') {
    affects.push(
      `Create the next recurring bill (${payment.recurrence.replace('_', ' ')}).`,
    );
  }
  if (payment.isLinkedToInsurance) {
    affects.push('Advance the linked insurance policy renewal date.');
  }
  return {
    title: 'Confirm payment & auto-sync',
    description: `You're about to pay this bill. The app also updates related pages:`,
    affects,
  };
}

export function buildBondSyncPrompt(count: number, totalAmount: number): AutoSyncPrompt {
  return {
    title: 'Sync bond interest to Cashflow',
    description: 'One income entry per received coupon will be added to Cashflow.',
    affects: [
      `Create ${count} Cashflow income entr${count === 1 ? 'y' : 'ies'} · Bond Interest.`,
      `Increase your account balance by ₹${totalAmount.toLocaleString('en-IN')}.`,
      'Existing entries are never duplicated — safe to run again later.',
    ],
  };
}

export function buildBondSettlePrompt(bondName: string, principal: number, couponCount: number): AutoSyncPrompt {
  return {
    title: 'Close & settle bond',
    description: `"${bondName}" has matured. The app will archive it and move its value to cash.`,
    affects: [
      couponCount > 0
        ? `Create ${couponCount} pending Bond Interest income entr${couponCount === 1 ? 'y' : 'ies'}.`
        : 'All interest has already been synced.',
      `Create a transfer of ₹${principal.toLocaleString('en-IN')} (principal) into your linked account.`,
      'Mark the bond as matured and hide it from the Investments list & net-worth totals.',
    ],
    irreversible: true,
  };
}

export function buildMarkReceivedPrompt(buyerName: string, amount: number): AutoSyncPrompt {
  return {
    title: 'Mark receivable as received',
    description: `Money You Lent from ${buyerName} is being settled.`,
    affects: [
      `Flip the pending payment to "received".`,
      `Add an income entry (₹${amount.toLocaleString('en-IN')}) to Cashflow.`,
      'Net worth will rise by the received amount.',
    ],
  };
}
