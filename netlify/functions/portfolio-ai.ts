// POST { context, question? } → { text } using OpenAI when OPENAI_API_KEY is set.
import type { Handler } from '@netlify/functions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JSON_H = { ...CORS, 'Content-Type': 'application/json' };
const RL_WINDOW_MS = 60_000;
const RL_MAX = 4;
const rlMap = new Map<string, { count: number; resetAt: number }>();
const providerCooldown = new Map<'openai' | 'gemini', number>();

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

function isProviderCoolingDown(provider: 'openai' | 'gemini') {
  const until = providerCooldown.get(provider) ?? 0;
  return Date.now() < until;
}

function setProviderCooldown(
  provider: 'openai' | 'gemini',
  retryAfterSeconds = 12,
) {
  providerCooldown.set(provider, Date.now() + retryAfterSeconds * 1000);
}

function compactContext(context: Record<string, unknown>) {
  const allow = [
    'netWorth',
    'totalAssets',
    'totalLiabilities',
    'equityPct',
    'monthlyIncome',
    'monthlyExpense',
    'monthlySurplus',
    'emergencyTarget',
    'emergencyCurrent',
    'goalsActive',
    'goalsCompleted',
    'healthScore',
  ];
  const out: Record<string, unknown> = {};
  for (const k of allow) if (k in context) out[k] = context[k];
  return out;
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

  const safeContext = compactContext(body.context as Record<string, unknown>);
  const userContent = `Portfolio context (JSON):\n${JSON.stringify(safeContext, null, 2)}\n\nUser request: ${userQ}`;

  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  if (!openaiKey && !geminiKey) {
    return {
      statusCode: 200,
      headers: JSON_H,
      body: JSON.stringify({
        text: null,
        error: 'No AI provider configured (set OPENAI_API_KEY or GEMINI_API_KEY)',
      }),
    };
  }

  async function tryOpenAI() {
    if (!openaiKey) return { ok: false as const, reason: 'no_openai_key' };
    if (isProviderCoolingDown('openai'))
      return { ok: false as const, reason: 'openai_cooldown' };
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        temperature: 0.45,
        max_tokens: 600,
      }),
    });
    if (!res.ok) {
      if (res.status === 429) setProviderCooldown('openai', 20);
      return {
        ok: false as const,
        reason: 'openai_failed',
        status: res.status,
        detail: await res.text(),
      };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    return text
      ? { ok: true as const, text, provider: 'openai' as const }
      : { ok: false as const, reason: 'openai_empty' };
  }

  async function tryGemini() {
    if (!geminiKey) return { ok: false as const, reason: 'no_gemini_key' };
    if (isProviderCoolingDown('gemini'))
      return { ok: false as const, reason: 'gemini_cooldown' };
    const prompt = `${system}\n\n${userContent}`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.45,
            maxOutputTokens: 600,
          },
        }),
      },
    );
    if (!res.ok) {
      if (res.status === 429) setProviderCooldown('gemini', 20);
      return {
        ok: false as const,
        reason: 'gemini_failed',
        status: res.status,
        detail: await res.text(),
      };
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('\n')
        .trim() ?? '';
    return text
      ? { ok: true as const, text, provider: 'gemini' as const }
      : { ok: false as const, reason: 'gemini_empty' };
  }

  try {
    const openai = await tryOpenAI();
    if (openai.ok) {
      return {
        statusCode: 200,
        headers: JSON_H,
        body: JSON.stringify({ text: openai.text, provider: openai.provider }),
      };
    }
    if ('status' in openai) {
      console.error('[portfolio-ai] OpenAI error', openai.status, openai.detail);
    }

    const gemini = await tryGemini();
    if (gemini.ok) {
      return {
        statusCode: 200,
        headers: JSON_H,
        body: JSON.stringify({ text: gemini.text, provider: gemini.provider }),
      };
    }
    if ('status' in gemini) {
      console.error('[portfolio-ai] Gemini error', gemini.status, gemini.detail);
    }

    return {
      statusCode: 200,
      headers: JSON_H,
      body: JSON.stringify({ text: null, error: 'all_providers_failed_or_quota' }),
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
