// src/services/livePriceService.ts
// Calls a Cloudflare Worker as a server-side proxy (FREE, no card needed).
//
// HOW it works:
//   Browser → Cloudflare Worker → NSE / TickerTape / Screener
//
// Setup: See cloudflare-worker/worker.js — deploy once at workers.cloudflare.com
// Then set VITE_LIVE_PRICE_WORKER_URL in your .env to your worker URL.

export type PriceSource = 'nse' | 'tickertape' | 'screener' | 'none';

export type PriceResult = {
  price: number | null;
  source: PriceSource;
};

export type LivePriceResponse = {
  prices: Record<string, PriceResult>;
  fetchedAt: string;
  count: number;
};

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

export async function fetchLivePrices(
  symbols: string[],
): Promise<LivePriceResponse> {
  const clean = [
    ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];

  if (clean.length === 0) {
    return { prices: {}, fetchedAt: new Date().toISOString(), count: 0 };
  }

  const workerUrl = getWorkerUrl();
  const url = `${workerUrl}?symbols=${clean.join(',')}`;

  console.log(
    `[livePriceService] Fetching ${clean.length} symbols via Cloudflare Worker`,
  );

  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Worker returned ${res.status}: ${body}`);
  }

  const data = (await res.json()) as LivePriceResponse;

  for (const [sym, result] of Object.entries(data.prices)) {
    if (result.price !== null) {
      console.log(
        `[livePriceService] ${sym} → ₹${result.price} (${result.source})`,
      );
    } else {
      console.warn(`[livePriceService] ${sym} → price not found`);
    }
  }

  return data;
}

export async function fetchLivePrice(symbol: string): Promise<number | null> {
  const resp = await fetchLivePrices([symbol.toUpperCase()]);
  return resp.prices[symbol.toUpperCase()]?.price ?? null;
}
