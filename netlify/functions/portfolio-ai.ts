// POST { context, question? } → { text } using OpenAI when OPENAI_API_KEY is set.
import type { Handler } from '@netlify/functions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JSON_H = { ...CORS, 'Content-Type': 'application/json' };
const RL_WINDOW_MS = 60_000;
const RL_MAX = 12;
const rlMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rlMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rlMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  rlMap.set(ip, entry);
  return entry.count > RL_MAX;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: JSON_H,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }
  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for'] ||
    'unknown';
  if (isRateLimited(String(ip))) {
    return {
      statusCode: 429,
      headers: JSON_H,
      body: JSON.stringify({ error: 'Rate limit exceeded' }),
    };
  }

  let body: { context?: unknown; question?: string };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: JSON_H,
      body: JSON.stringify({ error: 'Invalid JSON' }),
    };
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      statusCode: 200,
      headers: JSON_H,
      body: JSON.stringify({
        text: null,
        error: 'OPENAI_API_KEY not configured on server',
      }),
    };
  }

  if (!body.context || typeof body.context !== 'object') {
    return {
      statusCode: 400,
      headers: JSON_H,
      body: JSON.stringify({ error: 'Missing context' }),
    };
  }

  const system = `You are a concise financial wellness coach for Indian retail investors using FinTrackly.
Rules:
- Use ONLY the numeric JSON context provided. Do not invent holdings or account details.
- Write in clear English; rupees are INR. Use lakh/crore only if natural.
- Structure: short executive summary (2–3 sentences), then "### Strengths", "### Risks", "### Suggested next steps" (3–5 bullet points total across sections).
- Be practical and non-alarmist. No hype.
- End with one line: "Not personalized investment advice; for education only."
- If data is sparse, say what is missing (e.g. cashflow) instead of guessing.`;

  const userQ =
    body.question?.trim() ||
    'Give a concise briefing based on this portfolio snapshot.';
  if (userQ.length > 500) {
    return {
      statusCode: 400,
      headers: JSON_H,
      body: JSON.stringify({ error: 'Question too long' }),
    };
  }

  const userContent = `Portfolio context (JSON):\n${JSON.stringify(body.context, null, 2)}\n\nUser request: ${userQ}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        temperature: 0.45,
        max_tokens: 1400,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[portfolio-ai] OpenAI error', res.status, err);
      return {
        statusCode: 200,
        headers: JSON_H,
        body: JSON.stringify({ text: null, error: 'openai_failed' }),
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';

    return {
      statusCode: 200,
      headers: JSON_H,
      body: JSON.stringify({ text: text || null }),
    };
  } catch (e: unknown) {
    console.error('[portfolio-ai]', e);
    return {
      statusCode: 200,
      headers: JSON_H,
      body: JSON.stringify({ text: null, error: 'exception' }),
    };
  }
};
