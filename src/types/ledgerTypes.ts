// src/types/ledgerTypes.ts

export type LedgerType = 'income' | 'expense' | 'transfer';

export type LedgerModule =
  | 'personal'
  | 'agriculture'
  | 'attendance'
  | 'liability'
  | 'payment'
  | 'investment'
  | 'insurance'
  | 'other';

export type LedgerSourceType =
  | 'manual'
  | 'payment'
  | 'receivable'
  | 'liability_payment'
  | 'attendance'
  | 'payroll'
  | 'agriculture_expense'
  | 'agriculture_sale'
  | 'dairy_sale'
  | 'coconut_income'
  | 'coconut_expense'
  | 'livestock'
  | 'investment'
  | 'insurance';

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  date: string; // YYYY-MM-DD
  amount: number;
  category: string;
  subcategory?: string;
  accountId?: string;
  module: LedgerModule;
  sourceType: LedgerSourceType;
  sourceId?: string;
  costCenterId?: string;
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
