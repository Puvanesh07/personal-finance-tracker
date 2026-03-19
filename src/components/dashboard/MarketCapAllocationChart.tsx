// src/components/dashboard/MarketCapAllocationChart.tsx
//
// FIX: Clickable market cap pills — clicking Large Cap / Mid Cap / Small Cap
//      navigates to /investments with that market cap pre-filtered via URL state.
//      All list rows are also clickable to filter.

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FiArrowUpRight, FiBarChart2, FiRefreshCw } from 'react-icons/fi';
import { useMemo, useState } from 'react';

import { Card } from '../ui/Card';
import type { MarketCapCategory } from '../../services/stockMetadataService';
import { MetadataLoader } from '../ui/SectionLoader';
import { currentValue } from '../../utils/calculations';
import { formatINR } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useStockMetadata } from '../../hooks/useStockMetadata';

const CAP_COLORS: Record<string, string> = {
  'Large Cap': '#6366F1',
  'Mid Cap': '#0EA5E9',
  'Small Cap': '#10B981',
  'Large & Mid Cap': '#F59E0B',
  'Multi Cap': '#EC4899',
  Hybrid: '#14B8A6',
  Debt: '#8B5CF6',
  Unknown: '#64748B',
};

const CAP_BG: Record<string, string> = {
  'Large Cap': 'rgba(99,102,241,0.1)',
  'Mid Cap': 'rgba(14,165,233,0.1)',
  'Small Cap': 'rgba(16,185,129,0.1)',
  'Large & Mid Cap': 'rgba(245,158,11,0.1)',
  'Multi Cap': 'rgba(236,72,153,0.1)',
  Hybrid: 'rgba(20,184,166,0.1)',
  Debt: 'rgba(139,92,246,0.1)',
  Unknown: 'rgba(100,116,139,0.1)',
};

