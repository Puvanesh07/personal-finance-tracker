// Agriculture — Overview → My Farm → Farm Ledger

import { useState } from 'react';
import { AgricultureLoader } from '../../components/ui/SectionLoader';
import { AgriOverviewTab } from './AgriOverviewTab';
import { FarmIncomeTab } from './FarmIncomeTab';
import { PlantationsTab } from './PlantationsTab';
import { useEnsureAgriHydrated } from '../../hooks/useDeferredStoreHydration';

const TABS = [
  { id: 'overview', label: 'Overview', emoji: '📊' },
  { id: 'farm', label: 'My Farm', emoji: '🌱' },
  { id: 'ledger', label: 'Farm Ledger', emoji: '📒' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AgriculturePage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const ready = useEnsureAgriHydrated();

  if (!ready) return <AgricultureLoader />;

  return (
    <div className='flex flex-col gap-6 pb-12'>
      <header className='rounded-2xl border border-green-500/20 bg-gradient-to-r from-green-600/10 via-emerald-500/5 to-transparent p-6'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-2xl text-white shadow-lg shadow-green-500/25'>
            🌾
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>
              Agriculture
            </h1>
            <p className='mt-0.5 text-sm text-slate-500 dark:text-slate-400'>
              Overview for totals · My Farm for crops &amp; animals · Farm Ledger for daily entries
            </p>
          </div>
        </div>
      </header>

      <div className='flex w-fit flex-wrap gap-2 rounded-xl border border-slate-200/70 bg-white p-1.5 dark:border-slate-800/60 dark:bg-slate-900'>
        {TABS.map((t) => (
          <button
            key={t.id}
            type='button'
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all ${
              activeTab === t.id
                ? 'border border-emerald-500/25 bg-emerald-500/15 text-emerald-700 shadow-sm dark:text-emerald-400'
                : 'border border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <AgriOverviewTab
          onGoToFarm={() => setActiveTab('farm')}
          onGoToLedger={() => setActiveTab('ledger')}
        />
      )}
      {activeTab === 'farm' && (
        <PlantationsTab onGoToLedger={() => setActiveTab('ledger')} />
      )}
      {activeTab === 'ledger' && (
        <FarmIncomeTab onOpenFarmSetup={() => setActiveTab('farm')} />
      )}
    </div>
  );
}
