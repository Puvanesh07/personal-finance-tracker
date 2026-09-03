/**
 * src/utils/affordabilityEngine.ts
 *
 * "Can I Afford This?" engine (Feature 7).
 * Pure logic — reads pre-computed numbers, returns a verdict + breakdown.
 * No store imports, no React — called by the AI agent and components.
 */

export type AffordabilityVerdict =
  | 'yes'           // safe, no impact on critical metrics
  | 'possible'      // doable but will stress one metric
  | 'not_recommended' // will hurt emergency fund or goals significantly
  | 'no';           // not enough cash / will exceed debt capacity

export interface AffordabilityInput {
  purchaseAmount: number;

  // Account / cash data
  totalCash: number;           // sum of bank account balances

  // Cashflow data
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;

  // Emergency fund
  emergencyFundCurrent: number;
  emergencyFundTarget: number;
  avgMonthlyExpenseForRunway: number;  // to compute runway in months

  // Upcoming bills in next 30 days
  upcomingBillsTotal: number;

  // Active liabilities
  totalOutstandingDebt: number;
  totalMonthlyEMI: number;

  // Goals
  goals: Array<{
    name: string;
    targetAmount: number;
    savedAmount: number;
    dueDate?: string;
  }>;
}

export interface AffordabilityResult {
  verdict: AffordabilityVerdict;
  verdictLabel: string;
  verdictEmoji: string;
  summary: string;
  details: AffordabilityDetail[];
  recommendedBudget: { min: number; max: number } | null;
  cashAfterPurchase: number;
  emergencyRunwayAfter: number;   // months
  emergencyRunwayBefore: number;
}

