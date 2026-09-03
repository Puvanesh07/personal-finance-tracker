/**
 * src/pages/Timeline/NetWorthTimelinePage.tsx
 *
 * Net Worth Timeline — Feature 3.
 * Shows how net worth changed daily/monthly/yearly using networthSnapshots
 * + live computation. No external charting lib needed — pure CSS bars.
 */

import { useMemo, useState } from 'react';
import {
  FiTrendingUp, FiTrendingDown, FiCalendar,
  FiArrowUp, FiArrowDown, FiClock,
} from 'react-icons/fi';
import { usePortfolioStore } from '../../store/portfolioStore';
import { calculateNetWorth } from '../../utils/calculations';
import { formatINR, formatNumber } from '../../utils/format';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'monthly' | 'quarterly' | 'yearly';

interface TimelinePoint {
  label: string;        // e.g. "Jan 26", "Q1 26", "2025"
  date: string;         // ISO
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  delta: number;        // vs previous point
  deltaPct: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}
function quarterLabel(iso: string): string {
  const d = new Date(iso);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.toLocaleDateString('en-IN', { year: '2-digit' })}`;
}
function yearLabel(iso: string): string {
  return new Date(iso).getFullYear().toString();
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)      return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NetWorthTimelinePage() {
  const networthSnapshots = usePortfolioStore((s) => s.networthSnapshots);
  const investments       = usePortfolioStore((s) => s.investments);
  const liabilities       = usePortfolioStore((s) => s.liabilities);
  const [view, setView]   = useState<ViewMode>('monthly');

  // Inject live "today" point
  const { totalAssets, totalLiabilities, netWorth: liveNW } = useMemo(
    () => calculateNetWorth(investments, liabilities),
    [investments, liabilities],
  );

  const allPoints = useMemo(() => {
    const todayISO = new Date().toISOString();
    const live = {
      id: '__live__',
      createdAt: todayISO,
      netWorth: liveNW,
      totalAssets,
      totalLiabilities,
      label: undefined,
    };
    const raw = [...networthSnapshots, live]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    // Group by view mode
    const grouped = new Map<string, typeof raw[0]>();
    for (const s of raw) {
      const key =
        view === 'monthly'   ? monthLabel(s.createdAt)
        : view === 'quarterly' ? quarterLabel(s.createdAt)
        : yearLabel(s.createdAt);
      grouped.set(key, s); // keep latest per bucket
    }

    const buckets = [...grouped.entries()];
    const points: TimelinePoint[] = buckets.map(([label, s], i) => {
      const prev = i > 0 ? buckets[i - 1][1] : null;
      const delta = prev ? s.netWorth - prev.netWorth : 0;
      const deltaPct = prev && prev.netWorth !== 0
        ? (delta / Math.abs(prev.netWorth)) * 100 : 0;
      return {
        label,
        date: s.createdAt,
        netWorth: s.netWorth,
        totalAssets: s.totalAssets,
        totalLiabilities: s.totalLiabilities,
        delta,
        deltaPct,
      };
    });
    return points;
  }, [networthSnapshots, view, liveNW, totalAssets, totalLiabilities]);

  // Summary stats
  const latest    = allPoints[allPoints.length - 1];
  const earliest  = allPoints[0];
  const thisYear  = new Date().getFullYear().toString();
  const ytdPoints = allPoints.filter((p) => p.date.startsWith(thisYear));
  const ytdDelta  = ytdPoints.length >= 2
    ? (ytdPoints[ytdPoints.length - 1].netWorth - ytdPoints[0].netWorth)
    : 0;
  const last12    = allPoints.slice(-13);
  const growth12M = last12.length >= 2
    ? ((last12[last12.length - 1].netWorth - last12[0].netWorth) / Math.abs(last12[0].netWorth || 1)) * 100
    : 0;

  // Bar chart scale
  const maxNW    = Math.max(...allPoints.map((p) => p.netWorth), 1);
  const minNW    = Math.min(...allPoints.map((p) => p.netWorth), 0);
  const range    = maxNW - minNW || 1;
  const barPct   = (nw: number) => Math.max(2, Math.min(100, ((nw - minNW) / range) * 100));

  const [hovered, setHovered] = useState<TimelinePoint | null>(null);

  if (!networthSnapshots.length && liveNW === 0) {
    return (
      <div className='rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center'>
        <FiClock className='h-10 w-10 mx-auto text-slate-400 mb-3' />
        <p className='font-semibold text-slate-600 dark:text-slate-400'>No timeline data yet.</p>
        <p className='text-sm text-slate-400 mt-1'>Take snapshots from the Snapshots page to build your timeline.</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6 pb-12'>

      {/* Header */}
      <header className='rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg'>
            <FiTrendingUp className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>Net Worth Timeline</h1>
            <p className='text-sm text-slate-500 dark:text-slate-400 mt-0.5'>
              Track how your wealth grows over time.
            </p>
          </div>
        </div>
      </header>

      {/* Summary cards */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        {[
          {
            label: 'Current Net Worth',
            value: formatINR(liveNW),
            sub: 'live',
            color: liveNW >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500',
          },
          {
            label: 'This Month',
            value: (latest?.delta ?? 0) >= 0 ? `+${formatINR(latest?.delta ?? 0)}` : formatINR(latest?.delta ?? 0),
            sub: `${(latest?.deltaPct ?? 0) >= 0 ? '+' : ''}${formatNumber(latest?.deltaPct ?? 0, 1)}%`,
            color: (latest?.delta ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500',
          },
          {
            label: `YTD ${thisYear}`,
            value: ytdDelta >= 0 ? `+${formatINR(ytdDelta)}` : formatINR(ytdDelta),
            sub: 'year to date',
            color: ytdDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500',
          },
          {
            label: '12-Month Growth',
            value: `${growth12M >= 0 ? '+' : ''}${formatNumber(growth12M, 1)}%`,
            sub: earliest ? `from ${formatCompact(earliest.netWorth)}` : '',
            color: growth12M >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500',
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1'>{label}</p>
            <p className={`text-lg font-black tabular-nums ${color}`}>{value}</p>
            {sub && <p className='text-[10px] text-slate-400 mt-0.5'>{sub}</p>}
          </div>
        ))}
      </div>

      {/* View toggle + chart */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5'>
        <div className='flex items-center justify-between mb-5'>
          <h2 className='text-sm font-bold text-slate-700 dark:text-slate-200'>Net Worth Over Time</h2>
          <div className='flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1'>
            {(['monthly', 'quarterly', 'yearly'] as ViewMode[]).map((v) => (
              <button
                key={v}
                type='button'
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  view === v
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div className='overflow-x-auto pb-2'>
          <div className='flex items-end gap-1.5 min-w-max' style={{ minHeight: 180 }}>
            {allPoints.map((p, i) => {
              const isLive  = p.date.startsWith(new Date().toISOString().slice(0, 7));
              const isUp    = p.delta >= 0;
              const pct     = barPct(p.netWorth);
              return (
                <div
                  key={i}
                  className='flex flex-col items-center gap-1 cursor-pointer'
                  onMouseEnter={() => setHovered(p)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className={`w-8 rounded-t-lg transition-all ${
                      isLive      ? 'bg-violet-500'
                      : isUp      ? 'bg-emerald-500 hover:bg-emerald-400'
                      : 'bg-rose-400 hover:bg-rose-300'
                    }`}
                    style={{ height: `${pct * 1.6}px` }}
                  />
                  <span className='text-[9px] text-slate-400 whitespace-nowrap'>{p.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hover tooltip */}
        {hovered && (
          <div className='mt-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-wrap gap-4 text-xs'>
            <div>
              <p className='text-slate-400 uppercase tracking-wider text-[9px] font-bold'>Period</p>
              <p className='font-bold text-slate-900 dark:text-slate-100'>{hovered.label}</p>
            </div>
            <div>
              <p className='text-slate-400 uppercase tracking-wider text-[9px] font-bold'>Net Worth</p>
              <p className='font-bold text-slate-900 dark:text-slate-100'>{formatINR(hovered.netWorth)}</p>
            </div>
            <div>
              <p className='text-slate-400 uppercase tracking-wider text-[9px] font-bold'>Assets</p>
              <p className='font-bold text-emerald-600 dark:text-emerald-400'>{formatINR(hovered.totalAssets)}</p>
            </div>
            <div>
              <p className='text-slate-400 uppercase tracking-wider text-[9px] font-bold'>Liabilities</p>
              <p className='font-bold text-rose-500'>{formatINR(hovered.totalLiabilities)}</p>
            </div>
            <div>
              <p className='text-slate-400 uppercase tracking-wider text-[9px] font-bold'>Change</p>
              <p className={`font-bold flex items-center gap-1 ${hovered.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                {hovered.delta >= 0 ? <FiArrowUp className='h-3 w-3' /> : <FiArrowDown className='h-3 w-3' />}
                {hovered.delta >= 0 ? '+' : ''}{formatINR(hovered.delta)} ({hovered.deltaPct >= 0 ? '+' : ''}{formatNumber(hovered.deltaPct, 1)}%)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline list */}
      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden'>
        <div className='px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800'>
          <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400'>Change History</p>
        </div>
        <div className='divide-y divide-slate-100 dark:divide-slate-800'>
          {[...allPoints].reverse().map((p, i) => (
            <div key={i} className='flex items-center justify-between px-5 py-3'>
              <div className='flex items-center gap-3'>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${p.delta >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                  {p.delta >= 0
                    ? <FiTrendingUp className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
                    : <FiTrendingDown className='h-3.5 w-3.5 text-rose-500' />}
                </div>
                <div>
                  <p className='text-sm font-semibold text-slate-900 dark:text-slate-100'>{p.label}</p>
                  <p className='text-[10px] text-slate-400'>{new Date(p.date).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
              <div className='text-right'>
                <p className='text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100'>{formatINR(p.netWorth)}</p>
                {i < allPoints.length - 1 && p.delta !== 0 && (
                  <p className={`text-[10px] font-semibold ${p.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {p.delta >= 0 ? '+' : ''}{formatINR(p.delta)} ({p.deltaPct >= 0 ? '+' : ''}{formatNumber(p.deltaPct, 1)}%)
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className='text-[10px] text-slate-400 dark:text-slate-600 text-center'>
        Live point reflects current investments & liabilities. Take a snapshot to lock in a data point.
      </p>
    </div>
  );
}

// suppress unused icon
void FiCalendar;
