// src/pages/Liabilities/LiabilitiesPage.tsx

import {
  FiCheck,
  FiClock,
  FiCreditCard,
  FiDownload,
  FiEdit2,
  FiPieChart,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';

import { LiabilitiesSkeleton } from '../../components/loader/skeletons';
import { PendingPaymentsTab } from '../../components/liabilities/PendingPaymentsTab';
import type { Liability } from '../../types/investmentTypes';
import { SavedViewsMenu } from '../../components/ui/SavedViewsMenu';
import { Modal } from '../../components/ui/Modal';
import { UpsertLiabilityModal } from '../../components/liabilities/UpsertLiabilityModal';
import { buildLiabilityInsights } from '../../utils/advancedInsights';
import { formatINR } from '../../utils/format';
import { exportLiabilitiesCSV } from '../../utils/exportUtils';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { usePremiumActions } from '../../hooks/usePremiumActions';
import { AsyncButton } from '../../components/ui/AsyncButton';

// NEW: 'settled' tab groups both "paid" credit cards and "returned" personal loans
type FilterTab = 'all' | 'active' | 'settled';
type PageSection = 'debts' | 'pending_payments';

export function LiabilitiesPage() {
  const { premiumActionProps } = usePremiumActions();
  const ready = usePortfolioStore((s) => s.ready);
  const liabilities = usePortfolioStore((s) => s.liabilities);
  const deleteLiability = usePortfolioStore((s) => s.deleteLiability);
  const updateLiability = usePortfolioStore((s) => s.updateLiability);
  const { busy: deleteBusy, run: runDelete } = useAsyncAction();

  // Only count truly active liabilities in the top summary metrics
  const activeliabilities = liabilities.filter(
    (l) => l.status !== 'returned' && l.status !== 'paid',
  );

  const totalOutstanding = activeliabilities.reduce(
    (a, l) => a + (l.outstanding || 0),
    0,
  );

  const loanTotal = activeliabilities
    .filter((l) => l.type === 'loan')
    .reduce((a, l) => a + (l.outstanding || 0), 0);
  const ccTotal = activeliabilities
    .filter((l) => l.type === 'credit_card')
    .reduce((a, l) => a + (l.outstanding || 0), 0);
  const personalTotal = activeliabilities
    .filter((l) => l.type === 'other')
    .reduce((a, l) => a + (l.outstanding || 0), 0);

  const loanPct = totalOutstanding ? (loanTotal / totalOutstanding) * 100 : 0;
  const ccPct = totalOutstanding ? (ccTotal / totalOutstanding) * 100 : 0;
  const personalPct = totalOutstanding
    ? (personalTotal / totalOutstanding) * 100
    : 0;

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const edit = liabilities.find((l) => l.id === editId) ?? null;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [filterTab, setFilterTab] = useState<FilterTab>('active');
  const [searchParams] = useSearchParams();
  const [pageSection, setPageSection] = useState<PageSection>('debts');

  useEffect(() => {
    const section = searchParams.get('section');
    if (section === 'pending-payments' || section === 'pending_payments') {
      setPageSection('pending_payments');
    }
  }, [searchParams]);

  const openDeleteModal = (id: string) => {
    setSelectedId(id);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedId) return;
    void runDelete(async () => {
      await deleteLiability(selectedId);
      setDeleteOpen(false);
      setSelectedId(null);
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredLiabilities.map((l) => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const confirmBulkDelete = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    void runDelete(async () => {
      await Promise.all(ids.map((id) => deleteLiability(id)));
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    });
  };

  const handleExportSelected = () => {
    const list = liabilities.filter((l) => selectedIds.has(l.id));
    exportLiabilitiesCSV(list, 'liabilities-selection.csv');
  };

  // Quick "Mark as Returned" for personal loans
  async function markAsReturned(l: Liability) {
    await updateLiability(l.id, {
      status: 'returned',
      outstanding: 0,
      returnedAt: new Date().toISOString().split('T')[0],
    } as any);
  }

  // NEW: Quick "Mark as Paid" for credit cards
  async function markAsPaid(l: Liability) {
    await updateLiability(l.id, {
      status: 'paid',
      outstanding: 0,
    } as any);
  }

  if (!ready) return <LiabilitiesSkeleton />;

  const filteredLiabilities = liabilities.filter((l) => {
    if (filterTab === 'active')
      return l.status !== 'returned' && l.status !== 'paid';
    if (filterTab === 'settled')
      return l.status === 'returned' || l.status === 'paid';
    return true; // 'all'
  });

  const getTypeLabel = (type: string) => {
    if (type === 'other') return 'Personal';
    if (type === 'loan') return 'Bank Loan';
    if (type === 'credit_card') return 'Credit Card';
    return type;
  };

  const getDaysLeft = (endDate?: string, outstanding?: number) => {
    if (endDate && (outstanding || 0) > 0) {
      const due = new Date(endDate);
      const today = new Date();
      const diffTime = due.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return null;
  };

  const tabCls = (tab: FilterTab) =>
    `px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
      filterTab === tab
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-100 border border-transparent'
    }`;

  const sectionCls = (section: PageSection) =>
    `flex items-center gap-2 px-5 py-2.5 text-sm font-bold cursor-pointer rounded-xl transition-all duration-200 ${
      pageSection === section
        ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
    }`;

  const settledCount = liabilities.filter(
    (l) => l.status === 'returned' || l.status === 'paid',
  ).length;
  const liabilityInsights = useMemo(
    () => buildLiabilityInsights(liabilities),
    [liabilities],
  );

  if (pageSection === 'pending_payments') {
    return (
      <div className='flex flex-col gap-6 pb-8 animate-in fade-in duration-500'>
        <div className='flex flex-wrap gap-2 rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-100/80 dark:bg-slate-900/40 p-2'>
          <button
            type='button'
            className={sectionCls('debts')}
            onClick={() => setPageSection('debts')}
          >
            <FiCreditCard className='h-4 w-4' />
            What I Owe
          </button>
          <button
            type='button'
            className={sectionCls('pending_payments')}
            onClick={() => setPageSection('pending_payments')}
          >
            <FiClock className='h-4 w-4' />
            Pending Payments
          </button>
        </div>
        <PendingPaymentsTab />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6 pb-8 animate-in fade-in duration-500'>
      <div className='flex flex-wrap gap-2 rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-slate-100/80 dark:bg-slate-900/40 p-2'>
        <button
          type='button'
          className={sectionCls('debts')}
          onClick={() => setPageSection('debts')}
        >
          <FiCreditCard className='h-4 w-4' />
          What I Owe
        </button>
        <button
          type='button'
          className={sectionCls('pending_payments')}
          onClick={() => setPageSection('pending_payments')}
        >
          <FiClock className='h-4 w-4' />
          Pending Payments
        </button>
      </div>

      <header className='flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'>
            <FiCreditCard className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white'>
              Borrowed Money & Bills
            </h1>
            <p className='mt-1 text-sm font-medium text-slate-600 dark:text-slate-300'>
              Track loans, personal debts, and upcoming credit card bills.
            </p>
          </div>
        </div>
        <button
          {...premiumActionProps}
          className='group relative flex items-center cursor-pointer justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-3 md:py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0'
          onClick={() => setOpen(true)}
          type='button'
        >
          <div className='absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0' />
          <FiPlus className='relative h-4 w-4' />
          <span className='relative font-bold'>Add Record</span>
        </button>
      </header>

      {/* Summary Cards */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <div className='relative overflow-hidden rounded-2xl border border-rose-600 bg-gradient-to-br from-rose-500 to-rose-700 p-6 shadow-lg shadow-rose-500/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl'>
          <div className='text-sm font-bold uppercase tracking-wider text-rose-100'>
            Total Active Debt
          </div>
          <div className='mt-3 text-4xl font-black tabular-nums tracking-tight text-white'>
            {formatINR(totalOutstanding)}
          </div>
          {settledCount > 0 && (
            <div className='mt-1 text-xs text-rose-200/70'>
              {settledCount} settled records excluded
            </div>
          )}
          <FiCreditCard className='absolute -bottom-4 -right-4 h-32 w-32 text-rose-400/30' />
        </div>

        <div className='lg:col-span-2 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50 p-6 flex flex-col justify-center'>
          <div className='flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-5'>
            <FiPieChart className='h-4 w-4' />
            Debt Breakdown (Active Only)
          </div>

          {totalOutstanding === 0 ? (
            <div className='flex h-16 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 text-sm font-medium text-slate-500 dark:text-slate-400'>
              No active debt. Great job!
            </div>
          ) : (
            <div className='space-y-5'>
              <div className='flex h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800'>
                {loanPct > 0 && (
                  <div
                    style={{ width: `${loanPct}%` }}
                    className='bg-indigo-500 transition-all duration-1000'
                  />
                )}
                {ccPct > 0 && (
                  <div
                    style={{ width: `${ccPct}%` }}
                    className='bg-rose-500 transition-all duration-1000'
                  />
                )}
                {personalPct > 0 && (
                  <div
                    style={{ width: `${personalPct}%` }}
                    className='bg-emerald-500 transition-all duration-1000'
                  />
                )}
              </div>

              <div className='grid grid-cols-2 md:flex md:flex-wrap items-center gap-4 md:gap-8'>
                <div className='flex items-center gap-3'>
                  <div className='h-3 w-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' />
                  <div>
                    <div className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5'>
                      Bank Loans
                    </div>
                    <div className='text-sm font-black text-slate-900 dark:text-slate-100'>
                      {formatINR(loanTotal)}
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-3'>
                  <div className='h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' />
                  <div>
                    <div className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5'>
                      Credit Cards
                    </div>
                    <div className='text-sm font-black text-slate-900 dark:text-slate-100'>
                      {formatINR(ccTotal)}
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-3'>
                  <div className='h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' />
                  <div>
                    <div className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5'>
                      Personal
                    </div>
                    <div className='text-sm font-black text-slate-900 dark:text-slate-100'>
                      {formatINR(personalTotal)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-4 gap-3'>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Interest leak / month
          </p>
          <p className='mt-1 text-lg font-black text-rose-600 dark:text-rose-400'>
            {formatINR(liabilityInsights.monthlyInterestLeak)}
          </p>
        </div>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Weighted interest
          </p>
          <p className='mt-1 text-lg font-black text-slate-900 dark:text-slate-100'>
            {liabilityInsights.weightedRate.toFixed(2)}%
          </p>
        </div>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Avalanche target
          </p>
          <p className='mt-1 text-sm font-bold text-slate-900 dark:text-slate-100'>
            {liabilityInsights.avalancheTarget?.name ?? '—'}
          </p>
        </div>
        <div className='rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Snowball target
          </p>
          <p className='mt-1 text-sm font-bold text-slate-900 dark:text-slate-100'>
            {liabilityInsights.snowballTarget?.name ?? '—'}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      {liabilities.length > 0 && (
        <div className='flex flex-wrap items-center gap-2'>
          <SavedViewsMenu
            pageId='liabilities'
            getState={() => ({ filterTab })}
            applyState={(s) => {
              if (
                s.filterTab === 'all' ||
                s.filterTab === 'active' ||
                s.filterTab === 'settled'
              )
                setFilterTab(s.filterTab);
            }}
          />
          <button
            className={tabCls('active')}
            onClick={() => setFilterTab('active')}
          >
            Active ({activeliabilities.length})
          </button>
          <button
            className={tabCls('settled')}
            onClick={() => setFilterTab('settled')}
          >
            ✅ Settled ({settledCount})
          </button>
          <button className={tabCls('all')} onClick={() => setFilterTab('all')}>
            All
          </button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className='flex flex-wrap justify-end gap-2'>
          <button
            type='button'
            onClick={handleExportSelected}
            className='flex items-center cursor-pointer gap-2 rounded-xl border border-slate-200/80 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
          >
            <FiDownload className='h-4 w-4' /> Export selected ({selectedIds.size}
            )
          </button>
          <button
            type='button'
            onClick={() => setBulkDeleteOpen(true)}
            className='flex items-center cursor-pointer gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700 shadow-sm'
          >
            <FiTrash2 className='h-4 w-4' /> Delete Selected ({selectedIds.size}
            )
          </button>
        </div>
      )}

      {/* 📱 Mobile Card View */}
      <div className='block md:hidden space-y-4'>
        {filteredLiabilities.length === 0 ? (
          <div className='rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-10 text-center'>
            <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20'>
              <FiCreditCard className='h-6 w-6 text-emerald-600 dark:text-emerald-400' />
            </div>
            <p className='mt-4 text-sm font-bold text-slate-600 dark:text-slate-400'>
              {filterTab === 'settled'
                ? 'No settled liabilities.'
                : "No records found. You're debt free!"}
            </p>
          </div>
        ) : (
          filteredLiabilities.map((l) => {
            const daysLeft = getDaysLeft(l.endDate, l.outstanding);
            const isSettled = l.status === 'returned' || l.status === 'paid';

            return (
              <div
                key={l.id}
                className={`relative flex flex-col gap-4 rounded-2xl border p-5 shadow-sm backdrop-blur-md ${
                  isSettled
                    ? 'border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/5 opacity-80'
                    : 'border-slate-200/60 bg-white/80 dark:border-slate-800/60 dark:bg-slate-900/60'
                }`}
              >
                <div className='flex items-start justify-between gap-4'>
                  <div className='flex items-start gap-3 min-w-0 flex-1'>
                    <input
                      type='checkbox'
                      checked={selectedIds.has(l.id)}
                      onChange={() => handleSelect(l.id)}
                      className='mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800'
                    />
                    <div>
                      <span
                        className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider
                        ${l.type === 'loan' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/10 dark:border-indigo-500/20' : ''}
                        ${l.type === 'credit_card' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/10 dark:border-rose-500/20' : ''}
                        ${l.type === 'other' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/10 dark:border-emerald-500/20' : ''}
                      `}
                      >
                        {getTypeLabel(l.type)}
                      </span>
                      <h3 className='mt-2 truncate text-base font-bold text-slate-900 dark:text-slate-100'>
                        {l.name}
                      </h3>

                      <div className='mt-1.5 flex flex-wrap gap-2'>
                        {l.status === 'returned' && (
                          <span className='inline-flex items-center gap-1 rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border border-teal-500/20'>
                            <FiCheck className='h-3 w-3' /> Returned{' '}
                            {l.returnedAt ?? ''}
                          </span>
                        )}
                        {l.status === 'paid' && (
                          <span className='inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20'>
                            <FiCheck className='h-3 w-3' /> Paid
                          </span>
                        )}
                        {!isSettled &&
                          daysLeft !== null &&
                          daysLeft <= 3 &&
                          daysLeft >= 0 && (
                            <span className='inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/20'>
                              <FiClock /> Due in {daysLeft}d
                            </span>
                          )}
                        {!isSettled && daysLeft !== null && daysLeft < 0 && (
                          <span className='inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20'>
                            <FiClock /> Overdue!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className='flex shrink-0 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50'>
                    {/* Quick actions depending on type */}
                    {l.type === 'other' && !isSettled && (
                      <button
                        type='button'
                        title='Mark as Returned'
                        className='flex h-8 w-8 items-center cursor-pointer justify-center rounded-lg text-slate-900 dark:text-slate-500 transition-colors hover:bg-white hover:text-teal-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-teal-400'
                        onClick={() => void markAsReturned(l)}
                      >
                        <FiCheck className='h-4 w-4' />
                      </button>
                    )}
                    {l.type === 'credit_card' && !isSettled && (
                      <button
                        type='button'
                        title='Mark Bill as Paid'
                        className='flex h-8 w-8 items-center cursor-pointer justify-center rounded-lg text-slate-900 dark:text-slate-500 transition-colors hover:bg-white hover:text-emerald-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-emerald-400'
                        onClick={() => void markAsPaid(l)}
                      >
                        <FiCheck className='h-4 w-4' />
                      </button>
                    )}

                    <button
                      type='button'
                      title='Edit'
                      className='flex h-8 w-8 items-center cursor-pointer justify-center rounded-lg text-slate-900 dark:text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-indigo-400'
                      onClick={() => setEditId(l.id)}
                    >
                      <FiEdit2 className='h-4 w-4' />
                    </button>
                    <button
                      type='button'
                      title='Delete'
                      className='flex h-8 w-8 items-center cursor-pointer justify-center rounded-lg text-slate-900 dark:text-slate-500 transition-colors hover:bg-white hover:text-rose-600 hover:shadow-sm dark:hover:bg-slate-700 dark:hover:text-rose-400'
                      onClick={() => openDeleteModal(l.id)}
                    >
                      <FiTrash2 className='h-4 w-4' />
                    </button>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800'>
                  <div>
                    <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                      {isSettled ? 'Original Amount' : 'Pending Amount'}
                    </p>
                    <p
                      className={`mt-0.5 text-lg font-black ${isSettled ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}
                    >
                      {formatINR(l.principal)}
                    </p>
                  </div>
                  <div className='text-right'>
                    <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                      {l.type === 'credit_card' ? 'Due Date' : 'Target Date'}
                    </p>
                    <p className='mt-0.5 text-sm font-bold text-slate-700 dark:text-slate-300'>
                      {l.endDate
                        ? new Date(l.endDate).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 💻 Desktop Table View */}
      <div className='hidden md:block overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-lg backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50'>
        <div className='overflow-x-auto custom-scrollbar'>
          <table className='min-w-full text-left text-sm whitespace-nowrap'>
            <thead className='border-b border-slate-200/60 bg-slate-50/50 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/50 dark:text-slate-400'>
              <tr>
                <th className='px-5 py-4 w-12'>
                  <input
                    type='checkbox'
                    checked={
                      filteredLiabilities.length > 0 &&
                      selectedIds.size === filteredLiabilities.length
                    }
                    onChange={handleSelectAll}
                    className='h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800'
                  />
                </th>
                <th className='px-5 py-4'>Type</th>
                <th className='px-5 py-4'>Name / Description</th>
                <th className='px-5 py-4 text-right'>Amount</th>
                <th className='px-5 py-4 text-right'>Target / Due Date</th>
                <th className='px-5 py-4 text-center'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100/60 dark:divide-slate-800/60'>
              {filteredLiabilities.length === 0 ? (
                <tr>
                  <td
                    className='px-5 py-12 text-center text-slate-900 dark:text-slate-500'
                    colSpan={6}
                  >
                    <div className='flex flex-col items-center justify-center gap-3'>
                      <div className='rounded-full bg-slate-100 p-4 dark:bg-slate-800'>
                        <FiCreditCard className='h-8 w-8 text-slate-500 dark:text-slate-400' />
                      </div>
                      <p className='font-bold'>
                        {filterTab === 'settled'
                          ? 'No settled liabilities.'
                          : "No records found. You're debt free!"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLiabilities.map((l) => {
                  const daysLeft = getDaysLeft(l.endDate, l.outstanding);
                  const isSettled =
                    l.status === 'returned' || l.status === 'paid';

                  return (
                    <tr
                      key={l.id}
                      className={`transition-colors ${
                        isSettled
                          ? 'bg-emerald-500/3 opacity-75 hover:opacity-100'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className='px-5 py-4'>
                        <input
                          type='checkbox'
                          checked={selectedIds.has(l.id)}
                          onChange={() => handleSelect(l.id)}
                          className='h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800'
                        />
                      </td>
                      <td className='px-5 py-4'>
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border
                          ${l.type === 'loan' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20' : ''}
                          ${l.type === 'credit_card' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' : ''}
                          ${l.type === 'other' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : ''}
                        `}
                        >
                          {getTypeLabel(l.type)}
                        </span>
                      </td>

                      <td className='px-5 py-4 font-bold text-slate-900 dark:text-slate-50'>
                        {l.name}
                        {l.status === 'returned' && (
                          <span className='ml-3 inline-flex items-center gap-1 rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 border border-teal-500/20'>
                            <FiCheck className='h-3 w-3' /> Returned{' '}
                            {l.returnedAt ?? ''}
                          </span>
                        )}
                        {l.status === 'paid' && (
                          <span className='ml-3 inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20'>
                            <FiCheck className='h-3 w-3' /> Paid
                          </span>
                        )}
                        {!isSettled &&
                          daysLeft !== null &&
                          daysLeft <= 3 &&
                          daysLeft >= 0 && (
                            <span className='ml-3 inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/20'>
                              <FiClock className='h-3 w-3' /> Due in {daysLeft}d
                            </span>
                          )}
                        {!isSettled && daysLeft !== null && daysLeft < 0 && (
                          <span className='ml-3 inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20'>
                            <FiClock className='h-3 w-3' /> Overdue!
                          </span>
                        )}
                      </td>

                      <td className='px-5 py-4 text-right text-base font-black tabular-nums text-slate-800 dark:text-slate-200'>
                        {isSettled ? (
                          <span className='line-through text-slate-500 dark:text-slate-400 text-sm'>
                            {formatINR(l.principal)}
                          </span>
                        ) : (
                          formatINR(l.outstanding)
                        )}
                      </td>

                      <td className='px-5 py-4 text-right font-medium tabular-nums text-slate-600 dark:text-slate-400'>
                        {l.endDate
                          ? new Date(l.endDate).toLocaleDateString()
                          : '—'}
                      </td>

                      <td className='px-5 py-4'>
                        <div className='flex justify-center gap-2'>
                          {/* Quick Actions depending on type */}
                          {l.type === 'other' && !isSettled && (
                            <button
                              type='button'
                              title='Mark as Returned'
                              className='flex h-9 w-9 items-center cursor-pointer justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-500/20 dark:hover:text-teal-400'
                              onClick={() => void markAsReturned(l)}
                            >
                              <FiCheck className='h-4 w-4' />
                            </button>
                          )}
                          {l.type === 'credit_card' && !isSettled && (
                            <button
                              type='button'
                              title='Mark Bill as Paid'
                              className='flex h-9 w-9 items-center cursor-pointer justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400'
                              onClick={() => void markAsPaid(l)}
                            >
                              <FiCheck className='h-4 w-4' />
                            </button>
                          )}

                          <button
                            type='button'
                            title='Edit'
                            className='flex h-9 w-9 items-center cursor-pointer justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-400'
                            onClick={() => setEditId(l.id)}
                          >
                            <FiEdit2 className='h-4 w-4' />
                          </button>
                          <button
                            type='button'
                            title='Delete'
                            className='flex h-9 w-9 items-center cursor-pointer justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400'
                            onClick={() => openDeleteModal(l.id)}
                          >
                            <FiTrash2 className='h-4 w-4' />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <UpsertLiabilityModal
        open={open}
        onClose={() => setOpen(false)}
        mode='create'
      />
      {edit ? (
        <UpsertLiabilityModal
          open={!!edit}
          onClose={() => setEditId(null)}
          mode='edit'
          liability={edit}
        />
      ) : null}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title='⚠ Confirm Deletion'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            This will permanently remove this record from your liabilities.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
            <button
              onClick={() => setDeleteOpen(false)}
              className='rounded-xl cursor-pointer px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 transition-colors'
            >
              Cancel
            </button>
            <AsyncButton
              onClick={confirmDelete}
              busy={deleteBusy}
              loadingLabel='Deleting…'
              className='rounded-xl cursor-pointer bg-rose-600 hover:bg-rose-700 px-6 py-2.5 text-sm font-bold text-white transition-colors'
            >
              Yes, Delete
            </AsyncButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title='⚠ Confirm Bulk Deletion'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            This will permanently delete {selectedIds.size} selected
            liabilities.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
            <button
              onClick={() => setBulkDeleteOpen(false)}
              className='rounded-xl cursor-pointer px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 transition-colors'
            >
              Cancel
            </button>
            <AsyncButton
              onClick={confirmBulkDelete}
              busy={deleteBusy}
              loadingLabel='Deleting…'
              className='rounded-xl cursor-pointer bg-rose-600 hover:bg-rose-700 px-6 py-2.5 text-sm font-bold text-white transition-colors'
            >
              Yes, Delete {selectedIds.size} Records
            </AsyncButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
