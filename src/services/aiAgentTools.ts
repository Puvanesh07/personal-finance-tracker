/**
 * src/services/aiAgentTools.ts
 *
 * The FinTrackly AI tool registry.
 *
 * Every tool reads from the Zustand store (already loaded from Firebase),
 * calculates with TypeScript, and returns a typed AgentResponse.
 *
 * RULE: Tools never invent numbers, never call Groq, never read Firestore
 *       directly — the store is the single source of truth.
 *
 * The intent router in aiAgentDataFetcher.ts calls the right tool(s)
 * for each question.
 */

import { formatINR, formatNumber } from '../utils/format';
import { calculateNetWorth, investedValue, currentValue } from '../utils/calculations';
import { usePortfolioStore } from '../store/portfolioStore';
import { useAgriStore } from '../store/agricultureStore';
import type { StockInvestment, MutualFundInvestment } from '../types/investmentTypes';
import type {
  AgentResponse,
  StatItem,
  CardItem,
  Severity,
} from './aiAgentResponseTypes';
import { emptyResponse } from './aiAgentResponseTypes';

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function monthlyAvg(
  entries: { type: string; amount: number; date: string }[],
  type: 'income' | 'expense',
): number {
  const rows = entries.filter((e) => e.type === type);
  if (!rows.length) return 0;
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const months = new Set(rows.map((r) => r.date.slice(0, 7))).size || 1;
  return total / months;
}

