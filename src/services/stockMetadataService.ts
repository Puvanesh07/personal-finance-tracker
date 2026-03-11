// src/services/stockMetadataService.ts
// Resolution order (all happen SYNCHRONOUSLY in the browser — no network for known stocks):
//   1. ETF map (by symbol)              → instant
//   2. Static NSE DB (by symbol)        → instant
//   3. ISIN → symbol → static DB        → instant
//   4. Mutual fund name classifier      → instant
//   5. Screener.in API (via Netlify fn) → network, only for unknown stocks

import {
  ETF_MAP,
  ISIN_TO_SYMBOL,
  NSE_STOCK_DB,
  classifyMutualFundByName,
} from '../data/nseStockdata';

export type MarketCapCategory =
  | 'Large Cap'
  | 'Mid Cap'
  | 'Small Cap'
  | 'Large & Mid Cap'
  | 'Multi Cap'
  | 'Hybrid'
  | 'Debt'
  | 'Unknown';

export interface StockMetadata {
  symbol: string;
  sector: string;
  industry: string;
  marketCap: number | null;
  marketCapCategory: MarketCapCategory;
  longName: string;
  source: string;
  fetchedAt: number;
}

// ─── Market cap classification ────────────────────────────────────────────────
const LARGE_CAP_INR = 200_000_000_000; // ₹20,000 Cr
const MID_CAP_INR = 50_000_000_000; // ₹5,000 Cr

export function classifyMarketCap(
  marketCap: number | null,
  staticCap?: string,
): MarketCapCategory {
  const KNOWN: MarketCapCategory[] = [
    'Large Cap',
    'Mid Cap',
    'Small Cap',
    'Large & Mid Cap',
    'Multi Cap',
    'Hybrid',
    'Debt',
  ];
  if (staticCap && KNOWN.includes(staticCap as MarketCapCategory))
    return staticCap as MarketCapCategory;
  if (!marketCap || marketCap <= 0) return 'Unknown';
  if (marketCap >= LARGE_CAP_INR) return 'Large Cap';
  if (marketCap >= MID_CAP_INR) return 'Mid Cap';
  return 'Small Cap';
}

// ─── Offline static resolution (SYNCHRONOUS — no network) ────────────────────
function resolveOffline(
  symbol?: string,
  isin?: string,
  name?: string,
): StockMetadata | null {
  const sym = symbol?.trim().toUpperCase();
  const isn = isin?.trim().toUpperCase();
  const nm = name?.trim() ?? '';

  // 1. ETF map by symbol
  if (sym && ETF_MAP[sym]) {
    const e = ETF_MAP[sym];
    return make(sym, e.sector, e.sector, null, e.cap, nm || sym, 'etf_map');
  }

  // 2. NSE static DB by symbol
  if (sym && NSE_STOCK_DB[sym]) {
    const d = NSE_STOCK_DB[sym];
    return make(sym, d.sector, d.industry, null, d.cap, nm || sym, 'static_db');
  }

  // 3. ISIN → symbol → static DB
  if (isn) {
    const mappedSym = ISIN_TO_SYMBOL[isn];
    if (mappedSym) {
      const d = NSE_STOCK_DB[mappedSym];
      if (d)
        return make(
          mappedSym,
          d.sector,
          d.industry,
          null,
          d.cap,
          nm || mappedSym,
          'isin_static',
        );
      // ISIN mapped to symbol but not in DB — still return symbol for further lookup
    }
  }

  // 4. Mutual fund / ETF name classification
  if (nm) {
    const mf = classifyMutualFundByName(nm);
    if (mf)
      return make(
        sym ?? '',
        mf.sector,
        mf.sector,
        null,
        mf.cap,
        nm,
        'name_classify',
      );
  }

  return null;
}

