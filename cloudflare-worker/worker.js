// Cloudflare Worker: Universal Price + Fundamentals Proxy
// Routes:
//   GET /?symbols=TCS,MF:119551,US:AAPL,GOLD  → live prices
//   GET /fundamentals?symbols=TCS,RELIANCE     → equity fundamentals (Screener.in)
//   GET /fundamentals?symbols=MF:119551        → MF returns (mfapi.in NAV history)
//   GET /amfi                                  → AMFI NAVAll.txt proxy
//   GET /health                                → health check
//   GET /debug-html?symbol=TCS                 → raw HTML extraction debug

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: CORS });

// ─── AMFI NAV Proxy ───────────────────────────────────────────────────────────
async function handleAmfi() {
  try {
    const res = await fetch('https://www.amfiindia.com/spages/NAVAll.txt', {
      headers: { 'User-Agent': UA },
      cf: { cacheEverything: true, cacheTtl: 21600 },
    });
    if (!res.ok) return json({ error: `AMFI ${res.status}` }, 502);
    return new Response(await res.text(), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=21600',
      },
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

// ─── Live Price Fetchers ──────────────────────────────────────────────────────
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

async function nseQuote(symbol, cookie) {
  if (!cookie) return null;
  const hdrs = {
    'User-Agent': UA,
    Accept: 'application/json',
    Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`,
    'X-Requested-With': 'XMLHttpRequest',
    Cookie: cookie,
  };
  for (const sfx of ['', '&series=EQ', '&identifier=EQUITIES']) {
    try {
      const res = await fetch(
        `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}${sfx}`,
        { headers: hdrs },
      );
      if (res.ok) {
        const d = await res.json();
        const p = d?.priceInfo?.lastPrice ?? d?.priceInfo?.close ?? null;
        if (p && p > 0) return Number(p);
      }
    } catch {}
  }
  return null;
}

async function nseSearch(symbol, cookie) {
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
    if (!match?.symbol || match.symbol.toUpperCase() === symbol.toUpperCase())
      return null;
    return await nseQuote(match.symbol, cookie);
  } catch {
    return null;
  }
}

async function tickertape(symbol) {
  for (const ex of ['NSE', 'BSE']) {
    try {
      const res = await fetch(
        `https://api.tickertape.in/stocks/quotes?tickers=${ex}:${encodeURIComponent(symbol)}`,
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
      const p = d?.data?.[0]?.price ?? d?.data?.[0]?.lp ?? null;
      if (p && p > 0) return Number(p);
    } catch {}
  }
  return null;
}

async function yahooNse(symbol) {
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
    const p =
      d?.chart?.result?.[0]?.meta?.regularMarketPrice ??
      d?.chart?.result?.[0]?.meta?.previousClose ??
      null;
    return p && p > 0 ? Number(p) : null;
  } catch {
    return null;
  }
}

async function yahoo(ticker) {
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
    const p =
      d?.chart?.result?.[0]?.meta?.regularMarketPrice ??
      d?.chart?.result?.[0]?.meta?.previousClose ??
      null;
    return p && p > 0 ? Number(p) : null;
  } catch {
    return null;
  }
}

let amfiCache = null,
  amfiCacheTs = 0;