function plSign(n: number): string { return n >= 0 ? '+' : ''; }
function plSeverity(n: number): Severity { return n >= 0 ? 'good' : 'danger'; }
function debtSeverity(ratio: number): Severity {
  return ratio < 0.3 ? 'good' : ratio < 0.6 ? 'warning' : 'danger';
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function inDaysISO(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function goalSaved(
  g: { id: string; currentAmount: number },
  contribs: { goalId: string; amount: number }[],
): number {
  return g.currentAmount + contribs.filter((c) => c.goalId === g.id).reduce((a, c) => a + c.amount, 0);
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

export function getFinancialOverview(): AgentResponse {
  const {
    investments, liabilities, cashflows, goals,
    trackedPayments, insurancePolicies,
  } = usePortfolioStore.getState();

  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(investments, liabilities);
  const avgIncome   = monthlyAvg(cashflows, 'income');
  const avgExpense  = monthlyAvg(cashflows, 'expense');
  const surplus     = avgIncome - avgExpense;
  const savingsRate = avgIncome > 0 ? (surplus / avgIncome) * 100 : 0;
  const debtRatio   = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  const today    = todayISO();
  const in7days  = inDaysISO(7);
  const overdue  = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate < today).length;
  const dueWeek  = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate >= today && p.dueDate <= in7days).length;
  const renewing = insurancePolicies.filter((p) => p.renewalDate && p.renewalDate >= today && p.renewalDate <= in7days).length;
  const activeGoals = goals.filter((g) => !g.status || g.status === 'active').length;

  const totalInvested = investments.reduce((a, i) => a + investedValue(i), 0);
  const totalCurrent  = investments.reduce((a, i) => a + currentValue(i), 0);
  const portfolioPL   = totalCurrent - totalInvested;

  const stats: StatItem[] = [
    { label: 'Net Worth',        value: formatINR(netWorth),         severity: netWorth >= 0 ? 'good' : 'danger' },
    { label: 'Total Assets',     value: formatINR(totalAssets),      severity: 'neutral' },
    { label: 'Total Liabilities',value: formatINR(totalLiabilities), severity: totalLiabilities > 0 ? 'warning' : 'good' },
    { label: 'Monthly Income',   value: formatINR(avgIncome),        severity: avgIncome > 0 ? 'good' : 'neutral' },
    { label: 'Monthly Expenses', value: formatINR(avgExpense),       severity: 'neutral' },
    { label: 'Monthly Surplus',  value: `${plSign(surplus)}${formatINR(surplus)}`, severity: surplus >= 0 ? 'good' : 'danger' },
    { label: 'Savings Rate',     value: `${formatNumber(savingsRate, 1)}%`, severity: savingsRate >= 20 ? 'good' : savingsRate >= 10 ? 'warning' : 'danger' },
    { label: 'Debt / Asset',     value: `${formatNumber(debtRatio, 1)}%`,   severity: debtSeverity(debtRatio / 100) },
  ];

  if (investments.length) {
    stats.push({
      label: 'Portfolio P&L',
      value: `${plSign(portfolioPL)}${formatINR(portfolioPL)}`,
      sub: `on ${formatINR(totalInvested)} invested`,
      severity: plSeverity(portfolioPL),
    });
  }

  if (activeGoals) {
    stats.push({ label: 'Active Goals', value: `${activeGoals}`, severity: 'info' });
  }

  const alerts: { emoji: string; text: string; severity: Severity }[] = [];
  if (overdue)   alerts.push({ emoji: '⚠️', text: `${overdue} overdue payment(s)`,                severity: 'danger' });
  if (dueWeek)   alerts.push({ emoji: '🔔', text: `${dueWeek} payment(s) due this week`,           severity: 'warning' });
  if (renewing)  alerts.push({ emoji: '🛡️', text: `${renewing} insurance renewal(s) within 7 days`, severity: 'warning' });
  if (debtRatio > 60) alerts.push({ emoji: '🔴', text: `High debt-to-asset ratio (${formatNumber(debtRatio, 1)}%)`, severity: 'danger' });
  if (savingsRate < 10 && avgIncome > 0) alerts.push({ emoji: '⚠️', text: `Low savings rate (${formatNumber(savingsRate, 1)}%)`, severity: 'warning' });

  return {
    kind: 'stat_grid',
    title: 'Financial Overview',
    emoji: '🧠',
    stats,
    alerts: alerts.length ? alerts : undefined,
    footer: 'All data from your FinTrackly records.',
  };
}

// ─── NET WORTH ────────────────────────────────────────────────────────────────

export function getNetWorth(): AgentResponse {
  const { investments, liabilities } = usePortfolioStore.getState();
  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(investments, liabilities);

  if (totalAssets === 0 && totalLiabilities === 0) {
    return emptyResponse('No financial data yet.', 'Add investments and liabilities to see your net worth.');
  }

  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  return {
    kind: 'card',
    title: 'Your Net Worth',
    emoji: '💰',
    stats: [
      { label: 'Net Worth',          value: formatINR(netWorth),         severity: netWorth >= 0 ? 'good' : 'danger' },
      { label: 'Total Assets',       value: formatINR(totalAssets),      severity: 'neutral' },
      { label: 'Total Liabilities',  value: formatINR(totalLiabilities), severity: totalLiabilities > 0 ? 'warning' : 'good' },
      { label: 'Debt-to-Asset Ratio',value: `${formatNumber(debtRatio, 1)}%`, severity: debtSeverity(debtRatio / 100) },
    ],
    footer: 'From your FinTrackly Investments and Liabilities.',
  };
}

// ─── PORTFOLIO ────────────────────────────────────────────────────────────────

function stocksWithPL() {
  const { investments } = usePortfolioStore.getState();
  return investments
    .filter((i): i is StockInvestment => i.type === 'stock')
    .map((s) => {
      const iv = s.quantity * s.buyPrice;
      const cv = s.quantity * s.currentPrice;
      const pl = cv - iv;
      const plPct = iv > 0 ? (pl / iv) * 100 : 0;
      return { name: s.name, symbol: s.symbol ?? s.name, iv, cv, pl, plPct, sector: s.sector, platform: s.platform };
    });
}

function mfsWithPL() {
  const { investments } = usePortfolioStore.getState();
  return investments
    .filter((i): i is MutualFundInvestment => i.type === 'mutual_fund')
    .map((m) => {
      const cv    = m.units * m.nav;
      const pl    = cv - m.investedAmount;
      const plPct = m.investedAmount > 0 ? (pl / m.investedAmount) * 100 : 0;
      return { name: m.name, symbol: m.name, iv: m.investedAmount, cv, pl, plPct };
    });
}

export function getPortfolioSummary(): AgentResponse {
  const { investments } = usePortfolioStore.getState();
  if (!investments.length) return emptyResponse('No investments recorded yet.', 'Add some in the Investments module.');

  const totalInvested = investments.reduce((a, i) => a + investedValue(i), 0);
  const totalCurrent  = investments.reduce((a, i) => a + currentValue(i), 0);
  const totalPL       = totalCurrent - totalInvested;
  const plPct         = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  const stocks = investments.filter((i) => i.type === 'stock');
  const mfs    = investments.filter((i) => i.type === 'mutual_fund');
  const fds    = investments.filter((i) => i.type === 'fixed_deposit' || i.type === 'bond');
  const others = investments.filter((i) => i.type === 'other');

  const sPL   = stocksWithPL().sort((a, b) => b.plPct - a.plPct);
  const mfPL  = mfsWithPL().sort((a, b) => b.plPct - a.plPct);

  const stats: StatItem[] = [
    { label: 'Total Invested',  value: formatINR(totalInvested), severity: 'neutral' },
    { label: 'Current Value',   value: formatINR(totalCurrent),  severity: 'neutral' },
    { label: 'Overall P&L',     value: `${plSign(totalPL)}${formatINR(totalPL)}`, sub: `${plSign(plPct)}${formatNumber(plPct, 2)}%`, severity: plSeverity(totalPL) },
    { label: 'Stocks',          value: `${stocks.length} holdings`, severity: 'neutral' },
    { label: 'Mutual Funds',    value: `${mfs.length} funds`,        severity: 'neutral' },
    { label: 'FDs / Bonds',     value: `${fds.length}`,              severity: 'neutral' },
    { label: 'Other Assets',    value: `${others.length}`,           severity: 'neutral' },
  ];

  if (sPL[0]) stats.push({ label: 'Best Stock',   value: sPL[0].symbol,              sub: `${plSign(sPL[0].plPct)}${formatNumber(sPL[0].plPct, 1)}%`, severity: 'good' });
  if (sPL[sPL.length - 1] && sPL.length > 1 && sPL[sPL.length - 1].pl < 0)
    stats.push({ label: 'Biggest Loss', value: sPL[sPL.length - 1].symbol, sub: `${formatNumber(sPL[sPL.length - 1].plPct, 1)}%`, severity: 'danger' });
  if (mfPL[0]) stats.push({ label: 'Top Fund',    value: mfPL[0].name.slice(0, 22),  sub: `${plSign(mfPL[0].plPct)}${formatNumber(mfPL[0].plPct, 1)}%`, severity: plSeverity(mfPL[0].pl) });

  return {
    kind: 'stat_grid',
    title: 'Portfolio Summary',
    emoji: '📈',
    stats,
    footer: 'From your FinTrackly portfolio.',
  };
}

export function getLosingInvestments(): AgentResponse {
  const all  = [...stocksWithPL(), ...mfsWithPL()].filter((i) => i.pl < 0).sort((a, b) => a.pl - b.pl);
  if (!all.length) return { kind: 'empty', emoji: '✅', message: 'None of your investments are currently in a loss.' };

  const items: CardItem[] = all.map((i) => ({
    emoji: '📉',
    title: i.symbol,
    value: `${formatNumber(i.plPct, 1)}%`,
    subtitle: `${formatINR(i.iv)} → ${formatINR(i.cv)}`,
    valueSub: `Loss: ${formatINR(Math.abs(i.pl))}`,
    severity: 'danger',
    linkTo: '/investments',
  }));

  return {
    kind: 'list_card',
    title: 'Investments in Loss',
    emoji: '📉',
    summary: `${all.length} investment(s) currently at a loss.`,
    items,
    footer: 'From your FinTrackly portfolio.',
  };
}

export function getTopInvestments(): AgentResponse {
  const all = [...stocksWithPL(), ...mfsWithPL()].filter((i) => i.pl > 0).sort((a, b) => b.pl - a.pl);
  if (!all.length) return { kind: 'empty', emoji: '📭', message: 'No investments currently in profit.' };

  const items: CardItem[] = all.slice(0, 10).map((i) => ({
    emoji: '🏆',
    title: i.symbol,
    value: `${plSign(i.plPct)}${formatNumber(i.plPct, 1)}%`,
    subtitle: `${formatINR(i.iv)} → ${formatINR(i.cv)}`,
    valueSub: `Profit: ${formatINR(i.pl)}`,
    severity: 'good',
    linkTo: '/investments',
  }));

  return {
    kind: 'list_card',
    title: 'Best Performing Investments',
    emoji: '🏆',
    summary: `${all.length} investment(s) currently in profit.`,
    items,
    footer: 'From your FinTrackly portfolio.',
  };
}

export function getInvestmentBySymbol(symbol: string): AgentResponse {
  const { investments } = usePortfolioStore.getState();
  const upper   = symbol.toUpperCase();
  const matches = investments.filter((inv) =>
    (inv.symbol ?? '').toUpperCase().includes(upper) ||
    (inv.name ?? '').toUpperCase().includes(upper),
  );

  if (!matches.length) {
    return emptyResponse(
      `No investment matching "${symbol}" found.`,
      'Check the Investments page for the exact name or ticker.',
    );
  }

  const items: CardItem[] = matches.map((inv) => {
    const iv = investedValue(inv);
    const cv = currentValue(inv);
    const pl = cv - iv;
    const pp = iv > 0 ? (pl / iv) * 100 : 0;

    if (inv.type === 'stock') {
      const s = inv as StockInvestment;
      return {
        emoji: '📈',
        title: `${s.name}${s.symbol && s.symbol !== s.name ? ` (${s.symbol})` : ''}`,
        subtitle: `${formatNumber(s.quantity, 2)} shares · Buy ₹${formatNumber(s.buyPrice, 2)} · Now ₹${formatNumber(s.currentPrice, 2)}${s.sector ? ` · ${s.sector}` : ''}`,
        value: `${plSign(pp)}${formatNumber(pp, 1)}%`,
        valueSub: `${plSign(pl)}${formatINR(pl)}`,
        severity: plSeverity(pl),
        linkTo: '/investments',
      };
    }

    if (inv.type === 'mutual_fund') {
      const m = inv as MutualFundInvestment;
      return {
        emoji: '🏦',
        title: m.name,
        subtitle: `${formatNumber(m.units, 3)} units · NAV ${formatINR(m.nav)}`,
        value: `${plSign(pp)}${formatNumber(pp, 1)}%`,
        valueSub: `${plSign(pl)}${formatINR(pl)}`,
        severity: plSeverity(pl),
        linkTo: '/investments',
      };
    }

    return {
      emoji: '💼',
      title: inv.name,
      subtitle: inv.type.replace('_', ' '),
      value: `${plSign(pp)}${formatNumber(pp, 1)}%`,
      valueSub: `${plSign(pl)}${formatINR(pl)}`,
      severity: plSeverity(pl),
      linkTo: '/investments',
    };
  });

  return {
    kind: 'list_card',
    title: `${symbol} — Your Holdings`,
    emoji: '🔍',
    items,
    footer: matches.length > 1 ? `${matches.length} matching holdings found.` : 'From your FinTrackly portfolio.',
  };
}

export function getPortfolioProfitableCount(): AgentResponse {
  const all  = [...stocksWithPL(), ...mfsWithPL()];
  if (!all.length) return emptyResponse('No investments recorded yet.');
  const profit  = all.filter((i) => i.pl > 0).length;
  const loss    = all.filter((i) => i.pl < 0).length;
  const neutral = all.filter((i) => i.pl === 0).length;
  return {
    kind: 'stat_grid',
    title: 'Profitable vs Loss Count',
    emoji: '📊',
    stats: [
      { label: '✅ In Profit',   value: `${profit}`,  severity: 'good' },
      { label: '📉 In Loss',     value: `${loss}`,    severity: loss > 0 ? 'danger' : 'neutral' },
      { label: '➖ Break Even',  value: `${neutral}`, severity: 'neutral' },
      { label: 'Total',          value: `${all.length}`, severity: 'neutral' },
    ],
    footer: 'From your FinTrackly portfolio.',
  };
}

export function getPortfolioSectors(): AgentResponse {
  const { investments } = usePortfolioStore.getState();
  const stocks = investments.filter((i): i is StockInvestment => i.type === 'stock');
  if (!stocks.length) return emptyResponse('No stock holdings found.');

  const totalValue = stocks.reduce((a, s) => a + s.quantity * s.currentPrice, 0);
  const sectorMap  = stocks.reduce((acc, s) => {
    const key = (s.sector || 'Unknown').trim();
    acc[key]  = (acc[key] ?? 0) + s.quantity * s.currentPrice;
    return acc;
  }, {} as Record<string, number>);

  const rows = Object.entries(sectorMap)
    .sort((a, b) => b[1] - a[1])
    .map((([sector, val]) => ({
      cells: [sector, formatINR(val), `${formatNumber((val / totalValue) * 100, 1)}%`],
    })));

  const topSector = rows[0]?.cells[0] ?? '';
  const topPct    = parseFloat(rows[0]?.cells[2] ?? '0');

  return {
    kind: 'table',
    title: 'Portfolio by Sector',
    emoji: '🧩',
    headers: ['Sector', 'Value', 'Share'],
    rows,
    summary: `Total equity: ${formatINR(totalValue)} across ${rows.length} sector(s).`,
    footer: topPct > 40
      ? `⚠️ ${topSector} makes up ${rows[0].cells[2]} — consider diversifying.`
      : '✅ Sector concentration looks balanced.',
  };
}

// ─── CASHFLOW ─────────────────────────────────────────────────────────────────

export function getCashflowSummary(dateScope?: 'today' | 'this_week' | 'this_month'): AgentResponse {
  const { cashflows } = usePortfolioStore.getState();
  if (!cashflows.length) return emptyResponse('No cashflow entries yet.', 'Add income and expenses in the Cashflow module.');

  if (dateScope === 'today') {
    const today   = todayISO();
    const entries = cashflows.filter((e) => e.date === today);
    if (!entries.length) return emptyResponse(`No entries for today (${today}).`, 'Add some in the Cashflow module.');
    const inc = entries.filter((e) => e.type === 'income');
    const exp = entries.filter((e) => e.type === 'expense');
    const tInc = inc.reduce((a, e) => a + e.amount, 0);
    const tExp = exp.reduce((a, e) => a + e.amount, 0);
    const sur  = tInc - tExp;

    const items: CardItem[] = [
      ...inc.map((e) => ({ emoji: '💰', title: e.category, subtitle: e.notes ?? undefined, value: formatINR(e.amount), severity: 'good' as Severity })),
      ...exp.map((e) => ({ emoji: '💸', title: e.category, subtitle: e.notes ?? undefined, value: `-${formatINR(e.amount)}`, severity: 'danger' as Severity })),
    ];
    return {
      kind: 'list_card',
      title: `Today's Cashflow — ${today}`,
      emoji: '📅',
      summary: `Income: ${formatINR(tInc)} · Expenses: ${formatINR(tExp)} · Surplus: ${plSign(sur)}${formatINR(sur)}`,
      items,
      footer: 'From your FinTrackly Cashflow.',
    };
  }

  if (dateScope === 'this_week') {
    const today   = todayISO();
    const weekAgo = inDaysISO(-6);
    const entries = cashflows.filter((e) => e.date >= weekAgo && e.date <= today);
    if (!entries.length) return emptyResponse(`No cashflow entries this week (${weekAgo} → ${today}).`);
    const tInc = entries.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0);
    const tExp = entries.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0);
    const sur  = tInc - tExp;
    const catMap = entries.filter((e) => e.type === 'expense')
      .reduce((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);
    const rows = Object.entries(catMap).sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => ({ cells: [cat, formatINR(amt), `${formatNumber((amt / tExp) * 100, 0)}%`] }));

    return {
      kind: 'table',
      title: `This Week — ${weekAgo} to ${today}`,
      emoji: '📅',
      summary: `Income: ${formatINR(tInc)} · Expenses: ${formatINR(tExp)} · Surplus: ${plSign(sur)}${formatINR(sur)}`,
      headers: ['Category', 'Amount', 'Share'],
      rows,
      footer: 'From your FinTrackly Cashflow.',
    };
  }

  // Default: monthly average
  const avgIncome   = monthlyAvg(cashflows, 'income');
  const avgExpense  = monthlyAvg(cashflows, 'expense');
  const avgSurplus  = avgIncome - avgExpense;
  const savingsRate = avgIncome > 0 ? (avgSurplus / avgIncome) * 100 : 0;

  const now         = new Date();
  const thisMonth   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisEntries = cashflows.filter((e) => e.date.startsWith(thisMonth));
  const thisIncome  = thisEntries.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const thisExpense = thisEntries.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0);
  const thisSurplus = thisIncome - thisExpense;

  return {
    kind: 'stat_grid',
    title: 'Cashflow Summary',
    emoji: '💸',
    stats: [
      { label: 'Avg Monthly Income',   value: formatINR(avgIncome),   severity: avgIncome > 0 ? 'good' : 'neutral' },
      { label: 'Avg Monthly Expenses', value: formatINR(avgExpense),  severity: 'neutral' },
      { label: 'Avg Monthly Surplus',  value: `${plSign(avgSurplus)}${formatINR(avgSurplus)}`, severity: avgSurplus >= 0 ? 'good' : 'danger' },
      { label: 'Savings Rate',         value: `${formatNumber(savingsRate, 1)}%`, severity: savingsRate >= 20 ? 'good' : savingsRate >= 10 ? 'warning' : 'danger' },
      { label: `${thisMonth} Income`,  value: formatINR(thisIncome),  severity: 'good' },
      { label: `${thisMonth} Expenses`,value: formatINR(thisExpense), severity: 'neutral' },
      { label: `${thisMonth} Surplus`, value: `${plSign(thisSurplus)}${formatINR(thisSurplus)}`, severity: thisSurplus >= 0 ? 'good' : 'danger' },
    ],
    footer: `Based on ${cashflows.length} entries in FinTrackly.`,
  };
}

