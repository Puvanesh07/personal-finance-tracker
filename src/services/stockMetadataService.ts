// src/services/stockMetadataService.ts
//
// Fully API-driven stock metadata resolution.
// Replaces the manual nseStockdata.ts file entirely.
//
// Data flow:
//   symbol/isin/name → Worker /meta → NSE API → sector, industry, cap, name
//                                   → TickerTape (fallback)
//
// Cache strategy:
//   - In-memory (instant, current session)
//   - localStorage (30 days — sector/cap rarely change)
//
// Compatible: same exports as old stockMetadataService so no other files change.

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const STORAGE_KEY = 'stock_meta_cache_v2';
const BATCH_SIZE = 15; // symbols per worker /meta request
const BATCH_DELAY = 200; // ms between batches

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Cache ─────────────────────────────────────────────────────────────────────

type CacheStore = Record<string, StockMetadata>;
let _mem: CacheStore | null = null;

function getCache(): CacheStore {
  if (_mem) return _mem;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _mem = raw ? (JSON.parse(raw) as CacheStore) : {};
  } catch {
    _mem = {};
  }
  return _mem;
}

function saveCache(store: CacheStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function getCached(key: string): StockMetadata | null {
  const store = getCache();
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    delete store[key];
    return null;
  }
  return entry;
}