const PILL_CATS: MarketCapCategory[] = ['Large Cap', 'Mid Cap', 'Small Cap'];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value, pct, stocks } = payload[0].payload;
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
      <div
        style={{
          color: CAP_COLORS[name] ?? '#6366F1',
          fontWeight: 800,
          marginTop: 2,
        }}
      >
        {pct}% of Portfolio
      </div>
      <div style={{ color: '#94A3B8', fontSize: 11, marginTop: 3 }}>
        {stocks} holding{stocks !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export function MarketCapAllocationChart() {
  const investments = usePortfolioStore((s) => s.investments);
  const { metadata, isLoading, refresh } = useStockMetadata(investments);
  const navigate = useNavigate();
  const [chartKey, setChartKey] = useState(0);
  const [hoveredCap, setHoveredCap] = useState<string | null>(null);

  const handleRefresh = () => {
    setChartKey((p) => p + 1);
    refresh();
  };

  // ✅ Navigate to investments page with marketCap filter via sessionStorage
  const handleCapClick = (cap: string) => {
    sessionStorage.setItem('inv_marketcap_filter', cap);
    navigate('/investments');
  };

  const { chartData, pills } = useMemo(() => {
    const capMap = new Map<string, { value: number; count: number }>();
    for (const inv of investments) {
      if (inv.type === 'fixed_deposit' || inv.type === 'bond') continue;
      const meta = metadata.get(inv.id);
      const cat = meta?.marketCapCategory ?? 'Unknown';
      const prev = capMap.get(cat) ?? { value: 0, count: 0 };
      capMap.set(cat, {
        value: prev.value + currentValue(inv),
        count: prev.count + 1,
      });
    }
    const total = Array.from(capMap.values()).reduce((a, b) => a + b.value, 0);
    const allData = Array.from(capMap.entries())
      .filter(([, v]) => v.value > 0)
      .map(([cat, { value, count }]) => ({
        name: cat,
        value,
        stocks: count,
        pct: total > 0 ? ((value / total) * 100).toFixed(1) : '0.0',
      }))
      .sort((a, b) => b.value - a.value);

    const pillsData = PILL_CATS.map((cat) => {
      const d = allData.find((x) => x.name === cat);
      return { cat, pct: d?.pct ?? '0.0', stocks: d?.stocks ?? 0 };
    });
    return { chartData: allData, pills: pillsData };
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
          <FiBarChart2 className='text-sky-500' /> Market Cap
        </div>
      }
      right={
        <button
          type='button'
          onClick={handleRefresh}
          className='group flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/50 px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800'
        >
          <FiRefreshCw
            className={`h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors ${isLoading ? 'animate-spin text-emerald-500' : ''}`}
          />
          <span>
            {isLoading ? `Fetching ${pendingCount}…` : 'Refresh Data'}
          </span>
        </button>
      }
    >
      {investments.length === 0 ? (
        <div className='grid h-40 place-items-center text-sm font-medium text-slate-500'>
          Add investments to see market cap breakdown.
        </div>
      ) : (
        <div className='flex flex-col gap-5 pt-2'>
          {/* ✅ Clickable Pills — Large / Mid / Small Cap */}
          <div className='grid grid-cols-3 gap-3'>
            {pills.map(({ cat, pct, stocks }) => (
              <button
                key={cat}
                type='button'
                onClick={() => handleCapClick(cat)}
                className='group rounded-xl p-3 flex flex-col gap-1.5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg text-left cursor-pointer'
                style={{
                  backgroundColor: CAP_BG[cat],
                  border: `1px solid ${CAP_COLORS[cat]}40`,
                }}
                title={`Filter investments by ${cat}`}
              >
                <div className='flex items-center justify-between'>
                  <span
                    className='text-[10px] font-black uppercase tracking-wider'
                    style={{ color: CAP_COLORS[cat] }}
                  >
                    {cat}
                  </span>
                  {/* ✅ Direction/redirect icon */}
                  <FiArrowUpRight
                    className='h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity'
                    style={{ color: CAP_COLORS[cat] }}
                  />
                </div>
                <span className='text-xl font-black text-slate-900 dark:text-slate-50 tabular-nums'>
                  {pct}%
                </span>
                <span className='text-[11px] font-semibold text-slate-500 dark:text-slate-400'>
                  {stocks} asset{stocks !== 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className='h-44 w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  key={chartKey}
                  data={chartData}
                  barCategoryGap='25%'
                  margin={{ top: 10, right: 0, bottom: 0, left: 0 }}
                >
                  <XAxis
                    dataKey='name'
                    tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    dy={5}
                  />
                  <YAxis hide />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: 'rgba(148,163,184,0.05)', radius: 8 }}
                  />
                  <Bar
                    dataKey='value'
                    radius={[6, 6, 0, 0]}
                    isAnimationActive
                    animationDuration={1000}
                    animationEasing='ease-out'
                    onClick={(data) =>
                      data.name && handleCapClick(data.name as string)
                    }
                    cursor='pointer'
                  >
                    {chartData.map((e) => (
                      <Cell
                        key={e.name}
                        fill={CAP_COLORS[e.name] ?? '#94A3B8'}
                        opacity={
                          hoveredCap === null || hoveredCap === e.name ? 1 : 0.4
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ✅ Clickable list rows */}
          <div className='flex flex-col gap-0.5 border-t border-slate-100 pt-3 dark:border-slate-800/60'>
            {chartData.map((e) => (
              <button
                key={e.name}
                type='button'
                onClick={() => handleCapClick(e.name)}
                className='group flex items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 w-full text-left'
                onMouseEnter={() => setHoveredCap(e.name)}
                onMouseLeave={() => setHoveredCap(null)}
                title={`Filter by ${e.name}`}
              >
                <div className='flex items-center gap-2.5'>
                  <span
                    className='h-2.5 w-2.5 rounded-full shrink-0 shadow-sm'
                    style={{ backgroundColor: CAP_COLORS[e.name] ?? '#94A3B8' }}
                  />
                  <span className='font-semibold text-slate-700 dark:text-slate-300'>
                    {e.name}
                  </span>
                  <span className='text-[11px] font-medium text-slate-400'>
                    ({e.stocks})
                  </span>
                </div>
                <div className='flex items-center gap-3 tabular-nums'>
                  <span className='text-slate-500 text-xs font-semibold'>
                    {formatINR(e.value)}
                  </span>
                  <span
                    className='font-bold text-sm'
                    style={{ color: CAP_COLORS[e.name] ?? '#94A3B8' }}
                  >
                    {e.pct}%
                  </span>
                  <FiArrowUpRight className='h-3.5 w-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity' />
                </div>
              </button>
            ))}
          </div>

          {isLoading && pendingCount > 0 && (
            <MetadataLoader count={pendingCount} />
          )}
        </div>
      )}
    </Card>
  );
}