export function getCashflowCategories(): AgentResponse {
  const { cashflows } = usePortfolioStore.getState();
  const exp    = cashflows.filter((e) => e.type === 'expense');
  if (!exp.length) return emptyResponse('No expense entries recorded yet.');
  const total  = exp.reduce((a, e) => a + e.amount, 0);
  const catMap = exp.reduce((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);
  const rows   = Object.entries(catMap).sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => ({ cells: [cat, formatINR(amt), `${formatNumber((amt / total) * 100, 1)}%`] }));

  return {
    kind: 'table',
    title: 'Spending by Category',
    emoji: '📊',
    summary: `Total expenses recorded: ${formatINR(total)}`,
    headers: ['Category', 'Total Spent', 'Share'],
    rows,
    footer: 'From your FinTrackly Cashflow.',
  };
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

export function getPaymentsDueSoon(days = 30): AgentResponse {
  const { trackedPayments } = usePortfolioStore.getState();
  const today   = todayISO();
  const cutoff  = inDaysISO(days);
  const overdue = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate < today);
  const upcoming= trackedPayments.filter((p) => p.status === 'pending' && p.dueDate >= today && p.dueDate <= cutoff);
  const all     = [...overdue, ...upcoming].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (!all.length) return { kind: 'empty', emoji: '✅', message: `No payments due in the next ${days} days.` };

  const total = all.reduce((a, p) => a + p.amount, 0);
  const items: CardItem[] = all.map((p) => ({
    emoji: p.dueDate < today ? '⚠️' : '🔔',
    title: p.title,
    subtitle: `Due: ${p.dueDate}${p.recurrence !== 'none' ? ` · ${p.recurrence}` : ''}`,
    value: formatINR(p.amount),
    valueSub: p.dueDate < today ? 'Overdue' : undefined,
    severity: p.dueDate < today ? 'danger' : 'warning',
    linkTo: '/payments',
  }));

  return {
    kind: 'list_card',
    title: days === 7 ? 'Payments Due This Week' : 'Upcoming Payments',
    emoji: '🔔',
    summary: `Total: ${formatINR(total)} across ${all.length} payment(s)${overdue.length ? ` · ${overdue.length} overdue` : ''}`,
    items,
    footer: 'From your FinTrackly Payments.',
  };
}

