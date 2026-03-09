import ExcelJS from 'exceljs'

export type IndmoneyDraft =
  | {
      type: 'stock'
      name: string
      symbol?: string
      platform: 'indmoney'
      quantity: number
      buyPrice: number
      currentPrice: number
      sector?: string
    }
  | {
      type: 'mutual_fund'
      name: string
      symbol?: string
      platform: 'indmoney'
      units: number
      nav: number
      investedAmount: number
    }

type RowObj = Record<string, unknown>

function normKey(k: string) {
  return k.trim().toLowerCase().replace(/\s+/g, ' ')
}

type HeaderCandidate = { rowNumber: number; headers: string[]; score: number }

function asString(v: unknown) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return String(v)
}

function toNum(v: unknown) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = asString(v).replaceAll(',', '').trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function getAny(row: RowObj, keys: string[]) {
  for (const k of keys) {
    if (k in row) return row[k]
  }
  // also try normalized header matching
  const normMap = new Map<string, string>()
  for (const real of Object.keys(row)) normMap.set(normKey(real), real)
  for (const want of keys) {
    const real = normMap.get(normKey(want))
    if (real) return row[real]
  }
  return undefined
}

function extractRowStrings(row: ExcelJS.Row, maxCols: number) {
  const cells: string[] = []
  for (let c = 1; c <= maxCols; c++) {
    const v = row.getCell(c).value
    const s = asString(v).trim()
    cells.push(s)
  }
  return cells
}

function scoreHeaderRow(cells: string[]) {
  const norms = cells.map((c) => normKey(c)).filter(Boolean)
  const hits = (needle: string) => norms.some((n) => n === needle || n.includes(needle))

  // INDmoney-like reports often contain some combination of these.
  const keywords = [
    'symbol',
    'ticker',
    'instrument',
    'name',
    'company',
    'quantity',
    'qty',
    'units',
    'avg',
    'average',
    'buy',
    'cost',
    'ltp',
    'cmp',
    'nav',
    'invested',
    'invested amount',
    'market value',
    'current value',
  ]

  let score = 0
  for (const k of keywords) if (hits(k)) score += 1

  // If the row looks like purely numeric data, it's not a header.
  const nonEmpty = cells.filter(Boolean)
  const numericLike = nonEmpty.filter((x) => /^-?\d+(\.\d+)?$/.test(x)).length
  if (nonEmpty.length > 0 && numericLike / nonEmpty.length > 0.6) score -= 5

  return score
}

function findBestHeaderCandidate(sheet: ExcelJS.Worksheet): HeaderCandidate | null {
  // Scan first N rows; INDmoney exports sometimes have title/metadata rows.
  const MAX_SCAN_ROWS = Math.min(30, sheet.rowCount || 30)
  const MAX_COLS = Math.min(60, sheet.columnCount || 60)

  let best: HeaderCandidate | null = null

  for (let r = 1; r <= MAX_SCAN_ROWS; r++) {
    const row = sheet.getRow(r)
    const cells = extractRowStrings(row, MAX_COLS)
    const score = scoreHeaderRow(cells)
    if (score <= 0) continue

    // Build headers array (keep empty headers out, but preserve positions)
    const headers: string[] = []
    for (let c = 0; c < cells.length; c++) headers[c] = cells[c]

    if (!best || score > best.score) best = { rowNumber: r, headers, score }
  }

  return best
}

function sheetPreview(sheet: ExcelJS.Worksheet) {
  const MAX_SCAN_ROWS = Math.min(12, sheet.rowCount || 12)
  const MAX_COLS = Math.min(16, sheet.columnCount || 16)
  const lines: string[] = []
  for (let r = 1; r <= MAX_SCAN_ROWS; r++) {
    const cells = extractRowStrings(sheet.getRow(r), MAX_COLS).filter(Boolean)
    if (!cells.length) continue
    lines.push(`R${r}: ${cells.slice(0, 8).join(' | ')}`)
    if (lines.length >= 6) break
  }
  return lines.join('\n')
}

