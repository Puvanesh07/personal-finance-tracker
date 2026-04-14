import type { Handler } from '@netlify/functions';

const hits = new Map<string, { c: number; t: number }>();
const WINDOW_MS = 60_000;
const MAX_REQ = 30;

function rateOk(ip: string) {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now - row.t > WINDOW_MS) {
    hits.set(ip, { c: 1, t: now });
    return true;
  }
  row.c += 1;
  return row.c <= MAX_REQ;
}

const FALLBACK: Record<string, number> = {
  NIFTY50: 12.0,
  SENSEX: 11.5,
  SP500: 10.5,
  NASDAQ100: 13.2,
};

export const handler: Handler = async (event) => {
  const ip = event.headers['x-forwarded-for'] || 'local';
  if (!rateOk(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: 'rate_limited' }) };
  }
  const symbol = (event.queryStringParameters?.symbol || 'NIFTY50').toUpperCase();
  const value = FALLBACK[symbol] ?? FALLBACK.NIFTY50;
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
    body: JSON.stringify({ symbol, annualReturnPct: value, source: 'fallback' }),
  };
};

