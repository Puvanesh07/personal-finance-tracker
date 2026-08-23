/**
 * functions/src/groqFunction.ts
 *
 * generateFinanceAI — 2nd Gen Firebase Callable Function (Node.js 22).
 *
 * All AI answers for the Fintrackly AI Agent page are produced by this
 * server-side function so the Groq API key NEVER ships to the browser.
 * The key lives in Firebase Secret Manager as `GROQ_API_KEY` and is mounted
 * by the Firebase Functions v2 runtime as process.env.GROQ_API_KEY.
 *
 * Client contract (see src/services/groqService.ts):
 *   Request  : { type : 'dashboard' | 'insights' | 'report' | 'question'
 *                question? : string
 *                context   : Record<string, unknown> }
 *   Response : { text : string, model : string }
 *
 * Throws HttpsError codes: unauthenticated, invalid-argument,
 * failed-precondition, resource-exhausted, internal.
 */

import * as logger from 'firebase-functions/logger';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';

// ── Configuration ───────────────────────────────────────────────────────────
const GROQ_API_KEY = defineSecret('GROQ_API_KEY');

const REGION = 'asia-south1';
const MODEL  = 'llama-3.1-70b-versatile'; // fast + capable, Groq default
const MODEL_FALLBACK = 'llama3-8b-8192';
const MAX_TOKENS_ANSWER = 1024;
const TEMPERATURE = 0.35; // financial questions — keep factual, low creativity

const MAX_CONTEXT_CHARS = 24_000; // ~6k tokens, well below 128k window limits

// ── Lightweight auth-gated per-user rate limiter (Firestore) ─────────────────
async function checkAndIncrementQuota(uid: string): Promise<void> {
  // Allow 30 requests / user / day.  Simple counter stored at
  // users/{uid}/groqUsage/{YYYY-MM-DD}.  We don't throw on over-quota until
  // count exceeds 30; this lets most power users through unblocked.
  try {
    const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
    const db   = getFirestore();
    const date = new Date();
    const day  = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    const ref  = db.collection('users').doc(uid).collection('groqUsage').doc(day);
    const snap = await ref.get();
    const cur  = (snap.exists && snap.data()?.count && typeof snap.data()!.count === 'number')
      ? snap.data()!.count as number
      : 0;
    if (cur >= 60) {
      throw new HttpsError(
        'resource-exhausted',
        `Daily AI limit reached (${cur} requests today).  Please come back tomorrow or ask shorter questions.`,
      );
    }
    await ref.set({ count: cur + 1, lastAt: Timestamp.now() }, { merge: true });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    // Don't fail the request if quota tracking is temporarily broken.
    logger.warn('[groq] quota tracking unavailable, continuing', err);
  }
}

// ── Input + prompt construction helpers ─────────────────────────────────────
function truncateContext(context: Record<string, unknown>): string {
  try {
    const compact = JSON.stringify(context);
    if (compact.length <= MAX_CONTEXT_CHARS) return compact;
    // Truncate char-by-char with a marker so we never exceed token limits.
    return compact.slice(0, MAX_CONTEXT_CHARS) + `\n… [truncated, original ${compact.length} chars]`;
  } catch (_) {
    return `{ error: "context_not_serializable" }`;
  }
}

type ReqType = 'dashboard' | 'insights' | 'report' | 'question';

