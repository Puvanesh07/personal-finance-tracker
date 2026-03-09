// netlify/functions/stock-meta.ts
// Called ONLY for stocks not found in the frontend static DB.
// Uses Screener.in (no auth required, public HTML scraping) as primary,
// NSE India API as secondary, Yahoo Finance v8 for market cap fallback.

import type { Handler } from '@netlify/functions'

const CORS   = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Cache-Control': 'public, max-age=86400' }
const JSON_H = { ...CORS, 'Content-Type': 'application/json' }
const UA     = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function ok(body: object) { return { statusCode: 200, headers: JSON_H, body: JSON.stringify(body) } }

// ─── Screener.in scraper ──────────────────────────────────────────────────────
// Screener.in has a public company page with sector + market cap, no auth needed.
// URL pattern: https://www.screener.in/company/SYMBOL/consolidated/
async function screenerLookup(symbol: string): Promise<{ sector: string; marketCap: number | null; longName: string } | null> {
  const urls = [
    `https://www.screener.in/company/${encodeURIComponent(symbol)}/consolidated/`,
    `https://www.screener.in/company/${encodeURIComponent(symbol)}/`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-IN,en;q=0.9' },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      const html = await res.text()

      // Extract company name from <h1 class="h2">
      const nameMatch = html.match(/<h1[^>]*class="[^"]*h2[^"]*"[^>]*>\s*([^<]+)/i)
        ?? html.match(/<title>([^|<]+)/i)
      const longName = nameMatch?.[1]?.trim().replace(/ - Screener$/, '') ?? symbol

      // Extract sector — Screener shows it as a link in the company info section
      // Pattern: <a href="/screen/public/?query=Sector...">SECTOR NAME</a>  OR
      //          <span>Sector</span> ...value...
      const sectorMatch = html.match(/sector[^"]*"[^>]*>\s*([A-Za-z &\/]+)\s*<\/a>/i)
        ?? html.match(/Sector\s*<\/[a-z]+>\s*<[a-z][^>]*>\s*([^<]+)/i)
        ?? html.match(/class="[^"]*company-ratios[^"]*"[\s\S]*?Sector[\s\S]*?<span[^>]*>\s*([^<]+)/i)
      const sector = sectorMatch?.[1]?.trim() ?? ''

      // Extract market cap — Screener shows "Market Cap ₹ X,XX,XXX Cr"
      const mcapMatch = html.match(/Market\s+Cap\s*[₹Rs\.]*\s*([\d,]+)/i)
      let marketCap: number | null = null
      if (mcapMatch) {
        const crores = parseFloat(mcapMatch[1].replace(/,/g, ''))
        if (!isNaN(crores) && crores > 0) marketCap = crores * 1e7  // Cr → INR
      }

      if (sector || marketCap) {
        console.log(`[stock-meta] Screener ${symbol} → sector="${sector}" mcap=${marketCap}`)
        return { sector, marketCap, longName }
      }
    } catch (e: any) {
      console.warn(`[stock-meta] Screener fetch failed for ${symbol}: ${e?.message}`)
    }
  }
  return null
}

// ─── NSE India API (secondary fallback) ──────────────────────────────────────
async function nseGetCookie(): Promise<string> {
  const r = await fetch('https://www.nseindia.com', {
    headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(7_000),
  })
  return r.headers.get('set-cookie')?.split(/,(?=[^ ])/).map((c) => c.split(';')[0].trim()).join('; ') ?? ''
}

