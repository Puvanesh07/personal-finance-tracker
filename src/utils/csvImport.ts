import type { InvestmentType } from '../types/investmentTypes'

type CsvRow = Record<string, string>

function parseCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else {
      if (ch === ',') {
        out.push(cur)
        cur = ''
      } else if (ch === '"') {
        inQuotes = true
      } else {
        cur += ch
      }
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export function parseCSV(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ''))
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line)
    const row: CsvRow = {}
    for (let i = 0; i < headers.length; i++) row[headers[i]] = values[i] ?? ''
    return row
  })
}

function hasAny(row: CsvRow, keys: string[]) {
  return keys.some((k) => k in row)
}

function isZerodhaHoldingsRow(row: CsvRow) {
  // Zerodha holdings export headers like:
  // Instrument, Qty., Avg. cost, LTP, Invested, Cur. val, P&L, Net chg., Day chg.
  return (
    hasAny(row, ['Instrument']) &&
    hasAny(row, ['Qty.', 'Qty']) &&
    hasAny(row, ['Avg. cost', 'Avg cost']) &&
    hasAny(row, ['LTP']) &&
    hasAny(row, ['Invested']) &&
    hasAny(row, ['Cur. val', 'Cur val', 'Cur. Val'])
  )
}

function normType(v: string): InvestmentType | undefined {
  const s = v.trim().toLowerCase()
  if (s === 'stock' || s === 'stocks' || s === 'equity') return 'stock'
  if (s === 'mutual_fund' || s === 'mutual fund' || s === 'mutualfund' || s === 'mf') return 'mutual_fund'
  if (s === 'bond' || s === 'bonds') return 'bond'
  if (s === 'fixed_deposit' || s === 'fixed deposit' || s === 'fd') return 'fixed_deposit'
  if (s === 'other') return 'other'
  return undefined
}

function toNum(v: string) {
  const n = Number(String(v ?? '').replaceAll(',', '').trim())
  return Number.isFinite(n) ? n : 0
}

export function rowToInvestmentDraft(row: CsvRow) {
  // Broker-specific: Zerodha holdings export (stocks/ETFs + mutual funds mixed).
  if (isZerodhaHoldingsRow(row)) {
    const instrument = (row.Instrument ?? '').trim()
    const qty = toNum(row['Qty.'] ?? row.Qty ?? '0')
    const avgCost = toNum(row['Avg. cost'] ?? row['Avg cost'] ?? '0')
    const ltp = toNum(row.LTP ?? '0')
    const invested = toNum(row.Invested ?? '0')

    if (!instrument) return null

    // Heuristic: Zerodha puts MF names as long strings with spaces; equity/ETF are usually tickers.
    const isMutualFund = /\s/.test(instrument) || instrument.length > 15

    if (isMutualFund) {
      return {
        type: 'mutual_fund' as const,
        name: instrument,
        symbol: undefined,
        platform: 'zerodha',
        units: qty,
        nav: ltp,
        investedAmount: invested || qty * avgCost,
      }
    }

    return {
      type: 'stock' as const,
      name: instrument,
      symbol: instrument,
      platform: 'zerodha',
      quantity: qty,
      buyPrice: avgCost,
      currentPrice: ltp,
    }
  }

  const type = normType(row.Type ?? row.type ?? '')
  if (!type) return null

  const name = (row.Name ?? row.name ?? '').trim()
  if (!name) return null

  const platform = (row.Platform ?? row.platform ?? '').trim() || 'manual'
  const symbol = (row.Symbol ?? row.symbol ?? '').trim() || undefined

  if (type === 'stock') {
    return {
      type,
      name,
      symbol,
      platform,
      quantity: toNum(row.Quantity ?? row.quantity ?? '0'),
      buyPrice: toNum(row.BuyPrice ?? row.buyPrice ?? row['Buy Price'] ?? '0'),
      currentPrice: toNum(row.CurrentPrice ?? row.currentPrice ?? row['Current Price'] ?? '0'),
    }
  }

  if (type === 'mutual_fund') {
    return {
      type,
      name,
      symbol,
      platform,
      units: toNum(row.Units ?? row.units ?? '0'),
      nav: toNum(row.NAV ?? row.nav ?? '0'),
      investedAmount: toNum(row.InvestedAmount ?? row.investedAmount ?? row['Invested Amount'] ?? '0'),
    }
  }

  if (type === 'bond') {
    return {
      type,
      name,
      platform,
      investedAmount: toNum(row.InvestedAmount ?? row.investedAmount ?? row['Invested Amount'] ?? '0'),
      interestRate: toNum(row.InterestRate ?? row.interestRate ?? row['Interest Rate'] ?? '0'),
      durationMonths: toNum(row.DurationMonths ?? row.durationMonths ?? row.Duration ?? '0'),
      startDate: (row.StartDate ?? row.startDate ?? row['Start Date'] ?? '').trim() || '2000-01-01',
      maturityDate: (row.MaturityDate ?? row.maturityDate ?? row['Maturity Date'] ?? '').trim() || '2000-01-01',
    }
  }

  if (type === 'fixed_deposit') {
    const bankName = (row.BankName ?? row.bankName ?? row.Bank ?? '').trim() || name
    return {
      type,
      name,
      bankName,
      platform: 'manual',
      investedAmount: toNum(row.InvestedAmount ?? row.investedAmount ?? row['Invested Amount'] ?? '0'),
      interestRate: toNum(row.InterestRate ?? row.interestRate ?? row['Interest Rate'] ?? '0'),
      durationMonths: toNum(row.DurationMonths ?? row.durationMonths ?? row.Duration ?? '0'),
      startDate: (row.StartDate ?? row.startDate ?? row['Start Date'] ?? '').trim() || '2000-01-01',
      maturityDate: (row.MaturityDate ?? row.maturityDate ?? row['Maturity Date'] ?? '').trim() || '2000-01-01',
    }
  }

  return {
    type,
    name,
    platform,
    investedAmount: toNum(row.InvestedAmount ?? row.investedAmount ?? row['Invested Amount'] ?? '0'),
    currentValue: toNum(row.CurrentValue ?? row.currentValue ?? row['Current Value'] ?? '0'),
  }
}

