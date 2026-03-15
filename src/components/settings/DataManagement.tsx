// src/components/settings/DataManagement.tsx

import {
  FiAlertOctagon,
  FiDatabase,
  FiDownload,
  FiTrash2,
  FiUpload,
} from 'react-icons/fi';
import {
  exportAllSectionsAsCSV,
  exportAttendanceCSV,
} from '../../utils/exportUtils';
import { exportFullBackup, importFullBackup } from '../../utils/backup';
import { useRef, useState } from 'react';

import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import toast from 'react-hot-toast';
import { useAgriStore } from '../../store/agricultureStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { usePortfolioStore } from '../../store/portfolioStore';

export function DataManagement() {
  const state = usePortfolioStore();
  const { clearAllData, hydrate, uid } = state;

  const agriState = useAgriStore();
  const agriHydrate = agriState.hydrate;
  const agriClear = agriState.clearAll;

  const attState = useAttendanceStore();
  const attHydrate = attState.hydrate;
  const attClear = attState.clearAll;

  const importRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

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
    if (hasFinance || hasAgri) {
      exportAllSectionsAsCSV(state, agriState);
    }
    if (hasAtt) {
      exportAttendanceCSV({
        employees: attState.employees,
        attendanceRecords: attState.attendanceRecords,
        transactions: attState.transactions,
        salaryRecords: attState.salaryRecords,
      });
    }
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
      toast.success(
        'Full backup downloaded — finance, agriculture & attendance included.',
      );
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

  const handleClearData = async () => {
    if (confirmText.trim().toLowerCase() !== 'delete') return;
    setBusy(true);
    try {
      await clearAllData();
      agriClear();
      attClear();
      toast.success('All data cleared.');
      setConfirmOpen(false);
      setConfirmText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear data.');
    } finally {
      setBusy(false);
    }
  };

  const btnBase =
    'flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50 transition-colors';
  const btnDefault = `${btnBase} border-slate-200/80 bg-white/50 text-slate-700 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200`;
  const btnIndigo = `${btnBase} border-indigo-200/80 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400`;

  return (
    <>
      <Card
        title={
          <div className='flex items-center gap-2'>
            <FiDatabase className='text-slate-500 dark:text-slate-400' /> Data
            Management
          </div>
        }
      >
        <div className='flex flex-col gap-6'>
          <div className='h-px w-full bg-slate-200/60 dark:bg-slate-800/60' />

          <p className='text-xs text-slate-500 dark:text-slate-400 leading-relaxed'>
            Export all your data as CSV (open in Excel / Google Sheets) or as a
            full JSON backup that includes finance, agriculture and attendance
            records. Use Import to restore from a backup.
          </p>

          <div className='flex flex-col gap-3'>
            {/* Export All CSV */}
            <div className='flex flex-col gap-1'>
              <button
                className={btnDefault}
                onClick={handleExportCSV}
                disabled={busy}
              >
                <FiDownload className='h-4 w-4 text-emerald-500' />
                Export All Data (CSV)
              </button>
              <p className='text-[11px] text-slate-400 dark:text-slate-500 text-center'>
                Finance · Agriculture · Workers · Attendance · Salary — as
                separate CSV files
              </p>
            </div>

            <div className='h-px w-full bg-slate-200/60 dark:bg-slate-800/60' />

            {/* Export Full JSON */}
            <div className='flex flex-col gap-1'>
              <button
                className={btnIndigo}
                onClick={handleExportJSON}
                disabled={busy}
              >
                <FiDownload className='h-4 w-4' />
                {busy ? 'Exporting…' : 'Export Full Backup (JSON)'}
              </button>
              <p className='text-[11px] text-slate-400 dark:text-slate-500 text-center'>
                Complete backup — everything in one file, use to restore later
              </p>
            </div>

            {/* Import Full JSON */}
            <div className='flex flex-col gap-1'>
              <input
                ref={importRef}
                type='file'
                accept='.json'
                className='hidden'
                onChange={handleImportFile}
              />
              <button
                className={btnIndigo}
                onClick={() => importRef.current?.click()}
                disabled={busy}
              >
                <FiUpload className='h-4 w-4' />
                {busy ? 'Importing…' : 'Import Full Backup (JSON)'}
              </button>
              <p className='text-[11px] text-slate-400 dark:text-slate-500 text-center'>
                Restore from a previously exported JSON backup file
              </p>
            </div>
          </div>

          {/* Danger Zone */}
          <div className='rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10'>
            <div className='flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400'>
              <FiAlertOctagon className='h-5 w-5' />
              Danger Zone
            </div>
            <p className='mt-2 text-xs text-rose-600 dark:text-rose-400'>
              Permanently wipes <strong>all</strong> data from Firebase —
              investments, liabilities, cashflows, goals, accounts, snapshots,
              settings, <strong>all agriculture data</strong> and{' '}
              <strong>all attendance data</strong> (workers, records, advances,
              salary). This cannot be undone.
            </p>
            <button
              disabled={busy}
              className='mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50'
              onClick={() => {
                setConfirmText('');
                setConfirmOpen(true);
              }}
            >
              <FiTrash2 className='h-4 w-4' />
              Clear All Data
            </button>
          </div>
        </div>
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title='⚠ Confirm — Delete Everything'
      >
        <div className='space-y-5'>
          <p className='text-sm text-slate-500 dark:text-slate-300'>
            This will{' '}
            <strong className='text-rose-500'>permanently delete</strong> every
            record — finance, agriculture and attendance data. Cannot be undone.
          </p>
          <ul className='text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc pl-5'>
            <li>Investments, Sold Trades, Liabilities, Cashflows, Goals</li>
            <li>Accounts, Snapshots, Net Worth history, Insights</li>
            <li>Agriculture — fields, crops, livestock, milk, coconut</li>
            <li>Attendance — workers, daily records, advances, salary</li>
            <li>Settings (Essentials, Notion)</li>
          </ul>
          <div className='rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10 p-3'>
            <p className='text-xs font-bold text-rose-700 dark:text-rose-400 mb-2'>
              Type <span className='font-mono'>delete</span> to confirm:
            </p>
            <input
              className='w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-mono text-rose-700 outline-none focus:ring-2 focus:ring-rose-400 dark:border-rose-500/30 dark:bg-slate-900 dark:text-rose-300'
              placeholder='delete'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div className='flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800'>
            <button
              disabled={busy}
              onClick={() => {
                setConfirmOpen(false);
                setConfirmText('');
              }}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-50'
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
    </>
  );
}
