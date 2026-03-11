// Cloudflare Worker: Live NSE Stock Price Proxy
// Deploy at: https://workers.cloudflare.com (FREE — no card needed)
//
// Price cascade per symbol:
//   1. NSE India API    — real-time LTP, most accurate
//   2. TickerTape API   — very accurate fallback
//   3. Screener.in      — HTML scrape fallback

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=60',
};

// ─── NSE India ────────────────────────────────────────────────────────────────
async function getNseCookie() {
  try {
    const res = await fetch('https://www.nseindia.com', {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html',
        'Accept-Language': 'en-IN,en;q=0.9',
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

async function nsePrice(symbol, cookie) {
  if (!cookie) return null;
  try {
    const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        Referer: 'https://www.nseindia.com/',
        Cookie: cookie,
      },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const price = d?.priceInfo?.lastPrice ?? d?.priceInfo?.close ?? null;
    return price && price > 0 ? Number(price) : null;
  } catch {
    return null;
  }
}

// ─── TickerTape ───────────────────────────────────────────────────────────────
async function tickertapePrice(symbol) {
  try {
    const url = `https://api.tickertape.in/stocks/quotes?tickers=NSE:${encodeURIComponent(symbol)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        Origin: 'https://www.tickertape.in',
        Referer: 'https://www.tickertape.in/',
      },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const item = d?.data?.[0];
    const price = item?.price ?? item?.lp ?? item?.close ?? null;
    return price && price > 0 ? Number(price) : null;
  } catch {
    return null;
  }
}

// ─── Screener.in ──────────────────────────────────────────────────────────────
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

// ─── Fetch one symbol ─────────────────────────────────────────────────────────
async function fetchSymbolPrice(symbol, nseCookie) {
  const nse = await nsePrice(symbol, nseCookie);
  if (nse !== null) return { price: nse, source: 'nse' };

  const tt = await tickertapePrice(symbol);
  if (tt !== null) return { price: tt, source: 'tickertape' };

  const sc = await screenerPrice(symbol);
  if (sc !== null) return { price: sc, source: 'screener' };

  return { price: null, source: 'none' };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const symbolsRaw = (
      url.searchParams.get('symbols') ??
      url.searchParams.get('symbol') ??
      ''
    )
      .trim()
      .toUpperCase();

    if (!symbolsRaw) {
      return new Response(
        JSON.stringify({ error: 'Provide ?symbols=WIPRO,TCS,INFY' }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const symbols = symbolsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 25);

    // Get NSE cookie once
    const nseCookie = await getNseCookie();

    // Fetch all symbols in parallel
    const results = await Promise.allSettled(
      symbols.map((sym) => fetchSymbolPrice(sym, nseCookie)),
    );

    const prices = {};
    results.forEach((result, idx) => {
      prices[symbols[idx]] =
        result.status === 'fulfilled'
          ? result.value
          : { price: null, source: 'none' };
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