export function getPaymentsOverdue(): AgentResponse {
  const { trackedPayments } = usePortfolioStore.getState();
  const today   = todayISO();
  const overdue = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate < today);
  if (!overdue.length) return { kind: 'empty', emoji: '✅', message: 'No overdue payments — great job!' };

  const total = overdue.reduce((a, p) => a + p.amount, 0);
  const items: CardItem[] = overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((p) => ({
    emoji: '⚠️',
    title: p.title,
    subtitle: `Was due: ${p.dueDate}`,
    value: formatINR(p.amount),
    severity: 'danger',
    linkTo: '/payments',
  }));

  return {
    kind: 'list_card',
    title: 'Overdue Payments',
    emoji: '⚠️',
    summary: `Total overdue: ${formatINR(total)} across ${overdue.length} payment(s)`,
    items,
    footer: 'Pay these as soon as possible.',
  };
}

export function getNextPayment(): AgentResponse {
  const { trackedPayments } = usePortfolioStore.getState();
  const today   = todayISO();
  const pending = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!pending.length) return { kind: 'empty', emoji: '✅', message: 'No upcoming payments found.' };
  const next = pending[0];
  return {
    kind: 'card',
    title: 'Next Due Payment',
    emoji: '🔔',
    badge: next.dueDate,
    stats: [
      { label: 'Payment',    value: next.title },
      { label: 'Amount',     value: formatINR(next.amount), severity: 'warning' },
      { label: 'Due Date',   value: next.dueDate },
      { label: 'Recurrence', value: next.recurrence },
      ...(next.notes ? [{ label: 'Notes', value: next.notes }] : []),
    ],
    footer: pending.length > 1 ? `After that: ${pending[1].title} on ${pending[1].dueDate}` : undefined,
    linkTo: '/payments',
  };
}

