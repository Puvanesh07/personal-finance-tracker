/**
 * src/components/dashboard/SetupChecklist.tsx
 *
 * First-run experience. Before this, a brand-new account landed on a dashboard
 * of ₹0 values and empty charts, and the only way to make the app useful was to
 * spend 40 minutes typing history in — which is where most first runs ended.
 *
 * Four steps, each one thing that makes a number on the dashboard mean
 * something, plus an optional sample-data load (and its exact undo) for people
 * who want to see what the app looks like full before committing data to it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiCheck,
  FiChevronRight,
  FiCreditCard,
  FiDatabase,
  FiLayers,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { auth } from '../../services/firebase';
import {
  clearSampleData,
  loadDummyData,
  readSampleDataState,
  type SampleDataState,
} from '../../services/dummyDataService';
import { usePortfolioStore } from '../../store/portfolioStore';

const DISMISS_KEY = 'fintrackly.setupChecklist.dismissed';

type Step = {
  id: string;
  label: string;
  hint: string;
  to: string;
  done: boolean;
  icon: typeof FiLayers;
};

export function SetupChecklist() {
  const uid = usePortfolioStore((s) => s.uid);
  const ready = usePortfolioStore((s) => s.ready);
  const accounts = usePortfolioStore((s) => s.accounts);
  const investments = usePortfolioStore((s) => s.investments);
  const cashflows = usePortfolioStore((s) => s.cashflows);
  const trackedPayments = usePortfolioStore((s) => s.trackedPayments);
  const hydrate = usePortfolioStore((s) => s.hydrate);

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [sample, setSample] = useState<SampleDataState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid || !ready) return;
    let cancelled = false;
    void readSampleDataState(uid).then((state) => {
      if (!cancelled) setSample(state);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, ready]);

  const thisMonth = new Date().toISOString().slice(0, 7);

  const steps = useMemo<Step[]>(
    () => [
      {
        id: 'account',
        label: 'Add an account or your cash in hand',
        hint: 'Liquid Cash and Net Worth start from here',
        to: '/cashflow?tab=accounts',
        done: accounts.length > 0,
        icon: FiCreditCard,
      },
      {
        id: 'investment',
        label: 'Add your first investment',
        hint: 'Stock, mutual fund, FD, PF — anything you own',
        to: '/wealth?tab=assets',
        done: investments.length > 0,
        icon: FiLayers,
      },
      {
        id: 'spend',
        label: 'Log this month’s spending',
        hint: 'Powers the category pie and the savings rate',
        to: '/cashflow',
        done: cashflows.some((c) => (c.date ?? '').startsWith(thisMonth)),
        icon: FiDatabase,
      },
      {
        id: 'bill',
        label: 'Set a bill or EMI reminder',
        hint: 'This is what makes the bell and the email useful',
        to: '/payments',
        done: trackedPayments.length > 0,
        icon: FiCheck,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts.length, investments.length, cashflows, trackedPayments.length],
  );

  const doneCount = steps.filter((s) => s.done).length;
  const isEmpty = accounts.length === 0 && investments.length === 0 && cashflows.length === 0;

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: the card just reappears next visit */
    }
  }, []);

  const runSample = useCallback(
    async (mode: 'load' | 'clear') => {
      const currentUid = uid ?? auth.currentUser?.uid;
      if (!currentUid) return;
      setBusy(true);
      try {
        if (mode === 'load') {
          const res = await loadDummyData(currentUid);
          await hydrate(currentUid, { force: true });
          setSample(await readSampleDataState(currentUid));
          toast.success(res.message);
        } else {
          const deleted = await clearSampleData(currentUid);
          await hydrate(currentUid, { force: true });
          setSample(null);
          toast.success(
            deleted ? `Removed ${deleted} sample record${deleted === 1 ? '' : 's'}` : 'Sample data cleared',
          );
        }
      } catch (err) {
        toast.error(
          mode === 'load'
            ? 'Could not load sample data'
            : 'Could not clear the sample data',
        );
        console.error('[SetupChecklist] sample data failed:', err);
      } finally {
        setBusy(false);
      }
    },
    [hydrate, uid],
  );

  if (!ready || dismissed) return null;

  // All basics are covered, so the checklist itself is finished. But if sample
  // data is still loaded we must keep its exact undo reachable — otherwise a
  // visitor who explored with “Load sample data” could never clear it from the
  // dashboard (the whole card used to hide once every step turned green).
  if (doneCount === steps.length) {
    if (!sample) return null;
    return (
      <section
        aria-label='Sample data'
        className='rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 shadow-sm md:p-5'
      >
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-xs text-slate-600 dark:text-slate-400'>
            <span className='font-bold text-slate-900 dark:text-slate-100'>
              Sample data is loaded.
            </span>{' '}
            {sample.documents} demo record{sample.documents === 1 ? '' : 's'} are still
            in your account
            {sample.loadedAt ? ` (added ${sample.loadedAt})` : ''} and count toward your
            plan limits until you clear them.
          </p>
          <button
            type='button'
            disabled={busy}
            onClick={() => void runSample('clear')}
            className='flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-500/40 px-3 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-500/10 disabled:opacity-60 dark:text-amber-400'
          >
            <FiTrash2 className='h-3.5 w-3.5' />
            {busy ? 'Working…' : 'Clear sample data'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label='Get started'
      className='rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-4 md:p-5 shadow-sm'
    >
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-sm font-bold text-slate-900 dark:text-slate-100 md:text-base'>
            Get set up · {doneCount} of {steps.length} done
          </h2>
          <p className='mt-0.5 text-xs text-slate-600 dark:text-slate-400'>
            Every number on this page comes from these four. Do them once and the
            app starts working for you.
          </p>
        </div>
        <button
          type='button'
          onClick={dismiss}
          aria-label='Hide this checklist'
          title='Hide this checklist'
          className='cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-800'
        >
          <FiX className='h-4 w-4' />
        </button>
      </div>

      <ul className='mt-3 grid gap-2 sm:grid-cols-2'>
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              to={step.to}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                step.done
                  ? 'border-emerald-500/25 bg-emerald-500/5'
                  : 'border-slate-200/70 bg-white/70 hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/40 dark:hover:bg-slate-800/60'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  step.done
                    ? 'bg-emerald-500 text-white'
                    : 'border border-slate-300 text-slate-400 dark:border-slate-600'
                }`}
              >
                {step.done ? <FiCheck className='h-3.5 w-3.5' /> : <step.icon className='h-3.5 w-3.5' />}
              </span>
              <span className='min-w-0 flex-1'>
                <span className='block truncate text-sm font-bold text-slate-900 dark:text-slate-100'>
                  {step.label}
                </span>
                <span className='block truncate text-[11px] text-slate-500 dark:text-slate-400'>
                  {step.hint}
                </span>
              </span>
              {!step.done && <FiChevronRight className='h-4 w-4 shrink-0 text-slate-400' />}
            </Link>
          </li>
        ))}
      </ul>

      {isEmpty ? (
        <div className='mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2.5 dark:border-slate-700/60 dark:bg-slate-900/40'>
          <p className='text-xs text-slate-600 dark:text-slate-400'>
            Just looking? Fill every screen with realistic sample data, then wipe
            it again in one tap. Sample records count toward your plan limits
            until you clear them.
          </p>
          <button
            type='button'
            disabled={busy}
            onClick={() => void runSample('load')}
            className='cursor-pointer rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-60'
          >
            {busy ? 'Working…' : 'Load sample data'}
          </button>
        </div>
      ) : (
        sample && (
          <div className='mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5'>
            <p className='text-xs text-slate-600 dark:text-slate-400'>
              {sample.documents} sample record{sample.documents === 1 ? '' : 's'}{' '}
              are still in here{sample.loadedAt ? ` (loaded ${sample.loadedAt})` : ''}.
            </p>
            <button
              type='button'
              disabled={busy}
              onClick={() => void runSample('clear')}
              className='flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-500/40 px-3 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-500/10 disabled:opacity-60 dark:text-amber-400'
            >
              <FiTrash2 className='h-3.5 w-3.5' />
              {busy ? 'Working…' : 'Clear sample data'}
            </button>
          </div>
        )
      )}
    </section>
  );
}

export default SetupChecklist;
