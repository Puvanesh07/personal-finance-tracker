// src/types/investmentTypes.ts
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
  status?: 'active' | 'matured' | 'closed'; // Added status for maturity tracking
  createdAt: string;
  updatedAt: string;
  userId?: string;
};

// ── Insight Snapshot ───────────────────────────────────────────────────────
export type InsightSnapshot = {
  id: string;
  userId: string;
  createdAt: string;
  debtToAssetRatio: number;
  emergencyRunwayMonths: number;
  totalTaxLossPotential: number;
  equityAllocationPct: number;
  topDebtPriorityId?: string;
  rebalanceRequired: boolean;
};

// ── Financial Goal ──────────────────────────────────────────────
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
  emergencyRunway: number;
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
  /** Optional previous close for 1D P&L calculations. */
  previousClose?: number;
  /** Optional trailing annual dividend per share. */
  annualDividendPerShare?: number;
  /** Optional target/exit planning helpers. */
  targetPrice?: number;
  stopLossPrice?: number;
  sector?: string;
  marketCap?: string;
  usdPrice?: number;
  usdToInr?: number;
  benchmarkSymbol?: 'NIFTY50' | 'SENSEX' | 'SP500' | 'NASDAQ100';
  convictionTag?: 'core' | 'risky_bet' | 'swing' | 'selling_soon' | 'watchlist';
  annualDividendReceived?: number;
  lots?: Array<{
    id: string;
    date: ISODateString;
    quantity: number;
    buyPrice: number;
  }>;
};

export type MutualFundInvestment = BaseInvestment & {
  type: 'mutual_fund';
  units: number;
  nav: number;
  investedAmount: number;
  schemeCode?: string;
  amfiCode?: string;
  benchmarkSymbol?: 'NIFTY50' | 'SENSEX';
  convictionTag?: 'core' | 'satellite' | 'selling_soon' | 'watchlist';
  lots?: Array<{
    id: string;
    date: ISODateString;
    units: number;
    nav: number;
    investedAmount?: number;
  }>;
};

export type BondInvestment = BaseInvestment & {
  type: 'bond';
  investedAmount: number;
  interestRate: number;
  durationMonths: number;
  startDate: ISODateString;
  maturityDate: ISODateString;
};

