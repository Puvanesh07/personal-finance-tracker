// Cloudflare Worker: Universal Price Proxy
// Deploy at: https://workers.cloudflare.com (FREE — no card needed)
//
// Supported symbol formats:
//   NSE Stocks/ETFs  : WIPRO, TCS, NIFTYBEES
//   Mutual Funds     : MF:119551  (AMFI scheme code)
//   US Stocks        : US:AAPL, US:TSLA, US:GOOGL
//   Gold             : GOLD  (via GOLDBEES ETF)
//   Silver           : SILVER (via SILVERBEES ETF)
//
// Extra routes:
//   GET /amfi        → proxies AMFI NAVAll.txt (avoids CORS for browser)
//   GET /health      → health check

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
};

// ─── AMFI NAV List Proxy ──────────────────────────────────────────────────────
async function handleAmfiList() {
  try {
    const res = await fetch('https://www.amfiindia.com/spages/NAVAll.txt', {
      headers: { 'User-Agent': UA, Accept: 'text/plain' },
      cf: { cacheEverything: true, cacheTtl: 21600 }, // cache 6h at CF edge
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `AMFI upstream error: ${res.status}` }),
        {
          status: 502,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
        },
      );
    }
    const text = await res.text();
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=21600', // browser caches 6h too
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `AMFI fetch failed: ${String(e)}` }),
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      },
    );
  }
}

// ─── NSE Cookie ───────────────────────────────────────────────────────────────
async function getNseCookie() {
  try {
    const res = await fetch('https://www.nseindia.com', {
      headers: {
        'User-Agent': UA,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
      },
    });
    const raw = res.headers.get('set-cookie') ?? '';
    return raw
      .split(/,(?=[^ ])/)
      .map((c) => c.split(';')[0].trim())
      .join('; ');
  } catch {
    return '';
  }
}

// ─── NSE Quote (tries 3 sub-endpoints) ───────────────────────────────────────
async function nseQuote(symbol, cookie) {
  if (!cookie) return null;

  const headers = {
    'User-Agent': UA,
    Accept: 'application/json',
    Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`,
    'X-Requested-With': 'XMLHttpRequest',
    Cookie: cookie,
  };

  // Try 1: standard equity endpoint
  try {
    const res = await fetch(
      `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`,
      { headers },
    );
    if (res.ok) {
      const d = await res.json();
      const price = d?.priceInfo?.lastPrice ?? d?.priceInfo?.close ?? null;
      if (price && price > 0) return Number(price);
    }
  } catch {
    /* try next */
  }

  // Try 2: with series=EQ (some stocks need this)
  try {
    const res = await fetch(
      `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}&series=EQ`,
      { headers },
    );
    if (res.ok) {
      const d = await res.json();
      const price = d?.priceInfo?.lastPrice ?? d?.priceInfo?.close ?? null;
      if (price && price > 0) return Number(price);
    }
  } catch {
    /* try next */
  }

  // Try 3: ETF / SME identifier
  try {
    const res = await fetch(
      `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}&identifier=EQUITIES`,
      { headers },
    );
    if (res.ok) {
      const d = await res.json();
      const price = d?.priceInfo?.lastPrice ?? d?.priceInfo?.close ?? null;
      if (price && price > 0) return Number(price);
    }
  } catch {
    /* try next */
  }

  return null;
}

// ─── NSE Autocomplete Search (fixes symbol mismatches) ───────────────────────
// e.g. MOTHERSONWIRING stored in DB but NSE uses MOTHERSON
async function nseSearchPrice(symbol, cookie) {
  if (!cookie) return null;
  try {
    const res = await fetch(
      `https://www.nseindia.com/api/search/autocomplete?q=${encodeURIComponent(symbol)}`,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
          Referer: 'https://www.nseindia.com/',
          Cookie: cookie,
        },
      },
    );
    if (!res.ok) return null;
    const d = await res.json();
    const hits = d?.symbols ?? [];
    const match =
      hits.find((h) => h.symbol?.toUpperCase() === symbol.toUpperCase()) ??
      hits.find((h) => h.symbol?.toUpperCase().includes(symbol.toUpperCase()));
    if (!match?.symbol) return null;
    if (match.symbol.toUpperCase() === symbol.toUpperCase()) return null; // avoid infinite retry
    return await nseQuote(match.symbol, cookie);
  } catch {
    return null;
  }
}

