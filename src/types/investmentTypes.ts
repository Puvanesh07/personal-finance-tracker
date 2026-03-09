export type InvestmentType = 'stock' | 'mutual_fund' | 'bond' | 'fixed_deposit' | 'other'

export type Platform = 'zerodha' | 'angel_one' | 'indmoney' | 'manual'

export type ISODateString = string // YYYY-MM-DD

export type BaseInvestment = {
  id: string
  type: InvestmentType
  name: string
  symbol?: string
  platform?: Platform | string
  notes?: string
  createdAt: string // ISO datetime
  updatedAt: string // ISO datetime
}

export type StockInvestment = BaseInvestment & {
  type: 'stock'
  quantity: number
  buyPrice: number
  currentPrice: number
  sector?: string
}

export type MutualFundInvestment = BaseInvestment & {
  type: 'mutual_fund'
  units: number
  nav: number
  investedAmount: number
}

export type BondInvestment = BaseInvestment & {
  type: 'bond'
  investedAmount: number
  interestRate: number // annual %
  durationMonths: number
  startDate: ISODateString
  maturityDate: ISODateString
}

export type FixedDepositInvestment = BaseInvestment & {
  type: 'fixed_deposit'
  bankName: string
  investedAmount: number
  interestRate: number // annual %
  durationMonths: number
  startDate: ISODateString
  maturityDate: ISODateString
}

export type OtherInvestment = BaseInvestment & {
  type: 'other'
  assetType?: 'gold' | 'crypto' | 'real_estate' | 'ppf' | 'nps' | 'other'
  investedAmount: number
  currentValue: number
}

export type Investment =
  | StockInvestment
  | MutualFundInvestment
  | BondInvestment
  | FixedDepositInvestment
  | OtherInvestment

export type NotionConfig = {
  token?: string
  databaseId?: string
  enabled: boolean
  lastSyncAt?: string
}

export type PortfolioSnapshot = {
  id: string
  date: ISODateString
  totalValue: number
}

export type LiabilityType = 'loan' | 'credit_card' | 'other'

export type Liability = {
  id: string
  type: LiabilityType
  name: string
  principal: number
  outstanding: number
  interestRate?: number
  startDate?: ISODateString
  endDate?: ISODateString
  createdAt: string
  updatedAt: string
}

export type CashflowType = 'income' | 'expense'

export type CashflowEntry = {
  id: string
  type: CashflowType
  date: ISODateString // entry date
  category: string
  amount: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export type Goal = {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  dueDate?: ISODateString
  createdAt: string
  updatedAt: string
}

export type EssentialsConfig = {
  termInsuranceCover?: number
  healthCover?: number
  emergencyFundTarget?: number
  emergencyFundCurrent?: number
}

export type NetWorthSnapshot = {
  id: string
  createdAt: string // ISO datetime
  label?: string
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}

