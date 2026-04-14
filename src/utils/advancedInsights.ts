import type {
  Account,
  CashflowEntry,
  Credential,
  CropCycle,
  Goal,
  InsurancePayment,
  InsurancePolicy,
  Liability,
  SoldTrade,
} from '../types/investmentTypes';

export function buildLiabilityInsights(liabilities: Liability[]) {
  const active = liabilities.filter(
    (l) => l.status !== 'paid' && l.status !== 'returned',
  );
  const totalOutstanding = active.reduce((s, l) => s + (l.outstanding || 0), 0);
  const monthlyInterestLeak = active.reduce(
    (s, l) => s + ((l.outstanding || 0) * (l.interestRate || 0)) / 1200,
    0,
  );
  const weightedRate =
    totalOutstanding > 0
      ? active.reduce(
          (s, l) => s + (l.outstanding || 0) * (l.interestRate || 0),
          0,
        ) / totalOutstanding
      : 0;
  const avalancheTarget = [...active].sort(
    (a, b) => (b.interestRate || 0) - (a.interestRate || 0),
  )[0];
  const snowballTarget = [...active].sort(
    (a, b) => (a.outstanding || 0) - (b.outstanding || 0),
  )[0];
  return { totalOutstanding, monthlyInterestLeak, weightedRate, avalancheTarget, snowballTarget };
}

