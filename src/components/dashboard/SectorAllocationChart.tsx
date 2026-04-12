// src/components/dashboard/SectorAllocationChart.tsx
//
// FIX: Better layout — chart + legend side by side, no wasted bottom space
//      More beautiful card with colored sector rows

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { FiGrid, FiRefreshCw } from 'react-icons/fi';
import { useMemo, useState } from 'react';

import { Card } from '../ui/Card';
import { MetadataLoader } from '../ui/SectionLoader';
import { currentValue } from '../../utils/calculations';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useStockMetadata } from '../../hooks/useStockMetadata';

const COLORS = [
  '#6366F1',
  '#10B981',
  '#0EA5E9',
  '#F59E0B',
  '#EC4899',
  '#14B8A6',
  '#8B5CF6',
  '#4ADE80',
  '#F43F5E',
  '#06B6D4',
  '#EAB308',
  '#3B82F6',
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value, pct } = payload[0].payload;
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(15,23,42,0.96)',
        backdropFilter: 'blur(10px)',
        color: '#F8FAFC',
        padding: '10px 14px',
        fontSize: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 3, fontSize: 13 }}>
        {name}
      </div>
      <div style={{ fontWeight: 600 }}>{formatINR(value)}</div>
      <div style={{ color: '#10B981', fontWeight: 800, marginTop: 2 }}>
        {pct}% of Equities
      </div>
    </div>
  );
};

export function SectorAllocationChart() {
  const investments = usePortfolioStore((s) => s.investments);
  const { metadata, isLoading, refresh } = useStockMetadata(investments);
  const [chartKey, setChartKey] = useState(0);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  const handleRefresh = () => {
    setChartKey((p) => p + 1);
    refresh();
  };

  const data = useMemo(() => {
    const bySector = new Map<string, number>();
    for (const inv of investments) {
      if (inv.type === 'fixed_deposit' || inv.type === 'bond') continue;
      let sector = inv.type === 'stock' ? (inv.sector ?? '').trim() : '';
      if (!sector) {
        const meta = metadata.get(inv.id);
        sector = meta?.sector && meta.sector !== 'Unknown' ? meta.sector : '';
      }
      sector = sector || 'Uncategorized';
      bySector.set(sector, (bySector.get(sector) ?? 0) + currentValue(inv));
    }
    const total = Array.from(bySector.values()).reduce((a, b) => a + b, 0);
    return Array.from(bySector.entries())
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? ((value / total) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [investments, metadata]);

  const pendingCount = investments.filter(
    (inv) =>
      inv.type !== 'fixed_deposit' &&
      inv.type !== 'bond' &&
      !metadata.has(inv.id),
  ).length;

  return (
    <Card
      title={
        <div className='flex items-center gap-2'>
          <FiGrid className='text-pink-500' /> Sector Spread
        </div>
      }
      right={
        <button
          type='button'
          onClick={handleRefresh}
          className='group flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/50 px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800'
        >
          <FiRefreshCw
            className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 group-hover:text-emerald-500 transition-colors ${isLoading ? 'animate-spin text-emerald-500' : ''}`}
          />
          <span>
            {isLoading ? `Fetching ${pendingCount}…` : 'Refresh Data'}
          </span>
        </button>
      }
    >
      {data.length === 0 ? (
        <div className='grid h-52 place-items-center text-sm font-medium text-slate-500 dark:text-slate-400'>
          {isLoading
            ? 'Fetching sector data…'
            : 'Add equities to see sector allocation.'}
        </div>
      ) : (
        <div className='flex flex-col gap-4'>
          {/* Top section: donut + legend side by side */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-[200px_minmax(0,1fr)] items-start'>
            {/* Donut */}
            <div className='h-[200px] w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart key={chartKey}>
                  <Pie
                    data={data}
                    dataKey='value'
                    nameKey='name'
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    stroke='none'
                    isAnimationActive
                    animationDuration={900}
                    animationEasing='ease-out'
                  >
                    {data.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={COLORS[idx % COLORS.length]}
                        opacity={
                          hoveredSector === null ||
                          hoveredSector === data[idx].name
                            ? 1
                            : 0.35
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend rows - scrollable, compact */}
            <div className='flex flex-col gap-0.5 w-full max-h-[200px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1'>
              {data.map((d, idx) => (
                <div
                  key={d.name}
                  className='flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 cursor-default transition-colors hover:bg-white/60 dark:hover:bg-slate-800/60'
                  onMouseEnter={() => setHoveredSector(d.name)}
                  onMouseLeave={() => setHoveredSector(null)}
                >
                  <div className='flex items-center gap-2 min-w-0 flex-1'>
                    <span
                      className='h-2 w-2 shrink-0 rounded-full'
                      style={{ background: COLORS[idx % COLORS.length] }}
                    />
                    <span
                      className='truncate text-xs font-semibold text-slate-700 dark:text-slate-300'
                      title={d.name}
                    >
                      {d.name}
                    </span>
                  </div>
                  <div className='flex shrink-0 items-center gap-2 tabular-nums'>
                    <span className='text-[11px] font-bold text-slate-500 dark:text-slate-400'>
                      {d.pct}%
                    </span>
                    <span className='text-xs font-black text-slate-900 dark:text-slate-50'>
                      {formatINR(d.value)}
                    </span>
                  </div>
                </div>
              ))}
              {isLoading && pendingCount > 0 && (
                <MetadataLoader count={pendingCount} />
              )}
            </div>
          </div>

          {/* Bottom: top 4 sectors as mini progress bars */}
          <div className='border-t border-slate-100 dark:border-slate-800/50 pt-3 grid grid-cols-2 gap-x-6 gap-y-2.5'>
            {data.slice(0, 6).map((d, idx) => (
              <div key={d.name} className='flex flex-col gap-1'>
                <div className='flex items-center justify-between'>
                  <span
                    className='text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate pr-1'
                    title={d.name}
                  >
                    {d.name.length > 18 ? d.name.slice(0, 18) + '…' : d.name}
                  </span>
                  <span
                    className='text-[10px] font-black tabular-nums shrink-0'
                    style={{ color: COLORS[idx % COLORS.length] }}
                  >
                    {d.pct}%
                  </span>
                </div>
                <div className='h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
                  <div
                    className='h-full rounded-full transition-all duration-700'
                    style={{
                      width: `${d.pct}%`,
                      background: COLORS[idx % COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
