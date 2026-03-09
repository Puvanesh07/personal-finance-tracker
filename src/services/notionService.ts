import type { Investment, NotionConfig } from '../types/investmentTypes'
import { expectedInterestForBond, interestEarnedForFD, investedValue, typeLabel } from '../utils/calculations'

type NotionCreatePagePayload = {
  parent: { database_id: string }
  properties: Record<string, any>
}

async function notionFetch<T>(token: string, path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Notion API error ${res.status}: ${text}`)
  }
  return JSON.parse(text) as T
}

function expectedGain(inv: Investment) {
  if (inv.type === 'bond') return expectedInterestForBond(inv)
  if (inv.type === 'fixed_deposit') return interestEarnedForFD(inv)
  return 0
}

export async function syncInvestmentsToNotion(cfg: NotionConfig, investments: Investment[]) {
  if (!cfg.enabled) throw new Error('Notion sync is disabled.')
  if (!cfg.token || !cfg.databaseId) throw new Error('Notion token / database id missing.')

  // Note: Frontend-only: we cannot safely store a robust mapping of local IDs to Notion page IDs
  // without also designing schema + conflict handling. This keeps it simple: creates new pages.
  for (const inv of investments) {
    const payload: NotionCreatePagePayload = {
      parent: { database_id: cfg.databaseId },
      properties: {
        Name: { title: [{ text: { content: inv.name } }] },
        'Investment Type': { select: { name: typeLabel(inv.type) } },
        'Amount Invested': { number: investedValue(inv) },
        'Expected Gain': { number: expectedGain(inv) },
        'Date Added': { date: { start: inv.createdAt } },
      },
    }

    if (inv.type === 'bond' || inv.type === 'fixed_deposit') {
      payload.properties['Interest Rate'] = { number: inv.interestRate }
      payload.properties.Duration = { number: inv.durationMonths }
    }

    await notionFetch(cfg.token, 'pages', { method: 'POST', body: JSON.stringify(payload) })
  }
}

