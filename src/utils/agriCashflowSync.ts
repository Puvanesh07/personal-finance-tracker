import type { CashflowEntry } from '../types/investmentTypes';

export function agriCashflowTag(source: string, recordId: string) {
  return `[agri:${source}:${recordId}]`;
}

export function findAgriCashflow(
  cashflows: CashflowEntry[],
  source: string,
  recordId: string,
  type: 'income' | 'expense',
) {
  const tag = agriCashflowTag(source, recordId);
  return cashflows.find(
    (c) => c.type === type && (c.notes?.includes(tag) ?? false),
  );
}

export function notesWithTag(notes: string, source: string, recordId: string) {
  const tag = agriCashflowTag(source, recordId);
  return notes.includes(tag) ? notes : `${notes} ${tag}`.trim();
}

export async function pushToCashflow(
  addCashflow: (
    entry: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>,
  type: 'income' | 'expense',
  category: string,
  amount: number,
  date: string,
  notes: string,
  accountId?: string,
) {
  if (amount <= 0) return;
  await addCashflow({
    type,
    category,
    amount,
    date,
    notes,
    accountId: accountId || undefined,
  });
}

export async function syncAgriCashflow(
  cashflows: CashflowEntry[],
  addCashflow: (
    entry: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>,
  updateCashflow: (id: string, patch: Partial<CashflowEntry>) => Promise<void>,
  deleteCashflow: (id: string) => Promise<void>,
  type: 'income' | 'expense',
  source: string,
  recordId: string,
  category: string,
  amount: number,
  date: string,
  accountId: string | undefined,
  notes: string,
  /** Legacy fallback when tag not found (older records). */
  legacy?: {
    category: string;
    amount: number;
    date: string;
  },
) {
  const taggedNotes = notesWithTag(notes, source, recordId);
  let existing = findAgriCashflow(cashflows, source, recordId, type);

  if (!existing && legacy && legacy.amount > 0) {
    existing = cashflows.find(
      (c) =>
        c.type === type &&
        c.category === legacy.category &&
        c.amount === legacy.amount &&
        c.date === legacy.date,
    );
  }

  if (existing) {
    if (amount <= 0) {
      await deleteCashflow(existing.id);
    } else {
      await updateCashflow(existing.id, {
        category,
        amount,
        date,
        accountId: accountId || undefined,
        notes: taggedNotes,
      });
    }
  } else if (amount > 0) {
    await pushToCashflow(
      addCashflow,
      type,
      category,
      amount,
      date,
      taggedNotes,
      accountId,
    );
  }
}

export async function removeAgriCashflow(
  cashflows: CashflowEntry[],
  deleteCashflow: (id: string) => Promise<void>,
  type: 'income' | 'expense',
  source: string,
  recordId: string,
  legacy?: { category: string; amount: number; date: string },
) {
  const tagged = findAgriCashflow(cashflows, source, recordId, type);
  if (tagged) {
    await deleteCashflow(tagged.id);
    return;
  }
  if (legacy && legacy.amount > 0) {
    const cf = cashflows.find(
      (c) =>
        c.type === type &&
        c.category === legacy.category &&
        c.amount === legacy.amount &&
        c.date === legacy.date,
    );
    if (cf) await deleteCashflow(cf.id);
  }
}

/** @deprecated Use syncAgriCashflow with source tags */
export async function syncCashflow(
  cashflows: CashflowEntry[],
  addCashflow: (
    entry: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>,
  updateCashflow: (id: string, patch: Partial<CashflowEntry>) => Promise<void>,
  deleteCashflow: (id: string) => Promise<void>,
  type: 'income' | 'expense',
  oldCategory: string | undefined,
  oldAmount: number | undefined,
  oldDate: string | undefined,
  newCategory: string,
  newAmount: number,
  newDate: string,
  newAccountId: string | undefined,
  newNotes: string,
) {
  const existingCf =
    oldAmount && oldAmount > 0 && oldDate && oldCategory
      ? cashflows.find(
          (c) =>
            c.type === type &&
            c.category === oldCategory &&
            c.amount === oldAmount &&
            c.date === oldDate,
        )
      : undefined;

  if (existingCf) {
    if (newAmount <= 0) {
      await deleteCashflow(existingCf.id);
    } else {
      await updateCashflow(existingCf.id, {
        category: newCategory,
        amount: newAmount,
        date: newDate,
        accountId: newAccountId || undefined,
        notes: newNotes,
      });
    }
  } else if (newAmount > 0) {
    await pushToCashflow(
      addCashflow,
      type,
      newCategory,
      newAmount,
      newDate,
      newNotes,
      newAccountId,
    );
  }
}

/** @deprecated Use removeAgriCashflow */
export async function removeLinkedCashflow(
  cashflows: CashflowEntry[],
  deleteCashflow: (id: string) => Promise<void>,
  type: 'income' | 'expense',
  category: string,
  amount: number,
  date: string,
) {
  const cf = cashflows.find(
    (c) =>
      c.type === type &&
      c.category === category &&
      c.amount === amount &&
      c.date === date,
  );
  if (cf) await deleteCashflow(cf.id);
}