function setCached(key: string, meta: StockMetadata) {
  const store = getCache();
  store[key] = meta;
  saveCache(store);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWorkerUrl(): string {
  const url = import.meta.env.VITE_LIVE_PRICE_WORKER_URL as string | undefined;
  if (!url) throw new Error('VITE_LIVE_PRICE_WORKER_URL not set');
  return url.replace(/\/$/, '');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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
  const cr = marketCap / 1e7;
  if (cr >= 20000) return 'Large Cap';
  if (cr >= 5000) return 'Mid Cap';
  return 'Small Cap';
}

function makeUnknown(symbol: string, name?: string): StockMetadata {
  return {
    symbol,
    sector: 'Unknown',
    industry: 'Unknown',
    marketCap: null,
    marketCapCategory: 'Unknown',
    longName: name || symbol,
    source: 'none',
    fetchedAt: Date.now(),
  };
}

function workerMetaToStockMetadata(
  raw: any,
  fallbackSymbol: string,
): StockMetadata {
  return {
    symbol: raw.symbol ?? fallbackSymbol,
    sector: raw.sector ?? 'Unknown',
    industry: raw.industry ?? raw.sector ?? 'Unknown',
    marketCap: raw.marketCap ?? null,
    marketCapCategory:
      (raw.capCategory as MarketCapCategory) ??
      classifyMarketCap(raw.marketCap),
    longName: raw.companyName ?? fallbackSymbol,
    source: raw.source ?? 'api',
    fetchedAt: Date.now(),
  };
}

// ── Mutual fund classifier (no static DB needed — pure name parsing) ──────────

function classifyMutualFundByName(name: string): StockMetadata {
  const n = name.toLowerCase();

  let cap: MarketCapCategory = 'Multi Cap';
  if (n.includes('large & mid') || n.includes('250')) cap = 'Large & Mid Cap';
  else if (
    n.includes('large cap') ||
    n.includes('largecap') ||
    n.includes('nifty 50')
  )
    cap = 'Large Cap';
  else if (n.includes('mid cap') || n.includes('midcap')) cap = 'Mid Cap';
  else if (n.includes('small cap') || n.includes('smallcap')) cap = 'Small Cap';
  else if (n.includes('flexi') || n.includes('multi cap')) cap = 'Multi Cap';
  else if (n.includes('balanced') || n.includes('hybrid')) cap = 'Hybrid';
  else if (n.includes('debt') || n.includes('liquid')) cap = 'Debt';

  let sector = 'Mutual Fund - Diversified';
  if (n.includes('tech') || n.includes('digital'))
    sector = 'Mutual Fund - Technology';
  else if (n.includes('pharma') || n.includes('health'))
    sector = 'Mutual Fund - Healthcare';
  else if (n.includes('bank') || n.includes('finserv'))
    sector = 'Mutual Fund - Banking & Finance';
  else if (n.includes('infra')) sector = 'Mutual Fund - Infrastructure';
  else if (n.includes('fmcg') || n.includes('consumption'))
    sector = 'Mutual Fund - FMCG';
  else if (n.includes('index') || n.includes('nifty') || n.includes('sensex'))
    sector = 'Mutual Fund - Index';
  else if (n.includes('flexi cap') || n.includes('flexicap'))
    sector = 'Mutual Fund - Flexi Cap';
  else if (n.includes('mid cap') || n.includes('midcap'))
    sector = 'Mutual Fund - Mid Cap';
  else if (n.includes('small cap') || n.includes('smallcap'))
    sector = 'Mutual Fund - Small Cap';
  else if (n.includes('gold') || n.includes('silver'))
    sector = 'Mutual Fund - Commodities';
  else if (
    n.includes('international') ||
    n.includes('global') ||
    n.includes('nasdaq')
  )
    sector = 'Mutual Fund - International';
  else if (n.includes('defence')) sector = 'Mutual Fund - Defence';
  else if (n.includes('psu')) sector = 'Mutual Fund - PSU';
  else if (n.includes('quant')) sector = 'Mutual Fund - Quant';
  else if (n.includes('value') || n.includes('contra'))
    sector = 'Mutual Fund - Value';
  else if (n.includes('focused')) sector = 'Mutual Fund - Focused';
  else if (n.includes('elss') || n.includes('tax'))
    sector = 'Mutual Fund - ELSS';

  return {
    symbol: '',
    sector,
    industry: sector,
    marketCap: null,
    marketCapCategory: cap,
    longName: name,
    source: 'name_classify',
    fetchedAt: Date.now(),
  };
}

// ── Batch fetch from worker /meta ─────────────────────────────────────────────

async function fetchBatchFromWorker(
  symbols: string[],
): Promise<Record<string, StockMetadata>> {
  const workerUrl = getWorkerUrl();
  const res = await fetch(`${workerUrl}/meta?symbols=${symbols.join(',')}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Worker /meta ${res.status}`);
  const data = await res.json();
  const result: Record<string, StockMetadata> = {};
  for (const sym of symbols) {
    const raw = data.meta?.[sym];
    if (raw) result[sym] = workerMetaToStockMetadata(raw, sym);
  }
  return result;
}

// ── Main resolution — used by all components ──────────────────────────────────

/**
 * Resolve metadata for a single stock/ETF/MF.
 * Returns StockMetadata synchronously from cache, or a Promise for uncached.
 *
 * Compatible with old stockMetadataService — same signature and return type.
 */
export function resolveMetadata(opts: {
  symbol?: string;
  isin?: string;
  name?: string;
}): StockMetadata | Promise<StockMetadata> {
  const symbol = (opts.symbol ?? '').trim().toUpperCase();
  const name = (opts.name ?? '').trim();
  const cacheKey = symbol || name;

  if (!cacheKey) return makeUnknown('', name);

  // 1. Check cache first (instant)
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // 2. Mutual funds — classify by name (no API needed, instant)
  if (!symbol && name) {
    const mf = classifyMutualFundByName(name);
    setCached(cacheKey, mf);
    return mf;
  }
  if (
    symbol &&
    (symbol.startsWith('MF:') || !symbol.match(/^[A-Z0-9&_-]{1,20}$/))
  ) {
    const mf = classifyMutualFundByName(name || symbol);
    setCached(cacheKey, mf);
    return mf;
  }

  // 3. Fetch from worker API (async)
  return (async () => {
    try {
      const result = await fetchBatchFromWorker([symbol]);
      const meta = result[symbol] ?? makeUnknown(symbol, name);
      // If sector still unknown but we have a name, try name classification as supplement
      if (meta.sector === 'Unknown' && name) {
        const nameMeta = classifyMutualFundByName(name);
        if (nameMeta.sector !== 'Mutual Fund - Diversified') {
          meta.sector = nameMeta.sector;
          meta.industry = nameMeta.sector;
        }
      }
      setCached(cacheKey, meta);
      return meta;
    } catch {
      const fallback = makeUnknown(symbol, name);
      // Don't cache failures — retry next time
      return fallback;
    }
  })();
}

/**
 * Batch resolve metadata for many investments.
 * Deduplicates, batches API calls, respects rate limits.
 * Returns Map<investmentId, StockMetadata>
 */
export async function fetchAllMetadata(
  items: Array<{ key: string; symbol?: string; isin?: string; name?: string }>,
): Promise<Map<string, StockMetadata>> {
  const result = new Map<string, StockMetadata>();

  // Separate cached vs needs fetch
  const toFetch: typeof items = [];
  for (const item of items) {
    const symbol = (item.symbol ?? '').trim().toUpperCase();
    const name = (item.name ?? '').trim();
    const cacheKey = symbol || name;
    if (!cacheKey) continue;

    const cached = getCached(cacheKey);
    if (cached) {
      result.set(item.key, cached);
      continue;
    }

    // Mutual funds — instant, no API needed
    if (!symbol && name) {
      const mf = classifyMutualFundByName(name);
      setCached(name, mf);
      result.set(item.key, mf);
      continue;
    }

    toFetch.push(item);
  }

  if (toFetch.length === 0) return result;

  // Deduplicate symbols
  const symbolToKeys = new Map<string, string[]>();
  for (const item of toFetch) {
    const sym = (item.symbol ?? '').trim().toUpperCase();
    if (!sym) continue;
    if (!symbolToKeys.has(sym)) symbolToKeys.set(sym, []);
    symbolToKeys.get(sym)!.push(item.key);
  }

  const uniqueSymbols = [...symbolToKeys.keys()];
  console.log(
    `[stockMetadataService] Fetching metadata for ${uniqueSymbols.length} symbols from NSE API`,
  );

  // Batch requests
  for (let i = 0; i < uniqueSymbols.length; i += BATCH_SIZE) {
    const batch = uniqueSymbols.slice(i, i + BATCH_SIZE);
    try {
      const batchResult = await fetchBatchFromWorker(batch);
      for (const sym of batch) {
        const meta = batchResult[sym] ?? makeUnknown(sym);
        setCached(sym, meta);
        // Map back to all investment keys using this symbol
        for (const key of symbolToKeys.get(sym) ?? []) {
          result.set(key, meta);
        }
      }
    } catch (e) {
      console.warn(
        `[stockMetadataService] Batch failed for ${batch.join(',')}:`,
        e,
      );
      for (const sym of batch) {
        const fallback = makeUnknown(sym);
        for (const key of symbolToKeys.get(sym) ?? []) {
          result.set(key, fallback);
        }
      }
    }
    if (i + BATCH_SIZE < uniqueSymbols.length) await sleep(BATCH_DELAY);
  }

  return result;
}

// ── Convenience export — same name as old service ─────────────────────────────
export const fetchStockMetadata = resolveMetadata;

// ── Cache management ──────────────────────────────────────────────────────────
export function clearMetadataCache() {
  _mem = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* silent */
  }
  console.log('[stockMetadataService] Cache cleared');
}
