/**
 * src/services/aiAgentDataFetcher.ts
 *
 * Every intent from aiAgentRouter.ts has a matching case here.
 * All values come from the Zustand store (already loaded from Firebase).
 * RULE: Never invent numbers. Never call Groq from here.
 */

import { formatINR, formatNumber } from '../utils/format';
import {
  calculateNetWorth,
  currentValue,
  investedValue,
} from '../utils/calculations';
import { usePortfolioStore } from '../store/portfolioStore';
import type { StockInvestment, MutualFundInvestment } from '../types/investmentTypes';

export interface AgentDataResult {
  answer: string;
  context?: Record<string, unknown>;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function monthlyAvg(
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

function pct(value: number, base: number): string {
  if (base === 0) return '0%';
  return `${formatNumber((value / base) * 100, 1)}%`;
}

function noData(module: string): AgentDataResult {
  return {
    answer: `📭 No ${module} data found in FinTrackly. Add records in the **${module}** module first.`,
  };
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function fetchDashboard(): AgentDataResult {
  const { investments, liabilities, cashflows, goals, trackedPayments, insurancePolicies } =
    usePortfolioStore.getState();
  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(investments, liabilities);
  const avgIncome  = monthlyAvg(cashflows, 'income');
  const avgExpense = monthlyAvg(cashflows, 'expense');
  const surplus    = avgIncome - avgExpense;
  const savingsRate = avgIncome > 0 ? (surplus / avgIncome) * 100 : 0;
  const debtRatio  = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  const today     = new Date().toISOString().slice(0, 10);
  const in7days   = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const overdueCount = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate < today).length;
  const dueWeekCount = trackedPayments.filter(
    (p) => p.status === 'pending' && p.dueDate >= today && p.dueDate <= in7days,
  ).length;
  const renewingSoon = insurancePolicies.filter(
    (p) => p.renewalDate && p.renewalDate >= today && p.renewalDate <= in7days,
  ).length;

  const totalInvested = investments.reduce((a, i) => a + investedValue(i), 0);
  const totalCurrent  = investments.reduce((a, i) => a + currentValue(i), 0);
  const portfolioPL   = totalCurrent - totalInvested;

  const activeGoals = goals.filter((g) => !g.status || g.status === 'active').length;

  const lines = [
    `## 🧠 Financial Overview`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Net Worth** | ${formatINR(netWorth)} |`,
    `| **Total Assets** | ${formatINR(totalAssets)} |`,
    `| **Total Liabilities** | ${formatINR(totalLiabilities)} |`,
    `| **Monthly Income** | ${formatINR(avgIncome)} |`,
    `| **Monthly Expenses** | ${formatINR(avgExpense)} |`,
    `| **Monthly Surplus** | ${plSign(surplus)}${formatINR(surplus)} |`,
    `| **Savings Rate** | ${formatNumber(savingsRate, 1)}% |`,
    `| **Debt-to-Asset Ratio** | ${formatNumber(debtRatio, 1)}% |`,
    ``,
  ];

  if (investments.length) {
    lines.push(
      `### 📈 Portfolio`,
      `Invested: ${formatINR(totalInvested)} · Current: ${formatINR(totalCurrent)} · P&L: **${plSign(portfolioPL)}${formatINR(portfolioPL)}**`,
      ``,
    );
  }

  const alerts: string[] = [];
  if (overdueCount)   alerts.push(`⚠️ **${overdueCount}** overdue payment(s)`);
  if (dueWeekCount)   alerts.push(`🔔 **${dueWeekCount}** payment(s) due this week`);
  if (renewingSoon)   alerts.push(`🛡️ **${renewingSoon}** insurance renewal(s) within 7 days`);
  if (debtRatio > 60) alerts.push(`🔴 High debt-to-asset ratio (${formatNumber(debtRatio, 1)}%)`);
  if (savingsRate < 10 && avgIncome > 0) alerts.push(`⚠️ Low savings rate (${formatNumber(savingsRate, 1)}%)`);

  if (alerts.length) {
    lines.push(`### 🔔 Alerts`, ...alerts, ``);
  }

  if (activeGoals) lines.push(`### 🎯 Goals`, `${activeGoals} active financial goal(s) in progress.`, ``);

  lines.push(`*All data from your FinTrackly records.*`);
  return {
    answer: lines.join('\n'),
    context: { netWorth, totalAssets, totalLiabilities, avgIncome, avgExpense, surplus, savingsRate, debtRatio },
  };
}

// ─── PORTFOLIO fetchers ───────────────────────────────────────────────────────

function getStocksWithPL() {
  const { investments } = usePortfolioStore.getState();
  return investments
    .filter((i): i is StockInvestment => i.type === 'stock')
    .map((s) => {
      const iv = s.quantity * s.buyPrice;
      const cv = s.quantity * s.currentPrice;
      const pl = cv - iv;
      const plPct = iv > 0 ? (pl / iv) * 100 : 0;
      return { name: s.name, symbol: s.symbol ?? s.name, iv, cv, pl, plPct };
    });
}

function getMFsWithPL() {
  const { investments } = usePortfolioStore.getState();
  return investments
    .filter((i): i is MutualFundInvestment => i.type === 'mutual_fund')
    .map((m) => {
      const cv = m.units * m.nav;
      const pl = cv - m.investedAmount;
      const plPct = m.investedAmount > 0 ? (pl / m.investedAmount) * 100 : 0;
      return { name: m.name, symbol: m.name, iv: m.investedAmount, cv, pl, plPct };
    });
}

function fetchPortfolioData(): AgentDataResult {
  const { investments } = usePortfolioStore.getState();
  if (!investments.length) return noData('Investments');

  const totalInvested = investments.reduce((a, i) => a + investedValue(i), 0);
  const totalCurrent  = investments.reduce((a, i) => a + currentValue(i), 0);
  const totalPL       = totalCurrent - totalInvested;
  const stocks        = investments.filter((i) => i.type === 'stock');
  const mfs           = investments.filter((i) => i.type === 'mutual_fund');
  const fds           = investments.filter((i) => i.type === 'fixed_deposit' || i.type === 'bond');
  const others        = investments.filter((i) => i.type === 'other');
  const stocksPL      = getStocksWithPL().sort((a, b) => b.plPct - a.plPct);
  const mfsPL         = getMFsWithPL().sort((a, b) => b.plPct - a.plPct);

  const lines = [
    `## 📈 Your Portfolio`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Total Invested** | ${formatINR(totalInvested)} |`,
    `| **Current Value** | ${formatINR(totalCurrent)} |`,
    `| **Overall P&L** | ${plSign(totalPL)}${formatINR(totalPL)} (${plSign(totalPL)}${pct(Math.abs(totalPL), totalInvested)}) |`,
    `| **Stocks** | ${stocks.length} |`,
    `| **Mutual Funds** | ${mfs.length} |`,
    `| **FDs / Bonds** | ${fds.length} |`,
    `| **Other Assets** | ${others.length} |`,
    ``,
  ];

  if (stocksPL.length) {
    const best   = stocksPL[0];
    const worst  = stocksPL[stocksPL.length - 1];
    lines.push(
      `### 🏆 Best Stock`,
      `**${best.symbol}** — ${plSign(best.pl)}${formatINR(best.pl)} (${plSign(best.plPct)}${formatNumber(best.plPct, 1)}%)`,
    );
    if (worst.symbol !== best.symbol) {
      lines.push(
        `### 📉 Biggest Loss`,
        `**${worst.symbol}** — ${plSign(worst.pl)}${formatINR(worst.pl)} (${plSign(worst.plPct)}${formatNumber(worst.plPct, 1)}%)`,
      );
    }
  }

  if (mfsPL.length) {
    const best = mfsPL[0];
    lines.push(``, `### 🏦 Top Fund`, `**${best.name}** — ${plSign(best.pl)}${formatINR(best.pl)} (${plSign(best.plPct)}${formatNumber(best.plPct, 1)}%)`);
  }

  lines.push(``, `*Data from your FinTrackly portfolio.*`);
  return { answer: lines.join('\n') };
}

function fetchPortfolioBest(): AgentDataResult {
  const stocks = getStocksWithPL().sort((a, b) => b.pl - a.pl);
  const mfs    = getMFsWithPL().sort((a, b) => b.pl - a.pl);
  const all    = [...stocks, ...mfs].sort((a, b) => b.pl - a.pl);
  if (!all.length) return noData('Investments');

  const top5 = all.slice(0, 5);
  const lines = [
    `## 🏆 Best Performing Investments`,
    ``,
    `| Investment | Invested | Current | P&L | Return |`,
    `|---|---|---|---|---|`,
    ...top5.map(
      (i) =>
        `| **${i.symbol}** | ${formatINR(i.iv)} | ${formatINR(i.cv)} | ${plSign(i.pl)}${formatINR(i.pl)} | ${plSign(i.plPct)}${formatNumber(i.plPct, 1)}% |`,
    ),
    ``,
    `*Sorted by absolute profit. From your FinTrackly portfolio.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchPortfolioWorst(): AgentDataResult {
  const stocks = getStocksWithPL();
  const mfs    = getMFsWithPL();
  const all    = [...stocks, ...mfs].filter((i) => i.pl < 0).sort((a, b) => a.pl - b.pl);
  if (!all.length) {
    return { answer: '✅ Great news — none of your investments are currently in a loss position.' };
  }

  const bottom5 = all.slice(0, 5);
  const lines = [
    `## 📉 Investments at the Biggest Loss`,
    ``,
    `| Investment | Invested | Current | Loss | Return |`,
    `|---|---|---|---|---|`,
    ...bottom5.map(
      (i) =>
        `| **${i.symbol}** | ${formatINR(i.iv)} | ${formatINR(i.cv)} | ${formatINR(Math.abs(i.pl))} | ${formatNumber(i.plPct, 1)}% |`,
    ),
    ``,
    `*Sorted by absolute loss. From your FinTrackly portfolio.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchPortfolioProfitableCount(): AgentDataResult {
  const all = [...getStocksWithPL(), ...getMFsWithPL()];
  if (!all.length) return noData('Investments');
  const profitable = all.filter((i) => i.pl > 0);
  const loss       = all.filter((i) => i.pl < 0);
  const neutral    = all.filter((i) => i.pl === 0);
  const lines = [
    `## 📊 Profitable vs Loss Investments`,
    ``,
    `| | Count |`,
    `|---|---|`,
    `| **✅ In Profit** | ${profitable.length} |`,
    `| **📉 In Loss** | ${loss.length} |`,
    `| **➖ Break Even** | ${neutral.length} |`,
    `| **Total** | ${all.length} |`,
  ];
  if (profitable.length) {
    const best = [...profitable].sort((a, b) => b.pl - a.pl)[0];
    lines.push(``, `Best performer: **${best.symbol}** at ${plSign(best.plPct)}${formatNumber(best.plPct, 1)}%`);
  }
  lines.push(``, `*From your FinTrackly portfolio.*`);
  return { answer: lines.join('\n') };
}

