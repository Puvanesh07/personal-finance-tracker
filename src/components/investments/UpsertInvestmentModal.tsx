// src/components/investments/UpsertInvestmentModal.tsx

import {
  FiBox,
  FiBriefcase,
  FiCheck,
  FiChevronDown,
  FiGlobe,
  FiHome,
  FiMonitor,
  FiPieChart,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';
import type { BondPayoutFrequency, Investment, InvestmentType } from '../../types/investmentTypes';
import {
  MONTHS_PER_PERIOD,
  PAYOUT_FREQUENCY_LABELS,
  PAYOUT_FREQUENCY_OPTIONS,
  bondInterestPerPeriod,
} from '../../utils/bondSchedule';
import { addMonths as addMonthsStr } from '../../services/dateService';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Modal } from '../ui/Modal';
import { NumericInput } from '../ui/NumericInput';
import { CalendarPicker } from '../ui/CalendarPicker';
import { Popover } from '../ui/Popover';
import { fetchStockMetadata } from '../../services/stockMetadataService';
import { todayISO } from '../../utils/dateUtils';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Enhanced Type Definitions ──────────────────────────────────────────────
type ExtendedAssetCategory =
  | 'stock'
  | 'international_equity'
  | 'mutual_fund'
  | 'bond'
  | 'fixed_deposit'
  | 'ppf'
  | 'nps'
  | 'real_estate'
  | 'gold'
  | 'silver'
  | 'crypto'
  | 'other';

const ASSET_CATEGORIES = [
  {
    group: 'Equities & Markets',
    options: [
      {
        id: 'stock',
        label: 'Indian Stocks',
        type: 'stock',
        icon: FiTrendingUp,
        color: 'text-emerald-400',
        bg: 'bg-emerald-400/10',
        desc: 'NSE/BSE direct equity',
      },
      {
        id: 'international_equity',
        label: 'Intl. Equity',
        type: 'stock',
        icon: FiGlobe,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10',
        desc: 'US Stocks, ETFs',
      },
      {
        id: 'mutual_fund',
        label: 'Mutual Funds',
        type: 'mutual_fund',
        icon: FiPieChart,
        color: 'text-indigo-400',
        bg: 'bg-indigo-400/10',
        desc: 'Index, Active, ELSS',
      },
    ],
  },
  {
    group: 'Fixed Income & Debt',
    options: [
      {
        id: 'fixed_deposit',
        label: 'Fixed Deposits',
        type: 'fixed_deposit',
        icon: FiShield,
        color: 'text-amber-400',
        bg: 'bg-amber-400/10',
        desc: 'Bank & Corporate FDs',
      },
      {
        id: 'bond',
        label: 'Bonds & SGBs',
        type: 'bond',
        icon: FiBriefcase,
        color: 'text-violet-400',
        bg: 'bg-violet-400/10',
        desc: 'Govt, Corporate, Gold Bonds',
      },
      {
        id: 'ppf',
        label: 'PPF',
        type: 'other',
        icon: FiBox,
        color: 'text-teal-400',
        bg: 'bg-teal-400/10',
        desc: 'Public Provident Fund',
      },
      {
        id: 'nps',
        label: 'NPS',
        type: 'other',
        icon: FiBox,
        color: 'text-cyan-400',
        bg: 'bg-cyan-400/10',
        desc: 'National Pension System',
      },
      {
        id: 'epf',
        label: 'EPF / PF',
        type: 'other',
        icon: FiBox,
        color: 'text-violet-400',
        bg: 'bg-violet-400/10',
        desc: 'Employee Provident Fund',
      },
    ],
  },
  {
    group: 'Alternative Assets',
    options: [
      {
        id: 'gold',
        label: 'Physical Gold',
        type: 'other',
        icon: FiBox,
        color: 'text-yellow-400',
        bg: 'bg-yellow-400/10',
        desc: 'Coins, Bars, Jewelry',
      },
      {
        id: 'silver',
        label: 'Physical Silver',
        type: 'other',
        icon: FiBox,
        color: 'text-slate-600 dark:text-slate-700 dark:text-slate-300',
        bg: 'bg-slate-400/10',
        desc: 'Coins, Bars, Ornaments',
      },
      {
        id: 'real_estate',
        label: 'Real Estate',
        type: 'other',
        icon: FiHome,
        color: 'text-orange-400',
        bg: 'bg-orange-400/10',
        desc: 'Land, Property, REITs',
      },
      {
        id: 'crypto',
        label: 'Crypto',
        type: 'other',
        icon: FiMonitor,
        color: 'text-rose-400',
        bg: 'bg-rose-400/10',
        desc: 'Bitcoin, Ethereum',
      },
      {
        id: 'other',
        label: 'Other Asset',
        type: 'other',
        icon: FiBox,
        color: 'text-slate-500 dark:text-slate-400',
        bg: 'bg-slate-400/10',
        desc: 'Startups, P2P, Cash',
      },
    ],
  },
];

