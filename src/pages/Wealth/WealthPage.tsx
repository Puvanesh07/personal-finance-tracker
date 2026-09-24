// src/pages/Wealth/WealthPage.tsx
//
// Wealth — one unified financial-management area with clean tab navigation:
//   • Assets      → the Investments manager (embedded, no duplicate header)
//   • Liabilities → Debts & Money Owed (embedded)
//   • Net Worth   → Net Worth Snapshots (embedded)
//   • Allocation  → sub-tabs: Asset Allocation | Monthly SIP Plan
//
// All tabs render the EXISTING pages/components — same store, same data,
// same business logic. Nothing is duplicated; every edit anywhere in the
// app flows straight into these tabs.

import { FiPercent, FiPieChart } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';

import { MarketCapAllocationChart } from '../../components/dashboard/MarketCapAllocationChart';
import { TargetAllocationPanel } from '../../components/investments/TargetAllocationPanel';
import { InvestmentsSkeleton } from '../../components/loader/skeletons';
import { MonthlySipPlanPage } from '../Investments/MonthlySipPlanPage';
import { InvestmentsPage } from '../Investments/InvestmentsPage';
import { LiabilitiesPage } from '../Liabilities/LiabilitiesPage';
import { SnapshotsPage } from '../Snapshots/SnapshotsPage';
import NetWorthTimelinePage from '../Timeline/NetWorthTimelinePage';
import { usePortfolioStore } from '../../store/portfolioStore';

type TabId = 'assets' | 'liabilities' | 'networth' | 'allocation';
type SubId = 'asset' | 'sip';

const TAB_META: Record<TabId, { title: string; sub: string }> = {
  assets: { title: 'Assets', sub: 'Everything you own — stocks, funds, FDs, gold and more' },
  liabilities: { title: 'Liabilities', sub: 'What you owe — loans, cards and money borrowed' },
  networth: { title: 'Net Worth', sub: 'Track your wealth at a point in time' },
  allocation: { title: 'Allocation', sub: 'Asset allocation & rebalancing' },
};

export function WealthPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = (['assets', 'liabilities', 'networth', 'allocation'] as const).includes(
    searchParams.get('tab') as TabId,
  )
    ? (searchParams.get('tab') as TabId)
    : 'assets';
  const sub: SubId = searchParams.get('sub') === 'sip' ? 'sip' : 'asset';

  const setTab = (next: TabId, nextSub?: SubId) => {
    const params: Record<string, string> = { tab: next };
    if (next === 'allocation') params.sub = nextSub ?? sub;
    setSearchParams(params, { replace: true });
  };

  if (!ready) return <InvestmentsSkeleton />;

  const tabCls = (id: TabId) =>
    `cursor-pointer border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
      tab === id
        ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
    }`;

  return (
    <div className='flex flex-col gap-6 pb-10 animate-in fade-in duration-500'>
      {/* ── Page header ── */}
      <header className='flex flex-col gap-1'>
        <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white'>
          {TAB_META[tab].title}
        </h1>
        <p className='text-sm font-medium text-slate-600 dark:text-slate-300'>
          {TAB_META[tab].sub}
        </p>
      </header>

      {/* ── Tabs ── */}
      <div className='flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800'>
        <button type='button' className={tabCls('assets')} onClick={() => setTab('assets')}>
          Assets
        </button>
        <button type='button' className={tabCls('liabilities')} onClick={() => setTab('liabilities')}>
          Liabilities
        </button>
        <button type='button' className={tabCls('networth')} onClick={() => setTab('networth')}>
          Net Worth
        </button>
        <button type='button' className={tabCls('allocation')} onClick={() => setTab('allocation')}>
          Allocation
        </button>
      </div>

      {/* ── Tab content ── */}
      {tab === 'assets' && <InvestmentsPage embedded />}
      {tab === 'liabilities' && <LiabilitiesPage embedded />}
      {tab === 'networth' && (
        <div className='flex flex-col gap-6'>
          <SnapshotsPage embedded />
          <NetWorthTimelinePage embedded />
        </div>
      )}
      {tab === 'allocation' && (
        <div className='flex flex-col gap-6'>
          {/* Sub-tabs */}
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => setTab('allocation', 'asset')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl cursor-pointer text-sm font-bold transition-all duration-200 ${
                sub === 'asset'
                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <FiPieChart className='h-3.5 w-3.5' /> Asset Allocation
            </button>
            <button
              type='button'
              onClick={() => setTab('allocation', 'sip')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl cursor-pointer text-sm font-bold transition-all duration-200 ${
                sub === 'sip'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                  : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <FiPercent className='h-3.5 w-3.5' /> Monthly SIP Plan
            </button>
          </div>

          {sub === 'sip' ? (
            <MonthlySipPlanPage />
          ) : (
            <>
              {/* FinBoom-style target vs actual allocation + insights */}
              <TargetAllocationPanel />
              {/* Fine-grained breakdowns (per-instrument & market-cap) */}
              <MarketCapAllocationChart />
            </>
          )}
        </div>
      )}
    </div>
  );
}
