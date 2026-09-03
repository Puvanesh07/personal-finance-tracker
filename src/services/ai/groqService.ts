/**
 * src/services/ai/groqService.ts
 *
 * Direct Groq API client — calls https://api.groq.com/openai/v1/chat/completions
 * with the API key from VITE_GROQ_API_KEY (never shipped to or stored in
 * Firebase Secret Manager).
 *
 * Request shape (used by aiService.ts):
 *   { messages: Array<{role, content> } }
 *
 * Response shape:
 *   { text: string, model: string }
 */

export interface GroqCallRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export interface GroqCallResult {
  text: string;
  model: string;
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'qwen/qwen3.6-27b';
const MODEL_FALLBACK = 'qwen/qwen3.6-27b';
const MAX_TOKENS = 450;
const TEMPERATURE = 0.2;

async function callGroq(messages: GroqCallRequest['messages']): Promise<GroqCallResult> {
  if (!GROQ_API_KEY) {
    throw new Error('AI is not configured. Set VITE_GROQ_API_KEY in .env.local');
  }

  const body = {
    model: MODEL,
    messages,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    stream: false,
  };

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('AI provider key is invalid. Check VITE_GROQ_API_KEY.');
  }
  if (res.status === 429) {
    throw new Error('AI provider is rate-limiting. Please retry in 30 seconds.');
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`AI provider error (HTTP ${res.status}): ${txt.slice(0, 200)}`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error('AI provider returned a non-JSON response. Please retry.');
  }

  const content: string | undefined = data?.choices?.[0]?.message?.content;
  const usedModel: string = (data?.model as string) ?? MODEL;
  if (!content || !content.trim()) {
    return callGroqFallback(messages);
  }
  return { text: content.trim(), model: usedModel };
}

async function callGroqFallback(messages: GroqCallRequest['messages']): Promise<GroqCallResult> {
  const body = {
    model: MODEL_FALLBACK,
    messages,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    stream: false,
  };
  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`AI provider failed (HTTP ${res.status}).`);
  }
  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content as string | undefined;
  if (!content || !content.trim()) {
    throw new Error('The AI returned an empty answer. Please retry with a shorter question.');
  }
  return { text: content.trim(), model: (data?.model as string) ?? MODEL_FALLBACK };
}

export async function callGroqDirect(req: GroqCallRequest): Promise<GroqCallResult> {
  return callGroq(req.messages);
}
