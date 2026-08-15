// src/components/settings/DataManagement.tsx

import {
  FiArrowDown,
  FiArrowUp,
  FiCheck,
  FiDownload,
  FiFileText,
  FiGrid,
  FiPackage,
  FiTable,
  FiTrash2,
  FiUpload,
  FiUserX,
} from 'react-icons/fi';
import {
  exportAllCSVAsZip,
  exportAllSectionsAsCSV,
} from '../../utils/exportUtils';
import { exportFullBackup, importFullBackup } from '../../utils/backup';
import { useRef, useState } from 'react';

import { Modal } from '../ui/Modal';
import { auth } from '../../services/firebase';
import { deleteUser } from 'firebase/auth';
import toast from 'react-hot-toast';
import { useAgriStore } from '../../store/agricultureStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useSubscription } from '../../context/SubscriptionContext';

const SIP_STORAGE_KEY = 'fintrackly_sip_plan';

function StatBadge({ label, count }: { label: string; count: number }) {
  return (
    <div className='flex items-center justify-between bg-slate-200/70 dark:bg-slate-800/60 border border-slate-300/60 dark:border-slate-700/50 rounded-lg px-3 py-2'>
      <span className='text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5'>
        <FiCheck
          className={`h-3 w-3 ${count > 0 ? 'text-emerald-400' : 'text-slate-500 dark:text-slate-600'}`}
        />
        {label}
      </span>
      <span
        className={`text-xs font-bold ${count > 0 ? 'text-slate-900 dark:text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-600'}`}
      >
        {count}
      </span>
    </div>
  );
}