function fetchPortfolioLossCount(): AgentDataResult {
  const all  = [...getStocksWithPL(), ...getMFsWithPL()];
  if (!all.length) return noData('Investments');
  const loss = all.filter((i) => i.pl < 0);
  if (!loss.length) return { answer: '✅ None of your investments are currently in a loss.' };

  const sorted = [...loss].sort((a, b) => a.pl - b.pl);
  const lines = [
    `## 📉 Investments Currently in Loss — ${loss.length} of ${all.length}`,
    ``,
    `| Investment | Loss | Return |`,
    `|---|---|---|`,
    ...sorted.map((i) => `| **${i.symbol}** | -${formatINR(Math.abs(i.pl))} | ${formatNumber(i.plPct, 1)}% |`),
    ``,
    `*From your FinTrackly portfolio.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchPortfolioBestPct(): AgentDataResult {
  const all = [...getStocksWithPL(), ...getMFsWithPL()].sort((a, b) => b.plPct - a.plPct);
  if (!all.length) return noData('Investments');
  const top5 = all.slice(0, 5);
  const lines = [
    `## 🥇 Highest Percentage Return`,
    ``,
    `| Investment | Invested | Current | Return % |`,
    `|---|---|---|---|`,
    ...top5.map(
      (i) => `| **${i.symbol}** | ${formatINR(i.iv)} | ${formatINR(i.cv)} | ${plSign(i.plPct)}${formatNumber(i.plPct, 1)}% |`,
    ),
    ``,
    `*Sorted by percentage return. From your FinTrackly portfolio.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchPortfolioSectors(): AgentDataResult {
  const { investments } = usePortfolioStore.getState();
  const stocks = investments.filter((i): i is StockInvestment => i.type === 'stock');
  if (!stocks.length) return noData('stock investments');

  const totalValue = stocks.reduce((a, s) => a + s.quantity * s.currentPrice, 0);
  const sectorMap  = stocks.reduce((acc, s) => {
    const key = (s.sector || 'Unknown').trim();
    acc[key]  = (acc[key] ?? 0) + s.quantity * s.currentPrice;
    return acc;
  }, {} as Record<string, number>);

  const sorted = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]);
  const lines  = [
    `## 🧩 Portfolio by Sector`,
    ``,
    `| Sector | Value | Share |`,
    `|---|---|---|`,
    ...sorted.map(
      ([sector, val]) =>
        `| **${sector}** | ${formatINR(val)} | ${formatNumber((val / totalValue) * 100, 1)}% |`,
    ),
    ``,
    `Total equity value: **${formatINR(totalValue)}** across ${sorted.length} sector(s).`,
    ``,
    sorted[0][1] / totalValue > 0.4
      ? `⚠️ **${sorted[0][0]}** makes up more than 40% of your equity — consider diversifying.`
      : `✅ Sector concentration looks reasonable.`,
    ``,
    `*From your FinTrackly stock holdings.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchPortfolioPnl(): AgentDataResult {
  const { investments } = usePortfolioStore.getState();
  if (!investments.length) return noData('Investments');
  const totalInvested = investments.reduce((a, i) => a + investedValue(i), 0);
  const totalCurrent  = investments.reduce((a, i) => a + currentValue(i), 0);
  const totalPL       = totalCurrent - totalInvested;
  const plPct         = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
  const lines = [
    `## 💹 Total Unrealized P&L`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Total Invested** | ${formatINR(totalInvested)} |`,
    `| **Current Value** | ${formatINR(totalCurrent)} |`,
    `| **Unrealized P&L** | **${plSign(totalPL)}${formatINR(totalPL)}** |`,
    `| **Return %** | **${plSign(plPct)}${formatNumber(plPct, 2)}%** |`,
    ``,
    totalPL >= 0
      ? `✅ Your portfolio is currently in profit.`
      : `📉 Your portfolio is currently at a loss.`,
    ``,
    `*From your FinTrackly portfolio. Unrealized = not yet sold.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchPortfolioInvested(): AgentDataResult {
  const { investments } = usePortfolioStore.getState();
  if (!investments.length) return noData('Investments');
  const totalInvested = investments.reduce((a, i) => a + investedValue(i), 0);
  const byType = ['stock', 'mutual_fund', 'bond', 'fixed_deposit', 'other'].map((t) => {
    const amt = investments.filter((i) => i.type === t).reduce((a, i) => a + investedValue(i), 0);
    return { type: t.replace('_', ' '), amt };
  }).filter((r) => r.amt > 0);

  const lines = [
    `## 💰 Total Invested Amount`,
    ``,
    `**Total: ${formatINR(totalInvested)}** across ${investments.length} investments`,
    ``,
    `| Type | Invested | Share |`,
    `|---|---|---|`,
    ...byType.map(
      (r) => `| ${r.type} | ${formatINR(r.amt)} | ${pct(r.amt, totalInvested)} |`,
    ),
    ``,
    `*From your FinTrackly portfolio.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchPortfolioValue(): AgentDataResult {
  const { investments } = usePortfolioStore.getState();
  if (!investments.length) return noData('Investments');
  const totalCurrent = investments.reduce((a, i) => a + currentValue(i), 0);
  const totalInvested = investments.reduce((a, i) => a + investedValue(i), 0);
  const pl   = totalCurrent - totalInvested;
  const plPct = totalInvested > 0 ? (pl / totalInvested) * 100 : 0;
  const lines = [
    `## 📊 Current Portfolio Value`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Current Value** | **${formatINR(totalCurrent)}** |`,
    `| **Invested** | ${formatINR(totalInvested)} |`,
    `| **Gain / Loss** | ${plSign(pl)}${formatINR(pl)} (${plSign(plPct)}${formatNumber(plPct, 2)}%) |`,
    ``,
    `*Market value of all holdings in your FinTrackly portfolio.*`,
  ];
  return { answer: lines.join('\n') };
}

// ─── CASHFLOW fetchers ────────────────────────────────────────────────────────

