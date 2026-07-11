import type { DateFilterMode, DateFilterState } from '../../utils/dateFilters';
import { dateFilterLabel } from '../../utils/dateFilters';

const MODES: { id: DateFilterMode; label: string }[] = [
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'year', label: 'Yearly' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

type Props = {
  value: DateFilterState;
  onChange: (next: DateFilterState) => void;
  accent?: 'emerald' | 'blue';
};

export function DateRangeFilter({ value, onChange, accent = 'emerald' }: Props) {
  const activeCls =
    accent === 'blue'
      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';

  return (
    <div className='flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <p className='text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
            Date filter
          </p>
          <p className='text-sm font-semibold text-slate-800 dark:text-slate-100'>
            {dateFilterLabel(value)}
          </p>
        </div>
        <div className='flex flex-wrap gap-1.5'>
          {MODES.map((m) => (
            <button
              key={m.id}
              type='button'
              onClick={() => onChange({ ...value, mode: m.id })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                value.mode === m.id
                  ? activeCls
                  : 'border-transparent bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {value.mode === 'custom' && (
        <div className='flex flex-wrap items-end gap-3'>
          <label className='flex flex-col gap-1 text-xs font-bold text-slate-500 dark:text-slate-400'>
            From
            <input
              type='date'
              value={value.customStart}
              onChange={(e) =>
                onChange({ ...value, customStart: e.target.value })
              }
              className='rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100'
            />
          </label>
          <label className='flex flex-col gap-1 text-xs font-bold text-slate-500 dark:text-slate-400'>
            To
            <input
              type='date'
              value={value.customEnd}
              onChange={(e) =>
                onChange({ ...value, customEnd: e.target.value })
              }
              className='rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100'
            />
          </label>
        </div>
      )}
    </div>
  );
}
