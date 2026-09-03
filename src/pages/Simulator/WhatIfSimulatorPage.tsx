/**
 * src/pages/Simulator/WhatIfSimulatorPage.tsx
 *
 * What-If Simulator (Feature 8)
 * 8 scenario types — each shows impact on Net Worth, Goals, Cashflow, Debt.
 * Pure client-side math. No Firestore writes. No AI calls.
 */

import { useMemo, useState } from 'react';
import {
  FiActivity, FiAlertCircle, FiArrowRight, FiBarChart2,
  FiCpu, FiDollarSign, FiHome, FiInfo,
  FiRefreshCw, FiTrendingDown, FiTrendingUp, FiZap,
} from 'react-icons/fi';
import { usePortfolioStore } from '../../store/portfolioStore';
import { calculateNetWorth, investedValue, currentValue } from '../../utils/calculations';
import { futureValue, goalProbabilityResult } from '../../utils/goalProbability';
import { formatINR } from '../../utils/format';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScenarioId =
  | 'increase_sip'
  | 'take_loan'
  | 'buy_car'
  | 'salary_raise'
  | 'reduce_expenses'
  | 'stop_sip'
  | 'retire_early'
  | 'buy_house';

interface ScenarioMeta {
  id: ScenarioId;
  emoji: string;
  label: string;
  description: string;
  color: string;
  paramLabel: string;
  paramUnit: string;
  paramDefault: number;
  paramMin: number;
  paramMax: number;
  paramStep: number;
}

const SCENARIOS: ScenarioMeta[] = [
  {
    id: 'increase_sip',
    emoji: '📈', label: 'Increase SIP',
    description: 'Add more to monthly investments',
    color: 'emerald',
    paramLabel: 'Extra monthly SIP', paramUnit: '₹', paramDefault: 5000,
    paramMin: 500, paramMax: 100000, paramStep: 500,
  },
  {
    id: 'take_loan',
    emoji: '🏦', label: 'Take a Loan',
    description: 'Add new loan/EMI to your liabilities',
    color: 'rose',
    paramLabel: 'Loan amount', paramUnit: '₹', paramDefault: 1000000,
    paramMin: 50000, paramMax: 10000000, paramStep: 50000,
  },
  {
    id: 'buy_car',
    emoji: '🚗', label: 'Buy a Car',
    description: 'One-time purchase + monthly EMI',
    color: 'amber',
    paramLabel: 'Car price', paramUnit: '₹', paramDefault: 800000,
    paramMin: 200000, paramMax: 5000000, paramStep: 50000,
  },
  {
    id: 'salary_raise',
    emoji: '💰', label: 'Salary Increase',
    description: 'Your income grows by X%',
    color: 'sky',
    paramLabel: 'Salary increase', paramUnit: '%', paramDefault: 10,
    paramMin: 1, paramMax: 100, paramStep: 1,
  },
  {
    id: 'reduce_expenses',
    emoji: '✂️', label: 'Reduce Expenses',
    description: 'Cut monthly spending by ₹X',
    color: 'teal',
    paramLabel: 'Monthly cut', paramUnit: '₹', paramDefault: 5000,
    paramMin: 500, paramMax: 50000, paramStep: 500,
  },
  {
    id: 'stop_sip',
    emoji: '⏸️', label: 'Stop Investing',
    description: 'Pause all monthly investments',
    color: 'orange',
    paramLabel: 'Stop for months', paramUnit: 'mo', paramDefault: 6,
    paramMin: 1, paramMax: 60, paramStep: 1,
  },
  {
    id: 'retire_early',
    emoji: '🏖️', label: 'Retire Early',
    description: 'Target retirement in X years',
    color: 'violet',
    paramLabel: 'Years to retire', paramUnit: 'yrs', paramDefault: 15,
    paramMin: 1, paramMax: 40, paramStep: 1,
  },
  {
    id: 'buy_house',
    emoji: '🏠', label: 'Buy a House',
    description: 'Down payment + home loan EMI',
    color: 'indigo',
    paramLabel: 'House price', paramUnit: '₹', paramDefault: 5000000,
    paramMin: 1000000, paramMax: 50000000, paramStep: 500000,
  },
];

