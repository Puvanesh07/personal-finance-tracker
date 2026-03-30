// src/pages/Agriculture/ProduceSalesTab.tsx

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FiCheck, FiChevronDown, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { formatINR, formatNumber } from '../../utils/format';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Modal } from '../../components/ui/Modal';
import { NumericInput } from '../../components/ui/NumericInput';
import type { ProduceSaleLot } from '../../types/investmentTypes';
import { createPortal } from 'react-dom';
import { syncCashflow } from './AgriculturePage'; // Importing the master sync func
import toast from 'react-hot-toast';
import { useAgriStore } from '../../store/agricultureStore';
import { usePortfolioStore } from '../../store/portfolioStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_CATEGORIES = [
  'Vegetable',
  'Fruit',
  'Grain',
  'Spice',
  'Herb',
  'Other',
];

const PRESET_UNITS = [
  { value: 'kg', label: 'kg — Kilogram' },
  { value: 'box', label: 'box — Box / Crate' },
  { value: 'piece', label: 'piece — Per Piece' },
  { value: 'bunch', label: 'bunch — Bunch / Bundle' },
  { value: 'litre', label: 'litre — Litre' },
  { value: 'custom', label: 'Custom unit…' },
];

const PIE_COLORS = [
  '#22c55e',
  '#f59e0b',
  '#3b82f6',
  '#a78bfa',
  '#f43f5e',
  '#14b8a6',
  '#fb923c',
  '#64748b',
];

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';
const labelCls =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1';

// ─── Reusable Dropdown ────────────────────────────────────────────────────────

type DropOpt = { value: string; label: string; emoji?: string };

function ProduceDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropOpt[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.value === value);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelW = Math.max(r.width, 180);
    const rawLeft = r.left + window.scrollX;
    const clamped = Math.min(
      rawLeft,
      window.innerWidth + window.scrollX - panelW - 8,
    );
    const spaceBelow = window.innerHeight - r.bottom;
    const maxPanelH = Math.min(options.length * 44 + 16, 260);
    const top =
      spaceBelow > maxPanelH
        ? r.bottom + 6 + window.scrollY
        : r.top - maxPanelH - 6 + window.scrollY;
    setPos({ top, left: Math.max(8, clamped), width: panelW });
  }, [options.length]);

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
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
          open
            ? 'border-emerald-500/50 bg-slate-800 shadow-[0_0_12px_rgba(16,185,129,0.12)] text-slate-100'
            : 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600'
        }`}
      >
        <span className='truncate'>
          {selected ? (
            `${selected.emoji ? selected.emoji + ' ' : ''}${selected.label}`
          ) : (
            <span className='text-slate-500'>{placeholder}</span>
          )}
        </span>
        <FiChevronDown
          className={`ml-2 h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200 ${
            open ? 'rotate-180 text-emerald-400' : ''
          }`}
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
            }}
            className='overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl backdrop-blur-xl'
          >
            <div className='flex max-h-64 flex-col overflow-y-auto p-1.5'>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all text-left ${
                    value === opt.value
                      ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <span>
                    {opt.emoji ? opt.emoji + ' ' : ''}
                    {opt.label}
                  </span>
                  {value === opt.value && (
                    <FiCheck className='h-4 w-4 shrink-0 text-emerald-400' />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color = '#22c55e',
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      className='rounded-xl p-4 flex flex-col gap-1'
      style={{
        background: '#0f172a',
        border: `1px solid ${color}22`,
        borderTop: `2px solid ${color}`,
      }}
    >
      <div className='flex items-center gap-2'>
        <span className='text-lg'>{icon}</span>
        <span className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
          {label}
        </span>
      </div>
      <div className='text-xl font-bold text-slate-100 font-mono'>{value}</div>
      {sub && <div className='text-[11px] text-slate-500'>{sub}</div>}
    </div>
  );
}

// ─── Delete Confirm Button ────────────────────────────────────────────────────

function DeleteConfirmBtn({ onDelete }: { onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm)
    return (
      <div className='flex gap-1'>
        <button
          onClick={onDelete}
          className='px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-bold'
        >
          Yes
        </button>
        <button
          onClick={() => setConfirm(false)}
          className='px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold'
        >
          No
        </button>
      </div>
    );
  return (
    <button
      onClick={() => setConfirm(true)}
      className='p-1.5 rounded-lg bg-slate-800 text-red-400 hover:bg-red-500/10 transition-colors'
      title='Delete'
    >
      <FiTrash2 className='w-3.5 h-3.5' />
    </button>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function displayUnit(lot: ProduceSaleLot): string {
  return lot.unit === 'custom' ? lot.customUnit || 'unit' : lot.unit;
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function ProduceSalesTab() {
  const { produceSales, addProduceSale, updateProduceSale, deleteProduceSale } =
    useAgriStore();
  const { accounts, cashflows, addCashflow, updateCashflow, deleteCashflow } =
    usePortfolioStore();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProduceSaleLot | null>(null);

  // ── form state ────────────────────────────────────────────────────────────
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState('Vegetable');
  const [pCustomCategory, setPCustomCategory] = useState('');
  const [pUnit, setPUnit] = useState('kg');
  const [pCustomUnit, setPCustomUnit] = useState('');
  const [pQty, setPQty] = useState('0');
  const [pPrice, setPPrice] = useState('0');
  const [pCommission, setPCommission] = useState('0');
  const [pDate, setPDate] = useState(new Date().toISOString().split('T')[0]);
  const [pSoldTo, setPSoldTo] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [pAccount, setPAccount] = useState('');

  // ── filter state ──────────────────────────────────────────────────────────
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterProduce, setFilterProduce] = useState('all');

  // ── derived preview ───────────────────────────────────────────────────────
  const qty = parseFloat(pQty) || 0;
  const price = parseFloat(pPrice) || 0;
  const commission = parseFloat(pCommission) || 0;
  const grossAmount = qty * price;
  const totalPreview = Math.max(0, grossAmount - commission);
  const effectiveUnit =
    pUnit === 'custom' ? pCustomUnit.trim() || 'unit' : pUnit;
  const effectiveCategory =
    pCategory === 'Other (custom)'
      ? pCustomCategory.trim() || 'Other'
      : pCategory;

  // ── form reset ────────────────────────────────────────────────────────────
  function resetForm(lot?: ProduceSaleLot) {
    setPName(lot?.produceName ?? '');

    const cat = lot?.category ?? 'Vegetable';
    if (PRESET_CATEGORIES.includes(cat)) {
      setPCategory(cat);
      setPCustomCategory('');
    } else {
      setPCategory('Other (custom)');
      setPCustomCategory(cat);
    }

    const presetVals = PRESET_UNITS.map((u) => u.value);
    const unit = lot?.unit ?? 'kg';
    if (presetVals.includes(unit)) {
      setPUnit(unit);
      setPCustomUnit(lot?.customUnit ?? '');
    } else {
      setPUnit('custom');
      setPCustomUnit(unit);
    }

    setPQty(String(lot?.quantity ?? 0));
    setPPrice(String(lot?.pricePerUnit ?? 0));
    setPCommission(String(lot?.commissionAmount ?? 0));
    setPDate(lot?.date ?? new Date().toISOString().split('T')[0]);
    setPSoldTo(lot?.soldTo ?? '');
    setPNotes(lot?.notes ?? '');
    setPAccount(lot?.accountId ?? '');
  }

  // ── Linked Cashflow Remover ───────────────────────────────────────────────
  const removeLinkedCashflow = async (
    type: 'income' | 'expense',
    category: string,
    amount: number,
    date: string,
  ) => {
    const cf = cashflows.find(
      (c) =>
        c.type === type &&
        c.category === category &&
        c.amount === amount &&
        c.date === date,
    );
    if (cf) await deleteCashflow(cf.id);
  };

  async function handleDeleteLot(lot: ProduceSaleLot) {
    await removeLinkedCashflow(
      'income',
      'Produce Sale',
      lot.totalAmount,
      lot.date,
    );
    await deleteProduceSale(lot.id);
    toast.success('Sale & linked cashflow deleted ✓');
  }

  // ── save ──────────────────────────────────────────────────────────────────
  async function save() {
    if (!pName.trim()) {
      toast.error('Produce name is required');
      return;
    }
    if (qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    if (price <= 0) {
      toast.error('Enter a valid price per unit');
      return;
    }

    const payload: Omit<
      ProduceSaleLot,
      'id' | 'createdAt' | 'updatedAt' | 'userId'
    > = {
      produceName: pName.trim(),
      category: effectiveCategory,
      unit: pUnit === 'custom' ? pCustomUnit.trim() || 'unit' : pUnit,
      customUnit: pUnit === 'custom' ? pCustomUnit.trim() : undefined,
      quantity: qty,
      pricePerUnit: price,
      commissionAmount: commission > 0 ? commission : undefined,
      totalAmount: totalPreview,
      date: pDate,
      soldTo: pSoldTo.trim() || undefined,
      notes: pNotes.trim() || undefined,
      accountId: pAccount || undefined,
    };

    const cashflowNote = `${pName.trim()} — ${qty} ${effectiveUnit} × ₹${price}${commission > 0 ? ` (Deducted Comm: ₹${commission})` : ''}${pSoldTo ? ` to ${pSoldTo}` : ''}`;

    if (editing) {
      await updateProduceSale(editing.id, payload);
      await syncCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'income',
        'Produce Sale',
        editing.totalAmount,
        editing.date,
        'Produce Sale',
        totalPreview,
        pDate,
        pAccount,
        cashflowNote,
      );

      toast.success('Sale record & Cashflow updated ✓');
    } else {
      await addProduceSale(payload);
      await addCashflow({
        type: 'income',
        category: 'Produce Sale',
        amount: totalPreview,
        date: pDate,
        notes: cashflowNote,
        accountId: pAccount || undefined,
      });
      toast.success(
        `Sale added · ${formatINR(totalPreview)} synced to Cashflow ✓`,
      );
    }

    setShowModal(false);
    setEditing(null);
    resetForm();
  }

  // ── derived aggregates ────────────────────────────────────────────────────
  const totalRevenue = produceSales.reduce((s, p) => s + p.totalAmount, 0);

  const uniqueProduce = useMemo(
    () => Array.from(new Set(produceSales.map((p) => p.produceName))).sort(),
    [produceSales],
  );
  const uniqueCategories = useMemo(
    () => Array.from(new Set(produceSales.map((p) => p.category))).sort(),
    [produceSales],
  );

  const filtered = useMemo(() => {
    let list = [...produceSales];
    if (filterCategory !== 'all')
      list = list.filter((p) => p.category === filterCategory);
    if (filterProduce !== 'all')
      list = list.filter((p) => p.produceName === filterProduce);
    return list;
  }, [produceSales, filterCategory, filterProduce]);

  // all-time unit totals (for summary strip)
  const allUnitSummary = useMemo(() => {
    const map: Record<string, { qty: number; amount: number }> = {};
    produceSales.forEach((p) => {
      const u = displayUnit(p);
      if (!map[u]) map[u] = { qty: 0, amount: 0 };
      map[u].qty += p.quantity;
      map[u].amount += p.totalAmount;
    });
    return Object.entries(map).map(([unit, v]) => ({
      unit,
      totalQuantity: v.qty,
      totalAmount: v.amount,
    }));
  }, [produceSales]);

  // filtered unit totals
  const filteredUnitSummary = useMemo(() => {
    const map: Record<string, { qty: number; amount: number }> = {};
    filtered.forEach((p) => {
      const u = displayUnit(p);
      if (!map[u]) map[u] = { qty: 0, amount: 0 };
      map[u].qty += p.quantity;
      map[u].amount += p.totalAmount;
    });
    return Object.entries(map).map(([unit, v]) => ({
      unit,
      totalQuantity: v.qty,
      totalAmount: v.amount,
    }));
  }, [filtered]);

  // chart: revenue by produce (top 10)
  const byProduce = useMemo(() => {
    const map: Record<string, number> = {};
    produceSales.forEach((p) => {
      map[p.produceName] = (map[p.produceName] ?? 0) + p.totalAmount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [produceSales]);

  // chart: revenue by category
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    produceSales.forEach((p) => {
      map[p.category] = (map[p.category] ?? 0) + p.totalAmount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [produceSales]);

  const filteredTotal = filtered.reduce((s, p) => s + p.totalAmount, 0);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className='flex flex-col gap-6'>
      {/* ── Summary cards ── */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <SummaryCard
          icon='🧺'
          label='Net Revenue'
          value={formatINR(totalRevenue)}
          color='#22c55e'
        />
        <SummaryCard
          icon='📋'
          label='Sale Lots'
          value={String(produceSales.length)}
          color='#3b82f6'
          sub='total records'
        />
        <SummaryCard
          icon='🌿'
          label='Produce Types'
          value={String(uniqueProduce.length)}
          color='#a78bfa'
          sub={`${uniqueCategories.length} categories`}
        />
        <SummaryCard
          icon='📦'
          label='Unit Types'
          value={String(allUnitSummary.length)}
          color='#f59e0b'
          sub={allUnitSummary.map((u) => u.unit).join(', ')}
        />
      </div>

      {/* ── Unit totals strip ── */}
      {allUnitSummary.length > 0 && (
        <div className='flex flex-wrap gap-3'>
          {allUnitSummary.map((u) => (
            <div
              key={u.unit}
              className='rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 flex flex-col gap-0.5 min-w-[120px]'
            >
              <div className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
                Total {u.unit}
              </div>
              <div className='text-lg font-bold text-slate-100 font-mono'>
                {formatNumber(
                  u.totalQuantity,
                  u.unit === 'kg' || u.unit === 'litre' ? 2 : 0,
                )}{' '}
                {u.unit}
              </div>
              <div className='text-xs text-emerald-400 font-semibold'>
                {formatINR(u.totalAmount)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts ── */}
      {produceSales.length > 0 && (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {byProduce.length > 0 && (
            <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
              <div className='text-sm font-bold text-slate-100 mb-4'>
                💰 Revenue by Produce
              </div>
              <ResponsiveContainer width='100%' height={220}>
                <BarChart
                  data={byProduce}
                  layout='vertical'
                  margin={{ left: 20 }}
                >
                  <XAxis
                    type='number'
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type='category'
                    dataKey='name'
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    width={72}
                  />
                  <Tooltip
                    formatter={(v) => formatINR(Number(v))}
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey='value' name='Revenue' radius={[0, 4, 4, 0]}>
                    {byProduce.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {byCategory.length > 0 && (
            <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
              <div className='text-sm font-bold text-slate-100 mb-4'>
                🌿 Revenue by Category
              </div>
              <ResponsiveContainer width='100%' height={220}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey='value'
                    nameKey='name'
                    cx='50%'
                    cy='50%'
                    outerRadius={75}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatINR(Number(v))}
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Filtered unit totals ── */}
      {(filterCategory !== 'all' || filterProduce !== 'all') &&
        filteredUnitSummary.length > 0 && (
          <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
            <div className='text-xs font-bold uppercase tracking-wider text-slate-400 mb-3'>
              📊 Filtered Totals by Unit
            </div>
            <div className='flex flex-wrap gap-3'>
              {filteredUnitSummary.map((u) => (
                <div
                  key={u.unit}
                  className='rounded-xl bg-slate-800 px-4 py-2 flex flex-col gap-0.5'
                >
                  <div className='text-[10px] text-slate-400 uppercase font-bold'>
                    {u.unit}
                  </div>
                  <div className='text-base font-bold font-mono text-slate-100'>
                    {formatNumber(
                      u.totalQuantity,
                      u.unit === 'kg' || u.unit === 'litre' ? 2 : 0,
                    )}{' '}
                    {u.unit}
                  </div>
                  <div className='text-xs text-emerald-400'>
                    {formatINR(u.totalAmount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* ── Records table ── */}
      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
        <div className='flex items-center justify-between mb-4 flex-wrap gap-2'>
          <div>
            <div className='text-sm font-bold text-slate-100'>
              🧺 Produce Sales Records
            </div>
            <div className='text-[10px] text-slate-500 mt-0.5'>
              Income auto-synced to Cashflow · {filtered.length} records
            </div>
          </div>
          <div className='flex gap-2 flex-wrap items-center'>
            <div className='w-36'>
              <ProduceDropdown
                value={filterCategory}
                onChange={setFilterCategory}
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...uniqueCategories.map((c) => ({
                    value: c,
                    label: c,
                  })),
                ]}
              />
            </div>
            <div className='w-36'>
              <ProduceDropdown
                value={filterProduce}
                onChange={setFilterProduce}
                options={[
                  { value: 'all', label: 'All Produce' },
                  ...uniqueProduce.map((p) => ({
                    value: p,
                    label: p,
                  })),
                ]}
              />
            </div>
            <button
              onClick={() => {
                setEditing(null);
                resetForm();
                setShowModal(true);
              }}
              className='px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 whitespace-nowrap'
            >
              + Add Sale
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className='text-xs text-slate-500 text-center py-10'>
            {produceSales.length === 0
              ? 'No produce sales recorded yet. Click "+ Add Sale" to get started.'
              : 'No records match the selected filter.'}
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='text-slate-500 border-b border-slate-800'>
                  {[
                    'Date',
                    'Produce',
                    'Category',
                    'Unit',
                    'Qty',
                    'Rate',
                    'Comm',
                    'Net Income',
                    'Sold To',
                    'Notes',
                    'Account',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className='px-3 py-2 text-left font-bold uppercase tracking-wider whitespace-nowrap'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lot) => {
                  const unit = displayUnit(lot);
                  return (
                    <tr
                      key={lot.id}
                      className='border-b border-slate-800/50 hover:bg-slate-800/30'
                    >
                      <td className='px-3 py-2 text-slate-400 whitespace-nowrap'>
                        {lot.date}
                      </td>
                      <td className='px-3 py-2 font-bold text-emerald-400 whitespace-nowrap'>
                        {lot.produceName}
                      </td>
                      <td className='px-3 py-2'>
                        <span className='px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 font-semibold text-[10px] whitespace-nowrap'>
                          {lot.category}
                        </span>
                      </td>
                      <td className='px-3 py-2'>
                        <span className='px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold text-[10px]'>
                          {unit}
                        </span>
                      </td>
                      <td className='px-3 py-2 text-slate-100 font-bold font-mono'>
                        {formatNumber(
                          lot.quantity,
                          unit === 'kg' || unit === 'litre' ? 2 : 0,
                        )}
                      </td>
                      <td className='px-3 py-2 text-slate-400 whitespace-nowrap'>
                        ₹{lot.pricePerUnit}/{unit}
                      </td>
                      <td className='px-3 py-2 text-red-400 whitespace-nowrap'>
                        {lot.commissionAmount
                          ? formatINR(lot.commissionAmount)
                          : '—'}
                      </td>
                      <td className='px-3 py-2 text-green-400 font-bold whitespace-nowrap'>
                        {formatINR(lot.totalAmount)}
                      </td>
                      <td className='px-3 py-2 text-slate-400 whitespace-nowrap'>
                        {lot.soldTo ?? '—'}
                      </td>
                      <td className='px-3 py-2 text-slate-500 max-w-[140px] truncate'>
                        {lot.notes ?? '—'}
                      </td>
                      <td className='px-3 py-2 text-slate-400 whitespace-nowrap'>
                        {accounts.find((a) => a.id === lot.accountId)?.name ??
                          '—'}
                      </td>
                      <td className='px-3 py-2'>
                        <div className='flex gap-1 items-center'>
                          <button
                            onClick={() => {
                              setEditing(lot);
                              resetForm(lot);
                              setShowModal(true);
                            }}
                            className='p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors'
                            title='Edit'
                          >
                            <FiEdit2 className='w-3.5 h-3.5' />
                          </button>
                          <DeleteConfirmBtn
                            onDelete={() => handleDeleteLot(lot)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className='border-t border-slate-700 bg-slate-900/60'>
                  <td
                    colSpan={7}
                    className='px-3 py-2 text-slate-400 font-bold text-[10px] uppercase text-right'
                  >
                    Net Total ({filtered.length} records)
                  </td>
                  <td className='px-3 py-2 text-emerald-400 font-bold whitespace-nowrap'>
                    {formatINR(filteredTotal)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
        }}
        title={editing ? '✏️ Edit Produce Sale' : '🧺 Add Produce Sale'}
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          {/* Produce Name */}
          <div>
            <label className={labelCls}>Produce Name *</label>
            <input
              className={inputCls}
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              placeholder='e.g. Tomato, Onion, Drumstick'
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Category</label>
            <ProduceDropdown
              value={pCategory}
              onChange={setPCategory}
              options={[
                ...PRESET_CATEGORIES.map((c) => ({
                  value: c,
                  label: c,
                })),
                { value: 'Other (custom)', label: 'Other (custom)…' },
              ]}
            />
            {pCategory === 'Other (custom)' && (
              <input
                className={inputCls + ' mt-2'}
                value={pCustomCategory}
                onChange={(e) => setPCustomCategory(e.target.value)}
                placeholder='Enter category name'
              />
            )}
          </div>

          {/* Unit */}
          <div>
            <label className={labelCls}>Unit *</label>
            <ProduceDropdown
              value={pUnit}
              onChange={setPUnit}
              options={PRESET_UNITS}
            />
            {pUnit === 'custom' && (
              <input
                className={inputCls + ' mt-2'}
                value={pCustomUnit}
                onChange={(e) => setPCustomUnit(e.target.value)}
                placeholder='Enter unit name (e.g. sack, tray, 30kg bag…)'
              />
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className={labelCls}>Quantity ({effectiveUnit}) *</label>
            <NumericInput
              className={inputCls}
              value={pQty}
              onChange={setPQty}
            />
          </div>

          {/* Price per unit */}
          <div>
            <label className={labelCls}>Price per {effectiveUnit} (₹) *</label>
            <NumericInput
              className={inputCls}
              value={pPrice}
              onChange={setPPrice}
            />
          </div>

          {/* Optional Commission */}
          <div>
            <label className={labelCls}>Commission Deduction (₹)</label>
            <NumericInput
              className={inputCls}
              value={pCommission}
              onChange={setPCommission}
              placeholder='e.g. Market Fee, Transport...'
            />
          </div>

          {/* Date */}
          <div>
            <label className={labelCls}>Sale Date *</label>
            <input
              type='date'
              className={inputCls}
              value={pDate}
              onChange={(e) => setPDate(e.target.value)}
            />
          </div>

          {/* Sold To */}
          <div>
            <label className={labelCls}>Sold To</label>
            <input
              className={inputCls}
              value={pSoldTo}
              onChange={(e) => setPSoldTo(e.target.value)}
              placeholder='e.g. Market, Mani Trader, APMC'
            />
          </div>

          {/* Bank Account */}
          <div>
            <label className={labelCls}>Income to Account</label>
            <ProduceDropdown
              value={pAccount}
              onChange={setPAccount}
              options={[
                { value: '', label: '— Cash —' },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </div>

          {/* Notes */}
          <div className='sm:col-span-2'>
            <label className={labelCls}>Notes</label>
            <textarea
              className={inputCls + ' resize-none h-20'}
              value={pNotes}
              onChange={(e) => setPNotes(e.target.value)}
              placeholder='Optional — e.g. Grade A quality, partial lot, morning market…'
            />
          </div>
        </div>

        {/* Live preview */}
        {qty > 0 && price > 0 && (
          <div
            className='rounded-xl border border-emerald-500/20 p-4 mt-4'
            style={{ background: 'rgba(34,197,94,0.05)' }}
          >
            <div className='text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3'>
              📊 Sale Preview
            </div>
            <div className='grid grid-cols-4 gap-2 text-center items-center'>
              <div>
                <div className='text-[10px] text-slate-500 uppercase'>
                  Gross
                </div>
                <div className='text-sm font-bold text-slate-300 font-mono'>
                  {formatINR(grossAmount)}
                </div>
              </div>
              <div className='text-xl text-slate-600 font-mono'>-</div>
              <div>
                <div className='text-[10px] text-slate-500 uppercase'>Comm</div>
                <div className='text-sm font-bold text-red-400 font-mono'>
                  {formatINR(commission)}
                </div>
              </div>
              <div>
                <div className='text-[10px] text-slate-500 uppercase'>
                  Net Income
                </div>
                <div className='text-sm font-bold text-emerald-400 font-mono bg-emerald-500/10 rounded-lg py-1 px-2 border border-emerald-500/20'>
                  {formatINR(totalPreview)}
                </div>
              </div>
            </div>
          </div>
        )}

        {!editing && (
          <p className='text-[10px] text-emerald-400 mt-3'>
            ✓ Net Income will auto-sync to Cashflow &amp; selected account.
          </p>
        )}
        {editing && (
          <p className='text-[10px] text-emerald-400 mt-3'>
            ✓ Updates will accurately reflect in connected Cashflow records.
          </p>
        )}

        <div className='flex justify-end gap-2 pt-4 mt-2 border-t border-slate-800'>
          <button
            onClick={() => {
              setShowModal(false);
              setEditing(null);
            }}
            className='px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-sm font-bold'
          >
            Cancel
          </button>
          <button
            onClick={save}
            className={`px-5 py-2 rounded-xl text-white text-sm font-bold ${
              editing
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {editing ? 'Update Sale' : 'Save Sale'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
