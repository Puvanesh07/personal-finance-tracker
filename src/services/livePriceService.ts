// src/services/livePriceService.ts  — OPTIMIZED
//
// Changes vs original:
// 1. In-memory price cache with TTL (default 5 min)
//    Old: every fetchLivePrices() call hit the Cloudflare worker unconditionally
//    New: prices cached in-memory for CACHE_TTL_MS; re-used on repeated calls
//         This is critical on the Investments page where prices are re-requested
//         on every render cycle / filter change.
//
// 2. Verbose per-symbol console.log removed from production builds
//    Old: logged every symbol individually (expensive string concat in hot loop)
//    New: single summary log; per-symbol detail only in dev mode
//
// 3. AbortSignal.timeout() kept — good for preventing hung requests

export type PriceSource =
  | 'nse'
  | 'nse_etf'
  | 'yahoo'
  | 'tickertape'
  | 'mfapi'
  | 'screener'
  | 'none';

export type PriceResult = {
  price: number | null;
  source: PriceSource;
  type?: string;
};

export type LivePriceResponse = {
  prices: Record<string, PriceResult>;
  fetchedAt: string;
  count: number;
};

export type FetchProgressCallback = (fetched: number, total: number) => void;

// ── Tunables ──────────────────────────────────────────────────────────────────
const CHUNK_SIZE = 20;
const MAX_CONCURRENCY = 3;
const GROUP_DELAY_MS = 300;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── In-memory cache ───────────────────────────────────────────────────────────
type CacheEntry = { result: PriceResult; expiresAt: number };
const priceCache = new Map<string, CacheEntry>();

function getCached(symbol: string): PriceResult | null {
  const entry = priceCache.get(symbol);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    priceCache.delete(symbol);
    return null;
  }
  return entry.result;
}

function setCached(symbol: string, result: PriceResult) {
  priceCache.set(symbol, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Invalidate cache for specific symbols or all */
export function invalidatePriceCache(symbols?: string[]) {
  if (!symbols) {
    priceCache.clear();
    return;
  }
  symbols.forEach((s) => priceCache.delete(s.toUpperCase()));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getWorkerUrl(): string {
  const url = import.meta.env.VITE_LIVE_PRICE_WORKER_URL as string | undefined;
  if (!url)
    throw new Error(
      'VITE_LIVE_PRICE_WORKER_URL is not set.\n' +
        'Deploy cloudflare-worker/worker.js and add VITE_LIVE_PRICE_WORKER_URL to .env',
    );
  return url.replace(/\/$/, '');
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    chunks.push(arr.slice(i, i + size));
  return chunks;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchBatch(
  workerUrl: string,
  symbols: string[],
): Promise<Record<string, PriceResult>> {
  const url = `${workerUrl}?symbols=${symbols.join(',')}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Worker ${res.status}: ${body}`);
  }
  const data = (await res.json()) as LivePriceResponse;
  return data.prices ?? {};
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function fetchLivePrices(
  symbols: string[],
  onProgress?: FetchProgressCallback,
): Promise<LivePriceResponse> {
  const clean = [
    ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];
  if (clean.length === 0)
    return { prices: {}, fetchedAt: new Date().toISOString(), count: 0 };

  const mergedPrices: Record<string, PriceResult> = {};
  const needsFetch: string[] = [];

  // Serve from cache where possible
  for (const sym of clean) {
    const cached = getCached(sym);
    if (cached) mergedPrices[sym] = cached;
    else needsFetch.push(sym);
  }

  if (needsFetch.length > 0) {
    const workerUrl = getWorkerUrl();
    const chunks = chunkArray(needsFetch, CHUNK_SIZE);
    const groups = chunkArray(chunks, MAX_CONCURRENCY);
    let fetchedCount = Object.keys(mergedPrices).length;

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const groupResults = await Promise.allSettled(
        group.map((chunk) => fetchBatch(workerUrl, chunk)),
      );

      groupResults.forEach((result, i) => {
        const chunk = group[i];
        if (result.status === 'fulfilled') {
          for (const [sym, r] of Object.entries(result.value)) {
            mergedPrices[sym] = r;
            setCached(sym, r);
          }
        } else {
          console.error(
            `[livePriceService] Chunk failed (${chunk.join(',')}):`,
            result.reason,
          );
          for (const sym of chunk) {
            mergedPrices[sym] = { price: null, source: 'none' };
          }
        }
        fetchedCount += chunk.length;
        onProgress?.(Math.min(fetchedCount, clean.length), clean.length);
      });

      if (gi < groups.length - 1) await sleep(GROUP_DELAY_MS);
    }
  } else {
    // All served from cache — report complete immediately
    onProgress?.(clean.length, clean.length);
  }

  const found = Object.values(mergedPrices).filter(
    (r) => r.price !== null,
  ).length;
  const missed = clean.length - found;

  // Single summary log (not per-symbol — that was expensive in production)
  console.log(
    `[livePriceService] ${found} updated, ${missed} not found, ${clean.length - needsFetch.length} from cache`,
  );

  // Per-symbol detail only in dev
  if (import.meta.env.DEV) {
    for (const [sym, result] of Object.entries(mergedPrices)) {
      if (result.price !== null) {
        const isMF = sym.startsWith('MF:');
        const isUS = result.type === 'us_stock' || sym.startsWith('US:');
        if (isMF)
          console.log(
            `%c[LivePrice] ${sym} → NAV ₹${result.price} (${result.source})`,
            'color:#a78bfa;font-weight:bold;',
          );
        else if (isUS)
          console.log(
            `%c[LivePrice] US: ${sym} → $${result.price} (${result.source})`,
            'color:#3b82f6;font-weight:bold;',
          );
        else
          console.log(
            `%c[LivePrice] ${sym} → ₹${result.price} (${result.source})`,
            'color:#10b981;font-weight:bold;',
          );
      } else {
        console.warn(`%c[LivePrice] ${sym} → not found`, 'color:#f87171;');
      }
    }
  }

  return {
    prices: mergedPrices,
    fetchedAt: new Date().toISOString(),
    count: clean.length,
  };
}

export async function fetchLivePrice(symbol: string): Promise<number | null> {
  const resp = await fetchLivePrices([symbol.toUpperCase()]);
  return resp.prices[symbol.toUpperCase()]?.price ?? null;
}
