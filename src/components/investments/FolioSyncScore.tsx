// src/components/investments/FolioSyncScore.tsx
// FolioSync Score Ring + Detail Panel + Auto-Fetch from Screener.in

import { useRef, useState } from 'react';
import {
  type FundamentalData,
  type FolioSyncResult,
  getScoreColor,
  getSignalConfig,
  scoreFundamentals,
} from '../../utils/folioSyncEngine';
import {
  fetchFundamentalsForSymbol,
  canAutoFetch,
  getCacheAge,
  invalidateFundamentalsCache,
  getFundamentalsSymbol,
} from '../../services/fundamentalsService';
import { createPortal } from 'react-dom';

// ── Circular Score Ring ──────────────────────────────────────────────────────
export function ScoreRing({
  score,
  size = 56,
  signal,
}: {
  score: number;
  size?: number;
  signal: FolioSyncResult['signal'];
}) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const fill = (score / 10) * circumference;
  const color = getScoreColor(score);
  const signalConf = getSignalConfig(signal);

  return (
    <div
      className='relative flex items-center justify-center'
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill='none'
          stroke='rgba(255,255,255,0.06)'
          strokeWidth={5}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill='none'
          stroke={color}
          strokeWidth={5}
          strokeLinecap='round'
          strokeDasharray={circumference}
          strokeDashoffset={circumference - fill}
          style={{
            filter: `drop-shadow(${signalConf.glow})`,
            transition: 'stroke-dashoffset 1s ease',
          }}
        />
      </svg>
      <div
        className='absolute flex flex-col items-center justify-center'
        style={{ transform: 'none' }}
      >
        <span
          className='font-black leading-none tabular-nums'
          style={{ fontSize: size * 0.28, color }}
        >
          {score.toFixed(1)}
        </span>
        <span
          className='text-slate-900 dark:text-slate-500 leading-none'
          style={{ fontSize: size * 0.14 }}
        >
          /10
        </span>
      </div>
    </div>
  );
}

// ── Category Mini Bars ───────────────────────────────────────────────────────
const CAT_LABELS: Record<string, string> = {
  valuation: 'Val',
  profitability: 'Prof',
  financialHealth: 'Hlth',
  growth: 'Grwth',
  income: 'Div',
  marketContext: 'Mkt',
};

