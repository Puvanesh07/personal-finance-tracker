import { formatINR } from './format';
import type { PortfolioAIContext } from './portfolioAIContext';

export function generateRuleBasedBriefing(ctx: PortfolioAIContext): string {
  const lines: string[] = [];
  lines.push('## Portfolio briefing');
  lines.push(
    `**Net worth**: ${formatINR(ctx.netWorth)} (Assets ${formatINR(ctx.totalAssets)}, Liabilities ${formatINR(ctx.totalLiabilities)}).`,
  );
  lines.push(`**Health score**: ${ctx.healthScore}/100.`);
  lines.push('### Strengths');
  if (ctx.monthlySurplus > 0)
    lines.push(`- Positive monthly surplus of ${formatINR(ctx.monthlySurplus)}.`);
  if (ctx.equityPct >= 40 && ctx.equityPct <= 80)
    lines.push(`- Equity allocation around ${ctx.equityPct.toFixed(1)}% is balanced for growth.`);
  if (ctx.goalsCompleted > 0)
    lines.push(`- Completed goals: ${ctx.goalsCompleted}.`);
  lines.push('### Risks');
  if (ctx.monthlySurplus < 0)
    lines.push(`- Expenses exceed income by ${formatINR(Math.abs(ctx.monthlySurplus))} per month.`);
  if (ctx.emergencyTarget > 0 && ctx.emergencyCurrent < ctx.emergencyTarget)
    lines.push(
      `- Emergency fund is ${formatINR(ctx.emergencyCurrent)} vs target ${formatINR(ctx.emergencyTarget)}.`,
    );
  if (ctx.equityPct > 85) lines.push('- High equity concentration can increase volatility.');
  lines.push('### Suggested next steps');
  lines.push('- Automate SIP / recurring investments from monthly surplus.');
  lines.push('- Keep a 3-6 month emergency reserve in liquid instruments.');
  lines.push('- Review allocation and rebalance at least once per year.');
  lines.push('Not personalized investment advice; for education only.');
  return lines.join('\n');
}