// ─── INSURANCE ────────────────────────────────────────────────────────────────

export function getInsuranceSummary(): AgentResponse {
  const { insurancePolicies } = usePortfolioStore.getState();
  if (!insurancePolicies.length) return emptyResponse('No insurance policies recorded.', 'Add your policies in the Insurance module.');

  const totalCoverage = insurancePolicies.reduce((a, p) => a + (p.coverageAmount ?? 0), 0);
  const totalPremium  = insurancePolicies.reduce((a, p) => a + (p.premiumAmount ?? 0), 0);
  const today    = todayISO();
  const in30days = inDaysISO(30);
  const renewingSoon = insurancePolicies.filter((p) => p.renewalDate && p.renewalDate >= today && p.renewalDate <= in30days);

  const items: CardItem[] = insurancePolicies.map((p) => ({
    emoji: '🛡️',
    title: p.policyName,
    subtitle: `${p.type} · ${p.provider} · Renewal: ${p.renewalDate ?? '—'}`,
    value: formatINR(p.coverageAmount ?? 0),
    valueSub: `${formatINR(p.premiumAmount ?? 0)}/${p.premiumFrequency}`,
    severity: renewingSoon.some((r) => r.id === p.id) ? 'warning' : 'neutral',
    linkTo: '/insurance',
  }));

  return {
    kind: 'list_card',
    title: 'Your Insurance Policies',
    emoji: '🛡️',
    summary: `${insurancePolicies.length} polic${insurancePolicies.length === 1 ? 'y' : 'ies'} · Coverage: ${formatINR(totalCoverage)} · Premium: ${formatINR(totalPremium)}${renewingSoon.length ? ` · ⚠️ ${renewingSoon.length} renewing soon` : ''}`,
    items,
    footer: 'From your FinTrackly Insurance data.',
  };
}

