// src/services/isinService.ts
//
// Dynamically resolves ISIN → NSE symbol via the Cloudflare Worker.
// Replaces the manual ISIN_TO_SYMBOL map in nseStockdata.ts entirely.
//
// Why dynamic beats manual:
//   ✅ Handles broker data errors (e.g. Angel One printing wrong ISINs)
//   ✅ Automatically picks up new listings, renames, mergers
//   ✅ Zero maintenance — no need to update a 3000-line file
//   ✅ 3-source fallback: NSE search → NSE quote → OpenFIGI
//
// Cache strategy:
//   - In-memory cache (survives the session, ~instant on second import)
//   - localStorage cache (survives page reload, TTL = 30 days)
//   - ISINs are permanent identifiers — safe to cache long-term

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const STORAGE_KEY = 'isin_symbol_cache';
const BATCH_SIZE = 20; // max ISINs per worker request

function getWorkerUrl(): string {
  const url = import.meta.env.VITE_LIVE_PRICE_WORKER_URL as string | undefined;
  if (!url) throw new Error('VITE_LIVE_PRICE_WORKER_URL not set');
  return url.replace(/\/$/, '');
}

// ── Persistent cache (localStorage) ──────────────────────────────────────────

type CacheEntry = { symbol: string | null; source: string; savedAt: number };
type CacheStore = Record<string, CacheEntry>;

function loadCache(): CacheStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheStore;
  } catch {
    return {};
  }
}

function saveCache(store: CacheStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota — silent */
  }
}

// In-memory layer on top of localStorage (fastest)
let _mem: CacheStore | null = null;

function getCache(): CacheStore {
  if (!_mem) _mem = loadCache();
  return _mem;
}

function setCached(isin: string, symbol: string | null, source: string) {
  const cache = getCache();
  cache[isin] = { symbol, source, savedAt: Date.now() };
  saveCache(cache);
}

function getCached(isin: string): string | null | undefined {
  const cache = getCache();
  const entry = cache[isin];
  if (!entry) return undefined; // not in cache
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
    delete cache[isin]; // expired
    return undefined;
  }
  return entry.symbol; // may be null if previously unresolvable
}

// ── Worker API call ───────────────────────────────────────────────────────────

async function fetchFromWorker(
  isins: string[],
): Promise<Record<string, { symbol: string | null; source: string }>> {
  const url = `${getWorkerUrl()}/isin?codes=${isins.join(',')}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`ISIN worker ${res.status}`);
  const data = await res.json();
  return data.resolved ?? {};
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve a single ISIN to NSE symbol.
 * Returns null if unresolvable (e.g. delisted, wrong ISIN).
 */
export async function resolveIsin(isin: string): Promise<string | null> {
  if (!isin) return null;
  const upper = isin.trim().toUpperCase();

  const cached = getCached(upper);
  if (cached !== undefined) return cached;

  const result = await fetchFromWorker([upper]);
  const sym = result[upper]?.symbol ?? null;
  setCached(upper, sym, result[upper]?.source ?? 'none');
  return sym;
}

/**
 * Resolve multiple ISINs in bulk (batched, parallel).
 * Returns a map of { ISIN → symbol | null }
 *
 * @param isins - array of ISIN strings
 * @param onProgress - optional callback (resolved, total)
 */
export async function resolveIsins(
  isins: string[],
  onProgress?: (resolved: number, total: number) => void,
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};

  // Deduplicate
  const unique = [
    ...new Set(isins.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];

  // Separate cached vs uncached
  const toFetch: string[] = [];
  for (const isin of unique) {
    const cached = getCached(isin);
    if (cached !== undefined) {
      result[isin] = cached;
    } else {
      toFetch.push(isin);
    }
  }

  if (toFetch.length === 0) {
    onProgress?.(unique.length, unique.length);
    return result;
  }

  console.log(
    `[isinService] Resolving ${toFetch.length} ISINs via worker (${unique.length - toFetch.length} from cache)`,
  );

  // Batch into groups of BATCH_SIZE
  const batches: string[][] = [];
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    batches.push(toFetch.slice(i, i + BATCH_SIZE));
  }

  let resolvedCount = unique.length - toFetch.length;

  for (const batch of batches) {
    try {
      const batchResult = await fetchFromWorker(batch);
      for (const isin of batch) {
        const sym = batchResult[isin]?.symbol ?? null;
        result[isin] = sym;
        setCached(isin, sym, batchResult[isin]?.source ?? 'none');
      }
    } catch (e) {
      console.warn(`[isinService] Batch failed:`, e);
      for (const isin of batch) {
        result[isin] = null;
      }
    }
    resolvedCount += batch.length;
    onProgress?.(resolvedCount, unique.length);
  }

  // Log summary
  const found = Object.values(result).filter(Boolean).length;
  console.log(`[isinService] Done — ${found}/${unique.length} resolved`);

  // Per-symbol log in dev
  if (import.meta.env.DEV) {
    for (const [isin, sym] of Object.entries(result)) {
      if (sym) console.log(`  ✓ ${isin} → ${sym}`);
      else console.warn(`  ✗ ${isin} → unresolvable`);
    }
  }

  return result;
}

/**
 * Clear the local ISIN cache (useful for debugging or after broker errors).
 */
export function clearIsinCache() {
  _mem = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* silent */
  }
  console.log('[isinService] Cache cleared');
}
