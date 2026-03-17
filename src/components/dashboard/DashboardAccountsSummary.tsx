import { FiCreditCard } from 'react-icons/fi';
import { formatCurrency } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';

export function DashboardAccountsSummary() {
  const accounts = usePortfolioStore((s) => s.accounts);
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  return (
    <div className='rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm flex flex-col h-full'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-lg font-bold text-slate-100'>
          <FiCreditCard className='text-blue-400' />
          Liquid Accounts
        </h2>
      </div>

      <div className='mb-4'>
        <p className='text-xs font-medium text-slate-400 uppercase tracking-wider'>
          Total Balance
        </p>
        <p className='text-2xl font-bold text-blue-400'>
          {formatCurrency(totalBalance)}
        </p>
      </div>

      <div className='flex-1 space-y-3 mt-2 overflow-y-auto custom-scrollbar max-h-32'>
        {accounts.length === 0 ? (
          <p className='text-sm text-slate-500'>No accounts added.</p>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc.id}
              className='flex justify-between items-center border-t border-slate-800/60 pt-2'
            >
              <div>
                <p className='text-sm font-medium text-slate-200'>{acc.name}</p>
                <p className='text-[10px] text-slate-500 uppercase'>
                  {acc.type}
                </p>
              </div>
              <p className='text-sm font-semibold text-slate-300'>
                {formatCurrency(acc.balance || 0)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