export function getNextInsuranceRenewal(): AgentResponse {
  const { insurancePolicies } = usePortfolioStore.getState();
  const today  = todayISO();
  const future = insurancePolicies.filter((p) => p.renewalDate && p.renewalDate >= today).sort((a, b) => (a.renewalDate ?? '').localeCompare(b.renewalDate ?? ''));
  if (!future.length) return emptyResponse('No upcoming insurance renewals found.');
  const next = future[0];
  return {
    kind: 'card',
    title: 'Next Insurance Renewal',
    emoji: '🛡️',
    badge: next.renewalDate,
    badgeSeverity: 'warning',
    stats: [
      { label: 'Policy',    value: next.policyName },
      { label: 'Type',      value: next.type },
      { label: 'Coverage',  value: formatINR(next.coverageAmount ?? 0) },
      { label: 'Premium',   value: `${formatINR(next.premiumAmount ?? 0)} / ${next.premiumFrequency}` },
      { label: 'Renewal',   value: next.renewalDate ?? '—', severity: 'warning' },
      ...(next.nominee ? [{ label: 'Nominee', value: next.nominee }] : []),
    ],
    footer: future.length > 1 ? `Followed by: ${future[1].policyName} on ${future[1].renewalDate}` : undefined,
    linkTo: '/insurance',
  };
}

// ─── LIABILITIES ─────────────────────────────────────────────────────────────

export function getLiabilitiesSummary(): AgentResponse {
  const { liabilities } = usePortfolioStore.getState();
  const active = liabilities.filter((l) => !l.status || l.status === 'active');
  if (!active.length) return { kind: 'empty', emoji: '✅', message: 'No active liabilities — debt-free!' };

  const totalOutstanding = active.reduce((a, l) => a + (l.outstanding ?? 0), 0);
  const totalEMI         = active.reduce((a, l) => a + (l.emiAmount ?? 0), 0);
  const sorted           = [...active].sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));

  const items: CardItem[] = sorted.map((l) => ({
    emoji: '💳',
    title: l.name,
    subtitle: `${l.type}${l.interestRate ? ` · ${l.interestRate}% p.a.` : ''}${l.emiAmount ? ` · EMI ${formatINR(l.emiAmount)}` : ''}`,
    value: formatINR(l.outstanding ?? 0),
    severity: (l.interestRate ?? 0) > 18 ? 'danger' : (l.interestRate ?? 0) > 10 ? 'warning' : 'neutral',
    linkTo: '/liabilities',
  }));

  return {
    kind: 'list_card',
    title: 'Your Liabilities',
    emoji: '💳',
    summary: `Total outstanding: ${formatINR(totalOutstanding)} · Monthly EMI: ${formatINR(totalEMI)}`,
    items,
    footer: 'Sorted by interest rate. From your FinTrackly Liabilities.',
  };
}

export function getHighestInterestLiability(): AgentResponse {
  const { liabilities } = usePortfolioStore.getState();
  const active = liabilities.filter((l) => (!l.status || l.status === 'active') && l.interestRate);
  if (!active.length) return emptyResponse('No liabilities with interest rates recorded.');
  const sorted = [...active].sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
  const top    = sorted[0];
  return {
    kind: 'card',
    title: 'Highest Interest Liability',
    emoji: '🔴',
    badge: `${top.interestRate}% p.a.`,
    badgeSeverity: 'danger',
    stats: [
      { label: 'Name',        value: top.name },
      { label: 'Outstanding', value: formatINR(top.outstanding ?? 0), severity: 'danger' },
      { label: 'Interest',    value: `${top.interestRate}% p.a.`,     severity: 'danger' },
      { label: 'Monthly EMI', value: top.emiAmount ? formatINR(top.emiAmount) : '—' },
    ],
    footer: 'Pay this down first to minimise total interest cost.',
    linkTo: '/liabilities',
  };
}

export function getDebtRatio(): AgentResponse {
  const { investments, liabilities } = usePortfolioStore.getState();
  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(investments, liabilities);
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  return {
    kind: 'stat_grid',
    title: 'Debt-to-Asset Ratio',
    emoji: '📊',
    stats: [
      { label: 'Total Assets',      value: formatINR(totalAssets) },
      { label: 'Total Liabilities', value: formatINR(totalLiabilities), severity: totalLiabilities > 0 ? 'warning' : 'good' },
      { label: 'Net Worth',         value: formatINR(netWorth), severity: netWorth >= 0 ? 'good' : 'danger' },
      { label: 'Debt/Asset Ratio',  value: `${formatNumber(debtRatio, 1)}%`, severity: debtSeverity(debtRatio / 100) },
    ],
    footer: debtRatio === 0 ? '✅ No liabilities — ratio is 0%.'
      : debtRatio < 30 ? '✅ Healthy (below 30%).'
      : debtRatio < 60 ? '⚠️ Moderate (30–60%). Acceptable if you have a home loan.'
      : '🔴 High (above 60%). Focus on reducing debt.',
  };
}

// ─── GOALS ────────────────────────────────────────────────────────────────────

export function getGoalsSummary(): AgentResponse {
  const { goals, goalContributions } = usePortfolioStore.getState();
  const active = goals.filter((g) => !g.status || g.status === 'active');
  if (!active.length) return emptyResponse('No active financial goals.', 'Add some in the Goals module.');

  const items: CardItem[] = active.map((g) => {
    const saved    = goalSaved(g, goalContributions);
    const progress = g.targetAmount > 0 ? Math.min(100, (saved / g.targetAmount) * 100) : 0;
    const remain   = Math.max(0, g.targetAmount - saved);
    const sev: Severity = progress >= 80 ? 'good' : progress >= 40 ? 'warning' : 'danger';
    return {
      emoji: '🎯',
      title: g.name,
      subtitle: `${formatINR(saved)} / ${formatINR(g.targetAmount)}${g.dueDate ? ` · Due ${g.dueDate}` : ''}`,
      value: `${formatNumber(progress, 0)}%`,
      valueSub: remain > 0 ? `${formatINR(remain)} remaining` : '✅ Achieved!',
      severity: sev,
      badge: remain === 0 ? '✅ Done' : undefined,
      linkTo: '/goals',
    };
  });

  return {
    kind: 'list_card',
    title: 'Your Financial Goals',
    emoji: '🎯',
    summary: `${active.length} active goal(s)`,
    items,
    footer: 'From your FinTrackly Goals.',
  };
}

