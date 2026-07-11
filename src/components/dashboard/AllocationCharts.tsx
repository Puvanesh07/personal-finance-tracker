import { useMemo } from 'react';
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Card } from '../ui/Card';
import { FiPieChart } from 'react-icons/fi';
import { formatINR } from '../../utils/format';
import { getAllocationTotals } from '../../utils/assetClassification';
import { usePortfolioStore } from '../../store/portfolioStore';

const CATEGORY_META = [
  { key: 'stocks', label: 'Stocks', fill: '#6366F1' },
  { key: 'mutualFunds', label: 'Mutual Funds', fill: '#10B981' },
  { key: 'etfs', label: 'ETFs', fill: '#0EA5E9' },
  { key: 'gold', label: 'Gold', fill: '#F59E0B' },
  { key: 'silver', label: 'Silver', fill: '#94A3B8' },
  { key: 'bonds', label: 'Bonds', fill: '#8B5CF6' },
] as const;

export function AllocationCharts() {
  const investments = usePortfolioStore((s) => s.investments);
  const totals = useMemo(() => getAllocationTotals(investments), [investments]);

  const data = useMemo(() => {
    return CATEGORY_META.map((item) => ({
      key: item.key,
      name: item.label,
      value: totals[item.key],
      fill: item.fill,
      pct:
        totals.overall > 0
          ? ((totals[item.key] / totals.overall) * 100).toFixed(1)
          : '0.0',
    })).filter((x) => x.value > 0);
  }, [totals]);

  return (
    <Card
      title={
        <div className='flex items-center gap-2'>
          <FiPieChart className='text-indigo-500' /> Asset Allocation
        </div>
      }
    >
      <div className='mb-3 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700/70 dark:bg-slate-800/30'>
        <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
          Overall (All assets)
        </p>
        <p className='mt-1 text-sm font-black text-slate-900 dark:text-slate-100'>
          {formatINR(totals.overall)}
        </p>
      </div>
      <div className='grid min-h-0 grid-cols-1 gap-4 sm:grid-cols-[220px_1fr]'>
        <div className='h-56 min-h-[224px] w-full'>
          <ResponsiveContainer width='100%' height={224}>
            <PieChart>
              <Pie
                data={data}
                dataKey='value'
                nameKey='name'
                innerRadius={60}
                outerRadius={85}
                paddingAngle={3}
                isAnimationActive
                animationDuration={1000}
                stroke='none'
              />
              <Tooltip
                formatter={(value: any) => formatINR(Number(value))}
                contentStyle={{
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  backdropFilter: 'blur(8px)',
                  color: '#F8FAFC',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                }}
                itemStyle={{ color: '#F8FAFC', fontWeight: 600 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className='flex flex-col gap-2 rounded-xl bg-slate-50/50 p-3 dark:bg-slate-800/30'>
          {data.length === 0 ? (
            <div className='grid h-full place-items-center text-sm font-medium text-slate-900 dark:text-slate-500'>
              No assets to display.
            </div>
          ) : (
            data.map((d) => (
              <div
                key={d.key}
                className='flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white dark:hover:bg-slate-800/80'
              >
                <div className='flex items-center gap-2.5'>
                  <span
                    className='inline-block h-3 w-3 rounded-full shadow-sm'
                    style={{ background: d.fill }}
                  />
                  <span className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                    {d.name}
                  </span>
                </div>
                <div className='text-right'>
                  <div className='text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50'>
                    {formatINR(d.value)}
                  </div>
                  <div className='text-[10px] font-semibold text-slate-500 dark:text-slate-400'>
                    {d.pct}%
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}