// src/pages/Investments/MonthlySipPlanPage.tsx
//
// UPDATED: All data stored in Firestore via portfolioStore sipPlans collection.
//          budget doc (type="budget") + instrument docs (type="instrument")
//          Removed localStorage — all synced to Firebase

import {
  FiCheck,
  FiEdit2,
  FiPercent,
  FiPlus,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { useMemo, useState } from 'react';

import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';

type SipBudgetDoc = {
  id: string;
  type: 'budget';
  budget: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
};
type SipInstrumentDoc = {
  id: string;
  type: 'instrument';
  name: string;
  percentage: number;
  fromAsset?: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

function BudgetModal({
  current,
  onSave,
  onClose,
  saving,
}: {
  current: number;
  onSave: (v: number) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [val, setVal] = useState(current > 0 ? String(current) : '');
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4'>
      <div className='w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6'>
        <div className='flex items-center justify-between mb-5'>
          <h3 className='text-base font-bold text-slate-100'>
            Set Monthly Budget
          </h3>
          <button
            onClick={onClose}
            className='text-slate-500 hover:text-slate-300 transition-colors'
          >
            <FiX className='h-4 w-4' />
          </button>
        </div>
        <p className='text-sm text-slate-400 mb-4'>
          Enter the total amount you invest every month. Add instruments as a %
          of this budget.
        </p>
        <div className='relative'>
          <span className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold'>
            ₹
          </span>
          <input
            type='number'
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder='e.g. 25000'
            className='w-full rounded-xl border border-slate-700 bg-slate-800 pl-8 pr-4 py-3 text-sm font-semibold text-slate-100 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-600'
            autoFocus
          />
        </div>
        <div className='flex justify-end gap-3 mt-5'>
          <button
            onClick={onClose}
            disabled={saving}
            className='px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(Number(val) || 0)}
            disabled={saving || !val}
            className='px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-60'
          >
            {saving ? (
              <span className='h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin' />
            ) : (
              <FiCheck className='h-4 w-4' />
            )}
            Save Budget
          </button>
        </div>
      </div>
    </div>
  );
}

function InstrumentForm({
  investmentNames,
  onSave,
  onCancel,
  saving,
  existing,
}: {
  investmentNames: { id: string; name: string }[];
  onSave: (name: string, pct: number, fromAsset: boolean) => void;
  onCancel: () => void;
  saving: boolean;
  existing?: SipInstrumentDoc;
}) {
  const [mode, setMode] = useState<'asset' | 'custom'>(
    existing?.fromAsset ? 'asset' : 'custom',
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [pct, setPct] = useState(existing ? String(existing.percentage) : '');
  const [selectedAssetId, setSelectedAssetId] = useState('');

  const handleSave = () => {
    const finalName =
      mode === 'asset'
        ? (investmentNames.find((i) => i.id === selectedAssetId)?.name ?? name)
        : name.trim();
    if (!finalName || !pct) return;
    onSave(finalName, Number(pct) || 0, mode === 'asset');
  };

  return (
    <div className='rounded-xl border border-emerald-500/30 bg-slate-800/60 p-4'>
      <div className='flex gap-2 mb-4'>
        <button
          type='button'
          onClick={() => setMode('asset')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'asset' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          ⇌ From Assets
        </button>
        <button
          type='button'
          onClick={() => setMode('custom')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${mode === 'custom' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}
        >
          T Custom Name
        </button>
      </div>
      <div className='flex items-center gap-3'>
        {mode === 'custom' ? (
          <input
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. Goldbees, Axis Small Cap…'
            className='flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 outline-none focus:border-emerald-500/60 placeholder:text-slate-600'
            autoFocus
          />
        ) : (
          <select
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            className='flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 outline-none focus:border-emerald-500/60'
          >
            <option value=''>Select an investment…</option>
            {investmentNames.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name}
              </option>
            ))}
          </select>
        )}
        <span className='text-xs text-slate-500 font-medium shrink-0 hidden sm:block'>
          Monthly amt
        </span>
        <div className='relative shrink-0'>
          <input
            type='number'
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder='%'
            min={0}
            max={100}
            className='w-20 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none focus:border-emerald-500/60 pr-6'
          />
          <FiPercent className='absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500' />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60'
        >
          {saving ? (
            <span className='h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin' />
          ) : (
            <FiCheck className='h-4 w-4' />
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors'
        >
          <FiX className='h-4 w-4' />
        </button>
      </div>
    </div>
  );
}

export function MonthlySipPlanPage() {
  const investments = usePortfolioStore((s) => s.investments);
  const sipPlans = usePortfolioStore((s) => s.sipPlans) as (
    | SipBudgetDoc
    | SipInstrumentDoc
  )[];
  const addSipInstrument = usePortfolioStore((s) => s.addSipInstrument);
  const updateSipInstrument = usePortfolioStore((s) => s.updateSipInstrument);
  const deleteSipInstrument = usePortfolioStore((s) => s.deleteSipInstrument);
  const upsertSipBudget = usePortfolioStore((s) => s.upsertSipBudget);

  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [savingInstrument, setSavingInstrument] = useState(false);

  const investmentNames = useMemo(
    () => investments.map((i) => ({ id: i.id, name: i.name })),
    [investments],
  );

  const budgetDoc = sipPlans.find((p) => p.type === 'budget') as
    | SipBudgetDoc
    | undefined;
  const instruments = sipPlans.filter(
    (p) => p.type === 'instrument',
  ) as SipInstrumentDoc[];
  const budget = budgetDoc?.budget ?? 0;
  const totalPct = instruments.reduce((a, i) => a + i.percentage, 0);
  const remaining = 100 - totalPct;

  const handleSaveBudget = async (v: number) => {
    setSavingBudget(true);
    try {
      await upsertSipBudget(v);
      setShowBudgetModal(false);
    } finally {
      setSavingBudget(false);
    }
  };

  const handleAddInstrument = async (
    name: string,
    percentage: number,
    fromAsset: boolean,
  ) => {
    setSavingInstrument(true);
    try {
      await addSipInstrument({ name, percentage, fromAsset });
      setShowAddForm(false);
    } finally {
      setSavingInstrument(false);
    }
  };

  const handleEditInstrument = async (
    id: string,
    name: string,
    percentage: number,
    fromAsset: boolean,
  ) => {
    setSavingInstrument(true);
    try {
      await updateSipInstrument(id, { name, percentage, fromAsset });
      setEditingId(null);
    } finally {
      setSavingInstrument(false);
    }
  };

  const handleDelete = (id: string) => deleteSipInstrument(id);

  return (
    <div className='space-y-6 pb-10'>
      {/* Budget hint */}
      <div className='rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex items-start gap-3'>
        <span className='text-2xl shrink-0'>💡</span>
        <div>
          <p className='text-sm font-bold text-slate-200'>
            Set a monthly budget
          </p>
          <p className='text-sm text-slate-400 mt-0.5'>
            Enter a total monthly amount and then add each instrument as a
            percentage — e.g.{' '}
            <span className='font-bold text-slate-200'>
              Axis BC Fund at 30%
            </span>
            , Nifty at 50%, etc.
          </p>
          <button
            onClick={() => setShowBudgetModal(true)}
            className='mt-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors'
          >
            {budget > 0 ? 'Edit budget →' : 'Set budget →'}
          </button>
        </div>
      </div>

      {/* Budget bar */}
      {budget > 0 && (
        <div className='rounded-2xl border border-slate-800 bg-slate-900/50 p-5'>
          <div className='flex items-center justify-between mb-3'>
            <div>
              <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>
                Monthly Budget
              </p>
              <p className='text-2xl font-bold text-slate-100 mt-1'>
                {formatINR(budget)}
              </p>
            </div>
            <button
              onClick={() => setShowBudgetModal(true)}
              className='text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 bg-slate-800 px-3 py-1.5 rounded-lg'
            >
              <FiEdit2 className='h-3 w-3' /> Edit
            </button>
          </div>
          <div className='w-full h-2 rounded-full bg-slate-800 overflow-hidden'>
            <div
              className={`h-full rounded-full transition-all duration-500 ${totalPct > 100 ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, totalPct)}%` }}
            />
          </div>
          <div className='flex items-center justify-between mt-2'>
            <p className='text-xs text-slate-400'>
              {totalPct.toFixed(0)}% allocated
              {remaining > 0 && (
                <span className='text-slate-500'>
                  {' '}
                  · {remaining.toFixed(0)}% remaining
                </span>
              )}
              {totalPct > 100 && (
                <span className='text-red-400'>
                  {' '}
                  · Over-allocated by {(totalPct - 100).toFixed(0)}%
                </span>
              )}
            </p>
            <p className='text-xs font-bold text-slate-300'>
              {formatINR((budget * totalPct) / 100)} / {formatINR(budget)}
            </p>
          </div>
        </div>
      )}

      {/* Instruments */}
      <div className='rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden'>
        {instruments.length === 0 && !showAddForm ? (
          <div className='flex flex-col items-center justify-center py-16 text-center px-6'>
            <span className='text-5xl mb-4'>💰</span>
            <p className='text-base font-semibold text-slate-300'>
              No monthly SIP plan yet
            </p>
            <p className='text-sm text-slate-500 mt-1 max-w-xs'>
              Track your monthly investments across mutual funds, stocks, and
              other instruments.
            </p>
            <p className='text-xs text-slate-600 mt-1'>
              Add your SIPs to see where your money goes each month.
            </p>
          </div>
        ) : (
          <div className='divide-y divide-slate-800/60'>
            {instruments.map((inst) => {
              const monthlyAmt =
                budget > 0 ? (budget * inst.percentage) / 100 : 0;
              return editingId === inst.id ? (
                <div key={inst.id} className='p-4'>
                  <InstrumentForm
                    investmentNames={investmentNames}
                    existing={inst}
                    saving={savingInstrument}
                    onSave={(name, pct, fromAsset) =>
                      handleEditInstrument(inst.id, name, pct, fromAsset)
                    }
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div
                  key={inst.id}
                  className='flex items-center gap-4 px-5 py-4 hover:bg-slate-800/30 transition-colors group'
                >
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-semibold text-slate-100 truncate'>
                      {inst.name}
                    </p>
                    {inst.fromAsset && (
                      <p className='text-[10px] text-slate-500 mt-0.5'>
                        Linked from assets
                      </p>
                    )}
                  </div>
                  {budget > 0 && (
                    <p className='text-sm font-bold text-emerald-400 tabular-nums shrink-0'>
                      {formatINR(monthlyAmt)}
                    </p>
                  )}
                  <div className='flex items-center gap-1 shrink-0'>
                    <span className='text-sm font-bold text-slate-200 tabular-nums'>
                      {inst.percentage}
                    </span>
                    <span className='text-xs text-slate-500'>%</span>
                  </div>
                  <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0'>
                    <button
                      onClick={() => setEditingId(inst.id)}
                      className='p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors'
                    >
                      <FiEdit2 className='h-3.5 w-3.5' />
                    </button>
                    <button
                      onClick={() => handleDelete(inst.id)}
                      className='p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors'
                    >
                      <FiTrash2 className='h-3.5 w-3.5' />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {showAddForm && (
          <div className='p-4 border-t border-slate-800/60'>
            <InstrumentForm
              investmentNames={investmentNames}
              saving={savingInstrument}
              onSave={handleAddInstrument}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}
        <button
          onClick={() => {
            setShowAddForm(true);
            setEditingId(null);
          }}
          className='w-full flex items-center justify-center gap-2 py-4 text-sm font-bold text-slate-400 hover:text-emerald-400 hover:bg-slate-800/30 border-t border-slate-800/60 transition-colors'
        >
          <FiPlus className='h-4 w-4' /> Add Instrument
        </button>
      </div>

      {showBudgetModal && (
        <BudgetModal
          current={budget}
          onSave={handleSaveBudget}
          onClose={() => setShowBudgetModal(false)}
          saving={savingBudget}
        />
      )}
    </div>
  );
}
