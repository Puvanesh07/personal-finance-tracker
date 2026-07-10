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
import { useMemo } from 'react';
import { computeAgriSummary, computeCropMetrics } from '../../utils/agriCalculations';
import {
  EXPENSE_CATS,
  PIE_COLORS,
  SEASONS,
  SummaryCard,
} from './agriShared';
import { useAgriStore } from '../../store/agricultureStore';

export function AgriOverviewTab() {
  const {
    cropCycles,
    agriExpenses,
    milkRecords,
    fields,
    coconutRecords,
    livestockEvents,
    produceSales,
  } = useAgriStore();

  const summary = useMemo(
    () =>
      computeAgriSummary({
        cropCycles,
        agriExpenses,
        milkRecords,
        coconutRecords,
        livestockEvents,
        produceSales,
      }),
    [
      cropCycles,
      agriExpenses,
      milkRecords,
      coconutRecords,
      livestockEvents,
      produceSales,
    ],
  );

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

  const profitBySource = [
    {
      name: 'Crops',
      profit:
        summary.cropIncome -
        agriExpenses.reduce((s, e) => s + e.amount, 0),
      fill: '#22c55e',
    },
    { name: 'Milk', profit: summary.milkIncome, fill: '#14b8a6' },
    {
      name: 'Coconut',
      profit:
        summary.coconutIncome -
        coconutRecords.reduce((s, c) => s + c.investmentAmount, 0),
      fill: '#f59e0b',
    },
    { name: 'Produce', profit: summary.produceIncome, fill: '#8b5cf6' },
  ].filter((x) => x.profit !== 0);

  const cropProfitData = cropCycles
    .map((c) => {
      const exp = agriExpenses
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
    milkByMonth[month] =
      (milkByMonth[month] ?? 0) + m.liters * m.pricePerLiter;
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
          value={formatINR(summary.totalIncome)}
          color='#22c55e'
        />
        <SummaryCard
          icon='💸'
          label='Total Expenses'
          value={formatINR(summary.totalExpenses)}
          color='#ef4444'
        />
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
          sub='return on investment'
        />
        <SummaryCard
          icon='🐄'
          label='Livestock'
          value={String(totalAnimalCount)}
          color='#f59e0b'
          sub='animals on farm'
        />
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
        <SummaryCard
          icon='🏞️'
          label='Fields'
          value={String(fields.length)}
          color='#3b82f6'
          sub={`${formatNumber(fields.reduce((s, f) => s + f.areAcres, 0), 1)} acres`}
        />
        <SummaryCard
          icon='🌾'
          label='Crop Income'
          value={formatINR(summary.cropIncome)}
          color='#a78bfa'
        />
        <SummaryCard
          icon='🥛'
          label='Milk Income'
          value={formatINR(summary.milkIncome)}
          color='#14b8a6'
        />
        <SummaryCard
          icon='🌴'
          label='Coconut'
          value={formatINR(summary.coconutIncome)}
          color='#f59e0b'
        />
        <SummaryCard
          icon='🧺'
          label='Produce Sales'
          value={formatINR(summary.produceIncome)}
          color='#8b5cf6'
          sub={`${produceSales.length} sales`}
        />
      </div>

      {cropCycles.length > 0 && (
        <div className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 overflow-x-auto'>
          <div className='text-sm font-bold text-slate-900 dark:text-slate-100 mb-3'>
            🌾 Crop Performance
          </div>
          <table className='w-full text-xs'>
            <thead>
              <tr className='text-left text-slate-500 border-b border-slate-200 dark:border-slate-800'>
                <th className='py-2 pr-3'>Crop</th>
                <th className='py-2 pr-3'>Investment</th>
                <th className='py-2 pr-3'>Income</th>
                <th className='py-2 pr-3'>Profit</th>
                <th className='py-2 pr-3'>Profit %</th>
                <th className='py-2'>Cost/kg</th>
              </tr>
            </thead>
            <tbody>
              {cropCycles.map((c) => {
                const m = computeCropMetrics(c, agriExpenses);
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

      {profitBySource.length > 0 && (
        <div className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4'>
          <div className='text-sm font-bold text-slate-900 dark:text-slate-100 mb-4'>
            🌿 Profit by Source
          </div>
          <ResponsiveContainer width='100%' height={200}>
            <BarChart data={profitBySource}>
              <XAxis dataKey='name' tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(v) => formatINR(Number(v))} />
              <Bar dataKey='profit' radius={[4, 4, 0, 0]}>
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
          <div className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4'>
            <div className='text-sm font-bold mb-4'>🌾 Crop P&amp;L</div>
            <ResponsiveContainer width='100%' height={200}>
              <BarChart data={cropProfitData} barGap={4}>
                <XAxis dataKey='name' tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip formatter={(v) => formatINR(Number(v))} />
                <Legend />
                <Bar dataKey='income' name='Income' fill='#22c55e' />
                <Bar dataKey='expenses' name='Expenses' fill='#ef4444' />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {expPieData.length > 0 && (
          <div className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4'>
            <div className='text-sm font-bold mb-4'>💸 Expenses</div>
            <ResponsiveContainer width='100%' height={200}>
              <PieChart>
                <Pie data={expPieData} dataKey='value' nameKey='name' outerRadius={70}>
                  {expPieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatINR(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {milkChartData.length > 0 && (
          <div className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4'>
            <div className='text-sm font-bold mb-4'>🥛 Monthly Milk</div>
            <ResponsiveContainer width='100%' height={180}>
              <LineChart data={milkChartData}>
                <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
                <XAxis dataKey='month' tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip formatter={(v) => formatINR(Number(v))} />
                <Line type='monotone' dataKey='income' stroke='#14b8a6' strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {seasonChartData.length > 0 && (
          <div className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4'>
            <div className='text-sm font-bold mb-4'>🗓️ By Season</div>
            <ResponsiveContainer width='100%' height={180}>
              <BarChart data={seasonChartData}>
                <XAxis dataKey='season' tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip formatter={(v) => formatINR(Number(v))} />
                <Bar dataKey='profit' fill='#22c55e' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
