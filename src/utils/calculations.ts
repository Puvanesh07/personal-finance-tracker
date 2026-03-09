import type {
  BondInvestment,
  FixedDepositInvestment,
  Investment,
  InvestmentType,
  MutualFundInvestment,
  OtherInvestment,
  StockInvestment,
} from '../types/investmentTypes'

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function investedValue(inv: Investment): number {
  switch (inv.type) {
    case 'stock':
      return inv.quantity * inv.buyPrice
    case 'mutual_fund':
      return inv.investedAmount
    case 'bond':
      return inv.investedAmount
    case 'fixed_deposit':
      return inv.investedAmount
    case 'other':
      return inv.investedAmount
  }
}

export function currentValue(inv: Investment): number {
  switch (inv.type) {
    case 'stock':
      return inv.quantity * inv.currentPrice
    case 'mutual_fund':
      return inv.units * inv.nav
    case 'bond':
      return inv.investedAmount + expectedInterestForBond(inv)
    case 'fixed_deposit':
      return maturityValueForFD(inv)
    case 'other':
      return inv.currentValue
  }
}

export function profitLoss(inv: Investment): number {
  return currentValue(inv) - investedValue(inv)
}

export function expectedInterestForBond(bond: BondInvestment): number {
  return (bond.investedAmount * (bond.interestRate / 100) * bond.durationMonths) / 12
}

export function interestEarnedForFD(fd: FixedDepositInvestment): number {
  return (fd.investedAmount * (fd.interestRate / 100) * fd.durationMonths) / 12
}

export function maturityValueForFD(fd: FixedDepositInvestment): number {
  return fd.investedAmount + interestEarnedForFD(fd)
}

export function typeLabel(type: InvestmentType) {
  switch (type) {
    case 'stock':
      return 'Stock'
    case 'mutual_fund':
      return 'Mutual fund'
    case 'bond':
      return 'Bond'
    case 'fixed_deposit':
      return 'Fixed deposit'
    case 'other':
      return 'Other'
  }
}

export type PortfolioSummary = {
  totalValue: number
  investedTotal: number
  profitLossTotal: number
  byType: Record<InvestmentType, { invested: number; current: number; profitLoss: number }>
  expectedInterest: {
    bonds: number
    fds: number
    total: number
  }
}

export function summarizePortfolio(investments: Investment[]): PortfolioSummary {
  const byType: PortfolioSummary['byType'] = {
    stock: { invested: 0, current: 0, profitLoss: 0 },
    mutual_fund: { invested: 0, current: 0, profitLoss: 0 },
    bond: { invested: 0, current: 0, profitLoss: 0 },
    fixed_deposit: { invested: 0, current: 0, profitLoss: 0 },
    other: { invested: 0, current: 0, profitLoss: 0 },
  }

  let bondsInterest = 0
  let fdsInterest = 0

  for (const inv of investments) {
    const invested = investedValue(inv)
    const current = currentValue(inv)
    const pl = current - invested

    byType[inv.type].invested += invested
    byType[inv.type].current += current
    byType[inv.type].profitLoss += pl

    if (inv.type === 'bond') bondsInterest += expectedInterestForBond(inv)
    if (inv.type === 'fixed_deposit') fdsInterest += interestEarnedForFD(inv)
  }

  const investedTotal = Object.values(byType).reduce((acc, v) => acc + v.invested, 0)
  const totalValue = Object.values(byType).reduce((acc, v) => acc + v.current, 0)
  const profitLossTotal = totalValue - investedTotal

  return {
    totalValue,
    investedTotal,
    profitLossTotal,
    byType,
    expectedInterest: { bonds: bondsInterest, fds: fdsInterest, total: bondsInterest + fdsInterest },
  }
}

export function toStockLikeRow(inv: Investment) {
  if (inv.type !== 'stock') return null
  return inv satisfies StockInvestment
}

export function toMutualFundRow(inv: Investment) {
  if (inv.type !== 'mutual_fund') return null
  return inv satisfies MutualFundInvestment
}

export function toOtherRow(inv: Investment) {
  if (inv.type !== 'other') return null
  return inv satisfies OtherInvestment
}

