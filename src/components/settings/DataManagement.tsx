// src/components/settings/DataManagement.tsx
//
// Two separate named exports — use the right one per tab:
//   <ExportImport /> → "Export / Import" tab (CSV + JSON backup + restore only)
//   <DangerZone />   → "Danger Zone" tab (Clear data + Delete account only)
//
// DataManagement (default) kept for legacy compatibility only.

import {
  FiArrowDown,
  FiArrowUp,
  FiDownload,
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
// EXPORT / IMPORT — shown only in the "Export / Import" tab
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

  const handleExportCSV = () => {
    const hasFinance =
      state.investments?.length ||
      state.liabilities?.length ||
      state.cashflows?.length ||
      state.goals?.length ||
      state.accounts?.length ||
      state.soldTrades?.length;
    const hasAgri =
      agriState.fields?.length ||
      agriState.cropCycles?.length ||
      agriState.agriExpenses?.length ||
      agriState.livestockEvents?.length ||
      agriState.milkRecords?.length ||
      agriState.coconutRecords?.length;
    const hasAtt =
      attState.employees?.length ||
      attState.attendanceRecords?.length ||
      attState.transactions?.length ||
      attState.salaryRecords?.length;

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
      toast.success('Full backup downloaded.');
    } catch (err: any) {
      toast.error(err.message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    setBusy(true);
    try {
      const text = await file.text();
      await importFullBackup(text, uid);
      await hydrate(uid);
      await agriHydrate(uid);
      await attHydrate(uid);
      toast.success('Backup imported — all data restored.');
    } catch (err: any) {
      toast.error(err.message || 'Import failed — check JSON format.');
    } finally {
      setBusy(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  return (
    <div className='flex flex-col gap-4'>
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
      <div className='rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4'>
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20'>
          <FiArrowDown className='h-5 w-5 text-indigo-400' />
        </div>
        <div className='flex-1 min-w-0'>
          <p className='font-bold text-slate-100 text-sm'>Full Backup (JSON)</p>
          <p className='text-xs text-slate-500 mt-0.5'>
            Complete backup of your entire account — finance, agriculture,
            attendance, insurance &amp; SIP plan in one file. Use this to
            restore your data later.
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
            Import a previously exported JSON backup file to restore all your
            data. This will overwrite your current data.
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DANGER ZONE — shown only in the "Danger Zone" tab
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
      <div className='flex flex-col gap-4'>
        {/* Clear All Data */}
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5'>
          <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20'>
            <FiTrash2 className='h-5 w-5 text-rose-400' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='font-bold text-slate-100 text-sm'>Clear All Data</p>
            <p className='text-xs text-slate-500 mt-0.5'>
              Permanently wipes all investments, accounts, goals, cashflows,
              agriculture, attendance &amp; settings. Your login credentials
              remain intact.
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
              credentials. You will not be able to sign back in after this.
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

      {/* ── Clear All Data Modal ── */}
      <Modal
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title='⚠ Confirm — Delete Everything'
      >
        <div className='space-y-5'>
          <p className='text-sm text-slate-400'>
            This will{' '}
            <strong className='text-rose-400'>permanently delete</strong> every
            record — finance, agriculture and attendance data. Cannot be undone.
          </p>
          <ul className='text-xs text-slate-500 space-y-1 list-disc pl-5'>
            <li>Investments, Sold Trades, Liabilities, Cashflows, Goals</li>
            <li>Accounts, Snapshots, Net Worth history, Insights</li>
            <li>Insurance Policies, Monthly SIP Plan</li>
            <li>Agriculture — fields, crops, livestock, milk, coconut</li>
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

      {/* ── Delete Account Modal ── */}
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
                All financial data (investments, cashflow, goals, insurance, SIP
                plan…)
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
            a recent login to delete your account. If you see an error, please
            log out and log back in first, then try again.
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

// Legacy default export — wraps both for any old imports
export function DataManagement() {
  return (
    <>
      <ExportImport />
      <div className='mt-6'>
        <DangerZone />
      </div>
    </>
  );
}