export function CategoryBars({
  categories,
}: {
  categories: FolioSyncResult['categories'];
}) {
  return (
    <div className='flex items-end gap-0.5'>
      {Object.entries(categories).map(([key, val]) => {
        const color = getScoreColor(val);
        const height = Math.max(4, (val / 10) * 20);
        return (
          <div
            key={key}
            className='flex flex-col items-center gap-0.5'
            title={`${CAT_LABELS[key]}: ${val.toFixed(1)}`}
          >
            <div
              className='rounded-sm w-3 transition-all duration-700'
              style={{ height, backgroundColor: color, opacity: 0.85 }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── FolioSync Input Form (modal for entering fundamentals) ───────────────────
interface FolioSyncInputFormProps {
  invName: string;
  assetClass?: import('../../utils/folioSyncEngine').AssetClass;
  initial?: FundamentalData;
  onScore: (data: FundamentalData) => void;
  onClose: () => void;
}

// ── Reusable checkbox helper ─────────────────────────────────────────────────
function BoolCheck({
  label,
  checked,
  onChange,
  danger = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <label className='flex items-start gap-2 cursor-pointer group'>
      <div
        className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
          checked
            ? danger
              ? 'bg-rose-500 border-rose-500'
              : 'bg-emerald-500 border-emerald-500'
            : danger
              ? 'border-rose-800 bg-slate-200 dark:bg-slate-800'
              : 'border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-800'
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg
            className='w-3 h-3 text-white'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={3}
              d='M5 13l4 4L19 7'
            />
          </svg>
        )}
      </div>
      <span
        className={`text-xs transition-colors select-none ${checked ? (danger ? 'text-rose-300' : 'text-emerald-300') : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:text-slate-800 dark:hover:text-slate-900 dark:text-slate-800 dark:text-slate-200'}`}
      >
        {label}
      </span>
    </label>
  );
}

const ASSET_CLASS_LABELS: Record<string, string> = {
  equity: '🇮🇳 Indian Equity',
  mutual_fund: '📊 Mutual Fund',
  gold: '🥇 Gold / Silver ETF',
  crypto: '₿ Crypto',
  us_stock: '🇺🇸 US Stock',
  other: '📦 Other',
};

const FIELD_GROUPS = [
  {
    label: 'Valuation',
    fields: [
      { key: 'pe', label: 'P/E Ratio', hint: 'Current P/E' },
      { key: 'sectorPe', label: 'Sector P/E', hint: 'Peer avg P/E' },
      { key: 'peg', label: 'PEG Ratio', hint: '<1 = value buy' },
      { key: 'pb', label: 'P/B Ratio', hint: 'Price to Book' },
    ],
  },
  {
    label: 'Profitability',
    fields: [
      { key: 'roe', label: 'ROE %', hint: '>20% = strong' },
      { key: 'roce', label: 'ROCE %', hint: '>18% = strong' },
      { key: 'netMargin', label: 'Net Margin %', hint: '>18% = strong' },
      { key: 'operatingMargin', label: 'Op. Margin %', hint: '>22% = strong' },
    ],
  },
  {
    label: 'Financial Health',
    fields: [
      { key: 'debtToEquity', label: 'Debt/Equity', hint: '<0.3 = safe' },
      { key: 'currentRatio', label: 'Current Ratio', hint: '>2 = strong' },
      {
        key: 'interestCoverage',
        label: 'Interest Coverage',
        hint: '>8x = safe',
      },
    ],
  },
  {
    label: 'Growth',
    fields: [
      {
        key: 'revenueGrowthYoY',
        label: 'Revenue Growth YoY %',
        hint: '>20% = strong',
      },
      {
        key: 'earningsGrowthYoY',
        label: 'Earnings Growth YoY %',
        hint: '>20% = strong',
      },
      { key: 'salesCagr3yr', label: 'Sales CAGR 3yr %', hint: '>18% = strong' },
      {
        key: 'profitCagr3yr',
        label: 'Profit CAGR 3yr %',
        hint: '>20% = strong',
      },
      { key: 'salesCagr5yr', label: 'Sales CAGR 5yr %', hint: '>15% = strong' },
      {
        key: 'profitCagr5yr',
        label: 'Profit CAGR 5yr %',
        hint: '>18% = strong',
      },
    ],
  },
  {
    label: 'Holding',
    fields: [
      {
        key: 'promoterHolding',
        label: 'Promoter Holding %',
        hint: '>55% = strong',
      },
      {
        key: 'institutionalHolding',
        label: 'Institutional %',
        hint: '>40% = strong',
      },
      { key: 'promoterPledging', label: 'Pledging %', hint: '>30% = risk' },
    ],
  },
  {
    label: 'Market',
    fields: [
      {
        key: 'fiftyTwoWeekPosition',
        label: '52W Position %',
        hint: '20-60% = buy zone',
      },
      { key: 'beta', label: 'Beta', hint: '<1 = less volatile' },
    ],
  },
  {
    label: 'Dividends',
    fields: [
      { key: 'dividendYield', label: 'Dividend Yield %', hint: '>3% = strong' },
      {
        key: 'dividendPayoutRatio',
        label: 'Payout Ratio %',
        hint: '20-50% = ideal',
      },
      {
        key: 'dividendConsistencyYears',
        label: 'Consistency (years)',
        hint: '>15 = strong',
      },
    ],
  },
] as const;

export function FolioSyncInputForm({
  invName,
  assetClass = 'equity',
  initial,
  onScore,
  onClose,
}: FolioSyncInputFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!initial) return {};
    return Object.fromEntries(
      Object.entries(initial)
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => [k, String(v)]),
    );
  });

  const [boolValues, setBoolValues] = useState<Record<string, boolean>>(() => ({
    fcfPositive: initial?.fcfPositive ?? false,
    fcfGrowing: initial?.fcfGrowing ?? false,
    quarterlyRevenueGrowingYoY: initial?.quarterlyRevenueGrowingYoY ?? false,
    quarterlyProfitGrowingYoY: initial?.quarterlyProfitGrowingYoY ?? false,
    netProfitNegativeAnyQuarter: initial?.netProfitNegativeAnyQuarter ?? false,
    ebitdaMarginExpanding: initial?.ebitdaMarginExpanding ?? false,
    revenueDecliningStraight2Q: initial?.revenueDecliningStraight2Q ?? false,
    otherIncomeHigh: initial?.otherIncomeHigh ?? false,
    // Hard caps
    netLoss2ConsecYears: initial?.netLoss2ConsecYears ?? false,
    promoterPledgingOver50: initial?.promoterPledgingOver50 ?? false,
    debtOver3x: initial?.debtOver3x ?? false,
    auditorQualification: initial?.auditorQualification ?? false,
    revenueDeclinig3ConsecYears: initial?.revenueDeclinig3ConsecYears ?? false,
    negativeFcf3Years: initial?.negativeFcf3Years ?? false,
    promoterHoldingDropOver10pctInQtr:
      initial?.promoterHoldingDropOver10pctInQtr ?? false,
  }));

  const handleSubmit = () => {
    const data: FundamentalData = { ...boolValues } as any;
    for (const [k, v] of Object.entries(values)) {
      const n = parseFloat(v);
      if (!isNaN(n)) (data as any)[k] = n;
    }
    onScore(data);
  };

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center p-4'>
      <div
        className='absolute inset-0 bg-black/70 backdrop-blur-sm'
        onClick={onClose}
      />
      <div
        className='relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl custom-scrollbar'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'>
          <div>
            <div className='flex items-center gap-2'>
              <span className='text-xs font-black uppercase tracking-widest text-emerald-500'>
                FolioSync
              </span>
              <span className='text-slate-500 dark:text-slate-600 text-xs'>·</span>
              <span className='text-xs text-slate-500 dark:text-slate-400'>
                Fundamental Analysis
              </span>
            </div>
            <h2 className='text-base font-bold text-white mt-0.5 truncate max-w-sm'>
              {invName}
            </h2>
            <div className='mt-1 inline-flex items-center rounded-md border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400'>
              {ASSET_CLASS_LABELS[assetClass] ?? assetClass}
            </div>
          </div>
          <button
            onClick={onClose}
            className='text-slate-900 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors p-1'
          >
            <svg
              className='w-5 h-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        <div className='p-6 space-y-6'>
          <p className='text-xs text-slate-900 dark:text-slate-500'>
            Enter fundamentals from Screener.in, Tickertape or any source. Leave
            blank if unknown — scores are computed only from available data.
          </p>

          {FIELD_GROUPS.map((group) => (
            <div key={group.label}>
              <div className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-2'>
                {group.label}
              </div>
              <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
                {group.fields.map((f) => (
                  <div key={f.key}>
                    <label className='text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1'>
                      {f.label}
                    </label>
                    <input
                      type='number'
                      step='any'
                      placeholder={f.hint}
                      value={values[f.key] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [f.key]: e.target.value,
                        }))
                      }
                      className='w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500 placeholder:text-slate-500 dark:text-slate-600'
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Qualitative Signals */}
          <div>
            <div className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-2'>
              Qualitative Signals
            </div>
            <div className='grid grid-cols-2 gap-2'>
              {[
                { key: 'fcfPositive', label: 'FCF Positive' },
                { key: 'fcfGrowing', label: 'FCF Growing' },
                {
                  key: 'quarterlyRevenueGrowingYoY',
                  label: 'Revenue Growing 4 Qtrs YoY',
                },
                {
                  key: 'quarterlyProfitGrowingYoY',
                  label: 'Profit Growing 4 Qtrs YoY',
                },
                {
                  key: 'ebitdaMarginExpanding',
                  label: 'EBITDA Margin Expanding',
                },
                {
                  key: 'netProfitNegativeAnyQuarter',
                  label: 'Loss in Any Recent Quarter',
                },
                {
                  key: 'revenueDecliningStraight2Q',
                  label: 'Revenue Declining 2+ Qtrs QoQ',
                },
                {
                  key: 'otherIncomeHigh',
                  label: 'Other Income > 30% of Net Profit',
                },
              ].map((f) => (
                <BoolCheck
                  key={f.key}
                  label={f.label}
                  checked={boolValues[f.key]}
                  onChange={(v) =>
                    setBoolValues((prev) => ({ ...prev, [f.key]: v }))
                  }
                />
              ))}
            </div>
          </div>

          {/* Hard Cap Flags — score capped at 4 if any triggered */}
          <div>
            <div className='flex items-center gap-2 mb-2'>
              <div className='text-[10px] font-black uppercase tracking-widest text-rose-500'>
                ⚠ Hard Cap Flags
              </div>
              <span className='text-[9px] text-slate-500 dark:text-slate-600'>
                Score capped at 4.0 if any are checked
              </span>
            </div>
            <div className='grid grid-cols-2 gap-2 p-3 rounded-xl border border-rose-500/20 bg-rose-500/5'>
              {[
                {
                  key: 'netLoss2ConsecYears',
                  label: 'Net Loss 2+ Consecutive Years',
                },
                {
                  key: 'promoterPledgingOver50',
                  label: 'Promoter Pledging > 50%',
                },
                {
                  key: 'debtOver3x',
                  label: 'Debt/Equity > 3.0 (non-financial)',
                },
                {
                  key: 'auditorQualification',
                  label: 'Auditor Qualification / Adverse Opinion',
                },
                {
                  key: 'revenueDeclinig3ConsecYears',
                  label: 'Revenue Declining 3+ Years',
                },
                {
                  key: 'negativeFcf3Years',
                  label: 'Negative FCF for 3+ Years',
                },
                {
                  key: 'promoterHoldingDropOver10pctInQtr',
                  label: 'Promoter Holding Dropped > 10% in a Quarter',
                },
              ].map((f) => (
                <BoolCheck
                  key={f.key}
                  label={f.label}
                  checked={boolValues[f.key]}
                  onChange={(v) =>
                    setBoolValues((prev) => ({ ...prev, [f.key]: v }))
                  }
                  danger
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'>
          <button
            onClick={onClose}
            className='px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className='flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors'
          >
            <svg
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
              />
            </svg>
            Score It
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FolioSync Detail Drawer ──────────────────────────────────────────────────
interface FolioSyncDetailProps {
  invName: string;
  assetClass?: import('../../utils/folioSyncEngine').AssetClass;
  result: FolioSyncResult;
  fundamentals: FundamentalData;
  onEdit: () => void;
  onRefetch?: () => void;
  onClose: () => void;
}

function MetricRow({
  label,
  value,
  strong,
  weak,
}: {
  label: string;
  value?: number | string;
  strong?: number;
  weak?: number;
}) {
  if (value === undefined || value === null) {
    return (
      <div className='flex items-center justify-between py-1.5 border-b border-slate-200/70 dark:border-slate-800/60 last:border-0'>
        <span className='text-[11px] text-slate-900 dark:text-slate-500'>{label}</span>
        <span className='text-slate-600 dark:text-slate-700 text-[11px]'>—</span>
      </div>
    );
  }
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  let statusColor = 'text-slate-600 dark:text-slate-700 dark:text-slate-300';
  if (strong !== undefined && weak !== undefined && !isNaN(num)) {
    if (num >= strong) statusColor = 'text-emerald-400';
    else if (num <= weak) statusColor = 'text-rose-400';
    else statusColor = 'text-amber-300';
  }
  return (
    <div className='flex items-center justify-between py-1.5 border-b border-slate-200/70 dark:border-slate-800/60 last:border-0'>
      <span className='text-[11px] text-slate-900 dark:text-slate-500'>{label}</span>
      <span className={`text-[12px] font-bold tabular-nums ${statusColor}`}>
        {typeof value === 'number'
          ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
          : value}
      </span>
    </div>
  );
}

export function FolioSyncDetailDrawer({
  invName,
  assetClass = 'equity',
  result,
  fundamentals: f,
  onEdit,
  onRefetch,
  onClose,
}: FolioSyncDetailProps) {
  const signalConf = getSignalConfig(result.signal);
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'valuation'
    | 'profitability'
    | 'growth'
    | 'health'
    | 'dividends'
    | 'market'
  >('overview');

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'valuation', label: 'Valuation' },
    { id: 'profitability', label: 'Profit' },
    { id: 'growth', label: 'Growth' },
    { id: 'health', label: 'Health' },
    { id: 'dividends', label: 'Dividends' },
    { id: 'market', label: 'Market' },
  ] as const;

  return createPortal(
    <div
      className='fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-4'
      onClick={onClose}
    >
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' />
      <div
        className='relative w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-start justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0'>
          <div className='flex items-start gap-3 min-w-0'>
            <ScoreRing
              score={result.composite}
              size={62}
              signal={result.signal}
            />
            <div className='min-w-0'>
              <h3 className='font-bold text-white text-sm truncate max-w-[200px]'>
                {invName}
              </h3>
              <div className='flex items-center gap-1.5 mt-1 flex-wrap'>
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${signalConf.bg} ${signalConf.border} ${signalConf.text}`}
                  style={{ textShadow: `0 0 8px ${signalConf.color}44` }}
                >
                  {signalConf.label}
                </span>
                <span className='inline-flex items-center rounded-md border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-900 dark:text-slate-500'>
                  {ASSET_CLASS_LABELS[assetClass] ?? assetClass}
                </span>
                {result.hardCapApplied && (
                  <span className='inline-flex items-center rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-400'>
                    ⚠ CAP
                  </span>
                )}
              </div>
              <div className='mt-2'>
                <CategoryBars categories={result.categories} />
              </div>
            </div>
          </div>
          <div className='flex items-center gap-2 shrink-0 ml-2'>
            {onRefetch && (
              <button
                onClick={onRefetch}
                className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-[11px] font-bold text-emerald-500 hover:text-emerald-300 hover:border-emerald-600/60 transition-all'
                title='Re-fetch from Screener.in'
              >
                <svg
                  className='w-3 h-3'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                  />
                </svg>
                Re-fetch
              </button>
            )}
            <button
              onClick={onEdit}
              className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-700 dark:text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-all'
            >
              <svg
                className='w-3 h-3'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                />
              </svg>
              Edit
            </button>
            <button
              onClick={onClose}
              className='text-slate-900 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors p-1'
            >
              <svg
                className='w-5 h-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className='flex items-center gap-0 px-4 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar shrink-0'>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2.5 text-[11px] font-bold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-900 dark:text-slate-500 hover:text-slate-600 dark:text-slate-700 dark:hover:text-slate-600 dark:text-slate-700 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto p-5 custom-scrollbar'>
          {activeTab === 'overview' && (
            <div className='space-y-5'>
              {/* Category scores */}
              <div>
                <div className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-3'>
                  Category Scores
                </div>
                <div className='grid grid-cols-3 gap-2'>
                  {Object.entries(result.categories).map(([key, val]) => {
                    const color = getScoreColor(val);
                    const labels: Record<string, string> = {
                      valuation: 'Valuation',
                      profitability: 'Profitability',
                      financialHealth: 'Fin. Health',
                      growth: 'Growth',
                      income: 'Dividends',
                      marketContext: 'Market',
                    };
                    return (
                      <div
                        key={key}
                        className='rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-800/40 p-3 flex flex-col gap-1'
                      >
                        <span className='text-[9px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-500'>
                          {labels[key]}
                        </span>
                        <span
                          className='text-lg font-black tabular-nums'
                          style={{ color }}
                        >
                          {val.toFixed(1)}
                        </span>
                        <div className='h-1 rounded-full bg-slate-300 dark:bg-slate-700'>
                          <div
                            className='h-1 rounded-full transition-all'
                            style={{
                              width: `${val * 10}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pros */}
              {result.pros.length > 0 && (
                <div>
                  <div className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-2'>
                    Strengths
                  </div>
                  <div className='space-y-1.5'>
                    {result.pros.map((p, i) => (
                      <div
                        key={i}
                        className='flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-700 dark:text-slate-300'
                      >
                        <span className='text-emerald-400 mt-0.5 shrink-0'>
                          ✓
                        </span>
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cons */}
              {result.cons.length > 0 && (
                <div>
                  <div className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-2'>
                    Weaknesses
                  </div>
                  <div className='space-y-1.5'>
                    {result.cons.map((c, i) => (
                      <div
                        key={i}
                        className='flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-700 dark:text-slate-300'
                      >
                        <span className='text-rose-400 mt-0.5 shrink-0'>✗</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.pros.length === 0 && result.cons.length === 0 && (
                <p className='text-xs text-slate-500 dark:text-slate-600 text-center py-4'>
                  Add more fundamentals to generate analysis
                </p>
              )}

              <p className='text-[10px] text-slate-600 dark:text-slate-700 border-t border-slate-200 dark:border-slate-800 pt-3'>
                For informational use only. Not financial advice. Always consult
                a SEBI-registered advisor.
              </p>
            </div>
          )}

          {activeTab === 'valuation' && (
            <div className='space-y-1'>
              <div className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-3'>
                Valuation Metrics
              </div>
              <MetricRow
                label='P/E Ratio'
                value={f.pe}
                strong={f.sectorPe ? f.sectorPe * 0.8 : undefined}
                weak={f.sectorPe ? f.sectorPe * 1.3 : undefined}
              />
              <MetricRow label='Sector P/E' value={f.sectorPe} />
              <MetricRow
                label='PEG Ratio'
                value={f.peg}
                strong={0.8}
                weak={2.0}
              />
              <MetricRow
                label='P/B Ratio'
                value={f.pb}
                strong={1.2}
                weak={3.5}
              />
              <MetricRow
                label='EV/EBITDA'
                value={f.evEbitda}
                strong={8}
                weak={18}
              />
              <div className='mt-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800'>
                <div className='text-[10px] font-bold text-slate-900 dark:text-slate-500 mb-1'>
                  Valuation Score
                </div>
                <span
                  className='text-2xl font-black'
                  style={{ color: getScoreColor(result.categories.valuation) }}
                >
                  {result.categories.valuation.toFixed(1)}
                </span>
                <span className='text-slate-500 dark:text-slate-600 text-sm'>/10</span>
              </div>
            </div>
          )}

          {activeTab === 'profitability' && (
            <div className='space-y-1'>
              <div className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-3'>
                Profitability Metrics
              </div>
              <MetricRow label='ROE %' value={f.roe} strong={22} weak={12} />
              <MetricRow label='ROCE %' value={f.roce} strong={20} weak={10} />
              <MetricRow
                label='Net Profit Margin %'
                value={f.netMargin}
                strong={18}
                weak={7}
              />
              <MetricRow
                label='Operating Margin %'
                value={f.operatingMargin}
                strong={22}
                weak={10}
              />
              <MetricRow
                label='FCF Positive'
                value={
                  f.fcfPositive !== undefined
                    ? f.fcfPositive
                      ? 'Yes'
                      : 'No'
                    : undefined
                }
              />
              <MetricRow
                label='FCF Growing'
                value={
                  f.fcfGrowing !== undefined
                    ? f.fcfGrowing
                      ? 'Yes'
                      : 'No'
                    : undefined
                }
              />
              <div className='mt-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800'>
                <div className='text-[10px] font-bold text-slate-900 dark:text-slate-500 mb-1'>
                  Profitability Score
                </div>
                <span
                  className='text-2xl font-black'
                  style={{
                    color: getScoreColor(result.categories.profitability),
                  }}
                >
                  {result.categories.profitability.toFixed(1)}
                </span>
                <span className='text-slate-500 dark:text-slate-600 text-sm'>/10</span>
              </div>
            </div>
          )}

          {activeTab === 'growth' && (
            <div className='space-y-1'>
              <div className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-3'>
                Growth Metrics
              </div>
              <MetricRow
                label='Revenue Growth YoY %'
                value={f.revenueGrowthYoY}
                strong={20}
                weak={8}
              />
              <MetricRow
                label='Earnings Growth YoY %'
                value={f.earningsGrowthYoY}
                strong={20}
                weak={10}
              />
              <MetricRow
                label='Sales CAGR 3yr %'
                value={f.salesCagr3yr}
                strong={18}
                weak={8}
              />
              <MetricRow
                label='Sales CAGR 5yr %'
                value={f.salesCagr5yr}
                strong={15}
                weak={6}
              />
              <MetricRow
                label='Profit CAGR 3yr %'
                value={f.profitCagr3yr}
                strong={20}
                weak={10}
              />
              <MetricRow
                label='Profit CAGR 5yr %'
                value={f.profitCagr5yr}
                strong={18}
                weak={8}
              />
              <MetricRow
                label='Stock CAGR 3yr %'
                value={f.stockCagr3yr}
                strong={15}
                weak={8}
              />
              <MetricRow
                label='Stock CAGR 5yr %'
                value={f.stockCagr5yr}
                strong={12}
                weak={6}
              />
              <MetricRow
                label='Promoter Holding %'
                value={f.promoterHolding}
                strong={55}
                weak={30}
              />
              <MetricRow
                label='Institutional Holding %'
                value={f.institutionalHolding}
                strong={40}
                weak={15}
              />
              <div className='mt-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800'>
                <div className='text-[10px] font-bold text-slate-900 dark:text-slate-500 mb-1'>
                  Growth Score
                </div>
                <span
                  className='text-2xl font-black'
                  style={{ color: getScoreColor(result.categories.growth) }}
                >
                  {result.categories.growth.toFixed(1)}
                </span>
                <span className='text-slate-500 dark:text-slate-600 text-sm'>/10</span>
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <div className='space-y-1'>
              <div className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-3'>
                Financial Health
              </div>
              <MetricRow
                label='Debt/Equity'
                value={f.debtToEquity}
                strong={0.3}
                weak={1.2}
              />
              <MetricRow
                label='Current Ratio'
                value={f.currentRatio}
                strong={2.0}
                weak={1.0}
              />
              <MetricRow
                label='Interest Coverage'
                value={f.interestCoverage}
                strong={8}
                weak={3}
              />
              <MetricRow label='Liabilities Trend' value={f.liabilitiesTrend} />
              <MetricRow label='Reserves Trend' value={f.reservesTrend} />
              {result.hardCapApplied && (
                <div className='mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30'>
                  <p className='text-[11px] text-rose-400 font-bold'>
                    ⚠ Hard Cap Applied
                  </p>
                  <p className='text-[10px] text-rose-400/70 mt-1'>
                    Score is capped at 4.0 due to a serious fundamental red
                    flag.
                  </p>
                </div>
              )}
              <div className='mt-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800'>
                <div className='text-[10px] font-bold text-slate-900 dark:text-slate-500 mb-1'>
                  Financial Health Score
                </div>
                <span
                  className='text-2xl font-black'
                  style={{
                    color: getScoreColor(result.categories.financialHealth),
                  }}
                >
                  {result.categories.financialHealth.toFixed(1)}
                </span>
                <span className='text-slate-500 dark:text-slate-600 text-sm'>/10</span>
              </div>
            </div>
          )}

          {activeTab === 'dividends' && (
            <div className='space-y-1'>
              <div className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-3'>
                Income & Dividends
              </div>
              <MetricRow
                label='Dividend Yield %'
                value={f.dividendYield}
                strong={3}
                weak={1}
              />
              <MetricRow
                label='Payout Ratio %'
                value={f.dividendPayoutRatio}
                strong={50}
                weak={70}
              />
              <MetricRow
                label='Consistency (years)'
                value={f.dividendConsistencyYears}
                strong={15}
                weak={5}
              />
              <MetricRow
                label='Dividend CAGR 5yr %'
                value={f.dividendCagr5yr}
                strong={12}
                weak={5}
              />

              <div className='mt-4 p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-900 dark:text-slate-500 space-y-1'>
                <p className='font-bold text-slate-500 dark:text-slate-400 mb-2'>
                  Scoring Thresholds
                </p>
                <p>
                  Yield <span className='text-emerald-400'>&gt;3%</span> =
                  Strong · <span className='text-amber-400'>1–3%</span> = OK ·{' '}
                  <span className='text-rose-400'>&lt;1%</span> = Weak
                </p>
                <p>
                  Payout <span className='text-emerald-400'>20–50%</span> =
                  Ideal · <span className='text-rose-400'>&gt;70%</span> =
                  Unsustainable
                </p>
                <p>
                  Consistency{' '}
                  <span className='text-emerald-400'>&gt;15 yrs</span> = Strong
                  · <span className='text-rose-400'>&lt;5 yrs</span> = Weak
                </p>
                <p>
                  Div. CAGR <span className='text-emerald-400'>&gt;12%</span> =
                  Strong · <span className='text-rose-400'>&lt;5%</span> = Weak
                </p>
              </div>

              <div className='mt-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800'>
                <div className='text-[10px] font-bold text-slate-900 dark:text-slate-500 mb-1'>
                  Income Score
                </div>
                <span
                  className='text-2xl font-black'
                  style={{ color: getScoreColor(result.categories.income) }}
                >
                  {result.categories.income.toFixed(1)}
                </span>
                <span className='text-slate-500 dark:text-slate-600 text-sm'>/10</span>
              </div>
            </div>
          )}

          {activeTab === 'market' && (
            <div className='space-y-1'>
              <div className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-3'>
                Market Context
              </div>
              <MetricRow
                label='52W Position %'
                value={f.fiftyTwoWeekPosition}
                strong={60}
                weak={85}
              />
              <MetricRow label='Beta' value={f.beta} strong={0.9} weak={1.4} />
              <MetricRow
                label='Market Cap Category'
                value={f.marketCapCategory}
              />

              <div className='mt-3 p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-900 dark:text-slate-500 space-y-1'>
                <p className='font-bold text-slate-500 dark:text-slate-400 mb-2'>
                  Scoring Thresholds
                </p>
                <p>
                  52W <span className='text-emerald-400'>20–60%</span> = Buy
                  zone · <span className='text-rose-400'>&gt;85%</span> =
                  Overbought
                </p>
                <p>
                  Beta <span className='text-emerald-400'>0.5–0.9</span> = Low
                  vol · <span className='text-rose-400'>&gt;1.8</span> = High
                  vol
                </p>
                <p>
                  Cap <span className='text-emerald-400'>Large</span> = Stable ·{' '}
                  <span className='text-rose-400'>Micro</span> = Volatile
                </p>
              </div>

              <div className='mt-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800'>
                <div className='text-[10px] font-bold text-slate-900 dark:text-slate-500 mb-1'>
                  Market Score
                </div>
                <span
                  className='text-2xl font-black'
                  style={{
                    color: getScoreColor(result.categories.marketContext),
                  }}
                >
                  {result.categories.marketContext.toFixed(1)}
                </span>
                <span className='text-slate-500 dark:text-slate-600 text-sm'>/10</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Asset class detector ─────────────────────────────────────────────────────
function detectAssetClass(
  inv: any,
): import('../../utils/folioSyncEngine').AssetClass {
  if (inv.type === 'mutual_fund') return 'mutual_fund';
  if (inv.type === 'stock') {
    if (inv.usdPrice || inv.buyPriceUsd || inv.usdToInr) return 'us_stock';
    return 'equity';
  }
  if (inv.type === 'other') {
    const at = (inv.assetType || '').toLowerCase();
    if (at === 'gold' || at === 'silver') return 'gold';
    if (at === 'crypto') return 'crypto';
    if (at === 'international_equity') return 'us_stock';
  }
  return 'other';
}

// ── Auto-Fetch Status Banner ──────────────────────────────────────────────────
type FetchStatus = 'idle' | 'fetching' | 'success' | 'partial' | 'error';

function FetchStatusBadge({
  status,
  cacheAge,
  onRefresh,
}: {
  status: FetchStatus;
  symbol?: string;
  cacheAge?: string | null;
  onRefresh?: () => void;
}) {
  if (status === 'idle') return null;

  const configs: Record<
    FetchStatus,
    { icon: string; text: string; color: string }
  > = {
    idle: { icon: '', text: '', color: '' },
    fetching: {
      icon: '⟳',
      text: 'Fetching from Screener.in…',
      color: 'text-slate-500 dark:text-slate-400',
    },
    success: {
      icon: '✓',
      text: `Fetched${cacheAge ? ` · ${cacheAge}` : ''}`,
      color: 'text-emerald-400',
    },
    partial: {
      icon: '⚠',
      text: 'Some data missing — edit to fill in',
      color: 'text-amber-400',
    },
    error: {
      icon: '✕',
      text: 'Fetch failed — enter manually',
      color: 'text-rose-400',
    },
  };
  const c = configs[status];

  return (
    <div
      className={`flex items-center gap-1.5 text-[10px] font-semibold ${c.color}`}
    >
      <span
        className={status === 'fetching' ? 'animate-spin inline-block' : ''}
      >
        {c.icon}
      </span>
      <span>{c.text}</span>
      {(status === 'success' || status === 'partial') && onRefresh && (
        <button
          onClick={onRefresh}
          className='ml-1 text-slate-500 dark:text-slate-600 hover:text-emerald-400 transition-colors'
          title='Re-fetch from Screener.in'
        >
          ↻
        </button>
      )}
    </div>
  );
}

// ── FolioSync Score Cell (for table row) ─────────────────────────────────────
interface FolioSyncCellProps {
  inv: any;
  storedFundamentals?: FundamentalData;
  storedResult?: FolioSyncResult;
  onSave: (
    invId: string,
    fundamentals: FundamentalData,
    result: FolioSyncResult,
  ) => void;
}

export function FolioSyncCell({
  inv,
  storedFundamentals,
  storedResult,
  onSave,
}: FolioSyncCellProps) {
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  // Store latest fetched data locally so form gets pre-filled immediately
  // (storedFundamentals prop won't update until parent re-renders)
  const [localFundamentals, setLocalFundamentals] = useState<
    FundamentalData | undefined
  >(undefined);
  const cellRef = useRef<HTMLDivElement>(null);

  const result = storedResult;
  const fundamentals = localFundamentals ?? storedFundamentals ?? {};
  const assetClass = detectAssetClass(inv);
  const eligible = canAutoFetch(inv);
  // Build the correct symbol for this asset (e.g. "TCS" or "MF:119551")
  const fetchSymbol = eligible ? getFundamentalsSymbol(inv) : null;
  const cacheKey = fetchSymbol ?? inv.symbol ?? inv.id;
  const cacheAge = eligible ? getCacheAge(cacheKey) : null;
  const isMF = assetClass === 'mutual_fund';

  // ── Auto-fetch: Screener.in for equity, mfapi.in for MF ─────────────────
  const handleAutoFetch = async (forceRefresh = false) => {
    if (!eligible || !fetchSymbol) return;

    if (forceRefresh) invalidateFundamentalsCache([cacheKey]);

    setFetchStatus('fetching');
    try {
      const data = await fetchFundamentalsForSymbol(fetchSymbol);
      if (!data || data._source === 'error') {
        setFetchStatus('error');
        setShowForm(true);
        return;
      }

      // Key fields differ by asset type — MF only has return-based fields
      const keyFields: (keyof FundamentalData)[] = isMF
        ? [
            'salesCagr3yr',
            'salesCagr5yr',
            'revenueGrowthYoY',
            'fiftyTwoWeekPosition',
          ]
        : [
            'pe',
            'roe',
            'roce',
            'debtToEquity',
            'revenueGrowthYoY',
            'netMargin',
            'operatingMargin',
          ];
      const filled = keyFields.filter(
        (k) => data[k] !== null && data[k] !== undefined,
      ).length;
      setFetchStatus(filled >= 2 ? 'success' : 'partial');

      // Strip all internal meta keys (_source, _symbol, _mfName, etc.)
      const cleanData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith('_')) cleanData[k] = v;
      }
      const typedData = cleanData as FundamentalData;

      // Save locally first so form pre-fills immediately (before parent re-renders)
      setLocalFundamentals(typedData);

      // Score and save to parent
      const scored = scoreFundamentals(typedData, assetClass);
      onSave(inv.id, typedData, scored);

      // Open detail drawer on success, pre-filled form on partial
      if (filled >= 2) {
        setShowDetail(true);
      } else {
        setShowForm(true);
      }
    } catch (e) {
      console.error('[FolioSyncCell] Auto-fetch error:', e);
      setFetchStatus('error');
      setShowForm(true);
    }
  };

  const handleScore = (data: FundamentalData) => {
    const r = scoreFundamentals(data, assetClass);
    onSave(inv.id, data, r);
    setShowForm(false);
    setFetchStatus('success');
    setShowDetail(true);
  };

  const signalConf = result ? getSignalConfig(result.signal) : null;

  return (
    <>
      <div ref={cellRef as any} className='flex flex-col gap-1 min-w-0'>
        {result ? (
          // ── Already scored — show ring + signal + re-fetch option ─────────
          <div className='flex items-center gap-2 min-w-0'>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDetail(true);
              }}
              className='flex items-center gap-2 group/score min-w-0'
              title='View FolioSync analysis'
            >
              <ScoreRing
                score={result.composite}
                size={44}
                signal={result.signal}
              />
              <div className='flex flex-col items-start gap-1 min-w-0'>
                <span
                  className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap ${signalConf?.bg} ${signalConf?.border} ${signalConf?.text}`}
                >
                  {signalConf?.label}
                </span>
                <CategoryBars categories={result.categories} />
              </div>
            </button>

            {/* Re-fetch button (only for eligible equity) */}
            {eligible && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAutoFetch(true);
                }}
                disabled={fetchStatus === 'fetching'}
                className='opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-[9px] font-bold text-emerald-600 hover:text-emerald-400 hover:border-emerald-500/40 transition-all'
                title='Re-fetch fundamentals from Screener.in'
              >
                <span
                  className={
                    fetchStatus === 'fetching'
                      ? 'animate-spin inline-block'
                      : ''
                  }
                >
                  ↻
                </span>
                {cacheAge && <span className='text-slate-500 dark:text-slate-600'>{cacheAge}</span>}
              </button>
            )}
          </div>
        ) : eligible ? (
          // ── Eligible for auto-fetch — show Auto + Manual buttons ──────────
          <div className='flex items-center gap-1.5'>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAutoFetch();
              }}
              disabled={fetchStatus === 'fetching'}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all border whitespace-nowrap ${
                fetchStatus === 'fetching'
                  ? 'border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-500 cursor-not-allowed'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400/60 active:scale-95'
              }`}
              title='Auto-fetch from Screener.in and score'
            >
              {fetchStatus === 'fetching' ? (
                <span className='animate-spin inline-block text-[11px]'>⟳</span>
              ) : (
                <svg
                  className='w-3 h-3 shrink-0'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                  />
                </svg>
              )}
              {fetchStatus === 'fetching' ? 'Fetching…' : 'Auto-Fetch'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowForm(true);
              }}
              className='flex items-center gap-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-2 py-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:border-slate-600 transition-all whitespace-nowrap'
              title='Enter fundamentals manually'
            >
              <svg
                className='w-2.5 h-2.5 shrink-0'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                />
              </svg>
              Manual
            </button>
          </div>
        ) : (
          // ── Not eligible (MF, crypto, etc.) — manual only ─────────────────
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowForm(true);
            }}
            className='flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-600 hover:text-emerald-400 hover:border-emerald-500/40 transition-all whitespace-nowrap'
            title='Enter fundamentals manually'
          >
            <svg
              className='w-3 h-3 shrink-0'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
              />
            </svg>
            Score
          </button>
        )}

        {/* Fetch status feedback row */}
        {fetchStatus !== 'idle' && !result && (
          <FetchStatusBadge
            status={fetchStatus}
            symbol={inv.symbol}
            cacheAge={cacheAge}
          />
        )}
      </div>

      {showForm && (
        <FolioSyncInputForm
          key={JSON.stringify(fundamentals).slice(0, 50)}
          invName={inv.name}
          assetClass={assetClass}
          initial={fundamentals as FundamentalData}
          onScore={handleScore}
          onClose={() => setShowForm(false)}
        />
      )}

      {showDetail && result && (
        <FolioSyncDetailDrawer
          invName={inv.name}
          assetClass={assetClass}
          result={result}
          fundamentals={fundamentals}
          onEdit={() => {
            setShowDetail(false);
            setShowForm(true);
          }}
          onRefetch={
            eligible
              ? () => {
                  setShowDetail(false);
                  handleAutoFetch(true);
                }
              : undefined
          }
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}
