// src/components/investments/UpsertInvestmentModal.tsx

import {
  FiBox,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
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
import type { Investment, InvestmentType } from '../../types/investmentTypes';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Modal } from '../ui/Modal';
import { NumericInput } from '../ui/NumericInput';
import { createPortal } from 'react-dom';
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const allOptions = ASSET_CATEGORIES.flatMap((g) => g.options);
  const selected = allOptions.find((o) => o.id === value) || allOptions[0];

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelW = 340;
    const panelH = panelRef.current ? panelRef.current.offsetHeight : 400;
    const rawLeft = r.left + window.scrollX;
    const clampedLeft = Math.min(
      rawLeft,
      window.innerWidth + window.scrollX - panelW - 16,
    );
    const spaceBelow = window.innerHeight - r.bottom;
    let top = r.bottom + 8 + window.scrollY;
    if (spaceBelow < panelH && r.top > spaceBelow) {
      top = r.top - panelH - 8 + window.scrollY;
    }
    setPos({ top, left: Math.max(8, clampedLeft), width: panelW });
  }, []);

  useEffect(() => {
    if (open) updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', onMouse);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, updatePos]);

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
            <span className='text-[10px] font-medium text-slate-900 dark:text-slate-500'>
              {selected.desc}
            </span>
          </div>
        </div>
        <FiChevronDown
          className={`h-4 w-4 transition-transform duration-200 text-slate-500 dark:text-slate-400 ${open ? 'rotate-180 text-emerald-400' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 99999,
            }}
            className='overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl backdrop-blur-xl'
          >
            <div className='max-h-[400px] overflow-y-auto custom-scrollbar p-2'>
              {ASSET_CATEGORIES.map((group, gIdx) => (
                <div key={group.group} className={gIdx > 0 ? 'mt-3' : ''}>
                  <div className='px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-slate-500'>
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
                              : 'border border-transparent hover:bg-slate-200/80 dark:bg-slate-800/80 hover:border-slate-300 dark:border-slate-700'
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
                                className={`text-sm font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-900 dark:text-slate-800 dark:text-slate-200'}`}
                              >
                                {opt.label}
                              </span>
                              <span className='text-[10px] font-medium text-slate-900 dark:text-slate-500'>
                                {opt.desc}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <FiCheck className='h-4 w-4 text-emerald-400 shrink-0' />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ── Smart Calendar Picker ─────────────────────────────────────────────────
function CalendarPicker({
  value,
  onChange,
  placeholder = 'Pick a date',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = value ? parse(value, 'yyyy-MM-dd', new Date()) : new Date();
    return isValid(d) ? d : new Date();
  });

  const selectedDate = useMemo(() => {
    if (!value) return null;
    const d = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : null;
  }, [value]);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelW = 280;
    const panelH = panelRef.current ? panelRef.current.offsetHeight : 340;
    const rawLeft = r.left + window.scrollX;
    const clampedLeft = Math.min(
      rawLeft,
      window.innerWidth + window.scrollX - panelW - 16,
    );
    const spaceBelow = window.innerHeight - r.bottom;
    let top = r.bottom + 8 + window.scrollY;
    if (spaceBelow < panelH && r.top > spaceBelow) {
      top = r.top - panelH - 8 + window.scrollY;
    }
    setPos({ top, left: Math.max(8, clampedLeft) });
  }, []);

  useEffect(() => {
    if (open) {
      updatePos();
      setTimeout(updatePos, 10);
    }
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', onMouse);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, updatePos]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const selectDay = (d: Date) => {
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${open ? 'border-emerald-500/50 bg-slate-200 dark:bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.1)] text-emerald-400' : 'border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-200/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100'}`}
      >
        <FiCalendar
          className={`h-4 w-4 shrink-0 transition-colors ${open ? 'text-emerald-400' : 'text-slate-900 dark:text-slate-500'}`}
        />
        <span
          className={`flex-1 text-left ${!selectedDate ? 'text-slate-900 dark:text-slate-500' : ''}`}
        >
          {selectedDate ? format(selectedDate, 'dd MMM yyyy') : placeholder}
        </span>
        <FiChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 text-slate-900 dark:text-slate-500 ${open ? 'rotate-180 text-emerald-400' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              zIndex: 99999,
              width: 280,
            }}
            className='rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl backdrop-blur-xl overflow-hidden'
          >
            <div className='flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800'>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, -1))}
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-900 dark:text-slate-100 transition-colors'
              >
                <FiChevronLeft className='h-4 w-4' />
              </button>
              <span className='text-sm font-bold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
                {format(viewDate, 'MMMM yyyy')}
              </span>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, 1))}
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-900 dark:text-slate-100 transition-colors'
              >
                <FiChevronRight className='h-4 w-4' />
              </button>
            </div>
            <div className='grid grid-cols-7 px-3 pt-3 pb-1'>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div
                  key={d}
                  className='text-center text-[10px] font-bold text-slate-900 dark:text-slate-500 pb-1'
                >
                  {d}
                </div>
              ))}
            </div>
            <div className='grid grid-cols-7 px-3 pb-3 gap-y-0.5'>
              {days.map((day) => {
                const isSelected = selectedDate
                  ? isSameDay(day, selectedDate)
                  : false;
                const isCurMonth = isSameMonth(day, viewDate);
                const isTodayDay = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type='button'
                    onClick={() => selectDay(day)}
                    className={`flex h-8 w-8 mx-auto items-center justify-center rounded-lg text-xs font-medium transition-all ${isSelected ? 'bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/30' : isTodayDay ? 'border border-emerald-500/40 text-emerald-400' : isCurMonth ? 'text-slate-600 dark:text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-600 hover:bg-slate-100 dark:bg-slate-800/50'}`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
            <div className='px-3 pb-3 flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2'>
              <button
                type='button'
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className='text-xs font-bold text-slate-900 dark:text-slate-500 hover:text-slate-600 dark:text-slate-700 dark:hover:text-slate-600 dark:text-slate-700 dark:text-slate-300 transition-colors px-2 py-1'
              >
                Clear
              </button>
              <button
                type='button'
                onClick={() => selectDay(new Date())}
                className='text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1'
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
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
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-500 dark:text-slate-600';
  const labelCls =
    'text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 block ml-1';

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === 'create' ? 'Add New Asset' : 'Edit Asset Details'}
    >
      <div className='flex flex-col max-h-[60vh] md:max-h-none'>
        <div className='mb-6 shrink-0'>
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

        <div className='overflow-y-auto md:overflow-visible custom-scrollbar pr-2 -mr-2 md:pr-0 md:mr-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 p-4 space-y-5'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
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
                  className='flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50'
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
                  className={`mt-1.5 text-xs font-semibold ${detectMsg.startsWith('✓') ? 'text-emerald-400' : 'text-rose-400'}`}
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
                    <FiGlobe className='h-4 w-4 text-blue-400' />
                    <span className='text-xs font-bold text-blue-400 uppercase tracking-widest'>
                      USD → INR Conversion
                    </span>
                  </div>
                  <button
                    type='button'
                    onClick={() => void refreshUsdRate()}
                    disabled={fetchingRate}
                    className='flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50'
                  >
                    <FiRefreshCw
                      className={`h-3 w-3 ${fetchingRate ? 'animate-spin' : ''}`}
                    />
                    {fetchingRate ? 'Fetching…' : 'Refresh Rate'}
                  </button>
                </div>

                <div className='grid grid-cols-3 gap-3'>
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
                  <div className='grid grid-cols-2 gap-3 pt-1'>
                    <div className='rounded-lg bg-slate-200/70 dark:bg-slate-800/60 px-3 py-2'>
                      <p className='text-[10px] text-slate-900 dark:text-slate-500 mb-0.5'>
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
                      <p className='text-[10px] text-slate-900 dark:text-slate-500 mb-0.5'>
                        Current Price (INR)
                      </p>
                      <p className='text-sm font-bold text-emerald-400'>
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
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
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
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:bg-slate-800 hover:text-slate-900 dark:text-slate-800 dark:hover:text-slate-900 dark:text-slate-800 dark:text-slate-200'
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