export function ExportImport() {
  const state = usePortfolioStore();
  const { hydrate, uid } = state;
  const { hasPremiumAccess } = useSubscription();
  const agriState = useAgriStore();
  const agriHydrate = agriState.hydrate;
  const attState = useAttendanceStore();
  const attHydrate = attState.hydrate;

  const importRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, number>>({});
  const [pendingFile, setPendingFile] = useState<string | null>(null);

  const agriRecordsCount =
    (agriState.fields?.length ?? 0) +
    (agriState.cropCycles?.length ?? 0) +
    (agriState.agriExpenses?.length ?? 0) +
    (agriState.livestockEvents?.length ?? 0) +
    (agriState.milkRecords?.length ?? 0) +
    (agriState.coconutRecords?.length ?? 0) +
    (agriState.produceSales?.length ?? 0);

  const attRecordsCount =
    (attState.employees?.length ?? 0) +
    (attState.attendanceRecords?.length ?? 0) +
    (attState.transactions?.length ?? 0) +
    (attState.salaryRecords?.length ?? 0);

  const exportSummary: Record<string, number> = {
    Investments: state.investments?.length ?? 0,
    'Profits (Sold)': state.soldTrades?.length ?? 0,
    Liabilities: state.liabilities?.length ?? 0,
    'Pending Payments': state.pendingPayments?.length ?? 0,
    'Payment Tracker': state.trackedPayments?.length ?? 0,
    Cashflows: state.cashflows?.length ?? 0,
    Goals: state.goals?.length ?? 0,
    'Goal Contributions': (state as any).goalContributions?.length ?? 0,
    Credentials: state.credentials?.length ?? 0, // ← NEW
    Accounts: state.accounts?.length ?? 0,
    'Insurance Policies': state.insurancePolicies?.length ?? 0,
    'Insurance Payments': (state as any).insurancePayments?.length ?? 0,
    'SIP Plans': state.sipPlans?.length ?? 0,
    'Lending Records':
      (state.lendingBorrowers?.length ?? 0) +
      (state.lendingTransactions?.length ?? 0),
    'Agri Records': agriRecordsCount,
    'Attendance Records': attRecordsCount,
  };

  const totalRecords = Object.values(exportSummary).reduce((s, n) => s + n, 0);

  const handleExportCSVSeparate = () => {
    if (!hasPremiumAccess) {
      toast.error('CSV export requires a premium subscription.');
      return;
    }
    if (totalRecords === 0) {
      toast.error('Nothing to export — add some data first.');
      return;
    }
    exportAllSectionsAsCSV(state, agriState, {
      employees: attState.employees,
      attendanceRecords: attState.attendanceRecords,
      transactions: attState.transactions,
      salaryRecords: attState.salaryRecords,
    });
    toast.success('All sections exported as separate CSV files.');
  };

  const handleExportCSVZip = async () => {
    if (!hasPremiumAccess) {
      toast.error('CSV export requires a premium subscription.');
      return;
    }
    if (totalRecords === 0) {
      toast.error('Nothing to export — add some data first.');
      return;
    }
    setBusy(true);
    try {
      await exportAllCSVAsZip(state, agriState, {
        employees: attState.employees,
        attendanceRecords: attState.attendanceRecords,
        transactions: attState.transactions,
        salaryRecords: attState.salaryRecords,
      });
      toast.success('All data exported as a single ZIP file.');
    } catch (err: any) {
      toast.error(err.message || 'ZIP export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleExportJSON = async () => {
    if (!uid) {
      toast.error('Session expired. Please log in again.');
      return;
    }
    setBusy(true);
    try {
      await exportFullBackup(uid);
      toast.success('Full JSON backup downloaded.');
    } catch (err: any) {
      toast.error(err.message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasPremiumAccess) {
      toast.error('Cloud backup restore requires a premium subscription.');
      if (importRef.current) importRef.current.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const importedAgriCount =
        (parsed.agriFields?.length ?? 0) +
        (parsed.agriCropCycles?.length ?? 0) +
        (parsed.agriExpenses?.length ?? 0) +
        (parsed.agriLivestockEvents?.length ?? 0) +
        (parsed.agriMilkRecords?.length ?? 0) +
        (parsed.agriCoconut?.length ?? 0) +
        (parsed.agriProduceSales?.length ?? 0);
      const importedAttCount =
        (parsed.attEmployees?.length ?? 0) +
        (parsed.attRecords?.length ?? 0) +
        (parsed.attTransactions?.length ?? 0) +
        (parsed.attSalary?.length ?? 0);

      const counts: Record<string, number> = {
        Investments: parsed.investments?.length ?? 0,
        'Profits (Sold)': parsed.soldTrades?.length ?? 0,
        Liabilities: parsed.liabilities?.length ?? 0,
        'Pending Payments': parsed.pendingPayments?.length ?? 0,
        'Payment Tracker': parsed.trackedPayments?.length ?? 0,
        Cashflows: parsed.cashflows?.length ?? 0,
        Goals: parsed.goals?.length ?? 0,
        'Goal Contributions': parsed.goalContributions?.length ?? 0,
        Credentials: parsed.credentials?.length ?? 0, // ← NEW
        Accounts: parsed.accounts?.length ?? 0,
        'Insurance Policies': parsed.insurancePolicies?.length ?? 0,
        'Insurance Payments': parsed.insurancePayments?.length ?? 0,
        'SIP Plans': parsed.sipPlans?.length ?? 0,
        'Lending Records':
          (parsed.lendingBorrowers?.length ?? 0) +
          (parsed.lendingTransactions?.length ?? 0),
        'Agri Records': importedAgriCount,
        'Attendance Records': importedAttCount,
      };

      setPreviewData(counts);
      setPendingFile(text);
      setPreviewOpen(true);
    } catch {
      toast.error('Could not parse JSON file — check the file format.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingFile || !uid) return;
    setBusy(true);
    try {
      await importFullBackup(pendingFile, uid);
      await hydrate(uid);
      await agriHydrate(uid);
      await attHydrate(uid);
      toast.success('Backup imported — all data restored.');
      setPreviewOpen(false);
      setPendingFile(null);
    } catch (err: any) {
      toast.error(err.message || 'Import failed — check JSON format.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='flex flex-col gap-4'>
      <div className='mb-2'>
        <h2 className='text-lg font-bold text-white flex items-center gap-2'>
          <FiGrid className='text-emerald-400' /> Export & Import
        </h2>
        <p className='text-sm text-slate-500 dark:text-slate-400 mt-1'>
          Download your data for analysis or as a backup. Restore from a backup
          anytime.
        </p>
      </div>

      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 p-5 flex flex-col gap-4'>
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20'>
            <FiTable className='h-4 w-4 text-emerald-400' />
          </div>
          <div>
            <p className='font-bold text-slate-900 dark:text-slate-100 text-sm'>
              Export as CSV
            </p>
            <p className='text-xs text-slate-900 dark:text-slate-500'>
              Open in Excel, Google Sheets, or any spreadsheet app.
            </p>
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-200 dark:border-slate-800 pt-4'>
          <div className='flex flex-col gap-2 rounded-xl border border-slate-300/60 dark:border-slate-700/50 bg-slate-100/90 dark:bg-slate-800/40 p-4'>
            <div className='flex items-center gap-2'>
              <FiFileText className='h-4 w-4 text-emerald-400' />
              <p className='text-sm font-bold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
                Separate Files
              </p>
            </div>
            <p className='text-xs text-slate-900 dark:text-slate-500 leading-relaxed'>
              One CSV per section.
            </p>
            <button
              onClick={handleExportCSVSeparate}
              disabled={busy}
              className='mt-auto flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50'
            >
              <FiDownload className='h-4 w-4' /> Download Files
            </button>
          </div>
          <div className='flex flex-col gap-2 rounded-xl border border-slate-300/60 dark:border-slate-700/50 bg-slate-100/90 dark:bg-slate-800/40 p-4'>
            <div className='flex items-center gap-2'>
              <FiPackage className='h-4 w-4 text-teal-400' />
              <p className='text-sm font-bold text-slate-900 dark:text-slate-800 dark:text-slate-200'>
                Single ZIP Bundle
              </p>
              <span className='text-[10px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20'>
                All-in-one
              </span>
            </div>
            <p className='text-xs text-slate-900 dark:text-slate-500 leading-relaxed'>
              All sections packaged into one ZIP file.
            </p>
            <button
              onClick={handleExportCSVZip}
              disabled={busy}
              className='mt-auto flex items-center justify-center gap-2 rounded-xl border border-teal-500/25 bg-teal-500/10 px-4 py-2 text-sm font-bold text-teal-400 hover:bg-teal-500/20 transition-colors disabled:opacity-50'
            >
              <FiPackage className='h-4 w-4' />{' '}
              {busy ? 'Packing…' : 'Download ZIP'}
            </button>
          </div>
        </div>

        <div className='border-t border-slate-200 dark:border-slate-800 pt-3'>
          <p className='text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-3'>
            What will be included ({totalRecords} records)
          </p>
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
            {Object.entries(exportSummary).map(([label, count]) => (
              <div key={label} className='flex items-center gap-2 text-xs'>
                <FiCheck
                  className={`h-3.5 w-3.5 shrink-0 ${count > 0 ? 'text-emerald-400' : 'text-slate-600 dark:text-slate-700'}`}
                />
                <span
                  className={
                    count > 0
                      ? 'text-slate-600 dark:text-slate-700 dark:text-slate-300'
                      : 'text-slate-500 dark:text-slate-600'
                  }
                >
                  {label}{' '}
                  {count > 0 && (
                    <span className='text-slate-900 dark:text-slate-500 ml-1'>
                      ({count})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 p-5 flex flex-col gap-4'>
        <div className='flex flex-col sm:flex-row sm:items-start gap-4'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20'>
            <FiArrowDown className='h-4 w-4 text-indigo-400' />
          </div>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 mb-0.5'>
              <p className='font-bold text-slate-900 dark:text-slate-100 text-sm'>
                Full Backup (JSON)
              </p>
              <span className='text-[10px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'>
                Recommended
              </span>
            </div>
            <p className='text-xs text-slate-900 dark:text-slate-500'>
              Complete backup of your entire account in one restorable file.
            </p>
          </div>
          <button
            onClick={handleExportJSON}
            disabled={busy}
            className='flex items-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-2.5 text-sm font-bold text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50 whitespace-nowrap'
          >
            <FiDownload className='h-4 w-4' />{' '}
            {busy ? 'Exporting…' : 'Export JSON'}
          </button>
        </div>
      </div>

      <div className='rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4'>
        <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20'>
          <FiArrowUp className='h-4 w-4 text-sky-400' />
        </div>
        <div className='flex-1 min-w-0'>
          <p className='font-bold text-slate-900 dark:text-slate-100 text-sm'>
            Restore from Backup
          </p>
          <p className='text-xs text-slate-900 dark:text-slate-500 mt-0.5'>
            Import a previously exported JSON backup to restore all your data.
          </p>
        </div>
        <input
          ref={importRef}
          type='file'
          accept='.json'
          className='hidden'
          onChange={handleImportFile}
        />
        <button
          onClick={() => importRef.current?.click()}
          disabled={busy}
          className='flex items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-sm font-bold text-sky-400 hover:bg-sky-500/20 transition-colors disabled:opacity-50 whitespace-nowrap'
        >
          <FiUpload className='h-4 w-4' /> {busy ? 'Importing…' : 'Import JSON'}
        </button>
      </div>

      <Modal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPendingFile(null);
        }}
        title='📦 Restore from Backup'
      >
        <div className='space-y-4'>
          <div className='bg-amber-500/10 border border-amber-500/20 rounded-xl p-3'>
            <p className='text-xs font-bold text-amber-400 flex items-center gap-1.5'>
              ⚠ This will overwrite your current data
            </p>
            <p className='text-[11px] text-amber-500/80 mt-1'>
              All existing records will be replaced with the backup file
              contents.
            </p>
          </div>
          <div>
            <p className='text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 mb-2'>
              What will be restored
            </p>
            <div className='grid grid-cols-2 gap-1.5'>
              {Object.entries(previewData).map(([label, count]) => (
                <StatBadge key={label} label={label} count={count} />
              ))}
            </div>
          </div>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4'>
            <button
              disabled={busy}
              onClick={() => {
                setPreviewOpen(false);
                setPendingFile(null);
              }}
              className='px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={handleConfirmImport}
              className='flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-60'
            >
              <FiUpload className='h-4 w-4' />{' '}
              {busy ? 'Restoring…' : 'Yes, Restore Data'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function DangerZone() {
  const state = usePortfolioStore();
  const { clearAllData } = state;
  const agriState = useAgriStore();
  const agriClear = agriState.clearAll;
  const attState = useAttendanceStore();
  const attClear = attState.clearAll;

  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountText, setDeleteAccountText] = useState('');

  const handleClearData = async () => {
    if (confirmText.trim().toLowerCase() !== 'delete') return;
    setBusy(true);
    try {
      await clearAllData();
      agriClear();
      attClear();
      try {
        localStorage.removeItem(SIP_STORAGE_KEY);
      } catch {}
      toast.success('All data cleared.');
      setConfirmOpen(false);
      setConfirmText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear data.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteAccountText.trim().toLowerCase() !== 'delete my account') return;
    setBusy(true);
    try {
      await clearAllData();
      agriClear();
      attClear();
      try {
        localStorage.removeItem(SIP_STORAGE_KEY);
      } catch {}
      const user = auth.currentUser;
      if (user) await deleteUser(user);
      toast.success('Account deleted. Goodbye!');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        toast.error(
          'For security, please log out and log back in before deleting your account.',
        );
      } else {
        toast.error(err.message || 'Failed to delete account.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className='flex flex-col gap-4 mt-6'>
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 p-5'>
          <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20'>
            <FiTrash2 className='h-5 w-5 text-rose-400' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='font-bold text-slate-900 dark:text-slate-100 text-sm'>
              Clear All Data
            </p>
            <p className='text-xs text-slate-900 dark:text-slate-500 mt-0.5'>
              Permanently wipes all data. Your login credentials remain intact.
            </p>
          </div>
          <button
            disabled={busy}
            onClick={() => {
              setConfirmText('');
              setConfirmOpen(true);
            }}
            className='flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors whitespace-nowrap'
          >
            <FiTrash2 className='h-4 w-4' /> Clear Data
          </button>
        </div>

        <div className='flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5'>
          <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30'>
            <FiUserX className='h-5 w-5 text-rose-400' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='font-bold text-rose-300 text-sm'>Delete My Account</p>
            <p className='text-xs text-slate-900 dark:text-slate-500 mt-0.5'>
              Permanently deletes all your data AND removes your login
              credentials.
            </p>
          </div>
          <button
            disabled={busy}
            onClick={() => {
              setDeleteAccountText('');
              setDeleteAccountOpen(true);
            }}
            className='flex items-center gap-2 rounded-xl border border-rose-500/50 bg-transparent px-4 py-2.5 text-sm font-bold text-rose-400 hover:bg-rose-500/15 disabled:opacity-50 transition-colors whitespace-nowrap'
          >
            <FiUserX className='h-4 w-4' /> Delete Account
          </button>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title='⚠ Confirm — Delete Everything'
      >
        <div className='space-y-5'>
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            This will{' '}
            <strong className='text-rose-400'>permanently delete</strong> every
            record. Cannot be undone.
          </p>
          <div className='rounded-xl border border-rose-500/20 bg-rose-500/10 p-3'>
            <p className='text-xs font-bold text-rose-400 mb-2'>
              Type <span className='font-mono'>delete</span> to confirm:
            </p>
            <input
              className='w-full rounded-lg border border-rose-500/30 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono text-rose-300 outline-none focus:ring-2 focus:ring-rose-500/30'
              placeholder='delete'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4'>
            <button
              disabled={busy}
              onClick={() => {
                setConfirmOpen(false);
                setConfirmText('');
              }}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              disabled={busy || confirmText.trim().toLowerCase() !== 'delete'}
              onClick={handleClearData}
              className='rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60'
            >
              {busy ? 'Wiping data…' : 'Yes, Delete Everything'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteAccountOpen}
        onClose={() => !busy && setDeleteAccountOpen(false)}
        title='🗑 Delete My Account'
      >
        <div className='space-y-5'>
          <div className='rounded-xl border border-rose-500/30 bg-rose-500/5 p-4'>
            <p className='text-sm font-bold text-rose-400 mb-2'>
              ⚠ This is permanent and irreversible
            </p>
          </div>
          <div className='rounded-xl border border-rose-500/20 bg-rose-500/10 p-3'>
            <p className='text-xs font-bold text-rose-400 mb-2'>
              Type <span className='font-mono'>delete my account</span> to
              confirm:
            </p>
            <input
              className='w-full rounded-lg border border-rose-500/30 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono text-rose-300 outline-none focus:ring-2 focus:ring-rose-500/30'
              placeholder='delete my account'
              value={deleteAccountText}
              onChange={(e) => setDeleteAccountText(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div className='flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4'>
            <button
              disabled={busy}
              onClick={() => {
                setDeleteAccountOpen(false);
                setDeleteAccountText('');
              }}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-800 disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              disabled={
                busy ||
                deleteAccountText.trim().toLowerCase() !== 'delete my account'
              }
              onClick={handleDeleteAccount}
              className='rounded-xl bg-red-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60 flex items-center gap-2'
            >
              <FiUserX className='h-4 w-4' />{' '}
              {busy ? 'Deleting account…' : 'Yes, Delete My Account'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function DataManagement() {
  return (
    <>
      <ExportImport />
      <DangerZone />
    </>
  );
}
