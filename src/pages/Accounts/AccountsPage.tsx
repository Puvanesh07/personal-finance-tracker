import type { Account, AccountType } from '../../types/investmentTypes';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FiCheck,
  FiCreditCard,
  FiDollarSign,
  FiEdit2,
  FiInfo,
  FiPlus,
  FiSave,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
} from 'react-icons/fi';
import { useEffect, useMemo, useState } from 'react';

import { AccountsSkeleton } from '../../components/loader/skeletons';
import { BsBank2 } from 'react-icons/bs';
import { Modal } from '../../components/ui/Modal';
import { NumericInput } from '../../components/ui/NumericInput';
import { format } from 'date-fns';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';

const ACCOUNT_COLORS = [
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#6366f1',
];

// ── Account Form Modal ─────────────────────────────────────────────────────
type AccountFormProps = {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  entry?: Account;
};

function AccountFormModal({ open, onClose, mode, entry }: AccountFormProps) {
  const addAccount = usePortfolioStore((s) => s.addAccount);
  const updateAccount = usePortfolioStore((s) => s.updateAccount);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balance, setBalance] = useState('0');
  const [openingBalanceDate, setOpeningBalanceDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);

  // ✅ FIX 1: Reset form fields every time the modal opens
  useEffect(() => {
    if (open) {
      setName(entry?.name ?? '');
      setType(entry?.type ?? 'bank');
      setBalance(String(entry?.openingBalance ?? entry?.balance ?? '0'));
      setOpeningBalanceDate(entry?.openingBalanceDate ?? todayStr);
    }
  }, [open]);

  async function onSubmit() {
    setSaving(true);
    try {
      const balNum = Number(balance) || 0;
      const payload = {
        name: name.trim(),
        type,
        balance: balNum,
        openingBalance: balNum,
        openingBalanceDate,
      };
      if (mode === 'create') await addAccount(payload);
      else if (entry) await updateAccount(entry.id, payload);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-500 dark:text-slate-600';
  const labelCls =
    'text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-500 mb-1.5 block';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Add Account' : 'Edit Account'}
    >
      <div className='grid grid-cols-1 gap-5'>
        {/* Account Type */}
        <div>
          <label className={labelCls}>Account Type</label>
          <div className='flex gap-3'>
            {(['bank', 'credit'] as AccountType[]).map((t) => (
              <button
                key={t}
                type='button'
                onClick={() => setType(t)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-all ${
                  type === t
                    ? t === 'bank'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:border-slate-600'
                }`}
              >
                {t === 'bank' ? (
                  <BsBank2 className='h-4 w-4' />
                ) : (
                  <FiCreditCard className='h-4 w-4' />
                )}
                {t === 'bank' ? 'Bank Account' : 'Credit Card'}
                {type === t && <FiCheck className='h-3.5 w-3.5 ml-1' />}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className={labelCls}>Account Name</label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. Indian Bank, HDFC Credit Card'
          />
        </div>

        {/* Opening Balance */}
        <div>
          <label className={labelCls}>
            {type === 'credit'
              ? 'Outstanding Balance (₹)'
              : 'Opening Balance (₹)'}
          </label>
          <NumericInput
            className={inputCls}
            value={balance}
            onChange={(v) => setBalance(v)}
            placeholder='0'
          />
        </div>

        {/* Opening Balance Date */}
        <div>
          <label className={labelCls}>Balance As-Of Date</label>
          <input
            type='date'
            className={inputCls}
            value={openingBalanceDate}
            onChange={(e) => setOpeningBalanceDate(e.target.value)}
          />
          <div className='mt-2 flex items-start gap-2 rounded-xl bg-slate-200/70 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700/50 px-3 py-2.5'>
            <FiInfo className='h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5' />
            <p className='text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed'>
              Enter your current bank balance and set today as the date. Only
              cashflow entries on or after this date will adjust the live
              balance — older entries are ignored.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className='mt-2 flex items-center justify-end gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-5'>
          <button
            type='button'
            onClick={onClose}
            disabled={saving}
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:bg-slate-800 hover:text-slate-900 dark:text-slate-800 dark:hover:text-slate-900 dark:text-slate-800 dark:text-slate-200'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={() => void onSubmit()}
            disabled={saving || !name.trim()}
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 disabled:opacity-60'
          >
            {saving ? (
              <>
                <FiSave className='h-4 w-4' />
                <span>Saving…</span>
              </>
            ) : mode === 'create' ? (
              <>
                <FiPlus className='h-4 w-4' />
                <span>Add Account</span>
              </>
            ) : (
              <>
                <FiSave className='h-4 w-4' />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Account Card ──────────────────────────────────────────────────────────
function AccountCard({
  account,
  index,
  totalIncome,
  totalExpense,
  liveBalance,
  onEdit,
  onDelete,
}: {
  account: Account;
  index: number;
  totalIncome: number;
  totalExpense: number;
  liveBalance: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = ACCOUNT_COLORS[index % ACCOUNT_COLORS.length];
  const isCredit = account.type === 'credit';
  const openingBal = account.openingBalance ?? account.balance;

  return (
    <div
      className='relative overflow-hidden rounded-2xl border bg-white/80 dark:bg-slate-900/50 p-5 shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-md'
      style={{ borderColor: color + '40' }}
    >
      <div
        className='absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl'
        style={{ backgroundColor: color }}
      />

      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-3'>
          <div
            className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl'
            style={{ backgroundColor: color + '20', color }}
          >
            {isCredit ? (
              <FiCreditCard className='h-5 w-5' />
            ) : (
              <BsBank2 className='h-5 w-5' />
            )}
          </div>
          <div>
            <p className='font-bold text-slate-900 dark:text-white'>
              {account.name}
            </p>
            <p className='text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              {isCredit ? 'Credit Card' : 'Bank Account'}
            </p>
          </div>
        </div>
        <div className='flex gap-1 shrink-0'>
          <button
            type='button'
            onClick={onEdit}
            className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400'
          >
            <FiEdit2 className='h-3.5 w-3.5' />
          </button>
          <button
            type='button'
            onClick={onDelete}
            className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
          >
            <FiTrash2 className='h-3.5 w-3.5' />
          </button>
        </div>
      </div>

      {/* Live Balance */}
      <div className='mt-4 space-y-1'>
        <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
          {isCredit ? 'Outstanding' : 'Current Balance'}
        </p>
        <p
          className='text-2xl font-bold tabular-nums tracking-tight'
          style={{ color }}
        >
          {formatINR(liveBalance)}
        </p>
        {liveBalance !== openingBal && (
          <p className='text-[11px] text-slate-900 dark:text-slate-500'>
            Opening: {formatINR(openingBal)}
            {account.openingBalanceDate
              ? ` · ${account.openingBalanceDate}`
              : ''}
          </p>
        )}
      </div>

      <div className='mt-4 grid grid-cols-2 gap-2'>
        <div className='rounded-xl bg-emerald-500/10 p-2.5'>
          <div className='flex items-center gap-1.5 mb-1'>
            <FiTrendingUp className='h-3 w-3 text-emerald-500' />
            <span className='text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400'>
              Income
            </span>
          </div>
          <p className='text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300'>
            {formatINR(totalIncome)}
          </p>
        </div>
        <div className='rounded-xl bg-rose-500/10 p-2.5'>
          <div className='flex items-center gap-1.5 mb-1'>
            <FiTrendingDown className='h-3 w-3 text-rose-500' />
            <span className='text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400'>
              Expenses
            </span>
          </div>
          <p className='text-sm font-bold tabular-nums text-rose-700 dark:text-rose-300'>
            {formatINR(totalExpense)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export function AccountsPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const accounts = usePortfolioStore((s) => s.accounts);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const deleteAccount = usePortfolioStore((s) => s.deleteAccount);

  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Account | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── ✅ FIX 2: Live balance = opening balance ± cashflows on/after openingBalanceDate ──
  const accountStats = useMemo(() => {
    const stats: Record<
      string,
      { income: number; expense: number; liveBalance: number }
    > = {};

    for (const acc of accounts) {
      stats[acc.id] = {
        income: 0,
        expense: 0,
        liveBalance: acc.openingBalance ?? acc.balance,
      };
    }

    for (const cf of cashflows) {
      if (!cf.accountId) continue;
      const acc = accounts.find((a) => a.id === cf.accountId);
      if (!acc || !stats[acc.id]) continue;

      // Only count cashflows on or after the opening balance date
      const cutoff = acc.openingBalanceDate ?? '1900-01-01';
      if (cf.date < cutoff) continue;

      if (cf.type === 'income') {
        stats[acc.id].income += cf.amount;
        stats[acc.id].liveBalance += cf.amount;
      } else {
        stats[acc.id].expense += cf.amount;
        stats[acc.id].liveBalance -= cf.amount;
      }
    }

    return stats;
  }, [cashflows, accounts]);

  const barData = useMemo(
    () =>
      accounts.map((a) => ({
        name: a.name.length > 12 ? a.name.slice(0, 12) + '…' : a.name,
        Balance: accountStats[a.id]?.liveBalance ?? a.balance,
        Income: accountStats[a.id]?.income ?? 0,
        Expense: accountStats[a.id]?.expense ?? 0,
      })),
    [accounts, accountStats],
  );

  const pieData = useMemo(
    () =>
      accounts
        .filter((a) => (accountStats[a.id]?.liveBalance ?? a.balance) > 0)
        .map((a, i) => ({
          name: a.name,
          value: accountStats[a.id]?.liveBalance ?? a.balance,
          color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
        })),
    [accounts, accountStats],
  );

  const totalBalance = accounts
    .filter((a) => a.type === 'bank')
    .reduce((s, a) => s + (accountStats[a.id]?.liveBalance ?? a.balance), 0);
  const totalCredit = accounts
    .filter((a) => a.type === 'credit')
    .reduce((s, a) => s + (accountStats[a.id]?.liveBalance ?? a.balance), 0);

  if (!ready) return <AccountsSkeleton />;

  return (
    <div className='flex flex-col gap-6 pb-8'>
      {/* Header */}
      <header className='flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent p-6 border border-violet-500/20 dark:border-violet-500/30 shadow-sm'>
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-600 text-white shadow-lg shadow-violet-500/30'>
            <BsBank2 className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white'>
              Accounts
            </h1>
            <p className='mt-1 text-sm font-medium text-slate-600 dark:text-slate-300'>
              Live balances auto-update from your cashflow entries.
            </p>
          </div>
        </div>
        <button
          className='group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-0.5'
          onClick={() => setAddOpen(true)}
          type='button'
        >
          <FiPlus className='h-4 w-4' />
          <span>Add Account</span>
        </button>
      </header>

      {/* Info Banner */}
      <div className='flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 px-5 py-3.5'>
        <FiInfo className='h-4 w-4 text-emerald-400 shrink-0 mt-0.5' />
        <p className='text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed'>
          <span className='font-bold'>How balances work: </span>
          Set your current bank balance and today as the "As-Of Date". The
          displayed balance is your opening balance adjusted by any cashflow
          entries on or after that date. Older entries you added historically
          are excluded so they don't double-count.
        </p>
      </div>

      {/* Summary Row */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        {[
          {
            label: 'Total Bank Balance',
            value: totalBalance,
            icon: <BsBank2 className='h-5 w-5 text-violet-500' />,
            color: 'text-violet-600 dark:text-violet-400',
            border: 'border-violet-200/60 dark:border-violet-500/20',
          },
          {
            label: 'Credit Outstanding',
            value: totalCredit,
            icon: <FiCreditCard className='h-5 w-5 text-rose-500' />,
            color: 'text-rose-600 dark:text-rose-400',
            border: 'border-rose-200/60 dark:border-rose-500/20',
          },
          {
            label: 'Net Liquid Balance',
            value: totalBalance - totalCredit,
            icon: <FiDollarSign className='h-5 w-5 text-emerald-500' />,
            color: 'text-emerald-600 dark:text-emerald-400',
            border: 'border-emerald-200/60 dark:border-emerald-500/20',
          },
        ].map(({ label, value, icon, color, border }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-2xl border bg-white/80 dark:bg-slate-900/50 p-5 shadow-sm backdrop-blur-md ${border}`}
          >
            <div className='flex items-start justify-between'>
              <div>
                <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                  {label}
                </p>
                <p
                  className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${color}`}
                >
                  {formatINR(value)}
                </p>
              </div>
              <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/60'>
                {icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Account Cards */}
      {accounts.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/30 p-16 text-center'>
          <BsBank2 className='h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600' />
          <p className='text-lg font-bold text-slate-400 dark:text-slate-500'>
            No accounts yet
          </p>
          <p className='mt-1 text-sm text-slate-400 dark:text-slate-500'>
            Add your bank accounts and credit cards to start tracking.
          </p>
          <button
            className='mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg'
            onClick={() => setAddOpen(true)}
            type='button'
          >
            <FiPlus className='h-4 w-4' /> Add First Account
          </button>
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          {accounts.map((account, i) => (
            <AccountCard
              key={account.id}
              account={account}
              index={i}
              totalIncome={accountStats[account.id]?.income ?? 0}
              totalExpense={accountStats[account.id]?.expense ?? 0}
              liveBalance={
                accountStats[account.id]?.liveBalance ?? account.balance
              }
              onEdit={() => setEditEntry(account)}
              onDelete={() => setDeleteId(account.id)}
            />
          ))}
        </div>
      )}

      {/* Charts */}
      {accounts.length > 0 && (
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
          <div className='overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/50 p-5 shadow-sm backdrop-blur-md'>
            <p className='text-sm font-bold text-slate-700 dark:text-slate-300 mb-4'>
              Account-wise Cashflow
            </p>
            <div className='h-[240px]'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  data={barData}
                  margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray='3 3'
                    stroke='rgba(148,163,184,0.1)'
                  />
                  <XAxis
                    dataKey='name'
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: any) => formatINR(val as number)}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      backgroundColor: 'rgba(15,23,42,0.95)',
                      color: '#f1f5f9',
                    }}
                  />
                  <Legend />
                  <Bar dataKey='Income' fill='#10b981' radius={[4, 4, 0, 0]} />
                  <Bar dataKey='Expense' fill='#f43f5e' radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className='overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/50 p-5 shadow-sm backdrop-blur-md'>
            <p className='text-sm font-bold text-slate-700 dark:text-slate-300 mb-4'>
              Balance Distribution
            </p>
            {pieData.length > 0 ? (
              <div className='h-[240px]'>
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey='value'
                      nameKey='name'
                      cx='50%'
                      cy='50%'
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => formatINR(val as number)}
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: 'rgba(15,23,42,0.95)',
                        color: '#f1f5f9',
                      }}
                    />
                    <Legend
                      verticalAlign='bottom'
                      height={36}
                      iconType='circle'
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className='flex h-[240px] items-center justify-center text-slate-500 dark:text-slate-400'>
                <p className='text-sm'>
                  Add account balances to see distribution.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {/* ✅ key prop forces fresh mount = guaranteed empty form on open */}
      <AccountFormModal
        key={addOpen ? 'new' : 'new-closed'}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        mode='create'
      />

      {editEntry && (
        <AccountFormModal
          key={editEntry.id}
          open={!!editEntry}
          onClose={() => setEditEntry(null)}
          mode='edit'
          entry={editEntry}
        />
      )}

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title='⚠ Delete Account'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            This will permanently delete the account. Existing transactions
            linked to this account will remain but lose their account
            association.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-5'>
            <button
              onClick={() => setDeleteId(null)}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800'
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (deleteId) deleteAccount(deleteId);
                setDeleteId(null);
              }}
              className='rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700'
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