export async function parseIndmoneyXlsx(file: File): Promise<IndmoneyDraft[]> {
  const workbook = new ExcelJS.Workbook()
  const buf = await file.arrayBuffer()
  await workbook.xlsx.load(buf)

  if (!workbook.worksheets.length) {
    throw new Error('INDmoney import: no worksheets found in the Excel file.')
  }

  // Choose the sheet that most likely contains holdings by looking for a good header row.
  const candidates = workbook.worksheets
    .map((ws) => ({ ws, header: findBestHeaderCandidate(ws) }))
    .filter((x) => x.header)
    .sort((a, b) => (b.header!.score ?? 0) - (a.header!.score ?? 0))

  const picked = candidates[0]
  if (!picked || !picked.header) {
    const sheetNames = workbook.worksheets.map((w) => w.name).join(', ')
    const previews = workbook.worksheets
      .slice(0, 3)
      .map((w) => `Sheet "${w.name}" preview:\n${sheetPreview(w)}`)
      .join('\n\n')
    throw new Error(
      `INDmoney import: couldn't find a header row.\nSheets: ${sheetNames}\n\n${previews}`,
    )
  }
  const sheet = picked.ws
  const headerRowNumber = picked.header.rowNumber

  const headers = picked.header.headers.map((h) => h.trim())

  const rows: RowObj[] = []
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return
    const obj: RowObj = {}
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i]
      if (!h) continue
      obj[h] = row.getCell(i + 1).value as any
    }
    // skip empty rows
    if (Object.values(obj).every((v) => asString(v).trim() === '')) return
    rows.push(obj)
  })

  const out: IndmoneyDraft[] = []

  for (const r of rows) {
    const name = asString(
      getAny(r, [
        'Stock Name',
        'Instrument',
        'Scrip Name',
        'Company Name',
        'Name',
        'Security',
        'Stock',
        'Fund Name',
        'Mutual Fund',
        'Asset',
      ]),
    ).trim()
    if (!name) continue

    const symbol = asString(getAny(r, ['Symbol', 'Ticker', 'NSE Symbol', 'Trading Symbol'])).trim() || undefined

    const qty = toNum(getAny(r, ['Quantity', 'Qty', 'Units', 'No. of shares']))
    const avg = toNum(
      getAny(r, [
        'Avg Price',
        'Average Price',
        'Avg. Price',
        'Avg Cost',
        'Average buy price',
        'Buy Price',
        'Cost Price',
      ]),
    )
    const invested = toNum(getAny(r, ['Invested', 'Invested Amount', 'Cost', 'Cost Value', 'Buy Value']))
    let ltp = toNum(getAny(r, ['LTP', 'Last Price', 'Current Price', 'CMP', 'NAV']))
    const sector = asString(getAny(r, ['Sector', 'Industry', 'Category', 'Asset Class'])).trim() || undefined

    // Heuristic: if header has NAV/Units → mutual fund
    const looksLikeMF =
      Object.keys(r).some((k) => normKey(k) === 'nav') ||
      Object.keys(r).some((k) => normKey(k) === 'units') ||
      /fund/i.test(name)

    if (looksLikeMF) {
      out.push({
        type: 'mutual_fund',
        name,
        symbol,
        platform: 'indmoney',
        units: qty || 0,
        nav: ltp || 0,
        investedAmount: invested || (qty && avg ? qty * avg : 0),
      })
      continue
    }

    if (!qty || (!avg && !invested)) {
      // skip non-holding / summary lines
      continue
    }

    // If LTP/current price not present in this INDmoney export, approximate with avg or cost-per-share.
    if (!ltp) {
      if (avg) ltp = avg
      else if (invested && qty) ltp = invested / qty
    }

    out.push({
      type: 'stock',
      name,
      symbol: symbol ?? (name.length <= 15 && !/\s/.test(name) ? name : undefined),
      platform: 'indmoney',
      quantity: qty,
      buyPrice: avg || (invested && qty ? invested / qty : 0),
      currentPrice: ltp,
      sector,
    })
  }

  // dedupe by name + qty
  const seen = new Set<string>()
  const deduped = out.filter((d) => {
    const k = `${d.type}__${d.name}__${'quantity' in d ? d.quantity : d.units}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  if (deduped.length === 0) {
    const headerSummary = headers.filter(Boolean).slice(0, 30).join(' | ')
    throw new Error(
      `INDmoney import: detected table headers but couldn't map any holdings rows.\n\nSheet: "${sheet.name}"\nHeader row: ${headerRowNumber}\nHeaders: ${headerSummary}`,
    )
  }

  return deduped
}

