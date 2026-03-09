import type { Investment, NotionConfig } from '../types/investmentTypes'
import { expectedInterestForBond, interestEarnedForFD, investedValue, typeLabel } from '../utils/calculations'

function expectedGain(inv: Investment) {
  if (inv.type === 'bond') return expectedInterestForBond(inv)
  if (inv.type === 'fixed_deposit') return interestEarnedForFD(inv)
  return 0
}

export async function syncInvestmentsToNotion(cfg: NotionConfig, investments: Investment[]) {
  if (!cfg.enabled) throw new Error('Notion sync is disabled.')

  const payload = investments.map((inv) => ({
    id: inv.id,
    name: inv.name,
    type: typeLabel(inv.type),
    investedAmount: investedValue(inv),
    expectedGain: expectedGain(inv),
    createdAt: inv.createdAt,
    interestRate: (inv as any).interestRate,
    durationMonths: (inv as any).durationMonths,
  }))

  const res = await fetch('/.netlify/functions/notion-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ investments: payload }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Notion sync failed with ${res.status}`)
  }
}