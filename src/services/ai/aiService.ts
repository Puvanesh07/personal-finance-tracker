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

const MAX_CONTEXT_CHARS = 24_000;

function truncateContext(ctx: string): string {
  if (ctx.length <= MAX_CONTEXT_CHARS) return ctx;
  return ctx.slice(0, MAX_CONTEXT_CHARS) + `\n… [truncated, original ${ctx.length} chars]`;
}

function buildSystemPrompt(type: AiServiceRequest['type']): string {
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

function buildUserPrompt(type: AiServiceRequest['type'], question: string | undefined, contextJson: string): string {
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