export interface AffordabilityDetail {
  label: string;
  before: string;
  after: string;
  impact: 'good' | 'neutral' | 'warning' | 'danger';
  note?: string;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtINR(n: number): string {
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}
function fmtMonths(m: number): string {
  if (!isFinite(m) || m > 120) return '—';
  return `${m.toFixed(1)} mo`;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export function canIAfford(input: AffordabilityInput): AffordabilityResult {
  const {
    purchaseAmount,
    totalCash,
    avgMonthlyExpense,
    avgMonthlyExpenseForRunway,
    emergencyFundCurrent,
    emergencyFundTarget,
    upcomingBillsTotal,
    totalOutstandingDebt,
    totalMonthlyEMI,
    avgMonthlyIncome,
    goals,
  } = input;

  const details: AffordabilityDetail[] = [];

  // ── 1. Available cash after bills ─────────────────────────────────────────
  const usableCash      = totalCash - upcomingBillsTotal;
  const cashAfterPurch  = usableCash - purchaseAmount;
  const hasCash         = cashAfterPurch >= 0;

  details.push({
    label:  'Available Cash',
    before: fmtINR(usableCash),
    after:  fmtINR(cashAfterPurch),
    impact: cashAfterPurch >= 0
      ? cashAfterPurch > avgMonthlyExpense ? 'good' : 'warning'
      : 'danger',
    note: cashAfterPurch < 0 ? 'Not enough cash after upcoming bills.' : undefined,
  });

  // ── 2. Emergency fund impact ───────────────────────────────────────────────
  const expenseForRunway   = avgMonthlyExpenseForRunway > 0 ? avgMonthlyExpenseForRunway : avgMonthlyExpense;
  const runwayBefore       = expenseForRunway > 0 ? emergencyFundCurrent / expenseForRunway : 0;
  // If user pays from emergency fund (cash insufficient)
  const drawFromEmergency  = !hasCash ? Math.abs(cashAfterPurch) : 0;
  const emergencyAfter     = Math.max(0, emergencyFundCurrent - drawFromEmergency);
  const runwayAfter        = expenseForRunway > 0 ? emergencyAfter / expenseForRunway : 0;

  const emergencyImpact: AffordabilityDetail['impact'] =
    runwayAfter < 2   ? 'danger'
    : runwayAfter < 3 ? 'warning'
    : 'good';

  details.push({
    label:  'Emergency Fund Runway',
    before: fmtMonths(runwayBefore),
    after:  fmtMonths(runwayAfter),
    impact: emergencyImpact,
    note: runwayAfter < 3
      ? `Target is 6 months. After this purchase you'd have ${fmtMonths(runwayAfter)}.`
      : undefined,
  });

  // ── 3. Debt-to-income ratio ────────────────────────────────────────────────
  // Would they need to take debt for this?
  const wouldNeedDebt   = cashAfterPurch < 0;
  const dtiRatioBefore  = avgMonthlyIncome > 0 ? totalMonthlyEMI / avgMonthlyIncome : 0;
  // Rough estimate: if they financed over 12 months
  const hypotheticalEMI = wouldNeedDebt ? purchaseAmount / 12 : 0;
  const dtiRatioAfter   = avgMonthlyIncome > 0
    ? (totalMonthlyEMI + hypotheticalEMI) / avgMonthlyIncome
    : dtiRatioBefore;

  if (totalOutstandingDebt > 0 || wouldNeedDebt) {
    details.push({
      label:  'Debt / Income Ratio',
      before: `${(dtiRatioBefore * 100).toFixed(1)}%`,
      after:  `${(dtiRatioAfter * 100).toFixed(1)}%`,
      impact: dtiRatioAfter > 0.5 ? 'danger' : dtiRatioAfter > 0.35 ? 'warning' : 'neutral',
      note: wouldNeedDebt ? 'Would need to finance (not enough cash).' : undefined,
    });
  }

  // ── 4. Monthly cashflow impact ─────────────────────────────────────────────
  const surplus       = avgMonthlyIncome - avgMonthlyExpense;
  const monthsToSave  = surplus > 0 ? Math.ceil(purchaseAmount / surplus) : 999;
  details.push({
    label:  'Monthly Surplus',
    before: fmtINR(surplus),
    after:  fmtINR(surplus),
    impact: surplus > 0 ? 'neutral' : 'danger',
    note:   surplus > 0
      ? `At current savings, you can save this in ${monthsToSave} month${monthsToSave > 1 ? 's' : ''}.`
      : 'No monthly surplus available.',
  });

  // ── 5. Goal impact ─────────────────────────────────────────────────────────
  const urgentGoals = goals.filter((g) => {
    if (!g.dueDate) return false;
    const months = (new Date(g.dueDate).getFullYear() - new Date().getFullYear()) * 12
      + (new Date(g.dueDate).getMonth() - new Date().getMonth());
    const remaining = g.targetAmount - g.savedAmount;
    const needed    = months > 0 ? remaining / months : remaining;
    return needed > surplus * 0.3 && remaining > 0; // goal takes >30% of surplus
  });
  if (urgentGoals.length > 0) {
    details.push({
      label:  'Active Goals',
      before: `${goals.length} goal${goals.length !== 1 ? 's' : ''}`,
      after:  `${goals.length} goal${goals.length !== 1 ? 's' : ''}`,
      impact: 'warning',
      note: `${urgentGoals.map((g) => g.name).join(', ')} need${urgentGoals.length === 1 ? 's' : ''} regular funding.`,
    });
  }

  // ── Verdict logic ──────────────────────────────────────────────────────────
  const dangers   = details.filter((d) => d.impact === 'danger').length;
  const warnings  = details.filter((d) => d.impact === 'warning').length;

  let verdict: AffordabilityVerdict;
  if (!hasCash && emergencyAfter < emergencyFundTarget * 0.5) {
    verdict = 'no';
  } else if (dangers >= 2) {
    verdict = 'no';
  } else if (dangers === 1 || (warnings >= 2 && !hasCash)) {
    verdict = 'not_recommended';
  } else if (warnings >= 1 || !hasCash) {
    verdict = 'possible';
  } else {
    verdict = 'yes';
  }

  const verdictLabel =
    verdict === 'yes'              ? 'Yes, you can afford it'
    : verdict === 'possible'       ? 'Possible, but plan carefully'
    : verdict === 'not_recommended'? 'Not recommended right now'
    : 'Cannot afford this now';

  const verdictEmoji =
    verdict === 'yes'              ? '✅'
    : verdict === 'possible'       ? '⚠️'
    : verdict === 'not_recommended'? '🔶'
    : '🚫';

  // ── Summary line ──────────────────────────────────────────────────────────
  let summary = '';
  if (verdict === 'yes') {
    summary = `You have ${fmtINR(usableCash)} available and this purchase leaves a comfortable buffer.`;
  } else if (verdict === 'possible') {
    if (!hasCash) {
      summary = `You're short by ${fmtINR(Math.abs(cashAfterPurch))} after upcoming bills. Consider waiting ${monthsToSave} month${monthsToSave > 1 ? 's' : ''} to save up.`;
    } else {
      summary = `After this purchase your emergency fund drops to ${fmtMonths(runwayAfter)}. Proceed with caution.`;
    }
  } else if (verdict === 'not_recommended') {
    summary = `After this purchase your emergency fund would fall from ${fmtMonths(runwayBefore)} to ${fmtMonths(runwayAfter)}. Recommended purchase budget: ${fmtINR(purchaseAmount * 0.5)}–${fmtINR(purchaseAmount * 0.65)}.`;
  } else {
    summary = `You don't have enough cash (${fmtINR(usableCash)}) for this ${fmtINR(purchaseAmount)} purchase after upcoming bills of ${fmtINR(upcomingBillsTotal)}.`;
  }

  // ── Recommended budget ─────────────────────────────────────────────────────
  // Safe amount: what keeps emergency fund > 3 months AND leaves >1 month expense in cash
  const safeMaxFromCash      = Math.max(0, usableCash - avgMonthlyExpense);
  const safeMaxFromEmergency = Math.max(0, emergencyFundCurrent - expenseForRunway * 3);
  const safeMax              = safeMaxFromCash + safeMaxFromEmergency;
  const recommendedBudget    = safeMax > 0 && verdict !== 'yes'
    ? { min: Math.round(safeMax * 0.6 / 1000) * 1000, max: Math.round(safeMax / 1000) * 1000 }
    : null;

  return {
    verdict,
    verdictLabel,
    verdictEmoji,
    summary,
    details,
    recommendedBudget,
    cashAfterPurchase: cashAfterPurch,
    emergencyRunwayAfter:  runwayAfter,
    emergencyRunwayBefore: runwayBefore,
  };
}

/**
 * Detect "can I afford X?" intent and parse the amount.
 */
export function detectAffordabilityQuestion(q: string): number | null {
  if (!/can\s+i\s+(afford|buy|purchase|get|spend)\b/i.test(q) &&
      !/is\s+(it\s+)?(safe|ok|okay|fine)\s+to\s+(buy|spend|purchase)/i.test(q) &&
      !/should\s+i\s+buy\b/i.test(q)) {
    return null;
  }
  // Extract amount
  const lakh  = q.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/i);
  if (lakh) return parseFloat(lakh[1]) * 100_000;
  const crore = q.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*crore/i);
  if (crore) return parseFloat(crore[1]) * 10_000_000;
  const k     = q.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*k\b/i);
  if (k) return parseFloat(k[1]) * 1_000;
  const inr   = q.match(/(?:₹|rs\.?\s*)(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (inr) return parseFloat(inr[1].replace(/,/g, ''));
  return null;
}
