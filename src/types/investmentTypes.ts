export type InvestmentType =
  | 'stock'
  | 'mutual_fund'
  | 'bond'
  | 'fixed_deposit'
  | 'other';

export type Platform = 'zerodha' | 'angel_one' | 'indmoney' | 'manual';

export type ISODateString = string; // YYYY-MM-DD

export type BaseInvestment = {
  id: string;
  type: InvestmentType;
  name: string;
  symbol?: string;
  platform?: Platform | string;
  notes?: string;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
  userId?: string; // Firestore owner
};

// ── Insight Snapshot ───────────────────────────────────────────────────────

export type InsightSnapshot = {
  id: string;
  userId: string;
  createdAt: string; // ISO string
  debtToAssetRatio: number;
  emergencyRunwayMonths: number;
  totalTaxLossPotential: number;
  equityAllocationPct: number;
  topDebtPriorityId?: string;
  rebalanceRequired: boolean;
};

// ── Financial Goal (extended) ──────────────────────────────────────────────

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  category: 'retirement' | 'house' | 'car' | 'education' | 'other';
  deadline?: string;
  userId: string;
}

// ── Insight Metrics & Cards ────────────────────────────────────────────────

export interface InsightMetrics {
  healthScore: number;
  savingsRate: number;
  emergencyRunway: number; // months
  debtToAssetRatio: number;
  netWorth: number;
  equityAllocation: number;
  passiveIncomeMonthly: number;
}

export interface FinancialInsight {
  title: string;
  value: string;
  description: string;
  status: 'good' | 'warning' | 'critical';
  icon: 'safety' | 'debt' | 'growth' | 'diversification';
}

// ── Investment Subtypes ────────────────────────────────────────────────────

export type StockInvestment = BaseInvestment & {
  type: 'stock';
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  sector?: string;
  marketCap?: string; // e.g. 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'Micro Cap'
};

export type MutualFundInvestment = BaseInvestment & {
  type: 'mutual_fund';
  units: number;
  nav: number;
  investedAmount: number;
  schemeCode?: string; // AMFI scheme code — auto-resolved on first live price refresh
  amfiCode?: string; // alias for schemeCode (legacy support)
};

export type BondInvestment = BaseInvestment & {
  type: 'bond';
  investedAmount: number;
  interestRate: number; // annual %
  durationMonths: number;
  startDate: ISODateString;
  maturityDate: ISODateString;
};

export type FixedDepositInvestment = BaseInvestment & {
  type: 'fixed_deposit';
  bankName: string;
  investedAmount: number;
  interestRate: number; // annual %
  durationMonths: number;
  startDate: ISODateString;
  maturityDate: ISODateString;
};

export type OtherInvestment = BaseInvestment & {
  type: 'other';
  assetType?:
    | 'gold'
    | 'silver'
    | 'crypto'
    | 'real_estate'
    | 'ppf'
    | 'nps'
    | 'international_equity' // ← added: US/global stocks via INDmoney etc.
    | 'other';
  investedAmount: number;
  currentValue: number;
  currentPrice?: number; // live price for gold / silver / intl equity
};

export type Investment =
  | StockInvestment
  | MutualFundInvestment
  | BondInvestment
  | FixedDepositInvestment
  | OtherInvestment;

// ── Settings ───────────────────────────────────────────────────────────────

export type NotionConfig = {
  token?: string;
  databaseId?: string;
  enabled: boolean;
  lastSyncAt?: string;
};

export type EssentialsConfig = {
  termInsuranceCover?: number;
  healthCover?: number;
  emergencyFundTarget?: number;
  emergencyFundCurrent?: number;
};

// ── Snapshots ──────────────────────────────────────────────────────────────

export type PortfolioSnapshot = {
  id: string;
  date: ISODateString;
  totalValue: number;
  userId?: string;
};

export type NetWorthSnapshot = {
  id: string;
  userId: string;
  createdAt: string;
  label?: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

// ── Liabilities ────────────────────────────────────────────────────────────

export type LiabilityType = 'loan' | 'credit_card' | 'other';

export type Liability = {
  id: string;
  type: LiabilityType;
  name: string;
  principal: number;
  outstanding: number;
  interestRate?: number;
  startDate?: ISODateString;
  endDate?: ISODateString;
  createdAt: string;
  updatedAt: string;
  userId?: string;
};

// ── Bank Accounts ──────────────────────────────────────────────────────────

export type AccountType = 'bank' | 'credit';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  createdAt: string;
  updatedAt: string;
  userId?: string;
};

// ── Cashflow ───────────────────────────────────────────────────────────────

export type CashflowType = 'income' | 'expense';

export type CashflowEntry = {
  id: string;
  type: CashflowType;
  date: ISODateString;
  category: string;
  amount: number;
  notes?: string;
  accountId?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
};

// ── Goals ──────────────────────────────────────────────────────────────────

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  dueDate?: ISODateString;
  createdAt: string;
  updatedAt: string;
  userId?: string;
};
