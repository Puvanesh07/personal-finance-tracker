// src/components/goals/GoalDetailModal.tsx
// Rich goal detail view: live "current" (saved + linked assets), progress,
// assumed-return slider, optional annual step-up planner, target/remaining/
// monthly-needed cards, linked items, and Edit / Mark Achieved / Delete.

import { useMemo, useState } from 'react';
import {
  FiCalendar,
  FiCheckCircle,
  FiEdit2,
  FiLink,
  FiTarget,
  FiTrash2,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';
import { differenceInDays, format, parseISO } from 'date-fns';
import type { Goal, Investment } from '../../types/investmentTypes';
import { formatINR } from '../../utils/format';
import { effectiveGoalCurrent, goalLinkedCurrentValue } from '../../utils/goalLinks';
import { Modal } from '../ui/Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  goal: Goal;
  investments: Investment[];
  onEdit: (goal: Goal) => void;
  onMarkAchieved: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
};

/** Starting monthly SIP (with yearly step-up) needed to reach `remaining`. */
function monthlyNeeded(
  remaining: number,
  months: number,
  annualPct: number,
  stepUpPct: number,
): { starting: number; finalYear: number } {
  if (remaining <= 0 || months <= 0) return { starting: 0, finalYear: 0 };
  const r = annualPct / 100 / 12;
  const fv = (p: number) => {
    let bal = 0;
    for (let m = 1; m <= months; m++) {
      const contrib = p * Math.pow(1 + stepUpPct / 100, Math.floor((m - 1) / 12));
      bal = bal * (1 + r) + contrib;
    }
    return bal;
  };
  if (stepUpPct <= 0) {
    const pmt = r > 0 ? (remaining * r) / (Math.pow(1 + r, months) - 1) : remaining / months;
    return { starting: pmt, finalYear: pmt };
  }
  // Binary-search the starting monthly so FV(steps) >= remaining.
  let lo = 0;
  let hi = remaining;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (fv(mid) >= remaining) hi = mid;
    else lo = mid;
  }
  const starting = hi;
  const years = Math.max(1, Math.ceil(months / 12));
  const finalYear = starting * Math.pow(1 + stepUpPct / 100, years - 1);
  return { starting, finalYear };
}

