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
import { createPortal } from 'react-dom';
import { fetchStockMetadata } from '../../services/stockMetadataService';
import { todayISO } from '../../utils/dateUtils';
import { usePortfolioStore } from '../../store/portfolioStore';

// ── Enhanced Type Definitions ──────────────────────────────────────────────
// We are mapping the rich UI options back to your backend Types
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
        type: 'other',
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
        color: 'text-slate-400',
        bg: 'bg-slate-400/10',
        desc: 'Startups, P2P, Cash',
      },
    ],
  },
];

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
    const panelW = 340; // Wider for rich content
    const rawLeft = r.left + window.scrollX;
    const clampedLeft = Math.min(
      rawLeft,
      window.innerWidth + window.scrollX - panelW - 16,
    );
    setPos({
      top: r.bottom + 8 + window.scrollY,
      left: Math.max(8, clampedLeft),
      width: panelW,
    });
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
            ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-2 ring-emerald-500/20'
            : 'border-slate-700/80 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/60'
        }`}
      >
        <div className='flex items-center gap-3'>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected.bg}`}
          >
            <Icon className={`h-4 w-4 ${selected.color}`} />
          </div>
          <div className='flex flex-col items-start'>
            <span className='font-bold text-slate-100'>{selected.label}</span>
            <span className='text-[10px] font-medium text-slate-500'>
              {selected.desc}
            </span>
          </div>
        </div>
        <FiChevronDown
          className={`h-4 w-4 transition-transform duration-200 text-slate-400 ${open ? 'rotate-180 text-emerald-400' : ''}`}
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
              zIndex: 9999,
              animation: 'none',
            }}
            className='overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl backdrop-blur-xl'
          >
            <div className='max-h-[400px] overflow-y-auto custom-scrollbar p-2'>
              {ASSET_CATEGORIES.map((group, gIdx) => (
                <div key={group.group} className={gIdx > 0 ? 'mt-3' : ''}>
                  <div className='px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500'>
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
                              : 'border border-transparent hover:bg-slate-800/80 hover:border-slate-700'
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
                                className={`text-sm font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}
                              >
                                {opt.label}
                              </span>
                              <span className='text-[10px] font-medium text-slate-500'>
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

// ── Calendar Picker ────────────────────────────────────────────────────────
// [Keep existing CalendarPicker exactly as it is in your code]
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
    const rawLeft = r.left + window.scrollX;
    const clampedLeft = Math.min(
      rawLeft,
      window.innerWidth + window.scrollX - panelW - 16,
    );
    setPos({
      top: r.bottom + 8 + window.scrollY,
      left: Math.max(8, clampedLeft),
    });
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
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${open ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.1)] text-emerald-400' : 'border-slate-700/80 bg-slate-900/50 hover:bg-slate-800/60 text-slate-100'}`}
      >
        <FiCalendar
          className={`h-4 w-4 shrink-0 transition-colors ${open ? 'text-emerald-400' : 'text-slate-500'}`}
        />
        <span
          className={`flex-1 text-left ${!selectedDate ? 'text-slate-500' : ''}`}
        >
          {selectedDate ? format(selectedDate, 'dd MMM yyyy') : placeholder}
        </span>
        <FiChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 text-slate-500 ${open ? 'rotate-180 text-emerald-400' : ''}`}
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
              zIndex: 9999,
              width: 280,
              animation: 'none',
            }}
            className='rounded-xl border border-slate-700 bg-slate-900 shadow-2xl backdrop-blur-xl overflow-hidden'
          >
            <div className='flex items-center justify-between px-4 py-3 border-b border-slate-800'>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, -1))}
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors'
              >
                <FiChevronLeft className='h-4 w-4' />
              </button>
              <span className='text-sm font-bold text-slate-200'>
                {format(viewDate, 'MMMM yyyy')}
              </span>
              <button
                type='button'
                onClick={() => setViewDate((d) => addMonths(d, 1))}
                className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors'
              >
                <FiChevronRight className='h-4 w-4' />
              </button>
            </div>
            <div className='grid grid-cols-7 px-3 pt-3 pb-1'>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div
                  key={d}
                  className='text-center text-[10px] font-bold text-slate-500 pb-1'
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
                    className={`flex h-8 w-8 mx-auto items-center justify-center rounded-lg text-xs font-medium transition-all ${isSelected ? 'bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/30' : isTodayDay ? 'border border-emerald-500/40 text-emerald-400' : isCurMonth ? 'text-slate-300 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-600 hover:bg-slate-800/50'}`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
            <div className='px-3 pb-3 flex justify-between border-t border-slate-800 pt-2'>
              <button
                type='button'
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className='text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors px-2 py-1'
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

// ─────────────────────────────────────────────────────────────────────────

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
  uiCategory: ExtendedAssetCategory; // The UI drop down selection
  type: InvestmentType; // The actual backend type
  name: string;
  symbol: string;
  platform: string;
  sector: string;
  quantity: string;
  buyPrice: string;
  currentPrice: string;
  units: string;
  nav: string;
  investedAmount: string;
  interestRate: string;
  durationMonths: string;
  startDate: string;
  maturityDate: string;
  bankName: string;
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

      // Reverse map backend type to UI Category
      if (inv.type === 'stock') base.uiCategory = 'stock';
      if (inv.type === 'mutual_fund') base.uiCategory = 'mutual_fund';
      if (inv.type === 'fixed_deposit') base.uiCategory = 'fixed_deposit';
      if (inv.type === 'bond') base.uiCategory = 'bond';
      if (inv.type === 'other') {
        // Try to infer UI category from assetType if it exists
        base.uiCategory = (inv.assetType as ExtendedAssetCategory) || 'other';
      }

      if (inv.type === 'stock') {
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

  useEffect(() => {
    if (props.open) {
      setState(initial);
      setDetectMsg(null);
    }
  }, [props.open, initial]);

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
      if (state.type === 'stock') {
        const p = {
          type: 'stock' as const,
          name: state.name.trim(),
          symbol: state.symbol.trim() || undefined,
          platform: state.platform.trim() || undefined,
          quantity: toNumber(state.quantity),
          buyPrice: toNumber(state.buyPrice),
          currentPrice: toNumber(state.currentPrice),
          sector: state.sector.trim() || undefined,
        };
        props.mode === 'create'
          ? await addInvestment(p as any)
          : await updateInvestment(props.investment.id, p as any);
      }
      if (state.type === 'mutual_fund') {
        const p = {
          type: 'mutual_fund' as const,
          name: state.name.trim(),
          symbol: state.symbol.trim() || undefined,
          platform: state.platform.trim() || undefined,
          units: toNumber(state.units),
          nav: toNumber(state.nav),
          investedAmount: toNumber(state.investedAmount),
        };
        props.mode === 'create'
          ? await addInvestment(p as any)
          : await updateInvestment(props.investment.id, p as any);
      }
      if (state.type === 'bond') {
        const p = {
          type: 'bond' as const,
          name: state.name.trim(),
          platform: state.platform.trim() || 'manual',
          investedAmount: toNumber(state.investedAmount),
          interestRate: toNumber(state.interestRate),
          durationMonths: toNumber(state.durationMonths),
          startDate: state.startDate,
          maturityDate: state.maturityDate,
        };
        props.mode === 'create'
          ? await addInvestment(p as any)
          : await updateInvestment(props.investment.id, p as any);
      }
      if (state.type === 'fixed_deposit') {
        const p = {
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
        props.mode === 'create'
          ? await addInvestment(p as any)
          : await updateInvestment(props.investment.id, p as any);
      }
      if (state.type === 'other') {
        const p = {
          type: 'other' as const,
          assetType: state.uiCategory, // Save the specific sub-type like 'gold', 'ppf'
          name: state.name.trim() || state.uiCategory.toUpperCase(),
          platform: state.platform.trim() || 'manual',
          investedAmount: toNumber(state.investedAmount),
          currentValue: toNumber(state.currentValue),
        };
        props.mode === 'create'
          ? await addInvestment(p as any)
          : await updateInvestment(props.investment.id, p as any);
      }
      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-600';
  const labelCls =
    'text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block ml-1';

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === 'create' ? 'Add New Asset' : 'Edit Asset Details'}
    >
      <div className='grid grid-cols-1 gap-6'>
        {/* Rich Investment Type Dropdown */}
        {props.mode === 'create' && (
          <div>
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
        )}

        {/* Dynamic Fields Container */}
        <div className='rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-5'>
          {/* Name + Platform */}
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
                    : `e.g. My ${state.uiCategory} holding`
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

          {/* Symbol */}
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
                placeholder='e.g. RELIANCE, TCS'
              />
            </div>
          )}

          {/* Sector + Auto-detect */}
          {state.type === 'stock' && (
            <div>
              <div className='mb-1.5 flex items-center justify-between ml-1'>
                <label className='text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0'>
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

          {/* Stock Quantities */}
          {state.type === 'stock' && (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div>
                <label className={labelCls}>Quantity</label>
                <input
                  inputMode='decimal'
                  className={inputCls}
                  value={state.quantity}
                  onChange={(e) =>
                    setState((s) => ({ ...s, quantity: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Buy Price</label>
                <input
                  inputMode='decimal'
                  className={inputCls}
                  value={state.buyPrice}
                  onChange={(e) =>
                    setState((s) => ({ ...s, buyPrice: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Current Price</label>
                <input
                  inputMode='decimal'
                  className={inputCls}
                  value={state.currentPrice}
                  onChange={(e) =>
                    setState((s) => ({ ...s, currentPrice: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          {/* Mutual Fund */}
          {state.type === 'mutual_fund' && (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div>
                <label className={labelCls}>Units</label>
                <input
                  inputMode='decimal'
                  className={inputCls}
                  value={state.units}
                  onChange={(e) =>
                    setState((s) => ({ ...s, units: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Avg. NAV</label>
                <input
                  inputMode='decimal'
                  className={inputCls}
                  value={state.nav}
                  onChange={(e) =>
                    setState((s) => ({ ...s, nav: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Total Invested</label>
                <input
                  inputMode='decimal'
                  className={inputCls}
                  value={state.investedAmount}
                  onChange={(e) =>
                    setState((s) => ({ ...s, investedAmount: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          {/* Bond / FD */}
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
                  <input
                    inputMode='decimal'
                    className={inputCls}
                    value={state.investedAmount}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        investedAmount: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Interest (% p.a.)</label>
                  <input
                    inputMode='decimal'
                    className={inputCls}
                    value={state.interestRate}
                    onChange={(e) =>
                      setState((s) => ({ ...s, interestRate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Tenure (mo)</label>
                  <input
                    inputMode='numeric'
                    className={inputCls}
                    value={state.durationMonths}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        durationMonths: e.target.value,
                      }))
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

          {/* Other / Alternatives (Gold, Real Estate, PPF, NPS) */}
          {state.type === 'other' && (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div>
                <label className={labelCls}>Total Invested</label>
                <input
                  inputMode='decimal'
                  className={inputCls}
                  value={state.investedAmount}
                  onChange={(e) =>
                    setState((s) => ({ ...s, investedAmount: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Current Value</label>
                <input
                  inputMode='decimal'
                  className={inputCls}
                  value={state.currentValue}
                  onChange={(e) =>
                    setState((s) => ({ ...s, currentValue: e.target.value }))
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='mt-2 flex items-center justify-end gap-3 border-t border-slate-800/60 pt-5'>
          <button
            type='button'
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200'
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
