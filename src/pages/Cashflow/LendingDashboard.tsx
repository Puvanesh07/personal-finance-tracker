// src/pages/Cashflow/LendingDashboard.tsx

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FiAlertCircle,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiEdit2,
  FiFile,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiTrendingUp,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { addMonths, format, isBefore, parseISO } from 'date-fns';
import { exportCSV, exportPDF } from '../../utils/exportUtils'; // NEW: Imported exportPDF
import { useEffect, useMemo, useState } from 'react';

import type { LendingTransactionType } from '../../types/investmentTypes';
import { Modal } from '../../components/ui/Modal';
import { formatINR } from '../../utils/format';
import { toast } from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';

export default function LendingDashboard() {
  const lendingBorrowers = usePortfolioStore((s) => s.lendingBorrowers);
  const lendingTransactions = usePortfolioStore((s) => s.lendingTransactions);
  const addBorrower = usePortfolioStore((s) => s.addLendingBorrower);
  const addTxn = usePortfolioStore((s) => s.addLendingTransaction);
  const updateBorrower = usePortfolioStore((s) => s.updateLendingBorrower);
  const deleteBorrower = usePortfolioStore((s) => s.deleteLendingBorrower);
  const deleteTxn = usePortfolioStore((s) => s.deleteLendingTransaction);
  const updateTxn = usePortfolioStore((s) => s.updateLendingTransaction);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>(
    'all',
  );

  const [borrowerModalOpen, setBorrowerModalOpen] = useState(false);
  const [selectedBorrower, setSelectedBorrower] = useState<any | null>(null);

  const [txnModalOpen, setTxnModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<any | null>(null);

  const [deletePrompt, setDeletePrompt] = useState<{
    open: boolean;
    type: 'borrower' | 'txn';
    id: string;
  }>({ open: false, type: 'borrower', id: '' });

  // NEW: State for Export Format Selection
  const [exportPrompt, setExportPrompt] = useState<{
    open: boolean;
    type: 'all' | 'single';
    data?: any;
  }>({ open: false, type: 'all' });

  const stats = useMemo(() => {
    let totalInvested = 0;
    let totalReturned = 0;
    let totalInterest = 0;

    const validBorrowerIds = new Set(lendingBorrowers.map((b) => b.id));

    lendingTransactions.forEach((t) => {
      if (validBorrowerIds.has(t.borrowerId)) {
        if (t.type === 'principal_given') totalInvested += t.amount;
        if (t.type === 'principal_returned') totalReturned += t.amount;
        if (t.type === 'interest_paid') totalInterest += t.amount;
      }
    });

    const activeAccounts = lendingBorrowers.filter(
      (b) => b.status === 'active',
    ).length;
    const closedAccounts = lendingBorrowers.filter(
      (b) => b.status === 'closed',
    ).length;

    return {
      totalInvested,
      totalReturned,
      outstanding: totalInvested - totalReturned,
      totalInterest,
      activeAccounts,
      closedAccounts,
    };
  }, [lendingTransactions, lendingBorrowers]);

  const borrowersWithMetrics = useMemo(() => {
    return lendingBorrowers
      .map((b) => {
        let given = 0;
        let returned = 0;
        let interest = 0;

        const bTxns = lendingTransactions.filter((t) => t.borrowerId === b.id);
        bTxns.forEach((t) => {
          if (t.type === 'principal_given') given += t.amount;
          if (t.type === 'principal_returned') returned += t.amount;
          if (t.type === 'interest_paid') interest += t.amount;
        });

        const outstanding = given - returned;
        const isOverdue =
          b.nextDueDate && b.status === 'active'
            ? isBefore(parseISO(b.nextDueDate), new Date())
            : false;

        return {
          ...b,
          given,
          returned,
          interest,
          outstanding,
          isOverdue,
          txns: bTxns,
        };
      })
      .filter((b) => {
        if (statusFilter !== 'all' && b.status !== statusFilter) return false;
        if (search && !b.name.toLowerCase().includes(search.toLowerCase()))
          return false;
        return true;
      });
  }, [lendingBorrowers, lendingTransactions, search, statusFilter]);

  useEffect(() => {
    if (selectedBorrower) {
      const updated = borrowersWithMetrics.find(
        (b) => b.id === selectedBorrower.id,
      );
      if (updated) setSelectedBorrower(updated);
    }
  }, [borrowersWithMetrics]);

  // NEW: Advanced Export Logic (handles both Global and Single users, CSV and PDF)
  const executeExport = (formatType: 'csv' | 'pdf') => {
    if (exportPrompt.type === 'all') {
      const filename = `Lending_Report_${new Date().toISOString().split('T')[0]}`;

      if (formatType === 'csv') {
        const data = borrowersWithMetrics.map((b) => ({
          Name: b.name,
          Phone: b.phone ?? '',
          Status: b.status,
          'Total Given': b.given,
          'Total Returned': b.returned,
          Outstanding: b.outstanding,
          'Interest Earned': b.interest,
          'Next Due Date': b.nextDueDate ?? '',
        }));
        exportCSV(data, `${filename}.csv`);
      } else {
        const headers = [
          'Name',
          'Phone',
          'Status',
          'Given (Rs)',
          'Returned',
          'Outstanding',
          'Interest',
          'Due Date',
        ];
        const data = borrowersWithMetrics.map((b) => [
          b.name,
          b.phone || '-',
          b.status.toUpperCase(),
          b.given,
          b.returned,
          b.outstanding,
          b.interest,
          b.nextDueDate || '-',
        ]);
        exportPDF('Global Lending Report', headers, data, `${filename}.pdf`);
      }
    } else if (exportPrompt.type === 'single' && exportPrompt.data) {
      const b = exportPrompt.data;
      const filename = `Statement_${b.name.replace(/\s+/g, '_')}`;

      if (formatType === 'csv') {
        const rows = b.txns.map((t: any) => ({
          Date: t.date,
          Type:
            t.type === 'principal_given'
              ? 'Lent'
              : t.type === 'principal_returned'
                ? 'Returned'
                : 'Interest',
          Amount: t.amount,
          Notes: t.notes ?? '',
        }));
        exportCSV(rows, `${filename}.csv`);
      } else {
        const headers = ['Date', 'Type', 'Amount (Rs)', 'Notes'];
        const data = b.txns.map((t: any) => [
          t.date,
          t.type === 'principal_given'
            ? 'Principal Lent'
            : t.type === 'principal_returned'
              ? 'Principal Returned'
              : 'Interest Paid',
          t.amount,
          t.notes || '-',
        ]);
        exportPDF(
          `${b.name} - Financial Statement`,
          headers,
          data,
          `${filename}.pdf`,
        );
      }
    }

    setExportPrompt({ open: false, type: 'all' });
    toast.success(`Downloaded as ${formatType.toUpperCase()}`);
  };

  const handleSaveBorrower = async (data: any, initialAmount?: number) => {
    if (data.id) {
      await updateBorrower(data.id, data);
      toast.success('Profile updated');
    } else {
      await addBorrower(data);
      if (initialAmount && initialAmount > 0) {
        const latestBorrowers = usePortfolioStore.getState().lendingBorrowers;
        const newBorrower = latestBorrowers.find(
          (b) => b.name === data.name && b.phone === data.phone,
        );
        if (newBorrower) {
          await addTxn({
            borrowerId: newBorrower.id,
            type: 'principal_given',
            amount: initialAmount,
            date: new Date().toISOString().split('T')[0],
            notes: 'Initial Amount Given',
          });
        }
      }
      toast.success('Borrower created successfully');
    }
    setBorrowerModalOpen(false);
  };

  const handleSaveTxn = async (data: any, advanceDue: boolean) => {
    if (data.id) {
      await updateTxn(data.id, data);
      toast.success('Transaction updated successfully');
    } else {
      await addTxn(data);

      if (data.type === 'principal_returned' && selectedBorrower) {
        const newOutstanding = selectedBorrower.outstanding - data.amount;
        if (newOutstanding <= 0 && selectedBorrower.status !== 'closed') {
          await updateBorrower(selectedBorrower.id, {
            status: 'closed',
            nextDueDate: '',
          });
          toast.success('🎉 Principal fully repaid! Account auto-closed.', {
            duration: 4000,
          });
        } else {
          toast.success('Principal return recorded.');
        }
      } else if (
        data.type === 'principal_given' &&
        selectedBorrower?.status === 'closed'
      ) {
        await updateBorrower(selectedBorrower.id, { status: 'active' });
        toast.success('New loan given. Account auto-reopened!');
      } else if (
        advanceDue &&
        selectedBorrower?.nextDueDate &&
        data.type === 'interest_paid'
      ) {
        try {
          const currentDue = parseISO(selectedBorrower.nextDueDate);
          const nextDue = addMonths(currentDue, 1);
          const nextDueStr = format(nextDue, 'yyyy-MM-dd');
          await updateBorrower(selectedBorrower.id, {
            nextDueDate: nextDueStr,
          });
          toast.success(
            `Payment recorded! Due date advanced to ${format(nextDue, 'dd MMM yyyy')}`,
          );
        } catch (e) {
          toast.success('Payment recorded!');
        }
      } else {
        toast.success('Transaction added successfully');
      }
    }
    setTxnModalOpen(false);
    setEditingTxn(null);
  };

  const executeDelete = async () => {
    if (deletePrompt.type === 'borrower') {
      const borrowerId = deletePrompt.id;
      const txnsToDelete = lendingTransactions.filter(
        (t) => t.borrowerId === borrowerId,
      );
      setSelectedBorrower(null);
      setDeletePrompt({ open: false, type: 'borrower', id: '' });
      for (const txn of txnsToDelete) await deleteTxn(txn.id);
      await deleteBorrower(borrowerId);
      toast.success('Borrower and all records deleted.');
    } else if (deletePrompt.type === 'txn') {
      await deleteTxn(deletePrompt.id);
      setDeletePrompt({ open: false, type: 'txn', id: '' });
      toast.success('Transaction deleted.');
    }
  };

  return (
    <div className='flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-300'>
      {/* DASHBOARD SUMMARY */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <div className='bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border border-indigo-500/20 rounded-2xl p-5 shadow-sm'>
          <p className='text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1'>
            Total Principal Given
          </p>
          <p className='text-2xl font-bold text-slate-900 dark:text-slate-100'>
            {formatINR(stats.totalInvested)}
          </p>
          <div className='mt-2 flex items-center gap-1.5 text-xs text-indigo-300/80'>
            <FiBriefcase className='h-3.5 w-3.5' /> Total Disbursed
          </div>
        </div>
        <div className='bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-5 shadow-sm'>
          <p className='text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1'>
            Total Interest Earned
          </p>
          <p className='text-2xl font-bold text-emerald-500'>
            {formatINR(stats.totalInterest)}
          </p>
          <div className='mt-2 flex items-center gap-1.5 text-xs text-emerald-300/80'>
            <FiTrendingUp className='h-3.5 w-3.5' /> Pure Profit
          </div>
        </div>
        <div className='bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-5 shadow-sm'>
          <p className='text-xs font-bold uppercase tracking-wider text-amber-400 mb-1'>
            Outstanding Balance
          </p>
          <p className='text-2xl font-bold text-amber-500'>
            {formatINR(stats.outstanding)}
          </p>
          <div className='mt-2 flex items-center gap-1.5 text-xs text-amber-300/80'>
            <FiClock className='h-3.5 w-3.5' /> Yet to be returned
          </div>
        </div>
        <div className='bg-slate-100/90 dark:bg-slate-800/40 border border-slate-300/70 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm'>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1'>
            Accounts
          </p>
          <p className='text-2xl font-bold text-slate-900 dark:text-slate-100'>
            {stats.activeAccounts}{' '}
            <span className='text-lg text-slate-900 dark:text-slate-500 font-medium'>Active</span>
          </p>
          <div className='mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400'>
            <FiCheckCircle className='h-3.5 w-3.5' /> {stats.closedAccounts}{' '}
            Closed Accounts
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-300/60 dark:border-slate-700/50'>
        <div className='flex flex-1 items-center gap-3'>
          <input
            type='text'
            placeholder='Search borrower...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className='cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
          >
            <option value='all'>All Status</option>
            <option value='active'>Active</option>
            <option value='closed'>Closed</option>
          </select>
        </div>
        <div className='flex items-center gap-3'>
          {/* TRIGGER GLOBAL EXPORT MODAL */}
          <button
            onClick={() => setExportPrompt({ open: true, type: 'all' })}
            className='flex cursor-pointer items-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600'
          >
            <FiDownload className='hidden sm:block' /> Report
          </button>
          <button
            onClick={() => {
              setSelectedBorrower(null);
              setBorrowerModalOpen(true);
            }}
            className='flex items-center gap-2 bg-indigo-600 cursor-pointer hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-indigo-500/20 transition'
          >
            <FiPlus /> New Borrower
          </button>
        </div>
      </div>

      {/* CARDS GRID */}
      {borrowersWithMetrics.length === 0 ? (
        <div className='py-20 text-center flex flex-col items-center'>
          <div className='h-16 w-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4'>
            <FiUsers className='h-8 w-8 text-slate-900 dark:text-slate-500' />
          </div>
          <p className='text-slate-500 dark:text-slate-400 font-medium'>No borrowers found.</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
          {borrowersWithMetrics.map((b) => {
            const progressPct =
              b.given > 0
                ? Math.min(100, Math.round((b.returned / b.given) * 100))
                : 0;
            return (
              <div
                key={b.id}
                onClick={() => setSelectedBorrower(b)}
                className='group relative bg-slate-200/70 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700/50 hover:border-indigo-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 shadow-sm hover:shadow-indigo-500/10'
              >
                <div className='flex justify-between items-start mb-4'>
                  <div>
                    <h3 className='text-lg font-bold text-white leading-tight'>
                      {b.name}
                    </h3>
                    {b.phone && (
                      <p className='text-xs text-slate-500 dark:text-slate-400 mt-0.5'>{b.phone}</p>
                    )}
                  </div>
                  <div
                    className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${b.status === 'active' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-200 dark:bg-slate-300 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600'}`}
                  >
                    {b.status}
                  </div>
                </div>

                <div className='space-y-3 mb-4'>
                  <div className='flex justify-between text-sm'>
                    <span className='text-slate-900 dark:text-slate-500'>Principal Given</span>
                    <span className='font-semibold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
                      {formatINR(b.given)}
                    </span>
                  </div>
                  <div className='flex justify-between text-sm'>
                    <span className='text-slate-900 dark:text-slate-500'>Interest Earned</span>
                    <span className='font-semibold text-emerald-400'>
                      +{formatINR(b.interest)}
                    </span>
                  </div>

                  {/* Progress Bar for Principal Return */}
                  <div className='pt-2'>
                    <div className='flex justify-between text-xs mb-1'>
                      <span className='text-slate-500 dark:text-slate-400 font-medium'>
                        Repayment Progress
                      </span>
                      <span className='text-slate-600 dark:text-slate-700 dark:text-slate-300 font-bold'>
                        {progressPct}%
                      </span>
                    </div>
                    <div className='w-full bg-slate-300 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden'>
                      <div
                        className={`h-1.5 rounded-full ${progressPct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className='flex justify-between text-sm border-t border-slate-300/60 dark:border-slate-700/50 pt-2'>
                    <span className='text-slate-500 dark:text-slate-400 font-medium'>
                      Outstanding
                    </span>
                    <span
                      className={`font-bold ${b.outstanding > 0 ? 'text-amber-500' : 'text-emerald-500'}`}
                    >
                      {formatINR(b.outstanding)}
                    </span>
                  </div>
                </div>

                {b.isOverdue && (
                  <div className='absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1'>
                    <FiAlertCircle /> Overdue
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* EXPORT FORMAT MODAL */}
      <Modal
        open={exportPrompt.open}
        onClose={() => setExportPrompt({ open: false, type: 'all' })}
        title='Select Download Format'
      >
        <div className='grid grid-cols-2 gap-4 py-4'>
          <button
            onClick={() => executeExport('csv')}
            className='flex flex-col items-center gap-3 p-6 border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 hover:bg-indigo-500/10 hover:border-indigo-500/50 rounded-2xl transition'
          >
            <FiFileText className='text-4xl text-slate-500 dark:text-slate-400' />
            <div className='text-center'>
              <p className='font-bold text-white'>CSV (Excel)</p>
              <p className='text-xs text-slate-900 dark:text-slate-500 mt-1'>
                Best for spreadsheets
              </p>
            </div>
          </button>
          <button
            onClick={() => executeExport('pdf')}
            className='flex flex-col items-center gap-3 p-6 border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 hover:bg-rose-500/10 hover:border-rose-500/50 rounded-2xl transition'
          >
            <FiFile className='text-4xl text-rose-400' />
            <div className='text-center'>
              <p className='font-bold text-white'>PDF Document</p>
              <p className='text-xs text-slate-900 dark:text-slate-500 mt-1'>
                Best for printing/sharing
              </p>
            </div>
          </button>
        </div>
      </Modal>

      {/* CONFIRMATION OVERLAY */}
      {deletePrompt.open && (
        <div className='fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
          <div className='bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-6 rounded-2xl shadow-2xl max-w-md w-full'>
            <h3 className='text-lg font-bold text-white mb-4 flex items-center gap-2'>
              <FiAlertCircle className='text-rose-500' /> Confirm Deletion
            </h3>
            <p className='text-sm text-slate-600 dark:text-slate-700 dark:text-slate-300 mb-6'>
              {deletePrompt.type === 'borrower'
                ? 'Are you absolutely sure you want to delete this borrower? All their money records and transactions will be permanently deleted. This cannot be undone.'
                : 'Are you sure you want to delete this specific transaction? This cannot be undone.'}
            </p>
            <div className='flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800'>
              <button
                onClick={() =>
                  setDeletePrompt({ open: false, type: 'borrower', id: '' })
                }
                className='px-5 py-2.5 rounded-xl cursor-pointer text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 transition'
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className='px-5 py-2.5 rounded-xl cursor-pointer text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white transition'
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {borrowerModalOpen && (
        <UpsertBorrowerModal
          open={borrowerModalOpen}
          onClose={() => setBorrowerModalOpen(false)}
          onSave={handleSaveBorrower}
          initialData={selectedBorrower || undefined}
        />
      )}

      {selectedBorrower &&
        !borrowerModalOpen &&
        !txnModalOpen &&
        borrowersWithMetrics.some((b) => b.id === selectedBorrower.id) && (
          <BorrowerDetailModal
            borrower={selectedBorrower}
            onClose={() => setSelectedBorrower(null)}
            onAddTxn={() => {
              setEditingTxn(null);
              setTxnModalOpen(true);
            }}
            onEditTxn={(txn: any) => {
              setEditingTxn(txn);
              setTxnModalOpen(true);
            }}
            onEditBorrower={() => setBorrowerModalOpen(true)}
            // TRIGGER EXPORT MODAL FOR SINGLE USER
            onExport={() =>
              setExportPrompt({
                open: true,
                type: 'single',
                data: selectedBorrower,
              })
            }
            onDeleteBorrower={() =>
              setDeletePrompt({
                open: true,
                type: 'borrower',
                id: selectedBorrower.id,
              })
            }
            onDeleteTxn={(txnId: string) =>
              setDeletePrompt({ open: true, type: 'txn', id: txnId })
            }
          />
        )}

      {txnModalOpen && selectedBorrower && (
        <UpsertTransactionModal
          open={txnModalOpen}
          borrower={selectedBorrower}
          initialData={editingTxn}
          onClose={() => {
            setTxnModalOpen(false);
            setEditingTxn(null);
          }}
          onSave={handleSaveTxn}
        />
      )}
    </div>
  );
}

// ── INTERNAL COMPONENTS / MODALS ── //

function UpsertBorrowerModal({ open, onClose, onSave, initialData }: any) {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [email, setEmail] = useState((initialData as any)?.email || '');
  const [rate, setRate] = useState(initialData?.interestRate?.toString() || '');
  const [dueDate, setDueDate] = useState(initialData?.nextDueDate || '');
  const [status, setStatus] = useState(initialData?.status || 'active');
  const [initialAmount, setInitialAmount] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? 'Edit Borrower' : 'New Borrower'}
    >
      <div className='space-y-4'>
        <div>
          <label className='text-xs font-bold text-slate-500 dark:text-slate-400'>
            Name <span className='text-rose-500'>*</span>
          </label>
          <input
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. Rahul Sharma'
            className='w-full bg-slate-50 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 mt-1 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20'
          />
        </div>

        {!initialData && (
          <div>
            <label className='text-xs font-bold text-slate-500 dark:text-slate-400'>
              Initial Principal Given (₹){' '}
              <span className='text-rose-500'>*</span>
            </label>
            <input
              type='number'
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              placeholder='e.g. 100000'
              className='w-full bg-slate-50 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 mt-1 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20'
            />
          </div>
        )}

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='text-xs font-bold text-slate-500 dark:text-slate-400'>Phone</label>
            <input
              type='text'
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className='w-full bg-slate-50 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 mt-1 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20'
            />
          </div>
          <div>
            <label className='text-xs font-bold text-slate-500 dark:text-slate-400'>
              Email Address
            </label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='For statements'
              className='w-full bg-slate-50 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 mt-1 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20'
            />
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='text-xs font-bold text-slate-500 dark:text-slate-400'>
              Interest Rate (% per mo)
            </label>
            <input
              type='number'
              step='0.1'
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder='e.g. 2'
              className='w-full bg-slate-50 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 mt-1 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20'
            />
          </div>
          <div>
            <label className='text-xs font-bold text-slate-500 dark:text-slate-400'>
              Next Due Date
            </label>
            <input
              type='date'
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className='w-full bg-slate-50 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 mt-1 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20'
            />
          </div>
        </div>

        {!initialData && (
          <div>
            <label className='text-xs font-bold text-slate-500 dark:text-slate-400'>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className='w-full bg-slate-50 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 mt-1 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20'
            >
              <option value='active'>Active</option>
              <option value='closed'>Closed</option>
            </select>
          </div>
        )}

        <button
          onClick={() => {
            if (!name.trim()) return toast.error('Borrower name is required');
            if (!initialData && !initialAmount)
              return toast.error('Initial Principal Amount is required');
            onSave(
              {
                id: initialData?.id,
                name,
                phone,
                email,
                status: initialData?.status || status,
                interestRate: rate ? Number(rate) : undefined,
                nextDueDate: dueDate,
              },
              initialAmount ? Number(initialAmount) : undefined,
            );
          }}
          className='w-full bg-indigo-600 cursor-pointer hover:bg-indigo-500 text-white font-bold py-3 rounded-xl mt-4 transition-colors'
        >
          {initialData ? 'Update Profile' : 'Save & Create Borrower'}
        </button>
      </div>
    </Modal>
  );
}

function UpsertTransactionModal({
  open,
  onClose,
  onSave,
  borrower,
  initialData,
}: any) {
  const [type, setType] = useState<LendingTransactionType>(
    initialData?.type || 'interest_paid',
  );
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [date, setDate] = useState(
    initialData?.date || new Date().toISOString().split('T')[0],
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [advanceDue, setAdvanceDue] = useState(!initialData);

  useEffect(() => {
    if (
      !initialData &&
      type === 'interest_paid' &&
      borrower.outstanding > 0 &&
      borrower.interestRate
    ) {
      const calculatedInterest =
        (borrower.outstanding * borrower.interestRate) / 100;
      setAmount(calculatedInterest.toString());
      setNotes(`Interest for month of ${format(new Date(date), 'MMMM')}`);
    } else if (!initialData) {
      setAmount('');
      setNotes('');
    }
  }, [type, borrower.outstanding, borrower.interestRate, date, initialData]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? 'Edit Transaction' : 'Add Transaction'}
    >
      <div className='space-y-4'>
        <div>
          <label className='text-xs font-bold text-slate-500 dark:text-slate-400'>
            Transaction Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className='w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-white mt-1 outline-none focus:border-indigo-500'
          >
            <option value='interest_paid'>Interest Received (Profit)</option>
            <option value='principal_given'>
              Give More Principal (Lend More)
            </option>
            <option value='principal_returned'>
              Principal Returned (Reduce Debt)
            </option>
          </select>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='text-xs font-bold text-slate-500 dark:text-slate-400'>
              Amount (₹) <span className='text-rose-500'>*</span>
            </label>
            <input
              type='number'
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className='w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-white mt-1 outline-none focus:border-indigo-500'
            />
            {!initialData &&
              type === 'interest_paid' &&
              borrower.interestRate && (
                <p className='text-[10px] text-emerald-500 mt-1'>
                  Auto-calc: {borrower.interestRate}% of{' '}
                  {formatINR(borrower.outstanding)}
                </p>
              )}
          </div>
          <div>
            <label className='text-xs font-bold text-slate-500 dark:text-slate-400'>Date</label>
            <input
              type='date'
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className='w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-white mt-1 outline-none focus:border-indigo-500'
            />
          </div>
        </div>

        <div>
          <label className='text-xs font-bold text-slate-500 dark:text-slate-400'>
            Notes (Optional)
          </label>
          <input
            type='text'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. Bank Transfer'
            className='w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-white mt-1 outline-none focus:border-indigo-500'
          />
        </div>

        {!initialData && type === 'interest_paid' && borrower.nextDueDate && (
          <div className='bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-3 mt-2'>
            <input
              type='checkbox'
              checked={advanceDue}
              onChange={(e) => setAdvanceDue(e.target.checked)}
              className='mt-1 w-4 h-4 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-indigo-500 focus:ring-indigo-500'
            />
            <div>
              <p className='text-sm font-bold text-indigo-400'>
                Auto-Advance Due Date
              </p>
              <p className='text-xs text-indigo-300/80'>
                Automatically moves the due date forward by 1 month.
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            if (!amount || Number(amount) <= 0)
              return toast.error('Valid amount is required');
            onSave(
              {
                id: initialData?.id,
                borrowerId: borrower.id,
                type,
                amount: Number(amount),
                date,
                notes,
              },
              advanceDue && type === 'interest_paid' && !initialData,
            );
          }}
          className='w-full bg-indigo-600 cursor-pointer hover:bg-indigo-500 text-white font-bold py-3 rounded-xl mt-4 transition-colors shadow-lg shadow-indigo-500/20'
        >
          {initialData ? 'Update Transaction' : 'Confirm Payment'}
        </button>
      </div>
    </Modal>
  );
}

function BorrowerDetailModal({
  borrower,
  onClose,
  onAddTxn,
  onEditTxn,
  onEditBorrower,
  onExport, // Received export handler
  onDeleteBorrower,
  onDeleteTxn,
}: any) {
  const interestData = useMemo(() => {
    const grouped: Record<string, number> = {};
    borrower.txns
      .filter((t: any) => t.type === 'interest_paid')
      .forEach((t: any) => {
        const mo = t.date.slice(0, 7);
        grouped[mo] = (grouped[mo] || 0) + t.amount;
      });
    return Object.keys(grouped)
      .sort()
      .map((k) => ({ date: k, amount: grouped[k] }));
  }, [borrower.txns]);

  const progressPct =
    borrower.given > 0
      ? Math.min(100, Math.round((borrower.returned / borrower.given) * 100))
      : 0;

  return (
    <div className='fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom-8 duration-300'>
      {/* HEADER */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 sticky top-0 z-10'>
        <div>
          <div className='flex items-center gap-3 mb-1'>
            <h2 className='text-xl font-bold text-white'>{borrower.name}</h2>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${borrower.status === 'active' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
            >
              {borrower.status}
            </span>
          </div>
          <p className='text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4'>
            {borrower.phone && <span>📞 {borrower.phone}</span>}
            {borrower.email && <span>✉️ {borrower.email}</span>}
            {borrower.interestRate ? (
              <span>📈 {borrower.interestRate}% / mo</span>
            ) : (
              <span>📈 No Interest Rate</span>
            )}
            {borrower.nextDueDate && (
              <span
                className={
                  borrower.isOverdue
                    ? 'text-rose-400 font-bold'
                    : 'text-emerald-400'
                }
              >
                📅 Due: {format(parseISO(borrower.nextDueDate), 'dd MMM yyyy')}
              </span>
            )}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <button
            onClick={onEditBorrower}
            className='btn-icon btn-icon-edit h-9 w-9'
          >
            <FiEdit2 />
          </button>

          {/* UPDATED: Download now triggers Export Modal */}
          <button
            onClick={onExport}
            title='Download Statement'
            className='btn-icon btn-icon-edit h-9 w-9'
          >
            <FiDownload />
          </button>
          <button
            onClick={onDeleteBorrower}
            title='Delete Borrower'
            className='p-2 text-rose-400 cursor-pointer hover:text-rose-300 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:bg-slate-700 rounded-lg transition-colors'
          >
            <FiTrash2 />
          </button>

          <div className='w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block'></div>

          <button
            onClick={onClose}
            className='flex items-center gap-2 px-3 py-2 text-sm font-medium cursor-pointer text-white bg-rose-500/20 hover:bg-rose-500/40 rounded-lg transition-colors'
          >
            <FiX /> Close
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-y-auto p-4 md:p-6 space-y-6'>
        {/* Progress Bar Section */}
        <div className='bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5'>
          <div className='flex justify-between items-end mb-2'>
            <div>
              <p className='text-sm font-bold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
                Principal Repayment Progress
              </p>
              <p className='text-xs text-slate-900 dark:text-slate-500'>
                How much of the original loan has been recovered
              </p>
            </div>
            <div className='text-right'>
              <span className='text-lg font-bold text-white'>
                {progressPct}%
              </span>
            </div>
          </div>
          <div className='w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden'>
            <div
              className={`h-full rounded-full ${progressPct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${progressPct}%` }}
            ></div>
          </div>
        </div>

        {/* TOP STATS */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <div className='bg-slate-100 dark:bg-slate-800/50 border border-slate-300/60 dark:border-slate-700/50 rounded-2xl p-4'>
            <p className='text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400'>
              Total Given
            </p>
            <p className='text-xl font-bold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
              {formatINR(borrower.given)}
            </p>
          </div>
          <div className='bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4'>
            <p className='text-[10px] font-bold uppercase text-emerald-400'>
              Total Interest
            </p>
            <p className='text-xl font-bold text-emerald-500'>
              +{formatINR(borrower.interest)}
            </p>
          </div>
          <div className='bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4'>
            <p className='text-[10px] font-bold uppercase text-amber-400'>
              Outstanding Principal
            </p>
            <p className='text-xl font-bold text-amber-500'>
              {formatINR(borrower.outstanding)}
            </p>
          </div>
          <div className='bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex flex-col justify-center items-center'>
            <button
              onClick={onAddTxn}
              className='flex items-center justify-center gap-2 cursor-pointer w-full h-full font-bold text-indigo-400 hover:text-indigo-300 transition-colors'
            >
              <FiPlus className='h-5 w-5' /> Add Transaction
            </button>
          </div>
        </div>

        {/* CHART SECTION */}
        <div className='bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 h-[300px]'>
          <h3 className='text-sm font-bold text-slate-500 dark:text-slate-400 mb-4'>
            Interest Earned Over Time
          </h3>
          {interestData.length > 0 ? (
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={interestData}>
                <CartesianGrid
                  strokeDasharray='3 3'
                  stroke='#334155'
                  vertical={false}
                />
                <XAxis
                  dataKey='date'
                  stroke='#94a3b8'
                  fontSize={12}
                  tickMargin={10}
                />
                <YAxis
                  stroke='#94a3b8'
                  fontSize={12}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey='amount'
                  name='Interest'
                  fill='#10b981'
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className='flex h-full items-center justify-center text-slate-900 dark:text-slate-500'>
              No interest data yet.
            </div>
          )}
        </div>

        {/* LEDGER TABLE */}
        <div className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden'>
          <div className='px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center'>
            <h3 className='text-sm font-bold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
              Transaction Ledger
            </h3>
          </div>
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm whitespace-nowrap'>
              <thead className='bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider'>
                <tr>
                  <th className='px-5 py-3'>Date</th>
                  <th className='px-5 py-3'>Type</th>
                  <th className='px-5 py-3'>Notes</th>
                  <th className='px-5 py-3 text-right'>Amount</th>
                  <th className='px-5 py-3 text-center'>Action</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-200 dark:divide-slate-800'>
                {borrower.txns.map((t: any) => (
                  <tr key={t.id} className='hover:bg-slate-100/80 dark:bg-slate-800/30'>
                    <td className='px-5 py-3 text-slate-600 dark:text-slate-700 dark:text-slate-300'>
                      {format(parseISO(t.date), 'dd MMM yyyy')}
                    </td>
                    <td className='px-5 py-3'>
                      {t.type === 'principal_given' && (
                        <span className='text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded font-medium'>
                          Lent Money
                        </span>
                      )}
                      {t.type === 'principal_returned' && (
                        <span className='text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded font-medium'>
                          Principal Returned
                        </span>
                      )}
                      {t.type === 'interest_paid' && (
                        <span className='text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded font-medium'>
                          Interest Paid
                        </span>
                      )}
                    </td>
                    <td className='px-5 py-3 text-slate-900 dark:text-slate-500 truncate max-w-[200px]'>
                      {t.notes || '-'}
                    </td>
                    <td className='px-5 py-3 text-right font-bold text-white'>
                      {formatINR(t.amount)}
                    </td>
                    <td className='px-5 py-3 text-center flex justify-center gap-2'>
                      <button
                        onClick={() => onEditTxn(t)}
                        title='Edit Transaction'
                        className='btn-icon btn-icon-edit h-8 w-8'
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => onDeleteTxn(t.id)}
                        title='Delete Transaction'
                        className='text-slate-900 dark:text-slate-500 hover:text-rose-400 cursor-pointer transition-colors p-1'
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
                {borrower.txns.length === 0 && (
                  <tr>
                    <td colSpan={5} className='text-center py-8 text-slate-900 dark:text-slate-500'>
                      No transactions recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