// ─── TickerTape (NSE + BSE tried) ────────────────────────────────────────────
async function tickertapePrice(symbol) {
  for (const exchange of ['NSE', 'BSE']) {
    try {
      const res = await fetch(
        `https://api.tickertape.in/stocks/quotes?tickers=${exchange}:${encodeURIComponent(symbol)}`,
        {
          headers: {
            'User-Agent': UA,
            Accept: 'application/json',
            Origin: 'https://www.tickertape.in',
            Referer: 'https://www.tickertape.in/',
          },
        },
      );
      if (!res.ok) continue;
      const d = await res.json();
      const item = d?.data?.[0];
      const price = item?.price ?? item?.lp ?? item?.close ?? null;
      if (price && price > 0) return Number(price);
    } catch {
      /* try next */
    }
  }
  return null;
}

// ─── Yahoo Finance (.NS suffix for NSE stocks) ────────────────────────────────
async function yahooNsePrice(symbol) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
          Referer: 'https://finance.yahoo.com/',
        },
      },
    );
    if (!res.ok) return null;
    const d = await res.json();
    const price =
      d?.chart?.result?.[0]?.meta?.regularMarketPrice ??
      d?.chart?.result?.[0]?.meta?.previousClose ??
      null;
    return price && price > 0 ? Number(price) : null;
  } catch {
    return null;
  }
}

// ─── Screener.in (HTML scrape — last resort for NSE stocks) ──────────────────
async function screenerPrice(symbol) {
  const urls = [
    `https://www.screener.in/company/${encodeURIComponent(symbol)}/consolidated/`,
    `https://www.screener.in/company/${encodeURIComponent(symbol)}/`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html',
          'Accept-Language': 'en-IN,en;q=0.9',
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const patterns = [
        /id="top-ratios"[\s\S]*?Current Price[\s\S]*?<span[^>]*>\s*([\d,]+\.?\d*)/i,
        /Current Price[\s\S]{0,400}?<span[^>]*>\s*[\u20B9Rs.]*\s*([\d,]+\.?\d*)/i,
        /"currentPrice"\s*:\s*([\d.]+)/i,
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          const p = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(p) && p > 1) return p;
        }
      }
    } catch {
      /* next */
    }
  }
  return null;
}

// ─── Mutual Funds (mfapi.in) ──────────────────────────────────────────────────
async function mutualFundNav(schemeCode) {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const nav = d?.data?.[0]?.nav;
    if (!nav) return null;
    const price = parseFloat(nav);
    return !isNaN(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function mutualFundSearch(name) {
  try {
    const res = await fetch(
      `https://api.mfapi.in/mf/search?q=${encodeURIComponent(name)}`,
      { headers: { 'User-Agent': UA } },
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (!d?.length) return null;
    const schemeCode = d[0]?.schemeCode;
    if (!schemeCode) return null;
    return await mutualFundNav(schemeCode);
  } catch {
    return null;
  }
}

// ─── US Stocks (Yahoo Finance) ────────────────────────────────────────────────
async function usStockPrice(ticker) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
          Referer: 'https://finance.yahoo.com/',
        },
      },
    );
    if (!res.ok) return null;
    const d = await res.json();
    const price =
      d?.chart?.result?.[0]?.meta?.regularMarketPrice ??
      d?.chart?.result?.[0]?.meta?.previousClose ??
      null;
    return price && price > 0 ? Number(price) : null;
  } catch {
    return null;
  }
}

// ─── Gold & Silver (via NSE ETFs) ─────────────────────────────────────────────
const COMMODITY_MAP = {
  GOLD: 'GOLDBEES',
  SILVER: 'SILVERBEES',
  SGOLD: 'SGOLD',
  SSILVER: 'SILVERETF',
};

