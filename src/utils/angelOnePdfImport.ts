export type AngelOneEquityDraft = {
  type: 'stock'
  name: string
  symbol?: string
  platform: 'angel_one'
  quantity: number
  buyPrice: number
  currentPrice: number
  sector?: string
}

function isNumericToken(t: string) {
  return /^-?\d+(\.\d+)?$/.test(t)
}

function toNum(t: string) {
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

function isIsin(t: string) {
  // Common for equities/ETFs in India: INE********* or INF*********
  return /^IN[EF][A-Z0-9]{9}$/.test(t)
}

export function parseAngelOneHoldingsText(text: string): AngelOneEquityDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const out: AngelOneEquityDraft[] = []

  for (const line of lines) {
    // Data lines typically begin with the client id (e.g. B50131740)
    if (!/^B\d{5,}/.test(line)) continue

    const tokens = line.split(/\s+/).filter(Boolean)
    const clientId = tokens[0]
    if (!/^B\d{5,}/.test(clientId)) continue

    const isinIndex = tokens.findIndex(isIsin)
    if (isinIndex < 2) continue

    const name = tokens.slice(1, isinIndex).join(' ').trim()
    if (!name) continue

    // Tokens after ISIN usually look like: "<MarketCap> <Sector> <Quantity> ..."
    // Example: "MidCap FMCG 5 5 0 0 ..."
    let sector: string | undefined
    let qty = 0
    let i = isinIndex + 1
    const postIsin: string[] = []
    for (; i < tokens.length; i++) {
      if (isNumericToken(tokens[i])) break
      postIsin.push(tokens[i])
    }
    if (postIsin.length > 0) {
      sector = postIsin[postIsin.length - 1] // e.g. "FMCG", "Logistics"
    }
    if (i < tokens.length && isNumericToken(tokens[i])) {
      qty = toNum(tokens[i])
    }
    if (!qty) continue

    // Tail heuristic: last 9 numeric tokens usually contain:
    // AvgPrice, LTP, Invested, Market, GainLoss, LTCGQty, LTCGVal, STCGQty, STCGVal
    const numeric = tokens.filter(isNumericToken)
    if (numeric.length < 9) continue

    const tail = numeric.slice(-9)
    const avg = toNum(tail[0])
    const ltp = toNum(tail[1])

    if (!avg || !ltp) continue

    out.push({
      type: 'stock',
      name,
      symbol: undefined,
      platform: 'angel_one',
      quantity: qty,
      buyPrice: avg,
      currentPrice: ltp,
      sector,
    })
  }

  // Deduplicate by (name, qty, avg, ltp) in case PDF text repeats.
  const seen = new Set<string>()
  return out.filter((r) => {
    const k = `${r.name}__${r.quantity}__${r.buyPrice}__${r.currentPrice}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