// ── Fetch live USD → INR rate ─────────────────────────────────────────────
async function fetchUsdToInr(): Promise<number> {
  try {
    // Replaced frankfurter with open.er-api.com which allows CORS on localhost
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    return data?.rates?.INR ?? 84;
  } catch (error) {
    console.error('Failed to fetch USD rate:', error);
    return 84; // fallback
  }
}

// ── Rich Asset Dropdown ───────────────────────────────────────────────────
function RichAssetDropdown({
  value,
  onChange,
}: {
  value: ExtendedAssetCategory;
  onChange: (id: ExtendedAssetCategory, baseType: InvestmentType) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const allOptions = ASSET_CATEGORIES.flatMap((g) => g.options);
  const selected = allOptions.find((o) => o.id === value) || allOptions[0];

  const Icon = selected.icon;

  return (
    <div className='relative'>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all duration-200 outline-none ${
          open
            ? 'border-emerald-500/50 bg-slate-200 dark:bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-2 ring-emerald-500/20'
            : 'border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-300 dark:border-slate-600 hover:bg-slate-200/70 dark:bg-slate-800/60'
        }`}
      >
        <div className='flex items-center gap-3'>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected.bg}`}
          >
            <Icon className={`h-4 w-4 ${selected.color}`} />
          </div>
          <div className='flex flex-col items-start'>
            <span className='font-bold text-slate-900 dark:text-slate-100'>{selected.label}</span>
            <span className='text-[10px] font-medium text-slate-500 dark:text-slate-400'>
              {selected.desc}
            </span>
          </div>
        </div>
        <FiChevronDown
          className={`h-4 w-4 transition-transform duration-200 text-slate-500 dark:text-slate-400 ${open ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''}`}
        />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        width={340}
        minWidth={300}
        maxHeight={420}
        title='Select asset type'
      >
            <div className='p-2'>
              {ASSET_CATEGORIES.map((group, gIdx) => (
                <div key={group.group} className={gIdx > 0 ? 'mt-3' : ''}>
                  <div className='px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
                    {group.group}
                  </div>
                  <div className='flex flex-col gap-1'>
                    {group.options.map((opt) => {
                      const isSelected = value === opt.id;
                      const OptIcon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type='button'
                          onClick={() => {
                            onChange(
                              opt.id as ExtendedAssetCategory,
                              opt.type as InvestmentType,
                            );
                            setOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${
                            isSelected
                              ? 'bg-emerald-500/10 border border-emerald-500/20'
                              : 'border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className='flex items-center gap-3'>
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${opt.bg}`}
                            >
                              <OptIcon className={`h-4 w-4 ${opt.color}`} />
                            </div>
                            <div className='flex flex-col'>
                              <span
                                className={`text-sm font-bold ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}
                              >
                                {opt.label}
                              </span>
                              <span className='text-[10px] font-medium text-slate-500 dark:text-slate-400'>
                                {opt.desc}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <FiCheck className='h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0' />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
      </Popover>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type Props =
  | {
      open: boolean;
      onClose: () => void;
      mode: 'create';
      investment?: undefined;
    }
  | {
      open: boolean;
      onClose: () => void;
      mode: 'edit';
      investment: Investment;
    };

type FormState = {
  uiCategory: ExtendedAssetCategory;
  type: InvestmentType;
  name: string;
  symbol: string;
  platform: string;
  sector: string;
  quantity: string;
  buyPrice: string;
  currentPrice: string;
  previousClose: string;
  annualDividendPerShare: string;
  targetPrice: string;
  stopLossPrice: string;
  // US stock USD fields
  buyPriceUsd: string;
  currentPriceUsd: string;
  usdToInr: string;
  // mutual fund
  units: string;
  nav: string;
  investedAmount: string;
  // bond / fd
  interestRate: string;
  durationMonths: string;
  startDate: string;
  maturityDate: string;
  bankName: string;
  // bond interest tracking
  payoutFrequency: BondPayoutFrequency;
  accountId: string;
  // other
  currentValue: string;
};

function toNumber(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function UpsertInvestmentModal(props: Props) {
  const addInvestment = usePortfolioStore((s) => s.addInvestment);
  const updateInvestment = usePortfolioStore((s) => s.updateInvestment);
  const accounts = usePortfolioStore((s) => s.accounts);

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      uiCategory: 'stock',
      type: 'stock',
      name: '',
      symbol: '',
      platform: 'manual',
      sector: '',
      quantity: '0',
      buyPrice: '0',
      currentPrice: '0',
      previousClose: '0',
      annualDividendPerShare: '0',
      targetPrice: '0',
      stopLossPrice: '0',
      buyPriceUsd: '0',
      currentPriceUsd: '0',
      usdToInr: '84',
      units: '0',
      nav: '0',
      investedAmount: '0',
      interestRate: '0',
      durationMonths: '12',
      startDate: todayISO(),
      maturityDate: todayISO(),
      bankName: '',
      payoutFrequency: 'monthly',
      accountId: '',
      currentValue: '0',
    };

    if (props.mode === 'edit') {
      const inv = props.investment;
      base.type = inv.type;
      base.name = inv.name;
      base.symbol = inv.symbol ?? '';
      base.platform = String(inv.platform ?? 'manual');
      base.sector = inv.type === 'stock' ? (inv.sector ?? '') : '';

      if (inv.type === 'stock') base.uiCategory = 'stock';
      if (inv.type === 'mutual_fund') base.uiCategory = 'mutual_fund';
      if (inv.type === 'fixed_deposit') base.uiCategory = 'fixed_deposit';
      if (inv.type === 'bond') base.uiCategory = 'bond';
      if (inv.type === 'other')
        base.uiCategory = (inv.assetType as ExtendedAssetCategory) || 'other';

      if (inv.type === 'stock') {
        // Check if this was a US stock saved with USD prices
        const isUs = !!(inv as any).usdPrice;
        if (isUs) {
          base.uiCategory = 'international_equity';
          base.buyPriceUsd = String((inv as any).usdPrice ?? inv.buyPrice);
          base.currentPriceUsd = String(
            (inv as any).usdPrice ?? inv.currentPrice,
          );
          base.usdToInr = String((inv as any).usdToInr ?? 84);
        }
        base.quantity = String(inv.quantity);
        base.buyPrice = String(inv.buyPrice);
        base.currentPrice = String(inv.currentPrice);
        base.previousClose = String((inv as any).previousClose ?? inv.currentPrice);
        base.annualDividendPerShare = String(
          (inv as any).annualDividendPerShare ?? 0,
        );
        base.targetPrice = String((inv as any).targetPrice ?? 0);
        base.stopLossPrice = String((inv as any).stopLossPrice ?? 0);
      }
      if (inv.type === 'mutual_fund') {
        base.units = String(inv.units);
        base.nav = String(inv.nav);
        base.investedAmount = String(inv.investedAmount);
      }
      if (inv.type === 'bond') {
        base.investedAmount = String(inv.investedAmount);
        base.interestRate = String(inv.interestRate);
        base.durationMonths = String(inv.durationMonths);
        base.startDate = inv.startDate;
        base.maturityDate = inv.maturityDate;
        base.payoutFrequency = inv.payoutFrequency ?? 'monthly';
        base.accountId = inv.accountId ?? '';
      }
      if (inv.type === 'fixed_deposit') {
        base.bankName = inv.bankName;
        base.investedAmount = String(inv.investedAmount);
        base.interestRate = String(inv.interestRate);
        base.durationMonths = String(inv.durationMonths);
        base.startDate = inv.startDate;
        base.maturityDate = inv.maturityDate;
      }
      if (inv.type === 'other') {
        base.investedAmount = String(inv.investedAmount);
        base.currentValue = String(inv.currentValue);
      }
    }
    return base;
  }, [props.mode, (props as any).investment]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState<string | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);

  const isUsStock = state.uiCategory === 'international_equity';

  // Auto-fetch USD/INR rate when switching to international equity
  useEffect(() => {
    if (isUsStock && state.usdToInr === '84') {
      void refreshUsdRate();
    }
  }, [isUsStock]);

  // Auto-calculate INR prices whenever USD price or rate changes
  useEffect(() => {
    if (!isUsStock) return;
    const rate = toNumber(state.usdToInr);
    if (rate <= 0) return;
    const buyInr = (toNumber(state.buyPriceUsd) * rate).toFixed(2);
    const currentInr = (toNumber(state.currentPriceUsd) * rate).toFixed(2);
    setState((s) => ({ ...s, buyPrice: buyInr, currentPrice: currentInr }));
  }, [state.buyPriceUsd, state.currentPriceUsd, state.usdToInr, isUsStock]);

  useEffect(() => {
    if (props.open) {
      setState(initial);
      setDetectMsg(null);
    }
  }, [props.open, initial]);

  // Auto-fill maturity date for bonds from start date + tenure.
  useEffect(() => {
    if (state.type !== 'bond') return;
    const dur = toNumber(state.durationMonths);
    if (!state.startDate || dur <= 0) return;
    const computed = addMonthsStr(state.startDate, dur);
    setState((s) => (s.maturityDate === computed ? s : { ...s, maturityDate: computed }));
  }, [state.type, state.startDate, state.durationMonths]);

  // Live preview of the bond interest schedule.
  const bondPreview = useMemo(() => {
    if (state.type !== 'bond') return null;
    const per = bondInterestPerPeriod({
      investedAmount: toNumber(state.investedAmount),
      interestRate: toNumber(state.interestRate),
      payoutFrequency: state.payoutFrequency,
    } as never);
    const step = MONTHS_PER_PERIOD[state.payoutFrequency];
    const dur = toNumber(state.durationMonths);
    const count = dur > 0 && step > 0 ? Math.floor(dur / step) : 0;
    const totalInterest = per * count;
    return {
      per,
      count,
      totalInterest,
      maturity: toNumber(state.investedAmount) + totalInterest,
    };
  }, [
    state.type,
    state.investedAmount,
    state.interestRate,
    state.payoutFrequency,
    state.durationMonths,
  ]);

  async function refreshUsdRate() {
    setFetchingRate(true);
    const rate = await fetchUsdToInr();
    setState((s) => ({ ...s, usdToInr: String(rate) }));
    setFetchingRate(false);
  }

  async function autoDetectSector() {
    const sym = state.symbol.trim();
    if (!sym) {
      setDetectMsg('Enter a symbol first.');
      return;
    }
    setDetecting(true);
    setDetectMsg(null);
    try {
      const meta = await fetchStockMetadata({ symbol: sym });
      if (meta.sector && meta.sector !== 'Unknown') {
        setState((s) => ({ ...s, sector: meta.sector }));
        setDetectMsg(`✓ ${meta.sector} · ${meta.marketCapCategory}`);
      } else {
        setDetectMsg('Sector not found — try entering manually.');
      }
    } catch {
      setDetectMsg('Could not fetch sector. Check symbol.');
    } finally {
      setDetecting(false);
    }
  }

  async function onSubmit() {
    setSaving(true);
    try {
      let payload: any = {};

      if (state.type === 'stock') {
        payload = {
          type: 'stock' as const,
          name: state.name.trim(),
          symbol: state.symbol.trim() || undefined,
          platform: state.platform.trim() || undefined,
          quantity: toNumber(state.quantity),
          buyPrice: toNumber(state.buyPrice),
          currentPrice: toNumber(state.currentPrice),
          previousClose: toNumber(state.previousClose) || undefined,
          annualDividendPerShare:
            toNumber(state.annualDividendPerShare) || undefined,
          targetPrice: toNumber(state.targetPrice) || undefined,
          stopLossPrice: toNumber(state.stopLossPrice) || undefined,
          sector: state.sector.trim() || undefined,
          // Save USD fields only for US stocks
          ...(isUsStock && {
            usdPrice: toNumber(state.currentPriceUsd),
            usdToInr: toNumber(state.usdToInr),
          }),
        };
      } else if (state.type === 'mutual_fund') {
        payload = {
          type: 'mutual_fund' as const,
          name: state.name.trim(),
          symbol: state.symbol.trim() || undefined,
          platform: state.platform.trim() || undefined,
          units: toNumber(state.units),
          nav: toNumber(state.nav),
          investedAmount: toNumber(state.investedAmount),
        };
      } else if (state.type === 'bond') {
        payload = {
          type: 'bond' as const,
          name: state.name.trim(),
          platform: state.platform.trim() || 'manual',
          investedAmount: toNumber(state.investedAmount),
          interestRate: toNumber(state.interestRate),
          durationMonths: toNumber(state.durationMonths),
          startDate: state.startDate,
          maturityDate: state.maturityDate,
          payoutFrequency: state.payoutFrequency,
          accountId: state.accountId || undefined,
        };
      } else if (state.type === 'fixed_deposit') {
        payload = {
          type: 'fixed_deposit' as const,
          name: state.name.trim() || state.bankName.trim() || 'Fixed Deposit',
          bankName: state.bankName.trim() || 'Bank',
          platform: 'manual',
          investedAmount: toNumber(state.investedAmount),
          interestRate: toNumber(state.interestRate),
          durationMonths: toNumber(state.durationMonths),
          startDate: state.startDate,
          maturityDate: state.maturityDate,
        };
      } else if (state.type === 'other') {
        payload = {
          type: 'other' as const,
          assetType: state.uiCategory,
          name: state.name.trim() || state.uiCategory.toUpperCase(),
          platform: state.platform.trim() || 'manual',
          investedAmount: toNumber(state.investedAmount),
          currentValue: toNumber(state.currentValue),
        };
      }

      props.mode === 'create'
        ? await addInvestment(payload)
        : await updateInvestment(props.investment.id, payload);
      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500';
  const labelCls =
    'text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 block ml-1';

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === 'create' ? 'Add New Asset' : 'Edit Asset Details'}
      subtitle='Quantity, price and dates you enter here drive portfolio value, P&L, XIRR, allocation and Net Worth automatically.'
    >
      {/* Single scroll context — the Modal body already scrolls and is sized to
          the visual viewport, so no max-height / nested overflow here. */}
      <div className='flex flex-col'>
        <div className='mb-4 shrink-0 md:mb-6'>
          <label className={labelCls}>Asset Category</label>
          <RichAssetDropdown
            value={state.uiCategory}
            onChange={(categoryId, baseType) => {
              setState((s) => ({
                ...s,
                uiCategory: categoryId,
                type: baseType,
              }));
            }}
          />
        </div>

        <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 p-3 space-y-4 md:p-4 md:space-y-5'>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4'>
            <div>
              <label className={labelCls}>Asset Name</label>
              <input
                className={inputCls}
                value={state.name}
                onChange={(e) =>
                  setState((s) => ({ ...s, name: e.target.value }))
                }
                placeholder={
                  state.type === 'fixed_deposit'
                    ? 'FD label (optional)'
                    : `e.g. My ${state.uiCategory.replace('_', ' ')} holding`
                }
              />
            </div>
            <div>
              <label className={labelCls}>Platform / Broker</label>
              <input
                className={inputCls}
                value={state.platform}
                onChange={(e) =>
                  setState((s) => ({ ...s, platform: e.target.value }))
                }
                placeholder='zerodha / manual'
              />
            </div>
          </div>

          {(state.type === 'stock' || state.type === 'mutual_fund') && (
            <div>
              <label className={labelCls}>Symbol / Ticker</label>
              <input
                className={inputCls}
                value={state.symbol}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    symbol: e.target.value.toUpperCase(),
                  }))
                }
                placeholder={
                  isUsStock ? 'e.g. AAPL, TSLA, MSFT' : 'e.g. RELIANCE, TCS'
                }
              />
            </div>
          )}

          {state.type === 'stock' && !isUsStock && (
            <div>
              <div className='mb-1.5 flex items-center justify-between ml-1'>
                <label className='text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0'>
                  Sector
                </label>
                <button
                  type='button'
                  onClick={autoDetectSector}
                  disabled={detecting || !state.symbol.trim()}
                  className='flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50'
                >
                  <FiZap className='h-3 w-3' />
                  {detecting ? 'Detecting…' : 'Auto-Detect'}
                </button>
              </div>
              <input
                className={inputCls}
                value={state.sector}
                onChange={(e) =>
                  setState((s) => ({ ...s, sector: e.target.value }))
                }
                placeholder='e.g. Defence, Energy, IT'
              />
              {detectMsg && (
                <p
                  className={`mt-1.5 text-xs font-semibold ${detectMsg.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                >
                  {detectMsg}
                </p>
              )}
            </div>
          )}

          {/* ── US Stock Fields ── */}
          {isUsStock && (
            <>
              {/* USD/INR Rate row */}
              <div className='rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <FiGlobe className='h-4 w-4 text-blue-500 dark:text-blue-400' />
                    <span className='text-xs font-bold text-blue-700 uppercase tracking-widest dark:text-blue-400'>
                      USD → INR Conversion
                    </span>
                  </div>
                  <button
                    type='button'
                    onClick={() => void refreshUsdRate()}
                    disabled={fetchingRate}
                    className='flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-500/20 dark:text-blue-400 transition-colors disabled:opacity-50'
                  >
                    <FiRefreshCw
                      className={`h-3 w-3 ${fetchingRate ? 'animate-spin' : ''}`}
                    />
                    {fetchingRate ? 'Fetching…' : 'Refresh Rate'}
                  </button>
                </div>

                <div className='grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-3'>
                  <div>
                    <label className={labelCls}>Avg Buy Price (USD)</label>

                    <NumericInput
                      className={inputCls}
                      value={state.buyPriceUsd}
                      onChange={(v) =>
                        setState((s) => ({ ...s, buyPriceUsd: v }))
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Curr. Stock Price (USD)</label>

                    <NumericInput
                      className={inputCls}
                      value={state.currentPriceUsd}
                      onChange={(v) =>
                        setState((s) => ({ ...s, currentPriceUsd: v }))
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls}>1 USD = INR</label>
                    <NumericInput
                      className={inputCls}
                      value={state.usdToInr}
                      onChange={(v) => setState((s) => ({ ...s, usdToInr: v }))}
                    />
                  </div>
                </div>

                {/* Converted INR preview */}
                {toNumber(state.usdToInr) > 0 && (
                  <div className='grid grid-cols-2 gap-2 pt-1 md:gap-3'>
                    <div className='rounded-lg bg-slate-200/70 dark:bg-slate-800/60 px-3 py-2'>
                      <p className='text-[10px] text-slate-500 dark:text-slate-400 mb-0.5'>
                        Buy Price (INR)
                      </p>
                      <p className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                        ₹
                        {(
                          toNumber(state.buyPriceUsd) * toNumber(state.usdToInr)
                        ).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className='rounded-lg bg-slate-200/70 dark:bg-slate-800/60 px-3 py-2'>
                      <p className='text-[10px] text-slate-500 dark:text-slate-400 mb-0.5'>
                        Current Price (INR)
                      </p>
                      <p className='text-sm font-bold text-emerald-600 dark:text-emerald-400'>
                        ₹
                        {(
                          toNumber(state.currentPriceUsd) *
                          toNumber(state.usdToInr)
                        ).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className={labelCls}>Quantity</label>
                <NumericInput
                  className={inputCls}
                  value={state.quantity}
                  onChange={(v) => setState((s) => ({ ...s, quantity: v }))}
                />
              </div>
            </>
          )}

          {/* ── Indian Stock Fields ── */}
          {state.type === 'stock' && !isUsStock && (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
              <div>
                <label className={labelCls}>Quantity</label>
                <NumericInput
                  className={inputCls}
                  value={state.quantity}
                  onChange={(v) => setState((s) => ({ ...s, quantity: v }))}
                />
              </div>
              <div>
                <label className={labelCls}>Buy Price (₹)</label>
                <NumericInput
                  className={inputCls}
                  value={state.buyPrice}
                  onChange={(v) => setState((s) => ({ ...s, buyPrice: v }))}
                />
              </div>
              <div>
                <label className={labelCls}>Current Price (₹)</label>
                <NumericInput
                  className={inputCls}
                  value={state.currentPrice}
                  onChange={(v) => setState((s) => ({ ...s, currentPrice: v }))}
                />
              </div>
              <div>
                <label className={labelCls}>Previous Close (₹)</label>
                <NumericInput
                  className={inputCls}
                  value={state.previousClose}
                  onChange={(v) => setState((s) => ({ ...s, previousClose: v }))}
                />
              </div>
              <div>
                <label className={labelCls}>Annual Dividend / Share</label>
                <NumericInput
                  className={inputCls}
                  value={state.annualDividendPerShare}
                  onChange={(v) =>
                    setState((s) => ({ ...s, annualDividendPerShare: v }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Target Price (optional)</label>
                <NumericInput
                  className={inputCls}
                  value={state.targetPrice}
                  onChange={(v) => setState((s) => ({ ...s, targetPrice: v }))}
                />
              </div>
              <div>
                <label className={labelCls}>Stop-Loss Price (optional)</label>
                <NumericInput
                  className={inputCls}
                  value={state.stopLossPrice}
                  onChange={(v) => setState((s) => ({ ...s, stopLossPrice: v }))}
                />
              </div>
            </div>
          )}

          {state.type === 'mutual_fund' && (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div>
                <label className={labelCls}>Units</label>
                <NumericInput
                  className={inputCls}
                  value={state.units}
                  onChange={(v) => setState((s) => ({ ...s, units: v }))}
                />
              </div>
              <div>
                <label className={labelCls}>Avg. NAV</label>
                <NumericInput
                  className={inputCls}
                  value={state.nav}
                  onChange={(v) => setState((s) => ({ ...s, nav: v }))}
                />
              </div>
              <div>
                <label className={labelCls}>Total Invested</label>
                <NumericInput
                  className={inputCls}
                  value={state.investedAmount}
                  onChange={(v) =>
                    setState((s) => ({ ...s, investedAmount: v }))
                  }
                />
              </div>
            </div>
          )}

          {(state.type === 'bond' || state.type === 'fixed_deposit') && (
            <>
              {state.type === 'fixed_deposit' && (
                <div>
                  <label className={labelCls}>Bank Name</label>
                  <input
                    className={inputCls}
                    value={state.bankName}
                    onChange={(e) =>
                      setState((s) => ({ ...s, bankName: e.target.value }))
                    }
                    placeholder='e.g. HDFC Bank'
                  />
                </div>
              )}
              <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                <div>
                  <label className={labelCls}>Principal Amt</label>
                  <NumericInput
                    className={inputCls}
                    value={state.investedAmount}
                    onChange={(v) =>
                      setState((s) => ({ ...s, investedAmount: v }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Interest (% p.a.)</label>
                  <NumericInput
                    className={inputCls}
                    value={state.interestRate}
                    onChange={(v) =>
                      setState((s) => ({ ...s, interestRate: v }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Tenure (mo)</label>
                  <NumericInput
                    allowDecimal={false}
                    className={inputCls}
                    value={state.durationMonths}
                    onChange={(v) =>
                      setState((s) => ({ ...s, durationMonths: v }))
                    }
                  />
                </div>
              </div>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div>
                  <label className={labelCls}>Start Date</label>
                  <CalendarPicker
                    value={state.startDate}
                    onChange={(v) => setState((s) => ({ ...s, startDate: v }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Maturity Date</label>
                  <CalendarPicker
                    value={state.maturityDate}
                    onChange={(v) =>
                      setState((s) => ({ ...s, maturityDate: v }))
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Bond interest auto-tracking ── */}
          {state.type === 'bond' && (
            <div className='rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-4'>
              <div className='flex items-center gap-2'>
                <FiBriefcase className='h-4 w-4 text-violet-500 dark:text-violet-400' />
                <span className='text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-400'>
                  Interest Auto-Tracking
                </span>
              </div>

              <div>
                <label className={labelCls}>Payout Frequency</label>
                <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
                  {PAYOUT_FREQUENCY_OPTIONS.map((f) => {
                    const active = state.payoutFrequency === f;
                    return (
                      <button
                        key={f}
                        type='button'
                        onClick={() =>
                          setState((s) => ({ ...s, payoutFrequency: f }))
                        }
                        className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-all ${
                          active
                            ? 'border-violet-500/50 bg-violet-500/15 text-violet-500 dark:text-violet-300'
                            : 'border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 hover:border-violet-400/40'
                        }`}
                      >
                        {PAYOUT_FREQUENCY_LABELS[f]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>Credit Interest To (Account)</label>
                <select
                  className={inputCls}
                  value={state.accountId}
                  onChange={(e) =>
                    setState((s) => ({ ...s, accountId: e.target.value }))
                  }
                >
                  <option value=''>— No linked account —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type === 'credit' ? 'Credit' : a.type === 'cash' ? 'Cash' : 'Bank'})
                    </option>
                  ))}
                </select>
              </div>

              {bondPreview && bondPreview.count > 0 && (
                <div className='grid grid-cols-2 gap-3 rounded-lg bg-slate-200/70 dark:bg-slate-800/60 p-3'>
                  <div>
                    <p className='text-[10px] text-slate-500 dark:text-slate-400 mb-0.5'>
                      Interest / {PAYOUT_FREQUENCY_LABELS[state.payoutFrequency].replace('-Yearly', 'Yr').replace('Half-Yr', 'Half-Yr')}
                    </p>
                    <p className='text-sm font-bold text-violet-500 dark:text-violet-300'>
                      ₹{bondPreview.per.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className='text-[10px] text-slate-500 dark:text-slate-400 mb-0.5'>
                      Total Payouts
                    </p>
                    <p className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                      {bondPreview.count}
                    </p>
                  </div>
                  <div>
                    <p className='text-[10px] text-slate-500 dark:text-slate-400 mb-0.5'>
                      Total Interest
                    </p>
                    <p className='text-sm font-bold text-emerald-500 dark:text-emerald-400'>
                      ₹{bondPreview.totalInterest.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className='text-[10px] text-slate-500 dark:text-slate-400 mb-0.5'>
                      Maturity Amount
                    </p>
                    <p className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                      ₹{bondPreview.maturity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}
              <p className='text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-snug'>
                Each due coupon is posted automatically to Cashflow as income and
                credited to the linked account. The principal is recorded on the
                maturity date.
              </p>
            </div>
          )}

          {state.type === 'other' && (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div>
                <label className={labelCls}>Total Invested</label>
                <NumericInput
                  className={inputCls}
                  value={state.investedAmount}
                  onChange={(v) =>
                    setState((s) => ({ ...s, investedAmount: v }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Current Value</label>
                <NumericInput
                  className={inputCls}
                  value={state.currentValue}
                  onChange={(v) => setState((s) => ({ ...s, currentValue: v }))}
                />
              </div>
            </div>
          )}
        </div>

        <div className='mt-6 shrink-0 flex items-center justify-end gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-5'>
          <button
            type='button'
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-200 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-60'
            onClick={props.onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type='button'
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 disabled:opacity-60 disabled:hover:translate-y-0'
            onClick={() => void onSubmit()}
            disabled={saving}
          >
            {saving ? (
              <>
                <FiSave className='h-4 w-4 animate-pulse' />
                <span>Saving…</span>
              </>
            ) : props.mode === 'create' ? (
              <>
                <FiPlus className='h-4 w-4' />
                <span>Add {state.uiCategory.replace('_', ' ')}</span>
              </>
            ) : (
              <>
                <FiSave className='h-4 w-4' />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
