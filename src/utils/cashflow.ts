import { format, parseISO, startOfMonth } from 'date-fns'
import type { CashflowEntry, ISODateString } from '../types/investmentTypes'

export function monthKey(date: ISODateString) {
  const d = parseISO(date)
  return format(startOfMonth(d), 'yyyy-MM')
}

export function summarizeMonth(entries: CashflowEntry[], month: string) {
  let income = 0
  let expense = 0
  for (const e of entries) {
    if (monthKey(e.date) !== month) continue
    if (e.type === 'income') income += e.amount
    else expense += e.amount
  }
  const savings = income - expense
  const savingsRate = income > 0 ? (savings / income) * 100 : 0
  return { income, expense, savings, savingsRate }
}

export function topExpenses(entries: CashflowEntry[], month: string, limit = 5) {
  const byCategory = new Map<string, number>()
  for (const e of entries) {
    if (e.type !== 'expense') continue
    if (monthKey(e.date) !== month) continue
    const cat = e.category.trim() || 'Other'
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + e.amount)
  }
  return Array.from(byCategory.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

