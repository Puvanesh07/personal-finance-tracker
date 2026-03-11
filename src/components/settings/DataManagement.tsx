// src/components/settings/DataManagement.tsx

import {
  FiAlertOctagon,
  FiDatabase,
  FiDownload,
  FiTrash2,
  FiUpload,
} from 'react-icons/fi';
import { exportAllSectionsAsCSV, exportExcel } from '../../utils/exportUtils';
import { exportFullBackup, importFullBackup } from '../../utils/backup';
import { useRef, useState } from 'react';

import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';

export function DataManagement() {
  const state = usePortfolioStore();
  const { investments, clearAllData, hydrate, uid } = state;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /**
   * Clears all data from Firestore collections belonging to this UID
   * and resets the local Zustand state.
   */
  const handleClearData = async () => {
    setBusy(true);
    try {
      await clearAllData();
      toast.success('All data cleared successfully from the cloud.');
      setConfirmOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear data.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Handles the Full JSON Export
   */
  const handleExportBackup = async () => {
    if (!uid) return toast.error('Session expired. Please log in again.');
    setBusy(true);
    try {
      await exportFullBackup(uid);
      toast.success('Backup generated successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Backup generation failed.');
    } finally {
      setBusy(false);
    }
  };

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

          {/* Section Exports */}
          <div className='flex flex-col gap-3'>
            <div className='text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              Data Exports (CSV/Excel)
            </div>
            <div className='flex flex-col xl:flex-row gap-2'>
              <button
                className='flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200'
                onClick={() => {
                  exportAllSectionsAsCSV(state);
                  toast.success('Downloading CSV exports for all sections...');
                }}
              >
                <FiDownload className='h-4 w-4 text-slate-400' />
                Export All (CSV)
              </button>
              <button
                className='flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200'
                onClick={() => exportExcel(investments, 'portfolio.xlsx')}
              >
                <FiDownload className='h-4 w-4 text-slate-400' />
                Portfolio Excel
              </button>
            </div>
          </div>

          <div className='h-px w-full bg-slate-200/60 dark:bg-slate-800/60' />

          {/* Backup */}
          <div className='flex flex-col gap-3'>
            <div className='text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              Full System Backup (JSON)
            </div>
            <div className='text-xs text-slate-500 dark:text-slate-400'>
              Includes all investments, liabilities, goals, cashflows, and
              historical snapshots.
            </div>

            <div className='flex flex-col xl:flex-row gap-2'>
              <button
                disabled={busy}
                className='flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400'
                onClick={handleExportBackup}
              >
                <FiDownload className='h-4 w-4' />
                {busy ? 'Processing...' : 'Export JSON Backup'}
              </button>

              <input
                ref={fileInputRef}
                type='file'
                accept='.json'
                className='hidden'
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !uid) return;
                  setBusy(true);
                  try {
                    const text = await file.text();
                    await importFullBackup(text, uid);
                    await hydrate(uid); // Re-fetch from Firebase to update local state
                    toast.success(
                      'Backup imported and synchronized successfully.',
                    );
                  } catch (err: any) {
                    toast.error(err.message || 'Import failed.');
                  } finally {
                    setBusy(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }
                }}
              />

              <button
                className='flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400'
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <FiUpload className='h-4 w-4' />
                Import JSON Backup
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className='mt-2 rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10'>
            <div className='flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400'>
              <FiAlertOctagon className='h-5 w-5' />
              Danger Zone
            </div>
            <p className='mt-2 text-xs text-rose-600 dark:text-rose-400'>
              Wipes all your financial data from the cloud. This action is{' '}
              <strong>permanent</strong> and cannot be undone.
            </p>
            <button
              disabled={busy}
              className='mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50'
              onClick={() => setConfirmOpen(true)}
            >
              <FiTrash2 className='h-4 w-4' />
              Clear All Data
            </button>
          </div>
        </div>
      </Card>

      {/* Confirmation Modal for Data Deletion */}
      <Modal
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title='Confirm Data Deletion'
      >
        <div className='space-y-6'>
          <p className='text-sm text-slate-500 dark:text-slate-300'>
            This will permanently delete every record (Investments, Liabilities,
            Goals, Cashflows) associated with your account from the cloud. Are
            you absolutely sure you want to continue?
          </p>
          <div className='flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800'>
            <button
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
              className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={handleClearData}
              className='rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50'
            >
              {busy ? 'Wiping Data...' : 'Yes, Delete Everything'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
