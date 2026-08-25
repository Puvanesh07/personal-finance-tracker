// src/types/ledgerTypes.ts

export type LedgerType = 'income' | 'expense' | 'transfer';

export type LedgerModule =
  | 'personal'
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
  | 'payroll'
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
