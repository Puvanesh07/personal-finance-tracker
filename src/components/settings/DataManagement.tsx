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
  const [confirmText, setConfirmText] = useState('');

  // ── Clear all data ──────────────────────────────────────────────────────
  const handleClearData = async () => {
    if (confirmText.trim().toLowerCase() !== 'delete') return;
    setBusy(true);
    try {
      await clearAllData();
      toast.success('All data cleared from the cloud.');
      setConfirmOpen(false);
      setConfirmText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear data.');
    } finally {
      setBusy(false);
    }
  };

  // ── Export JSON backup ──────────────────────────────────────────────────
  const handleExportBackup = async () => {
    if (!uid) return toast.error('Session expired. Please log in again.');
    setBusy(true);
    try {
      await exportFullBackup(uid);
      toast.success(
        'Backup downloaded — includes investments, cashflows, accounts, goals, liabilities & settings.',
      );
    } catch (err: any) {
      toast.error(err.message || 'Backup generation failed.');
    } finally {
      setBusy(false);
    }
  };

  // ── Import JSON backup ──────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    setBusy(true);
    try {
      const text = await file.text();
      await importFullBackup(text, uid);
      await hydrate(uid); // re-sync local Zustand state from Firebase
      toast.success('Backup imported and synced with Firebase successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Import failed — check JSON format.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── CSV all sections ────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const sections = [
      state.investments?.length && 'Investments',
      state.liabilities?.length && 'Liabilities',
      state.cashflows?.length && 'Cashflows',
      state.goals?.length && 'Goals',
      (state.accounts ?? []).length && 'Accounts',
    ].filter(Boolean);

    if (!sections.length) {
      toast.error('Nothing to export — add some data first.');
      return;
    }
    exportAllSectionsAsCSV(state);
    toast.success(`Downloading: ${sections.join(', ')}`);
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

          {/* ── CSV Exports ─────────────────────────────────────────────── */}
          <div className='flex flex-col gap-3'>
            <div className='text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              CSV Exports
            </div>
            <p className='text-xs text-slate-500 dark:text-slate-400'>
              Downloads separate CSV files for: investments, liabilities,
              cashflows, goals and accounts.
            </p>
            <div className='flex flex-col xl:flex-row gap-2'>
              <button
                className='flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200 disabled:opacity-50'
                onClick={handleExportCSV}
                disabled={busy}
              >
                <FiDownload className='h-4 w-4 text-slate-400' />
                Export All (CSV)
              </button>
              <button
                className='flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200 disabled:opacity-50'
                onClick={() => exportExcel(investments, 'portfolio.xlsx')}
                disabled={busy}
              >
                <FiDownload className='h-4 w-4 text-slate-400' />
                Portfolio Excel
              </button>
            </div>
          </div>

          <div className='h-px w-full bg-slate-200/60 dark:bg-slate-800/60' />

          {/* ── JSON Backup ─────────────────────────────────────────────── */}
          <div className='flex flex-col gap-3'>
            <div className='text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              Full System Backup (JSON)
            </div>
            <p className='text-xs text-slate-500 dark:text-slate-400'>
              Complete backup including investments, liabilities, cashflows,
              goals,{' '}
              <strong className='text-slate-600 dark:text-slate-300'>
                accounts
              </strong>
              , snapshots and settings.
            </p>

            <div className='flex flex-col xl:flex-row gap-2'>
              <button
                disabled={busy}
                className='flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400'
                onClick={handleExportBackup}
              >
                <FiDownload className='h-4 w-4' />
                {busy ? 'Exporting…' : 'Export JSON Backup'}
              </button>

              <input
                ref={fileInputRef}
                type='file'
                accept='.json'
                className='hidden'
                onChange={handleImportFile}
              />

              <button
                className='flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400'
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <FiUpload className='h-4 w-4' />
                {busy ? 'Importing…' : 'Import JSON Backup'}
              </button>
            </div>
          </div>

          {/* ── Danger Zone ─────────────────────────────────────────────── */}
          <div className='mt-2 rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10'>
            <div className='flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400'>
              <FiAlertOctagon className='h-5 w-5' />
              Danger Zone
            </div>
            <p className='mt-2 text-xs text-rose-600 dark:text-rose-400'>
              Permanently wipes <strong>all</strong> your data from Firebase —
              investments, liabilities, cashflows, goals,{' '}
              <strong>accounts</strong>, snapshots and settings. This cannot be
              undone.
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

      {/* ── Confirm Delete Modal ─────────────────────────────────────────── */}
      <Modal
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title='⚠ Confirm — Delete Everything'
      >
        <div className='space-y-5'>
          <p className='text-sm text-slate-500 dark:text-slate-300'>
            This will{' '}
            <strong className='text-rose-500'>permanently delete</strong> every
            record from Firebase:
          </p>
          <ul className='text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc pl-5'>
            <li>All Investments</li>
            <li>All Liabilities</li>
            <li>All Cashflow entries</li>
            <li>All Goals</li>
            <li>All Accounts (bank &amp; credit)</li>
            <li>All Snapshots &amp; Net Worth history</li>
            <li>All Insights history</li>
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