function make(
  symbol: string,
  sector: string,
  industry: string,
  marketCap: number | null,
  staticCap: string,
  longName: string,
  source: string,
): StockMetadata {
  return {
    symbol,
    sector,
    industry,
    marketCap,
    marketCapCategory: classifyMarketCap(marketCap, staticCap),
    longName: longName || symbol,
    source,
    fetchedAt: Date.now(),
  };
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const TTL_MS = 12 * 60 * 60 * 1000;
const memCache = new Map<string, StockMetadata>();

function readCache(key: string): StockMetadata | null {
  const m = memCache.get(key);
  if (m && Date.now() - m.fetchedAt < TTL_MS) return m;
  try {
    const raw = sessionStorage.getItem(`smeta_${key}`);
    if (!raw) return null;
    const p: StockMetadata = JSON.parse(raw);
    if (Date.now() - p.fetchedAt >= TTL_MS) {
      sessionStorage.removeItem(`smeta_${key}`);
      return null;
    }
    memCache.set(key, p);
    return p;
  } catch {
    return null;
  }
}

function writeCache(key: string, meta: StockMetadata) {
  memCache.set(key, meta);
  try {
    sessionStorage.setItem(`smeta_${key}`, JSON.stringify(meta));
  } catch {
    /* quota */
  }
}

// ─── Network fallback — Screener.in via Netlify function ─────────────────────
const inFlight = new Map<string, Promise<StockMetadata>>();

async function fetchFromFunction(
  symbol: string,
  isin: string,
  name: string,
): Promise<StockMetadata> {
  const p = new URLSearchParams();
  if (symbol) p.set('symbol', symbol);
  if (isin) p.set('isin', isin);
  if (name) p.set('name', name);
  const res = await fetch(`/.netlify/functions/stock-meta?${p}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`fn HTTP ${res.status}`);
  const d = await res.json();
  return make(
    d.symbol || symbol || name,
    d.sector || 'Unknown',
    d.industry || 'Unknown',
    d.marketCap ?? null,
    d.staticCapCategory || '',
    d.longName || name || symbol,
    d.source || 'api',
  );
}

function networkFetch(
  ckey: string,
  symbol: string,
  isin: string,
  name: string,
  fallbackDisplay: string,
): Promise<StockMetadata> {
  const cached = readCache(ckey);
  if (cached) return Promise.resolve(cached);
  const existing = inFlight.get(ckey);
  if (existing) return existing;
  const p = fetchFromFunction(symbol, isin, name)
    .then((m) => {
      writeCache(ckey, m);
      return m;
    })
    .catch(() =>
      make(
        symbol || fallbackDisplay,
        'Unknown',
        'Unknown',
        null,
        '',
        fallbackDisplay,
        'none',
      ),
    )
    .finally(() => inFlight.delete(ckey));
  inFlight.set(ckey, p);
  return p;
}

// ─── Main resolution ──────────────────────────────────────────────────────────
export function resolveMetadata(opts: {
  symbol?: string;
  isin?: string;
  name?: string;
}): StockMetadata | Promise<StockMetadata> {
  const { symbol = '', isin = '', name = '' } = opts;
  const display = name || symbol || isin;

  // Try offline first — no network needed
  const offline = resolveOffline(symbol, isin, name);
  if (offline) return offline;

  // Only reach here for truly unknown stocks → hit Netlify fn (Screener.in)
  const ckey = `api:${(isin || symbol || name).toUpperCase()}`;
  return networkFetch(ckey, symbol, isin, name, display);
}

// ─── React-friendly batch fetch ───────────────────────────────────────────────
export async function fetchAllMetadata(
  items: Array<{ key: string; symbol?: string; isin?: string; name?: string }>,
): Promise<Map<string, StockMetadata>> {
  const result = new Map<string, StockMetadata>();
  const pending: Array<{ key: string; promise: Promise<StockMetadata> }> = [];

  for (const item of items) {
    const r = resolveMetadata(item);
    if (r instanceof Promise) {
      pending.push({ key: item.key, promise: r });
    } else {
      result.set(item.key, r);
    }
  }

  // Batch network calls — max 3 concurrent, 300ms between batches
  const BATCH = 3,
    DELAY = 300;
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const settled = await Promise.allSettled(batch.map((b) => b.promise));
    settled.forEach((s, idx) => {
      const { key } = batch[idx];
      result.set(
        key,
        s.status === 'fulfilled'
          ? s.value
          : make(key, 'Unknown', 'Unknown', null, '', key, 'error'),
      );
    });
    if (i + BATCH < pending.length)
      await new Promise((r) => setTimeout(r, DELAY));
  }

  return result;
}

// ─── Convenience exports ──────────────────────────────────────────────────────
export const fetchStockMetadata = resolveMetadata;
