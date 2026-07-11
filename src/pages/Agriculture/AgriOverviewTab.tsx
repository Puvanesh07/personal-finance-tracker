import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { formatINR, formatNumber } from '../../utils/format';
import { useMemo, useState } from 'react';
import { computeAgriSummary, computeCropMetrics } from '../../utils/agriCalculations';
import {
  ChartCard,
  EXPENSE_CATS,
  PIE_COLORS,
  SimpleMoneyFlow,
  SummaryCard,
} from './agriShared';
import { useAgriStore } from '../../store/agricultureStore';
import { DateRangeFilter } from '../../components/ui/DateRangeFilter';
import {
  createDefaultDateFilter,
  getDateRange,
  isDateInRange,
  type DateFilterState,
} from '../../utils/dateFilters';

export function AgriOverviewTab({
  onGoToFarm,
  onGoToLedger,
}: {
  onGoToFarm?: () => void;
  onGoToLedger?: () => void;
}) {
  const [dateFilter, setDateFilter] = useState<DateFilterState>(() =>
    createDefaultDateFilter('month'),
  );
  const range = getDateRange(dateFilter);

  const {
    cropCycles,
    agriExpenses,
    milkRecords,
    fields,
    coconutRecords,
    livestockEvents,
    produceSales,
  } = useAgriStore();

  const filtered = useMemo(() => {
    const expenses = agriExpenses.filter((e) => isDateInRange(e.date, range));
    const milk = milkRecords.filter((m) => isDateInRange(m.date, range));
    const coconut = coconutRecords.filter((c) => isDateInRange(c.date, range));
    const produce = produceSales.filter((p) => isDateInRange(p.date, range));
    const livestock = livestockEvents.filter((e) => isDateInRange(e.date, range));
    const crops = cropCycles.filter((c) => {
      const harvest = c.actualHarvestDate || c.startDate;
      return isDateInRange(harvest, range);
    });
    return { expenses, milk, coconut, produce, livestock, crops };
  }, [
    agriExpenses,
    milkRecords,
    coconutRecords,
    produceSales,
    livestockEvents,
    cropCycles,
    range,
  ]);

  const summary = useMemo(
    () =>
      computeAgriSummary({
        cropCycles: filtered.crops,
        agriExpenses: filtered.expenses,
        milkRecords: filtered.milk,
        coconutRecords: filtered.coconut,
        livestockEvents: filtered.livestock,
        produceSales: filtered.produce,
      }),
    [filtered],
  );

  const totalAnimalCount = (
    ['goat', 'cow', 'buffalo', 'sheep', 'poultry', 'other'] as const
  ).reduce((total, type) => {
    const count = filtered.livestock
      .filter((e) => e.animalType === type)
      .reduce((n, e) => {
        if (
          e.eventType === 'purchase' ||
          e.eventType === 'birth' ||
          e.eventType === 'existing'
        )
          return n + e.count;
        if (e.eventType === 'sale' || e.eventType === 'death') return n - e.count;
        return n;
      }, 0);
    return total + Math.max(0, count);
  }, 0);

  const incomeBreakdown = [
    { name: 'Crops', value: summary.cropIncome, fill: '#22c55e' },
    { name: 'Milk', value: summary.milkIncome, fill: '#14b8a6' },
    { name: 'Coconut', value: summary.coconutIncome, fill: '#f59e0b' },
    { name: 'Produce', value: summary.produceIncome, fill: '#8b5cf6' },
  ].filter((x) => x.value > 0);

  const profitBySource = incomeBreakdown;

  const cropProfitData = filtered.crops
    .map((c) => {
      const exp = filtered.expenses
        .filter((e) => e.cropCycleId === c.id)
        .reduce((s, e) => s + e.amount, 0);
      return {
        name: c.cropName,
        income: c.harvestIncome,
        expenses: exp + c.investedAmount,
      };
    })
    .filter((x) => x.income > 0 || x.expenses > 0);

  const expByCategory: Record<string, number> = {};
  filtered.expenses.forEach((e) => {
    expByCategory[e.category] = (expByCategory[e.category] ?? 0) + e.amount;
  });
  const expPieData = Object.entries(expByCategory).map(([name, value]) => ({
    name: EXPENSE_CATS.find((c) => c.value === name)?.label ?? name,
    value,
  }));

  const milkSessionSummary = useMemo(() => {
    const morning = filtered.milk.filter(
      (m) => m.session === 'morning' || !m.session,
    );
    const evening = filtered.milk.filter((m) => m.session === 'evening');
    return {
      morning: morning.reduce((s, m) => s + m.liters * m.pricePerLiter, 0),
      evening: evening.reduce((s, m) => s + m.liters * m.pricePerLiter, 0),
    };
  }, [filtered.milk]);

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <button
          type='button'
          onClick={onGoToFarm}
          className='rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-left transition-colors hover:bg-emerald-500/10'
        >
          <p className='text-sm font-bold text-slate-900 dark:text-white'>🌱 My Farm →</p>
          <p className='mt-1 text-xs text-slate-500'>Add mango, tomato, cows — we predict harvest dates.</p>
        </button>
        <button
          type='button'
          onClick={onGoToLedger}
          className='rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 text-left transition-colors hover:bg-blue-500/10'
        >
          <p className='text-sm font-bold text-slate-900 dark:text-white'>📒 Farm Ledger →</p>
          <p className='mt-1 text-xs text-slate-500'>Log daily harvest sales, milk &amp; farm expenses.</p>
        </button>
      </div>

      <DateRangeFilter value={dateFilter} onChange={setDateFilter} accent='emerald' />

      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <SummaryCard icon='💰' label='Income' value={formatINR(summary.totalIncome)} color='#22c55e' />
        <SummaryCard icon='💸' label='Expenses' value={formatINR(summary.totalExpenses)} color='#ef4444' />
        <SummaryCard
          icon='📈'
          label='Net Profit'
          value={formatINR(summary.netProfit)}
          color={summary.netProfit >= 0 ? '#22c55e' : '#ef4444'}
          sub={summary.netProfit >= 0 ? 'Profitable ✓' : 'In loss'}
        />
        <SummaryCard
          icon='📊'
          label='Profit %'
          value={`${summary.profitPercent.toFixed(1)}%`}
          color={summary.profitPercent >= 0 ? '#22c55e' : '#ef4444'}
        />
      </div>

      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'>
        <SummaryCard icon='🏞️' label='Fields' value={String(fields.length)} color='#3b82f6' sub={`${formatNumber(fields.reduce((s, f) => s + f.areAcres, 0), 1)} acres`} />
        <SummaryCard icon='🐄' label='Livestock' value={String(totalAnimalCount)} color='#f59e0b' />
        <SummaryCard icon='🌾' label='Crop Income' value={formatINR(summary.cropIncome)} color='#a78bfa' />
        <SummaryCard icon='🥛' label='Milk Income' value={formatINR(summary.milkIncome)} color='#14b8a6' />
        <SummaryCard icon='🧺' label='Produce' value={formatINR(summary.produceIncome)} color='#8b5cf6' />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <ChartCard title='💰 Income · Expense · Net (easy view)' height={180}>
          <SimpleMoneyFlow
            income={summary.totalIncome}
            expense={summary.totalExpenses}
            net={summary.netProfit}
          />
        </ChartCard>

        {incomeBreakdown.length > 0 && (
          <ChartCard title='🍩 Where income comes from' height={220}>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={incomeBreakdown}
                  dataKey='value'
                  nameKey='name'
                  innerRadius={45}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {incomeBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatINR(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {(milkSessionSummary.morning > 0 || milkSessionSummary.evening > 0) && (
          <ChartCard title='🥛 Milk — Morning vs Evening' height={120}>
            <div className='flex flex-col gap-3'>
              <div className='flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2'>
                <span className='text-sm font-bold text-amber-700 dark:text-amber-300'>🌅 Morning sales</span>
                <span className='font-bold'>{formatINR(milkSessionSummary.morning)}</span>
              </div>
              <div className='flex items-center justify-between rounded-lg bg-indigo-500/10 px-3 py-2'>
                <span className='text-sm font-bold text-indigo-700 dark:text-indigo-300'>🌙 Evening sales</span>
                <span className='font-bold'>{formatINR(milkSessionSummary.evening)}</span>
              </div>
            </div>
          </ChartCard>
        )}

        {profitBySource.length > 0 && (
          <ChartCard title='🌿 Income by source'>
            <div className='flex flex-col gap-2'>
              {profitBySource.map((row) => (
                <div
                  key={row.name}
                  className='flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50'
                >
                  <span className='text-sm font-semibold' style={{ color: row.fill }}>
                    {row.name}
                  </span>
                  <span className='font-bold tabular-nums'>{formatINR(row.value)}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {expPieData.length > 0 && (
          <ChartCard title='💸 Expenses by category'>
            <div className='flex flex-col gap-2'>
              {expPieData
                .sort((a, b) => b.value - a.value)
                .map((row, i) => (
                  <div
                    key={row.name}
                    className='flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50'
                  >
                    <span
                      className='text-sm font-semibold'
                      style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}
                    >
                      {row.name}
                    </span>
                    <span className='font-bold tabular-nums text-red-500'>
                      {formatINR(row.value)}
                    </span>
                  </div>
                ))}
            </div>
          </ChartCard>
        )}

        {cropProfitData.length > 0 && (
          <ChartCard title='🌾 Crop income vs cost'>
            <div className='flex flex-col gap-2'>
              {cropProfitData.map((c) => {
                const net = c.income - c.expenses;
                return (
                  <div
                    key={c.name}
                    className='rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800'
                  >
                    <p className='text-sm font-bold text-slate-800 dark:text-slate-100'>
                      {c.name}
                    </p>
                    <p className='text-xs text-emerald-500'>Income {formatINR(c.income)}</p>
                    <p className='text-xs text-red-400'>Cost {formatINR(c.expenses)}</p>
                    <p className={`text-xs font-bold ${net >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                      Net {formatINR(net)}
                    </p>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        )}
      </div>

      {filtered.crops.length > 0 && (
        <div className='overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'>
          <div className='mb-3 text-sm font-bold text-slate-900 dark:text-slate-100'>
            🌾 Crop Performance
          </div>
          <table className='w-full text-xs'>
            <thead>
              <tr className='border-b border-slate-200 text-left text-slate-500 dark:border-slate-800'>
                <th className='py-2 pr-3'>Crop</th>
                <th className='py-2 pr-3'>Investment</th>
                <th className='py-2 pr-3'>Income</th>
                <th className='py-2 pr-3'>Profit</th>
                <th className='py-2 pr-3'>Profit %</th>
                <th className='py-2'>Cost/kg</th>
              </tr>
            </thead>
            <tbody>
              {filtered.crops.map((c) => {
                const m = computeCropMetrics(c, filtered.expenses);
                return (
                  <tr key={c.id} className='border-b border-slate-100 dark:border-slate-800/60'>
                    <td className='py-2 pr-3 font-semibold'>{c.cropName}</td>
                    <td className='py-2 pr-3'>{formatINR(m.totalInvestment)}</td>
                    <td className='py-2 pr-3 text-emerald-500'>{formatINR(m.totalIncome)}</td>
                    <td className={`py-2 pr-3 ${m.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {formatINR(m.netProfit)}
                    </td>
                    <td className='py-2 pr-3'>{m.profitPercent.toFixed(1)}%</td>
                    <td className='py-2'>{m.costPerKg > 0 ? formatINR(m.costPerKg) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
