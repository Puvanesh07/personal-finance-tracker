/**
 * src/services/ai/aiService.ts
 *
 * High-level AI service used by the frontend.
 *   - Receives Fintrackly data context
 *   - Builds system + user prompts
 *   - Calls groqService (direct to Groq)
 *   - Returns { text, model }
 *
 * Pages call only: generateFinancialAI(data, question)
 */

import { callGroqDirect } from './groqService';
import type { GroqCallResult } from './groqService';

export interface FinancialData {
  summary?: Record<string, unknown>;
  investments?: Record<string, unknown>;
  cashflow?: Record<string, unknown>;
  liabilities?: unknown[];
  payments?: Record<string, unknown>;
  goals?: unknown[];
  insurance?: Record<string, unknown>;
  accounts?: Record<string, unknown>;
  lending?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AiServiceRequest {
  type: 'dashboard' | 'insights' | 'report' | 'question';
  question?: string;
  context: FinancialData;
}

const MAX_CONTEXT_CHARS = 16_000;

// ─── Strict FinTrackly scope rules ────────────────────────────────────────────
// Applied to every request — never overridden by per-type additions.

const SYSTEM_RULES = `
You are the FinTrackly AI Coach — a concise personal finance assistant built into the FinTrackly app.

SCOPE RULES (strictly enforced):
1. Only answer questions about personal finance, the user's FinTrackly data, and FinTrackly app features.
2. If the question is about anything else (cooking, sports, coding, news, entertainment, relationships, etc.) — reply with exactly: "I can only help with FinTrackly and personal finance topics."
3. Never answer general knowledge, trivia, or non-finance questions even if they seem harmless.

RESPONSE RULES (strictly enforced):
4. Keep every reply SHORT — 2 to 4 sentences maximum for simple questions.
5. Use a short bullet list (3–5 items max) ONLY when listing multiple distinct items.
6. Never write long paragraphs, introductions, summaries, or conclusions.
7. Never say "Great question!", "Sure!", "Absolutely!", "Of course!" or similar filler phrases.
8. Start directly with the answer — no preamble.
9. Use ₹ (Indian Rupees) for all money values.
10. Never give SEBI/RBI-registered investment advice. Say "consider consulting a SEBI advisor" if asked for specific buy/sell calls.
11. Never hallucinate numbers. If data is missing from context, say "I don't have that data — check the app directly."
12. Do not suggest actions outside FinTrackly (e.g. "open your bank app", "call your broker").
`.trim();

function truncateContext(ctx: string): string {
  if (ctx.length <= MAX_CONTEXT_CHARS) return ctx;
  return ctx.slice(0, MAX_CONTEXT_CHARS) + `\n… [truncated, original ${ctx.length} chars]`;
}

function buildSystemPrompt(type: AiServiceRequest['type']): string {
  const extras: Record<AiServiceRequest['type'], string> = {
    dashboard: 'Produce a 4–5 bullet financial snapshot from the JSON data. Numbers only — no explanation.',
    insights:  'Give 3 concrete insights with specific ₹ numbers from the JSON. One sentence each.',
    report:    'Summarise: total income, top 3 expense categories, investment P&L, goal progress. Use short bullets.',
    question:  'Answer the question directly using the JSON context. 2–3 sentences max.',
  };
  return `${SYSTEM_RULES}\n\nTASK: ${extras[type]}`;
}

function buildUserPrompt(type: AiServiceRequest['type'], question: string | undefined, contextJson: string): string {
  const q = question?.trim() || 'Summarise the financial context.';
  switch (type) {
    case 'dashboard':
      return `DATA:\n${contextJson}\n\nGive a 4–5 bullet snapshot. Be brief.`;
    case 'insights':
      return `DATA:\n${contextJson}\n\nList 3 insights with specific numbers. One sentence each.`;
    case 'report':
      return `DATA:\n${contextJson}\n\nShort report: income, top expenses, investment P&L, goal progress. Bullets only.`;
    case 'question':
    default:
      return `QUESTION: ${q}\n\nCONTEXT (JSON, use if relevant):\n${contextJson}\n\nAnswer in 2–3 sentences. Be direct and specific.`;
  }
}

/**
 * Main entry point for AI analysis.
 * Accepts the Fintrackly data snapshot (built by buildAgentContext),
 * an optional question, and a type that shapes the prompt.
 */
export async function generateFinancialAI(
  req: AiServiceRequest,
): Promise<GroqCallResult> {
  const { type, question, context } = req;

  const contextJson = truncateContext(JSON.stringify(context));
  const system = buildSystemPrompt(type);
  const user = buildUserPrompt(type, question, contextJson);

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: system },
    { role: 'user',   content: user },
  ];

  return callGroqDirect({ messages });
}