export function buildGoalInsights(goals: Goal[], cashflows: CashflowEntry[]) {
  const active = goals.filter((g) => !g.status || g.status === 'active');
  const funded = goals.reduce((s, g) => s + (g.currentAmount || 0), 0);
  const target = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
  const gap = Math.max(0, target - funded);
  const monthlyIncome = cashflows
    .filter((c) => c.type === 'income')
    .reduce((s, c) => s + c.amount, 0);
  const monthlyExpense = cashflows
    .filter((c) => c.type === 'expense')
    .reduce((s, c) => s + c.amount, 0);
  const net = monthlyIncome - monthlyExpense;
  const goalProbability =
    gap === 0 ? 100 : net <= 0 ? 15 : Math.max(20, Math.min(95, (net / (gap / 12)) * 60));
  const recommendedMonthly = gap > 0 ? gap / 12 : 0;
  const riskyGoals = active.filter((g) => {
    if (!g.dueDate) return false;
    const monthsLeft =
      (new Date(g.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
    const remaining = Math.max(0, g.targetAmount - g.currentAmount);
    return monthsLeft > 0 && remaining / monthsLeft > Math.max(1, net);
  }).length;
  return { funded, target, gap, net, goalProbability, recommendedMonthly, riskyGoals };
}

export function buildAccountsForecast(accounts: Account[], cashflows: CashflowEntry[]) {
  const totalLive = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const recent = cashflows.filter((c) => {
    const d = new Date(c.date).getTime();
    return Date.now() - d <= 90 * 24 * 60 * 60 * 1000;
  });
  const net90 = recent.reduce((s, c) => s + (c.type === 'income' ? c.amount : -c.amount), 0);
  const dailyRunRate = net90 / 90;
  const projected30 = totalLive + dailyRunRate * 30;
  const projected60 = totalLive + dailyRunRate * 60;
  const lowBalanceRisk = projected30 < 0 || projected60 < 0;
  return { totalLive, dailyRunRate, projected30, projected60, lowBalanceRisk };
}

export function buildCredentialSecurityInsights(credentials: Credential[]) {
  const weak = credentials.filter((c) => {
    const s = c.secret || '';
    if (!s) return true;
    const hasNum = /\d/.test(s);
    const hasSym = /[^A-Za-z0-9]/.test(s);
    return s.length < 10 || !hasNum || !hasSym;
  }).length;
  const idCount = new Map<string, number>();
  for (const c of credentials) {
    const k = (c.identifier || '').trim().toLowerCase();
    if (!k) continue;
    idCount.set(k, (idCount.get(k) || 0) + 1);
  }
  const reused = [...idCount.values()].filter((n) => n > 1).length;
  const stale = credentials.filter((c) => {
    const updated = new Date(c.updatedAt).getTime();
    return Date.now() - updated > 180 * 24 * 60 * 60 * 1000;
  }).length;
  const score = Math.max(0, 100 - weak * 8 - reused * 12 - stale * 4);
  return { weak, reused, stale, score };
}

export function buildAgriYieldInsights(cropCycles: CropCycle[], agriExpenseTotal: number) {
  const harvested = cropCycles.filter((c) => c.harvestIncome > 0);
  const totalKg = harvested.reduce((s, c) => s + (c.quantityKg || 0), 0);
  const totalIncome = harvested.reduce((s, c) => s + c.harvestIncome, 0);
  const totalInvest = harvested.reduce((s, c) => s + c.investedAmount, 0) + agriExpenseTotal;
  const margin = totalIncome - totalInvest;
  const marginPerKg = totalKg > 0 ? margin / totalKg : 0;
  const bestCrop = harvested
    .map((c) => ({ name: c.cropName, profit: c.harvestIncome - c.investedAmount }))
    .sort((a, b) => b.profit - a.profit)[0];
  return { totalKg, totalIncome, totalInvest, margin, marginPerKg, bestCrop };
}

export function buildInsuranceInsights(
  policies: InsurancePolicy[],
  payments: InsurancePayment[],
) {
  const annualPremium = policies.reduce((s, p) => {
    const factor =
      p.premiumFrequency === 'monthly'
        ? 12
        : p.premiumFrequency === 'quarterly'
          ? 4
          : p.premiumFrequency === 'half-yearly'
            ? 2
            : 1;
    return s + p.premiumAmount * factor;
  }, 0);
  const coveredTypes = new Set(policies.map((p) => p.type)).size;
  const paidThisYear = payments
    .filter((p) => p.paidAt >= `${new Date().getFullYear()}-01-01`)
    .reduce((s, p) => s + p.amount, 0);
  const dueSoon = policies.filter((p) => {
    const d = new Date(p.renewalDate).getTime();
    if (Number.isNaN(d)) return false;
    const days = (d - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  }).length;
  const healthScore = Math.max(0, Math.min(100, 35 + coveredTypes * 12 - dueSoon * 7));
  return { annualPremium, paidThisYear, coveredTypes, dueSoon, healthScore };
}

export function buildProfitInsights(soldTrades: SoldTrade[]) {
  if (!soldTrades.length) {
    return { expectancy: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, streak: 0 };
  }
  const wins = soldTrades.filter((t) => t.profit > 0);
  const losses = soldTrades.filter((t) => t.profit < 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.profit, 0) / wins.length : 0;
  const avgLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + t.profit, 0) / losses.length)
    : 0;
  const winRate = wins.length / soldTrades.length;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;
  const grossProfit = wins.reduce((s, t) => s + t.profit, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  const byDate = [...soldTrades].sort((a, b) => a.soldDate.localeCompare(b.soldDate));
  let streak = 0;
  for (let i = byDate.length - 1; i >= 0; i--) {
    if (byDate[i].profit > 0) streak++;
    else break;
  }
  return { expectancy, avgWin, avgLoss, profitFactor, streak };
}

export function buildCashflowAdvancedInsights(rows: CashflowEntry[]) {
  const income = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expense = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const burnRateMonthly = expense / Math.max(1, new Set(rows.map((r) => r.date.slice(0, 7))).size);
  const net = income - expense;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;
  const topExpense = Object.entries(
    rows
      .filter((r) => r.type === 'expense')
      .reduce(
        (m, r) => {
          m[r.category] = (m[r.category] || 0) + r.amount;
          return m;
        },
        {} as Record<string, number>,
      ),
  ).sort((a, b) => b[1] - a[1])[0];
  return { burnRateMonthly, savingsRate, topExpenseCategory: topExpense?.[0] || '—', topExpenseAmount: topExpense?.[1] || 0 };
}

export function buildReportHealthInsights(args: {
  netWorth: number;
  liabilities: number;
  cashflowIncome: number;
  cashflowExpense: number;
}) {
  const { netWorth, liabilities, cashflowIncome, cashflowExpense } = args;
  const debtToNetWorth = netWorth > 0 ? (liabilities / netWorth) * 100 : 0;
  const cashflowCoverage = cashflowExpense > 0 ? (cashflowIncome / cashflowExpense) * 100 : 0;
  const healthIndex = Math.max(
    0,
    Math.min(100, 50 + (cashflowCoverage - 100) * 0.3 - debtToNetWorth * 0.2),
  );
  return { debtToNetWorth, cashflowCoverage, healthIndex };
}

