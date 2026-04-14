import { generateRuleBasedBriefing } from '../utils/portfolioAIBriefing';
import type { PortfolioAIContext } from '../utils/portfolioAIContext';

export async function requestPortfolioAIAnalysis(
  context: PortfolioAIContext,
  question?: string,
): Promise<{ text: string; source: 'openai' | 'gemini' | 'local' }> {
  const fallback = generateRuleBasedBriefing(context);
  const url = import.meta.env.VITE_PORTFOLIO_AI_URL ?? '/.netlify/functions/portfolio-ai';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, question }),
    });
    if (!res.ok) return { text: fallback, source: 'local' };
    const data = (await res.json()) as {
      text?: string | null;
      provider?: 'openai' | 'gemini' | string;
    };
    if (data.text && data.text.trim())
      return {
        text: data.text.trim(),
        source: data.provider === 'gemini' ? 'gemini' : 'openai',
      };
  } catch {
    // local fallback below
  }
  return { text: fallback, source: 'local' };
}

