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
      cf: { cacheEverything: true, cacheTtl: 21600 },
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
        'Cache-Control': 'public, max-age=21600',
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

  // Try 2: with series=EQ
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
    if (match.symbol.toUpperCase() === symbol.toUpperCase()) return null;
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

// ─── Mutual Funds (AMFI NAVAll.txt — replaces mfapi.in) ──────────────────────
// In-memory cache for the duration of the worker instance
let amfiCache = null;
let amfiCacheTime = 0;
const AMFI_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms

async function getAmfiData() {
  const now = Date.now();
  if (amfiCache && now - amfiCacheTime < AMFI_CACHE_TTL) {
    return amfiCache;
  }
  try {
    const res = await fetch('https://www.amfiindia.com/spages/NAVAll.txt', {
      headers: { 'User-Agent': UA, Accept: 'text/plain' },
    });
    if (!res.ok) return null;
    amfiCache = await res.text();
    amfiCacheTime = now;
    return amfiCache;
  } catch {
    return null;
  }
}

async function mutualFundNav(schemeCode) {
  try {
    const text = await getAmfiData();
    if (!text) return null;
    const lines = text.split('\n');
    for (const line of lines) {
      const parts = line.split(';');
      if (parts[0]?.trim() === String(schemeCode)) {
        const nav = parseFloat(parts[4]?.trim());
        return !isNaN(nav) && nav > 0 ? nav : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function mutualFundSearch(name) {
  try {
    const text = await getAmfiData();
    if (!text) return null;
    const nameLower = name.toLowerCase();
    const lines = text.split('\n');
    for (const line of lines) {
      const parts = line.split(';');
      if (parts.length < 5) continue;
      const schemeName = parts[3]?.toLowerCase() ?? '';
      if (schemeName.includes(nameLower)) {
        const nav = parseFloat(parts[4]?.trim());
        if (!isNaN(nav) && nav > 0) return nav;
      }
    }
    return null;
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
      if (price !== null) return { price, source: 'amfi', type: 'mutual_fund' };
    } else {
      const price = await mutualFundSearch(code);
      if (price !== null) return { price, source: 'amfi', type: 'mutual_fund' };
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

  // 6. Global / US Stock Fallback (Fixes QQQ / AAPL without "US:" prefix)
  const globalPrice = await usStockPrice(symbol);
  if (globalPrice !== null) {
    return { price: globalPrice, source: 'yahoo', type: 'us_stock' };
  }

  return { price: null, source: 'none', type: 'stock' };
}

// ─── Fundamentals Scraper (Screener.in) ──────────────────────────────────────
// Confirmed against real Screener HTML (March 2026).
//
// Key structural facts confirmed via debug:
//   top-ratios : <span class="name">\n  LABEL\n</span> then <span class="number">VALUE</span>
//   P&L/BS/Qtrs: labels in <td> (may have <button>/<a> inside), values in <td class="">
//                percentage values like "23 %" need %? in regex
//   CAGR       : <th>Compounded Sales Growth</th> then <tr><td>3 Years:</td><td>10%</td></tr>
//   Shareholding: data is in <div id="quarterly-shp" class="active"> tab

// ── Top-ratios: iterate name spans, match trimmed text ────────────────────────
function extractTopRatio(html, label) {
  const OPEN = '<span class="name">';
  const CLOSE = '</span>';
  let pos = 0;
  while (pos < html.length) {
    const s = html.indexOf(OPEN, pos);
    if (s === -1) break;
    const e = html.indexOf(CLOSE, s);
    if (e === -1) break;
    if (html.slice(s + OPEN.length, e).trim() === label) {
      const after = html.slice(e, e + 500);
      const m = after.match(/<span class="number">([\d,]+\.?\d*)<\/span>/);
      if (m) return m[1].replace(/,/g, '');
      return null;
    }
    pos = s + 1;
  }
  return null;
}

function extractHighLow(html) {
  const OPEN = '<span class="name">';
  const CLOSE = '</span>';
  let pos = 0;
  while (pos < html.length) {
    const s = html.indexOf(OPEN, pos);
    if (s === -1) break;
    const e = html.indexOf(CLOSE, s);
    if (e === -1) break;
    if (html.slice(s + OPEN.length, e).trim() === 'High / Low') {
      const after = html.slice(e, e + 500);
      const nums = [...after.matchAll(/<span class="number">([\d,]+)<\/span>/g)]
        .map((m) => parseFloat(m[1].replace(/,/g, '')))
        .filter((n) => !isNaN(n) && n > 0);
      return { high: nums[0] || null, low: nums[1] || null };
    }
    pos = s + 1;
  }
  return { high: null, low: null };
}

function extractMarketCapCr(html) {
  const OPEN = '<span class="name">';
  const CLOSE = '</span>';
  let pos = 0;
  while (pos < html.length) {
    const s = html.indexOf(OPEN, pos);
    if (s === -1) break;
    const e = html.indexOf(CLOSE, s);
    if (e === -1) break;
    if (html.slice(s + OPEN.length, e).trim() === 'Market Cap') {
      const after = html.slice(e, e + 400);
      const m = after.match(/<span class="number">([\d,]+)<\/span>/);
      if (m) return parseFloat(m[1].replace(/,/g, ''));
      return null;
    }
    pos = s + 1;
  }
  return null;
}

// ── extractRow: find label, grab enclosing <tr>, pull numeric <td>s ───────────
// FIX: %? in regex handles "23 %" values (OPM %, shareholding percentages)
function extractRow(html, label) {
  const labelIdx = html.indexOf(label);
  if (labelIdx === -1) return [];
  const trStart = html.lastIndexOf('<tr', labelIdx);
  const trEnd = html.indexOf('</tr>', labelIdx);
  if (trStart === -1 || trEnd === -1) return [];
  const rowHtml = html.slice(trStart, trEnd);
  return [...rowHtml.matchAll(/<td[^>]*>\s*([+-]?[\d,]+\.?\d*)\s*%?\s*<\/td>/g)]
    .map((m) => {
      const n = parseFloat(m[1].replace(/,/g, ''));
      return isNaN(n) ? null : n;
    })
    .filter((n) => n !== null);
}

// Skip header section — jump to <table> within a section to avoid button labels
function toTable(sectionHtml) {
  const t = sectionHtml.indexOf('<table');
  return t !== -1 ? sectionHtml.slice(t) : sectionHtml;
}

// ── extractCAGR: heading text → period row → plain <td> value ─────────────────
function extractCAGR(html, heading, period) {
  const hIdx = html.indexOf(heading);
  if (hIdx === -1) return null;
  const chunk = html.slice(hIdx, hIdx + 700);
  const pIdx = chunk.indexOf(period);
  if (pIdx === -1) return null;
  const m = chunk
    .slice(pIdx, pIdx + 100)
    .match(/<td[^>]*>\s*([+-]?[\d.]+)\s*%?\s*<\/td>/);
  return m ? parseFloat(m[1]) : null;
}

// ── Section parsers ───────────────────────────────────────────────────────────

function parseTopRatios(html) {
  const bookValueRaw =
    parseFloat(extractTopRatio(html, 'Book Value') || '') || null;
  const currentPrice =
    parseFloat(extractTopRatio(html, 'Current Price') || '') || null;
  return {
    pe: parseFloat(extractTopRatio(html, 'Stock P/E') || '') || null,
    roe: parseFloat(extractTopRatio(html, 'ROE') || '') || null,
    roce: parseFloat(extractTopRatio(html, 'ROCE') || '') || null,
    dividendYield:
      parseFloat(extractTopRatio(html, 'Dividend Yield') || '') || null,
    faceValue: parseFloat(extractTopRatio(html, 'Face Value') || '') || null,
    currentPrice,
    bookValue: bookValueRaw,
    pb:
      currentPrice && bookValueRaw && bookValueRaw > 0
        ? Math.round((currentPrice / bookValueRaw) * 100) / 100
        : null,
    marketCapCr: extractMarketCapCr(html),
    ...extractHighLow(html),
  };
}

function parsePL(html) {
  const secIdx = html.indexOf('id="profit-loss"');
  if (secIdx === -1) return {};
  const tbl = toTable(html.slice(secIdx, secIdx + 25000));

  const sales = extractRow(tbl, 'Sales');
  const np = extractRow(tbl, 'Net Profit');
  const opm = extractRow(tbl, 'OPM %');
  const ebit = extractRow(tbl, 'Operating Profit');
  const interest = extractRow(tbl, 'Interest');
  const divPay = extractRow(tbl, 'Dividend Payout %');
  const cashOps = extractRow(tbl, 'Cash from Operations');
  const eps = extractRow(tbl, 'EPS in Rs');

  const lat = (a) => (a.length >= 2 ? a[a.length - 2] : (a[0] ?? null));
  const pri = (a) => (a.length >= 3 ? a[a.length - 3] : (a[0] ?? null));

  const latSales = lat(sales),
    priSales = pri(sales);
  const latNP = lat(np),
    priNP = pri(np);
  const latEbit = lat(ebit),
    latInt = lat(interest);

  return {
    revenueGrowthYoY:
      latSales && priSales && priSales > 0
        ? Math.round(((latSales - priSales) / priSales) * 100)
        : null,
    earningsGrowthYoY:
      latNP != null && priNP != null && priNP !== 0
        ? Math.round(((latNP - priNP) / Math.abs(priNP)) * 100)
        : null,
    netMargin:
      latNP != null && latSales && latSales > 0
        ? Math.round((latNP / latSales) * 1000) / 10
        : null,
    operatingMargin: lat(opm),
    interestCoverage:
      latEbit && latInt && latInt > 0
        ? Math.round((latEbit / latInt) * 10) / 10
        : null,
    dividendPayoutRatio: lat(divPay),
    fcfPositive: cashOps.length > 0 ? (lat(cashOps) || 0) > 0 : undefined,
    latestEps: lat(eps),
    // Raw arrays for derived metrics in fetchFundamentals
    _latSales: latSales,
    _latNP: latNP,
    _latEbit: latEbit,
  };
}

function parseBS(html) {
  const secIdx = html.indexOf('id="balance-sheet"');
  if (secIdx === -1) return {};
  const tbl = toTable(html.slice(secIdx, secIdx + 20000));

  const borr = extractRow(tbl, 'Borrowings');
  const eq = extractRow(tbl, 'Equity Capital');
  const res = extractRow(tbl, 'Reserves');
  const totalAssets = extractRow(tbl, 'Total Assets');

  const b = borr.length > 0 ? borr[borr.length - 1] : null;
  const e = eq.length > 0 ? eq[eq.length - 1] : null;
  const r = res.length > 0 ? res[res.length - 1] : null;
  const ta =
    totalAssets.length > 0 ? totalAssets[totalAssets.length - 1] : null;

  let debtToEquity = null;
  if (b != null && e != null && r != null && e + r > 0) {
    debtToEquity = Math.round((b / (e + r)) * 100) / 100;
  }

  return { debtToEquity, totalAssets: ta, totalDebt: b };
}

// Current ratio lives in id="ratios" section — a separate section from balance sheet
function parseRatiosSection(html) {
  const secIdx = html.indexOf('id="ratios"');
  if (secIdx === -1) return { currentRatio: null };
  const tbl = toTable(html.slice(secIdx, secIdx + 8000));
  const crArr = extractRow(tbl, 'Current ratio');
  // Second-to-last = latest annual (skip TTM column)
  const lat = (a) => (a.length >= 2 ? a[a.length - 2] : (a[0] ?? null));
  return { currentRatio: lat(crArr) };
}

function parseCAGRSection(html) {
  return {
    salesCagr3yr: extractCAGR(html, 'Compounded Sales Growth', '3 Years:'),
    salesCagr5yr: extractCAGR(html, 'Compounded Sales Growth', '5 Years:'),
    profitCagr3yr: extractCAGR(html, 'Compounded Profit Growth', '3 Years:'),
    profitCagr5yr: extractCAGR(html, 'Compounded Profit Growth', '5 Years:'),
    stockCagr3yr: extractCAGR(html, 'Stock Price CAGR', '3 Years:'),
    stockCagr5yr: extractCAGR(html, 'Stock Price CAGR', '5 Years:'),
  };
}

function parseSH(html) {
  const secIdx = html.indexOf('id="shareholding"');
  if (secIdx === -1) return {};
  // Use large slice to capture all sub-sections
  const secHtml = html.slice(secIdx, secIdx + 28000);

  // Quarterly-shp div for main numbers
  let shHtml = secHtml;
  const qTabIdx = secHtml.indexOf('id="quarterly-shp"');
  if (qTabIdx !== -1) shHtml = secHtml.slice(qTabIdx, qTabIdx + 10000);
  const tbl = toTable(shHtml);

  const latest = (label) => {
    const a = extractRow(tbl, label);
    return a.length > 0 ? a[a.length - 1] : null;
  };

  const promoter = latest('Promoters');
  const fii = latest('FIIs');
  const dii = latest('DIIs');
  const institutional =
    fii != null || dii != null
      ? Math.round(((fii || 0) + (dii || 0)) * 100) / 100
      : null;

  // Pledged percentage: CRITICAL FIX
  // Search the ENTIRE section (not just quarterly-shp table)
  // because it's often in a sub-section outside the main table
  // 0.00 is a valid value (means no pledging) — NOT filtered out
  let promoterPledging = null;
  const pledgeRow = extractRow(secHtml, 'Pledged percentage');
  if (pledgeRow.length > 0) {
    promoterPledging = pledgeRow[pledgeRow.length - 1]; // 0 = no pledging, valid
  } else {
    const pledgeM =
      secHtml.match(/[Pp]ledged percentage[^\d<]{0,50}([\d.]+)/) ||
      secHtml.match(/Pledged[^<]{0,30}<[^>]+>\s*([\d.]+)/);
    if (pledgeM) promoterPledging = parseFloat(pledgeM[1]);
  }

  return {
    promoterHolding: promoter,
    institutionalHolding: institutional,
    promoterPledging,
    promoterPledgingOver50: (promoterPledging || 0) > 50,
  };
}

function parseQ(html) {
  const secIdx = html.indexOf('id="quarters"');
  if (secIdx === -1) return {};
  const tbl = toTable(html.slice(secIdx, secIdx + 18000));

  const sales = extractRow(tbl, 'Sales');
  const np = extractRow(tbl, 'Net Profit');
  const opm = extractRow(tbl, 'OPM %');

  // YoY quarterly: latest vs same quarter last year (5th from end)
  const yoySalesQ =
    sales.length >= 5
      ? Math.round(
          ((sales[sales.length - 1] - sales[sales.length - 5]) /
            sales[sales.length - 5]) *
            100,
        )
      : null;
  const yoyNPQ =
    np.length >= 5 && np[np.length - 5] !== 0
      ? Math.round(
          ((np[np.length - 1] - np[np.length - 5]) /
            Math.abs(np[np.length - 5])) *
            100,
        )
      : null;

  return {
    quarterlyRevenueGrowingYoY:
      sales.length >= 2 && sales[sales.length - 1] > sales[0],
    quarterlyProfitGrowingYoY:
      np.length >= 2 && np[np.length - 1] > np[0] && np[np.length - 1] > 0,
    netProfitNegativeAnyQuarter: np.some((n) => n < 0),
    ebitdaMarginExpanding: opm.length >= 2 && opm[opm.length - 1] >= opm[0],
    latestQuarterlySales: sales.length > 0 ? sales[sales.length - 1] : null,
    latestQuarterlyProfit: np.length > 0 ? np[np.length - 1] : null,
    yoySalesGrowthQ: yoySalesQ,
    yoyProfitGrowthQ: yoyNPQ,
  };
}

async function fetchFundamentals(symbol) {
  const urls = [
    `https://www.screener.in/company/${encodeURIComponent(symbol)}/consolidated/`,
    `https://www.screener.in/company/${encodeURIComponent(symbol)}/`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-IN,en;q=0.9',
          Referer: 'https://www.screener.in/',
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      if (!html.includes('top-ratios')) continue;

      const top = parseTopRatios(html);
      const pl = parsePL(html);
      const bs = parseBS(html);
      const ratios = parseRatiosSection(html);
      const cagr = parseCAGRSection(html);
      const sh = parseSH(html);
      const q = parseQ(html);

      let fiftyTwoWeekPosition = null;
      if (top.high && top.low && top.currentPrice && top.high > top.low)
        fiftyTwoWeekPosition = Math.round(
          ((top.currentPrice - top.low) / (top.high - top.low)) * 100,
        );

      let marketCapCategory = null;
      if (top.marketCapCr != null) {
        if (top.marketCapCr >= 20000) marketCapCategory = 'large';
        else if (top.marketCapCr >= 5000) marketCapCategory = 'mid';
        else if (top.marketCapCr >= 500) marketCapCategory = 'small';
        else marketCapCategory = 'micro';
      }

      const growthForPeg = cagr.profitCagr3yr || cagr.profitCagr5yr;
      const peg =
        top.pe && growthForPeg && growthForPeg > 0
          ? Math.round((top.pe / growthForPeg) * 100) / 100
          : null;

      // Derived: Return on Assets = Net Profit / Total Assets
      const roa =
        pl._latNP != null && bs.totalAssets && bs.totalAssets > 0
          ? Math.round((pl._latNP / bs.totalAssets) * 1000) / 10
          : null;

      // Derived: Price to Sales = Market Cap / Annual Sales (both in same unit)
      // marketCapCr is in Crores, _latSales is in Crores → same unit
      const priceToSales =
        top.marketCapCr && pl._latSales && pl._latSales > 0
          ? Math.round((top.marketCapCr / pl._latSales) * 100) / 100
          : null;

      // Derived: Earnings Yield = 1 / PE
      const earningsYield =
        top.pe && top.pe > 0 ? Math.round((100 / top.pe) * 100) / 100 : null;

      return {
        // Valuation
        pe: top.pe,
        peg,
        pb: top.pb,
        priceToSales,
        earningsYield,
        // Profitability
        roe: top.roe,
        roce: top.roce,
        roa,
        netMargin: pl.netMargin,
        operatingMargin: pl.operatingMargin,
        fcfPositive: pl.fcfPositive,
        eps: pl.latestEps,
        // Financial Health
        debtToEquity: bs.debtToEquity,
        currentRatio: ratios.currentRatio, // from id="ratios" section ← FIX
        interestCoverage: pl.interestCoverage,
        totalDebt: bs.totalDebt,
        // Growth
        revenueGrowthYoY: pl.revenueGrowthYoY,
        earningsGrowthYoY: pl.earningsGrowthYoY,
        salesCagr3yr: cagr.salesCagr3yr,
        salesCagr5yr: cagr.salesCagr5yr,
        profitCagr3yr: cagr.profitCagr3yr,
        profitCagr5yr: cagr.profitCagr5yr,
        stockCagr3yr: cagr.stockCagr3yr,
        stockCagr5yr: cagr.stockCagr5yr,
        // Holding
        promoterHolding: sh.promoterHolding,
        institutionalHolding: sh.institutionalHolding,
        promoterPledging: sh.promoterPledging, // ← FIX: now searches entire section
        // Dividends
        dividendYield: top.dividendYield,
        dividendPayoutRatio: pl.dividendPayoutRatio,
        // Market Context
        fiftyTwoWeekPosition,
        marketCapCategory,
        marketCapCr: top.marketCapCr,
        currentPrice: top.currentPrice,
        bookValue: top.bookValue,
        // Quarterly
        quarterlyRevenueGrowingYoY: q.quarterlyRevenueGrowingYoY,
        quarterlyProfitGrowingYoY: q.quarterlyProfitGrowingYoY,
        netProfitNegativeAnyQuarter: q.netProfitNegativeAnyQuarter,
        ebitdaMarginExpanding: q.ebitdaMarginExpanding,
        latestQuarterlySales: q.latestQuarterlySales,
        latestQuarterlyProfit: q.latestQuarterlyProfit,
        yoySalesGrowthQ: q.yoySalesGrowthQ,
        yoyProfitGrowthQ: q.yoyProfitGrowthQ,
        // Hard cap flags
        netLoss2ConsecYears:
          q.netProfitNegativeAnyQuarter && (pl.earningsGrowthYoY || 0) < -50,
        interestCoverageBelow1:
          pl.interestCoverage != null && pl.interestCoverage < 1,
        debtOver3x: bs.debtToEquity != null && bs.debtToEquity > 3,
        promoterPledgingOver50: sh.promoterPledgingOver50,
        // Meta
        _source: 'screener',
        _symbol: symbol,
        _fetchedAt: new Date().toISOString(),
        _url: url,
      };
    } catch (e) {
      console.error('[fundamentals]', symbol, String(e));
    }
  }
  return { _source: 'error', _symbol: symbol, _error: 'parse failed' };
}

async function handleFundamentals(url) {
  const raw = (
    url.searchParams.get('symbols') ||
    url.searchParams.get('symbol') ||
    ''
  ).trim();
  if (!raw)
    return new Response(
      JSON.stringify({ error: 'Provide ?symbols=TCS,WIPRO' }),
      { status: 400, headers: CORS_HEADERS },
    );
  const symbols = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s && !s.startsWith('MF:') && !s.startsWith('US:'))
    .slice(0, 10);
  if (!symbols.length)
    return new Response(JSON.stringify({ error: 'NSE equity symbols only' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  const results = {};
  for (let i = 0; i < symbols.length; i += 3) {
    const chunk = symbols.slice(i, i + 3);
    const res = await Promise.allSettled(
      chunk.map((s) => fetchFundamentals(s)),
    );
    res.forEach((r, j) => {
      results[chunk[j]] =
        r.status === 'fulfilled'
          ? r.value
          : { _source: 'error', _symbol: chunk[j] };
    });
    if (i + 3 < symbols.length) await new Promise((r) => setTimeout(r, 600));
  }
  return new Response(
    JSON.stringify({
      fundamentals: results,
      fetchedAt: new Date().toISOString(),
      count: symbols.length,
    }),
    { status: 200, headers: CORS_HEADERS },
  );
}

async function handleDebugHtml(url) {
  const sym = (url.searchParams.get('symbol') || 'TCS').toUpperCase();
  try {
    const res = await fetch(
      `https://www.screener.in/company/${encodeURIComponent(sym)}/consolidated/`,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html',
          'Accept-Language': 'en-IN,en;q=0.9',
          Referer: 'https://www.screener.in/',
        },
      },
    );
    const html = await res.text();
    // Run live extraction and return results + raw contexts
    const top = parseTopRatios(html);
    const plSecIdx = html.indexOf('id="profit-loss"');
    const plTbl =
      plSecIdx !== -1 ? toTable(html.slice(plSecIdx, plSecIdx + 25000)) : '';
    const shSecIdx = html.indexOf('id="shareholding"');
    const shSec = shSecIdx !== -1 ? html.slice(shSecIdx, shSecIdx + 18000) : '';
    const qTabIdx = shSec.indexOf('id="quarterly-shp"');
    const shTbl = toTable(
      qTabIdx !== -1 ? shSec.slice(qTabIdx, qTabIdx + 8000) : shSec,
    );
    const find = (txt) => {
      const i = html.indexOf(txt);
      return i !== -1 ? html.slice(Math.max(0, i - 80), i + 300) : 'NOT FOUND';
    };
    return new Response(
      JSON.stringify(
        {
          status: res.status,
          html_length: html.length,
          extracted: {
            pe: top.pe,
            roe: top.roe,
            roce: top.roce,
            sales: extractRow(plTbl, 'Sales').slice(0, 7),
            opm: extractRow(plTbl, 'OPM %').slice(0, 7),
            np: extractRow(plTbl, 'Net Profit').slice(0, 7),
            divPay: extractRow(plTbl, 'Dividend Payout %').slice(0, 7),
            promoters: extractRow(shTbl, 'Promoters').slice(0, 4),
            fiis: extractRow(shTbl, 'FIIs').slice(0, 4),
            cagr_sales_3: extractCAGR(
              html,
              'Compounded Sales Growth',
              '3 Years:',
            ),
            cagr_profit_3: extractCAGR(
              html,
              'Compounded Profit Growth',
              '3 Years:',
            ),
          },
          opm_context: find('OPM %'),
          div_payout_context: find('Dividend Payout'),
          promoters_context: find('Promoters'),
          quarterly_shp_found: html.includes('quarterly-shp'),
        },
        null,
        2,
      ),
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    const url = new URL(request.url);
    if (url.pathname === '/health')
      return new Response(
        JSON.stringify({ status: 'ok', ts: new Date().toISOString() }),
        { status: 200, headers: CORS_HEADERS },
      );
    if (url.pathname === '/amfi') return handleAmfiList();
    if (url.pathname === '/fundamentals') return handleFundamentals(url);
    if (url.pathname === '/debug-html') return handleDebugHtml(url);
    const symbolsRaw = (
      url.searchParams.get('symbols') ??
      url.searchParams.get('symbol') ??
      ''
    ).trim();
    if (!symbolsRaw)
      return new Response(
        JSON.stringify({
          error: 'Provide ?symbols=WIPRO,MF:119551,US:AAPL,GOLD',
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    const symbols = symbolsRaw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const needsNse = symbols.some(
      (s) => !s.startsWith('MF:') && !s.startsWith('US:'),
    );
    const nseCookie = needsNse ? await getNseCookie() : '';
    const results = await Promise.allSettled(
      symbols.map((sym) => fetchSymbolPrice(sym, nseCookie)),
    );
    const prices = {};
    results.forEach((r, i) => {
      prices[symbols[i]] =
        r.status === 'fulfilled'
          ? r.value
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
