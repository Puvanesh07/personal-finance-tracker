// src/components/settings/DummyDataLoader.tsx
/**
 * Admin-only dummy data loader.
 * Only visible to the owner account (puvanesh1964@gmail.com).
 */

import { useState } from 'react';
import { auth } from '../../services/firebase';
import { OWNER_EMAIL } from '../../utils/subscriptionUtils';
import { loadDummyData, getDummyDataPreview } from '../../services/dummyDataService';
import { usePortfolioStore } from '../../store/portfolioStore';
import {
  FiCheckCircle, FiLoader, FiAlertCircle, FiDatabase, FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

export function DummyDataLoader() {
  const ownerEmail = OWNER_EMAIL;
  const currentUserEmail = auth.currentUser?.email?.trim().toLowerCase() ?? '';
  const isOwner = currentUserEmail === ownerEmail;

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [result, setResult] = useState<{ success: boolean; message: string; counts: Record<string, number> } | null>(null);

   const hydrateAll = usePortfolioStore((s) => s.hydrate);


  const preview = getDummyDataPreview();

  async function handleLoad() {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      toast.error('Please log in first.');
      return;
    }
    setLoading(true);
    setProgress('Starting data generation...');
    setResult(null);

    try {
      setProgress('Generating accounts & investments...');
      setProgress('Generating liabilities & payments...');
      setProgress('Generating data...');
      setProgress('Writing to Firestore...');

      const res = await loadDummyData(uid);
      setResult(res);

      setProgress('Refreshing local stores...');
       await hydrateAll(uid, { force: true });


      toast.success(res.message);
    } catch (err) {
      console.error('[DummyData] Load failed:', err);
      toast.error(`Failed to load dummy data: ${err instanceof Error ? err.message : String(err)}`);
      setResult({ success: false, message: (err as Error).message, counts: {} });
    } finally {
      setLoading(false);
      setProgress('');
    }
  }

  if (!isOwner) return null;

  return (
    <div className="mt-6 rounded-2xl border-2 border-amber-300/40 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-900/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        <FiDatabase className="h-5 w-5 text-amber-500" />
        <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">Admin: Load Dummy Data</h3>
      </div>
      <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mb-4">
        Populates this account with realistic test data across all modules. Use for QA and demo purposes only.
      </p>

      {/* Preview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {Object.entries(preview)
          .filter(([k]) => k !== 'grandTotal')
          .slice(0, 8)
          .map(([key, count]) => (
            <div key={key} className="rounded-lg bg-white/60 dark:bg-slate-800/50 px-2 py-1.5 text-center">
              <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{count}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={key}>
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
              </div>
            </div>
          ))}
        <div className="rounded-lg bg-emerald-100/60 dark:bg-emerald-900/20 px-2 py-1.5 text-center col-span-2 sm:col-span-1">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{preview.grandTotal}</div>
          <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">Total Records</div>
        </div>
      </div>

      <button
        onClick={handleLoad}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold px-4 py-2.5 text-sm transition-colors"
      >
        {loading ? (
          <>
            <FiLoader className="h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <FiRefreshCw className="h-4 w-4" />
            Populate Dummy Data
          </>
        )}
      </button>

      {progress && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <FiLoader className="h-3 w-3 animate-spin" />
          {progress}
        </p>
      )}

      {result && !loading && (
        <div className={`mt-3 rounded-xl px-3 py-2 text-sm flex items-center gap-2 ${
          result.success
            ? 'bg-emerald-100/60 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-rose-100/60 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
        }`}>
          {result.success ? <FiCheckCircle className="h-4 w-4" /> : <FiAlertCircle className="h-4 w-4" />}
          {result.message}
        </div>
      )}
    </div>
  );
}
