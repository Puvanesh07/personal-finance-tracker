// src/pages/Agriculture/AgriculturePage.tsx

import type {
  AgriExpenseCategory,
  CashflowEntry,
  CoconutRecord,
  CoconutSellMethod,
  CropCycle,
  Field,
  LivestockEvent,
  LivestockEventType,
  LivestockType,
  MilkRecord,
  Season,
} from '../../types/investmentTypes';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FiCheck, FiChevronDown } from 'react-icons/fi';
import { formatINR, formatNumber } from '../../utils/format';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AgricultureLoader } from '../../components/ui/SectionLoader';
import { AttendancePage } from './AttendancePage';
import { Modal } from '../../components/ui/Modal';
import { NumericInput } from '../../components/ui/NumericInput';
import { ProduceSalesTab } from './ProduceSalesTab';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useAgriStore } from '../../store/agricultureStore';
import { usePortfolioStore } from '../../store/portfolioStore';

// ─── Constants ───────────────────────────────────────────────────────────────

const SEASONS: { value: Season; label: string; emoji: string }[] = [
  { value: 'summer', label: 'Summer ☀️', emoji: '☀️' },
  { value: 'monsoon', label: 'Monsoon (Rainy) 🌧️', emoji: '🌧️' },
  { value: 'winter', label: 'Winter ❄️', emoji: '❄️' },
];

const EXPENSE_CATS: { value: AgriExpenseCategory; label: string }[] = [
  { value: 'seeds', label: 'Seeds' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'pesticides', label: 'Pesticides' },
  { value: 'labor', label: 'Labor' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'tractor_fuel', label: 'Tractor Fuel' },
  { value: 'equipment_repair', label: 'Equipment Repair' },
  { value: 'feed', label: 'Animal Feed' },
  { value: 'veterinary', label: 'Veterinary' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'shed', label: 'Shed Maintenance' },
  { value: 'other', label: 'Other' },
];

const LIVESTOCK_TYPES: {
  value: LivestockType;
  label: string;
  emoji: string;
}[] = [
  { value: 'cow', label: 'Cow', emoji: '🐄' },
  { value: 'buffalo', label: 'Buffalo', emoji: '🐃' },
  { value: 'goat', label: 'Goat', emoji: '🐐' },
  { value: 'sheep', label: 'Sheep', emoji: '🐑' },
  { value: 'poultry', label: 'Poultry', emoji: '🐓' },
  { value: 'other', label: 'Other', emoji: '🐾' },
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

const TAB_TYPES = [
  'overview',
  'crops',
  'expenses',
  'livestock',
  'milk',
  'coconut',
  'produce',
  'attendance',
] as const;
type Tab = (typeof TAB_TYPES)[number];

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';
const labelCls =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1';

// ─── AgriDropdown ─────────────────────────────────────────────────────────────

type DropdownOption = { value: string; label: string; emoji?: string };

function AgriDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
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
          className={`ml-2 h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180 text-emerald-400' : ''}`}
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

function DeleteBtn({ onDelete }: { onDelete: () => void }) {
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
      className='px-2 py-1 rounded-lg bg-slate-800 text-red-400 text-xs font-bold hover:bg-red-500/10'
    >
      Delete
    </button>
  );
}

// ─── Cashflow Auto-Sync Core ──────────────────────────────────────────────────

async function pushToCashflow(
  type: 'income' | 'expense',
  category: string,
  amount: number,
  date: string,
  accountId: string | undefined,
  notes: string,
  addCashflow: ReturnType<typeof usePortfolioStore.getState>['addCashflow'],
) {
  if (amount <= 0) return;
  await addCashflow({
    type,
    category,
    amount,
    date,
    notes,
    accountId: accountId || undefined,
  });
}

