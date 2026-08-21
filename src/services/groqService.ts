/**
 * src/services/groqService.ts
 *
 * All Groq requests go through the Firebase Cloud Function `generateFinanceAI`.
 * The GROQ_API_KEY lives exclusively in Firebase Secret Manager — it is never
 * sent to or stored in the browser.
 *
 * Cloud Function signature:
 *   request  : { type: 'dashboard'|'insights'|'report'|'question', question?, context }
 *   response : { text: string, model: string }
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

export interface GroqCallRequest {
  type: 'dashboard' | 'insights' | 'report' | 'question';
  question?: string;
  context: Record<string, unknown>;
}

export interface GroqCallResult {
  text: string;
  model: string;
}

// Lazily initialise the functions client (region must match the deployment).
let _fn: ReturnType<typeof httpsCallable> | null = null;

function getGenerateFinanceAI() {
  if (!_fn) {
    const functions = getFunctions(app, 'asia-south1');
    _fn = httpsCallable(functions, 'generateFinanceAI');
  }
  return _fn;
}

/**
 * Call the `generateFinanceAI` Cloud Function.
 *
 * The function validates auth, compacts the context server-side, calls Groq
 * with the key from Secret Manager, and returns the AI text.
 *
 * Throws a descriptive Error on failure — callers handle the message.
 */
export async function callGroqViaFunction(
  req: GroqCallRequest,
): Promise<GroqCallResult> {
  const fn = getGenerateFinanceAI();
  const result = await fn(req);
  const data = result.data as { text?: string; model?: string };

  if (!data?.text?.trim()) {
    throw new Error('The AI returned an empty response. Please try again.');
  }

  return { text: data.text.trim(), model: data.model ?? 'unknown' };
}