function fetchCashflowData(): AgentDataResult {
  const { cashflows } = usePortfolioStore.getState();
  if (!cashflows.length) return noData('Cashflow');

  const avgIncome   = monthlyAvg(cashflows, 'income');
  const avgExpense  = monthlyAvg(cashflows, 'expense');
  const avgSurplus  = avgIncome - avgExpense;
  const savingsRate = avgIncome > 0 ? (avgSurplus / avgIncome) * 100 : 0;
  const now         = new Date();
  const thisMonth   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisEntries = cashflows.filter((e) => e.date.startsWith(thisMonth));
  const thisIncome  = thisEntries.filter((e) => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const thisExpense = thisEntries.filter((e) => e.type === 'expense').reduce((a, e) => a + e.amount, 0);

  const catMap  = cashflows.filter((e) => e.type === 'expense')
    .reduce((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const lines = [
    `## 💸 Your Cashflow`,
    ``,
    `| | Monthly Average |`,
    `|---|---|`,
    `| **Income** | ${formatINR(avgIncome)} |`,
    `| **Expenses** | ${formatINR(avgExpense)} |`,
    `| **Surplus** | ${plSign(avgSurplus)}${formatINR(avgSurplus)} |`,
    `| **Savings Rate** | ${formatNumber(savingsRate, 1)}% |`,
    ``,
    `### This Month (${thisMonth})`,
    `Income: **${formatINR(thisIncome)}** · Expenses: **${formatINR(thisExpense)}** · Surplus: **${plSign(thisIncome - thisExpense)}${formatINR(thisIncome - thisExpense)}**`,
  ];
  if (topCats.length) {
    lines.push(``, `### Top Expense Categories`);
    topCats.forEach(([cat, amt]) => lines.push(`- **${cat}**: ${formatINR(amt)}`));
  }
  lines.push(``, `*Based on ${cashflows.length} entries in FinTrackly.*`);
  return { answer: lines.join('\n'), context: { avgIncome, avgExpense, avgSurplus, savingsRate } };
}

function fetchCashflowCategories(): AgentDataResult {
  const { cashflows } = usePortfolioStore.getState();
  if (!cashflows.length) return noData('Cashflow');
  const catMap = cashflows.filter((e) => e.type === 'expense')
    .reduce((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);
  if (!Object.keys(catMap).length) return { answer: '📭 No expense entries recorded yet.' };

  const totalExpense = Object.values(catMap).reduce((a, v) => a + v, 0);
  const sorted       = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const lines        = [
    `## 📊 Spending by Category (All Time)`,
    ``,
    `| Category | Total Spent | Share |`,
    `|---|---|---|`,
    ...sorted.map(([cat, amt]) => `| **${cat}** | ${formatINR(amt)} | ${pct(amt, totalExpense)} |`),
    ``,
    `**Total expenses recorded: ${formatINR(totalExpense)}**`,
    ``,
    `*From your FinTrackly Cashflow data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchCashflowPeakExpenseMonth(): AgentDataResult {
  const { cashflows } = usePortfolioStore.getState();
  if (!cashflows.length) return noData('Cashflow');
  const byMonth = cashflows.filter((e) => e.type === 'expense')
    .reduce((acc, e) => { const m = e.date.slice(0, 7); acc[m] = (acc[m] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);
  if (!Object.keys(byMonth).length) return { answer: '📭 No expense entries found.' };

  const sorted = Object.entries(byMonth).sort((a, b) => b[1] - a[1]);
  const [topMonth, topAmt] = sorted[0];
  const lines = [
    `## 📈 Month with Highest Expenses`,
    ``,
    `**${topMonth}** — ${formatINR(topAmt)}`,
    ``,
    `### All Months (Descending)`,
    `| Month | Expenses |`,
    `|---|---|`,
    ...sorted.slice(0, 10).map(([m, amt]) => `| ${m} | ${formatINR(amt)} |`),
    ``,
    `*From your FinTrackly Cashflow data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchCashflowPeakIncomeMonth(): AgentDataResult {
  const { cashflows } = usePortfolioStore.getState();
  if (!cashflows.length) return noData('Cashflow');
  const byMonth = cashflows.filter((e) => e.type === 'income')
    .reduce((acc, e) => { const m = e.date.slice(0, 7); acc[m] = (acc[m] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);
  if (!Object.keys(byMonth).length) return { answer: '📭 No income entries found.' };

  const sorted = Object.entries(byMonth).sort((a, b) => b[1] - a[1]);
  const [topMonth, topAmt] = sorted[0];
  const lines = [
    `## 💰 Month with Highest Income`,
    ``,
    `**${topMonth}** — ${formatINR(topAmt)}`,
    ``,
    `### All Months (Descending)`,
    `| Month | Income |`,
    `|---|---|`,
    ...sorted.slice(0, 10).map(([m, amt]) => `| ${m} | ${formatINR(amt)} |`),
    ``,
    `*From your FinTrackly Cashflow data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchCashflowTrend(): AgentDataResult {
  const { cashflows } = usePortfolioStore.getState();
  if (!cashflows.length) return noData('Cashflow');
  const incomeByMonth  = cashflows.filter((e) => e.type === 'income')
    .reduce((acc, e) => { const m = e.date.slice(0, 7); acc[m] = (acc[m] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);
  const expenseByMonth = cashflows.filter((e) => e.type === 'expense')
    .reduce((acc, e) => { const m = e.date.slice(0, 7); acc[m] = (acc[m] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);

  const allMonths = Array.from(new Set([...Object.keys(incomeByMonth), ...Object.keys(expenseByMonth)])).sort().slice(-6);
  const lines = [
    `## 📉 Cash Flow Trend (Last 6 Months)`,
    ``,
    `| Month | Income | Expenses | Surplus |`,
    `|---|---|---|---|`,
    ...allMonths.map((m) => {
      const inc = incomeByMonth[m] ?? 0;
      const exp = expenseByMonth[m] ?? 0;
      const sur = inc - exp;
      return `| ${m} | ${formatINR(inc)} | ${formatINR(exp)} | ${plSign(sur)}${formatINR(sur)} |`;
    }),
    ``,
    `*From your FinTrackly Cashflow data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchCashflowOverspend(): AgentDataResult {
  const { cashflows } = usePortfolioStore.getState();
  if (!cashflows.length) return noData('Cashflow');
  const avgIncome  = monthlyAvg(cashflows, 'income');
  const avgExpense = monthlyAvg(cashflows, 'expense');
  const surplus    = avgIncome - avgExpense;
  const savingsRate = avgIncome > 0 ? (surplus / avgIncome) * 100 : 0;
  const lines = [
    `## 💡 Are You Spending More Than You Earn?`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Avg Monthly Income** | ${formatINR(avgIncome)} |`,
    `| **Avg Monthly Expenses** | ${formatINR(avgExpense)} |`,
    `| **Avg Monthly Surplus** | ${plSign(surplus)}${formatINR(surplus)} |`,
    ``,
    surplus < 0
      ? `🔴 **Yes** — on average you are spending **${formatINR(Math.abs(surplus))} more than you earn** each month.`
      : surplus === 0
        ? `⚠️ **Break even** — your income and expenses are equal on average.`
        : `✅ **No** — you are saving **${formatINR(surplus)} (${formatNumber(savingsRate, 1)}%)** of your income on average.`,
    ``,
    `*Calculated from your FinTrackly Cashflow entries.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchTodayCashflow(): AgentDataResult {
  const { cashflows } = usePortfolioStore.getState();
  const todayISO     = new Date().toISOString().slice(0, 10);
  const todayEntries = cashflows.filter((e) => e.date === todayISO);
  if (!todayEntries.length) {
    return { answer: `📭 No income or expense entries recorded for **today (${todayISO})** in FinTrackly.` };
  }
  const inc  = todayEntries.filter((e) => e.type === 'income');
  const exp  = todayEntries.filter((e) => e.type === 'expense');
  const tInc = inc.reduce((a, e) => a + e.amount, 0);
  const tExp = exp.reduce((a, e) => a + e.amount, 0);
  const sur  = tInc - tExp;
  const lines: string[] = [
    `## 📅 Today (${todayISO})`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Income** | ${formatINR(tInc)} |`,
    `| **Expenses** | ${formatINR(tExp)} |`,
    `| **Surplus** | ${plSign(sur)}${formatINR(sur)} |`,
  ];
  if (inc.length) {
    lines.push(``, `### 💰 Income`, `| Category | Amount | Notes |`, `|---|---|---|`,
      ...inc.map((e) => `| **${e.category}** | ${formatINR(e.amount)} | ${e.notes ?? '—'} |`));
  }
  if (exp.length) {
    lines.push(``, `### 💸 Expenses`, `| Category | Amount | Notes |`, `|---|---|---|`,
      ...exp.map((e) => `| **${e.category}** | ${formatINR(e.amount)} | ${e.notes ?? '—'} |`));
    const catMap  = exp.reduce((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);
    const cats    = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    if (cats.length > 1) {
      lines.push(``, `### 📊 Spending by Purpose`);
      cats.forEach(([cat, amt]) => lines.push(`- **${cat}**: ${formatINR(amt)} (${pct(amt, tExp)})`));
    }
  }
  lines.push(``, `*From your FinTrackly Cashflow data.*`);
  return { answer: lines.join('\n') };
}

function fetchWeekCashflow(): AgentDataResult {
  const { cashflows } = usePortfolioStore.getState();
  const now      = new Date();
  const today    = now.toISOString().slice(0, 10);
  const weekAgo  = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const entries  = cashflows.filter((e) => e.date >= weekAgo && e.date <= today);
  if (!entries.length) return { answer: `📭 No cashflow entries found for this week (${weekAgo} → ${today}).` };

  const inc   = entries.filter((e) => e.type === 'income');
  const exp   = entries.filter((e) => e.type === 'expense');
  const tInc  = inc.reduce((a, e) => a + e.amount, 0);
  const tExp  = exp.reduce((a, e) => a + e.amount, 0);
  const sur   = tInc - tExp;
  const catMap = exp.reduce((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc; }, {} as Record<string, number>);
  const byDate = entries.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = { income: 0, expense: 0 };
    if (e.type === 'income') acc[e.date].income += e.amount;
    else acc[e.date].expense += e.amount;
    return acc;
  }, {} as Record<string, { income: number; expense: number }>);

  const lines: string[] = [
    `## 📅 This Week (${weekAgo} → ${today})`,
    ``,
    `| | |`, `|---|---|`,
    `| **Income** | ${formatINR(tInc)} |`,
    `| **Expenses** | ${formatINR(tExp)} |`,
    `| **Surplus** | ${plSign(sur)}${formatINR(sur)} |`,
    ``,
    `### Daily Breakdown`,
    `| Date | Income | Expenses |`, `|---|---|---|`,
    ...Object.entries(byDate).sort().map(([d, v]) => `| ${d} | ${formatINR(v.income)} | ${formatINR(v.expense)} |`),
  ];
  const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  if (cats.length) {
    lines.push(``, `### Spending by Purpose`);
    cats.forEach(([cat, amt]) => lines.push(`- **${cat}**: ${formatINR(amt)} (${pct(amt, tExp)})`));
  }
  lines.push(``, `*From your FinTrackly Cashflow data.*`);
  return { answer: lines.join('\n') };
}

// ─── PAYMENTS fetchers ────────────────────────────────────────────────────────

function fetchPaymentsData(): AgentDataResult {
  const { trackedPayments } = usePortfolioStore.getState();
  const pending = trackedPayments.filter((p) => p.status === 'pending');
  if (!pending.length) return { answer: '✅ No pending payments in FinTrackly.' };

  const today    = new Date().toISOString().slice(0, 10);
  const in7days  = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const overdue  = pending.filter((p) => p.dueDate < today);
  const week     = pending.filter((p) => p.dueDate >= today && p.dueDate <= in7days);
  const month    = pending.filter((p) => p.dueDate > in7days && p.dueDate <= in30days);
  const total    = pending.reduce((a, p) => a + p.amount, 0);

  const lines = [
    `## 🔔 All Upcoming Payments`,
    ``,
    `**Total Pending: ${formatINR(total)}** (${pending.length} payments)`,
  ];
  if (overdue.length) {
    lines.push(``, `### ⚠️ Overdue (${overdue.length})`);
    overdue.forEach((p) => lines.push(`- **${p.title}** — ${formatINR(p.amount)} (due ${p.dueDate})`));
  }
  if (week.length) {
    lines.push(``, `### 📅 Due This Week (${week.length})`);
    week.forEach((p) => lines.push(`- **${p.title}** — ${formatINR(p.amount)} on ${p.dueDate}`));
  }
  if (month.length) {
    lines.push(``, `### 📆 Due This Month (${month.length})`);
    month.forEach((p) => lines.push(`- **${p.title}** — ${formatINR(p.amount)} on ${p.dueDate}`));
  }
  lines.push(``, `*From your FinTrackly Payments data.*`);
  return { answer: lines.join('\n') };
}

function fetchPaymentsWeek(): AgentDataResult {
  const { trackedPayments } = usePortfolioStore.getState();
  const today   = new Date().toISOString().slice(0, 10);
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const overdue = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate < today);
  const week    = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate >= today && p.dueDate <= in7days);
  const all     = [...overdue, ...week].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!all.length) return { answer: '✅ No payments due in the next 7 days.' };
  const total = all.reduce((a, p) => a + p.amount, 0);
  const lines = [
    `## 📅 Payments Due This Week`,
    ``,
    `**Total: ${formatINR(total)}** (${all.length} payments)`,
    ``,
    `| Payment | Amount | Due Date | Status |`,
    `|---|---|---|---|`,
    ...all.map((p) => `| **${p.title}** | ${formatINR(p.amount)} | ${p.dueDate} | ${p.dueDate < today ? '⚠️ Overdue' : '📅 Upcoming'} |`),
    ``,
    `*From your FinTrackly Payments.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchPaymentsMonth(): AgentDataResult {
  const { trackedPayments } = usePortfolioStore.getState();
  const today    = new Date().toISOString().slice(0, 10);
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const all      = trackedPayments
    .filter((p) => p.status === 'pending' && p.dueDate <= in30days)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!all.length) return { answer: '✅ No payments due this month.' };
  const total = all.reduce((a, p) => a + p.amount, 0);
  const lines = [
    `## 📆 Payments Due This Month`,
    ``,
    `**Total: ${formatINR(total)}** (${all.length} payments)`,
    ``,
    `| Payment | Amount | Due Date |`,
    `|---|---|---|`,
    ...all.map((p) => `| **${p.title}** | ${formatINR(p.amount)} | ${p.dueDate}${p.dueDate < today ? ' ⚠️' : ''} |`),
    ``,
    `*From your FinTrackly Payments.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchPaymentsOverdue(): AgentDataResult {
  const { trackedPayments } = usePortfolioStore.getState();
  const today   = new Date().toISOString().slice(0, 10);
  const overdue = trackedPayments.filter((p) => p.status === 'pending' && p.dueDate < today);
  if (!overdue.length) return { answer: '✅ You have no overdue payments — great job!' };
  const total = overdue.reduce((a, p) => a + p.amount, 0);
  const lines = [
    `## ⚠️ Overdue Payments — ${overdue.length}`,
    ``,
    `**Total Overdue: ${formatINR(total)}**`,
    ``,
    `| Payment | Amount | Was Due |`,
    `|---|---|---|`,
    ...overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((p) => `| **${p.title}** | ${formatINR(p.amount)} | ${p.dueDate} |`),
    ``,
    `*From your FinTrackly Payments. Pay these as soon as possible.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchPaymentsRecurring(): AgentDataResult {
  const { trackedPayments } = usePortfolioStore.getState();
  const recurring = trackedPayments.filter((p) => p.recurrence && p.recurrence !== 'none');
  if (!recurring.length) return { answer: '📭 No recurring payments set up in FinTrackly.' };
  const lines = [
    `## 🔁 Recurring Payments`,
    ``,
    `| Payment | Amount | Frequency | Next Due |`,
    `|---|---|---|---|`,
    ...recurring.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((p) => `| **${p.title}** | ${formatINR(p.amount)} | ${p.recurrence} | ${p.dueDate} |`),
    ``,
    `**Total recurring per cycle: ${formatINR(recurring.reduce((a, p) => a + p.amount, 0))}**`,
    ``,
    `*From your FinTrackly Payments.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchPaymentsLargest(): AgentDataResult {
  const { trackedPayments } = usePortfolioStore.getState();
  const pending = trackedPayments.filter((p) => p.status === 'pending').sort((a, b) => b.amount - a.amount);
  if (!pending.length) return { answer: '✅ No pending payments found.' };
  const top = pending[0];
  const lines = [
    `## 💰 Largest Upcoming Payment`,
    ``,
    `**${top.title}**`,
    ``,
    `| | |`,
    `|---|---|`,
    `| **Amount** | ${formatINR(top.amount)} |`,
    `| **Due Date** | ${top.dueDate} |`,
    `| **Type** | ${top.paymentType ?? '—'} |`,
    `| **Recurrence** | ${top.recurrence} |`,
    top.notes ? `| **Notes** | ${top.notes} |` : '',
    ``,
    pending.length > 1 ? `Next 5 by size:` : '',
    ...(pending.length > 1
      ? pending.slice(0, 5).map((p, i) => `${i + 1}. **${p.title}** — ${formatINR(p.amount)} on ${p.dueDate}`)
      : []),
    ``,
    `*From your FinTrackly Payments.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchPaymentsNext(): AgentDataResult {
  const { trackedPayments } = usePortfolioStore.getState();
  const today   = new Date().toISOString().slice(0, 10);
  const pending = trackedPayments
    .filter((p) => p.status === 'pending' && p.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!pending.length) return { answer: '✅ No upcoming payments found.' };
  const next = pending[0];
  const lines = [
    `## 🔔 Next Due Payment`,
    ``,
    `**${next.title}** — ${formatINR(next.amount)} on **${next.dueDate}**`,
    ``,
    `| | |`, `|---|---|`,
    `| **Type** | ${next.paymentType ?? '—'} |`,
    `| **Recurrence** | ${next.recurrence} |`,
    next.notes ? `| **Notes** | ${next.notes} |` : '',
    ``,
    pending.length > 1
      ? `After that: **${pending[1].title}** — ${formatINR(pending[1].amount)} on ${pending[1].dueDate}`
      : '',
    ``, `*From your FinTrackly Payments.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchPaymentsPaid(): AgentDataResult {
  const { trackedPayments } = usePortfolioStore.getState();
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const paid      = trackedPayments.filter((p) => p.status === 'paid' && (p.paidAt ?? '').startsWith(thisMonth));
  if (!paid.length) return { answer: `📭 No payments recorded as paid in ${thisMonth} yet.` };
  const total = paid.reduce((a, p) => a + p.amount, 0);
  const lines = [
    `## ✅ Payments Already Paid This Month (${thisMonth})`,
    ``,
    `**Total Paid: ${formatINR(total)}** (${paid.length} payments)`,
    ``,
    `| Payment | Amount | Paid On |`,
    `|---|---|---|`,
    ...paid.map((p) => `| **${p.title}** | ${formatINR(p.amount)} | ${p.paidAt?.slice(0, 10) ?? '—'} |`),
    ``,
    `*From your FinTrackly Payments.*`,
  ];
  return { answer: lines.join('\n') };
}