export type FixedDepositInvestment = BaseInvestment & {
  type: 'fixed_deposit';
  bankName: string;
  investedAmount: number;
  interestRate: number;
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
    | 'epf'
    | 'international_equity'
    | 'other';
  investedAmount: number;
  currentValue: number;
  currentPrice?: number;
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

export type InsuranceType =
  | 'life'
  | 'health'
  | 'vehicle'
  | 'property'
  | 'other';

export type InsurancePolicy = {
  id: string;
  type: InsuranceType;
  provider: string;
  policyName: string;
  coverageAmount: number;
  premiumAmount: number;
  premiumFrequency: 'monthly' | 'yearly' | 'quarterly' | 'half-yearly';
  renewalDate: string;
  nominee?: string;
  notes?: string;
  policyNumber?: string;
  commencementDate?: string;
  maturityDate?: string;
  policyTermYears?: number;
  premiumPayingTermYears?: number;
  paymentsAlreadyMade?: number;
  lastPaymentDate?: string;
  sumAssured?: number;
  bonusType?: string;
  agentName?: string;
  agentCode?: string;
  modeOfPayment?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type InsurancePayment = {
  id: string;
  policyId: string;
  amount: number;
  paidAt: string;
  note?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type EssentialsConfig = {
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
  // Core net worth
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  // Investment breakdown
  investmentValue?: number;
  investedTotal?: number;
  unrealizedPnl?: number;
  realizedProfit?: number;
  // Cashflow (current month at time of snapshot)
  monthIncome?: number;
  monthExpense?: number;
  monthNet?: number;
  // Liquid cash
  accountBalance?: number;
  // Goals
  goalsProgress?: number;       // % (0–100)
  goalsCount?: number;
  goalsSaved?: number;
  goalsTarget?: number;
  // Insurance
  insuranceCoverage?: number;
  insurancePoliciesCount?: number;
  // Lending
  lendingOutstanding?: number;
  lendingBorrowersCount?: number;
  // SIP
  sipMonthlyBudget?: number;
  sipInstrumentsCount?: number;
  // Liabilities
  liabilitiesCount?: number;
  totalEmiMonthly?: number;
};

// ── Liabilities ────────────────────────────────────────────────────────────
export type LiabilityType = 'loan' | 'credit_card' | 'other';
export type LiabilityStatus = 'active' | 'paid' | 'paused' | 'returned';

export type Liability = {
  id: string;
  type: LiabilityType;
  name: string;
  principal: number;
  outstanding: number;
  interestRate?: number;
  startDate?: string;
  endDate?: string;
  emiAmount?: number;
  emiDay?: number;
  status?: LiabilityStatus;
  returnedAt?: string;
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
  openingBalance: number;
  openingBalanceDate: string;
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

// ── Payment Tracker (upcoming dues & reminders) ─────────────────────────
export type PaymentTrackerType =
  | 'chit_fund'
  | 'fd_maturity'
  | 'credit_card'
  | 'personal_loan'
  | 'vehicle_loan'
  | 'home_loan'
  | 'emi'
  | 'rent'
  | 'insurance'
  | 'custom';

export type TrackedPaymentStatus = 'pending' | 'paid';
export type PaymentRecurrence = 'none' | 'monthly' | 'yearly';

export type TrackedPayment = {
  id: string;
  title: string;
  paymentType: PaymentTrackerType;
  amount: number;
  dueDate: ISODateString;
  status: TrackedPaymentStatus;
  paidAt?: ISODateString;
  reminderDays: number[];
  recurrence: PaymentRecurrence;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
};

// ── Pending Payments (buyer/vendor receivables) ───────────────────────────
export type PendingPaymentStatus = 'pending' | 'received';

export type PendingPayment = {
  id: string;
  buyerName: string;
  buyerPhone?: string;
  itemDescription: string;
  amount: number;
  saleDate: ISODateString;
  expectedPaymentDate: ISODateString;
  status: PendingPaymentStatus;
  receivedAt?: ISODateString;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
};

// ── Financier / Lending ──────────────────────────────────────────────
export type LendingStatus = 'active' | 'closed';
export type LendingTransactionType =
  | 'principal_given'
  | 'interest_paid'
  | 'principal_returned';

export type LendingBorrower = {
  id: string;
  name: string;
  phone?: string;
  status: LendingStatus;
  notes?: string;
  interestRate?: number;
  nextDueDate?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
};

export type LendingTransaction = {
  id: string;
  borrowerId: string;
  type: LendingTransactionType;
  amount: number;
  date: ISODateString;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
};

// ── Goals ──────────────────────────────────────────────────────────────────
export type GoalStatus = 'active' | 'completed' | 'success';

export type GoalContribution = {
  id: string;
  goalId: string;
  amount: number;
  date: ISODateString;
  note?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  dueDate?: ISODateString;
  status?: GoalStatus;
  completedAt?: ISODateString;
  createdAt: string;
  updatedAt: string;
  userId?: string;
};

// ── Sold Trades (Profit Tracking) ─────────────────────────────────────────
export type SoldTrade = {
  id: string;
  investmentName: string;
  investmentType: InvestmentType;
  symbol?: string;
  platform?: string;
  quantity?: number;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitPct: number;
  soldDate: ISODateString;
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

// ── Credentials / Passwords ──────────────────────────────────────────────
export type CredentialCategory =
  | 'identity'
  | 'login'
  | 'finance'
  | 'note'
  | 'other';

export type Credential = {
  id: string;
  category: CredentialCategory;
  title: string; // e.g., "PAN Card", "Gmail Account"
  identifier?: string; // e.g., PAN number, UAN number, email address
  secret?: string; // e.g., password
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};
