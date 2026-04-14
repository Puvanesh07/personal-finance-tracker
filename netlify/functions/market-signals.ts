import type { Handler } from '@netlify/functions';

const hits = new Map<string, { c: number; t: number }>();
const WINDOW_MS = 60_000;
const MAX_REQ = 40;

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

export const handler: Handler = async (event) => {
  const ip = event.headers['x-forwarded-for'] || 'local';
  if (!rateOk(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: 'rate_limited' }) };
  }
  const symbol = (event.queryStringParameters?.symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,15}$/.test(symbol)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid_symbol' }) };
  }
  const day = new Date().getDate();
  const earningsInDays = (symbol.charCodeAt(0) + day) % 14;
  const newsScore = (symbol.charCodeAt(symbol.length - 1) + day) % 100;
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
    body: JSON.stringify({
      symbol,
      earningsInDays,
      hasUpcomingEarnings: earningsInDays <= 7,
      newsMomentumScore: newsScore,
      source: 'safe_stub',
    }),
  };
};

