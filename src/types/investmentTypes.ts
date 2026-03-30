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
  usdPrice?: number;
  usdToInr?: number;
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
  paidAt: string; // YYYY-MM-DD
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
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

// ── Liabilities ────────────────────────────────────────────────────────────

export type LiabilityType = 'loan' | 'credit_card' | 'other';

export type LiabilityStatus = 'active' | 'paid' | 'paused';

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

// ── Agriculture ────────────────────────────────────────────────────────────

export type Season = 'summer' | 'monsoon' | 'winter';
export type LivestockType =
  | 'cow'
  | 'goat'
  | 'buffalo'
  | 'sheep'
  | 'poultry'
  | 'other';
export type AgriExpenseCategory =
  | 'seeds'
  | 'fertilizer'
  | 'pesticides'
  | 'labor'
  | 'irrigation'
  | 'tractor_fuel'
  | 'equipment_repair'
  | 'feed'
  | 'veterinary'
  | 'medicine'
  | 'shed'
  | 'other';

export type Field = {
  id: string;
  name: string;
  areAcres: number;
  location?: string;
  soilType?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type CropCycle = {
  id: string;
  fieldId: string;
  fieldName?: string;
  cropName: string;
  season: Season;
  startDate: string; // YYYY-MM-DD
  expectedHarvestDate: string; // YYYY-MM-DD
  actualHarvestDate?: string;
  investedAmount: number;
  harvestIncome: number;
  quantityKg?: number;
  notes?: string;
  accountId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type AgriExpense = {
  id: string;
  cropCycleId: string;
  cropName?: string;
  category: AgriExpenseCategory;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  accountId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type Livestock = {
  id: string;
  type: LivestockType;
  name?: string;
  count: number;
  purchaseCost: number;
  currentValue: number;
  purchaseDate: string;
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type MilkRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  liters: number;
  pricePerLiter: number;
  soldTo?: string;
  accountId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

// ── Livestock Event Tracking ───────────────────────────────────────────────

export type LivestockEventType =
  | 'existing'
  | 'purchase'
  | 'birth'
  | 'sale'
  | 'death';

export type LivestockEvent = {
  id: string;
  animalType: LivestockType;
  eventType: LivestockEventType;
  count: number;
  price?: number;
  accountId?: string;
  notes?: string;
  date: string; // YYYY-MM-DD
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type CoconutSellMethod = 'by_count' | 'by_ton';

export type CoconutRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  numberOfTrees: number;
  totalCoconuts: number;
  sellMethod: CoconutSellMethod;
  pricePerCoconut?: number;
  totalTons?: number;
  weightKgPerCoconut?: number;
  pricePerTon?: number;
  harvestIncome: number;
  investmentAmount: number;
  durationMonths: number;
  notes?: string;
  accountId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

// ── Produce Sales (Vegetables / Fruits) ───────────────────────────────────

export type ProduceUnit = 'kg' | 'box' | 'piece' | 'bunch' | 'litre' | string;

export type ProduceCategory = string; // free-form: "Vegetable", "Fruit", etc.

export type ProduceSaleLot = {
  id: string;
  userId: string;
  produceName: string; // e.g. "Tomato", "Onion", "Drumstick"
  category: ProduceCategory; // e.g. "Vegetable", "Fruit"
  unit: ProduceUnit; // "kg" | "box" | "piece" | custom string
  customUnit?: string; // filled when user picks 'custom'
  quantity: number; // no. of units sold
  pricePerUnit: number; // ₹ per unit
  commissionAmount?: number; // Optional Commission reduction
  totalAmount: number; // NET Amount: (quantity × pricePerUnit) - commissionAmount
  date: string; // YYYY-MM-DD
  soldTo?: string; // buyer name / market
  notes?: string;
  accountId?: string; // bank account income goes to
  createdAt: string;
  updatedAt: string;
};

// ── Attendance Module ──────────────────────────────────────────────────────

export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export type TransactionType = 'advance' | 'deduction' | 'extra';

export type AttendanceEmployee = {
  id: string;
  name: string;
  phone?: string;
  dailyWage: number; // ₹ per day
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  present: boolean;
  wage: number;
  extraWork?: number;
  extraWorkNote?: string;
  note?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceTransaction = {
  id: string;
  employeeId: string;
  type: TransactionType;
  amount: number;
  note?: string;
  date: string; // YYYY-MM-DD
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type SalaryRecord = {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM format e.g. "2024-06"
  daysWorked: number;
  baseSalary: number;
  extraWork: number;
  totalSalary: number;
  advance: number;
  deductions: number;
  finalSalary: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};
