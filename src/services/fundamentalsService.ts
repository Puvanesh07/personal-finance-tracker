// src/services/fundamentalsService.ts
// Fetches fundamentals from the Cloudflare Worker /fundamentals endpoint.
//
// Asset routing:
//   Indian equity:  symbol like "TCS"       → worker scrapes Screener.in
//   Mutual Fund:    "MF:119551"              → worker fetches mfapi.in NAV history
//   Gold/Silver ETF, US stocks, Crypto:      not supported — manual entry only
//
// Pattern mirrors livePriceService.ts: in-memory cache, chunking, progress callback.

import type { FundamentalData } from '../utils/folioSyncEngine';

// ── Types ──────────────────────────────────────────────────────────────────────

export type FetchedFundamentals = FundamentalData & {
  _source?: 'screener' | 'mfapi' | 'error';
  _symbol?: string;
  _fetchedAt?: string;
  _url?: string;
  _error?: string;
  // MF-specific metadata
  _mfName?: string;
  _mfCategory?: string;
  _mfType?: string;
  _nav?: number;
  _returns1yr?: number | null;
  _returns3yr?: number | null;
  _returns5yr?: number | null;
  _maxDrawdown?: number | null;
  _navCount?: number;
};

export type FundamentalsProgressCallback = (
  done: number,
  total: number,
) => void;

// ── Cache ──────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CHUNK_SIZE = 5;
const CHUNK_DELAY_MS = 200;

type CacheEntry = { data: FetchedFundamentals; expiresAt: number };
const cache = new Map<string, CacheEntry>();

function getCached(key: string): FetchedFundamentals | null {
  const e = cache.get(key.toUpperCase());
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(key.toUpperCase());
    return null;
  }
  return e.data;
}
function setCached(key: string, data: FetchedFundamentals) {
  cache.set(key.toUpperCase(), { data, expiresAt: Date.now() + CACHE_TTL_MS });
}
export function invalidateFundamentalsCache(keys?: string[]) {
  if (!keys) {
    cache.clear();
    return;
  }
  keys.forEach((k) => cache.delete(k.toUpperCase()));
}
export function getCacheAge(key: string): string | null {
  const e = cache.get(key.toUpperCase());
  if (!e) return null;
  const mins = Math.floor((Date.now() - (e.expiresAt - CACHE_TTL_MS)) / 60000);
  return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function workerUrl(): string {
  const url = import.meta.env.VITE_LIVE_PRICE_WORKER_URL as string | undefined;
  if (!url) throw new Error('VITE_LIVE_PRICE_WORKER_URL not set');
  return url.replace(/\/$/, '');
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Build the correct worker symbol for an investment ─────────────────────────
// Returns null if auto-fetch is not supported for this asset type.
export function getFundamentalsSymbol(inv: {
  type: string;
  assetType?: string;
  usdPrice?: number;
  buyPriceUsd?: number;
  usdToInr?: number;
  symbol?: string;
  schemeCode?: string;
  amfiCode?: string;
}): string | null {
  // Indian equity stock
  if (
    inv.type === 'stock' &&
    inv.symbol &&
    !inv.usdPrice &&
    !inv.buyPriceUsd &&
    !inv.usdToInr
  )
    return inv.symbol.toUpperCase();
  // Mutual fund (needs 5-6 digit scheme code)
  if (inv.type === 'mutual_fund') {
    const raw = inv.schemeCode || inv.amfiCode || inv.symbol;
    if (raw && /^\d{5,6}$/.test(String(raw).trim()))
      return `MF:${String(raw).trim()}`;
  }
  return null; // Gold ETF, US stock, crypto → manual only
}

export function canAutoFetch(inv: {
  type: string;
  assetType?: string;
  usdPrice?: number;
  buyPriceUsd?: number;
  usdToInr?: number;
  symbol?: string;
  schemeCode?: string;
  amfiCode?: string;
}): boolean {
  return getFundamentalsSymbol(inv) !== null;
}

// ── Core fetch functions ───────────────────────────────────────────────────────

async function fetchBatch(
  base: string,
  syms: string[],
): Promise<Record<string, FetchedFundamentals>> {
  const res = await fetch(`${base}/fundamentals?symbols=${syms.join(',')}`, {
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok)
    throw new Error(
      `Worker ${res.status}: ${await res.text().catch(() => '')}`,
    );
  const d = (await res.json()) as {
    fundamentals: Record<string, FetchedFundamentals>;
  };
  return d.fundamentals ?? {};
}

/**
 * Fetch fundamentals for one or more symbols.
 * Pass raw NSE symbols ("TCS") for equity, or "MF:119551" for mutual funds.
 */
export async function fetchFundamentalsForSymbols(
  symbols: string[],
  onProgress?: FundamentalsProgressCallback,
): Promise<Record<string, FetchedFundamentals>> {
  const keys = [
    ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];
  if (!keys.length) return {};

  const merged: Record<string, FetchedFundamentals> = {};
  const needsFetch: string[] = [];

  for (const k of keys) {
    const cached = getCached(k);
    if (cached) merged[k] = cached;
    else needsFetch.push(k);
  }

  if (needsFetch.length > 0) {
    const base = workerUrl();
    const chunks = chunk(needsFetch, CHUNK_SIZE);
    let done = Object.keys(merged).length;

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      try {
        const batch = await fetchBatch(base, c);
        for (const [k, data] of Object.entries(batch)) {
          merged[k] = data;
          if (data._source !== 'error') setCached(k, data);
        }
      } catch (e) {
        console.error(`[fundamentals] batch failed (${c.join(',')})`, e);
        for (const k of c)
          merged[k] = { _source: 'error', _symbol: k, _error: String(e) };
      }
      done += c.length;
      onProgress?.(Math.min(done, keys.length), keys.length);
      if (i < chunks.length - 1) await sleep(CHUNK_DELAY_MS);
    }
  } else {
    onProgress?.(keys.length, keys.length);
  }

  if (import.meta.env.DEV) {
    for (const [k, d] of Object.entries(merged)) {
      if (d._source === 'error')
        console.warn(
          `%c[Fund] ${k} ERROR: ${d._error}`,
          'color:#f87171;font-weight:bold;',
        );
      else if (d._source === 'mfapi')
        console.log(
          `%c[Fund] ${k} MF: 1yr=${d._returns1yr}% 3yr=${d._returns3yr}% 52W=${d.fiftyTwoWeekPosition}%`,
          'color:#818cf8;font-weight:bold;',
        );
      else
        console.log(
          `%c[Fund] ${k} PE:${d.pe} ROE:${d.roe} ROCE:${d.roce} D/E:${d.debtToEquity} CR:${d.currentRatio}`,
          'color:#10b981;font-weight:bold;',
        );
    }
  }

  return merged;
}

/**
 * Fetch fundamentals for a single symbol.
 * For MF, pass "MF:119551". For equity, pass "TCS".
 */
export async function fetchFundamentalsForSymbol(
  symbol: string,
): Promise<FetchedFundamentals | null> {
  const result = await fetchFundamentalsForSymbols([symbol.toUpperCase()]);
  return result[symbol.toUpperCase()] ?? null;
}
