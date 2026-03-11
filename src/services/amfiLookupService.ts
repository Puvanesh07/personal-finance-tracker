// src/services/amfiLookupService.ts
//
// Fetches the AMFI master fund list via your Cloudflare Worker proxy (avoids CORS).
// Cached in memory for the session (fetched once per page load).
//
// Worker endpoint: GET https://your-worker.workers.dev/amfi
// Returns raw NAVAll.txt content from amfiindia.com
//
// Line format:
//   SchemeCode;ISIN1;ISIN2;SchemeName;NAV;Date
//   119551;INF179K01VY9;INF179K01VZ6;HDFC Small Cap Fund - Direct Plan - Growth Option;104.234;11-Jul-2025

export type AmfiEntry = {
  schemeCode: string;
  schemeName: string;
};

// Module-level cache — shared across all callers in the session
let _cache: AmfiEntry[] | null = null;
let _fetchPromise: Promise<AmfiEntry[]> | null = null;

function getWorkerUrl(): string {
  const url = import.meta.env.VITE_LIVE_PRICE_WORKER_URL as string | undefined;
  if (!url) {
    throw new Error('VITE_LIVE_PRICE_WORKER_URL is not set in your .env file.');
  }
  return url.replace(/\/$/, '');
}

export async function loadAmfiList(): Promise<AmfiEntry[]> {
  if (_cache) return _cache;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    const workerUrl = getWorkerUrl();
    const url = `${workerUrl}/amfi`;

    console.log('[amfiLookup] Fetching AMFI list via worker proxy…');

    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`AMFI proxy fetch failed: ${res.status}`);

    const text = await res.text();
    const entries: AmfiEntry[] = [];

    for (const line of text.split('\n')) {
      const parts = line.split(';');
      if (parts.length >= 4) {
        const schemeCode = parts[0].trim();
        const schemeName = parts[3].trim();
        if (/^\d{5,6}$/.test(schemeCode) && schemeName) {
          entries.push({ schemeCode, schemeName });
        }
      }
    }

    _cache = entries;
    console.log(`[amfiLookup] Loaded ${entries.length} schemes`);
    return entries;
  })();

  return _fetchPromise;
}

/** Normalise a fund name for fuzzy matching — strips common filler words */
function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(
      /\b(direct|regular|growth|idcw|dividend|payout|reinvestment|plan|option|fund)\b/g,
      '',
    )
    .trim();
}

/**
 * Resolve a mutual fund name → AMFI scheme code.
 * Prefers Direct-Growth variants.
 * Returns null if no reasonable match found (score < 60% word overlap).
 */
export async function resolveAmfiCode(
  fundName: string,
): Promise<string | null> {
  if (!fundName) return null;

  // Already a numeric scheme code — return as-is
  if (/^\d{5,6}$/.test(fundName.trim())) return fundName.trim();

  let entries: AmfiEntry[];
  try {
    entries = await loadAmfiList();
  } catch (e) {
    console.error('[amfiLookup] Failed to load AMFI list', e);
    return null;
  }

  const needle = normalise(fundName);
  const needleWords = needle.split(' ').filter(Boolean);
  if (needleWords.length === 0) return null;

  type ScoredEntry = AmfiEntry & { score: number };
  const scored: ScoredEntry[] = [];

  for (const entry of entries) {
    const haystack = normalise(entry.schemeName);
    const matchCount = needleWords.filter((w) => haystack.includes(w)).length;
    if (matchCount === 0) continue;

    const ratio = matchCount / needleWords.length;
    if (ratio < 0.6) continue;

    const nameLC = entry.schemeName.toLowerCase();
    let bonus = 0;
    if (nameLC.includes('direct')) bonus += 0.2;
    if (nameLC.includes('growth') && !nameLC.includes('idcw')) bonus += 0.1;

    scored.push({ ...entry, score: ratio + bonus });
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.schemeName.length - b.schemeName.length;
  });

  const best = scored[0];
  console.log(
    `[amfiLookup] "${fundName}" → "${best.schemeName}" (${best.schemeCode}) score=${best.score.toFixed(2)}`,
  );
  return best.schemeCode;
}

/** Bulk resolve: returns map of fundName → schemeCode (or null) */
export async function resolveAmfiCodes(
  fundNames: string[],
): Promise<Record<string, string | null>> {
  await loadAmfiList().catch(() => {});

  const result: Record<string, string | null> = {};
  await Promise.all(
    fundNames.map(async (name) => {
      result[name] = await resolveAmfiCode(name);
    }),
  );
  return result;
}
