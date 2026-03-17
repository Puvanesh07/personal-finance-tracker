// src/services/fundamentalsService.ts
//
// Fetches fundamental data from the Cloudflare Worker's /fundamentals endpoint.
// The worker scrapes Screener.in for each NSE symbol and returns all FolioSync
// metrics: PE, ROE, ROCE, D/E, CAGRs, promoter holding, quarterly flags, etc.
//
// Pattern mirrors livePriceService.ts:
//   - In-memory cache with 6h TTL (fundamentals change daily, not by the second)
//   - Same chunking + concurrency model
//   - Progress callback for UI feedback
//   - Graceful fallback: null values for unavailable metrics

import type { FundamentalData } from '../utils/folioSyncEngine';

// ── Types ──────────────────────────────────────────────────────────────────────

export type FetchedFundamentals = FundamentalData & {
  _source?: 'screener' | 'error';
  _symbol?: string;
  _fetchedAt?: string;
  _url?: string;
  _error?: string;
};

export type FundamentalsResponse = {
  fundamentals: Record<string, FetchedFundamentals>;
  fetchedAt: string;
  count: number;
};

export type FundamentalsFetchResult = {
  data: FetchedFundamentals;
  fromCache: boolean;
};

export type FundamentalsProgressCallback = (
  done: number,
  total: number,
) => void;

// ── Cache ──────────────────────────────────────────────────────────────────────
// Fundamentals change daily — 6h TTL is generous but avoids hammering Screener
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CHUNK_SIZE = 5; // 5 symbols per worker request
const CHUNK_DELAY_MS = 200;

type CacheEntry = { data: FetchedFundamentals; expiresAt: number };
const fundamentalsCache = new Map<string, CacheEntry>();

function getCached(symbol: string): FetchedFundamentals | null {
  const entry = fundamentalsCache.get(symbol.toUpperCase());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    fundamentalsCache.delete(symbol.toUpperCase());
    return null;
  }
  return entry.data;
}

function setCached(symbol: string, data: FetchedFundamentals) {
  fundamentalsCache.set(symbol.toUpperCase(), {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidateFundamentalsCache(symbols?: string[]) {
  if (!symbols) {
    fundamentalsCache.clear();
    return;
  }
  symbols.forEach((s) => fundamentalsCache.delete(s.toUpperCase()));
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getWorkerUrl(): string {
  const url = import.meta.env.VITE_LIVE_PRICE_WORKER_URL as string | undefined;
  if (!url) throw new Error('VITE_LIVE_PRICE_WORKER_URL is not set in .env');
  return url.replace(/\/$/, '');
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchBatch(
  workerUrl: string,
  symbols: string[],
): Promise<Record<string, FetchedFundamentals>> {
  const url = `${workerUrl}/fundamentals?symbols=${symbols.join(',')}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Worker ${res.status}: ${body}`);
  }
  const data = (await res.json()) as FundamentalsResponse;
  return data.fundamentals ?? {};
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Fetch fundamentals for one or more NSE equity symbols.
 * Only works for Indian equity stocks — pass raw NSE symbol (e.g. "TCS", "RELIANCE").
 * Returns null data for MF, US stocks, Gold, Crypto — those are scored manually.
 */
export async function fetchFundamentalsForSymbols(
  symbols: string[],
  onProgress?: FundamentalsProgressCallback,
): Promise<Record<string, FetchedFundamentals>> {
  const clean = [
    ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];
  if (clean.length === 0) return {};

  const merged: Record<string, FetchedFundamentals> = {};
  const needsFetch: string[] = [];

  // Serve from cache first
  for (const sym of clean) {
    const cached = getCached(sym);
    if (cached) merged[sym] = cached;
    else needsFetch.push(sym);
  }

  if (needsFetch.length > 0) {
    const workerUrl = getWorkerUrl();
    const chunks = chunkArray(needsFetch, CHUNK_SIZE);
    let doneCount = Object.keys(merged).length;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const batchResult = await fetchBatch(workerUrl, chunk);
        for (const [sym, data] of Object.entries(batchResult)) {
          merged[sym] = data;
          if (data._source !== 'error') setCached(sym, data);
        }
      } catch (e) {
        console.error(
          `[fundamentalsService] Batch failed (${chunk.join(',')}):`,
          e,
        );
        for (const sym of chunk) {
          merged[sym] = { _source: 'error', _symbol: sym, _error: String(e) };
        }
      }
      doneCount += chunk.length;
      onProgress?.(Math.min(doneCount, clean.length), clean.length);
      if (i < chunks.length - 1) await sleep(CHUNK_DELAY_MS);
    }
  } else {
    onProgress?.(clean.length, clean.length);
  }

  if (import.meta.env.DEV) {
    for (const [sym, data] of Object.entries(merged)) {
      if (data._source === 'error') {
        console.warn(
          `%c[Fundamentals] ${sym} → ERROR: ${data._error}`,
          'color:#f87171;font-weight:bold;',
        );
      } else {
        console.log(
          `%c[Fundamentals] ${sym} → PE:${data.pe} ROE:${data.roe} ROCE:${data.roce} D/E:${data.debtToEquity}`,
          'color:#10b981;font-weight:bold;',
        );
      }
    }
  }

  return merged;
}

/**
 * Fetch fundamentals for a single symbol.
 */
export async function fetchFundamentalsForSymbol(
  symbol: string,
): Promise<FetchedFundamentals | null> {
  const result = await fetchFundamentalsForSymbols([symbol.toUpperCase()]);
  return result[symbol.toUpperCase()] ?? null;
}

/**
 * Check if a symbol is eligible for auto-fetch (Indian equity only).
 */
export function canAutoFetch(inv: {
  type: string;
  assetType?: string;
  usdPrice?: number;
  buyPriceUsd?: number;
  usdToInr?: number;
  symbol?: string;
}): boolean {
  if (!inv.symbol) return false;
  if (inv.type !== 'stock') return false;
  // Not a US stock
  if (inv.usdPrice || inv.buyPriceUsd || inv.usdToInr) return false;
  return true;
}

/**
 * Get cache age string for display (e.g. "2h ago")
 */
export function getCacheAge(symbol: string): string | null {
  const entry = fundamentalsCache.get(symbol.toUpperCase());
  if (!entry) return null;
  const ageMs = Date.now() - (entry.expiresAt - CACHE_TTL_MS);
  const ageMins = Math.floor(ageMs / 60000);
  if (ageMins < 60) return `${ageMins}m ago`;
  const ageHrs = Math.floor(ageMins / 60);
  return `${ageHrs}h ago`;
}