function buildSystemPrompt(type: ReqType): string {
  const base = [
    'You are Fintrackly, a friendly, helpful personal finance assistant.',
    'Always reply in clear, short paragraphs. Use bullet points when a list fits.',
    'Use Indian context (rupees ₹, India, typical Indian investments, Indian tax).',
    'Never give SEBI/RBI-registered investment advice.  Frame recommendations as educational.',
    'If the user asks to perform an action (add record, pay, etc.) — answer only in chat, do not invent API calls.',
    'When data is provided as JSON context, base your answer on that data first.  Don\'t hallucinate numbers.',
  ];
  switch (type) {
    case 'dashboard':
      return base.concat(['This call is a dashboard summary.  Provide a concise 4–7 bullet snapshot of the user\'s finances.']).join('\n');
    case 'insights':
      return base.concat(['This call asks for insights.  Point out 3–5 concrete trends, red flags, or wins with specific numbers.']).join('\n');
    case 'report':
      return base.concat(['This call is a full monthly/weekly report.  Summarize income, spending by category, investments, goals and next 3 action items.']).join('\n');
    case 'question':
    default:
      return base.concat(['This call is a specific user question.  Answer directly, factually, using the provided context when relevant.']).join('\n');
  }
}

function buildUserPrompt(type: ReqType, question: string | undefined, contextJson: string): string {
  const q = question?.trim() ? question.trim() : 'Please summarize the provided financial context.';
  switch (type) {
    case 'dashboard':
      return `=== DASHBOARD CONTEXT (JSON) ===\n${contextJson}\n\n=== INSTRUCTION ===\nProduce a dashboard snapshot based strictly on the JSON above.  Highlight totals, biggest categories, and anything unusual.`;
    case 'insights':
      return `=== INSIGHTS CONTEXT (JSON) ===\n${contextJson}\n\n=== INSTRUCTION ===\nList 3–5 insights with specific numbers from the JSON.  If data is insufficient, say so instead of guessing.`;
    case 'report':
      return `=== FULL REPORT CONTEXT (JSON) ===\n${contextJson}\n\n=== INSTRUCTION ===\nWrite a structured personal finance report: totals, top 3 categories, performance vs goals, investment recap, 3 recommended next steps.`;
    case 'question':
    default:
      return `=== QUESTION ===\n${q}\n\n=== PROVIDED CONTEXT (if any, JSON) ===\n${contextJson}\n\n=== INSTRUCTION ===\nAnswer the question above, using the context JSON as primary data when relevant.  Keep it practical and Rupee-specific.`;
  }
}

// ── Minimal Groq client (no SDK needed — standard fetch, one JSON payload) ──
interface GroqChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }

async function callGroqChat(
  apiKey: string,
  messages: GroqChatMessage[],
): Promise<{ text: string; model: string }> {
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  const body = {
    model: MODEL,
    messages,
    max_tokens: MAX_TOKENS_ANSWER,
    temperature: TEMPERATURE,
    stream: false,
  };

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error('[groq] network call failed', err);
    throw new HttpsError('internal', 'Could not reach the AI provider.  Please try again in a moment.');
  }

  if (res.status === 401 || res.status === 403) {
    throw new HttpsError('failed-precondition', 'AI provider key is invalid.  Ask the site owner to check GROQ_API_KEY in Secret Manager.');
  }
  if (res.status === 429) {
    throw new HttpsError('resource-exhausted', 'The AI provider is rate-limiting us right now.  Please retry in 30 seconds.');
  }
  if (res.status >= 400) {
    const txt = await res.text().catch(() => '');
    logger.error(`[groq] upstream HTTP ${res.status}`, txt.slice(0, 400));
    throw new HttpsError('internal', `AI provider returned an error (HTTP ${res.status}).  Please retry.`);
  }

  let data: any;
  try { data = await res.json(); } catch (err) {
    throw new HttpsError('internal', 'AI provider returned a non-JSON response.  Please retry.');
  }

  const content: string | undefined = data?.choices?.[0]?.message?.content;
  const usedModel: string = (data?.model as string) ?? MODEL;
  if (!content || !content.trim()) {
    // Try fallback model once (single retry).
    logger.warn('[groq] primary model returned empty — trying fallback', { usedModel });
    return callGroqChatFallback(apiKey, messages);
  }
  return { text: content.trim(), model: usedModel };
}

