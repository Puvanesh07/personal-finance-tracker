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
  exportExcel,
  exportPortfolioJSON,
  exportSoldTradesCSV,
  parseImportedPortfolioJSON,
} from '../../utils/exportUtils';
import { exportFullBackup, importFullBackup } from '../../utils/backup';
import { useRef, useState } from 'react';

import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import toast from 'react-hot-toast';
import { useAgriStore } from '../../store/agricultureStore';
import { usePortfolioStore } from '../../store/portfolioStore';

export function DataManagement() {
  const state = usePortfolioStore();
  const { investments, clearAllData, hydrate, uid } = state;
  const agriState = useAgriStore();
  const agriHydrate = agriState.hydrate;
  const agriClear = agriState.clearAll;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleClearData = async () => {
    if (confirmText.trim().toLowerCase() !== 'delete') return;
    setBusy(true);
    try {
      await clearAllData();
      agriClear();
      toast.success('All data cleared from the cloud.');
      setConfirmOpen(false);
      setConfirmText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear data.');
    } finally {
      setBusy(false);
    }
  };

  const handleExportBackup = async () => {
    if (!uid) return toast.error('Session expired. Please log in again.');
    setBusy(true);
    try {
      await exportFullBackup(uid);
      toast.success(
        'Backup downloaded — includes all finance & agriculture data.',
      );
    } catch (err: any) {
      toast.error(err.message || 'Backup generation failed.');
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
      toast.success('Backup imported and synced with Firebase successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Import failed — check JSON format.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportCSV = () => {
    const finSections = [
      state.investments?.length && 'Investments',
      state.liabilities?.length && 'Liabilities',
      state.cashflows?.length && 'Cashflows',
      state.goals?.length && 'Goals',
      (state.accounts ?? []).length && 'Accounts',
    ].filter(Boolean);

    const agriSections = [
      agriState.fields?.length && 'Fields',
      agriState.cropCycles?.length && 'Crops',
      agriState.agriExpenses?.length && 'Agri Expenses',
      agriState.livestockEvents?.length && 'Livestock Events',
      agriState.milkRecords?.length && 'Milk Records',
      agriState.coconutRecords?.length && 'Coconut Records',
    ].filter(Boolean);

    const allSections = [...finSections, ...agriSections];
    if (!allSections.length) {
      toast.error('Nothing to export — add some data first.');
      return;
    }
    exportAllSectionsAsCSV(state, agriState);
    toast.success(`Downloading CSVs: ${allSections.join(', ')}`);
  };

  const handleExportProfitsCSV = () => {
    if (!state.soldTrades?.length) {
      toast.error('No profit records to export.');
      return;
    }
    exportSoldTradesCSV(state.soldTrades, 'profits.csv');
    toast.success(`Exported ${state.soldTrades.length} profit records as CSV.`);
  };

  const handleExportPortfolioJSON = () => {
    if (!state.investments?.length && !state.soldTrades?.length) {
      toast.error('No portfolio data to export.');
      return;
    }
    exportPortfolioJSON(state, 'portfolio-data.json');
    toast.success('Portfolio data exported as JSON.');
  };

  const handleImportPortfolioJSON = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    setBusy(true);
    try {
      const parsed = await parseImportedPortfolioJSON(file);
      // Re-import via the full backup mechanism if it has the right shape,
      // otherwise treat as portfolio-only import
      if (parsed.investments || parsed.soldTrades) {
        // Use full hydration cycle — just import to firebase via importFullBackup
        const text = JSON.stringify(parsed);
        await importFullBackup(text, uid);
        await hydrate(uid);
        toast.success('Portfolio JSON imported successfully.');
      } else {
        toast.error('Invalid portfolio JSON format.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Import failed — check JSON format.');
    } finally {
      setBusy(false);
      if (jsonImportRef.current) jsonImportRef.current.value = '';
    }
  };

  const btnBase =
    'flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors';
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

          {/* ── Export Utils ───────────────────────────────────────────── */}
          <div className='flex flex-col gap-3'>
            <div className='text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              Export Utils
            </div>
            <p className='text-xs text-slate-500 dark:text-slate-400'>
              Download your portfolio, profits and all finance data in various
              formats.
            </p>
            <div className='flex flex-col gap-2'>
              <button
                className={btnDefault}
                onClick={handleExportCSV}
                disabled={busy}
              >
                <FiDownload className='h-4 w-4 text-slate-400' />
                Export All Sections (CSV)
              </button>
              <button
                className={btnDefault}
                onClick={() => exportExcel(investments, 'portfolio.xlsx')}
                disabled={busy}
              >
                <FiDownload className='h-4 w-4 text-slate-400' />
                Export Portfolio (Excel)
              </button>
              <button
                className={btnDefault}
                onClick={handleExportProfitsCSV}
                disabled={busy}
              >
                <FiDownload className='h-4 w-4 text-emerald-500' />
                Export Profits / Sold Trades (CSV)
              </button>
            </div>
          </div>

          <div className='h-px w-full bg-slate-200/60 dark:bg-slate-800/60' />

          {/* ── Portfolio Store (JSON) ─────────────────────────────────── */}
          <div className='flex flex-col gap-3'>
            <div className='text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
              Portfolio Store (JSON)
            </div>
            <p className='text-xs text-slate-500 dark:text-slate-400'>
              Export or import your investments, profits (sold trades),
              liabilities, cashflows, goals and accounts as a single JSON file.
            </p>
            <div className='flex flex-col gap-2'>
              <button
                className={btnIndigo}
                onClick={handleExportPortfolioJSON}
                disabled={busy}
              >
                <FiDownload className='h-4 w-4' />
                Export Portfolio JSON
              </button>
              <input
                ref={jsonImportRef}
                type='file'
                accept='.json'
                className='hidden'
                onChange={handleImportPortfolioJSON}
              />
              <button
                className={btnIndigo}
                onClick={() => jsonImportRef.current?.click()}
                disabled={busy}
              >
                <FiUpload className='h-4 w-4' />
                {busy ? 'Importing…' : 'Import Portfolio JSON'}
              </button>
            </div>
          </div>

          <div className='h-px w-full bg-slate-200/60 dark:bg-slate-800/60' />

          {/* ── Full System Backup ────────────────────────────────────── */}
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
              , snapshots, settings and{' '}
              <strong className='text-slate-600 dark:text-slate-300'>
                all agriculture data
              </strong>{' '}
              (fields, crops, livestock events, milk, coconut).
            </p>
            <div className='flex flex-col xl:flex-row gap-2'>
              <button
                disabled={busy}
                className={btnIndigo}
                onClick={handleExportBackup}
              >
                <FiDownload className='h-4 w-4' />
                {busy ? 'Exporting…' : 'Export Full Backup'}
              </button>
              <input
                ref={fileInputRef}
                type='file'
                accept='.json'
                className='hidden'
                onChange={handleImportFile}
              />
              <button
                className={btnIndigo}
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <FiUpload className='h-4 w-4' />
                {busy ? 'Importing…' : 'Import Full Backup'}
              </button>
            </div>
          </div>

          {/* ── Danger Zone ───────────────────────────────────────────── */}
          <div className='mt-2 rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10'>
            <div className='flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400'>
              <FiAlertOctagon className='h-5 w-5' />
              Danger Zone
            </div>
            <p className='mt-2 text-xs text-rose-600 dark:text-rose-400'>
              Permanently wipes <strong>all</strong> your data from Firebase —
              investments, liabilities, cashflows, goals,{' '}
              <strong>accounts</strong>, snapshots, settings and all agriculture
              data. This cannot be undone.
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
            record from Firebase:
          </p>
          <ul className='text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc pl-5'>
            <li>All Investments</li>
            <li>All Sold Trades / Profit Records</li>
            <li>All Liabilities</li>
            <li>All Cashflow entries</li>
            <li>All Goals</li>
            <li>All Accounts (bank &amp; credit)</li>
            <li>All Snapshots &amp; Net Worth history</li>
            <li>All Insights history</li>
            <li>
              All Agriculture data (fields, crops, livestock events, milk,
              coconut)
            </li>
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
