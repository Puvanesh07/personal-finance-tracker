// Agriculture — Overview + Farm Ledger (income, expenses, setup)

import { useState } from 'react';
import { AgricultureLoader } from '../../components/ui/SectionLoader';
import { AgriOverviewTab } from './AgriOverviewTab';
import { FarmIncomeTab } from './FarmIncomeTab';
import { useEnsureAgriHydrated } from '../../hooks/useDeferredStoreHydration';

const TABS = [
  { id: 'overview', label: 'Overview', emoji: '📊' },
  { id: 'ledger', label: 'Farm Ledger', emoji: '📒' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AgriculturePage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const ready = useEnsureAgriHydrated();

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
              Overview &amp; day-by-day ledger — auto-syncs to Dashboard &amp;
              Cashflow
            </p>
          </div>
        </div>
      </header>

      <div className='flex flex-wrap gap-2 p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800/60 w-fit'>
        {TABS.map((t) => (
          <button
            key={t.id}
            type='button'
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === t.id
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
            }`}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <AgriOverviewTab />}
      {activeTab === 'ledger' && <FarmIncomeTab />}
    </div>
  );
}