async function callGroqChatFallback(
  apiKey: string,
  messages: GroqChatMessage[],
): Promise<{ text: string; model: string }> {
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  const body = {
    model: MODEL_FALLBACK,
    messages,
    max_tokens: MAX_TOKENS_ANSWER,
    temperature: TEMPERATURE,
    stream: false,
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  }).catch((err) => {
    logger.error('[groq] fallback network call failed', err);
    throw new HttpsError('internal', 'Could not reach the AI provider.  Please try again.');
  });
  if (!res.ok) {
    throw new HttpsError('internal', `AI provider failed (HTTP ${res.status}).`);
  }
  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content as string | undefined;
  if (!content || !content.trim()) {
    throw new HttpsError('internal', 'The AI returned an empty answer.  Please retry with a shorter question.');
  }
  return { text: content.trim(), model: (data?.model as string) ?? MODEL_FALLBACK };
}

// ── Public callable function (2nd Gen, asia-south1) ─────────────────────────
export const generateFinanceAI = onCall(
  {
    region: REGION,
    secrets: [GROQ_API_KEY],
    memory: '512MiB',
    timeoutSeconds: 60,
    invoker: 'public', // Firebase automatically gates on Firebase Auth via request.auth
  },
  async (request) => {
    // 1) Auth
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Please sign in to use the AI assistant.');
    }
    const uid = request.auth.uid;

    // Lightly verify the user actually exists (in case of revoked tokens edge-case).
    try { await getAuth().getUser(uid); } catch (_) {
      throw new HttpsError('unauthenticated', 'Invalid session.  Please sign out and sign back in.');
    }

    // 2) Parse & validate input
    const raw = request.data as any ?? {};
    const typeRaw: unknown = raw.type;
    const question: unknown = raw.question;
    const context: unknown = raw.context;

    const allowedTypes: ReqType[] = ['dashboard', 'insights', 'report', 'question'];
    if (typeof typeRaw !== 'string' || !allowedTypes.includes(typeRaw as ReqType)) {
      throw new HttpsError('invalid-argument', `type must be one of: ${allowedTypes.join(', ')}.`);
    }
    const type = typeRaw as ReqType;

    if (question !== undefined && (typeof question !== 'string' || question.length > 1500)) {
      throw new HttpsError('invalid-argument', 'question must be a string under 1500 characters.');
    }
    const qStr = typeof question === 'string' ? question : undefined;

    let contextObj: Record<string, unknown> = {};
    if (context !== undefined) {
      if (typeof context === 'object' && context !== null) {
        contextObj = context as Record<string, unknown>;
      } else {
        throw new HttpsError('invalid-argument', 'context must be a JSON object.');
      }
    }

    // 3) Daily rate limit (fails with resource-exhausted if user exceeds 60/day)
    await checkAndIncrementQuota(uid);

    // 4) Build prompts
    const apiKey = process.env.GROQ_API_KEY ?? (GROQ_API_KEY.value() as string | undefined);
    if (!apiKey || !/^gsk_/.test(apiKey)) {
      logger.error('[groq] GROQ_API_KEY not set or not starting with gsk_');
      throw new HttpsError(
        'failed-precondition',
        'The AI is not configured yet.  The site owner must set GROQ_API_KEY in Firebase Secret Manager.',
      );
    }

    const contextJson = truncateContext(contextObj);
    const system = buildSystemPrompt(type);
    const user   = buildUserPrompt(type, qStr, contextJson);
    const messages: GroqChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user',   content: user },
    ];

    // 5) Call Groq (primary model, automatic fallback to smaller model once)
    logger.info('[groq] calling upstream', { uid, type, model: MODEL, qLen: (qStr ?? '').length, ctxLen: contextJson.length });
    const { text, model } = await callGroqChat(apiKey, messages);
    logger.info('[groq] success', { uid, type, model, textLen: text.length });

    // 6) Return exact shape the client expects (GroqCallResult)
    return { text, model };
  },
);

// Also export a plain alias so `import { generateFinanceAI } from './groqFunction'`
// works identically to all other function re-exports in index.ts.
export default generateFinanceAI;