export async function syncCashflow(
  cashflows: CashflowEntry[],
  addCashflow: any,
  updateCashflow: any,
  deleteCashflow: any,
  type: 'income' | 'expense',
  oldCategory: string | undefined,
  oldAmount: number | undefined,
  oldDate: string | undefined,
  newCategory: string,
  newAmount: number,
  newDate: string,
  newAccountId: string | undefined,
  newNotes: string,
) {
  const existingCf =
    oldAmount && oldAmount > 0 && oldDate && oldCategory
      ? cashflows.find(
          (c) =>
            c.type === type &&
            c.category === oldCategory &&
            c.amount === oldAmount &&
            c.date === oldDate,
        )
      : undefined;

  if (existingCf) {
    if (newAmount <= 0) {
      await deleteCashflow(existingCf.id);
    } else {
      await updateCashflow(existingCf.id, {
        category: newCategory,
        amount: newAmount,
        date: newDate,
        accountId: newAccountId || undefined,
        notes: newNotes,
      });
    }
  } else if (newAmount > 0) {
    await pushToCashflow(
      type,
      newCategory,
      newAmount,
      newDate,
      newAccountId,
      newNotes,
      addCashflow,
    );
  }
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const {
    cropCycles,
    agriExpenses,
    milkRecords,
    fields,
    coconutRecords,
    livestockEvents,
  } = useAgriStore();

  const cropIncome = cropCycles.reduce((s, c) => s + c.harvestIncome, 0);
  const milkIncome = milkRecords.reduce(
    (s, m) => s + m.liters * m.pricePerLiter,
    0,
  );
  const coconutIncome = coconutRecords.reduce((s, c) => s + c.harvestIncome, 0);
  const totalIncome = cropIncome + milkIncome + coconutIncome;
  const totalExpenses =
    agriExpenses.reduce((s, e) => s + e.amount, 0) +
    coconutRecords.reduce((s, c) => s + c.investmentAmount, 0);
  const totalProfit = totalIncome - totalExpenses;

  const totalAnimalCount = (
    ['goat', 'cow', 'buffalo', 'sheep', 'poultry', 'other'] as const
  ).reduce((total, type) => {
    const count = livestockEvents
      .filter((e) => e.animalType === type)
      .reduce((n, e) => {
        if (
          e.eventType === 'purchase' ||
          e.eventType === 'birth' ||
          e.eventType === 'existing'
        )
          return n + e.count;
        if (e.eventType === 'sale' || e.eventType === 'death')
          return n - e.count;
        return n;
      }, 0);
    return total + Math.max(0, count);
  }, 0);
  const livestockSaleIncome = livestockEvents
    .filter((e) => e.eventType === 'sale')
    .reduce((s, e) => s + (e.price ?? 0), 0);

  const profitBySource = [
    {
      name: 'Crops',
      profit: cropIncome - agriExpenses.reduce((s, e) => s + e.amount, 0),
      fill: '#22c55e',
    },
    { name: 'Milk', profit: milkIncome, fill: '#14b8a6' },
    {
      name: 'Coconut',
      profit:
        coconutIncome -
        coconutRecords.reduce((s, c) => s + c.investmentAmount, 0),
      fill: '#f59e0b',
    },
  ].filter((x) => x.profit !== 0);

  const cropProfitData = cropCycles
    .map((c) => {
      const exp = agriExpenses
        .filter((e) => e.cropCycleId === c.id)
        .reduce((s, e) => s + e.amount, 0);
      return {
        name: `${c.cropName}`,
        income: c.harvestIncome,
        expenses: exp + c.investedAmount,
      };
    })
    .filter((x) => x.income > 0 || x.expenses > 0);

  const expByCategory: Record<string, number> = {};
  agriExpenses.forEach((e) => {
    expByCategory[e.category] = (expByCategory[e.category] ?? 0) + e.amount;
  });
  const expPieData = Object.entries(expByCategory).map(([name, value]) => ({
    name: EXPENSE_CATS.find((c) => c.value === name)?.label ?? name,
    value,
  }));

  const seasonData: Record<string, { income: number; expenses: number }> = {};
  cropCycles.forEach((c) => {
    if (!seasonData[c.season])
      seasonData[c.season] = { income: 0, expenses: 0 };
    seasonData[c.season].income += c.harvestIncome;
    const exp = agriExpenses
      .filter((e) => e.cropCycleId === c.id)
      .reduce((s, e) => s + e.amount, 0);
    seasonData[c.season].expenses += exp + c.investedAmount;
  });
  const seasonChartData = Object.entries(seasonData).map(([season, v]) => ({
    season:
      SEASONS.find((s) => s.value === season)?.label.split(' ')[0] ?? season,
    profit: v.income - v.expenses,
  }));

  const milkByMonth: Record<string, number> = {};
  milkRecords.forEach((m) => {
    const month = m.date.substring(0, 7);
    milkByMonth[month] = (milkByMonth[month] ?? 0) + m.liters * m.pricePerLiter;
  });
  const milkChartData = Object.entries(milkByMonth)
    .sort()
    .slice(-6)
    .map(([month, income]) => ({ month, income }));

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <SummaryCard
          icon='💰'
          label='Total Income'
          value={formatINR(totalIncome)}
          color='#22c55e'
        />
        <SummaryCard
          icon='💸'
          label='Total Expenses'
          value={formatINR(totalExpenses)}
          color='#ef4444'
        />
        <SummaryCard
          icon='📈'
          label='Net Profit'
          value={formatINR(totalProfit)}
          color={totalProfit >= 0 ? '#22c55e' : '#ef4444'}
          sub={totalProfit >= 0 ? 'Profitable ✓' : 'In loss'}
        />
        <SummaryCard
          icon='🐄'
          label='Livestock Sale Income'
          value={formatINR(livestockSaleIncome)}
          color='#f59e0b'
          sub={`${totalAnimalCount} animals now`}
        />
      </div>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <SummaryCard
          icon='🏞️'
          label='Fields'
          value={String(fields.length)}
          color='#3b82f6'
          sub={`${formatNumber(
            fields.reduce((s, f) => s + f.areAcres, 0),
            1,
          )} acres`}
        />
        <SummaryCard
          icon='🌾'
          label='Crop Income'
          value={formatINR(cropIncome)}
          color='#a78bfa'
        />
        <SummaryCard
          icon='🥛'
          label='Milk Income'
          value={formatINR(milkIncome)}
          color='#14b8a6'
        />
        <SummaryCard
          icon='🌴'
          label='Coconut Income'
          value={formatINR(coconutIncome)}
          color='#f59e0b'
          sub={`${coconutRecords.reduce((s, c) => s + c.totalCoconuts, 0)} coconuts`}
        />
      </div>

      {profitBySource.length > 0 && (
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
          <div className='text-sm font-bold text-slate-100 mb-4'>
            🌿 Farm Profit by Source
          </div>
          <ResponsiveContainer width='100%' height={200}>
            <BarChart data={profitBySource}>
              <XAxis dataKey='name' tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v) => formatINR(Number(v))}
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                }}
              />
              <Bar dataKey='profit' name='Net Profit' radius={[4, 4, 0, 0]}>
                {profitBySource.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {cropProfitData.length > 0 && (
          <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
            <div className='text-sm font-bold text-slate-100 mb-4'>
              🌾 Crop Income vs Expenses
            </div>
            <ResponsiveContainer width='100%' height={200}>
              <BarChart data={cropProfitData} barGap={4}>
                <XAxis
                  dataKey='name'
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v) => formatINR(Number(v))}
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar
                  dataKey='income'
                  name='Income'
                  fill='#22c55e'
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey='expenses'
                  name='Expenses'
                  fill='#ef4444'
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {expPieData.length > 0 && (
          <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
            <div className='text-sm font-bold text-slate-100 mb-4'>
              💸 Expense Breakdown
            </div>
            <ResponsiveContainer width='100%' height={200}>
              <PieChart>
                <Pie
                  data={expPieData}
                  dataKey='value'
                  nameKey='name'
                  cx='50%'
                  cy='50%'
                  outerRadius={70}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {expPieData.map((_, i) => (
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
        {seasonChartData.length > 0 && (
          <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
            <div className='text-sm font-bold text-slate-100 mb-4'>
              🗓️ Profit by Season
            </div>
            <ResponsiveContainer width='100%' height={180}>
              <BarChart data={seasonChartData}>
                <XAxis
                  dataKey='season'
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v) => formatINR(Number(v))}
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey='profit'
                  name='Net Profit'
                  fill='#22c55e'
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {milkChartData.length > 0 && (
          <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
            <div className='text-sm font-bold text-slate-100 mb-4'>
              🥛 Monthly Milk Income
            </div>
            <ResponsiveContainer width='100%' height={180}>
              <LineChart data={milkChartData}>
                <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
                <XAxis
                  dataKey='month'
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v) => formatINR(Number(v))}
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                  }}
                />
                <Line
                  type='monotone'
                  dataKey='income'
                  stroke='#14b8a6'
                  strokeWidth={2}
                  dot={{ fill: '#14b8a6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Crops Tab ────────────────────────────────────────────────────────────────

function CropsTab() {
  const {
    fields,
    cropCycles,
    agriExpenses,
    addCropCycle,
    updateCropCycle,
    deleteCropCycle,
    addField,
    updateField,
    deleteField,
  } = useAgriStore();
  const { accounts, cashflows, addCashflow, updateCashflow, deleteCashflow } =
    usePortfolioStore();

  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);

  const [showCropModal, setShowCropModal] = useState(false);
  const [editingCrop, setEditingCrop] = useState<CropCycle | null>(null);

  const [fName, setFName] = useState('');
  const [fArea, setFArea] = useState('0');
  const [fLocation, setFLocation] = useState('');

  const [cField, setCField] = useState('');
  const [cCrop, setCCrop] = useState('');
  const [cSeasonVal, setCSeasonVal] = useState<Season>('monsoon');
  const [cStart, setCStart] = useState('');
  const [cHarvest, setCHarvest] = useState('');
  const [cInvested, setCInvested] = useState('0');
  const [cIncome, setCIncome] = useState('0');
  const [cQty, setCQty] = useState('0');
  const [cNotes, setCNotes] = useState('');
  const [cAccount, setCAccount] = useState('');

  function resetFieldForm(f?: Field) {
    setFName(f?.name ?? '');
    setFArea(String(f?.areAcres ?? 0));
    setFLocation(f?.location ?? '');
  }

  function resetCropForm(crop?: CropCycle) {
    setCField(crop?.fieldId ?? '');
    setCCrop(crop?.cropName ?? '');
    setCSeasonVal(crop?.season ?? 'monsoon');
    setCStart(crop?.startDate ?? '');
    setCHarvest(crop?.expectedHarvestDate ?? '');
    setCInvested(String(crop?.investedAmount ?? 0));
    setCIncome(String(crop?.harvestIncome ?? 0));
    setCQty(String(crop?.quantityKg ?? 0));
    setCNotes(crop?.notes ?? '');
    setCAccount(crop?.accountId ?? '');
  }

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

  async function saveCrop() {
    if (!cCrop.trim() || !cStart || !cHarvest) {
      toast.error('Crop name, start and harvest dates are required');
      return;
    }
    const fieldName = fields.find((f) => f.id === cField)?.name;
    const income = parseFloat(cIncome) || 0;
    const invested = parseFloat(cInvested) || 0;
    const payload = {
      fieldId: cField,
      fieldName,
      cropName: cCrop.trim(),
      season: cSeasonVal,
      startDate: cStart,
      expectedHarvestDate: cHarvest,
      investedAmount: invested,
      harvestIncome: income,
      quantityKg: parseFloat(cQty) || 0,
      notes: cNotes.trim() || undefined,
      accountId: cAccount || undefined,
    };

    if (editingCrop) {
      await updateCropCycle(editingCrop.id, payload);

      // Smart Auto-Sync Income Cashflow
      await syncCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'income',
        'Crop Sale',
        editingCrop.harvestIncome,
        editingCrop.actualHarvestDate || editingCrop.expectedHarvestDate,
        'Crop Sale',
        income,
        cHarvest,
        cAccount,
        `${cCrop.trim()} harvest income`,
      );

      // Smart Auto-Sync Expense Cashflow
      await syncCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'expense',
        'Crop Investment',
        editingCrop.investedAmount,
        editingCrop.startDate,
        'Crop Investment',
        invested,
        cStart,
        cAccount,
        `${cCrop.trim()} investment`,
      );

      toast.success('Crop cycle & Cashflow updated ✓');
    } else {
      await addCropCycle(payload);
      if (income > 0) {
        await pushToCashflow(
          'income',
          'Crop Sale',
          income,
          cHarvest,
          cAccount || undefined,
          `${cCrop.trim()} harvest income`,
          addCashflow,
        );
      }
      if (invested > 0) {
        await pushToCashflow(
          'expense',
          'Crop Investment',
          invested,
          cStart,
          cAccount || undefined,
          `${cCrop.trim()} investment`,
          addCashflow,
        );
      }
      toast.success('Crop cycle added & synced to Cashflow ✓');
    }
    setShowCropModal(false);
  }

  async function handleDeleteCrop(c: CropCycle) {
    if (c.harvestIncome > 0)
      await removeLinkedCashflow(
        'income',
        'Crop Sale',
        c.harvestIncome,
        c.actualHarvestDate || c.expectedHarvestDate,
      );
    if (c.investedAmount > 0)
      await removeLinkedCashflow(
        'expense',
        'Crop Investment',
        c.investedAmount,
        c.startDate,
      );
    await deleteCropCycle(c.id);
    toast.success('Crop & linked cashflow deleted ✓');
  }

  async function saveField() {
    if (!fName.trim()) {
      toast.error('Field name required');
      return;
    }
    if (editingField) {
      await updateField(editingField.id, {
        name: fName.trim(),
        areAcres: parseFloat(fArea) || 0,
        location: fLocation.trim() || undefined,
      });
      toast.success('Field updated ✓');
    } else {
      await addField({
        name: fName.trim(),
        areAcres: parseFloat(fArea) || 0,
        location: fLocation.trim() || undefined,
      });
      toast.success('Field added ✓');
    }
    setShowFieldModal(false);
    setEditingField(null);
    resetFieldForm();
  }

  return (
    <div className='flex flex-col gap-6'>
      {/* Fields */}
      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
        <div className='flex items-center justify-between mb-4'>
          <div className='text-sm font-bold text-slate-100'>
            🏞️ Fields / Land
          </div>
          <button
            onClick={() => {
              setEditingField(null);
              resetFieldForm();
              setShowFieldModal(true);
            }}
            className='px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700'
          >
            + Add Field
          </button>
        </div>
        {fields.length === 0 ? (
          <p className='text-xs text-slate-500 text-center py-4'>
            No fields added yet.
          </p>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
            {fields.map((f) => (
              <div
                key={f.id}
                className='rounded-xl bg-slate-800 p-3 flex flex-col gap-1'
              >
                <div className='font-bold text-slate-100 text-sm'>{f.name}</div>
                <div className='text-xs text-slate-400'>
                  {f.areAcres} acres{f.location ? ` · ${f.location}` : ''}
                </div>
                <div className='text-xs text-emerald-400'>
                  {cropCycles.filter((c) => c.fieldId === f.id).length} crop
                  cycles
                </div>
                <div className='flex gap-1 mt-2'>
                  <button
                    onClick={() => {
                      setEditingField(f);
                      resetFieldForm(f);
                      setShowFieldModal(true);
                    }}
                    className='px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600'
                  >
                    Edit
                  </button>
                  <DeleteBtn onDelete={() => deleteField(f.id)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Crop Cycles */}
      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <div className='text-sm font-bold text-slate-100'>
              🌾 Crop Cycles
            </div>
            <div className='text-[10px] text-slate-500 mt-0.5'>
              Income & investment auto-sync to Cashflow
            </div>
          </div>
          <button
            onClick={() => {
              setEditingCrop(null);
              resetCropForm();
              setShowCropModal(true);
            }}
            className='px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700'
          >
            + Add Crop
          </button>
        </div>
        {cropCycles.length === 0 ? (
          <p className='text-xs text-slate-500 text-center py-4'>
            No crop cycles added yet.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='text-slate-500 border-b border-slate-800'>
                  {[
                    'Field',
                    'Crop',
                    'Season',
                    'Harvest Date',
                    'Invested',
                    'Income',
                    'Account',
                    'Profit',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className='px-3 py-2 text-left font-bold uppercase tracking-wider'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cropCycles.map((c) => {
                  const exp = agriExpenses
                    .filter((e) => e.cropCycleId === c.id)
                    .reduce((s, e) => s + e.amount, 0);
                  const profit = c.harvestIncome - c.investedAmount - exp;
                  const seasonMeta = SEASONS.find((s) => s.value === c.season);
                  return (
                    <tr
                      key={c.id}
                      className='border-b border-slate-800/50 hover:bg-slate-800/30'
                    >
                      <td className='px-3 py-2 text-slate-300'>
                        {c.fieldName ?? '—'}
                      </td>
                      <td className='px-3 py-2 font-bold text-emerald-400'>
                        {c.cropName}
                      </td>
                      <td className='px-3 py-2'>
                        <span className='px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-semibold text-[10px]'>
                          {seasonMeta?.emoji}{' '}
                          {seasonMeta?.label.split(' ')[0] ?? c.season}
                        </span>
                      </td>
                      <td className='px-3 py-2 text-slate-400'>
                        {c.actualHarvestDate ?? c.expectedHarvestDate}
                      </td>
                      <td className='px-3 py-2 text-red-400'>
                        {formatINR(c.investedAmount)}
                      </td>
                      <td className='px-3 py-2 text-green-400'>
                        {formatINR(c.harvestIncome)}
                      </td>
                      <td className='px-3 py-2 text-slate-400'>
                        {accounts.find((a) => a.id === c.accountId)?.name ??
                          '—'}
                      </td>
                      <td
                        className='px-3 py-2 font-bold'
                        style={{ color: profit >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {formatINR(profit)}
                      </td>
                      <td className='px-3 py-2'>
                        <button
                          onClick={() => {
                            setEditingCrop(c);
                            resetCropForm(c);
                            setShowCropModal(true);
                          }}
                          className='px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 mr-1'
                        >
                          Edit
                        </button>
                        <DeleteBtn onDelete={() => handleDeleteCrop(c)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Field Modal */}
      <Modal
        open={showFieldModal}
        onClose={() => setShowFieldModal(false)}
        title={editingField ? 'Edit Field / Land' : 'Add Field / Land'}
      >
        <div className='flex flex-col gap-4'>
          <div>
            <label className={labelCls}>Field Name *</label>
            <input
              className={inputCls}
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              placeholder='e.g. North Field'
            />
          </div>
          <div>
            <label className={labelCls}>Area (Acres)</label>
            <NumericInput
              className={inputCls}
              value={fArea}
              onChange={setFArea}
            />
          </div>
          <div>
            <label className={labelCls}>Location / Village</label>
            <input
              className={inputCls}
              value={fLocation}
              onChange={(e) => setFLocation(e.target.value)}
              placeholder='Optional'
            />
          </div>
          <div className='flex justify-end gap-2 pt-2 border-t border-slate-800'>
            <button
              onClick={() => setShowFieldModal(false)}
              className='px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-sm font-bold'
            >
              Cancel
            </button>
            <button
              onClick={saveField}
              className='px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700'
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Crop Modal */}
      <Modal
        open={showCropModal}
        onClose={() => setShowCropModal(false)}
        title={editingCrop ? 'Edit Crop Cycle' : 'Add Crop Cycle'}
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Field</label>
            <AgriDropdown
              value={cField}
              onChange={setCField}
              options={[
                { value: '', label: '— Select Field —' },
                ...fields.map((f) => ({ value: f.id, label: f.name })),
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Crop Name *</label>
            <input
              className={inputCls}
              value={cCrop}
              onChange={(e) => setCCrop(e.target.value)}
              placeholder='e.g. Rice, Sugarcane'
            />
          </div>
          <div>
            <label className={labelCls}>Season</label>
            <AgriDropdown
              value={cSeasonVal}
              onChange={(v) => setCSeasonVal(v as Season)}
              options={SEASONS.map((s) => ({
                value: s.value,
                label: s.label,
                emoji: s.emoji,
              }))}
            />
          </div>
          <div>
            <label className={labelCls}>Start Date *</label>
            <input
              type='date'
              className={inputCls}
              value={cStart}
              onChange={(e) => setCStart(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Expected Harvest *</label>
            <input
              type='date'
              className={inputCls}
              value={cHarvest}
              onChange={(e) => setCHarvest(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Investment (₹)</label>
            <NumericInput
              className={inputCls}
              value={cInvested}
              onChange={setCInvested}
            />
          </div>
          <div>
            <label className={labelCls}>Harvest Income (₹)</label>
            <NumericInput
              className={inputCls}
              value={cIncome}
              onChange={setCIncome}
            />
          </div>
          <div>
            <label className={labelCls}>Yield (kg)</label>
            <NumericInput
              className={inputCls}
              value={cQty}
              onChange={setCQty}
            />
          </div>
          <div>
            <label className={labelCls}>Bank Account / Cash</label>
            <AgriDropdown
              value={cAccount}
              onChange={setCAccount}
              options={[
                { value: '', label: '— Cash —' },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </div>
          <div className='sm:col-span-2'>
            <label className={labelCls}>Notes</label>
            <input
              className={inputCls}
              value={cNotes}
              onChange={(e) => setCNotes(e.target.value)}
              placeholder='Optional'
            />
          </div>
        </div>
        {!editingCrop ? (
          <p className='text-[10px] text-emerald-400 mt-3'>
            ✓ Income & investment will auto-sync to Cashflow & selected account
          </p>
        ) : (
          <p className='text-[10px] text-emerald-400 mt-3'>
            ✓ Updates will accurately reflect in connected Cashflow records.
          </p>
        )}
        <div className='flex justify-end gap-2 pt-4 mt-2 border-t border-slate-800'>
          <button
            onClick={() => setShowCropModal(false)}
            className='px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-sm font-bold'
          >
            Cancel
          </button>
          <button
            onClick={saveCrop}
            className='px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700'
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

function ExpensesTab() {
  const {
    cropCycles,
    agriExpenses,
    addAgriExpense,
    updateAgriExpense,
    deleteAgriExpense,
  } = useAgriStore();
  const { accounts, cashflows, addCashflow, updateCashflow, deleteCashflow } =
    usePortfolioStore();

  const [showModal, setShowModal] = useState(false);
  const [editingExp, setEditingExp] = useState<any>(null);

  const [eCrop, setECrop] = useState('');
  const [eCat, setECat] = useState<AgriExpenseCategory>('fertilizer');
  const [eAmount, setEAmount] = useState('0');
  const [eDate, setEDate] = useState(new Date().toISOString().split('T')[0]);
  const [eNotes, setENotes] = useState('');
  const [eAccount, setEAccount] = useState('');

  function resetForm(exp?: any) {
    setECrop(exp?.cropCycleId ?? '');
    setECat(exp?.category ?? 'fertilizer');
    setEAmount(String(exp?.amount ?? 0));
    setEDate(exp?.date ?? new Date().toISOString().split('T')[0]);
    setENotes(exp?.notes ?? '');
    setEAccount(exp?.accountId ?? '');
  }

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

  async function saveExpense() {
    const amount = parseFloat(eAmount);
    if (amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const cropName = cropCycles.find((c) => c.id === eCrop)?.cropName;
    const newCatLabel =
      EXPENSE_CATS.find((c) => c.value === eCat)?.label ?? eCat;

    const payload = {
      cropCycleId: eCrop,
      cropName,
      category: eCat,
      amount,
      date: eDate,
      notes: eNotes.trim() || undefined,
      accountId: eAccount || undefined,
    };

    if (editingExp) {
      await updateAgriExpense(editingExp.id, payload);

      const oldCatLabel =
        EXPENSE_CATS.find((c) => c.value === editingExp.category)?.label ??
        editingExp.category;

      await syncCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'expense',
        oldCatLabel,
        editingExp.amount,
        editingExp.date,
        newCatLabel,
        amount,
        eDate,
        eAccount,
        `Farm expense: ${newCatLabel}${cropName ? ` (${cropName})` : ''}`,
      );

      toast.success('Expense updated ✓');
    } else {
      await addAgriExpense(payload);
      await pushToCashflow(
        'expense',
        newCatLabel,
        amount,
        eDate,
        eAccount || undefined,
        `Farm expense: ${newCatLabel}${cropName ? ` (${cropName})` : ''}`,
        addCashflow,
      );
      toast.success('Expense added & synced to Cashflow ✓');
    }

    setShowModal(false);
    setEditingExp(null);
    resetForm();
  }

  async function handleDeleteExpense(e: any) {
    const catLabel =
      EXPENSE_CATS.find((c) => c.value === e.category)?.label ?? e.category;
    await removeLinkedCashflow('expense', catLabel, e.amount, e.date);
    await deleteAgriExpense(e.id);
    toast.success('Expense & linked cashflow deleted ✓');
  }

  const byCat = useMemo(() => {
    const map: Record<string, number> = {};
    agriExpenses.forEach((e) => {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [agriExpenses]);

  return (
    <div className='flex flex-col gap-6'>
      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <div className='text-sm font-bold text-slate-100'>
              💸 Agriculture Expenses
            </div>
            <div className='text-[10px] text-slate-500 mt-0.5'>
              Auto-synced to Cashflow & Bank Account
            </div>
          </div>
          <button
            onClick={() => {
              setEditingExp(null);
              resetForm();
              setShowModal(true);
            }}
            className='px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700'
          >
            + Add Expense
          </button>
        </div>

        {byCat.length > 0 && (
          <div className='flex flex-wrap gap-2 mb-4'>
            {byCat.map(([cat, amt]) => (
              <span
                key={cat}
                className='px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300'
              >
                {EXPENSE_CATS.find((c) => c.value === cat)?.label ?? cat}:{' '}
                <span className='text-red-400'>{formatINR(amt)}</span>
              </span>
            ))}
          </div>
        )}

        {agriExpenses.length === 0 ? (
          <p className='text-xs text-slate-500 text-center py-4'>
            No expenses logged yet.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='text-slate-500 border-b border-slate-800'>
                  {[
                    'Date',
                    'Crop',
                    'Category',
                    'Amount',
                    'Account',
                    'Notes',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className='px-3 py-2 text-left font-bold uppercase tracking-wider'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agriExpenses.map((e) => (
                  <tr
                    key={e.id}
                    className='border-b border-slate-800/50 hover:bg-slate-800/30'
                  >
                    <td className='px-3 py-2 text-slate-400'>{e.date}</td>
                    <td className='px-3 py-2 text-emerald-400'>
                      {e.cropName ??
                        cropCycles.find((c) => c.id === e.cropCycleId)
                          ?.cropName ??
                        '—'}
                    </td>
                    <td className='px-3 py-2'>
                      <span className='px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 capitalize'>
                        {EXPENSE_CATS.find((c) => c.value === e.category)
                          ?.label ?? e.category}
                      </span>
                    </td>
                    <td className='px-3 py-2 text-red-400 font-bold'>
                      {formatINR(e.amount)}
                    </td>
                    <td className='px-3 py-2 text-slate-400'>
                      {accounts.find((a) => a.id === e.accountId)?.name ?? '—'}
                    </td>
                    <td className='px-3 py-2 text-slate-500'>
                      {e.notes ?? '—'}
                    </td>
                    <td className='px-3 py-2'>
                      <button
                        onClick={() => {
                          setEditingExp(e);
                          resetForm(e);
                          setShowModal(true);
                        }}
                        className='px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 mr-1'
                      >
                        Edit
                      </button>
                      <DeleteBtn onDelete={() => handleDeleteExpense(e)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingExp(null);
        }}
        title={
          editingExp ? 'Edit Agriculture Expense' : 'Add Agriculture Expense'
        }
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Crop Cycle</label>
            <AgriDropdown
              value={eCrop}
              onChange={setECrop}
              options={[
                { value: '', label: '— General / No Crop —' },
                ...cropCycles.map((c) => ({
                  value: c.id,
                  label: `${c.cropName} (${c.fieldName ?? 'No field'})`,
                })),
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Category *</label>
            <AgriDropdown
              value={eCat}
              onChange={(v) => setECat(v as AgriExpenseCategory)}
              options={EXPENSE_CATS.map((c) => ({
                value: c.value,
                label: c.label,
              }))}
            />
          </div>
          <div>
            <label className={labelCls}>Amount (₹) *</label>
            <NumericInput
              className={inputCls}
              value={eAmount}
              onChange={setEAmount}
            />
          </div>
          <div>
            <label className={labelCls}>Date *</label>
            <input
              type='date'
              className={inputCls}
              value={eDate}
              onChange={(e) => setEDate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Paid From Account</label>
            <AgriDropdown
              value={eAccount}
              onChange={setEAccount}
              options={[
                { value: '', label: '— Cash —' },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <input
              className={inputCls}
              value={eNotes}
              onChange={(e) => setENotes(e.target.value)}
              placeholder='Optional'
            />
          </div>
        </div>
        {!editingExp ? (
          <p className='text-[10px] text-emerald-400 mt-3'>
            ✓ Will auto-sync to Cashflow & debit from selected account
          </p>
        ) : (
          <p className='text-[10px] text-emerald-400 mt-3'>
            ✓ Updates will accurately reflect in connected Cashflow records.
          </p>
        )}
        <div className='flex justify-end gap-2 pt-4 mt-2 border-t border-slate-800'>
          <button
            onClick={() => {
              setShowModal(false);
              setEditingExp(null);
            }}
            className='px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-sm font-bold'
          >
            Cancel
          </button>
          <button
            onClick={saveExpense}
            className='px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700'
          >
            {editingExp ? 'Update Expense' : 'Save Expense'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function LivestockTab() {
  const {
    livestockEvents,
    addLivestockEvent,
    updateLivestockEvent,
    deleteLivestockEvent,
  } = useAgriStore();
  const { accounts, cashflows, addCashflow, deleteCashflow } =
    usePortfolioStore();

  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LivestockEvent | null>(null);

  const [animalType, setAnimalType] = useState<LivestockType>('goat');
  const [eventType, setEventType] = useState<LivestockEventType>('purchase');
  const [evCount, setEvCount] = useState('1');
  const [evPrice, setEvPrice] = useState('0');
  const [evAccount, setEvAccount] = useState('');
  const [evDate, setEvDate] = useState(new Date().toISOString().split('T')[0]);
  const [evNotes, setEvNotes] = useState('');
  const [filterAnimal, setFilterAnimal] = useState<LivestockType | 'all'>(
    'all',
  );

  function resetForm(ev?: LivestockEvent) {
    setAnimalType(ev?.animalType ?? 'goat');
    setEventType(ev?.eventType ?? 'purchase');
    setEvCount(String(ev?.count ?? 1));
    setEvPrice(String(ev?.price ?? 0));
    setEvAccount(ev?.accountId ?? '');
    setEvDate(ev?.date ?? new Date().toISOString().split('T')[0]);
    setEvNotes(ev?.notes ?? '');
  }

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

  function calcCount(type: LivestockType) {
    return livestockEvents
      .filter((e) => e.animalType === type)
      .reduce((total, e) => {
        if (
          e.eventType === 'purchase' ||
          e.eventType === 'birth' ||
          e.eventType === 'existing'
        )
          return total + e.count;
        if (e.eventType === 'sale' || e.eventType === 'death')
          return total - e.count;
        return total;
      }, 0);
  }

  const goatCount = calcCount('goat');
  const cowCount = calcCount('cow');
  const buffaloCount = calcCount('buffalo');
  const sheepCount = calcCount('sheep');
  const poultryCount = calcCount('poultry');

  const animalCounts: Record<LivestockType, number> = {
    goat: goatCount,
    cow: cowCount,
    buffalo: buffaloCount,
    sheep: sheepCount,
    poultry: poultryCount,
    other: calcCount('other'),
  };

  const totalSaleIncome = livestockEvents
    .filter((e) => e.eventType === 'sale')
    .reduce((s, e) => s + (e.price ?? 0), 0);
  const totalPurchaseCost = livestockEvents
    .filter((e) => e.eventType === 'purchase')
    .reduce((s, e) => s + (e.price ?? 0), 0);

  async function save() {
    const count = parseInt(evCount) || 1;
    const price = parseFloat(evPrice) || 0;

    if (count <= 0) {
      toast.error('Count must be at least 1');
      return;
    }

    if (!editingEvent && (eventType === 'sale' || eventType === 'death')) {
      const current = calcCount(animalType);
      if (count > current) {
        toast.error(
          `Only ${current} ${animalType}(s) available. Cannot ${eventType} ${count}.`,
        );
        return;
      }
    }

    const payload = {
      animalType,
      eventType,
      count,
      price: price > 0 ? price : undefined,
      accountId: evAccount || undefined,
      notes: evNotes.trim() || undefined,
      date: evDate,
    };

    if (editingEvent) {
      await updateLivestockEvent(editingEvent.id, payload);

      // Because Event Type can swap from Income to Expense, removing the old one and re-adding is safer.
      if (
        editingEvent.price &&
        editingEvent.price > 0 &&
        (editingEvent.eventType === 'purchase' ||
          editingEvent.eventType === 'sale')
      ) {
        const oldType =
          editingEvent.eventType === 'purchase' ? 'expense' : 'income';
        const oldCat =
          editingEvent.eventType === 'purchase'
            ? 'Livestock Purchase'
            : 'Livestock Sale';
        await removeLinkedCashflow(
          oldType,
          oldCat,
          editingEvent.price,
          editingEvent.date,
        );
      }

      // Add the new valid one
      if (eventType === 'purchase' && price > 0) {
        await addCashflow({
          type: 'expense',
          category: 'Livestock Purchase',
          amount: price,
          date: evDate,
          notes: `Bought ${count} ${animalType}(s)${evNotes ? ' – ' + evNotes : ''}`,
          accountId: evAccount || undefined,
        });
      } else if (eventType === 'sale' && price > 0) {
        await addCashflow({
          type: 'income',
          category: 'Livestock Sale',
          amount: price,
          date: evDate,
          notes: `Sold ${count} ${animalType}(s)${evNotes ? ' – ' + evNotes : ''}`,
          accountId: evAccount || undefined,
        });
      }

      toast.success('Event updated ✓');
    } else {
      await addLivestockEvent(payload);
      if (eventType === 'purchase' && price > 0) {
        await addCashflow({
          type: 'expense',
          category: 'Livestock Purchase',
          amount: price,
          date: evDate,
          notes: `Bought ${count} ${animalType}(s)${evNotes ? ' – ' + evNotes : ''}`,
          accountId: evAccount || undefined,
        });
      } else if (eventType === 'sale' && price > 0) {
        await addCashflow({
          type: 'income',
          category: 'Livestock Sale',
          amount: price,
          date: evDate,
          notes: `Sold ${count} ${animalType}(s)${evNotes ? ' – ' + evNotes : ''}`,
          accountId: evAccount || undefined,
        });
      }
      toast.success(
        `${eventType.charAt(0).toUpperCase() + eventType.slice(1)} recorded!`,
      );
    }

    setShowModal(false);
    setEditingEvent(null);
    resetForm();
  }

  async function handleDeleteEvent(ev: LivestockEvent) {
    if (ev.price && ev.price > 0) {
      if (ev.eventType === 'purchase')
        await removeLinkedCashflow(
          'expense',
          'Livestock Purchase',
          ev.price,
          ev.date,
        );
      else if (ev.eventType === 'sale')
        await removeLinkedCashflow(
          'income',
          'Livestock Sale',
          ev.price,
          ev.date,
        );
    }
    await deleteLivestockEvent(ev.id);
    toast.success('Event & linked cashflow deleted ✓');
  }

  const EVENT_LABELS: Record<
    LivestockEventType,
    { label: string; emoji: string; color: string }
  > = {
    existing: { label: 'Already Present', emoji: '📥', color: '#8b5cf6' },
    purchase: { label: 'Purchase', emoji: '🛒', color: '#f59e0b' },
    birth: { label: 'Birth', emoji: '🍼', color: '#22c55e' },
    sale: { label: 'Sale', emoji: '💰', color: '#3b82f6' },
    death: { label: 'Death', emoji: '💀', color: '#ef4444' },
  };

  const filteredEvents =
    filterAnimal === 'all'
      ? livestockEvents
      : livestockEvents.filter((e) => e.animalType === filterAnimal);

  const populationData = useMemo(() => {
    const types: LivestockType[] = [
      'goat',
      'cow',
      'buffalo',
      'sheep',
      'poultry',
    ];
    return types
      .map((t) => ({
        name: LIVESTOCK_TYPES.find((x) => x.value === t)?.emoji + ' ' + t,
        count: calcCount(t),
      }))
      .filter((d) => d.count > 0);
  }, [livestockEvents]);

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <SummaryCard
          icon='🐐'
          label='Goats'
          value={String(goatCount)}
          sub='current count'
          color='#f59e0b'
        />
        <SummaryCard
          icon='🐄'
          label='Cows'
          value={String(cowCount)}
          sub='current count'
          color='#22c55e'
        />
        <SummaryCard
          icon='💰'
          label='Sale Income'
          value={formatINR(totalSaleIncome)}
          sub='from all sales'
          color='#3b82f6'
        />
        <SummaryCard
          icon='🛒'
          label='Purchase Cost'
          value={formatINR(totalPurchaseCost)}
          sub='total spent'
          color='#a78bfa'
        />
      </div>

      {Object.entries(animalCounts).some(([, v]) => v > 0) && (
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
          <div className='text-xs font-bold uppercase tracking-wider text-slate-400 mb-3'>
            🐾 Current Animal Population
          </div>
          <div className='flex flex-wrap gap-3'>
            {LIVESTOCK_TYPES.map((t) => {
              const count = animalCounts[t.value];
              if (count <= 0) return null;
              return (
                <div
                  key={t.value}
                  className='flex items-center gap-2 bg-slate-800 rounded-xl px-4 py-2'
                >
                  <span className='text-2xl'>{t.emoji}</span>
                  <div>
                    <div className='text-xs text-slate-400'>{t.label}</div>
                    <div className='text-lg font-bold text-slate-100 font-mono'>
                      {count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {populationData.length > 0 && (
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
          <div className='text-xs font-bold uppercase tracking-wider text-slate-400 mb-3'>
            📊 Population Chart
          </div>
          <ResponsiveContainer width='100%' height={180}>
            <BarChart
              data={populationData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
              <XAxis dataKey='name' tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#22c55e' }}
              />
              <Bar dataKey='count' fill='#22c55e' radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Event History */}
      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
        <div className='flex items-center justify-between mb-4 flex-wrap gap-2'>
          <div>
            <div className='text-sm font-bold text-slate-100'>
              📋 Event History
            </div>
            <div className='text-xs text-slate-400 mt-0.5'>
              {filteredEvents.length} events
            </div>
          </div>
          <div className='flex gap-2 flex-wrap'>
            <AgriDropdown
              value={filterAnimal}
              onChange={(v) => setFilterAnimal(v as LivestockType | 'all')}
              options={[
                { value: 'all', label: 'All Animals' },
                ...LIVESTOCK_TYPES.map((t) => ({
                  value: t.value,
                  label: t.label,
                  emoji: t.emoji,
                })),
              ]}
            />
            <button
              onClick={() => {
                resetForm();
                setEditingEvent(null);
                setShowModal(true);
              }}
              className='px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700'
            >
              + Add Event
            </button>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <p className='text-xs text-slate-500 text-center py-6'>
            No events recorded yet. Add a purchase or birth to get started.
          </p>
        ) : (
          <div className='flex flex-col gap-2'>
            {filteredEvents.map((ev) => {
              const meta = LIVESTOCK_TYPES.find(
                (t) => t.value === ev.animalType,
              );
              const evMeta = EVENT_LABELS[ev.eventType];
              const isIncome = ev.eventType === 'sale';
              const isExpense = ev.eventType === 'purchase';
              return (
                <div
                  key={ev.id}
                  className='flex items-center gap-3 rounded-xl bg-slate-800 px-4 py-3'
                  style={{ borderLeft: `3px solid ${evMeta.color}` }}
                >
                  <div className='text-xl'>{meta?.emoji}</div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <span
                        className='text-xs font-bold px-2 py-0.5 rounded-full'
                        style={{
                          background: evMeta.color + '22',
                          color: evMeta.color,
                        }}
                      >
                        {evMeta.emoji} {evMeta.label}
                      </span>
                      <span className='text-sm font-bold text-slate-100'>
                        {ev.count} {meta?.label}
                        {ev.eventType === 'purchase' ||
                        ev.eventType === 'birth' ||
                        ev.eventType === 'existing' ? (
                          <span className='text-emerald-400 ml-1'>
                            +{ev.count}
                          </span>
                        ) : (
                          <span className='text-red-400 ml-1'>-{ev.count}</span>
                        )}
                      </span>
                    </div>
                    <div className='flex items-center gap-3 mt-1 flex-wrap'>
                      <span className='text-xs text-slate-500'>{ev.date}</span>
                      {ev.price !== undefined && ev.price > 0 && (
                        <span
                          className={`text-xs font-bold ${isIncome ? 'text-emerald-400' : isExpense ? 'text-red-400' : 'text-slate-400'}`}
                        >
                          {isIncome ? '+' : isExpense ? '-' : ''}
                          {formatINR(ev.price)}
                        </span>
                      )}
                      {ev.accountId && (
                        <span className='text-xs text-slate-500'>
                          🏦{' '}
                          {accounts.find((a) => a.id === ev.accountId)?.name ??
                            ev.accountId}
                        </span>
                      )}
                      {ev.notes && (
                        <span className='text-xs text-slate-500 italic'>
                          {ev.notes}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingEvent(ev);
                      resetForm(ev);
                      setShowModal(true);
                    }}
                    className='px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 mr-1'
                  >
                    Edit
                  </button>
                  <DeleteBtn onDelete={() => handleDeleteEvent(ev)} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingEvent(null);
        }}
        title={editingEvent ? 'Edit Livestock Event' : 'Add Livestock Event'}
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Animal Type</label>
            <AgriDropdown
              value={animalType}
              onChange={(v) => setAnimalType(v as LivestockType)}
              options={LIVESTOCK_TYPES.map((t) => ({
                value: t.value,
                label: t.label,
                emoji: t.emoji,
              }))}
            />
          </div>
          <div>
            <label className={labelCls}>Event Type</label>
            <AgriDropdown
              value={eventType}
              onChange={(v) => setEventType(v as LivestockEventType)}
              options={[
                { value: 'existing', label: 'Already Present', emoji: '📥' },
                { value: 'purchase', label: 'Purchase (Buy)', emoji: '🛒' },
                { value: 'birth', label: 'Birth', emoji: '🍼' },
                { value: 'sale', label: 'Sale (Sell)', emoji: '💰' },
                { value: 'death', label: 'Death', emoji: '💀' },
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Count</label>
            <NumericInput
              className={inputCls}
              value={evCount}
              onChange={setEvCount}
              allowDecimal={false}
            />
            {(eventType === 'sale' || eventType === 'death') && (
              <div className='text-xs text-amber-400 mt-1'>
                Current {animalType} count: {animalCounts[animalType]}
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>
              {eventType === 'purchase'
                ? 'Purchase Price (₹ total)'
                : eventType === 'sale'
                  ? 'Sale Price (₹ total)'
                  : eventType === 'existing'
                    ? 'Estimated Value (optional)'
                    : 'Price (optional)'}
            </label>
            <NumericInput
              className={inputCls}
              value={evPrice}
              onChange={setEvPrice}
            />
            {(eventType === 'birth' ||
              eventType === 'death' ||
              eventType === 'existing') && (
              <div className='text-xs text-slate-500 mt-1'>
                No cash flow for{' '}
                {eventType === 'existing'
                  ? 'already present animals'
                  : 'birth/death'}
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input
              type='date'
              className={inputCls}
              value={evDate}
              onChange={(e) => setEvDate(e.target.value)}
            />
          </div>
          {(eventType === 'purchase' || eventType === 'sale') && (
            <div>
              <label className={labelCls}>Bank Account / Cash</label>
              <AgriDropdown
                value={evAccount}
                onChange={setEvAccount}
                options={[
                  { value: '', label: '— Cash —' },
                  ...accounts.map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
            </div>
          )}
          <div className='sm:col-span-2'>
            <label className={labelCls}>Notes (Optional)</label>
            <input
              className={inputCls}
              value={evNotes}
              onChange={(e) => setEvNotes(e.target.value)}
              placeholder='e.g. Sold to neighbour, Born twins...'
            />
          </div>
        </div>
        {!editingEvent && (eventType === 'purchase' || eventType === 'sale') ? (
          <p className='text-[10px] text-emerald-400 mt-3'>
            ✓ Cashflow will be automatically recorded to the selected account.
          </p>
        ) : editingEvent &&
          (eventType === 'purchase' || eventType === 'sale') ? (
          <p className='text-[10px] text-emerald-400 mt-3'>
            ✓ Updates will accurately reflect in connected Cashflow records.
          </p>
        ) : null}
        <div className='flex justify-end gap-2 pt-4 mt-2 border-t border-slate-800'>
          <button
            onClick={() => {
              setShowModal(false);
              setEditingEvent(null);
            }}
            className='px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-sm font-bold'
          >
            Cancel
          </button>
          <button
            onClick={save}
            className='px-5 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700'
          >
            {editingEvent ? 'Update Event' : 'Save Event'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Milk Tab ─────────────────────────────────────────────────────────────────

function MilkTab() {
  const { milkRecords, addMilkRecord, updateMilkRecord, deleteMilkRecord } =
    useAgriStore();
  const { accounts, cashflows, addCashflow, updateCashflow, deleteCashflow } =
    usePortfolioStore();

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MilkRecord | null>(null);

  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]);
  const [mLiters, setMLiters] = useState('0');
  const [mPrice, setMPrice] = useState('0');
  const [mSoldTo, setMSoldTo] = useState('');
  const [mAccount, setMAccount] = useState('');

  function resetForm(m?: MilkRecord) {
    setMDate(m?.date ?? new Date().toISOString().split('T')[0]);
    setMLiters(String(m?.liters ?? 0));
    setMPrice(String(m?.pricePerLiter ?? 0));
    setMSoldTo(m?.soldTo ?? '');
    setMAccount(m?.accountId ?? '');
  }

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

  async function save() {
    const liters = parseFloat(mLiters);
    const price = parseFloat(mPrice);
    if (liters <= 0 || price <= 0) {
      toast.error('Enter valid liters and price');
      return;
    }
    const income = liters * price;

    if (editingRecord) {
      await updateMilkRecord(editingRecord.id, {
        date: mDate,
        liters,
        pricePerLiter: price,
        soldTo: mSoldTo.trim() || undefined,
        accountId: mAccount || undefined,
      });

      const oldIncome = editingRecord.liters * editingRecord.pricePerLiter;
      await syncCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'income',
        'Milk Sale',
        oldIncome,
        editingRecord.date,
        'Milk Sale',
        income,
        mDate,
        mAccount,
        `Milk sale: ${liters}L @ ₹${price}/L${mSoldTo ? ` to ${mSoldTo}` : ''}`,
      );

      toast.success('Milk record updated ✓');
    } else {
      await addMilkRecord({
        date: mDate,
        liters,
        pricePerLiter: price,
        soldTo: mSoldTo.trim() || undefined,
        accountId: mAccount || undefined,
      });
      await pushToCashflow(
        'income',
        'Milk Sale',
        income,
        mDate,
        mAccount || undefined,
        `Milk sale: ${liters}L @ ₹${price}/L${mSoldTo ? ` to ${mSoldTo}` : ''}`,
        addCashflow,
      );
      toast.success(
        `Milk record added · ${formatINR(income)} synced to Cashflow ✓`,
      );
    }

    setShowModal(false);
    setEditingRecord(null);
    resetForm();
  }

  async function handleDelete(m: MilkRecord) {
    const income = m.liters * m.pricePerLiter;
    await removeLinkedCashflow('income', 'Milk Sale', income, m.date);
    await deleteMilkRecord(m.id);
    toast.success('Record & linked cashflow deleted ✓');
  }

  const totalLiters = milkRecords.reduce((s, m) => s + m.liters, 0);
  const totalIncome = milkRecords.reduce(
    (s, m) => s + m.liters * m.pricePerLiter,
    0,
  );
  const last30 = milkRecords.slice(0, 30).reverse();

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
        <SummaryCard
          icon='🥛'
          label='Total Liters'
          value={`${formatNumber(totalLiters, 1)} L`}
          color='#14b8a6'
        />
        <SummaryCard
          icon='💰'
          label='Milk Income'
          value={formatINR(totalIncome)}
          color='#22c55e'
        />
        <SummaryCard
          icon='📅'
          label='Records'
          value={String(milkRecords.length)}
          color='#64748b'
          sub={
            milkRecords.length > 0
              ? `Avg ${formatNumber(totalLiters / milkRecords.length, 1)} L/day`
              : undefined
          }
        />
      </div>

      {last30.length > 0 && (
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
          <div className='text-sm font-bold text-slate-100 mb-4'>
            🥛 Daily Production (Last 30 Days)
          </div>
          <ResponsiveContainer width='100%' height={180}>
            <BarChart data={last30}>
              <XAxis
                dataKey='date'
                tick={{ fill: '#94a3b8', fontSize: 9 }}
                tickFormatter={(d) => d.slice(5)}
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} unit='L' />
              <Tooltip
                formatter={(v) => [`${Number(v)} L`, 'Milk']}
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                }}
              />
              <Bar dataKey='liters' fill='#14b8a6' radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <div className='text-sm font-bold text-slate-100'>
              📋 Milk Records
            </div>
            <div className='text-[10px] text-slate-500 mt-0.5'>
              Auto-synced to Cashflow & Bank Account
            </div>
          </div>
          <button
            onClick={() => {
              setEditingRecord(null);
              resetForm();
              setShowModal(true);
            }}
            className='px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700'
          >
            + Add Record
          </button>
        </div>
        {milkRecords.length === 0 ? (
          <p className='text-xs text-slate-500 text-center py-4'>
            No milk records yet.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='text-slate-500 border-b border-slate-800'>
                  {[
                    'Date',
                    'Liters',
                    'Price/L',
                    'Income',
                    'Sold To',
                    'Account',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className='px-3 py-2 text-left font-bold uppercase tracking-wider'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {milkRecords.map((m) => (
                  <tr
                    key={m.id}
                    className='border-b border-slate-800/50 hover:bg-slate-800/30'
                  >
                    <td className='px-3 py-2 text-slate-300'>{m.date}</td>
                    <td className='px-3 py-2 text-teal-400 font-bold'>
                      {m.liters} L
                    </td>
                    <td className='px-3 py-2 text-slate-400'>
                      ₹{m.pricePerLiter}/L
                    </td>
                    <td className='px-3 py-2 text-green-400 font-bold'>
                      {formatINR(m.liters * m.pricePerLiter)}
                    </td>
                    <td className='px-3 py-2 text-slate-400'>
                      {m.soldTo ?? '—'}
                    </td>
                    <td className='px-3 py-2 text-slate-400'>
                      {accounts.find((a) => a.id === m.accountId)?.name ?? '—'}
                    </td>
                    <td className='px-3 py-2'>
                      <button
                        onClick={() => {
                          setEditingRecord(m);
                          resetForm(m);
                          setShowModal(true);
                        }}
                        className='px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600 mr-1'
                      >
                        Edit
                      </button>
                      <DeleteBtn onDelete={() => handleDelete(m)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingRecord(null);
        }}
        title={editingRecord ? 'Edit Milk Record' : 'Add Milk Record'}
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Date</label>
            <input
              type='date'
              className={inputCls}
              value={mDate}
              onChange={(e) => setMDate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Liters *</label>
            <NumericInput
              className={inputCls}
              value={mLiters}
              onChange={setMLiters}
            />
          </div>
          <div>
            <label className={labelCls}>Price per Liter (₹) *</label>
            <NumericInput
              className={inputCls}
              value={mPrice}
              onChange={setMPrice}
            />
          </div>
          <div>
            <label className={labelCls}>Sold To</label>
            <input
              className={inputCls}
              value={mSoldTo}
              onChange={(e) => setMSoldTo(e.target.value)}
              placeholder='e.g. Aavin, Local'
            />
          </div>
          <div>
            <label className={labelCls}>Income to Account</label>
            <AgriDropdown
              value={mAccount}
              onChange={setMAccount}
              options={[
                { value: '', label: '— Cash —' },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </div>
        </div>
        {!editingRecord ? (
          <p className='text-[10px] text-emerald-400 mt-3'>
            ✓ Income will auto-sync to Cashflow & credit to selected account
          </p>
        ) : (
          <p className='text-[10px] text-emerald-400 mt-3'>
            ✓ Updates will accurately reflect in connected Cashflow records.
          </p>
        )}
        <div className='flex justify-end gap-2 pt-4 mt-2 border-t border-slate-800'>
          <button
            onClick={() => {
              setShowModal(false);
              setEditingRecord(null);
            }}
            className='px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-sm font-bold'
          >
            Cancel
          </button>
          <button
            onClick={save}
            className='px-5 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700'
          >
            {editingRecord ? 'Update' : 'Save'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Coconut Tab ──────────────────────────────────────────────────────────────

function CoconutTab() {
  const {
    coconutRecords,
    addCoconutRecord,
    updateCoconutRecord,
    deleteCoconutRecord,
  } = useAgriStore();
  const { accounts, cashflows, addCashflow, updateCashflow, deleteCashflow } =
    usePortfolioStore();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CoconutRecord | null>(null);

  // ── Form fields ────────────────────────────────────────────────────────────
  const [cDate, setCDate] = useState(new Date().toISOString().split('T')[0]);
  const [cTrees, setCTrees] = useState('0');
  const [cTotalNuts, setCTotalNuts] = useState('0');
  const [cPrice, setCPrice] = useState('0');
  const [cInvest, setCInvest] = useState('0');
  const [cDuration, setCDuration] = useState('3');
  const [cNotes, setCNotes] = useState('');
  const [cAccount, setCAccount] = useState('');
  const [sellMethod, setSellMethod] = useState<CoconutSellMethod>('by_count');
  const [cTotalTons, setCTotalTons] = useState('');
  const [cPricePerTon, setCPricePerTon] = useState('0');

  // ── Live calculations ──────────────────────────────────────────────────────
  const trees = parseInt(cTrees) || 0;
  const totalNuts = parseInt(cTotalNuts) || 0;
  const price = parseFloat(cPrice) || 0;
  const invest = parseFloat(cInvest) || 0;
  const totalTons = parseFloat(cTotalTons) || 0;
  const pPerTon = parseFloat(cPricePerTon) || 0;

  const estimatedIncome =
    sellMethod === 'by_count' ? totalNuts * price : totalTons * pPerTon;
  const estimatedProfit = estimatedIncome - invest;

  function resetForm(r?: CoconutRecord) {
    setCDate(r?.date ?? new Date().toISOString().split('T')[0]);
    setCTrees(String(r?.numberOfTrees ?? 0));
    setCTotalNuts(String(r?.totalCoconuts ?? 0));
    setCPrice(String(r?.pricePerCoconut ?? 0));
    setCInvest(String(r?.investmentAmount ?? 0));
    setCDuration(String(r?.durationMonths ?? 3));
    setCNotes(r?.notes ?? '');
    setCAccount(r?.accountId ?? '');
    setSellMethod(r?.sellMethod ?? 'by_count');
    setCTotalTons(r?.totalTons !== undefined ? String(r.totalTons) : '');
    setCPricePerTon(String(r?.pricePerTon ?? 0));
  }

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

  async function save() {
    if (sellMethod === 'by_count') {
      if (totalNuts <= 0) {
        toast.error('Enter total number of coconuts');
        return;
      }
      if (price <= 0) {
        toast.error('Enter price per coconut');
        return;
      }
    } else {
      if (totalTons <= 0) {
        toast.error('Enter total tons');
        return;
      }
      if (pPerTon <= 0) {
        toast.error('Enter price per ton');
        return;
      }
    }

    const record: Omit<
      CoconutRecord,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    > = {
      date: cDate,
      numberOfTrees: trees,
      totalCoconuts: sellMethod === 'by_count' ? totalNuts : 0,
      sellMethod,
      pricePerCoconut: sellMethod === 'by_count' ? price : undefined,
      totalTons: sellMethod === 'by_ton' ? totalTons : undefined,
      pricePerTon: sellMethod === 'by_ton' ? pPerTon : undefined,
      harvestIncome: estimatedIncome,
      investmentAmount: invest,
      durationMonths: parseInt(cDuration) || 3,
      notes: cNotes.trim() || undefined,
      accountId: cAccount || undefined,
    };

    const incNote =
      sellMethod === 'by_count'
        ? `Coconut harvest: ${totalNuts} coconuts × ₹${price}/pc`
        : `Coconut harvest: ${totalTons.toFixed(3)} tons × ₹${pPerTon.toLocaleString('en-IN')}/ton`;

    if (editing) {
      await updateCoconutRecord(editing.id, record);

      await syncCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'income',
        'Coconut Sale',
        editing.harvestIncome,
        editing.date,
        'Coconut Sale',
        estimatedIncome,
        cDate,
        cAccount,
        incNote,
      );

      await syncCashflow(
        cashflows,
        addCashflow,
        updateCashflow,
        deleteCashflow,
        'expense',
        'Coconut Farm Expense',
        editing.investmentAmount,
        editing.date,
        'Coconut Farm Expense',
        invest,
        cDate,
        cAccount,
        'Coconut farm investment',
      );

      toast.success(`Harvest & Cashflow updated ✓`);
    } else {
      await addCoconutRecord(record);
      if (estimatedIncome > 0) {
        await pushToCashflow(
          'income',
          'Coconut Sale',
          estimatedIncome,
          cDate,
          cAccount || undefined,
          incNote,
          addCashflow,
        );
      }
      if (invest > 0) {
        await pushToCashflow(
          'expense',
          'Coconut Farm Expense',
          invest,
          cDate,
          cAccount || undefined,
          'Coconut farm investment',
          addCashflow,
        );
      }
      toast.success(
        `Harvest recorded · ${formatINR(estimatedIncome)} synced to Cashflow ✓`,
      );
    }
    setShowModal(false);
    setEditing(null);
    resetForm();
  }

  async function handleDelete(c: CoconutRecord) {
    if (c.harvestIncome > 0)
      await removeLinkedCashflow(
        'income',
        'Coconut Sale',
        c.harvestIncome,
        c.date,
      );
    if (c.investmentAmount > 0)
      await removeLinkedCashflow(
        'expense',
        'Coconut Farm Expense',
        c.investmentAmount,
        c.date,
      );
    await deleteCoconutRecord(c.id);
    toast.success('Harvest & linked cashflow deleted ✓');
  }

  const totalTrees =
    coconutRecords.length > 0 ? coconutRecords[0].numberOfTrees : 0;
  const totalIncome = coconutRecords.reduce((s, c) => s + c.harvestIncome, 0);
  const totalCoconutsAll = coconutRecords.reduce(
    (s, c) => s + c.totalCoconuts,
    0,
  );
  const totalInvestAll = coconutRecords.reduce(
    (s, c) => s + c.investmentAmount,
    0,
  );

  const chartData = coconutRecords
    .slice()
    .reverse()
    .map((c) => ({
      date: c.date,
      coconuts: c.totalCoconuts || c.totalTons || 0,
      income: c.harvestIncome,
      profit: c.harvestIncome - c.investmentAmount,
    }));

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <SummaryCard
          icon='🌴'
          label='Trees'
          value={String(totalTrees)}
          color='#f59e0b'
          sub='last harvest'
        />
        <SummaryCard
          icon='🥥'
          label='Total Coconuts'
          value={formatNumber(totalCoconutsAll, 0)}
          color='#f59e0b'
          sub='from count harvests'
        />
        <SummaryCard
          icon='💰'
          label='Total Income'
          value={formatINR(totalIncome)}
          color='#22c55e'
        />
        <SummaryCard
          icon='📈'
          label='Net Profit'
          value={formatINR(totalIncome - totalInvestAll)}
          color={totalIncome - totalInvestAll >= 0 ? '#22c55e' : '#ef4444'}
        />
      </div>

      {chartData.length > 0 && (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
            <div className='text-sm font-bold text-slate-100 mb-4'>
              🥥 Volume per Harvest
            </div>
            <ResponsiveContainer width='100%' height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
                <XAxis
                  dataKey='date'
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  tickFormatter={(d) => d.slice(5)}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey='coconuts'
                  name='Count / Tons'
                  fill='#f59e0b'
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
            <div className='text-sm font-bold text-slate-100 mb-4'>
              💰 Income vs Profit per Harvest
            </div>
            <ResponsiveContainer width='100%' height={180}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
                <XAxis
                  dataKey='date'
                  tick={{ fill: '#94a3b8', fontSize: 9 }}
                  tickFormatter={(d) => d.slice(5)}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v) => formatINR(Number(v))}
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar
                  dataKey='income'
                  name='Income'
                  fill='#22c55e'
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey='profit'
                  name='Profit'
                  fill='#3b82f6'
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <div className='text-sm font-bold text-slate-100'>
              🌴 Coconut Harvests
            </div>
            <div className='text-[10px] text-slate-500 mt-0.5'>
              Income auto-synced to Cashflow &amp; Bank Account
            </div>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              resetForm();
              setShowModal(true);
            }}
            className='px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700'
          >
            + Add Harvest
          </button>
        </div>

        {coconutRecords.length === 0 ? (
          <p className='text-xs text-slate-500 text-center py-6'>
            No coconut harvests recorded yet.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='text-slate-500 border-b border-slate-800'>
                  {[
                    'Date',
                    'Trees',
                    'Volume',
                    'Method',
                    'Price',
                    'Income',
                    'Investment',
                    'Profit',
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
                {coconutRecords.map((c) => {
                  const profit = c.harvestIncome - c.investmentAmount;
                  const isByTon = c.sellMethod === 'by_ton';
                  return (
                    <tr
                      key={c.id}
                      className='border-b border-slate-800/50 hover:bg-slate-800/30'
                    >
                      <td className='px-3 py-2 text-slate-300 whitespace-nowrap'>
                        {c.date}
                      </td>
                      <td className='px-3 py-2 text-amber-400 font-bold'>
                        {c.numberOfTrees} 🌴
                      </td>
                      <td className='px-3 py-2 text-slate-100 font-bold'>
                        {isByTon
                          ? `${c.totalTons?.toFixed(2)} T`
                          : c.totalCoconuts.toLocaleString('en-IN')}
                      </td>
                      <td className='px-3 py-2'>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isByTon ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}
                        >
                          {isByTon ? '⚖️ Ton' : '🥥 Count'}
                        </span>
                      </td>
                      <td className='px-3 py-2 text-slate-400 whitespace-nowrap'>
                        {isByTon
                          ? `₹${(c.pricePerTon ?? 0).toLocaleString('en-IN')}`
                          : `₹${c.pricePerCoconut ?? 0}`}
                      </td>
                      <td className='px-3 py-2 text-green-400 font-bold'>
                        {formatINR(c.harvestIncome)}
                      </td>
                      <td className='px-3 py-2 text-red-400'>
                        {formatINR(c.investmentAmount)}
                      </td>
                      <td
                        className='px-3 py-2 font-bold'
                        style={{ color: profit >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {formatINR(profit)}
                      </td>
                      <td className='px-3 py-2 text-slate-400'>
                        {accounts.find((a) => a.id === c.accountId)?.name ??
                          '—'}
                      </td>
                      <td className='px-3 py-2'>
                        <div className='flex gap-1'>
                          <button
                            onClick={() => {
                              setEditing(c);
                              resetForm(c);
                              setShowModal(true);
                            }}
                            className='px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600'
                          >
                            Edit
                          </button>
                          <DeleteBtn onDelete={() => handleDelete(c)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
        }}
        title={editing ? '✏️ Edit Coconut Harvest' : '+ Add Coconut Harvest'}
      >
        <div className='flex flex-col gap-4'>
          <div>
            <label className={labelCls}>Selling Method</label>
            <div className='flex gap-2 mt-1'>
              <button
                type='button'
                onClick={() => setSellMethod('by_count')}
                className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${
                  sellMethod === 'by_count'
                    ? 'bg-amber-600 border-amber-600 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                🥥 By Count
                <div className='font-normal opacity-75 mt-0.5'>
                  coconuts × ₹/piece
                </div>
              </button>
              <button
                type='button'
                onClick={() => setSellMethod('by_ton')}
                className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-colors ${
                  sellMethod === 'by_ton'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                ⚖️ By Ton
                <div className='font-normal opacity-75 mt-0.5'>
                  tons × ₹/ton
                </div>
              </button>
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className={labelCls}>Harvest Date *</label>
              <input
                type='date'
                className={inputCls}
                value={cDate}
                onChange={(e) => setCDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Harvest Duration (months)</label>
              <NumericInput
                className={inputCls}
                value={cDuration}
                onChange={setCDuration}
                allowDecimal={false}
              />
            </div>
            <div>
              <label className={labelCls}>Number of Trees</label>
              <NumericInput
                className={inputCls}
                value={cTrees}
                onChange={setCTrees}
                allowDecimal={false}
              />
            </div>

            {sellMethod === 'by_count' ? (
              <>
                <div>
                  <label className={labelCls}>Total Coconuts *</label>
                  <NumericInput
                    className={inputCls}
                    value={cTotalNuts}
                    onChange={setCTotalNuts}
                    allowDecimal={false}
                  />
                </div>
                <div className='sm:col-span-2'>
                  <label className={labelCls}>Price per Coconut (₹) *</label>
                  <NumericInput
                    className={inputCls}
                    value={cPrice}
                    onChange={setCPrice}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelCls}>Total Tons *</label>
                  <NumericInput
                    className={inputCls}
                    value={cTotalTons}
                    onChange={setCTotalTons}
                  />
                </div>
                <div className='sm:col-span-2'>
                  <label className={labelCls}>Price per Ton (₹) *</label>
                  <NumericInput
                    className={inputCls}
                    value={cPricePerTon}
                    onChange={setCPricePerTon}
                  />
                </div>
              </>
            )}

            <div>
              <label className={labelCls}>Investment / Cost (₹)</label>
              <NumericInput
                className={inputCls}
                value={cInvest}
                onChange={setCInvest}
              />
            </div>
            <div>
              <label className={labelCls}>Income to Account</label>
              <AgriDropdown
                value={cAccount}
                onChange={setCAccount}
                options={[
                  { value: '', label: '— Cash —' },
                  ...accounts.map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
            </div>
            <div className='sm:col-span-2'>
              <label className={labelCls}>Notes</label>
              <input
                className={inputCls}
                value={cNotes}
                onChange={(e) => setCNotes(e.target.value)}
                placeholder='Optional'
              />
            </div>
          </div>

          {estimatedIncome > 0 && (
            <div
              className='rounded-xl border border-amber-500/20 p-4'
              style={{ background: 'rgba(245,158,11,0.05)' }}
            >
              <div className='text-xs font-bold uppercase tracking-wider text-amber-400 mb-3'>
                📊 Calculation Preview
              </div>
              <div className='space-y-1 text-xs font-mono text-slate-300'>
                {sellMethod === 'by_count' ? (
                  <div className='flex justify-between'>
                    <span className='text-slate-500'>
                      {totalNuts.toLocaleString('en-IN')} coconuts × ₹{price}
                    </span>
                    <strong className='text-green-400'>
                      {formatINR(estimatedIncome)}
                    </strong>
                  </div>
                ) : (
                  <div className='flex justify-between'>
                    <span className='text-slate-500'>
                      {totalTons.toFixed(3)} tons × ₹
                      {pPerTon.toLocaleString('en-IN')}
                    </span>
                    <strong className='text-green-400'>
                      {formatINR(estimatedIncome)}
                    </strong>
                  </div>
                )}
              </div>
              <div className='mt-3 pt-3 border-t border-slate-700/60 grid grid-cols-3 gap-2 text-center'>
                <div>
                  <div className='text-[10px] text-slate-500 uppercase'>
                    {sellMethod === 'by_ton' ? 'Tons' : 'Coconuts'}
                  </div>
                  <div className='text-sm font-bold text-amber-400 font-mono'>
                    {sellMethod === 'by_ton'
                      ? totalTons.toFixed(2)
                      : totalNuts.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className='text-[10px] text-slate-500 uppercase'>
                    Income
                  </div>
                  <div className='text-sm font-bold text-green-400 font-mono'>
                    {formatINR(estimatedIncome)}
                  </div>
                </div>
                <div>
                  <div className='text-[10px] text-slate-500 uppercase'>
                    Profit
                  </div>
                  <div
                    className='text-sm font-bold font-mono'
                    style={{
                      color: estimatedProfit >= 0 ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {formatINR(estimatedProfit)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {editing ? (
            <p className='text-[10px] text-emerald-400 mt-3'>
              ✓ Updates will accurately reflect in connected Cashflow records.
            </p>
          ) : (
            <p className='text-[10px] text-emerald-400 mt-3'>
              ✓ Income &amp; expense will auto-sync to Cashflow &amp; selected
              account.
            </p>
          )}

          <div className='flex justify-end gap-2 pt-2 border-t border-slate-800'>
            <button
              type='button'
              onClick={() => {
                setShowModal(false);
                setEditing(null);
              }}
              className='px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-sm font-bold'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={save}
              className={`px-5 py-2 rounded-xl text-white text-sm font-bold ${editing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
              {editing ? 'Update Harvest' : 'Save Harvest'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TAB_META: { id: Tab; label: string; emoji: string }[] = [
  { id: 'overview', label: 'Overview', emoji: '📊' },
  { id: 'crops', label: 'Crops & Fields', emoji: '🌾' },
  { id: 'expenses', label: 'Expenses', emoji: '💸' },
  { id: 'livestock', label: 'Livestock', emoji: '🐄' },
  { id: 'milk', label: 'Milk', emoji: '🥛' },
  { id: 'coconut', label: 'Coconut', emoji: '🌴' },
  { id: 'produce', label: 'Produce Sales', emoji: '🧺' },
  { id: 'attendance', label: 'Attendance', emoji: '👷' },
];

export function AgriculturePage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { ready } = useAgriStore();

  if (!ready) return <AgricultureLoader />;

  return (
    <div className='flex flex-col gap-6 pb-12'>
      <header className='rounded-2xl bg-gradient-to-r from-green-600/10 via-emerald-500/5 to-transparent p-6 border border-green-500/20'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25 text-2xl'>
            🌾
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>
              Agriculture
            </h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              Crops · Livestock · Milk · Coconut — all synced to Cashflow &
              Accounts
            </p>
          </div>
        </div>
      </header>

      <div className='flex flex-wrap gap-1 p-1 bg-slate-900 rounded-xl w-fit'>
        {TAB_META.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === t.id
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span>{t.emoji}</span>
            <span className='hidden sm:inline'>{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'crops' && <CropsTab />}
      {activeTab === 'expenses' && <ExpensesTab />}
      {activeTab === 'livestock' && <LivestockTab />}
      {activeTab === 'milk' && <MilkTab />}
      {activeTab === 'coconut' && <CoconutTab />}
      {activeTab === 'produce' && <ProduceSalesTab />}
      {activeTab === 'attendance' && <AttendancePage />}
    </div>
  );
}
