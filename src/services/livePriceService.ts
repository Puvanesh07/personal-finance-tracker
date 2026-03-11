// src/services/livePriceService.ts
//
// Handles any number of symbols (tested up to 1000+).
//
// Strategy for large portfolios:
//   - Split into chunks of 20 symbols each
//   - Run at most 3 chunks concurrently (avoids CF rate limits)
//   - 300ms delay between concurrent groups
//   - Reports progress via optional callback so UI can show "Fetching 1-20 of 1000..."
//
// Cloudflare free tier: 100k req/day, 10ms CPU/req
// With 1000 symbols: 50 chunks × 3 concurrent = ~17 groups → done in ~6 seconds

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
};

export type LivePriceResponse = {
  prices: Record<string, PriceResult>;
  fetchedAt: string;
  count: number;
};

export type FetchProgressCallback = (fetched: number, total: number) => void;

// ── Tunables ──────────────────────────────────────────────────────────────────
// Symbols per worker request — keep ≤ 20 to stay under CF 10ms CPU limit
const CHUNK_SIZE = 20;

// Max concurrent requests at once — 3 is safe for CF free tier
const MAX_CONCURRENCY = 3;

// Delay between launching each concurrency group (ms)
const GROUP_DELAY_MS = 300;

// ─────────────────────────────────────────────────────────────────────────────

function getWorkerUrl(): string {
  const url = import.meta.env.VITE_LIVE_PRICE_WORKER_URL as string | undefined;
  if (!url) {
    throw new Error(
      'VITE_LIVE_PRICE_WORKER_URL is not set in your .env file.\n' +
        'Deploy cloudflare-worker/worker.js at workers.cloudflare.com\n' +
        'Then add: VITE_LIVE_PRICE_WORKER_URL=https://your-worker.your-name.workers.dev',
    );
  }
  return url.replace(/\/$/, '');
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch one chunk of symbols from the worker */
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

/**
 * Fetch live prices for ANY number of symbols.
 *
 * @param symbols   - Array of symbol strings (WIPRO, MF:119551, US:AAPL, GOLD…)
 * @param onProgress - Optional callback: (fetchedSoFar, total) → void
 *                     Use this to show a progress bar / counter in the UI.
 */
export async function fetchLivePrices(
  symbols: string[],
  onProgress?: FetchProgressCallback,
): Promise<LivePriceResponse> {
  // Deduplicate + clean
  const clean = [
    ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];

  if (clean.length === 0) {
    return { prices: {}, fetchedAt: new Date().toISOString(), count: 0 };
  }

  const workerUrl = getWorkerUrl();
  const chunks = chunkArray(clean, CHUNK_SIZE);
  const totalChunks = chunks.length;

  console.log(
    `[livePriceService] ${clean.length} symbols → ${totalChunks} chunk(s) of ${CHUNK_SIZE}, concurrency=${MAX_CONCURRENCY}`,
  );

  const mergedPrices: Record<string, PriceResult> = {};
  let fetchedCount = 0;

  // Process chunks in groups of MAX_CONCURRENCY
  const groups = chunkArray(chunks, MAX_CONCURRENCY);

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];

    // Fire this group in parallel
    const groupResults = await Promise.allSettled(
      group.map((chunk) => fetchBatch(workerUrl, chunk)),
    );

    // Merge results
    groupResults.forEach((result, i) => {
      const chunk = group[i];
      if (result.status === 'fulfilled') {
        Object.assign(mergedPrices, result.value);
      } else {
        console.error(
          `[livePriceService] Chunk failed (${chunk.join(',')}):`,
          result.reason,
        );
        // Mark failed symbols as null so they are not updated
        for (const sym of chunk) {
          mergedPrices[sym] = { price: null, source: 'none' };
        }
      }
      fetchedCount += chunk.length;
      onProgress?.(Math.min(fetchedCount, clean.length), clean.length);
    });

    // Delay between groups to avoid hammering CF (skip delay after last group)
    if (gi < groups.length - 1) {
      await sleep(GROUP_DELAY_MS);
    }
  }

  // Summary log
  const found = Object.values(mergedPrices).filter(
    (r) => r.price !== null,
  ).length;
  const missed = clean.length - found;
  console.log(
    `[livePriceService] Done — ${found} updated, ${missed} not found out of ${clean.length} total`,
  );

  // Detailed per-symbol log (only in dev to avoid console spam in prod)
  if (import.meta.env.DEV) {
    for (const [sym, result] of Object.entries(mergedPrices)) {
      if (result.price !== null) {
        console.log(`  ✓ ${sym} → ₹${result.price} (${result.source})`);
      } else {
        console.warn(`  ✗ ${sym} → not found`);
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