export function GoalDetailModal({
  open,
  onClose,
  goal,
  investments,
  onEdit,
  onMarkAchieved,
  onDelete,
}: Props) {
  const [returnPct, setReturnPct] = useState(12);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpPct, setStepUpPct] = useState(10);

  const current = useMemo(
    () => effectiveGoalCurrent(goal, investments),
    [goal, investments],
  );
  const linkedValue = useMemo(
    () => goalLinkedCurrentValue(goal, investments),
    [goal, investments],
  );
  const linkedItems = useMemo(() => {
    const ids = new Set(goal.linkedAssetIds ?? []);
    return investments.filter((i) => ids.has(i.id));
  }, [goal, investments]);

  const target = goal.targetAmount;
  const savingsPct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const remaining = Math.max(0, target - current);

  const monthsLeft = useMemo(() => {
    if (!goal.dueDate) return 0;
    return Math.max(0, Math.round(differenceInDays(parseISO(goal.dueDate), new Date()) / 30.44));
  }, [goal.dueDate]);

  const timeElapsedPct = useMemo(() => {
    if (!goal.dueDate) return 0;
    const start = parseISO(goal.createdAt).getTime();
    const end = parseISO(goal.dueDate).getTime();
    if (end <= start) return 100;
    const now = Date.now();
    return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  }, [goal.createdAt, goal.dueDate]);

  const { starting: monthlyStart, finalYear: monthlyFinal } = useMemo(
    () => monthlyNeeded(remaining, monthsLeft, returnPct, stepUpOpen ? stepUpPct : 0),
    [remaining, monthsLeft, returnPct, stepUpOpen, stepUpPct],
  );

  const onTrack = remaining <= 0 || monthlyStart <= 0;

  const daysLeft = goal.dueDate
    ? Math.max(0, differenceInDays(parseISO(goal.dueDate), new Date()))
    : null;
  const yearsLeft = daysLeft != null ? Math.floor(daysLeft / 365) : null;
  const remDays = daysLeft != null ? daysLeft % 365 : null;

  return (
    <Modal open={open} onClose={onClose} title=''>
      <div className='flex flex-col gap-5'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3'>
          <div className='flex items-center gap-3 min-w-0'>
            <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-lg'>
              🎯
            </span>
            <h2 className='truncate text-lg font-bold text-slate-900 dark:text-white'>
              {goal.name}
            </h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800'
          >
            <FiX className='h-5 w-5' />
          </button>
        </div>

        {/* Current vs Target */}
        <div className='flex items-end justify-between gap-4'>
          <div>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
              Current
            </p>
            <p className='text-2xl font-black tabular-nums text-slate-900 dark:text-white'>
              {formatINR(current)}
            </p>
            {linkedValue > 0 && (
              <p className='mt-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400'>
                incl. {formatINR(linkedValue)} from linked assets
              </p>
            )}
          </div>
          <div className='text-right'>
            <p className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
              Target
            </p>
            <p className='text-2xl font-black tabular-nums text-slate-900 dark:text-white'>
              {formatINR(target)}
            </p>
          </div>
        </div>

        {/* Progress bars */}
        <div className='flex flex-col gap-3'>
          <div>
            <div className='mb-1 flex items-center justify-between text-xs font-bold'>
              <span className='text-slate-600 dark:text-slate-300'>Savings progress</span>
              <span className='text-emerald-600 dark:text-emerald-400'>
                {savingsPct.toFixed(1)}%
              </span>
            </div>
            <div className='h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800'>
              <div
                className='h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700'
                style={{ width: `${savingsPct}%` }}
              />
            </div>
          </div>
          <div>
            <div className='mb-1 flex items-center justify-between text-xs font-bold'>
              <span className='text-slate-600 dark:text-slate-300'>Time elapsed</span>
              <span className='text-slate-500 dark:text-slate-400'>
                {timeElapsedPct.toFixed(1)}%
              </span>
            </div>
            <div className='h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800'>
              <div
                className='h-full rounded-full bg-slate-400 dark:bg-slate-600 transition-all duration-700'
                style={{ width: `${timeElapsedPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* On-track panel */}
        <div
          className={`rounded-xl border px-4 py-3 ${
            onTrack
              ? 'border-emerald-500/25 bg-emerald-500/8'
              : 'border-amber-500/25 bg-amber-500/8'
          }`}
        >
          <p
            className={`text-sm font-bold ${
              onTrack
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {remaining <= 0 ? '✓ Fully funded' : onTrack ? '✓ On track' : '⚠ Needs funding'}
          </p>
          <p className='mt-1 text-xs text-slate-600 dark:text-slate-300'>
            {remaining <= 0
              ? 'This goal is fully funded by your savings and linked assets.'
              : `Invest ${formatINR(monthlyStart)}/mo at ${returnPct}% p.a. to close the remaining gap by target date.`}
          </p>
        </div>

        {/* Assumed return slider */}
        <div>
          <div className='mb-1 flex items-center justify-between'>
            <span className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
              Assumed return rate
            </span>
            <span className='text-sm font-black text-slate-900 dark:text-white'>
              {returnPct}% p.a.
            </span>
          </div>
          <input
            type='range'
            min={1}
            max={40}
            step={1}
            value={returnPct}
            onChange={(e) => setReturnPct(Number(e.target.value))}
            className='h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600 dark:bg-slate-700'
          />
          <div className='mt-1 flex justify-between text-[10px] text-slate-400'>
            <span>1%</span>
            <span>40%</span>
          </div>
        </div>

        {/* Annual step-up */}
        <div className='rounded-xl border border-slate-200/70 bg-slate-50/60 dark:border-slate-800/60 dark:bg-slate-900/40'>
          <button
            type='button'
            onClick={() => setStepUpOpen((v) => !v)}
            className='flex w-full cursor-pointer items-center justify-between px-4 py-3'
          >
            <span className='text-sm font-bold text-slate-900 dark:text-white'>
              Add annual step-up
            </span>
            <span className='text-xs font-bold text-slate-500 dark:text-slate-400'>
              {stepUpOpen ? 'Hide' : 'Optional'}
            </span>
          </button>
          {stepUpOpen && (
            <div className='px-4 pb-4'>
              <div className='mb-1 flex items-center justify-between'>
                <span className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                  Annual step-up
                </span>
                <span className='text-sm font-black text-slate-900 dark:text-white'>
                  {stepUpPct}%
                </span>
              </div>
              <input
                type='range'
                min={0}
                max={25}
                step={1}
                value={stepUpPct}
                onChange={(e) => setStepUpPct(Number(e.target.value))}
                className='h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600 dark:bg-slate-700'
              />
              <div className='mt-3 grid grid-cols-2 gap-3'>
                <div className='rounded-lg bg-white px-3 py-2 dark:bg-slate-900/50'>
                  <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400'>
                    Starting monthly
                  </p>
                  <p className='text-sm font-black text-slate-900 dark:text-white'>
                    {formatINR(monthlyStart)}/mo
                  </p>
                  <p className='text-[10px] text-slate-500 dark:text-slate-400'>year 1 SIP</p>
                </div>
                <div className='rounded-lg bg-white px-3 py-2 dark:bg-slate-900/50'>
                  <p className='text-[9px] font-bold uppercase tracking-wider text-slate-400'>
                    Final-year monthly
                  </p>
                  <p className='text-sm font-black text-slate-900 dark:text-white'>
                    {formatINR(monthlyFinal)}/mo
                  </p>
                  <p className='text-[10px] text-slate-500 dark:text-slate-400'>
                    year {Math.max(1, Math.ceil(monthsLeft / 12))} SIP
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stat cards */}
        <div className='grid grid-cols-2 gap-3'>
          <div className='rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-900/40'>
            <p className='flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
              <FiCalendar className='h-3 w-3' /> Target date
            </p>
            <p className='mt-1 text-sm font-black text-slate-900 dark:text-white'>
              {goal.dueDate ? format(parseISO(goal.dueDate), 'dd MMM yyyy') : '—'}
            </p>
            <p className='text-[10px] text-slate-500 dark:text-slate-400'>
              {yearsLeft != null && remDays != null
                ? `${yearsLeft}y ${remDays}d left`
                : 'no deadline'}
            </p>
          </div>
          <div className='rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-900/40'>
            <p className='flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
              <FiTarget className='h-3 w-3' /> Remaining
            </p>
            <p className='mt-1 text-sm font-black text-slate-900 dark:text-white'>
              {formatINR(remaining)}
            </p>
            <p className='text-[10px] text-slate-500 dark:text-slate-400'>
              over {monthsLeft} months
            </p>
          </div>
          <div className='rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-900/40'>
            <p className='flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
              <FiTrendingUp className='h-3 w-3' /> Monthly needed
            </p>
            <p className='mt-1 text-sm font-black text-slate-900 dark:text-white'>
              {formatINR(monthlyStart)}/mo
            </p>
            <p className='text-[10px] text-slate-500 dark:text-slate-400'>
              at {returnPct}% p.a.
              {stepUpOpen && stepUpPct > 0 ? ` with ${stepUpPct}% step-up` : ''}
            </p>
          </div>
        </div>

        {/* Linked items */}
        {linkedItems.length > 0 && (
          <div>
            <p className='mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
              Linked items
            </p>
            <div className='flex flex-col gap-1.5'>
              {linkedItems.map((inv) => (
                <div
                  key={inv.id}
                  className='flex items-center justify-between rounded-lg border border-slate-200/70 bg-slate-50/60 px-3 py-2 dark:border-slate-800/60 dark:bg-slate-900/40'
                >
                  <span className='flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100'>
                    <FiLink className='h-3.5 w-3.5 text-emerald-500' />
                    {inv.name}
                  </span>
                  <span className='text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400'>
                    {formatINR(goalLinkedCurrentValue({ linkedAssetIds: [inv.id] }, investments))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className='flex items-center justify-between gap-3 border-t border-slate-200/70 pt-4 dark:border-slate-800/60'>
          <button
            type='button'
            onClick={() => onEdit(goal)}
            className='flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
          >
            <FiEdit2 className='h-4 w-4' /> Edit Goal
          </button>
          <div className='flex items-center gap-2'>
            {(!goal.status || goal.status === 'active') && (
              <button
                type='button'
                onClick={() => onMarkAchieved(goal)}
                className='flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400'
              >
                <FiCheckCircle className='h-4 w-4' /> Mark Achieved
              </button>
            )}
            <button
              type='button'
              onClick={() => onDelete(goal)}
              className='flex cursor-pointer items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400'
            >
              <FiTrash2 className='h-4 w-4' /> Delete
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