async function amfiData() {
  if (amfiCache && Date.now() - amfiCacheTs < 21600000) return amfiCache;
  try {
    const res = await fetch('https://www.amfiindia.com/spages/NAVAll.txt', {
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return null;
    amfiCache = await res.text();
    amfiCacheTs = Date.now();
    return amfiCache;
  } catch {
    return null;
  }
}

async function mfNav(code) {
  try {
    const txt = await amfiData();
    if (!txt) return null;
    for (const ln of txt.split('\n')) {
      const p = ln.split(';');
      if (p[0]?.trim() === String(code)) {
        const n = parseFloat(p[4]?.trim());
        return !isNaN(n) && n > 0 ? n : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function mfSearch(name) {
  try {
    const txt = await amfiData();
    if (!txt) return null;
    const nl = name.toLowerCase();
    for (const ln of txt.split('\n')) {
      const p = ln.split(';');
      if (p.length < 5) continue;
      if ((p[3]?.toLowerCase() ?? '').includes(nl)) {
        const n = parseFloat(p[4]?.trim());
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return null;
  } catch {
    return null;
  }
}

const COMMODITIES = {
  GOLD: 'GOLDBEES',
  SILVER: 'SILVERBEES',
  SGOLD: 'SGOLD',
  SSILVER: 'SILVERETF',
};

async function fetchPrice(rawSym, nseCookie) {
  const sym = rawSym.trim().toUpperCase();
  if (sym.startsWith('MF:')) {
    const c = sym.slice(3).trim();
    const p = /^\d+$/.test(c) ? await mfNav(c) : await mfSearch(c);
    return p != null
      ? { price: p, source: 'amfi', type: 'mutual_fund' }
      : { price: null, source: 'none', type: 'mutual_fund' };
  }
  if (sym.startsWith('US:')) {
    const p = await yahoo(sym.slice(3).trim());
    return p != null
      ? { price: p, source: 'yahoo', type: 'us_stock' }
      : { price: null, source: 'none', type: 'us_stock' };
  }
  if (COMMODITIES[sym]) {
    const etf = COMMODITIES[sym];
    const p = (await nseQuote(etf, nseCookie)) ?? (await tickertape(etf));
    return p != null
      ? {
          price: p,
          source: p === (await nseQuote(etf, nseCookie)) ? 'nse' : 'tickertape',
          type: 'commodity',
        }
      : { price: null, source: 'none', type: 'commodity' };
  }
  const p1 = await nseQuote(sym, nseCookie);
  if (p1 != null) return { price: p1, source: 'nse', type: 'stock' };
  const p2 = await nseSearch(sym, nseCookie);
  if (p2 != null) return { price: p2, source: 'nse', type: 'stock' };
  const p3 = await yahooNse(sym);
  if (p3 != null) return { price: p3, source: 'yahoo', type: 'stock' };
  const p4 = await tickertape(sym);
  if (p4 != null) return { price: p4, source: 'tickertape', type: 'stock' };
  const p5 = await yahoo(sym);
  if (p5 != null) return { price: p5, source: 'yahoo', type: 'us_stock' };
  return { price: null, source: 'none', type: 'stock' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EQUITY FUNDAMENTALS — Screener.in HTML scraper
// Confirmed structure March 2026:
//   top-ratios:  <span class="name">\n  LABEL\n</span> → <span class="number">VALUE</span>
//   Tables:      label in <td> (may wrap in <button>/<a>), values in <td class="">
//                % values like "23 %" need %? in regex
//   CAGR:        plain <th> heading → <tr><td>3 Years:</td><td>10%</td></tr>
//   Shareholding: in <div id="quarterly-shp"> tab
//   Current ratio: in id="ratios" section (NOT balance-sheet)
//   Pledged %:   search ENTIRE section HTML (may be outside quarterly-shp table)
// ═══════════════════════════════════════════════════════════════════════════════

function extractTopRatio(html, label) {
  const O = '<span class="name">',
    C = '</span>';
  let pos = 0;
  while (pos < html.length) {
    const s = html.indexOf(O, pos);
    if (s === -1) break;
    const e = html.indexOf(C, s);
    if (e === -1) break;
    if (html.slice(s + O.length, e).trim() === label) {
      const m = html
        .slice(e, e + 500)
        .match(/<span class="number">([\d,]+\.?\d*)<\/span>/);
      return m ? m[1].replace(/,/g, '') : null;
    }
    pos = s + 1;
  }
  return null;
}

function extractHighLow(html) {
  const O = '<span class="name">',
    C = '</span>';
  let pos = 0;
  while (pos < html.length) {
    const s = html.indexOf(O, pos);
    if (s === -1) break;
    const e = html.indexOf(C, s);
    if (e === -1) break;
    if (html.slice(s + O.length, e).trim() === 'High / Low') {
      const nums = [
        ...html
          .slice(e, e + 500)
          .matchAll(/<span class="number">([\d,]+)<\/span>/g),
      ]
        .map((m) => parseFloat(m[1].replace(/,/g, '')))
        .filter((n) => !isNaN(n) && n > 0);
      return { high: nums[0] || null, low: nums[1] || null };
    }
    pos = s + 1;
  }
  return { high: null, low: null };
}

function extractMCap(html) {
  const O = '<span class="name">',
    C = '</span>';
  let pos = 0;
  while (pos < html.length) {
    const s = html.indexOf(O, pos);
    if (s === -1) break;
    const e = html.indexOf(C, s);
    if (e === -1) break;
    if (html.slice(s + O.length, e).trim() === 'Market Cap') {
      const m = html
        .slice(e, e + 400)
        .match(/<span class="number">([\d,]+)<\/span>/);
      return m ? parseFloat(m[1].replace(/,/g, '')) : null;
    }
    pos = s + 1;
  }
  return null;
}

// Find label in HTML, grab enclosing <tr>, extract numeric <td>s
// %? handles values like "23 %" in OPM rows
function row(html, label) {
  const li = html.indexOf(label);
  if (li === -1) return [];
  const s = html.lastIndexOf('<tr', li),
    e = html.indexOf('</tr>', li);
  if (s === -1 || e === -1) return [];
  return [
    ...html
      .slice(s, e)
      .matchAll(/<td[^>]*>\s*([+-]?[\d,]+\.?\d*)\s*%?\s*<\/td>/g),
  ]
    .map((m) => {
      const n = parseFloat(m[1].replace(/,/g, ''));
      return isNaN(n) ? null : n;
    })
    .filter((n) => n !== null);
}

// Skip header buttons, jump to first <table>
function tbl(html) {
  const t = html.indexOf('<table');
  return t !== -1 ? html.slice(t) : html;
}

// CAGR tables: heading → period row → plain <td> value
function cagr(html, heading, period) {
  const hi = html.indexOf(heading);
  if (hi === -1) return null;
  const chunk = html.slice(hi, hi + 700),
    pi = chunk.indexOf(period);
  if (pi === -1) return null;
  const m = chunk
    .slice(pi, pi + 100)
    .match(/<td[^>]*>\s*([+-]?[\d.]+)\s*%?\s*<\/td>/);
  return m ? parseFloat(m[1]) : null;
}

function parseTR(html) {
  const bv = parseFloat(extractTopRatio(html, 'Book Value') || '') || null;
  const cp = parseFloat(extractTopRatio(html, 'Current Price') || '') || null;
  return {
    pe: parseFloat(extractTopRatio(html, 'Stock P/E') || '') || null,
    roe: parseFloat(extractTopRatio(html, 'ROE') || '') || null,
    roce: parseFloat(extractTopRatio(html, 'ROCE') || '') || null,
    dividendYield:
      parseFloat(extractTopRatio(html, 'Dividend Yield') || '') || null,
    cp,
    bv,
    pb: cp && bv && bv > 0 ? Math.round((cp / bv) * 100) / 100 : null,
    mcap: extractMCap(html),
    ...extractHighLow(html),
  };
}

function parsePL(html) {
  const si = html.indexOf('id="profit-loss"');
  if (si === -1) return {};
  const t = tbl(html.slice(si, si + 25000));
  const sales = row(t, 'Sales'),
    np = row(t, 'Net Profit'),
    opm = row(t, 'OPM %'),
    ebit = row(t, 'Operating Profit');
  const int_ = row(t, 'Interest'),
    divp = row(t, 'Dividend Payout %'),
    cash = row(t, 'Cash from Operations'),
    eps_ = row(t, 'EPS in Rs');
  const lat = (a) => (a.length >= 2 ? a[a.length - 2] : (a[0] ?? null));
  const pri = (a) => (a.length >= 3 ? a[a.length - 3] : (a[0] ?? null));
  const lS = lat(sales),
    pS = pri(sales),
    lN = lat(np),
    pN = pri(np),
    lE = lat(ebit),
    lI = lat(int_);
  return {
    revG: lS && pS && pS > 0 ? Math.round(((lS - pS) / pS) * 100) : null,
    earnG:
      lN != null && pN != null && pN !== 0
        ? Math.round(((lN - pN) / Math.abs(pN)) * 100)
        : null,
    nm: lN != null && lS && lS > 0 ? Math.round((lN / lS) * 1000) / 10 : null,
    om: lat(opm),
    ic: lE && lI && lI > 0 ? Math.round((lE / lI) * 10) / 10 : null,
    divP: lat(divp),
    fcf: cash.length > 0 ? (lat(cash) || 0) > 0 : undefined,
    eps: lat(eps_),
    _lS: lS,
    _lN: lN,
  };
}

function parseBS(html) {
  const si = html.indexOf('id="balance-sheet"');
  if (si === -1) return {};
  const t = tbl(html.slice(si, si + 20000));
  const borr = row(t, 'Borrowings'),
    eq = row(t, 'Equity Capital'),
    res = row(t, 'Reserves'),
    ta = row(t, 'Total Assets');
  const b = borr.length > 0 ? borr[borr.length - 1] : null,
    e = eq.length > 0 ? eq[eq.length - 1] : null;
  const r = res.length > 0 ? res[res.length - 1] : null,
    ta_ = ta.length > 0 ? ta[ta.length - 1] : null;
  return {
    de:
      b != null && e != null && r != null && e + r > 0
        ? Math.round((b / (e + r)) * 100) / 100
        : null,
    ta: ta_,
    debt: b,
  };
}

function parseCR(html) {
  // Current ratio is in id="ratios" section, NOT balance-sheet
  const si = html.indexOf('id="ratios"');
  if (si !== -1) {
    const t = tbl(html.slice(si, si + 8000)),
      arr = row(t, 'Current ratio');
    const lat = (a) => (a.length >= 2 ? a[a.length - 2] : (a[0] ?? null));
    const cr = lat(arr);
    if (cr !== null) return cr;
  }
  // Fallback: any "Current ratio" row in page (filter to realistic range 0.1–50)
  const pi = html.indexOf('Current ratio');
  if (pi !== -1) {
    const s = html.lastIndexOf('<tr', pi),
      e = html.indexOf('</tr>', pi);
    if (s !== -1 && e !== -1) {
      const vals = [
        ...html
          .slice(s, e)
          .matchAll(/<td[^>]*>\s*([+-]?[\d,]+\.?\d*)\s*%?\s*<\/td>/g),
      ]
        .map((m) => parseFloat(m[1].replace(/,/g, '')))
        .filter((n) => !isNaN(n) && n > 0.1 && n < 50);
      if (vals.length > 0) return vals[vals.length - 1];
    }
  }
  return null;
}

function parseCAGR(html) {
  return {
    s3: cagr(html, 'Compounded Sales Growth', '3 Years:'),
    s5: cagr(html, 'Compounded Sales Growth', '5 Years:'),
    p3: cagr(html, 'Compounded Profit Growth', '3 Years:'),
    p5: cagr(html, 'Compounded Profit Growth', '5 Years:'),
    st3: cagr(html, 'Stock Price CAGR', '3 Years:'),
    st5: cagr(html, 'Stock Price CAGR', '5 Years:'),
  };
}

function parseSH(html) {
  const si = html.indexOf('id="shareholding"');
  if (si === -1) return {};
  const sec = html.slice(si); // no size limit — pledging may be far in section
  let sh = sec;
  const qi = sec.indexOf('id="quarterly-shp"');
  if (qi !== -1) sh = sec.slice(qi, qi + 12000);
  const t = tbl(sh);
  const lat = (lbl) => {
    const a = row(t, lbl);
    return a.length > 0 ? a[a.length - 1] : null;
  };
  const prom = lat('Promoters'),
    fii = lat('FIIs'),
    dii = lat('DIIs');
  const inst =
    fii != null || dii != null
      ? Math.round(((fii || 0) + (dii || 0)) * 100) / 100
      : null;
  // Pledged: search ENTIRE section (no size limit, 0 is valid)
  let pledged = null;
  const pa = row(sec, 'Pledged percentage');
  if (pa.length > 0) {
    pledged = pa[pa.length - 1];
  } else {
    const m =
      sec.match(/[Pp]ledged percentage[^\d<]{0,50}([\d.]+)/) ||
      sec.match(/Pledged[^<]{0,30}<[^>]+>\s*([\d.]+)/);
    if (m) pledged = parseFloat(m[1]);
  }
  return { prom, inst, pledged, pledgedOver50: (pledged || 0) > 50 };
}

function parseQ(html) {
  const si = html.indexOf('id="quarters"');
  if (si === -1) return {};
  const t = tbl(html.slice(si, si + 18000));
  const sales = row(t, 'Sales'),
    np = row(t, 'Net Profit'),
    opm = row(t, 'OPM %');
  const yS =
    sales.length >= 5
      ? Math.round(
          ((sales[sales.length - 1] - sales[sales.length - 5]) /
            sales[sales.length - 5]) *
            100,
        )
      : null;
  const yN =
    np.length >= 5 && np[np.length - 5] !== 0
      ? Math.round(
          ((np[np.length - 1] - np[np.length - 5]) /
            Math.abs(np[np.length - 5])) *
            100,
        )
      : null;
  return {
    revG4Q: sales.length >= 2 && sales[sales.length - 1] > sales[0],
    profG4Q:
      np.length >= 2 && np[np.length - 1] > np[0] && np[np.length - 1] > 0,
    lossAnyQ: np.some((n) => n < 0),
    marginExp: opm.length >= 2 && opm[opm.length - 1] >= opm[0],
    latS: sales.length > 0 ? sales[sales.length - 1] : null,
    latP: np.length > 0 ? np[np.length - 1] : null,
    yoyS: yS,
    yoyP: yN,
  };
}

async function fetchEquity(symbol) {
  for (const url of [
    `https://www.screener.in/company/${encodeURIComponent(symbol)}/consolidated/`,
    `https://www.screener.in/company/${encodeURIComponent(symbol)}/`,
  ]) {
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
      const tr = parseTR(html),
        pl = parsePL(html),
        bs = parseBS(html),
        cr = parseCR(html),
        cg = parseCAGR(html),
        sh = parseSH(html),
        q = parseQ(html);
      let w52 = null;
      if (tr.high && tr.low && tr.cp && tr.high > tr.low)
        w52 = Math.round(((tr.cp - tr.low) / (tr.high - tr.low)) * 100);
      const mc =
        tr.mcap != null
          ? tr.mcap >= 20000
            ? 'large'
            : tr.mcap >= 5000
              ? 'mid'
              : tr.mcap >= 500
                ? 'small'
                : 'micro'
          : null;
      const peg =
        tr.pe && (cg.p3 || cg.p5) && (cg.p3 || cg.p5) > 0
          ? Math.round((tr.pe / (cg.p3 || cg.p5)) * 100) / 100
          : null;
      const roa =
        pl._lN != null && bs.ta && bs.ta > 0
          ? Math.round((pl._lN / bs.ta) * 1000) / 10
          : null;
      const ps =
        tr.mcap && pl._lS && pl._lS > 0
          ? Math.round((tr.mcap / pl._lS) * 100) / 100
          : null;
      return {
        pe: tr.pe,
        peg,
        pb: tr.pb,
        priceToSales: ps,
        roe: tr.roe,
        roce: tr.roce,
        roa,
        netMargin: pl.nm,
        operatingMargin: pl.om,
        fcfPositive: pl.fcf,
        eps: pl.eps,
        debtToEquity: bs.de,
        currentRatio: cr,
        interestCoverage: pl.ic,
        totalDebt: bs.debt,
        revenueGrowthYoY: pl.revG,
        earningsGrowthYoY: pl.earnG,
        salesCagr3yr: cg.s3,
        salesCagr5yr: cg.s5,
        profitCagr3yr: cg.p3,
        profitCagr5yr: cg.p5,
        stockCagr3yr: cg.st3,
        stockCagr5yr: cg.st5,
        promoterHolding: sh.prom,
        institutionalHolding: sh.inst,
        promoterPledging: sh.pledged,
        dividendYield: tr.dividendYield,
        dividendPayoutRatio: pl.divP,
        fiftyTwoWeekPosition: w52,
        marketCapCategory: mc,
        currentPrice: tr.cp,
        bookValue: tr.bv,
        marketCapCr: tr.mcap,
        quarterlyRevenueGrowingYoY: q.revG4Q,
        quarterlyProfitGrowingYoY: q.profG4Q,
        netProfitNegativeAnyQuarter: q.lossAnyQ,
        ebitdaMarginExpanding: q.marginExp,
        latestQuarterlySales: q.latS,
        latestQuarterlyProfit: q.latP,
        yoySalesGrowthQ: q.yoyS,
        yoyProfitGrowthQ: q.yoyP,
        netLoss2ConsecYears: q.lossAnyQ && (pl.earnG || 0) < -50,
        interestCoverageBelow1: pl.ic != null && pl.ic < 1,
        debtOver3x: bs.de != null && bs.de > 3,
        promoterPledgingOver50: sh.pledgedOver50,
        _source: 'screener',
        _symbol: symbol,
        _fetchedAt: new Date().toISOString(),
        _url: url,
      };
    } catch (e) {
      console.error('[equity]', symbol, String(e));
    }
  }
  return { _source: 'error', _symbol: symbol, _error: 'Screener parse failed' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUTUAL FUND FUNDAMENTALS — mfapi.in NAV history
// Only fetches what MF scoring needs:
//   Growth (40%):  salesCagr3yr/5yr = fund CAGR returns
//                  revenueGrowthYoY = 1yr return
//   Market (30%):  fiftyTwoWeekPosition from NAV 52W range
// Profitability=0, Health=0 per MF weight override — NOT fetched
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchMF(schemeCode) {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok)
      return {
        _source: 'error',
        _symbol: `MF:${schemeCode}`,
        _error: `mfapi ${res.status}`,
      };
    const data = await res.json();
    const meta = data?.meta ?? {},
      navArr = data?.data ?? [];
    if (!navArr.length)
      return {
        _source: 'error',
        _symbol: `MF:${schemeCode}`,
        _error: 'no NAV data',
      };
    const pd = (s) => {
      const [d, m, y] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const navs = navArr
      .map((r) => ({ d: pd(r.date), n: parseFloat(r.nav) }))
      .filter((r) => !isNaN(r.n) && r.n > 0)
      .sort((a, b) => b.d - a.d);
    if (!navs.length)
      return {
        _source: 'error',
        _symbol: `MF:${schemeCode}`,
        _error: 'no valid NAV',
      };
    const latest = navs[0].n,
      ldate = navs[0].d;
    const navAt = (yrs) => {
      const t = new Date(ldate);
      t.setFullYear(t.getFullYear() - yrs);
      const tms = t.getTime();
      let best = null,
        bd = Infinity;
      for (const r of navs) {
        const diff = Math.abs(r.d.getTime() - tms);
        if (diff < bd) {
          bd = diff;
          best = r;
        }
        if (r.d < t) break;
      }
      return best && bd < 45 * 86400000 ? best.n : null;
    };
    const n1 = navAt(1),
      n3 = navAt(3),
      n5 = navAt(5);
    const r1 = n1 ? Math.round((latest / n1 - 1) * 10000) / 100 : null;
    const r3 = n3
      ? Math.round((Math.pow(latest / n3, 1 / 3) - 1) * 10000) / 100
      : null;
    const r5 = n5
      ? Math.round((Math.pow(latest / n5, 1 / 5) - 1) * 10000) / 100
      : null;
    const cut52 = new Date(ldate);
    cut52.setFullYear(cut52.getFullYear() - 1);
    const n52 = navs.filter((r) => r.d >= cut52).map((r) => r.n);
    let w52 = null;
    if (n52.length > 1) {
      const hi = Math.max(...n52),
        lo = Math.min(...n52);
      if (hi > lo) w52 = Math.round(((latest - lo) / (hi - lo)) * 100);
    }
    const cut3 = new Date(ldate);
    cut3.setFullYear(cut3.getFullYear() - 3);
    const n3yr = navs.filter((r) => r.d >= cut3).map((r) => r.n);
    let maxDD = null;
    if (n3yr.length > 1) {
      let pk = n3yr[0],
        dd = 0;
      for (const n of n3yr) {
        if (n > pk) pk = n;
        const d = ((pk - n) / pk) * 100;
        if (d > dd) dd = d;
      }
      maxDD = Math.round(dd * 100) / 100;
    }
    return {
      // Fields used by MF scoring (Growth 40%, Market 30%)
      salesCagr3yr: r3,
      salesCagr5yr: r5,
      stockCagr3yr: r3,
      stockCagr5yr: r5,
      revenueGrowthYoY: r1,
      fiftyTwoWeekPosition: w52,
      // MF metadata
      _mfName: meta.scheme_name || '',
      _mfCategory: meta.scheme_category || '',
      _mfType: meta.scheme_type || '',
      _nav: latest,
      _returns1yr: r1,
      _returns3yr: r3,
      _returns5yr: r5,
      _maxDrawdown: maxDD,
      _navCount: navs.length,
      _source: 'mfapi',
      _symbol: `MF:${schemeCode}`,
      _fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return { _source: 'error', _symbol: `MF:${schemeCode}`, _error: String(e) };
  }
}

// ── Route Handlers ────────────────────────────────────────────────────────────
async function handleFundamentals(url) {
  const raw = (
    url.searchParams.get('symbols') ||
    url.searchParams.get('symbol') ||
    ''
  ).trim();
  if (!raw)
    return json({ error: 'Provide ?symbols=TCS or ?symbols=MF:119551' }, 400);
  const tokens = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 10);
  const results = {};
  for (const t of tokens.filter((s) => s.startsWith('MF:'))) {
    const code = t.slice(3).trim();
    results[t] = /^\d{5,6}$/.test(code)
      ? await fetchMF(code)
      : { _source: 'error', _symbol: t, _error: 'Use MF:119551 format' };
  }
  const equity = tokens.filter(
    (s) => !s.startsWith('MF:') && !s.startsWith('US:'),
  );
  for (let i = 0; i < equity.length; i += 3) {
    const chunk = equity.slice(i, i + 3);
    const res = await Promise.allSettled(chunk.map((s) => fetchEquity(s)));
    res.forEach((r, j) => {
      results[chunk[j]] =
        r.status === 'fulfilled'
          ? r.value
          : { _source: 'error', _symbol: chunk[j] };
    });
    if (i + 3 < equity.length) await new Promise((r) => setTimeout(r, 600));
  }
  return json({
    fundamentals: results,
    fetchedAt: new Date().toISOString(),
    count: tokens.length,
  });
}

async function handleDebug(url) {
  const sym = (url.searchParams.get('symbol') || 'TCS').toUpperCase();
  if (/^\d{5,6}$/.test(sym)) return json(await fetchMF(sym), 200);
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
    const tr = parseTR(html),
      plSi = html.indexOf('id="profit-loss"'),
      plT = plSi !== -1 ? tbl(html.slice(plSi, plSi + 25000)) : '';
    const shSi = html.indexOf('id="shareholding"'),
      shSec = shSi !== -1 ? html.slice(shSi) : '',
      qi = shSec.indexOf('id="quarterly-shp"'),
      shT = tbl(qi !== -1 ? shSec.slice(qi, qi + 12000) : shSec);
    const ratSi = html.indexOf('id="ratios"'),
      ratT = ratSi !== -1 ? tbl(html.slice(ratSi, ratSi + 8000)) : '';
    const find = (txt) => {
      const i = html.indexOf(txt);
      return i !== -1 ? html.slice(Math.max(0, i - 100), i + 300) : 'NOT FOUND';
    };
    return json(
      {
        status: res.status,
        html_length: html.length,
        extracted: {
          pe: tr.pe,
          roe: tr.roe,
          roce: tr.roce,
          pb: tr.pb,
          sales: row(plT, 'Sales').slice(0, 7),
          np: row(plT, 'Net Profit').slice(0, 7),
          opm: row(plT, 'OPM %').slice(0, 7),
          promoters: row(shT, 'Promoters').slice(0, 5),
          pledged: row(shSec, 'Pledged percentage').slice(0, 5),
          cr_ratios: row(ratT, 'Current ratio'),
          cr_computed: parseCR(html),
          cagr_s3: cagr(html, 'Compounded Sales Growth', '3 Years:'),
          cagr_p3: cagr(html, 'Compounded Profit Growth', '3 Years:'),
        },
        current_ratio_context: find('Current ratio'),
        pledged_context: find('Pledged percentage'),
      },
      200,
    );
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === '/health')
      return json({ status: 'ok', ts: new Date().toISOString() });
    if (url.pathname === '/amfi') return handleAmfi();
    if (url.pathname === '/fundamentals') return handleFundamentals(url);
    if (url.pathname === '/debug-html') return handleDebug(url);
    const raw = (
      url.searchParams.get('symbols') ??
      url.searchParams.get('symbol') ??
      ''
    ).trim();
    if (!raw)
      return json(
        { error: 'Provide ?symbols=WIPRO,MF:119551,US:AAPL,GOLD' },
        400,
      );
    const syms = raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const needNse = syms.some(
      (s) => !s.startsWith('MF:') && !s.startsWith('US:'),
    );
    const cookie = needNse ? await getNseCookie() : '';
    const fetched = await Promise.allSettled(
      syms.map((s) => fetchPrice(s, cookie)),
    );
    const prices = {};
    fetched.forEach((r, i) => {
      prices[syms[i]] =
        r.status === 'fulfilled'
          ? r.value
          : { price: null, source: 'none', type: 'unknown' };
    });
    return json({
      prices,
      fetchedAt: new Date().toISOString(),
      count: syms.length,
    });
  },
};