// ─── INSURANCE fetchers ───────────────────────────────────────────────────────

function fetchInsuranceData(): AgentDataResult {
  const { insurancePolicies } = usePortfolioStore.getState();
  if (!insurancePolicies.length) return noData('Insurance');
  const totalCoverage = insurancePolicies.reduce((a, p) => a + (p.coverageAmount ?? 0), 0);
  const totalPremium  = insurancePolicies.reduce((a, p) => a + (p.premiumAmount ?? 0), 0);
  const today    = new Date().toISOString().slice(0, 10);
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const renewingSoon = insurancePolicies.filter((p) => p.renewalDate && p.renewalDate >= today && p.renewalDate <= in30days);
  const lines = [
    `## 🛡 Your Insurance Policies`,
    ``,
    `| | |`, `|---|---|`,
    `| **Policies** | ${insurancePolicies.length} |`,
    `| **Total Coverage** | ${formatINR(totalCoverage)} |`,
    `| **Total Premium** | ${formatINR(totalPremium)} |`,
    ``,
    `| Policy | Type | Coverage | Premium | Renewal |`,
    `|---|---|---|---|---|`,
    ...insurancePolicies.map(
      (p) => `| ${p.policyName} | ${p.type} | ${formatINR(p.coverageAmount)} | ${formatINR(p.premiumAmount)}/${p.premiumFrequency} | ${p.renewalDate ?? '—'} |`,
    ),
  ];
  if (renewingSoon.length) {
    lines.push(``, `### ⚠️ Renewing Soon`);
    renewingSoon.forEach((p) => lines.push(`- **${p.policyName}** — ${p.renewalDate}`));
  }
  lines.push(``, `*From your FinTrackly Insurance data.*`);
  return { answer: lines.join('\n') };
}

