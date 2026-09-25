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
import { buildAccountsForecast } from '../../utils/advancedInsights';
import {
  accountTypeLabel,
  IN_HAND_CASH_ID,
  IN_HAND_CASH_NAME,
} from '../../utils/calculations';
import { format } from 'date-fns';
import { formatINR } from '../../utils/format';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useSubscription } from '../../context/SubscriptionContext';
import { usePremiumActions } from '../../hooks/usePremiumActions';
import { FREE_ACCOUNT_LIMIT } from '../../types/subscription';
import toast from 'react-hot-toast';
import { FeatureInfo } from '../../components/ui/FeatureInfo';

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
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balance, setBalance] = useState('0');
  const [openingBalanceDate, setOpeningBalanceDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  // Second click, only required when an edit moves the as-of date forward and
  // would therefore drop history out of the balance.
  const [cutoffConfirmed, setCutoffConfirmed] = useState(false);

  // ✅ FIX 1: Reset form fields every time the modal opens
  useEffect(() => {
    if (open) {
      setName(entry?.name ?? '');
      setType(entry?.type ?? 'bank');
      setBalance(String(entry?.openingBalance ?? entry?.balance ?? '0'));
      setOpeningBalanceDate(entry?.openingBalanceDate ?? todayStr);
      setCutoffConfirmed(false);
    }
  }, [open]);

  // ── What this choice actually does to the balance ─────────────────────────
  // Live balance = opening balance ± linked cashflows on/after the as-of date,
  // so moving that date can silently remove entries from the figure. Show the
  // consequence instead of making the user discover it on the dashboard.
  const linkedCashflows = useMemo(
    () =>
      mode === 'edit' && entry
        ? cashflows.filter((c) => c.accountId === entry.id)
        : [],
    [cashflows, entry, mode],
  );
  const deltaOf = (list: typeof linkedCashflows) =>
    list.reduce((sum, c) => sum + (c.type === 'income' ? c.amount : -c.amount), 0);
  const excludedCashflows = linkedCashflows.filter(
    (c) => c.date < openingBalanceDate,
  );
  const includedNet = deltaOf(
    linkedCashflows.filter((c) => c.date >= openingBalanceDate),
  );
  const liveBalance = (Number(balance) || 0) + includedNet;
  const cutoffMovedForward =
    mode === 'edit' &&
    !!entry?.openingBalanceDate &&
    openingBalanceDate > entry.openingBalanceDate &&
    excludedCashflows.length < linkedCashflows.length;

  async function onSubmit() {
    // Moving the cutoff forward is the one edit that can look like money
    // disappearing, so it needs an explicit confirmation first.
    if (cutoffMovedForward && !cutoffConfirmed) {
      setCutoffConfirmed(true);
      toast(
        'This hides earlier entries from the balance — click again to confirm.',
        { icon: '⚠️' },
      );
      return;
    }
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
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-500 dark:placeholder:text-slate-500 dark:text-slate-600';
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

          {/* Consequence preview: only rendered once there is something to
              exclude, so a fresh account stays as simple as it was. */}
          {excludedCashflows.length > 0 && (
            <div
              className={`mt-2 flex items-start gap-2 rounded-xl border px-3 py-2.5 ${
                cutoffMovedForward
                  ? 'border-amber-400/50 bg-amber-50/70 dark:bg-amber-500/5'
                  : 'border-slate-300/60 dark:border-slate-700/50 bg-slate-200/70 dark:bg-slate-800/60'
              }`}
            >
              <FiTrendingDown
                className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                  cutoffMovedForward ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
                }`}
              />
              <div className='min-w-0 space-y-1'>
                <p
                  className={`text-[11px] leading-relaxed ${
                    cutoffMovedForward
                      ? 'text-amber-800 dark:text-amber-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  This excludes{' '}
                  <strong>{excludedCashflows.length}</strong> earlier
                  cashflow{' '}
                  {excludedCashflows.length === 1 ? 'entry' : 'entries'} (
                  {formatINR(Math.abs(deltaOf(excludedCashflows)))} net) from
                  this account's balance.
                  {cutoffMovedForward &&
                    !cutoffConfirmed &&
                    ' Saving needs a second click to confirm.'}
                </p>
                <p className='text-[11px] font-bold text-slate-600 dark:text-slate-300'>
                  Resulting live balance:{' '}
                  <span className='text-emerald-600 dark:text-emerald-400'>
                    {formatINR(liveBalance)}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='mt-2 flex items-center justify-end gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-5'>
          <button
            type='button'
            onClick={onClose}
            disabled={saving}
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
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
  const isInHand = account.id === IN_HAND_CASH_ID;
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
            ) : isInHand ? (
              <FiDollarSign className='h-5 w-5' />
            ) : (
              <BsBank2 className='h-5 w-5' />
            )}
          </div>
          <div>
            <p className='font-bold text-slate-900 dark:text-white'>
              {account.name}
            </p>
            <p className='text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              {accountTypeLabel(account)}
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
          {isCredit ? 'Outstanding' : isInHand ? 'Cash in Hand' : 'Current Balance'}
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

// ── Cash in Hand ───────────────────────────────────────────────────────────
/** One editable figure — no account form, no second "balance" field. It is
 *  saved through `setInHandAmount`, which writes the built-in account record
 *  (id `acc_in_hand`), so Liquid Cash, Net Worth, Reports, Dashboard, the
 *  simulator and the AI answers all pick it up automatically. */
function InHandCard({ amount }: { amount: number }) {
  const setInHandAmount = usePortfolioStore((s) => s.setInHandAmount);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('0');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(String(amount));
    setEditing(true);
  };

  async function save() {
    setSaving(true);
    try {
      await setInHandAmount(Number(draft) || 0);
      setEditing(false);
      toast.success('Cash in Hand updated across all balances');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-amber-50 to-transparent p-5 shadow-sm dark:from-amber-500/10 dark:via-amber-500/5 dark:to-slate-900/40'>
      <div className='flex items-start justify-between gap-4'>
        <div className='flex min-w-0 items-start gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/25'>
            <FiDollarSign className='h-5 w-5' />
          </div>
          <div className='min-w-0'>
            <p className='flex flex-wrap items-center gap-2 font-bold text-slate-900 dark:text-white'>
              {IN_HAND_CASH_NAME}
              <span className='rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300'>
                Built-in
              </span>
            </p>
            <p className='mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300'>
              Physical cash you hold. Counted as available money in Net Worth,
              Dashboard, Reports, Cashflow and AI answers — never double-counted
              with bank balances.
            </p>
          </div>
        </div>

        {!editing && (
          <button
            type='button'
            onClick={startEdit}
            className='flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/40 bg-white/70 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-500 hover:text-white dark:bg-slate-900/40 dark:text-amber-300 dark:hover:text-slate-900'
          >
            <FiEdit2 className='h-3.5 w-3.5' />
            Update
          </button>
        )}
      </div>

      {editing ? (
        <div className='mt-4 flex flex-col gap-3 sm:flex-row sm:items-center'>
          <NumericInput
            autoFocus
            value={draft}
            onChange={(v) => setDraft(v)}
            placeholder='0'
            className='w-full rounded-xl border border-amber-500/40 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/30 dark:bg-slate-900/60 dark:text-white'
          />
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => setEditing(false)}
              disabled={saving}
              className='flex-1 rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-amber-500/10 sm:flex-none dark:text-slate-300'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={() => void save()}
              disabled={saving}
              className='flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-600 disabled:opacity-60 sm:flex-none'
            >
              <FiSave className='h-3.5 w-3.5' />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <p className='mt-3 text-2xl font-bold tabular-nums tracking-tight text-amber-600 dark:text-amber-400'>
          {formatINR(amount)}
        </p>
      )}
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
  const { hasPremiumAccess } = useSubscription();
  const { premiumActionProps, guardAction } = usePremiumActions();

  const openAddAccount = guardAction(() => {
    // Cash in Hand is built-in and never takes a plan slot.
    const realAccounts = accounts.filter((a) => a.id !== IN_HAND_CASH_ID).length;
    if (!hasPremiumAccess && realAccounts >= FREE_ACCOUNT_LIMIT) {
      toast.error(`Free plan allows up to ${FREE_ACCOUNT_LIMIT} accounts. Upgrade for unlimited.`);
      return;
    }
    setAddOpen(true);
  });

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
  // Built-in Cash in Hand record — shown as its own card, never in the grid.
  const inHandAccount = accounts.find((a) => a.id === IN_HAND_CASH_ID);
  const inHandBalance = inHandAccount
    ? (accountStats[inHandAccount.id]?.liveBalance ?? 0)
    : 0;
  const userAccounts = accounts.filter((a) => a.id !== IN_HAND_CASH_ID);
  const forecast = useMemo(
    () =>
      buildAccountsForecast(
        accounts.map((a) => ({
          ...a,
          balance: accountStats[a.id]?.liveBalance ?? a.balance,
        })),
        cashflows,
      ),
    [accounts, cashflows, accountStats],
  );

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
            <h1 className='text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2'>
              Accounts
              <FeatureInfo feature='accounts' />
            </h1>
            <p className='mt-1 text-sm font-medium text-slate-600 dark:text-slate-300'>
              Live balances auto-update from your cashflow entries.
            </p>
          </div>
        </div>
        <button
          {...premiumActionProps}
          className='group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0'
          onClick={openAddAccount}
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

      {/* Cash in Hand — part of every available-cash total below */}
      <InHandCard amount={inHandBalance} />

      {/* Summary Row */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        {[
          {
            label: 'Total Bank Balance',
            value: totalBalance,
            icon: <BsBank2 className='h-5 w-5 text-violet-500' />,
            color: 'text-violet-600 dark:text-violet-400',
            border: 'border-violet-200/60 dark:border-violet-500/20',
          },
          {
            label: 'Cash in Hand',
            value: inHandBalance,
            icon: <FiDollarSign className='h-5 w-5 text-amber-500' />,
            color: 'text-amber-600 dark:text-amber-400',
            border: 'border-amber-200/60 dark:border-amber-500/20',
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
            value: totalBalance + inHandBalance - totalCredit,
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

      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <div className='rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Daily run-rate
          </p>
          <p className={`mt-1 text-lg font-black ${forecast.dailyRunRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatINR(forecast.dailyRunRate)}
          </p>
        </div>
        <div className='rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            30-day forecast
          </p>
          <p className='mt-1 text-lg font-black text-slate-900 dark:text-slate-100'>
            {formatINR(forecast.projected30)}
          </p>
        </div>
        <div className='rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            60-day forecast
          </p>
          <p className='mt-1 text-lg font-black text-slate-900 dark:text-slate-100'>
            {formatINR(forecast.projected60)}
          </p>
        </div>
        <div className='rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4'>
          <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500'>
            Low-balance risk
          </p>
          <p className={`mt-1 text-lg font-black ${forecast.lowBalanceRisk ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {forecast.lowBalanceRisk ? 'High' : 'Low'}
          </p>
        </div>
      </div>

      {/* Account Cards */}
      {userAccounts.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/30 p-16 text-center'>
          <BsBank2 className='h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600' />
          <p className='text-lg font-bold text-slate-400 dark:text-slate-500'>
            No accounts yet
          </p>
          <p className='mt-1 text-sm text-slate-400 dark:text-slate-500'>
            Add your bank accounts and credit cards to start tracking.
          </p>
          <button
            {...premiumActionProps}
            className='mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45'
            onClick={openAddAccount}
            type='button'
          >
            <FiPlus className='h-4 w-4' /> Add First Account
          </button>
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          {userAccounts.map((account, i) => (
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
      {userAccounts.length > 0 && (
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
