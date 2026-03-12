// src/pages/Agriculture/AgriculturePage.tsx

import type {
  AgriExpenseCategory,
  CoconutRecord,
  CropCycle,
  Livestock,
  LivestockType,
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
import { formatINR, formatNumber } from '../../utils/format';
import { useMemo, useState } from 'react';

import { Modal } from '../../components/ui/Modal';
import { NumericInput } from '../../components/ui/NumericInput';
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
] as const;
type Tab = (typeof TAB_TYPES)[number];

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';
const labelCls =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1';
const selectCls = inputCls;

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

// ─── Cashflow auto-create helper ──────────────────────────────────────────────

async function pushToCashflow(
  type: 'income' | 'expense',
  category: string,
  amount: number,
  date: string,
  accountId: string | undefined,
  notes: string, // Fixed: Changed 'note' to 'notes'
  addCashflow: ReturnType<typeof usePortfolioStore.getState>['addCashflow'],
) {
  if (amount <= 0) return;
  await addCashflow({
    type,
    category,
    amount,
    date,
    notes, // Fixed: Passed as 'notes'
    accountId: accountId || undefined,
  });
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const {
    cropCycles,
    agriExpenses,
    livestock,
    milkRecords,
    fields,
    coconutRecords,
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
  const livestockValue = livestock.reduce(
    (s, l) => s + l.currentValue * l.count,
    0,
  );

  // Profit by source (crops, milk, coconut)
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

  // Crop profit comparison
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

  // Expense breakdown pie
  const expByCategory: Record<string, number> = {};
  agriExpenses.forEach((e) => {
    expByCategory[e.category] = (expByCategory[e.category] ?? 0) + e.amount;
  });
  const expPieData = Object.entries(expByCategory).map(([name, value]) => ({
    name: EXPENSE_CATS.find((c) => c.value === name)?.label ?? name,
    value,
  }));

  // Season profit
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

  // Monthly milk income
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
          label='Livestock Value'
          value={formatINR(livestockValue)}
          color='#f59e0b'
          sub={`${livestock.reduce((s, l) => s + l.count, 0)} animals`}
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

      {/* Farm profit by source */}
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
    deleteField,
  } = useAgriStore();
  const { accounts, addCashflow } = usePortfolioStore();
  const [showFieldModal, setShowFieldModal] = useState(false);
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
      toast.success('Crop cycle updated');
    } else {
      await addCropCycle(payload);
      // Auto-push to cashflow
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

  async function saveField() {
    if (!fName.trim()) {
      toast.error('Field name required');
      return;
    }
    await addField({
      name: fName.trim(),
      areAcres: parseFloat(fArea) || 0,
      location: fLocation.trim() || undefined,
    });
    toast.success('Field added');
    setShowFieldModal(false);
    setFName('');
    setFArea('0');
    setFLocation('');
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
            onClick={() => setShowFieldModal(true)}
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
                <DeleteBtn onDelete={() => deleteField(f.id)} />
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
                        <DeleteBtn onDelete={() => deleteCropCycle(c.id)} />
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
        title='Add Field / Land'
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
            <select
              className={selectCls}
              value={cField}
              onChange={(e) => setCField(e.target.value)}
            >
              <option value=''>— Select Field —</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
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
            <select
              className={selectCls}
              value={cSeasonVal}
              onChange={(e) => setCSeasonVal(e.target.value as Season)}
            >
              {SEASONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
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
            <label className={labelCls}>Bank Account</label>
            <select
              className={selectCls}
              value={cAccount}
              onChange={(e) => setCAccount(e.target.value)}
            >
              <option value=''>— Cash —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
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
        {!editingCrop && (
          <p className='text-[10px] text-emerald-400 mt-3'>
            ✓ Income & investment will auto-sync to Cashflow
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
  const { cropCycles, agriExpenses, addAgriExpense, deleteAgriExpense } =
    useAgriStore();
  const { accounts, addCashflow } = usePortfolioStore();
  const [showModal, setShowModal] = useState(false);
  const [eCrop, setECrop] = useState('');
  const [eCat, setECat] = useState<AgriExpenseCategory>('fertilizer');
  const [eAmount, setEAmount] = useState('0');
  const [eDate, setEDate] = useState(new Date().toISOString().split('T')[0]);
  const [eNotes, setENotes] = useState('');
  const [eAccount, setEAccount] = useState('');

  async function saveExpense() {
    const amount = parseFloat(eAmount);
    if (amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const cropName = cropCycles.find((c) => c.id === eCrop)?.cropName;
    await addAgriExpense({
      cropCycleId: eCrop,
      cropName,
      category: eCat,
      amount,
      date: eDate,
      notes: eNotes.trim() || undefined,
      accountId: eAccount || undefined,
    });
    // Auto-sync to cashflow
    const catLabel = EXPENSE_CATS.find((c) => c.value === eCat)?.label ?? eCat;
    await pushToCashflow(
      'expense',
      catLabel,
      amount,
      eDate,
      eAccount || undefined,
      `Farm expense: ${catLabel}${cropName ? ` (${cropName})` : ''}`,
      addCashflow,
    );
    toast.success('Expense added & synced to Cashflow ✓');
    setShowModal(false);
    setEAmount('0');
    setENotes('');
    setEAccount('');
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
            onClick={() => setShowModal(true)}
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
                      <DeleteBtn onDelete={() => deleteAgriExpense(e.id)} />
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
        onClose={() => setShowModal(false)}
        title='Add Agriculture Expense'
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Crop Cycle</label>
            <select
              className={selectCls}
              value={eCrop}
              onChange={(e) => setECrop(e.target.value)}
            >
              <option value=''>— General / No Crop —</option>
              {cropCycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cropName} ({c.fieldName ?? 'No field'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Category *</label>
            <select
              className={selectCls}
              value={eCat}
              onChange={(e) => setECat(e.target.value as AgriExpenseCategory)}
            >
              {EXPENSE_CATS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
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
            <select
              className={selectCls}
              value={eAccount}
              onChange={(e) => setEAccount(e.target.value)}
            >
              <option value=''>— Cash —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
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
        <p className='text-[10px] text-emerald-400 mt-3'>
          ✓ Will auto-sync to Cashflow & debit from selected account
        </p>
        <div className='flex justify-end gap-2 pt-4 mt-2 border-t border-slate-800'>
          <button
            onClick={() => setShowModal(false)}
            className='px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-sm font-bold'
          >
            Cancel
          </button>
          <button
            onClick={saveExpense}
            className='px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700'
          >
            Save Expense
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Livestock Tab ────────────────────────────────────────────────────────────

function LivestockTab() {
  const { livestock, addLivestock, updateLivestock, deleteLivestock } =
    useAgriStore();
  const { accounts } = usePortfolioStore();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Livestock | null>(null);
  const [lType, setLType] = useState<LivestockType>('cow');
  const [lName, setLName] = useState('');
  const [lCount, setLCount] = useState('1');
  const [lCost, setLCost] = useState('0');
  const [lValue, setLValue] = useState('0');
  const [lDate, setLDate] = useState(new Date().toISOString().split('T')[0]);
  const [lNotes, setLNotes] = useState('');
  const [lAccount, setLAccount] = useState('');

  function reset(l?: Livestock) {
    setLType(l?.type ?? 'cow');
    setLName(l?.name ?? '');
    setLCount(String(l?.count ?? 1));
    setLCost(String(l?.purchaseCost ?? 0));
    setLValue(String(l?.currentValue ?? 0));
    setLDate(l?.purchaseDate ?? new Date().toISOString().split('T')[0]);
    setLNotes(l?.notes ?? '');
    setLAccount('');
  }

  async function save() {
    const payload = {
      type: lType,
      name: lName.trim() || undefined,
      count: parseInt(lCount) || 1,
      purchaseCost: parseFloat(lCost) || 0,
      currentValue: parseFloat(lValue) || 0,
      purchaseDate: lDate,
      notes: lNotes.trim() || undefined,
      accountId: lAccount || undefined,
    };
    if (editing) {
      await updateLivestock(editing.id, payload);
      toast.success('Updated');
    } else {
      await addLivestock(payload);
      toast.success('Livestock added');
    }
    setShowModal(false);
  }

  const totalValue = livestock.reduce(
    (s, l) => s + l.currentValue * l.count,
    0,
  );
  const totalCount = livestock.reduce((s, l) => s + l.count, 0);

  return (
    <div className='flex flex-col gap-6'>
      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <div className='text-sm font-bold text-slate-100'>🐄 Livestock</div>
            {totalCount > 0 && (
              <div className='text-xs text-slate-400 mt-0.5'>
                {totalCount} animals · Total value {formatINR(totalValue)}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setEditing(null);
              reset();
              setShowModal(true);
            }}
            className='px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700'
          >
            + Add Animal
          </button>
        </div>
        {livestock.length === 0 ? (
          <p className='text-xs text-slate-500 text-center py-4'>
            No livestock added yet.
          </p>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
            {livestock.map((l) => {
              const meta = LIVESTOCK_TYPES.find((t) => t.value === l.type);
              return (
                <div
                  key={l.id}
                  className='rounded-xl bg-slate-800 p-3 flex flex-col gap-2'
                >
                  <div className='flex items-center gap-2'>
                    <span className='text-2xl'>{meta?.emoji}</span>
                    <div>
                      <div className='font-bold text-slate-100 text-sm'>
                        {l.name || meta?.label}
                      </div>
                      <div className='text-xs text-slate-400'>
                        {l.count} animal{l.count > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className='grid grid-cols-2 gap-1 text-xs'>
                    <div>
                      <span className='text-slate-500'>Bought: </span>
                      <span className='text-slate-300'>
                        {formatINR(l.purchaseCost)}
                      </span>
                    </div>
                    <div>
                      <span className='text-slate-500'>Value: </span>
                      <span className='text-emerald-400'>
                        {formatINR(l.currentValue * l.count)}
                      </span>
                    </div>
                  </div>
                  <div className='flex gap-1'>
                    <button
                      onClick={() => {
                        setEditing(l);
                        reset(l);
                        setShowModal(true);
                      }}
                      className='px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600'
                    >
                      Edit
                    </button>
                    <DeleteBtn onDelete={() => deleteLivestock(l.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Livestock' : 'Add Livestock'}
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label className={labelCls}>Animal Type</label>
            <select
              className={selectCls}
              value={lType}
              onChange={(e) => setLType(e.target.value as LivestockType)}
            >
              {LIVESTOCK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Name (Optional)</label>
            <input
              className={inputCls}
              value={lName}
              onChange={(e) => setLName(e.target.value)}
              placeholder='e.g. Lakshmi'
            />
          </div>
          <div>
            <label className={labelCls}>Count</label>
            <NumericInput
              className={inputCls}
              value={lCount}
              onChange={setLCount}
              allowDecimal={false}
            />
          </div>
          <div>
            <label className={labelCls}>Purchase Cost (₹ total)</label>
            <NumericInput
              className={inputCls}
              value={lCost}
              onChange={setLCost}
            />
          </div>
          <div>
            <label className={labelCls}>Current Value (₹ per animal)</label>
            <NumericInput
              className={inputCls}
              value={lValue}
              onChange={setLValue}
            />
          </div>
          <div>
            <label className={labelCls}>Purchase Date</label>
            <input
              type='date'
              className={inputCls}
              value={lDate}
              onChange={(e) => setLDate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Bank Account</label>
            <select
              className={selectCls}
              value={lAccount}
              onChange={(e) => setLAccount(e.target.value)}
            >
              <option value=''>— Cash —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className='sm:col-span-2'>
            <label className={labelCls}>Notes</label>
            <input
              className={inputCls}
              value={lNotes}
              onChange={(e) => setLNotes(e.target.value)}
              placeholder='Optional'
            />
          </div>
        </div>
        <div className='flex justify-end gap-2 pt-4 mt-2 border-t border-slate-800'>
          <button
            onClick={() => setShowModal(false)}
            className='px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-sm font-bold'
          >
            Cancel
          </button>
          <button
            onClick={save}
            className='px-5 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700'
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Milk Tab ─────────────────────────────────────────────────────────────────

function MilkTab() {
  const { milkRecords, addMilkRecord, deleteMilkRecord } = useAgriStore();
  const { accounts, addCashflow } = usePortfolioStore();
  const [showModal, setShowModal] = useState(false);
  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]);
  const [mLiters, setMLiters] = useState('0');
  const [mPrice, setMPrice] = useState('0');
  const [mSoldTo, setMSoldTo] = useState('');
  const [mAccount, setMAccount] = useState('');

  async function save() {
    const liters = parseFloat(mLiters);
    const price = parseFloat(mPrice);
    if (liters <= 0 || price <= 0) {
      toast.error('Enter valid liters and price');
      return;
    }
    const income = liters * price;
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
    setShowModal(false);
    setMLiters('0');
    setMPrice('0');
    setMSoldTo('');
    setMAccount('');
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
            onClick={() => setShowModal(true)}
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
                      <DeleteBtn onDelete={() => deleteMilkRecord(m.id)} />
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
        onClose={() => setShowModal(false)}
        title='Add Milk Record'
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
            <select
              className={selectCls}
              value={mAccount}
              onChange={(e) => setMAccount(e.target.value)}
            >
              <option value=''>— Cash —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className='text-[10px] text-emerald-400 mt-3'>
          ✓ Income will auto-sync to Cashflow & credit to selected account
        </p>
        <div className='flex justify-end gap-2 pt-4 mt-2 border-t border-slate-800'>
          <button
            onClick={() => setShowModal(false)}
            className='px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-sm font-bold'
          >
            Cancel
          </button>
          <button
            onClick={save}
            className='px-5 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700'
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Coconut Tab ──────────────────────────────────────────────────────────────

function CoconutTab() {
  const { coconutRecords, addCoconutRecord, deleteCoconutRecord } =
    useAgriStore();
  const { accounts, addCashflow } = usePortfolioStore();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CoconutRecord | null>(null);

  const [cDate, setCDate] = useState(new Date().toISOString().split('T')[0]);
  const [cTrees, setCTrees] = useState('0');
  const [cPerTree, setCPerTree] = useState('0');
  const [cMinPrice, setCMinPrice] = useState('0');
  const [cMaxPrice, setCMaxPrice] = useState('0');
  const [cInvest, setCInvest] = useState('0');
  const [cDuration, setCDuration] = useState('3');
  const [cNotes, setCNotes] = useState('');
  const [cAccount, setCAccount] = useState('');

  const trees = parseFloat(cTrees) || 0;
  const perTree = parseFloat(cPerTree) || 0;
  const minP = parseFloat(cMinPrice) || 0;
  const maxP = parseFloat(cMaxPrice) || 0;
  const totalCoconuts = trees * perTree;
  const avgPrice = minP > 0 && maxP > 0 ? (minP + maxP) / 2 : maxP || minP;
  const estimatedIncome = totalCoconuts * avgPrice;
  const invest = parseFloat(cInvest) || 0;
  const estimatedProfit = estimatedIncome - invest;

  function resetForm(r?: CoconutRecord) {
    setCDate(r?.date ?? new Date().toISOString().split('T')[0]);
    setCTrees(String(r?.numberOfTrees ?? 0));
    setCPerTree(String(r?.coconutPerTree ?? 0));
    setCMinPrice(String(r?.minPrice ?? 0));
    setCMaxPrice(String(r?.maxPrice ?? 0));
    setCInvest(String(r?.investmentAmount ?? 0));
    setCDuration(String(r?.durationMonths ?? 3));
    setCNotes(r?.notes ?? '');
    setCAccount(r?.accountId ?? '');
  }

  async function save() {
    if (trees <= 0 || perTree <= 0) {
      toast.error('Enter number of trees and coconuts per tree');
      return;
    }
    const record = {
      date: cDate,
      numberOfTrees: trees,
      coconutPerTree: perTree,
      totalCoconuts,
      minPrice: minP,
      maxPrice: maxP,
      avgPrice,
      investmentAmount: invest,
      harvestIncome: estimatedIncome,
      durationMonths: parseInt(cDuration) || 3,
      notes: cNotes.trim() || undefined,
      accountId: cAccount || undefined,
    };
    await addCoconutRecord(record);
    if (estimatedIncome > 0) {
      await pushToCashflow(
        'income',
        'Coconut Sale',
        estimatedIncome,
        cDate,
        cAccount || undefined,
        `Coconut harvest: ${totalCoconuts} coconuts @ ₹${avgPrice.toFixed(0)}/pc`,
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
      `Coconut harvest recorded · ${formatINR(estimatedIncome)} synced to Cashflow ✓`,
    );
    setShowModal(false);
    resetForm();
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

  // Chart data
  const chartData = coconutRecords
    .slice()
    .reverse()
    .map((c) => ({
      date: c.date,
      coconuts: c.totalCoconuts,
      income: c.harvestIncome,
      profit: c.harvestIncome - c.investmentAmount,
    }));

  return (
    <div className='flex flex-col gap-6'>
      {/* Summary */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <SummaryCard
          icon='🌴'
          label='Trees'
          value={String(totalTrees)}
          color='#f59e0b'
          sub='as of last harvest'
        />
        <SummaryCard
          icon='🥥'
          label='Total Coconuts'
          value={formatNumber(totalCoconutsAll, 0)}
          color='#f59e0b'
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
              🥥 Coconut Production per Harvest
            </div>
            <ResponsiveContainer width='100%' height={180}>
              <BarChart data={chartData}>
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
                  name='Coconuts'
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

      {/* Records table */}
      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <div className='text-sm font-bold text-slate-100'>
              🌴 Coconut Harvests
            </div>
            <div className='text-[10px] text-slate-500 mt-0.5'>
              Income auto-synced to Cashflow & Bank Account
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
                    'Per Tree',
                    'Total',
                    'Avg Price',
                    'Investment',
                    'Income',
                    'Profit',
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
                {coconutRecords.map((c) => {
                  const profit = c.harvestIncome - c.investmentAmount;
                  return (
                    <tr
                      key={c.id}
                      className='border-b border-slate-800/50 hover:bg-slate-800/30'
                    >
                      <td className='px-3 py-2 text-slate-300'>{c.date}</td>
                      <td className='px-3 py-2 text-amber-400 font-bold'>
                        {c.numberOfTrees} 🌴
                      </td>
                      <td className='px-3 py-2 text-slate-400'>
                        {c.coconutPerTree}
                      </td>
                      <td className='px-3 py-2 text-slate-300 font-bold'>
                        {c.totalCoconuts}
                      </td>
                      <td className='px-3 py-2 text-slate-400'>
                        ₹{c.avgPrice.toFixed(0)}
                      </td>
                      <td className='px-3 py-2 text-red-400'>
                        {formatINR(c.investmentAmount)}
                      </td>
                      <td className='px-3 py-2 text-green-400 font-bold'>
                        {formatINR(c.harvestIncome)}
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
                        <DeleteBtn onDelete={() => deleteCoconutRecord(c.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Harvest' : 'Add Coconut Harvest'}
      >
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
            <label className={labelCls}>Number of Trees *</label>
            <NumericInput
              className={inputCls}
              value={cTrees}
              onChange={setCTrees}
              allowDecimal={false}
            />
          </div>
          <div>
            <label className={labelCls}>Avg Coconuts per Tree *</label>
            <NumericInput
              className={inputCls}
              value={cPerTree}
              onChange={setCPerTree}
              allowDecimal={false}
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
            <label className={labelCls}>Min Price (₹/coconut)</label>
            <NumericInput
              className={inputCls}
              value={cMinPrice}
              onChange={setCMinPrice}
            />
          </div>
          <div>
            <label className={labelCls}>Max Price (₹/coconut)</label>
            <NumericInput
              className={inputCls}
              value={cMaxPrice}
              onChange={setCMaxPrice}
            />
          </div>
          <div>
            <label className={labelCls}>Investment (₹)</label>
            <NumericInput
              className={inputCls}
              value={cInvest}
              onChange={setCInvest}
            />
          </div>
          <div>
            <label className={labelCls}>Income to Account</label>
            <select
              className={selectCls}
              value={cAccount}
              onChange={(e) => setCAccount(e.target.value)}
            >
              <option value=''>— Cash —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
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

        {/* Live preview */}
        {trees > 0 && perTree > 0 && (
          <div className='mt-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 grid grid-cols-3 gap-3 text-center'>
            <div>
              <div className='text-xs text-slate-400'>Total Coconuts</div>
              <div className='text-lg font-bold text-amber-400'>
                {totalCoconuts}
              </div>
            </div>
            <div>
              <div className='text-xs text-slate-400'>Est. Income</div>
              <div className='text-lg font-bold text-green-400'>
                {formatINR(estimatedIncome)}
              </div>
            </div>
            <div>
              <div className='text-xs text-slate-400'>Est. Profit</div>
              <div
                className='text-lg font-bold'
                style={{ color: estimatedProfit >= 0 ? '#22c55e' : '#ef4444' }}
              >
                {formatINR(estimatedProfit)}
              </div>
            </div>
          </div>
        )}
        <p className='text-[10px] text-emerald-400 mt-3'>
          ✓ Income will auto-sync to Cashflow & credit to selected account
        </p>
        <div className='flex justify-end gap-2 pt-4 mt-2 border-t border-slate-800'>
          <button
            onClick={() => setShowModal(false)}
            className='px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 text-sm font-bold'
          >
            Cancel
          </button>
          <button
            onClick={save}
            className='px-5 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700'
          >
            Save Harvest
          </button>
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
];

export function AgriculturePage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { ready } = useAgriStore();

  if (!ready)
    return (
      <div className='flex items-center justify-center h-60 text-slate-500'>
        Loading agriculture data…
      </div>
    );

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
    </div>
  );
}