function fetchInsuranceCount(): AgentDataResult {
  const { insurancePolicies } = usePortfolioStore.getState();
  if (!insurancePolicies.length) return noData('Insurance');
  const byType = insurancePolicies.reduce((acc, p) => { acc[p.type] = (acc[p.type] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const lines = [
    `## 🛡 Insurance Policy Count`,
    ``,
    `You have **${insurancePolicies.length}** insurance policies.`,
    ``,
    `| Type | Count |`, `|---|---|`,
    ...Object.entries(byType).map(([type, count]) => `| ${type} | ${count} |`),
    ``,
    `*From your FinTrackly Insurance data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchInsuranceCoverage(): AgentDataResult {
  const { insurancePolicies } = usePortfolioStore.getState();
  if (!insurancePolicies.length) return noData('Insurance');
  const sorted = [...insurancePolicies].sort((a, b) => (b.coverageAmount ?? 0) - (a.coverageAmount ?? 0));
  const total  = sorted.reduce((a, p) => a + (p.coverageAmount ?? 0), 0);
  const lines  = [
    `## 🛡 Total Insurance Coverage`,
    ``,
    `**Total: ${formatINR(total)}** across ${insurancePolicies.length} policies`,
    ``,
    `| Policy | Type | Coverage |`, `|---|---|---|`,
    ...sorted.map((p) => `| **${p.policyName}** | ${p.type} | ${formatINR(p.coverageAmount ?? 0)} |`),
    ``,
    `*From your FinTrackly Insurance data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchInsurancePremium(): AgentDataResult {
  const { insurancePolicies } = usePortfolioStore.getState();
  if (!insurancePolicies.length) return noData('Insurance');
  const annualized = insurancePolicies.map((p) => {
    const mult = p.premiumFrequency === 'monthly' ? 12 : p.premiumFrequency === 'quarterly' ? 4 : p.premiumFrequency === 'half-yearly' ? 2 : 1;
    return { name: p.policyName, annual: (p.premiumAmount ?? 0) * mult, pmt: p.premiumAmount ?? 0, freq: p.premiumFrequency };
  });
  const total = annualized.reduce((a, p) => a + p.annual, 0);
  const lines = [
    `## 💰 Insurance Premiums`,
    ``,
    `**Annual Premium Total: ${formatINR(total)}**`,
    ``,
    `| Policy | Per Payment | Frequency | Annual |`, `|---|---|---|---|`,
    ...annualized.sort((a, b) => b.annual - a.annual).map(
      (p) => `| **${p.name}** | ${formatINR(p.pmt)} | ${p.freq} | ${formatINR(p.annual)} |`,
    ),
    ``,
    `*From your FinTrackly Insurance data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchInsuranceNextRenewal(): AgentDataResult {
  const { insurancePolicies } = usePortfolioStore.getState();
  if (!insurancePolicies.length) return noData('Insurance');
  const today   = new Date().toISOString().slice(0, 10);
  const future  = insurancePolicies.filter((p) => p.renewalDate && p.renewalDate >= today).sort((a, b) => (a.renewalDate ?? '').localeCompare(b.renewalDate ?? ''));
  if (!future.length) return { answer: '📭 No upcoming insurance renewals found.' };
  const next = future[0];
  const lines = [
    `## 🔔 Next Insurance Renewal`,
    ``,
    `**${next.policyName}** — renews on **${next.renewalDate}**`,
    ``,
    `| | |`, `|---|---|`,
    `| **Type** | ${next.type} |`,
    `| **Coverage** | ${formatINR(next.coverageAmount ?? 0)} |`,
    `| **Premium** | ${formatINR(next.premiumAmount ?? 0)} per ${next.premiumFrequency} |`,
    ``,
    future.length > 1 ? `Upcoming renewals:` : '',
    ...future.slice(0, 5).map((p) => `- **${p.policyName}** on ${p.renewalDate}`),
    ``, `*From your FinTrackly Insurance data.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchInsuranceExpiringSoon(): AgentDataResult {
  const { insurancePolicies } = usePortfolioStore.getState();
  if (!insurancePolicies.length) return noData('Insurance');
  const today    = new Date().toISOString().slice(0, 10);
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const soon     = insurancePolicies.filter((p) => p.renewalDate && p.renewalDate >= today && p.renewalDate <= in30days);
  if (!soon.length) return { answer: '✅ No insurance policies renewing within the next 30 days.' };
  const lines = [
    `## ⚠️ Insurance Renewals Within 30 Days`,
    ``,
    `| Policy | Type | Renewal Date | Premium |`, `|---|---|---|---|`,
    ...soon.sort((a, b) => (a.renewalDate ?? '').localeCompare(b.renewalDate ?? '')).map(
      (p) => `| **${p.policyName}** | ${p.type} | ${p.renewalDate} | ${formatINR(p.premiumAmount ?? 0)} |`,
    ),
    ``, `*From your FinTrackly Insurance data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchInsuranceHighestCoverage(): AgentDataResult {
  const { insurancePolicies } = usePortfolioStore.getState();
  if (!insurancePolicies.length) return noData('Insurance');
  const sorted = [...insurancePolicies].sort((a, b) => (b.coverageAmount ?? 0) - (a.coverageAmount ?? 0));
  const top    = sorted[0];
  const lines  = [
    `## 🥇 Highest Coverage Policy`,
    ``,
    `**${top.policyName}** — Coverage: **${formatINR(top.coverageAmount ?? 0)}**`,
    ``,
    `| | |`, `|---|---|`,
    `| **Type** | ${top.type} |`,
    `| **Premium** | ${formatINR(top.premiumAmount ?? 0)} / ${top.premiumFrequency} |`,
    `| **Renewal** | ${top.renewalDate ?? '—'} |`,
    top.nominee ? `| **Nominee** | ${top.nominee} |` : '',
    ``,
    `*From your FinTrackly Insurance data.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchInsuranceHighestPremium(): AgentDataResult {
  const { insurancePolicies } = usePortfolioStore.getState();
  if (!insurancePolicies.length) return noData('Insurance');
  const sorted = [...insurancePolicies].sort((a, b) => (b.premiumAmount ?? 0) - (a.premiumAmount ?? 0));
  const top    = sorted[0];
  const lines  = [
    `## 💰 Most Expensive Policy`,
    ``,
    `**${top.policyName}** — ${formatINR(top.premiumAmount ?? 0)} per ${top.premiumFrequency}`,
    ``,
    `| | |`, `|---|---|`,
    `| **Type** | ${top.type} |`,
    `| **Coverage** | ${formatINR(top.coverageAmount ?? 0)} |`,
    `| **Renewal** | ${top.renewalDate ?? '—'} |`,
    ``,
    `All policies by premium:`,
    ...sorted.map((p, i) => `${i + 1}. **${p.policyName}** — ${formatINR(p.premiumAmount ?? 0)}/${p.premiumFrequency}`),
    ``, `*From your FinTrackly Insurance data.*`,
  ];
  return { answer: lines.join('\n') };
}

// ─── LIABILITIES fetchers ─────────────────────────────────────────────────────

function fetchLiabilitiesData(): AgentDataResult {
  const { liabilities } = usePortfolioStore.getState();
  const active = liabilities.filter((l) => !l.status || l.status === 'active');
  if (!active.length) return { answer: '✅ You have no active liabilities.' };
  const totalOutstanding = active.reduce((a, l) => a + (l.outstanding ?? 0), 0);
  const totalEMI         = active.reduce((a, l) => a + (l.emiAmount ?? 0), 0);
  const sorted           = [...active].sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
  const lines = [
    `## 💳 Your Liabilities`,
    ``,
    `| | |`, `|---|---|`,
    `| **Total Outstanding** | ${formatINR(totalOutstanding)} |`,
    `| **Total Monthly EMI** | ${formatINR(totalEMI)} |`,
    `| **Active Count** | ${active.length} |`,
    ``,
    `| Name | Outstanding | Interest | EMI |`, `|---|---|---|---|`,
    ...sorted.map((l) => `| **${l.name}** | ${formatINR(l.outstanding ?? 0)} | ${l.interestRate ? `${l.interestRate}%` : '—'} | ${l.emiAmount ? formatINR(l.emiAmount) : '—'} |`),
    ``,
    `*From your FinTrackly Liabilities data.*`,
  ];
  return { answer: lines.join('\n'), context: { totalOutstanding, totalEMI, count: active.length } };
}

function fetchLiabilitiesCount(): AgentDataResult {
  const { liabilities } = usePortfolioStore.getState();
  const active   = liabilities.filter((l) => !l.status || l.status === 'active');
  const all      = liabilities.length;
  const byType   = active.reduce((acc, l) => { acc[l.type] = (acc[l.type] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const lines    = [
    `## 💳 Liability Count`,
    ``,
    `**${active.length} active** liability${active.length !== 1 ? 'ies' : ''} (${all} total including closed).`,
    ``,
    `| Type | Count |`, `|---|---|`,
    ...Object.entries(byType).map(([t, c]) => `| ${t} | ${c} |`),
    ``, `*From your FinTrackly Liabilities.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchLiabilitiesHighestInterest(): AgentDataResult {
  const { liabilities } = usePortfolioStore.getState();
  const active  = liabilities.filter((l) => (!l.status || l.status === 'active') && l.interestRate);
  if (!active.length) return { answer: '📭 No active liabilities with interest rates recorded.' };
  const sorted = [...active].sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
  const top    = sorted[0];
  const lines  = [
    `## 🔴 Highest Interest Liability`,
    ``,
    `**${top.name}** at **${top.interestRate}% p.a.**`,
    ``,
    `| | |`, `|---|---|`,
    `| **Outstanding** | ${formatINR(top.outstanding ?? 0)} |`,
    `| **Monthly EMI** | ${top.emiAmount ? formatINR(top.emiAmount) : '—'} |`,
    `| **Type** | ${top.type} |`,
    ``,
    `All liabilities by interest rate:`,
    ...sorted.map((l, i) => `${i + 1}. **${l.name}** — ${l.interestRate}% · ${formatINR(l.outstanding ?? 0)} outstanding`),
    ``, `*Pay the highest-rate debt first to minimise interest cost.*`,
    `*From your FinTrackly Liabilities.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchLiabilitiesHighestBalance(): AgentDataResult {
  const { liabilities } = usePortfolioStore.getState();
  const active = liabilities.filter((l) => !l.status || l.status === 'active');
  if (!active.length) return { answer: '✅ No active liabilities.' };
  const sorted = [...active].sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0));
  const top    = sorted[0];
  const lines  = [
    `## 💰 Highest Outstanding Balance`,
    ``,
    `**${top.name}** — ${formatINR(top.outstanding ?? 0)}`,
    ``,
    `All liabilities by outstanding balance:`,
    `| Name | Outstanding | Rate |`, `|---|---|---|`,
    ...sorted.map((l) => `| **${l.name}** | ${formatINR(l.outstanding ?? 0)} | ${l.interestRate ? `${l.interestRate}%` : '—'} |`),
    ``, `*From your FinTrackly Liabilities.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchLiabilitiesPriority(): AgentDataResult {
  return fetchLiabilitiesHighestInterest();
}

function fetchLiabilitiesDebtRatio(): AgentDataResult {
  const { investments, liabilities } = usePortfolioStore.getState();
  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(investments, liabilities);
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  const lines = [
    `## 📊 Debt-to-Asset Ratio`,
    ``,
    `| | |`, `|---|---|`,
    `| **Total Assets** | ${formatINR(totalAssets)} |`,
    `| **Total Liabilities** | ${formatINR(totalLiabilities)} |`,
    `| **Net Worth** | ${formatINR(netWorth)} |`,
    `| **Debt-to-Asset Ratio** | **${formatNumber(debtRatio, 1)}%** |`,
    ``,
    debtRatio === 0 ? `✅ You have no liabilities — debt-to-asset ratio is 0%.`
      : debtRatio < 30 ? `✅ Healthy (below 30%). Your finances are in solid shape.`
      : debtRatio < 60 ? `⚠️ Moderate (30–60%). Acceptable if you have a home loan, but watch it.`
      : `🔴 High (above 60%). Focus on reducing liabilities before making new investments.`,
    ``,
    `*From your FinTrackly data.*`,
  ];
  return { answer: lines.join('\n') };
}

// ─── GOALS fetchers ───────────────────────────────────────────────────────────

function goalSaved(g: { currentAmount: number; id: string }, contribs: { goalId: string; amount: number }[]) {
  return g.currentAmount + contribs.filter((c) => c.goalId === g.id).reduce((a, c) => a + c.amount, 0);
}

function fetchGoalsData(): AgentDataResult {
  const { goals, goalContributions } = usePortfolioStore.getState();
  const active = goals.filter((g) => !g.status || g.status === 'active');
  if (!active.length) return noData('Goals');
  const lines = [`## 🎯 Your Financial Goals`, ``];
  active.forEach((g) => {
    const saved    = goalSaved(g, goalContributions);
    const progress = g.targetAmount > 0 ? Math.min(100, (saved / g.targetAmount) * 100) : 0;
    const remain   = Math.max(0, g.targetAmount - saved);
    lines.push(
      `### ${g.name}`,
      `Target: **${formatINR(g.targetAmount)}** · Saved: **${formatINR(saved)}** · Progress: **${formatNumber(progress, 0)}%**`,
      remain > 0 ? `Remaining: ${formatINR(remain)}` : `✅ Goal achieved!`,
      g.dueDate ? `Due: ${g.dueDate}` : '',
      ``,
    );
  });
  lines.push(`*From your FinTrackly Goals data.*`);
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchGoalsClosest(): AgentDataResult {
  const { goals, goalContributions } = usePortfolioStore.getState();
  const active = goals.filter((g) => (!g.status || g.status === 'active') && g.targetAmount > 0);
  if (!active.length) return noData('Goals');
  const withProgress = active.map((g) => {
    const saved    = goalSaved(g, goalContributions);
    const progress = Math.min(100, (saved / g.targetAmount) * 100);
    return { ...g, saved, progress };
  }).sort((a, b) => b.progress - a.progress);
  const top  = withProgress[0];
  const lines = [
    `## 🎯 Goal Closest to Completion`,
    ``,
    `**${top.name}** — **${formatNumber(top.progress, 1)}% complete**`,
    ``,
    `| | |`, `|---|---|`,
    `| **Target** | ${formatINR(top.targetAmount)} |`,
    `| **Saved** | ${formatINR(top.saved)} |`,
    `| **Remaining** | ${formatINR(Math.max(0, top.targetAmount - top.saved))} |`,
    top.dueDate ? `| **Due** | ${top.dueDate} |` : '',
    ``,
    `All goals by progress:`,
    ...withProgress.map((g) => `- **${g.name}**: ${formatNumber(g.progress, 0)}% — ${formatINR(g.saved)} / ${formatINR(g.targetAmount)}`),
    ``, `*From your FinTrackly Goals data.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchGoalsLowestProgress(): AgentDataResult {
  const { goals, goalContributions } = usePortfolioStore.getState();
  const active = goals.filter((g) => (!g.status || g.status === 'active') && g.targetAmount > 0);
  if (!active.length) return noData('Goals');
  const sorted = active.map((g) => {
    const saved    = goalSaved(g, goalContributions);
    const progress = Math.min(100, (saved / g.targetAmount) * 100);
    return { ...g, saved, progress };
  }).sort((a, b) => a.progress - b.progress);
  const bottom = sorted[0];
  const lines = [
    `## 🎯 Goal with Lowest Progress`,
    ``,
    `**${bottom.name}** — **${formatNumber(bottom.progress, 1)}%** complete`,
    ``,
    `| | |`, `|---|---|`,
    `| **Target** | ${formatINR(bottom.targetAmount)} |`,
    `| **Saved So Far** | ${formatINR(bottom.saved)} |`,
    `| **Still Needed** | ${formatINR(Math.max(0, bottom.targetAmount - bottom.saved))} |`,
    bottom.dueDate ? `| **Due** | ${bottom.dueDate} |` : '',
    ``, `*From your FinTrackly Goals data.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchGoalsRemaining(): AgentDataResult {
  const { goals, goalContributions } = usePortfolioStore.getState();
  const active = goals.filter((g) => !g.status || g.status === 'active');
  if (!active.length) return noData('Goals');
  const lines = [
    `## 💰 Remaining Amount for Each Goal`,
    ``,
    `| Goal | Target | Saved | Remaining | Progress |`, `|---|---|---|---|---|`,
    ...active.map((g) => {
      const saved   = goalSaved(g, goalContributions);
      const remain  = Math.max(0, g.targetAmount - saved);
      const pctVal  = g.targetAmount > 0 ? Math.min(100, (saved / g.targetAmount) * 100) : 0;
      return `| **${g.name}** | ${formatINR(g.targetAmount)} | ${formatINR(saved)} | ${formatINR(remain)} | ${formatNumber(pctVal, 0)}% |`;
    }),
    ``, `*From your FinTrackly Goals.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchGoalsCompletionRate(): AgentDataResult {
  const { goals, goalContributions } = usePortfolioStore.getState();
  if (!goals.length) return noData('Goals');
  const completed = goals.filter((g) => g.status === 'completed' || g.status === 'success');
  const active    = goals.filter((g) => !g.status || g.status === 'active');
  const totalSaved = active.reduce((a, g) => a + goalSaved(g, goalContributions), 0);
  const totalTarget = active.reduce((a, g) => a + g.targetAmount, 0);
  const lines = [
    `## 📊 Goal Completion Overview`,
    ``,
    `| | |`, `|---|---|`,
    `| **Total Goals** | ${goals.length} |`,
    `| **✅ Completed** | ${completed.length} |`,
    `| **🎯 Active** | ${active.length} |`,
    `| **Completion Rate** | ${formatNumber(goals.length > 0 ? (completed.length / goals.length) * 100 : 0, 0)}% |`,
    ``,
    active.length
      ? `Active goals progress: **${formatINR(totalSaved)}** saved of **${formatINR(totalTarget)}** target (${formatNumber(totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0, 0)}%)`
      : '',
    ``, `*From your FinTrackly Goals.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchGoalsNearestDeadline(): AgentDataResult {
  const { goals, goalContributions } = usePortfolioStore.getState();
  const withDue = goals.filter((g) => g.dueDate && (!g.status || g.status === 'active')).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  if (!withDue.length) return { answer: '📭 None of your active goals have a deadline set.' };
  const next = withDue[0];
  const saved = goalSaved(next, goalContributions);
  const progress = next.targetAmount > 0 ? Math.min(100, (saved / next.targetAmount) * 100) : 0;
  const lines = [
    `## 📅 Goal with Nearest Deadline`,
    ``,
    `**${next.name}** — Due: **${next.dueDate}**`,
    ``,
    `| | |`, `|---|---|`,
    `| **Target** | ${formatINR(next.targetAmount)} |`,
    `| **Saved** | ${formatINR(saved)} |`,
    `| **Progress** | ${formatNumber(progress, 0)}% |`,
    `| **Remaining** | ${formatINR(Math.max(0, next.targetAmount - saved))} |`,
    ``,
    `All deadlines:`,
    ...withDue.map((g) => `- **${g.name}**: due ${g.dueDate}`),
    ``, `*From your FinTrackly Goals.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchGoalsOnTrack(): AgentDataResult {
  const { goals, goalContributions, cashflows } = usePortfolioStore.getState();
  const active  = goals.filter((g) => (!g.status || g.status === 'active') && g.targetAmount > 0);
  if (!active.length) return noData('Goals');
  const avgSurplus = monthlyAvg(cashflows, 'income') - monthlyAvg(cashflows, 'expense');
  const today      = new Date().toISOString().slice(0, 10);
  const lines      = [`## 🎯 Are You On Track?`, ``];
  active.forEach((g) => {
    const saved    = goalSaved(g, goalContributions);
    const remain   = Math.max(0, g.targetAmount - saved);
    const progress = Math.min(100, (saved / g.targetAmount) * 100);
    if (!g.dueDate || remain === 0) {
      lines.push(`**${g.name}**: ${formatNumber(progress, 0)}% complete — ${remain > 0 ? formatINR(remain) + ' remaining' : '✅ achieved'}`, ``);
      return;
    }
    const msLeft       = new Date(g.dueDate).getTime() - new Date(today).getTime();
    const monthsLeft   = Math.max(0, msLeft / (30 * 86400000));
    const neededMonth  = monthsLeft > 0 ? remain / monthsLeft : Infinity;
    const onTrack      = avgSurplus > 0 && neededMonth <= avgSurplus;
    lines.push(
      `**${g.name}**: ${formatNumber(progress, 0)}% · ${formatINR(remain)} needed by ${g.dueDate}`,
      `→ Need to save **${formatINR(neededMonth)}/month** · Avg surplus: ${formatINR(avgSurplus)}/month`,
      onTrack ? `✅ On track` : `⚠️ May fall short — consider increasing monthly contributions.`,
      ``,
    );
  });
  lines.push(`*From your FinTrackly Goals and Cashflow data.*`);
  return { answer: lines.join('\n') };
}

function fetchGoalsSavingsNeeded(): AgentDataResult {
  return fetchGoalsOnTrack();
}

function fetchGoalsNextFocus(): AgentDataResult {
  const { goals, goalContributions } = usePortfolioStore.getState();
  const active = goals.filter((g) => (!g.status || g.status === 'active') && g.targetAmount > 0);
  if (!active.length) return noData('Goals');
  // Priority: overdue deadline first, then lowest progress
  const today = new Date().toISOString().slice(0, 10);
  const scored = active.map((g) => {
    const saved    = goalSaved(g, goalContributions);
    const progress = Math.min(100, (saved / g.targetAmount) * 100);
    const isOverdue = g.dueDate && g.dueDate < today;
    return { ...g, saved, progress, isOverdue };
  }).sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.progress - b.progress;
  });
  const top   = scored[0];
  const lines = [
    `## 🎯 Goal to Focus on Next`,
    ``,
    `**${top.name}**`,
    ``,
    `| | |`, `|---|---|`,
    `| **Progress** | ${formatNumber(top.progress, 0)}% |`,
    `| **Saved** | ${formatINR(top.saved)} |`,
    `| **Target** | ${formatINR(top.targetAmount)} |`,
    `| **Remaining** | ${formatINR(Math.max(0, top.targetAmount - top.saved))} |`,
    top.dueDate ? `| **Deadline** | ${top.dueDate}${top.isOverdue ? ' ⚠️ Overdue' : ''} |` : '',
    ``,
    `*Recommended because it has the ${top.isOverdue ? 'overdue deadline' : 'lowest progress'}.*`,
    `*From your FinTrackly Goals.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

// ─── ACCOUNTS fetchers ────────────────────────────────────────────────────────

function fetchAccountsData(): AgentDataResult {
  const { accounts } = usePortfolioStore.getState();
  if (!accounts.length) return noData('Accounts');
  const total = accounts.reduce((a, ac) => a + (ac.balance ?? 0), 0);
  const sorted = [...accounts].sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
  const lines = [
    `## 🏦 Your Accounts`,
    ``,
    `**Total Balance: ${formatINR(total)}** across ${accounts.length} account(s)`,
    ``,
    `| Account | Type | Balance | Share |`, `|---|---|---|---|`,
    ...sorted.map((ac) => `| **${ac.name}** | ${ac.type} | ${formatINR(ac.balance ?? 0)} | ${pct(ac.balance ?? 0, total)} |`),
    ``, `*From your FinTrackly Accounts.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchAccountsCount(): AgentDataResult {
  const { accounts } = usePortfolioStore.getState();
  if (!accounts.length) return noData('Accounts');
  const byType = accounts.reduce((acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const lines  = [
    `## 🏦 Account Count`,
    ``,
    `You have **${accounts.length}** account(s).`,
    ``,
    `| Type | Count |`, `|---|---|`,
    ...Object.entries(byType).map(([t, c]) => `| ${t} | ${c} |`),
    ``, `*From your FinTrackly Accounts.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchAccountsHighest(): AgentDataResult {
  const { accounts } = usePortfolioStore.getState();
  if (!accounts.length) return noData('Accounts');
  const sorted = [...accounts].sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
  const top    = sorted[0];
  const total  = accounts.reduce((a, ac) => a + (ac.balance ?? 0), 0);
  const lines  = [
    `## 🥇 Account with Highest Balance`,
    ``,
    `**${top.name}** — ${formatINR(top.balance ?? 0)}`,
    ``,
    `| | |`, `|---|---|`,
    `| **Type** | ${top.type} |`,
    `| **Balance** | ${formatINR(top.balance ?? 0)} |`,
    `| **Share of Total** | ${pct(top.balance ?? 0, total)} |`,
    ``,
    sorted.length > 1 ? `All accounts by balance:` : '',
    ...sorted.map((ac, i) => `${i + 1}. **${ac.name}** — ${formatINR(ac.balance ?? 0)}`),
    ``, `*From your FinTrackly Accounts.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchAccountsDistribution(): AgentDataResult {
  const { accounts, investments } = usePortfolioStore.getState();
  const { totalAssets } = calculateNetWorth(investments, []);
  if (!accounts.length) return noData('Accounts');
  const total  = accounts.reduce((a, ac) => a + (ac.balance ?? 0), 0);
  const sorted = [...accounts].sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
  const lines  = [
    `## 📊 Wealth Distribution Across Accounts`,
    ``,
    `**Total Account Balance: ${formatINR(total)}**`,
    totalAssets > 0 ? `That's ${pct(total, totalAssets)} of your total asset value.` : '',
    ``,
    `| Account | Balance | Share |`, `|---|---|---|`,
    ...sorted.map((ac) => `| **${ac.name}** | ${formatINR(ac.balance ?? 0)} | ${pct(ac.balance ?? 0, total)} |`),
    ``, `*From your FinTrackly Accounts.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchAccountsCash(): AgentDataResult {
  const { accounts, essentials } = usePortfolioStore.getState();
  const bankAccounts = accounts.filter((a) => a.type === 'bank');
  const total  = bankAccounts.reduce((a, ac) => a + (ac.balance ?? 0), 0);
  const efCurr = essentials.emergencyFundCurrent ?? 0;
  const lines  = [
    `## 💵 Cash Position`,
    ``,
    `| | |`, `|---|---|`,
    `| **Bank Account Balance** | ${formatINR(total)} |`,
    `| **Emergency Fund (set aside)** | ${formatINR(efCurr)} |`,
    `| **Total Liquid Cash** | ${formatINR(total + efCurr)} |`,
    ``,
    ...bankAccounts.map((ac) => `- **${ac.name}**: ${formatINR(ac.balance ?? 0)}`),
    ``, `*From your FinTrackly Accounts and Essentials.*`,
  ];
  return { answer: lines.join('\n') };
}

// ─── LENDING fetchers ─────────────────────────────────────────────────────────

function getLendingStats() {
  const { lendingBorrowers, lendingTransactions } = usePortfolioStore.getState();
  return lendingBorrowers.map((b) => {
    const txns     = lendingTransactions.filter((t) => t.borrowerId === b.id);
    const given    = txns.filter((t) => t.type === 'principal_given').reduce((a, t) => a + t.amount, 0);
    const returned = txns.filter((t) => t.type === 'principal_returned').reduce((a, t) => a + t.amount, 0);
    const interest = txns.filter((t) => t.type === 'interest_paid').reduce((a, t) => a + t.amount, 0);
    return { ...b, given, returned, outstanding: given - returned, interest };
  });
}

function fetchLendingData(): AgentDataResult {
  const stats  = getLendingStats();
  const active = stats.filter((b) => b.status === 'active');
  if (!active.length) return noData('Lending');
  const totalGiven       = active.reduce((a, b) => a + b.given, 0);
  const totalOutstanding = active.reduce((a, b) => a + b.outstanding, 0);
  const totalInterest    = active.reduce((a, b) => a + b.interest, 0);
  const lines = [
    `## 🤝 Lending Overview`,
    ``,
    `| | |`, `|---|---|`,
    `| **Total Lent** | ${formatINR(totalGiven)} |`,
    `| **Total Outstanding** | ${formatINR(totalOutstanding)} |`,
    `| **Interest Received** | ${formatINR(totalInterest)} |`,
    `| **Active Borrowers** | ${active.length} |`,
    ``,
    `| Borrower | Lent | Returned | Outstanding | Interest |`, `|---|---|---|---|---|`,
    ...active.sort((a, b) => b.outstanding - a.outstanding).map(
      (b) => `| **${b.name}** | ${formatINR(b.given)} | ${formatINR(b.returned)} | ${formatINR(b.outstanding)} | ${formatINR(b.interest)} |`,
    ),
    ``, `*From your FinTrackly Lending data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchLendingTotal(): AgentDataResult {
  const stats = getLendingStats();
  if (!stats.length) return noData('Lending');
  const total   = stats.reduce((a, b) => a + b.given, 0);
  const active  = stats.filter((b) => b.status === 'active');
  const closed  = stats.filter((b) => b.status === 'closed');
  const lines   = [
    `## 💰 Total Money Lent`,
    ``,
    `| | |`, `|---|---|`,
    `| **Total Lent (all time)** | ${formatINR(total)} |`,
    `| **Active Loans** | ${active.length} (${formatINR(active.reduce((a, b) => a + b.given, 0))}) |`,
    `| **Closed Loans** | ${closed.length} (${formatINR(closed.reduce((a, b) => a + b.given, 0))}) |`,
    ``, `*From your FinTrackly Lending data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchLendingOutstanding(): AgentDataResult {
  const stats  = getLendingStats().filter((b) => b.status === 'active' && b.outstanding > 0);
  if (!stats.length) return { answer: '✅ All lending amounts have been fully recovered.' };
  const total  = stats.reduce((a, b) => a + b.outstanding, 0);
  const sorted = [...stats].sort((a, b) => b.outstanding - a.outstanding);
  const lines  = [
    `## 💰 Outstanding Lending`,
    ``,
    `**Total Outstanding: ${formatINR(total)}** from ${stats.length} borrower(s)`,
    ``,
    `| Borrower | Lent | Returned | Outstanding |`, `|---|---|---|---|`,
    ...sorted.map((b) => `| **${b.name}** | ${formatINR(b.given)} | ${formatINR(b.returned)} | **${formatINR(b.outstanding)}** |`),
    ``, `*From your FinTrackly Lending data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchLendingBorrowerCount(): AgentDataResult {
  const stats  = getLendingStats();
  const active = stats.filter((b) => b.status === 'active');
  const closed = stats.filter((b) => b.status === 'closed');
  const lines  = [
    `## 👥 Borrower Count`,
    ``,
    `| | |`, `|---|---|`,
    `| **Active Borrowers** | ${active.length} |`,
    `| **Closed / Repaid** | ${closed.length} |`,
    `| **Total** | ${stats.length} |`,
    ``, `*From your FinTrackly Lending data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchLendingTopBorrower(): AgentDataResult {
  const stats  = getLendingStats().filter((b) => b.status === 'active');
  if (!stats.length) return noData('Lending');
  const sorted = [...stats].sort((a, b) => b.outstanding - a.outstanding);
  const top    = sorted[0];
  const lines  = [
    `## 🥇 Borrower Who Owes the Most`,
    ``,
    `**${top.name}** — Outstanding: **${formatINR(top.outstanding)}**`,
    ``,
    `| | |`, `|---|---|`,
    `| **Total Lent** | ${formatINR(top.given)} |`,
    `| **Returned** | ${formatINR(top.returned)} |`,
    `| **Outstanding** | ${formatINR(top.outstanding)} |`,
    `| **Interest Received** | ${formatINR(top.interest)} |`,
    top.interestRate ? `| **Interest Rate** | ${top.interestRate}% p.a. |` : '',
    ``,
    sorted.length > 1 ? `All active borrowers by outstanding:` : '',
    ...sorted.map((b) => `- **${b.name}**: ${formatINR(b.outstanding)}`),
    ``, `*From your FinTrackly Lending data.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchLendingInterestCollected(): AgentDataResult {
  const stats = getLendingStats();
  if (!stats.length) return noData('Lending');
  const total   = stats.reduce((a, b) => a + b.interest, 0);
  const withInt = stats.filter((b) => b.interest > 0).sort((a, b) => b.interest - a.interest);
  const lines   = [
    `## 💹 Interest Received from Lending`,
    ``,
    `**Total Interest Collected: ${formatINR(total)}**`,
    ``,
    withInt.length
      ? `| Borrower | Interest Received |\n|---|---|\n` +
        withInt.map((b) => `| **${b.name}** | ${formatINR(b.interest)} |`).join('\n')
      : `No interest payments recorded yet.`,
    ``, `*From your FinTrackly Lending data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchLendingHighestRate(): AgentDataResult {
  const { lendingBorrowers } = usePortfolioStore.getState();
  const withRate = lendingBorrowers.filter((b) => b.status === 'active' && b.interestRate).sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
  if (!withRate.length) return { answer: '📭 No interest rates set for active lending records.' };
  const top   = withRate[0];
  const stats = getLendingStats();
  const topStats = stats.find((b) => b.id === top.id);
  const lines = [
    `## 📈 Lending with Highest Interest Rate`,
    ``,
    `**${top.name}** at **${top.interestRate}% p.a.**`,
    ``,
    topStats
      ? `| | |\n|---|---|\n| **Outstanding** | ${formatINR(topStats.outstanding)} |\n| **Interest Collected** | ${formatINR(topStats.interest)} |`
      : '',
    ``,
    `All rates:`,
    ...withRate.map((b) => `- **${b.name}**: ${b.interestRate}% p.a.`),
    ``, `*From your FinTrackly Lending data.*`,
  ];
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

function fetchLendingOverdue(): AgentDataResult {
  const { lendingBorrowers } = usePortfolioStore.getState();
  const today   = new Date().toISOString().slice(0, 10);
  const overdue = lendingBorrowers.filter((b) => b.status === 'active' && b.nextDueDate && b.nextDueDate < today);
  if (!overdue.length) return { answer: '✅ No overdue lending repayments found.' };
  const stats = getLendingStats();
  const lines = [
    `## ⚠️ Overdue Lending Repayments`,
    ``,
    `| Borrower | Due Date | Outstanding |`, `|---|---|---|`,
    ...overdue.map((b) => {
      const s = stats.find((x) => x.id === b.id);
      return `| **${b.name}** | ${b.nextDueDate} ⚠️ | ${s ? formatINR(s.outstanding) : '—'} |`;
    }),
    ``, `*From your FinTrackly Lending data.*`,
  ];
  return { answer: lines.join('\n') };
}

function fetchLendingRecovered(): AgentDataResult {
  const stats = getLendingStats();
  if (!stats.length) return noData('Lending');
  const totalGiven     = stats.reduce((a, b) => a + b.given, 0);
  const totalReturned  = stats.reduce((a, b) => a + b.returned, 0);
  const totalInterest  = stats.reduce((a, b) => a + b.interest, 0);
  const totalRecovered = totalReturned + totalInterest;
  const lines = [
    `## 💰 Lending Recovery Summary`,
    ``,
    `| | |`, `|---|---|`,
    `| **Total Lent** | ${formatINR(totalGiven)} |`,
    `| **Principal Returned** | ${formatINR(totalReturned)} |`,
    `| **Interest Collected** | ${formatINR(totalInterest)} |`,
    `| **Total Recovered** | **${formatINR(totalRecovered)}** |`,
    `| **Still Outstanding** | ${formatINR(Math.max(0, totalGiven - totalReturned))} |`,
    ``, `*From your FinTrackly Lending data.*`,
  ];
  return { answer: lines.join('\n') };
}

// ─── NET WORTH / STOCK LOOKUP helpers ────────────────────────────────────────

function fetchNetWorthData(): AgentDataResult {
  const { investments, liabilities } = usePortfolioStore.getState();
  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(investments, liabilities);
  if (totalAssets === 0 && totalLiabilities === 0) return noData('financial');
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  const lines = [
    `## 💰 Your Net Worth`,
    ``,
    `| | |`, `|---|---|`,
    `| **Total Assets** | ${formatINR(totalAssets)} |`,
    `| **Total Liabilities** | ${formatINR(totalLiabilities)} |`,
    `| **Net Worth** | **${formatINR(netWorth)}** |`,
    `| **Debt-to-Asset Ratio** | ${formatNumber(debtRatio, 1)}% |`,
    ``,
    debtRatio < 30 ? `✅ Healthy debt-to-asset ratio.`
      : debtRatio < 60 ? `⚠️ Moderate debt-to-asset ratio.`
      : `🔴 High debt-to-asset ratio — prioritise reducing liabilities.`,
    ``,
    `*From your FinTrackly data.*`,
  ];
  return { answer: lines.join('\n'), context: { totalAssets, totalLiabilities, netWorth, debtRatioPct: debtRatio } };
}

function fetchStockBySymbol(symbol: string): AgentDataResult {
  const { investments } = usePortfolioStore.getState();
  const upper   = symbol.toUpperCase();
  const matches = investments.filter((inv) => {
    const sym  = (inv.symbol  ?? '').toUpperCase();
    const name = (inv.name    ?? '').toUpperCase();
    return sym === upper || sym.includes(upper) || name.includes(upper);
  });
  if (!matches.length) {
    return {
      answer: `📭 No investment matching **${symbol}** found in your FinTrackly portfolio.\n\n` +
        `Check the **Investments** page for the exact name or ticker, then try again.`,
    };
  }
  const lines: string[] = [`## 🔍 ${symbol} — Your Holdings`];
  for (const inv of matches) {
    lines.push('');
    if (inv.type === 'stock') {
      const s  = inv as StockInvestment;
      const iv = s.quantity * s.buyPrice;
      const cv = s.quantity * s.currentPrice;
      const pl = cv - iv;
      const pp = iv > 0 ? (pl / iv) * 100 : 0;
      lines.push(
        `### 📈 ${s.name}${s.symbol && s.symbol !== s.name ? ` (${s.symbol})` : ''}`,
        ``,
        `| | |`, `|---|---|`,
        `| **Quantity** | ${formatNumber(s.quantity, 2)} shares |`,
        `| **Buy Price** | ${formatINR(s.buyPrice)} |`,
        `| **Current Price** | ${formatINR(s.currentPrice)} |`,
        `| **Invested** | ${formatINR(iv)} |`,
        `| **Current Value** | ${formatINR(cv)} |`,
        `| **P&L** | ${plSign(pl)}${formatINR(pl)} (${plSign(pp)}${formatNumber(pp, 1)}%) |`,
        s.sector   ? `| **Sector** | ${s.sector} |`    : '',
        s.platform ? `| **Platform** | ${s.platform} |` : '',
      );
      if (s.lots && s.lots.length > 1) {
        lines.push('', `**Lots (${s.lots.length})**`);
        s.lots.forEach((lot) => lines.push(`- ${lot.date}: ${formatNumber(lot.quantity, 2)} shares @ ${formatINR(lot.buyPrice)}`));
      }
    } else if (inv.type === 'mutual_fund') {
      const m  = inv as MutualFundInvestment;
      const cv = m.units * m.nav;
      const pl = cv - m.investedAmount;
      const pp = m.investedAmount > 0 ? (pl / m.investedAmount) * 100 : 0;
      lines.push(
        `### 🏦 ${m.name}`,
        ``,
        `| | |`, `|---|---|`,
        `| **Units** | ${formatNumber(m.units, 3)} |`,
        `| **NAV** | ${formatINR(m.nav)} |`,
        `| **Invested** | ${formatINR(m.investedAmount)} |`,
        `| **Current Value** | ${formatINR(cv)} |`,
        `| **P&L** | ${plSign(pl)}${formatINR(pl)} (${plSign(pp)}${formatNumber(pp, 1)}%) |`,
        m.platform ? `| **Platform** | ${m.platform} |` : '',
      );
    } else {
      const iv = investedValue(inv);
      const cv = currentValue(inv);
      const pl = cv - iv;
      const pp = iv > 0 ? (pl / iv) * 100 : 0;
      lines.push(
        `### 💼 ${inv.name}`,
        ``,
        `| | |`, `|---|---|`,
        `| **Type** | ${inv.type.replace('_', ' ')} |`,
        `| **Invested** | ${formatINR(iv)} |`,
        `| **Current Value** | ${formatINR(cv)} |`,
        `| **P&L** | ${plSign(pl)}${formatINR(pl)} (${plSign(pp)}${formatNumber(pp, 1)}%) |`,
      );
    }
  }
  lines.push('', `*${matches.length > 1 ? `${matches.length} matching holdings found. ` : ''}From your FinTrackly portfolio.*`);
  return { answer: lines.filter((l) => l !== '').join('\n') };
}

// ─── TODAY / WEEK helpers already defined above ───────────────────────────────

// ─── REPORT ───────────────────────────────────────────────────────────────────

export function generateFullReport(): string {
  const {
    investments, liabilities, cashflows, goals, accounts,
    trackedPayments, insurancePolicies, lendingBorrowers,
  } = usePortfolioStore.getState();
  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorth(investments, liabilities);
  const avgIncome  = monthlyAvg(cashflows, 'income');
  const avgExpense = monthlyAvg(cashflows, 'expense');
  const avgSurplus = avgIncome - avgExpense;
  const sections: string[] = [];

  sections.push(`## 🧠 Financial Overview`, ``,
    `| | |`, `|---|---|`,
    `| **Net Worth** | ${formatINR(netWorth)} |`,
    `| **Total Assets** | ${formatINR(totalAssets)} |`,
    `| **Total Liabilities** | ${formatINR(totalLiabilities)} |`,
    `| **Monthly Surplus** | ${plSign(avgSurplus)}${formatINR(avgSurplus)} |`,
    ``,
  );

  if (investments.length)           sections.push(fetchPortfolioData().answer, ``);
  if (cashflows.length)             sections.push(fetchCashflowData().answer, ``);
  const activeLiab = liabilities.filter((l) => !l.status || l.status === 'active');
  if (activeLiab.length)            sections.push(fetchLiabilitiesData().answer, ``);
  if (trackedPayments.filter((p) => p.status === 'pending').length)
                                    sections.push(fetchPaymentsData().answer, ``);
  if (goals.filter((g) => !g.status || g.status === 'active').length)
                                    sections.push(fetchGoalsData().answer, ``);
  if (insurancePolicies.length)     sections.push(fetchInsuranceData().answer, ``);
  if (accounts.length)              sections.push(fetchAccountsData().answer, ``);
  if (lendingBorrowers.filter((b) => b.status === 'active').length)
                                    sections.push(fetchLendingData().answer, ``);

  return sections.length > 1
    ? sections.join('\n')
    : '📭 No financial data found. Add records across FinTrackly modules to generate a report.';
}

// ─── Public dispatcher ────────────────────────────────────────────────────────

export function fetchPersonalData(
  intent: string,
  symbol?: string,
  dateScope?: 'today' | 'this_week' | 'this_month',
): AgentDataResult {
  if (intent === 'stock_lookup' && symbol) return fetchStockBySymbol(symbol);
  if (intent === 'cashflow' && dateScope === 'today')     return fetchTodayCashflow();
  if (intent === 'cashflow' && dateScope === 'this_week') return fetchWeekCashflow();

  switch (intent) {
    // Dashboard
    case 'dashboard': return fetchDashboard();

    // Portfolio
    case 'portfolio':                  return fetchPortfolioData();
    case 'portfolio_best':             return fetchPortfolioBest();
    case 'portfolio_worst':            return fetchPortfolioWorst();
    case 'portfolio_profitable_count': return fetchPortfolioProfitableCount();
    case 'portfolio_loss_count':       return fetchPortfolioLossCount();
    case 'portfolio_best_pct':         return fetchPortfolioBestPct();
    case 'portfolio_sectors':          return fetchPortfolioSectors();
    case 'portfolio_pnl':              return fetchPortfolioPnl();
    case 'portfolio_invested':         return fetchPortfolioInvested();
    case 'portfolio_value':            return fetchPortfolioValue();

    // Cashflow
    case 'cashflow':                        return fetchCashflowData();
    case 'cashflow_categories':             return fetchCashflowCategories();
    case 'cashflow_peak_expense_month':     return fetchCashflowPeakExpenseMonth();
    case 'cashflow_peak_income_month':      return fetchCashflowPeakIncomeMonth();
    case 'cashflow_trend':                  return fetchCashflowTrend();
    case 'cashflow_overspend':              return fetchCashflowOverspend();

    // Payments
    case 'payments':           return fetchPaymentsData();
    case 'payments_week':      return fetchPaymentsWeek();
    case 'payments_month':     return fetchPaymentsMonth();
    case 'payments_overdue':   return fetchPaymentsOverdue();
    case 'payments_recurring': return fetchPaymentsRecurring();
    case 'payments_largest':   return fetchPaymentsLargest();
    case 'payments_next':      return fetchPaymentsNext();
    case 'payments_paid':      return fetchPaymentsPaid();

    // Insurance
    case 'insurance':                   return fetchInsuranceData();
    case 'insurance_count':             return fetchInsuranceCount();
    case 'insurance_coverage':          return fetchInsuranceCoverage();
    case 'insurance_premium':           return fetchInsurancePremium();
    case 'insurance_next_renewal':      return fetchInsuranceNextRenewal();
    case 'insurance_expiring_soon':     return fetchInsuranceExpiringSoon();
    case 'insurance_highest_coverage':  return fetchInsuranceHighestCoverage();
    case 'insurance_highest_premium':   return fetchInsuranceHighestPremium();

    // Liabilities
    case 'liabilities':                  return fetchLiabilitiesData();
    case 'liabilities_count':            return fetchLiabilitiesCount();
    case 'liabilities_highest_interest': return fetchLiabilitiesHighestInterest();
    case 'liabilities_highest_balance':  return fetchLiabilitiesHighestBalance();
    case 'liabilities_priority':         return fetchLiabilitiesPriority();
    case 'liabilities_debt_ratio':       return fetchLiabilitiesDebtRatio();

    // Goals
    case 'goals':                  return fetchGoalsData();
    case 'goals_closest':          return fetchGoalsClosest();
    case 'goals_lowest_progress':  return fetchGoalsLowestProgress();
    case 'goals_remaining':        return fetchGoalsRemaining();
    case 'goals_completion_rate':  return fetchGoalsCompletionRate();
    case 'goals_nearest_deadline': return fetchGoalsNearestDeadline();
    case 'goals_on_track':         return fetchGoalsOnTrack();
    case 'goals_savings_needed':   return fetchGoalsSavingsNeeded();
    case 'goals_next_focus':       return fetchGoalsNextFocus();

    // Accounts
    case 'accounts':              return fetchAccountsData();
    case 'accounts_count':        return fetchAccountsCount();
    case 'accounts_highest':      return fetchAccountsHighest();
    case 'accounts_distribution': return fetchAccountsDistribution();
    case 'accounts_cash':         return fetchAccountsCash();

    // Lending
    case 'lending':                    return fetchLendingData();
    case 'lending_total':              return fetchLendingTotal();
    case 'lending_outstanding':        return fetchLendingOutstanding();
    case 'lending_borrower_count':     return fetchLendingBorrowerCount();
    case 'lending_top_borrower':       return fetchLendingTopBorrower();
    case 'lending_interest_collected': return fetchLendingInterestCollected();
    case 'lending_highest_rate':       return fetchLendingHighestRate();
    case 'lending_overdue':            return fetchLendingOverdue();
    case 'lending_recovered':          return fetchLendingRecovered();

    // Fallbacks
    case 'net_worth':
    case 'general_personal':
    default:
      return fetchNetWorthData();
  }
}

export function buildExplainContext(intent: string): Record<string, unknown> {
  const result = fetchPersonalData(intent);
  return result.context ?? {};
}

// ─── Structured response dispatcher ──────────────────────────────────────────
//
// Maps every intent to a typed AgentResponse from aiAgentTools.ts.
// AIAgentPage calls this — fetchPersonalData is kept for generateFullReport.
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentResponse } from './aiAgentResponseTypes';
import { textResponse } from './aiAgentResponseTypes';
import {
  getFinancialOverview,
  getNetWorth,
  getPortfolioSummary,
  getLosingInvestments,
  getTopInvestments,
  getInvestmentBySymbol,
  getPortfolioProfitableCount,
  getPortfolioSectors,
  getCashflowSummary,
  getCashflowCategories,
  getPaymentsDueSoon,
  getPaymentsOverdue,
  getNextPayment,
  getInsuranceSummary,
  getNextInsuranceRenewal,
  getLiabilitiesSummary,
  getHighestInterestLiability,
  getDebtRatio,
  getGoalsSummary,
  getGoalClosestToCompletion,
  getGoalsOnTrack,
  getAccountsSummary,
  getLendingSummary,
  getLendingOutstanding,
} from './aiAgentTools';

export function fetchAgentResponse(
  intent: string,
  symbol?: string,
  dateScope?: 'today' | 'this_week' | 'this_month',
): AgentResponse {
  // Dev trace — log every routing decision so mismatches are visible in console
  if (process.env.NODE_ENV !== 'production') {
    console.info('[AIAgent] fetchAgentResponse →', { intent, symbol, dateScope });
  }
  // Stock / fund specific lookup
  if (intent === 'stock_lookup' && symbol) return getInvestmentBySymbol(symbol);

  // Date-scoped cashflow
  if (intent === 'cashflow') return getCashflowSummary(dateScope);

  switch (intent) {
    // Dashboard / overview
    case 'dashboard':           return getFinancialOverview();
    case 'net_worth':           return getNetWorth();
    case 'general_personal':    return getFinancialOverview();

    // Portfolio
    case 'portfolio':                  return getPortfolioSummary();
    case 'portfolio_best':             return getTopInvestments();
    case 'portfolio_worst':            return getLosingInvestments();
    case 'portfolio_profitable_count': return getPortfolioProfitableCount();
    case 'portfolio_loss_count':       return getLosingInvestments();
    case 'portfolio_best_pct':         return getTopInvestments();
    case 'portfolio_sectors':          return getPortfolioSectors();
    case 'portfolio_pnl':              return getPortfolioSummary();
    case 'portfolio_invested':         return getPortfolioSummary();
    case 'portfolio_value':            return getPortfolioSummary();

    // Cashflow (handled above; these are sub-intents that don't use dateScope)
    case 'cashflow_categories':         return getCashflowCategories();
    case 'cashflow_peak_expense_month': return getCashflowSummary();
    case 'cashflow_peak_income_month':  return getCashflowSummary();
    case 'cashflow_trend':              return getCashflowSummary();
    case 'cashflow_overspend':          return getCashflowSummary();

    // Payments
    case 'payments':           return getPaymentsDueSoon(30);
    case 'payments_week':      return getPaymentsDueSoon(7);
    case 'payments_month':     return getPaymentsDueSoon(30);
    case 'payments_overdue':   return getPaymentsOverdue();
    case 'payments_recurring': return getPaymentsDueSoon(30);
    case 'payments_largest':   return getPaymentsDueSoon(30);
    case 'payments_next':      return getNextPayment();
    case 'payments_paid':      return getPaymentsDueSoon(30);

    // Insurance
    case 'insurance':                   return getInsuranceSummary();
    case 'insurance_count':             return getInsuranceSummary();
    case 'insurance_coverage':          return getInsuranceSummary();
    case 'insurance_premium':           return getInsuranceSummary();
    case 'insurance_next_renewal':      return getNextInsuranceRenewal();
    case 'insurance_expiring_soon':     return getNextInsuranceRenewal();
    case 'insurance_highest_coverage':  return getInsuranceSummary();
    case 'insurance_highest_premium':   return getInsuranceSummary();

    // Liabilities
    case 'liabilities':                  return getLiabilitiesSummary();
    case 'liabilities_count':            return getLiabilitiesSummary();
    case 'liabilities_highest_interest': return getHighestInterestLiability();
    case 'liabilities_highest_balance':  return getLiabilitiesSummary();
    case 'liabilities_priority':         return getHighestInterestLiability();
    case 'liabilities_debt_ratio':       return getDebtRatio();

    // Goals
    case 'goals':                  return getGoalsSummary();
    case 'goals_closest':          return getGoalClosestToCompletion();
    case 'goals_lowest_progress':  return getGoalsSummary();
    case 'goals_remaining':        return getGoalsSummary();
    case 'goals_completion_rate':  return getGoalsSummary();
    case 'goals_nearest_deadline': return getGoalsSummary();
    case 'goals_on_track':         return getGoalsOnTrack();
    case 'goals_savings_needed':   return getGoalsOnTrack();
    case 'goals_next_focus':       return getGoalClosestToCompletion();

    // Accounts
    case 'accounts':              return getAccountsSummary();
    case 'accounts_count':        return getAccountsSummary();
    case 'accounts_highest':      return getAccountsSummary();
    case 'accounts_distribution': return getAccountsSummary();
    case 'accounts_cash':         return getAccountsSummary();

    // Lending
    case 'lending':                    return getLendingSummary();
    case 'lending_total':              return getLendingSummary();
    case 'lending_outstanding':        return getLendingOutstanding();
    case 'lending_borrower_count':     return getLendingSummary();
    case 'lending_top_borrower':       return getLendingOutstanding();
    case 'lending_interest_collected': return getLendingSummary();
    case 'lending_highest_rate':       return getLendingSummary();
    case 'lending_overdue':            return getLendingOutstanding();
    case 'lending_recovered':          return getLendingSummary();

    default: {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[AIAgent] fetchAgentResponse: unhandled intent', { intent, symbol, dateScope });
      }
      return textResponse(`📭 I don't have a specific data view for "${intent}" yet. Try rephrasing your question or ask for a general overview.`);
    }
  }
}