export function getGoalClosestToCompletion(): AgentResponse {
  const { goals, goalContributions } = usePortfolioStore.getState();
  const active = goals.filter((g) => (!g.status || g.status === 'active') && g.targetAmount > 0);
  if (!active.length) return emptyResponse('No active goals found.');

  const scored = active.map((g) => {
    const saved    = goalSaved(g, goalContributions);
    const progress = Math.min(100, (saved / g.targetAmount) * 100);
    return { ...g, saved, progress };
  }).sort((a, b) => b.progress - a.progress);

  const top = scored[0];
  return {
    kind: 'card',
    title: 'Goal Closest to Completion',
    emoji: '🎯',
    badge: `${formatNumber(top.progress, 0)}%`,
    badgeSeverity: top.progress >= 80 ? 'good' : 'warning',
    stats: [
      { label: 'Goal',      value: top.name },
      { label: 'Target',    value: formatINR(top.targetAmount) },
      { label: 'Saved',     value: formatINR(top.saved),  severity: 'good' },
      { label: 'Remaining', value: formatINR(Math.max(0, top.targetAmount - top.saved)) },
      ...(top.dueDate ? [{ label: 'Due Date', value: top.dueDate }] : []),
    ],
    footer: 'From your FinTrackly Goals.',
    linkTo: '/goals',
  };
}

export function getGoalsOnTrack(): AgentResponse {
  const { goals, goalContributions, cashflows } = usePortfolioStore.getState();
  const active = goals.filter((g) => (!g.status || g.status === 'active') && g.targetAmount > 0);
  if (!active.length) return emptyResponse('No active goals found.');

  const avgSurplus = monthlyAvg(cashflows, 'income') - monthlyAvg(cashflows, 'expense');
  const today = todayISO();

  const items: CardItem[] = active.map((g) => {
    const saved    = goalSaved(g, goalContributions);
    const remain   = Math.max(0, g.targetAmount - saved);
    const progress = Math.min(100, (saved / g.targetAmount) * 100);

    let onTrackText = '—';
    let sev: Severity = 'neutral';

    if (remain === 0) {
      onTrackText = '✅ Achieved';
      sev = 'good';
    } else if (g.dueDate) {
      const msLeft     = new Date(g.dueDate).getTime() - new Date(today).getTime();
      const monthsLeft = Math.max(0, msLeft / (30 * 86400000));
      const needed     = monthsLeft > 0 ? remain / monthsLeft : Infinity;
      onTrackText = avgSurplus > 0 && needed <= avgSurplus ? '✅ On track' : '⚠️ May fall short';
      sev = avgSurplus > 0 && needed <= avgSurplus ? 'good' : 'warning';
    }

    return {
      emoji: '🎯',
      title: g.name,
      subtitle: `${formatNumber(progress, 0)}% complete · ${formatINR(remain)} remaining${g.dueDate ? ` · Due ${g.dueDate}` : ''}`,
      value: onTrackText,
      severity: sev,
      linkTo: '/goals',
    };
  });

  return {
    kind: 'list_card',
    title: 'Goal Progress & Tracking',
    emoji: '🎯',
    summary: `Avg monthly surplus: ${formatINR(avgSurplus)}`,
    items,
    footer: 'From your FinTrackly Goals and Cashflow.',
  };
}

// ─── ACCOUNTS ─────────────────────────────────────────────────────────────────

export function getAccountsSummary(): AgentResponse {
  const { accounts } = usePortfolioStore.getState();
  if (!accounts.length) return emptyResponse('No accounts recorded.', 'Add your bank accounts in the Accounts module.');

  const total  = accounts.reduce((a, ac) => a + (ac.balance ?? 0), 0);
  const sorted = [...accounts].sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));

  const items: CardItem[] = sorted.map((ac) => ({
    emoji: '🏦',
    title: ac.name,
    subtitle: ac.type,
    value: formatINR(ac.balance ?? 0),
    valueSub: `${formatNumber(total > 0 ? ((ac.balance ?? 0) / total) * 100 : 0, 0)}% of total`,
    severity: 'neutral',
    linkTo: '/accounts',
  }));

  return {
    kind: 'list_card',
    title: 'Your Accounts',
    emoji: '🏦',
    summary: `Total balance: ${formatINR(total)} across ${accounts.length} account(s)`,
    items,
    footer: 'From your FinTrackly Accounts.',
  };
}

// ─── AGRICULTURE ─────────────────────────────────────────────────────────────

export function getAgriculture(): AgentResponse {
  const { fields, cropCycles, agriExpenses, produceSales } = useAgriStore.getState();
  if (!fields.length && !cropCycles.length) return emptyResponse('No agriculture data found.', 'Add records in the Agriculture module.');

  const totalHarvest  = cropCycles.reduce((a, c) => a + (c.harvestIncome ?? 0), 0);
  const totalInvested = cropCycles.reduce((a, c) => a + (c.investedAmount ?? 0), 0);
  const totalExpenses = agriExpenses.reduce((a, e) => a + e.amount, 0);
  const totalSales    = produceSales.reduce((a, s) => a + ((s as unknown as { totalAmount?: number }).totalAmount ?? 0), 0);
  const netProfit     = totalHarvest + totalSales - totalInvested - totalExpenses;

  return {
    kind: 'stat_grid',
    title: 'Agriculture Overview',
    emoji: '🌾',
    stats: [
      { label: 'Fields',          value: `${fields.length}` },
      { label: 'Crop Cycles',     value: `${cropCycles.length}` },
      { label: 'Harvest Income',  value: formatINR(totalHarvest),  severity: 'good' },
      { label: 'Produce Sales',   value: formatINR(totalSales),    severity: 'good' },
      { label: 'Total Invested',  value: formatINR(totalInvested), severity: 'neutral' },
      { label: 'Other Expenses',  value: formatINR(totalExpenses), severity: 'neutral' },
      { label: 'Net Profit',      value: `${plSign(netProfit)}${formatINR(netProfit)}`, severity: plSeverity(netProfit) },
    ],
    footer: 'From your FinTrackly Agriculture data.',
  };
}

