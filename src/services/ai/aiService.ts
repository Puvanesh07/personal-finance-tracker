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

// ─── Shared system rules (applied to every request) ───────────────────────────

const SYSTEM_RULES = `
You are the FinTrackly AI Coach — a proactive, concise personal finance assistant built into the FinTrackly app.

SCOPE RULES (strictly enforced):
1. Only answer questions about personal finance, the user's FinTrackly data, and FinTrackly app features.
2. If the question is about anything else (cooking, sports, coding, news, entertainment, relationships, etc.) — reply with exactly: "I can only help with FinTrackly and personal finance topics."
3. Never answer general knowledge, trivia, or non-finance questions even if they seem harmless.

DATA RULES (strictly enforced):
4. Every number you mention MUST come from the JSON context provided. Never invent, estimate, or round numbers.
5. If a specific number is missing from the context, say "I don't have that data — check the app." Do not guess.
6. Always use exact ₹ values from the JSON (e.g. ₹37,000 not "around ₹40,000").

COACHING RULES:
7. When the user asks "what should I do", "any advice", "how am I doing", or similar — act as a proactive coach:
   a. State the key numbers from the context (income, expenses, surplus, savings rate).
   b. Give 2–4 specific, actionable recommendations using the actual surplus amount from the JSON.
   c. Reference the user's actual goals and emergency fund data when making recommendations.
   d. Prioritise: overdue payments first, then high-interest debt, then goals, then investments.
8. Recommendations must reference real data — use goal names, actual ₹ amounts, real payment titles from the JSON.

RESPONSE FORMAT RULES:
9. Keep replies SHORT. Use this structure for coaching answers:
   - 1–2 lines of key numbers (income, expenses, surplus)
   - A short "Recommended:" bullet list (3–5 items max with ₹ amounts)
   - 1 line with savings rate or key metric
10. For factual questions (not coaching): 2–3 sentences max. Start directly — no "Sure!" or "Great question!".
11. Use ₹ for all money. Use bullet points only for lists. No long paragraphs.
12. Never give SEBI/RBI registered buy/sell advice. Say "consider a SEBI advisor" for stock picks.
`.trim();

function truncateContext(ctx: string): string {
  if (ctx.length <= MAX_CONTEXT_CHARS) return ctx;
  return ctx.slice(0, MAX_CONTEXT_CHARS) + `\n… [truncated, original ${ctx.length} chars]`;
}

function buildSystemPrompt(type: AiServiceRequest['type']): string {
  const taskLine: Record<AiServiceRequest['type'], string> = {
    dashboard: 'TASK: Give a 4–5 bullet financial snapshot using only numbers from the JSON. No explanations.',
    insights:  'TASK: Give 3 concrete insights, one sentence each, with exact ₹ numbers from the JSON.',
    report:    'TASK: Short report using only JSON data — income, top 3 expense categories, investment P&L, goal progress. Bullets only.',
    question:  'TASK: Answer the question using the JSON context. Use the coaching rules above when the user asks for advice or "what to do".',
  };
  return `${SYSTEM_RULES}\n\n${taskLine[type]}`;
}

/** Detect if the question is a coaching/advice intent */
function isCoachingQuestion(q: string): boolean {
  return /what should i|what to do|any advice|how am i doing|am i on track|what.*this month|recommend|should i focus|how.*performing|financial health|what.*suggest/i.test(q);
}

function buildUserPrompt(
  type: AiServiceRequest['type'],
  question: string | undefined,
  contextJson: string,
): string {
  const q = question?.trim() || 'Summarise my financial situation.';

  switch (type) {
    case 'dashboard':
      return `DATA:\n${contextJson}\n\nGive a 4–5 bullet snapshot. Numbers only.`;

    case 'insights':
      return `DATA:\n${contextJson}\n\nList 3 insights with exact ₹ numbers. One sentence each.`;

    case 'report':
      return `DATA:\n${contextJson}\n\nShort report: income, top expenses, investment P&L, goal progress. Bullets only.`;

    case 'question':
    default: {
      if (isCoachingQuestion(q)) {
        // Coaching prompt — tell Groq exactly how to structure the answer
        return `USER QUESTION: ${q}

FINTRACKLY DATA (use ONLY these numbers — do not invent any):
${contextJson}

INSTRUCTIONS:
- Line 1: "Your income this month is ₹[cashflow.thisMonthIncome] and expenses are ₹[cashflow.thisMonthExpense]."
- Line 2: "You have ₹[cashflow.monthlySurplus] available." (use summary.monthlySurplus if cashflow missing)
- Section "Recommended:" with 3–4 bullets allocating the actual surplus to:
  • Any overdue payments (from payments.items where overdue=true) — pay these first
  • High-interest liabilities (from liabilities array, highest interestRate first)
  • Emergency fund (from emergencyFund.target and emergencyFund.current — show gap)
  • Active goals (from goals array — use real goal names and remaining amounts)
  • Investments — suggest amount only if surplus permits after above
- Final line: "Your savings rate is [summary.savingsRatePct]%."
- If any field is missing/zero, skip that recommendation silently.
- Use exact numbers from the JSON. Round to nearest ₹100 only if the number has many decimal places.`;
      }

      // Regular factual question
      return `QUESTION: ${q}

FINTRACKLY DATA (JSON):
${contextJson}

Answer in 2–3 sentences using exact numbers from the JSON. Be direct.`;
    }
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
