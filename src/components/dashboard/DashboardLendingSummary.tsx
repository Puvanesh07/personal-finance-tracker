// src/components/dashboard/DashboardLendingSummary.tsx
import { FiArrowUpRight, FiUsers } from 'react-icons/fi';
import { formatINR } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useMemo } from 'react';

export function DashboardLendingSummary() {
  const lendingBorrowers    = usePortfolioStore((s) => s.lendingBorrowers) ?? [];
  const lendingTransactions = usePortfolioStore((s) => s.lendingTransactions) ?? [];
  const navigate = useNavigate();

  const activeBorrowers = lendingBorrowers.filter((b) => b.status === 'active');
  const validIds = new Set(activeBorrowers.map((b) => b.id));

  const { outstanding, interestEarned } = useMemo(() => {
    const given = lendingTransactions
      .filter((tx) => validIds.has(tx.borrowerId) && tx.type === 'principal_given')
      .reduce((s, tx) => s + (tx.amount || 0), 0);
    const returned = lendingTransactions
      .filter((tx) => validIds.has(tx.borrowerId) && tx.type === 'principal_returned')
      .reduce((s, tx) => s + (tx.amount || 0), 0);
    const interest = lendingTransactions
      .filter((tx) => validIds.has(tx.borrowerId) && tx.type === 'interest_paid')
      .reduce((s, tx) => s + (tx.amount || 0), 0);
    return { outstanding: Math.max(0, given - returned), interestEarned: interest };
  }, [lendingTransactions, validIds]);

  // Borrowers with overdue next payment
  const today = new Date().toISOString().slice(0, 10);
  const overdue = activeBorrowers.filter(
    (b) => b.nextDueDate && b.nextDueDate < today,
  );

  return (
    <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100'>
          <FiUsers className='text-violet-400' />
          Lending
        </h2>
        <button
          onClick={() => navigate('/cashflow?tab=lending')}
          title='Go to Lending'
          className='flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-violet-400 transition-colors'
        >
          <FiArrowUpRight className='h-4 w-4' />
        </button>
      </div>

      {lendingBorrowers.length === 0 ? (
        <div className='flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-8 text-center'>
          <FiUsers className='h-6 w-6 text-slate-300 dark:text-slate-600' />
          <p className='text-xs text-slate-400 dark:text-slate-500'>No lending records yet</p>
          <button
            onClick={() => navigate('/cashflow?tab=lending')}
            className='text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors'
          >
            Add borrower →
          </button>
        </div>
      ) : (
        <>
          <div className='mb-4'>
            <p className='text-xs font-medium text-slate-500 uppercase tracking-wider'>Outstanding</p>
            <p className='text-2xl font-bold text-violet-400 tabular-nums'>{formatINR(outstanding)}</p>
          </div>

          <div className='mt-auto grid grid-cols-2 gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-4'>
            <div>
              <p className='text-xs font-medium text-slate-500 mb-1'>Active Borrowers</p>
              <p className='text-sm font-bold text-slate-700 dark:text-slate-200'>{activeBorrowers.length}</p>
            </div>
            <div>
              <p className='text-xs font-medium text-slate-500 mb-1'>Interest Earned</p>
              <p className='text-sm font-bold text-emerald-400 tabular-nums'>{formatINR(interestEarned)}</p>
            </div>
            {overdue.length > 0 && (
              <div className='col-span-2'>
                <p className='text-xs font-medium text-rose-500 mb-1'>Overdue</p>
                <p className='text-sm font-bold text-rose-400'>
                  {overdue.length} borrower{overdue.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