// ─── Impact calculation engine ────────────────────────────────────────────────

interface ImpactResult {
  netWorthDelta: number;
  netWorthAfter: number;
  surplusDelta: number;
  surplusAfter: number;
  goalAcceleration: number;   // months saved (positive) or lost (negative)
  debtDelta: number;          // new debt added
  projectedNetWorth5Y: number; // baseline vs scenario at 5 years
  projectedNetWorth5YBase: number;
  summary: string;
  warnings: string[];
  positives: string[];
}

function calcMonthlyAvg(
  entries: { type: string; amount: number; date: string }[],
  type: 'income' | 'expense',
): number {
  const rows = entries.filter((e) => e.type === type);
  if (!rows.length) return 0;
  const months = new Set(rows.map((e) => e.date.slice(0, 7))).size || 1;
  return rows.reduce((a, e) => a + e.amount, 0) / months;
}

function computeImpact(
  scenarioId: ScenarioId,
  param: number,
  state: ReturnType<typeof usePortfolioStore.getState>,
): ImpactResult {
  const { investments, liabilities, cashflows, goals, goalContributions, accounts } = state;

  const { netWorth } = calculateNetWorth(investments, liabilities);
  const avgInc   = calcMonthlyAvg(cashflows, 'income');
  const avgExp   = calcMonthlyAvg(cashflows, 'expense');
  const surplus  = avgInc - avgExp;
  const totalInv = investments.reduce((a, i) => a + currentValue(i), 0);
  void investedValue; // used indirectly

  const totalDebt = liabilities
    .filter((l) => !l.status || l.status === 'active')
    .reduce((a, l) => a + (l.outstanding ?? 0), 0);

  const totalCash = accounts.reduce((a, ac) => a + (ac.balance ?? 0), 0);

  // 5-year baseline projection (monthly surplus invested at 12%)
  const monthlyInvBase = Math.max(0, surplus);
  const base5Y = futureValue(totalInv + totalCash, monthlyInvBase, 12, 60);

  // Per-goal baseline probability
  const activeGoals = goals.filter((g) => !g.status || g.status === 'active');
  const firstGoal   = activeGoals[0];
  const firstGoalContrib = firstGoal
    ? goalContributions.filter((c) => c.goalId === firstGoal.id).reduce((a, c) => a + c.amount, 0)
    : 0;
  const firstGoalSaved = firstGoal ? firstGoal.currentAmount + firstGoalContrib : 0;

  const baseProbResult = firstGoal
    ? goalProbabilityResult({
        targetAmount: firstGoal.targetAmount,
        currentSaved: firstGoalSaved,
        monthlyInvestment: monthlyInvBase,
        expectedReturnPct: 12,
        targetDate: firstGoal.dueDate,
      })
    : null;

  const warnings:  string[] = [];
  const positives: string[] = [];

  let surplusDelta    = 0;
  let debtDelta       = 0;
  let netWorthDelta   = 0;
  let monthlyInvNew   = monthlyInvBase;
  let summary         = '';

  switch (scenarioId) {
    case 'increase_sip': {
      surplusDelta  = -param;             // more invested = less liquid surplus
      monthlyInvNew = monthlyInvBase + param;
      const gain5Y  = futureValue(0, param, 12, 60);
      netWorthDelta = gain5Y;
      positives.push(`₹${param.toLocaleString('en-IN')}/mo extra → ₹${Math.round(gain5Y).toLocaleString('en-IN')} more in 5 yrs at 12%`);
      if (surplus - param < 0) warnings.push('This exceeds your monthly surplus — ensure you have liquidity.');
      summary = `Investing ₹${param.toLocaleString('en-IN')} more/month grows your wealth by ${formatINR(gain5Y)} over 5 years.`;
      break;
    }
    case 'take_loan': {
      const emi       = Math.round((param * 0.009) / (1 - Math.pow(1.009, -60))); // ~10.8% 5yr
      surplusDelta    = -emi;
      debtDelta       = param;
      netWorthDelta   = -param;
      warnings.push(`Monthly EMI ~${formatINR(emi)}`);
      const dtiAfter  = avgInc > 0 ? ((state.liabilities.reduce((a, l) => a + (l.emiAmount ?? 0), 0) + emi) / avgInc) * 100 : 0;
      if (dtiAfter > 40) warnings.push(`Debt-to-income would reach ${dtiAfter.toFixed(0)}% — above 40% threshold.`);
      summary = `Taking a ₹${param.toLocaleString('en-IN')} loan adds ~${formatINR(emi)} EMI and reduces net worth by ${formatINR(param)}.`;
      break;
    }
    case 'buy_car': {
      const downPay   = Math.round(param * 0.2);
      const loanAmt   = param - downPay;
      const emi       = Math.round((loanAmt * 0.009) / (1 - Math.pow(1.009, -60)));
      surplusDelta    = -emi;
      debtDelta       = loanAmt;
      netWorthDelta   = -(downPay); // car depreciates — treat as expense
      warnings.push(`Down payment: ${formatINR(downPay)}, EMI: ${formatINR(emi)}/mo`);
      warnings.push('Cars depreciate ~15% annually — not an asset.');
      summary = `Buying a ₹${param.toLocaleString('en-IN')} car costs ${formatINR(downPay)} upfront + ${formatINR(emi)}/mo EMI.`;
      break;
    }
    case 'salary_raise': {
      const extraIncome = avgInc * (param / 100);
      surplusDelta      = extraIncome;
      monthlyInvNew     = monthlyInvBase + extraIncome * 0.5; // assume 50% invested
      const gain5Y      = futureValue(0, extraIncome * 0.5, 12, 60);
      netWorthDelta     = gain5Y;
      positives.push(`+${formatINR(extraIncome)}/mo income`);
      positives.push(`If 50% invested → ${formatINR(gain5Y)} extra in 5 yrs`);
      summary = `A ${param}% raise adds ${formatINR(extraIncome)}/mo. Investing half builds ${formatINR(gain5Y)} over 5 years.`;
      break;
    }
    case 'reduce_expenses': {
      surplusDelta      = param;
      monthlyInvNew     = monthlyInvBase + param;
      const gain5Y      = futureValue(0, param, 12, 60);
      netWorthDelta     = gain5Y;
      positives.push(`+${formatINR(param)}/mo surplus`);
      if (avgExp > 0) positives.push(`Expenses drop by ${((param / avgExp) * 100).toFixed(1)}%`);
      summary = `Cutting ₹${param.toLocaleString('en-IN')}/mo frees ${formatINR(futureValue(0, param, 12, 60))} over 5 years.`;
      break;
    }
    case 'stop_sip': {
      const missedGrowth = futureValue(0, monthlyInvBase, 12, param) - monthlyInvBase * param;
      surplusDelta       = monthlyInvBase;   // more cash temporarily
      netWorthDelta      = -missedGrowth;
      monthlyInvNew      = 0;
      warnings.push(`Missed compounding: ~${formatINR(missedGrowth)} lost growth over ${param} months.`);
      warnings.push('Stopping investments even briefly has long-term compounding cost.');
      summary = `Pausing investments for ${param} months costs ~${formatINR(missedGrowth)} in missed compound growth.`;
      break;
    }
    case 'retire_early': {
      const targetCorpus  = (avgExp > 0 ? avgExp * 12 * 25 : 10_000_000);
      const monthsLeft    = param * 12;
      const needed        = Math.max(0, targetCorpus - netWorth);
      const pmt           = needed > 0 && monthsLeft > 0
        ? (needed * (0.01 / (Math.pow(1.01, monthsLeft) - 1)))
        : 0;
      surplusDelta        = 0;
      netWorthDelta       = 0;
      monthlyInvNew       = pmt;
      if (pmt > surplus) {
        warnings.push(`You'd need to invest ${formatINR(pmt)}/mo — ${formatINR(pmt - surplus)} more than your current surplus.`);
      } else {
        positives.push(`${formatINR(pmt)}/mo investment can get you to retirement in ${param} years.`);
      }
      const corpusLabel   = formatINR(targetCorpus);
      summary = `FIRE corpus needed: ${corpusLabel}. Requires ${formatINR(pmt)}/mo for ${param} years at 12% return.`;
      break;
    }
    case 'buy_house': {
      const downPay   = Math.round(param * 0.2);
      const loanAmt   = param - downPay;
      const emi       = Math.round((loanAmt * 0.0075) / (1 - Math.pow(1.0075, -240))); // 9%, 20yr
      surplusDelta    = -emi;
      debtDelta       = loanAmt;
      netWorthDelta   = downPay * -1; // cash outflow; house is asset but treated conservatively
      if (downPay > totalCash * 0.8) warnings.push('Down payment exceeds 80% of your cash — leaves thin buffer.');
      const dtiAfter  = avgInc > 0 ? ((state.liabilities.reduce((a, l) => a + (l.emiAmount ?? 0), 0) + emi) / avgInc) * 100 : 0;
      if (dtiAfter > 45) warnings.push(`Home loan pushes debt-to-income to ${dtiAfter.toFixed(0)}% — high.`);
      positives.push('Real estate can appreciate 6–8% annually.');
      summary = `Buying a ₹${param.toLocaleString('en-IN')} house: ${formatINR(downPay)} down + ${formatINR(emi)}/mo EMI for 20 years.`;
      break;
    }
  }

  // Scenario 5Y projection
  const scenario5Y = futureValue(
    totalInv + totalCash + (surplusDelta < 0 ? 0 : 0),
    Math.max(0, monthlyInvNew),
    12,
    60,
  );

  // Goal acceleration for first active goal
  let goalAcceleration = 0;
  if (firstGoal && baseProbResult) {
    const scenProbResult = goalProbabilityResult({
      targetAmount:      firstGoal.targetAmount,
      currentSaved:      firstGoalSaved,
      monthlyInvestment: Math.max(0, monthlyInvNew),
      expectedReturnPct: 12,
      targetDate:        firstGoal.dueDate,
    });
    goalAcceleration = baseProbResult.monthsNeeded - scenProbResult.monthsNeeded;
  }

  if (totalDebt + debtDelta > netWorth * 0.6) {
    warnings.push('Total debt would exceed 60% of net worth.');
  }
  if (surplus + surplusDelta < 0) {
    warnings.push('Monthly cashflow goes negative — spending exceeds income.');
  }

  return {
    netWorthDelta,
    netWorthAfter: netWorth + netWorthDelta,
    surplusDelta,
    surplusAfter: surplus + surplusDelta,
    goalAcceleration,
    debtDelta,
    projectedNetWorth5Y: scenario5Y,
    projectedNetWorth5YBase: base5Y,
    summary,
    warnings,
    positives,
  };
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500' },
  rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-600 dark:text-rose-400',       badge: 'bg-rose-500' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-600 dark:text-amber-400',     badge: 'bg-amber-500' },
  sky:     { bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     text: 'text-sky-600 dark:text-sky-400',         badge: 'bg-sky-500' },
  teal:    { bg: 'bg-teal-500/10',    border: 'border-teal-500/30',    text: 'text-teal-600 dark:text-teal-400',       badge: 'bg-teal-500' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-600 dark:text-orange-400',   badge: 'bg-orange-500' },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-600 dark:text-violet-400',  badge: 'bg-violet-500' },
  indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-600 dark:text-indigo-400',  badge: 'bg-indigo-500' },
};