// ─── Route each symbol to the correct fetcher ─────────────────────────────────
async function fetchSymbolPrice(rawSymbol, nseCookie) {
  const symbol = rawSymbol.trim().toUpperCase();

  // ── Mutual Fund: MF:119551 or MF:Fund Name ───────────────────────────────
  if (symbol.startsWith('MF:')) {
    const code = symbol.slice(3).trim();
    if (/^\d+$/.test(code)) {
      const price = await mutualFundNav(code);
      if (price !== null)
        return { price, source: 'mfapi', type: 'mutual_fund' };
    } else {
      const price = await mutualFundSearch(code);
      if (price !== null)
        return { price, source: 'mfapi', type: 'mutual_fund' };
    }
    return { price: null, source: 'none', type: 'mutual_fund' };
  }

  // ── US Stock: US:AAPL ────────────────────────────────────────────────────
  if (symbol.startsWith('US:')) {
    const ticker = symbol.slice(3).trim();
    const price = await usStockPrice(ticker);
    if (price !== null) return { price, source: 'yahoo', type: 'us_stock' };
    return { price: null, source: 'none', type: 'us_stock' };
  }

  // ── Gold / Silver shorthand ───────────────────────────────────────────────
  if (COMMODITY_MAP[symbol]) {
    const etf = COMMODITY_MAP[symbol];
    const nse = await nseQuote(etf, nseCookie);
    if (nse !== null) return { price: nse, source: 'nse', type: 'commodity' };
    const tt = await tickertapePrice(etf);
    if (tt !== null)
      return { price: tt, source: 'tickertape', type: 'commodity' };
    return { price: null, source: 'none', type: 'commodity' };
  }

  // ── NSE Stock / ETF — 5-level fallback cascade ────────────────────────────
  // 1. NSE direct (3 endpoints tried inside nseQuote)
  const nse = await nseQuote(symbol, nseCookie);
  if (nse !== null) return { price: nse, source: 'nse', type: 'stock' };

  // 2. NSE autocomplete search (symbol name mismatch fix)
  const nseSearch = await nseSearchPrice(symbol, nseCookie);
  if (nseSearch !== null)
    return { price: nseSearch, source: 'nse', type: 'stock' };

  // 3. Yahoo Finance .NS
  const yahoo = await yahooNsePrice(symbol);
  if (yahoo !== null) return { price: yahoo, source: 'yahoo', type: 'stock' };

  // 4. TickerTape (NSE + BSE)
  const tt = await tickertapePrice(symbol);
  if (tt !== null) return { price: tt, source: 'tickertape', type: 'stock' };

  // 5. Screener.in HTML scrape (last resort)
  const sc = await screenerPrice(symbol);
  if (sc !== null) return { price: sc, source: 'screener', type: 'stock' };

  return { price: null, source: 'none', type: 'stock' };
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ── Health check ──────────────────────────────────────────────────────────
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', ts: new Date().toISOString() }),
        { status: 200, headers: CORS_HEADERS },
      );
    }

    // ── AMFI proxy ────────────────────────────────────────────────────────────
    if (url.pathname === '/amfi') {
      return handleAmfiList();
    }

    // ── Live price lookup ─────────────────────────────────────────────────────
    const symbolsRaw = (
      url.searchParams.get('symbols') ??
      url.searchParams.get('symbol') ??
      ''
    ).trim();

    if (!symbolsRaw) {
      return new Response(
        JSON.stringify({
          error: 'Provide ?symbols=WIPRO,MF:119551,US:AAPL,GOLD',
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // No hard limit — process ALL symbols sent
    const symbols = symbolsRaw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    // Only fetch NSE cookie if any NSE symbols present
    const needsNse = symbols.some(
      (s) => !s.startsWith('MF:') && !s.startsWith('US:'),
    );
    const nseCookie = needsNse ? await getNseCookie() : '';

    // Fetch all in parallel
    const results = await Promise.allSettled(
      symbols.map((sym) => fetchSymbolPrice(sym, nseCookie)),
    );

    const prices = {};
    results.forEach((result, idx) => {
      prices[symbols[idx]] =
        result.status === 'fulfilled'
          ? result.value
          : { price: null, source: 'none', type: 'unknown' };
    });

    return new Response(
      JSON.stringify({
        prices,
        fetchedAt: new Date().toISOString(),
        count: symbols.length,
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  },
};
