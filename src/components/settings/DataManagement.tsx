// src/components/settings/DataManagement.tsx

import {
  FiArrowDown,
  FiArrowUp,
  FiCheck,
  FiDownload,
  FiGrid,
  FiShield,
  FiTable,
  FiTrash2,
  FiUpload,
  FiUserX,
} from 'react-icons/fi';
import {
  exportAllSectionsAsCSV,
  exportAttendanceCSV,
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

const SIP_STORAGE_KEY = 'fintrackly_sip_plan';

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT / IMPORT
// ─────────────────────────────────────────────────────────────────────────────

export function ExportImport() {
  const state = usePortfolioStore();
  const { hydrate, uid } = state;

  const agriState = useAgriStore();
  const agriHydrate = agriState.hydrate;

  const attState = useAttendanceStore();
  const attHydrate = attState.hydrate;

  const importRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, number>>({});
  const [pendingFile, setPendingFile] = useState<string | null>(null);

  // Correctly calculating all agricultural records, including the new Produce Sales
  const agriRecordsCount =
    (agriState.fields?.length ?? 0) +
    (agriState.cropCycles?.length ?? 0) +
    (agriState.agriExpenses?.length ?? 0) +
    (agriState.livestockEvents?.length ?? 0) +
    (agriState.milkRecords?.length ?? 0) +
    (agriState.coconutRecords?.length ?? 0) +
    (agriState.produceSales?.length ?? 0); // Include Produce Sales!

  const attRecordsCount =
    (attState.employees?.length ?? 0) +
    (attState.attendanceRecords?.length ?? 0) +
    (attState.transactions?.length ?? 0) +
    (attState.salaryRecords?.length ?? 0);

  // Build a count summary of current data for the export preview
  const exportSummary = {
    Investments: state.investments?.length ?? 0,
    'Profits (Sold)': state.soldTrades?.length ?? 0,
    Liabilities: state.liabilities?.length ?? 0,
    Cashflows: state.cashflows?.length ?? 0,
    Goals: state.goals?.length ?? 0,
    Accounts: state.accounts?.length ?? 0,
    'Insurance Policies': state.insurancePolicies?.length ?? 0,
    'Insurance Payments': (state as any).insurancePayments?.length ?? 0,
    'SIP Plans': state.sipPlans?.length ?? 0,
    'Agri Records': agriRecordsCount,
    'Attendance Records': attRecordsCount,
  };

  const handleExportCSV = () => {
    const hasFinance =
      state.investments?.length ||
      state.liabilities?.length ||
      state.cashflows?.length ||
      state.goals?.length ||
      state.accounts?.length ||
      state.soldTrades?.length;
    const hasAgri = agriRecordsCount > 0;
    const hasAtt = attRecordsCount > 0;

    if (!hasFinance && !hasAgri && !hasAtt) {
      toast.error('Nothing to export — add some data first.');
      return;
    }
    if (hasFinance || hasAgri) exportAllSectionsAsCSV(state, agriState);
    if (hasAtt)
      exportAttendanceCSV({
        employees: attState.employees,
        attendanceRecords: attState.attendanceRecords,
        transactions: attState.transactions,
        salaryRecords: attState.salaryRecords,
      });
    toast.success('All data exported as CSV files.');
  };

  const handleExportJSON = async () => {
    if (!uid) {
      toast.error('Session expired. Please log in again.');
      return;
    }
    setBusy(true);
    try {
      await exportFullBackup(uid);
      toast.success('Full backup downloaded — includes all records.');
    } catch (err: any) {
      toast.error(err.message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  // Parse the JSON file first to show a preview, then confirm before restoring
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Build preview counts from the file, correctly checking all arrays
      const importedAgriCount =
        (parsed.agriFields?.length ?? 0) +
        (parsed.agriCropCycles?.length ?? 0) +
        (parsed.agriExpenses?.length ?? 0) +
        (parsed.agriLivestockEvents?.length ?? 0) +
        (parsed.agriMilkRecords?.length ?? 0) +
        (parsed.agriCoconut?.length ?? 0) +
        (parsed.agriProduceSales?.length ?? 0); // Check imported Produce Sales

      const importedAttCount =
        (parsed.attEmployees?.length ?? 0) +
        (parsed.attRecords?.length ?? 0) +
        (parsed.attTransactions?.length ?? 0) +
        (parsed.attSalary?.length ?? 0);

      const counts: Record<string, number> = {
        Investments: parsed.investments?.length ?? 0,
        'Profits (Sold)': parsed.soldTrades?.length ?? 0,
        Liabilities: parsed.liabilities?.length ?? 0,
        Cashflows: parsed.cashflows?.length ?? 0,
        Goals: parsed.goals?.length ?? 0,
        Accounts: parsed.accounts?.length ?? 0,
        'Insurance Policies': parsed.insurancePolicies?.length ?? 0,
        'Insurance Payments': parsed.insurancePayments?.length ?? 0,
        'SIP Plans': parsed.sipPlans?.length ?? 0,
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
      {/* Settings Page Header style match */}
      <div className='mb-2'>
        <h2 className='text-lg font-bold text-white flex items-center gap-2'>
          <FiGrid className='text-emerald-400' /> Export & Import
        </h2>
        <p className='text-sm text-slate-400 mt-1'>
          Download your data as CSV or take a full JSON backup. Restore from a
          backup anytime.
        </p>
      </div>

      {/* Export CSV */}
      <div className='rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4'>
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20'>
          <FiTable className='h-5 w-5 text-emerald-400' />
        </div>
        <div className='flex-1 min-w-0'>
          <p className='font-bold text-slate-100 text-sm'>Export as CSV</p>
          <p className='text-xs text-slate-500 mt-0.5'>
            Download all sections as separate CSV files — open in Excel or
            Google Sheets. Includes finance, agriculture, attendance &amp;
            salary data.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={busy}
          className='flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 whitespace-nowrap'
        >
          <FiDownload className='h-4 w-4' /> Export CSV
        </button>
      </div>

      {/* Export JSON */}
      <div className='rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-4'>
        <div className='flex flex-col sm:flex-row sm:items-start gap-4'>
          <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20'>
            <FiArrowDown className='h-5 w-5 text-indigo-400' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='font-bold text-slate-100 text-sm'>
              Full Backup (JSON)
            </p>
            <p className='text-xs text-slate-500 mt-0.5'>
              Complete backup of your entire account — finance, agriculture,
              attendance, insurance policies &amp; payment records, SIP plan in
              one file.
            </p>
          </div>
          <button
            onClick={handleExportJSON}
            disabled={busy}
            className='flex items-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-2.5 text-sm font-bold text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50 whitespace-nowrap'
          >
            <FiDownload className='h-4 w-4' />
            {busy ? 'Exporting…' : 'Export JSON'}
          </button>
        </div>

        {/* What's included breakdown */}
        <div className='border-t border-slate-800 pt-3 mt-1'>
          <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3'>
            What will be exported
          </p>
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
            {Object.entries(exportSummary).map(([label, count]) => (
              <div key={label} className='flex items-center gap-2 text-xs'>
                <FiCheck
                  className={`h-3.5 w-3.5 shrink-0 ${count > 0 ? 'text-emerald-400' : 'text-slate-700'}`}
                />
                <span
                  className={count > 0 ? 'text-slate-300' : 'text-slate-600'}
                >
                  {label}
                  {count > 0 && (
                    <span className='text-slate-500 ml-1'>({count})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Import JSON */}
      <div className='rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4'>
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20'>
          <FiArrowUp className='h-5 w-5 text-sky-400' />
        </div>
        <div className='flex-1 min-w-0'>
          <p className='font-bold text-slate-100 text-sm'>
            Restore from Backup
          </p>
          <p className='text-xs text-slate-500 mt-0.5'>
            Import a previously exported JSON backup to restore all your data. A
            preview will be shown before overwriting anything.
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
          <FiUpload className='h-4 w-4' />
          {busy ? 'Importing…' : 'Import JSON'}
        </button>
      </div>

      {/* Import Preview Modal */}
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
            <p className='text-xs font-black uppercase tracking-widest text-slate-500 mb-2'>
              What will be restored
            </p>
            <div className='grid grid-cols-2 gap-1.5'>
              {Object.entries(previewData).map(([label, count]) => (
                <div
                  key={label}
                  className='flex items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2'
                >
                  <span className='text-xs text-slate-400 flex items-center gap-1.5'>
                    {label === 'Insurance Policies' ||
                    label === 'Insurance Payments' ? (
                      <FiShield className='h-3 w-3 text-blue-400' />
                    ) : (
                      <FiCheck
                        className={`h-3 w-3 ${count > 0 ? 'text-emerald-400' : 'text-slate-600'}`}
                      />
                    )}
                    {label}
                  </span>
                  <span
                    className={`text-xs font-bold ${count > 0 ? 'text-slate-200' : 'text-slate-600'}`}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className='flex justify-end gap-3 border-t border-slate-800 pt-4'>
            <button
              disabled={busy}
              onClick={() => {
                setPreviewOpen(false);
                setPendingFile(null);
              }}
              className='px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-800 disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={handleConfirmImport}
              className='flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-60'
            >
              <FiUpload className='h-4 w-4' />
              {busy ? 'Restoring…' : 'Yes, Restore Data'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DANGER ZONE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

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
        {/* Clear All Data */}
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5'>
          <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20'>
            <FiTrash2 className='h-5 w-5 text-rose-400' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='font-bold text-slate-100 text-sm'>Clear All Data</p>
            <p className='text-xs text-slate-500 mt-0.5'>
              Permanently wipes all investments, accounts, goals, cashflows,
              agriculture, attendance, insurance policies &amp; payments. Your
              login credentials remain intact.
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

        {/* Delete Account */}
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5'>
          <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30'>
            <FiUserX className='h-5 w-5 text-rose-400' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='font-bold text-rose-300 text-sm'>Delete My Account</p>
            <p className='text-xs text-slate-500 mt-0.5'>
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

      {/* Clear All Data Modal */}
      <Modal
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title='⚠ Confirm — Delete Everything'
      >
        <div className='space-y-5'>
          <p className='text-sm text-slate-400'>
            This will{' '}
            <strong className='text-rose-400'>permanently delete</strong> every
            record — finance, agriculture, attendance and insurance data. Cannot
            be undone.
          </p>
          <ul className='text-xs text-slate-500 space-y-1 list-disc pl-5'>
            <li>Investments, Sold Trades, Liabilities, Cashflows, Goals</li>
            <li>Accounts, Snapshots, Net Worth history, Insights</li>
            <li>Insurance Policies &amp; all Payment Records</li>
            <li>
              Agriculture — fields, crops, livestock, milk, coconut, produce
            </li>
            <li>Attendance — workers, daily records, advances, salary</li>
            <li>Settings (Essentials, Notion)</li>
          </ul>
          <div className='rounded-xl border border-rose-500/20 bg-rose-500/10 p-3'>
            <p className='text-xs font-bold text-rose-400 mb-2'>
              Type <span className='font-mono'>delete</span> to confirm:
            </p>
            <input
              className='w-full rounded-lg border border-rose-500/30 bg-slate-900 px-3 py-2 text-sm font-mono text-rose-300 outline-none focus:ring-2 focus:ring-rose-500/30'
              placeholder='delete'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-4'>
            <button
              disabled={busy}
              onClick={() => {
                setConfirmOpen(false);
                setConfirmText('');
              }}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800 disabled:opacity-50'
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

      {/* Delete Account Modal */}
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
            <ul className='text-xs text-slate-400 space-y-1 list-disc pl-4'>
              <li>
                All financial data, insurance policies &amp; payment records
              </li>
              <li>All agriculture and attendance records</li>
              <li>
                Your login credentials — you will not be able to log back in
              </li>
            </ul>
          </div>
          <div className='rounded-xl border border-rose-500/20 bg-rose-500/10 p-3'>
            <p className='text-xs font-bold text-rose-400 mb-2'>
              Type <span className='font-mono'>delete my account</span> to
              confirm:
            </p>
            <input
              className='w-full rounded-lg border border-rose-500/30 bg-slate-900 px-3 py-2 text-sm font-mono text-rose-300 outline-none focus:ring-2 focus:ring-rose-500/30'
              placeholder='delete my account'
              value={deleteAccountText}
              onChange={(e) => setDeleteAccountText(e.target.value)}
              autoComplete='off'
            />
          </div>
          <p className='text-xs text-slate-500 bg-slate-800/30 rounded-xl p-3'>
            <strong className='text-slate-300'>Note:</strong> Firebase requires
            a recent login to delete your account. If you see an error, log out
            and log back in first.
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-800 pt-4'>
            <button
              disabled={busy}
              onClick={() => {
                setDeleteAccountOpen(false);
                setDeleteAccountText('');
              }}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800 disabled:opacity-50'
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
              <FiUserX className='h-4 w-4' />
              {busy ? 'Deleting account…' : 'Yes, Delete My Account'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// Legacy default export
export function DataManagement() {
  return (
    <>
      <ExportImport />
      <DangerZone />
    </>
  );
}