function DeltaBadge({ value, prefix = '₹', invert = false }: { value: number; prefix?: string; invert?: boolean }) {
  if (value === 0) return <span className='text-slate-400 text-sm font-bold'>—</span>;
  const positive = invert ? value < 0 : value > 0;
  return (
    <span className={`text-sm font-bold font-mono ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
      {positive ? '+' : ''}{prefix}{Math.abs(Math.round(value)).toLocaleString('en-IN')}
    </span>
  );
}

function ImpactRow({ label, before, after, delta, prefix = '₹', invert = false }: {
  label: string; before: number; after: number; delta: number; prefix?: string; invert?: boolean;
}) {
  return (
    <div className='flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0'>
      <span className='text-xs text-slate-500 dark:text-slate-400 font-medium'>{label}</span>
      <div className='flex items-center gap-2 text-xs font-mono'>
        <span className='text-slate-600 dark:text-slate-400'>{prefix}{Math.round(before).toLocaleString('en-IN')}</span>
        <FiArrowRight className='h-3 w-3 text-slate-400' />
        <span className='font-bold text-slate-900 dark:text-slate-100'>{prefix}{Math.round(after).toLocaleString('en-IN')}</span>
        <DeltaBadge value={delta} prefix={prefix} invert={invert} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WhatIfSimulatorPage() {
  const [activeScenario, setActiveScenario] = useState<ScenarioId>('increase_sip');
  const [paramValues, setParamValues]       = useState<Record<ScenarioId, number>>(
    Object.fromEntries(SCENARIOS.map((s) => [s.id, s.paramDefault])) as Record<ScenarioId, number>,
  );

  const meta    = SCENARIOS.find((s) => s.id === activeScenario)!;
  const param   = paramValues[activeScenario];
  const colors  = COLOR_MAP[meta.color];

  const storeState = usePortfolioStore.getState();
  const { investments, liabilities, cashflows, accounts } = usePortfolioStore();

  const { netWorth } = useMemo(
    () => calculateNetWorth(investments, liabilities),
    [investments, liabilities],
  );
  const avgInc  = useMemo(() => calcMonthlyAvg(cashflows, 'income'),  [cashflows]);
  const avgExp  = useMemo(() => calcMonthlyAvg(cashflows, 'expense'), [cashflows]);
  const surplus = avgInc - avgExp;
  const totalCash = useMemo(
    () => accounts.reduce((a, ac) => a + (ac.balance ?? 0), 0),
    [accounts],
  );
  void totalCash;

  const impact = useMemo(
    () => computeImpact(activeScenario, param, storeState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeScenario, param, investments, liabilities, cashflows, accounts],
  );

  const noData = !investments.length && !cashflows.length && !liabilities.length;

  return (
    <div className='flex flex-col gap-6 pb-12'>
      {/* Header */}
      <header className='rounded-2xl bg-gradient-to-r from-violet-600/10 via-purple-500/5 to-transparent p-6 border border-violet-500/20'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-500/25'>
            <FiCpu className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>What-If Simulator</h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              Explore how financial decisions impact your net worth, goals, cashflow and debt.
            </p>
          </div>
        </div>
      </header>

      {noData && (
        <div className='rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-10 text-center'>
          <FiInfo className='h-10 w-10 text-slate-400 mx-auto mb-3' />
          <p className='text-sm font-semibold text-slate-600 dark:text-slate-400'>
            Add investments, cashflow, or liabilities to run meaningful simulations.
          </p>
        </div>
      )}

      <div className='flex flex-col lg:flex-row gap-6'>

        {/* ── Scenario picker ── */}
        <div className='lg:w-64 shrink-0'>
          <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3'>
            Choose a scenario
          </p>
          <div className='flex flex-col gap-1.5'>
            {SCENARIOS.map((s) => {
              const c = COLOR_MAP[s.color];
              const active = activeScenario === s.id;
              return (
                <button
                  key={s.id}
                  type='button'
                  onClick={() => setActiveScenario(s.id)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                    active
                      ? `${c.bg} border ${c.border}`
                      : 'border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span className='text-lg shrink-0'>{s.emoji}</span>
                  <div className='min-w-0'>
                    <p className={`text-xs font-bold ${active ? c.text : 'text-slate-700 dark:text-slate-200'}`}>
                      {s.label}
                    </p>
                    <p className='text-[10px] text-slate-400 dark:text-slate-500 truncate'>{s.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className='flex-1 flex flex-col gap-4'>

          {/* Scenario header */}
          <div className={`rounded-2xl ${colors.bg} border ${colors.border} p-5`}>
            <div className='flex items-center gap-3 mb-4'>
              <span className='text-3xl'>{meta.emoji}</span>
              <div>
                <h2 className={`text-lg font-bold ${colors.text}`}>{meta.label}</h2>
                <p className='text-sm text-slate-500 dark:text-slate-400'>{meta.description}</p>
              </div>
            </div>

            {/* Parameter input */}
            <div className='flex flex-col gap-2'>
              <div className='flex items-center justify-between'>
                <label className='text-xs font-bold text-slate-600 dark:text-slate-300'>
                  {meta.paramLabel}
                </label>
                <span className={`text-sm font-black ${colors.text}`}>
                  {meta.paramUnit === '₹'
                    ? `₹${param.toLocaleString('en-IN')}`
                    : meta.paramUnit === '%'
                    ? `${param}%`
                    : `${param} ${meta.paramUnit}`}
                </span>
              </div>
              <input
                type='range'
                min={meta.paramMin}
                max={meta.paramMax}
                step={meta.paramStep}
                value={param}
                onChange={(e) =>
                  setParamValues((p) => ({ ...p, [activeScenario]: Number(e.target.value) }))
                }
                className='w-full h-2 rounded-full appearance-none bg-slate-200 dark:bg-slate-700 cursor-pointer'
                style={{ accentColor: `var(--tw-${meta.color}-500, #8b5cf6)` }}
              />
              <div className='flex justify-between text-[10px] text-slate-400'>
                <span>
                  {meta.paramUnit === '₹'
                    ? `₹${meta.paramMin.toLocaleString('en-IN')}`
                    : `${meta.paramMin} ${meta.paramUnit}`}
                </span>
                <span>
                  {meta.paramUnit === '₹'
                    ? `₹${meta.paramMax.toLocaleString('en-IN')}`
                    : `${meta.paramMax} ${meta.paramUnit}`}
                </span>
              </div>
              {/* Quick preset buttons */}
              <div className='flex gap-2 mt-1'>
                {[0.25, 0.5, 0.75, 1.0].map((f) => {
                  const v = Math.round((meta.paramMin + (meta.paramMax - meta.paramMin) * f) / meta.paramStep) * meta.paramStep;
                  return (
                    <button
                      key={f}
                      type='button'
                      onClick={() => setParamValues((p) => ({ ...p, [activeScenario]: v }))}
                      className={`flex-1 rounded-lg py-1 text-[10px] font-bold border transition-colors ${
                        param === v
                          ? `${colors.bg} ${colors.border} ${colors.text}`
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {meta.paramUnit === '₹'
                        ? v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${(v / 1000).toFixed(0)}K`
                        : `${v}${meta.paramUnit}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Summary line */}
          <div className='rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 px-4 py-3 flex items-start gap-2'>
            <FiZap className='h-4 w-4 text-amber-400 mt-0.5 shrink-0' />
            <p className='text-sm text-slate-700 dark:text-slate-300'>{impact.summary}</p>
          </div>

          {/* Impact table */}
          <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden'>
            <div className='px-4 py-3 bg-slate-50 dark:bg-slate-800/50'>
              <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500'>Impact breakdown</p>
            </div>

            <div className='px-4'>
              <ImpactRow
                label='Net Worth'
                before={netWorth}
                after={impact.netWorthAfter}
                delta={impact.netWorthDelta}
              />
              <ImpactRow
                label='Monthly Surplus'
                before={surplus}
                after={impact.surplusAfter}
                delta={impact.surplusDelta}
              />
              {impact.debtDelta !== 0 && (
                <ImpactRow
                  label='Total Debt'
                  before={liabilities.filter((l) => !l.status || l.status === 'active').reduce((a, l) => a + (l.outstanding ?? 0), 0)}
                  after={liabilities.filter((l) => !l.status || l.status === 'active').reduce((a, l) => a + (l.outstanding ?? 0), 0) + impact.debtDelta}
                  delta={impact.debtDelta}
                  invert
                />
              )}
              {impact.goalAcceleration !== 0 && (
                <div className='flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0'>
                  <span className='text-xs text-slate-500 dark:text-slate-400 font-medium'>Goal Timeline</span>
                  <span className={`text-sm font-bold ${impact.goalAcceleration > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {impact.goalAcceleration > 0
                      ? `${Math.round(impact.goalAcceleration)} months faster`
                      : `${Math.round(Math.abs(impact.goalAcceleration))} months slower`}
                  </span>
                </div>
              )}
            </div>

            {/* 5-year projection */}
            <div className='px-4 py-3 bg-slate-50 dark:bg-slate-800/30'>
              <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2'>5-Year Projection</p>
              <div className='flex items-end gap-4'>
                <div>
                  <p className='text-[10px] text-slate-400'>Baseline</p>
                  <p className='text-base font-black font-mono text-slate-700 dark:text-slate-300'>
                    {formatINR(impact.projectedNetWorth5YBase)}
                  </p>
                </div>
                <FiArrowRight className='h-4 w-4 text-slate-400 mb-1.5' />
                <div>
                  <p className='text-[10px] text-slate-400'>With this scenario</p>
                  <p className={`text-base font-black font-mono ${impact.projectedNetWorth5Y >= impact.projectedNetWorth5YBase ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatINR(impact.projectedNetWorth5Y)}
                  </p>
                </div>
                <div className='ml-auto'>
                  <DeltaBadge value={impact.projectedNetWorth5Y - impact.projectedNetWorth5YBase} />
                </div>
              </div>
              {/* Simple visual bar comparison */}
              <div className='mt-3 space-y-1.5'>
                {[
                  { label: 'Baseline', value: impact.projectedNetWorth5YBase, color: 'bg-slate-400 dark:bg-slate-600' },
                  { label: 'Scenario', value: impact.projectedNetWorth5Y,    color: `${colors.badge}` },
                ].map(({ label, value, color }) => {
                  const max = Math.max(impact.projectedNetWorth5YBase, impact.projectedNetWorth5Y, 1);
                  const pct = Math.max(2, Math.min(100, (value / max) * 100));
                  return (
                    <div key={label} className='flex items-center gap-2'>
                      <span className='text-[10px] text-slate-500 w-14 shrink-0'>{label}</span>
                      <div className='flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Warnings & Positives */}
          {(impact.warnings.length > 0 || impact.positives.length > 0) && (
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              {impact.warnings.length > 0 && (
                <div className='rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10 p-3'>
                  <p className='text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1'>
                    <FiAlertCircle className='h-3 w-3' /> Risks
                  </p>
                  <ul className='space-y-1'>
                    {impact.warnings.map((w, i) => (
                      <li key={i} className='text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5'>
                        <span className='mt-0.5 shrink-0'>•</span>{w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {impact.positives.length > 0 && (
                <div className='rounded-xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/10 p-3'>
                  <p className='text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1'>
                    <FiTrendingUp className='h-3 w-3' /> Upsides
                  </p>
                  <ul className='space-y-1'>
                    {impact.positives.map((p, i) => (
                      <li key={i} className='text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-1.5'>
                        <span className='mt-0.5 shrink-0'>✓</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Reset button */}
          <div className='flex justify-end'>
            <button
              type='button'
              onClick={() =>
                setParamValues((p) => ({ ...p, [activeScenario]: meta.paramDefault }))
              }
              className='flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors'
            >
              <FiRefreshCw className='h-3 w-3' /> Reset to default
            </button>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className='text-[10px] text-slate-400 dark:text-slate-600 text-center'>
        Simulations are estimates based on your current data and 12% annual return assumption. Not investment advice.
      </p>
    </div>
  );
}

// suppress unused import warnings
void FiActivity; void FiBarChart2; void FiDollarSign; void FiHome; void FiTrendingDown;