export function getAgricultureBestCrop(): AgentResponse {
  const { cropCycles } = useAgriStore.getState();
  if (!cropCycles.length) return emptyResponse('No crop cycles recorded.');
  const withProfit = cropCycles.map((c) => ({ ...c, profit: (c.harvestIncome ?? 0) - (c.investedAmount ?? 0) })).sort((a, b) => b.profit - a.profit);
  const top = withProfit[0];
  return {
    kind: 'card',
    title: 'Best Performing Crop',
    emoji: '🌾',
    badge: `${plSign(top.profit)}${formatINR(top.profit)}`,
    badgeSeverity: plSeverity(top.profit),
    stats: [
      { label: 'Crop',           value: top.cropName },
      { label: 'Season',         value: top.season },
      { label: 'Invested',       value: formatINR(top.investedAmount ?? 0) },
      { label: 'Harvest Income', value: formatINR(top.harvestIncome ?? 0), severity: 'good' },
      { label: 'Profit',         value: `${plSign(top.profit)}${formatINR(top.profit)}`, severity: plSeverity(top.profit) },
    ],
    footer: 'From your FinTrackly Agriculture data.',
    linkTo: '/agriculture',
  };
}

export function getAgricultureActiveCrops(): AgentResponse {
  const { cropCycles } = useAgriStore.getState();
  const today  = todayISO();
  const active = cropCycles.filter((c) => !c.actualHarvestDate || c.actualHarvestDate > today);
  if (!active.length) return { kind: 'empty', emoji: '🌾', message: 'No active crop cycles. All crops have been harvested.' };

  const items: CardItem[] = active.map((c) => ({
    emoji: '🌱',
    title: c.cropName,
    subtitle: `${c.fieldName ?? c.fieldId} · ${c.season} · Harvest: ${c.expectedHarvestDate}`,
    value: formatINR(c.investedAmount ?? 0),
    severity: 'neutral',
    linkTo: '/agriculture',
  }));

  return {
    kind: 'list_card',
    title: 'Active Crop Cycles',
    emoji: '🌱',
    summary: `${active.length} crop(s) currently growing`,
    items,
    footer: 'From your FinTrackly Agriculture data.',
  };
}

// ─── LENDING ─────────────────────────────────────────────────────────────────

function lendingStats() {
  const { lendingBorrowers, lendingTransactions } = usePortfolioStore.getState();
  return lendingBorrowers.map((b) => {
    const txns     = lendingTransactions.filter((t) => t.borrowerId === b.id);
    const given    = txns.filter((t) => t.type === 'principal_given').reduce((a, t) => a + t.amount, 0);
    const returned = txns.filter((t) => t.type === 'principal_returned').reduce((a, t) => a + t.amount, 0);
    const interest = txns.filter((t) => t.type === 'interest_paid').reduce((a, t) => a + t.amount, 0);
    return { ...b, given, returned, outstanding: given - returned, interest };
  });
}

export function getLendingSummary(): AgentResponse {
  const stats  = lendingStats();
  const active = stats.filter((b) => b.status === 'active');
  if (!active.length) return emptyResponse('No active lending records.', 'Add borrowers in the Lending module.');

  const totalGiven       = active.reduce((a, b) => a + b.given, 0);
  const totalOutstanding = active.reduce((a, b) => a + b.outstanding, 0);
  const totalInterest    = active.reduce((a, b) => a + b.interest, 0);

  const items: CardItem[] = active.sort((a, b) => b.outstanding - a.outstanding).map((b) => ({
    emoji: '🤝',
    title: b.name,
    subtitle: `Given: ${formatINR(b.given)} · Returned: ${formatINR(b.returned)}${b.interestRate ? ` · ${b.interestRate}% p.a.` : ''}`,
    value: formatINR(b.outstanding),
    valueSub: b.interest > 0 ? `Interest: ${formatINR(b.interest)}` : undefined,
    severity: b.outstanding > 0 ? 'warning' : 'good',
    linkTo: '/lending' as string,
  }));

  return {
    kind: 'list_card',
    title: 'Lending Overview',
    emoji: '🤝',
    summary: `Total lent: ${formatINR(totalGiven)} · Outstanding: ${formatINR(totalOutstanding)} · Interest collected: ${formatINR(totalInterest)}`,
    items,
    footer: 'From your FinTrackly Lending data.',
  };
}

export function getLendingOutstanding(): AgentResponse {
  const stats = lendingStats().filter((b) => b.status === 'active' && b.outstanding > 0);
  if (!stats.length) return { kind: 'empty', emoji: '✅', message: 'All lending amounts have been fully recovered.' };
  const total = stats.reduce((a, b) => a + b.outstanding, 0);
  const items: CardItem[] = stats.sort((a, b) => b.outstanding - a.outstanding).map((b) => ({
    emoji: '🤝',
    title: b.name,
    subtitle: `Lent: ${formatINR(b.given)} · Returned: ${formatINR(b.returned)}`,
    value: formatINR(b.outstanding),
    severity: 'warning',
    linkTo: '/lending' as string,
  }));
  return {
    kind: 'list_card',
    title: 'Outstanding Lending',
    emoji: '💰',
    summary: `Total outstanding: ${formatINR(total)} from ${stats.length} borrower(s)`,
    items,
    footer: 'From your FinTrackly Lending data.',
  };
}