async function nseLookup(symbol: string, cookie: string) {
  const r = await fetch(`https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.nseindia.com/', Cookie: cookie },
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) throw new Error(`NSE ${r.status}`)
  const d = await r.json()
  const info = d?.info ?? {}
  const pi   = d?.priceInfo ?? {}
  return {
    sector:    (info.sector || info.industry || '') as string,
    longName:  (info.companyName || symbol) as string,
    marketCap: info.marketCap ? info.marketCap * 1e7 : pi.totalMarketCap ? pi.totalMarketCap * 1e7 : null as number | null,
  }
}

async function nseISINSearch(isin: string, cookie: string) {
  const r = await fetch(`https://www.nseindia.com/api/search/autocomplete?q=${encodeURIComponent(isin)}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.nseindia.com/', Cookie: cookie },
    signal: AbortSignal.timeout(8_000),
  })
  if (!r.ok) throw new Error(`NSE ISIN ${r.status}`)
  const hit = (await r.json())?.symbols?.[0]
  if (!hit) throw new Error('no hit')
  return { symbol: hit.symbol as string, longName: (hit.meta?.companyName || hit.symbol) as string }
}

// ─── Yahoo Finance v8 — market cap only ──────────────────────────────────────
async function yahooMcap(symbol: string): Promise<number | null> {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=1d`, {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6_000),
    })
    return (await r.json())?.chart?.result?.[0]?.meta?.marketCap ?? null
  } catch { return null }
}

// ─── Determine cap category from market cap ───────────────────────────────────
function capFromMcap(mcap: number | null): string {
  if (!mcap || mcap <= 0) return ''
  if (mcap >= 200_000_000_000) return 'Large Cap'
  if (mcap >= 50_000_000_000)  return 'Mid Cap'
  return 'Small Cap'
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  const p      = event.queryStringParameters ?? {}
  const symbol = (p.symbol ?? '').trim().toUpperCase()
  const isin   = (p.isin   ?? '').trim().toUpperCase()
  const name   = (p.name   ?? '').trim()
  const display = name || symbol || isin

  if (!symbol && !isin && !name) {
    return { statusCode: 400, headers: JSON_H, body: JSON.stringify({ error: 'Provide symbol, isin, or name' }) }
  }

  let nseSymbol = symbol
  let sector    = ''
  let longName  = display
  let marketCap: number | null = null
  let source    = 'none'

  // ── Step 1: ISIN → NSE symbol ─────────────────────────────────────────────
  if (isin && !nseSymbol) {
    try {
      const cookie = await nseGetCookie()
      const r = await nseISINSearch(isin, cookie)
      nseSymbol = r.symbol
      longName  = r.longName || longName
      console.log(`[stock-meta] ISIN ${isin} → ${nseSymbol}`)
    } catch (e: any) {
      console.warn(`[stock-meta] ISIN search failed: ${e?.message}`)
    }
  }

  // ── Step 2: Screener.in (primary API — no auth, reliable) ─────────────────
  if (nseSymbol) {
    const screener = await screenerLookup(nseSymbol)
    if (screener) {
      sector    = screener.sector    || sector
      marketCap = screener.marketCap ?? marketCap
      longName  = screener.longName  || longName
      source    = 'screener'
    }
  }

  // ── Step 3: NSE API if Screener missed sector ─────────────────────────────
  if (nseSymbol && !sector) {
    try {
      const cookie = await nseGetCookie()
      const r = await nseLookup(nseSymbol, cookie)
      sector    = r.sector    || sector
      marketCap = marketCap ?? r.marketCap
      longName  = longName  || r.longName
      if (!source || source === 'none') source = 'nse'
    } catch (e: any) {
      console.warn(`[stock-meta] NSE fallback failed: ${e?.message}`)
    }
  }

  // ── Step 4: Yahoo market cap if still missing ─────────────────────────────
  if (!marketCap && nseSymbol) {
    marketCap = await yahooMcap(nseSymbol)
    if (marketCap) source = source !== 'none' ? source : 'yahoo'
  }

  return ok({
    symbol:            nseSymbol || symbol,
    sector:            sector    || 'Unknown',
    industry:          sector    || 'Unknown',
    marketCap:         marketCap ?? null,
    staticCapCategory: capFromMcap(marketCap),
    longName:          longName  || display,
    source,
  })
}