/**
 * Loan vs Cash Simulator â€” compare paying cash vs taking a loan.
 * Shows impact on net worth, cashflow, emergency fund, investments.
 */
import { useState, useMemo } from 'react';
import { FiArrowRight } from 'react-icons/fi';
import { usePortfolioStore } from '../../store/portfolioStore';
import { futureValue } from '../../utils/goalProbability';
import { formatINR, formatNumber } from '../../utils/format';

export function LoanVsCashCard() {
  const [cost,    setCost]    = useState(500000);
  const [loanPct, setLoanPct] = useState(80);     // % financed
  const [rate,    setRate]    = useState(10);      // annual interest %
  const [tenure,  setTenure]  = useState(36);      // months
  const [invRate, setInvRate] = useState(12);      // expected investment return %

  const { cashflows, accounts, essentials } = usePortfolioStore();

  const avgExp = useMemo(() => {
    const exp = cashflows.filter(e => e.type === 'expense');
    const mos = new Set(exp.map(e => e.date.slice(0, 7))).size || 1;
    return exp.reduce((a, e) => a + e.amount, 0) / mos;
  }, [cashflows]);

  const bankBalance = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const efCurrent   = essentials.emergencyFundCurrent ?? 0;
  
  // Cash scenario
  const downPayCash   = cost;
  const cashRemaining = bankBalance - downPayCash;
  const efAfterCash   = Math.max(0, efCurrent - Math.max(0, -cashRemaining));

  // Loan scenario
  const downPayLoan   = cost * (1 - loanPct / 100);
  const loanAmount    = cost * (loanPct / 100);
  const mRate         = rate / 100 / 12;
  const emi           = mRate > 0
    ? Math.round((loanAmount * mRate) / (1 - Math.pow(1 + mRate, -tenure)))
    : Math.round(loanAmount / tenure);
  const totalInterest = emi * tenure - loanAmount;
  
  // Opportunity cost: what cash payment would have grown to if invested
  const cashOpportunityCost = futureValue(downPayCash, 0, invRate, tenure);
    const savedForInvesting   = futureValue(0, emi, invRate, tenure); // if saved instead of EMI

  // Net cost comparison
  void 0; // netCostCash removed // lost investment growth
  
    const efRunwayCash  = avgExp > 0 ? efAfterCash / avgExp : 0;
  const efRunwayLoan  = avgExp > 0 ? efCurrent / avgExp : 0;

  const recommendation =
    totalInterest < (cashOpportunityCost - downPayCash) * 0.5
      ? 'loan_better'
      : 'cash_better';

  
  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden'>
      <div className='px-5 py-4 border-b border-slate-100 dark:border-slate-800'>
        <h2 className='text-sm font-bold text-slate-900 dark:text-slate-100'>âš–ï¸ Loan vs Cash Simulator</h2>
        <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-0.5'>Should you pay cash or take a loan? Compare the true cost.</p>
      </div>

      <div className='p-4 grid grid-cols-1 md:grid-cols-2 gap-4'>
        {/* Inputs */}
        <div className='space-y-3'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400'>Purchase Details</p>
          {[
            { label: 'Purchase Amount (â‚¹)', value: cost, set: setCost, min: 10000, max: 10000000, step: 10000 },
            { label: 'Loan % (0 = full cash)', value: loanPct, set: setLoanPct, min: 0, max: 100, step: 5 },
            { label: 'Interest Rate (% pa)', value: rate, set: setRate, min: 1, max: 24, step: 0.5 },
            { label: 'Loan Tenure (months)', value: tenure, set: setTenure, min: 6, max: 120, step: 6 },
            { label: 'Investment Return (% pa)', value: invRate, set: setInvRate, min: 4, max: 20, step: 1 },
          ].map(({ label, value, set, min, max, step }) => (
            <div key={label}>
              <div className='flex justify-between text-xs mb-1'>
                <span className='text-slate-500 dark:text-slate-400'>{label}</span>
                <span className='font-bold text-slate-800 dark:text-slate-200'>
                  {label.includes('â‚¹') ? formatINR(value) : `${value}${label.includes('%') || label.includes('Loan %') ? '%' : ''}`}
                </span>
              </div>
              <input type='range' min={min} max={max} step={step} value={value}
                onChange={e => set(Number(e.target.value))}
                className='w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 cursor-pointer accent-violet-600' />
            </div>
          ))}
        </div>

        {/* Comparison */}
        <div className='space-y-3'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400'>Comparison</p>

          {/* Side-by-side */}
          <div className='grid grid-cols-2 gap-2'>
            {/* Cash column */}
            <div className={`rounded-xl border p-3 space-y-2 ${recommendation === 'cash_better' ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30'}`}>
              <p className='text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1'>
                ðŸ’µ Pay Cash {recommendation === 'cash_better' && <span className='text-[9px] bg-emerald-500 text-white rounded px-1'>Better</span>}
              </p>
              {[
                { label: 'Down Pay',    value: formatINR(downPayCash) },
                { label: 'EMI',         value: 'â‚¹0/mo' },
                { label: 'Cash Left',   value: formatINR(Math.max(0, cashRemaining)), danger: cashRemaining < 0 },
                { label: 'EF Runway',   value: `${formatNumber(efRunwayCash, 1)} mo` },
                { label: 'Opp. Cost',   value: formatINR(cashOpportunityCost - downPayCash), danger: true },
              ].map(({ label, value, danger }) => (
                <div key={label} className='flex justify-between text-[10px]'>
                  <span className='text-slate-500 dark:text-slate-400'>{label}</span>
                  <span className={`font-bold ${danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Loan column */}
            <div className={`rounded-xl border p-3 space-y-2 ${recommendation === 'loan_better' ? 'border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30'}`}>
              <p className='text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1'>
                ðŸ¦ Take Loan {recommendation === 'loan_better' && <span className='text-[9px] bg-violet-500 text-white rounded px-1'>Better</span>}
              </p>
              {[
                { label: 'Down Pay',    value: formatINR(downPayLoan) },
                { label: 'EMI',         value: `${formatINR(emi)}/mo`, danger: emi > 0 },
                { label: 'Interest',    value: formatINR(totalInterest), danger: true },
                { label: 'EF Runway',   value: `${formatNumber(efRunwayLoan, 1)} mo` },
                { label: 'Invest EMI',  value: `+${formatINR(savedForInvesting)}` },
              ].map(({ label, value, danger }) => (
                <div key={label} className='flex justify-between text-[10px]'>
                  <span className='text-slate-500 dark:text-slate-400'>{label}</span>
                  <span className={`font-bold ${danger ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verdict */}
          <div className={`rounded-xl border px-4 py-3 ${recommendation === 'cash_better' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-700/40' : 'bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-700/40'}`}>
            <p className='text-xs font-bold text-slate-800 dark:text-slate-200 mb-1'>
              {recommendation === 'cash_better' ? 'ðŸ’µ Pay cash â€” saves more long-term' : 'ðŸ¦ Loan makes sense â€” interest < opportunity cost'}
            </p>
            <p className='text-[11px] text-slate-500 dark:text-slate-400'>
              {recommendation === 'cash_better'
                ? `Paying cash saves ${formatINR(totalInterest)} in interest. The investment opportunity cost (${formatINR(cashOpportunityCost - downPayCash)}) is higher but net benefit favors cash.`
                : `Interest cost (${formatINR(totalInterest)}) is less than potential investment gains (${formatINR(cashOpportunityCost - downPayCash)}). Keep cash invested.`}
            </p>
          </div>

          {/* Monthly impact */}
          <div className='flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400'>
            <span>Monthly cashflow impact:</span>
            <FiArrowRight className='h-3 w-3' />
            <span className={`font-bold ${loanPct > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {loanPct > 0 ? `âˆ’${formatINR(emi)}/mo` : 'No EMI'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
