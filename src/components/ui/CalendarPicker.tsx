// src/components/ui/CalendarPicker.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  FiCalendar,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';

import { Popover } from './Popover';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type CalendarPickerProps = {
  /** Selected date as `yyyy-MM-dd`, or '' when unset. */
  value: string;
  onChange: (v: string) => void;
  /** Optional label rendered above the trigger. */
  label?: string;
  /** Placeholder shown when no date is selected. */
  placeholder?: string;
  /** Stretch the trigger to its container (default). Set false for filter rows. */
  fullWidth?: boolean;
  /** Extra classes appended to the trigger button. */
  triggerClassName?: string;
};

/**
 * Shared date picker. Renders an anchored calendar on desktop and a bottom
 * sheet on mobile (via {@link Popover}), so it is never clipped by the keyboard
 * or the edge of the screen.
 */
export function CalendarPicker({
  value,
  onChange,
  label,
  placeholder = 'Pick a date',
  fullWidth = true,
  triggerClassName = '',
}: CalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = value ? parse(value, 'yyyy-MM-dd', new Date()) : new Date();
    return isValid(d) ? d : new Date();
  });

  const selectedDate = useMemo(() => {
    if (!value) return null;
    const d = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : null;
  }, [value]);

  // Follow externally-driven value changes (e.g. form reset / edit load).
  useEffect(() => {
    if (!value) return;
    const d = parse(value, 'yyyy-MM-dd', new Date());
    if (isValid(d)) setViewDate(d);
  }, [value]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const select = (d: Date) => {
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const toggleOpen = () => {
    if (!open && selectedDate) setViewDate(selectedDate);
    setOpen((v) => !v);
  };

  const trigger = (
    <button
      ref={triggerRef}
      type='button'
      onClick={toggleOpen}
      className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
        fullWidth ? 'w-full' : 'min-w-[160px]'
      } ${
        open
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/10 dark:text-emerald-400'
          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600'
      } ${triggerClassName}`}
    >
      <FiCalendar
        className={`h-4 w-4 shrink-0 ${
          open ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'
        }`}
      />
      <span
        className={`flex-1 text-left ${
          selectedDate ? '' : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        {selectedDate ? format(selectedDate, 'dd MMM yyyy') : placeholder}
      </span>
      <FiChevronDown
        className={`h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform ${
          open ? 'rotate-180 text-emerald-500' : ''
        }`}
      />
    </button>
  );

  const calendar = (
    <div className='mx-auto w-full max-w-[300px] p-1.5'>
      {/* Month navigation */}
      <div className='flex items-center justify-between px-2 py-2'>
        <button
          type='button'
          onClick={() => setViewDate((d) => addMonths(d, -1))}
          className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
          aria-label='Previous month'
        >
          <FiChevronLeft className='h-4 w-4' />
        </button>
        <span className='text-sm font-bold text-slate-800 dark:text-slate-100'>
          {format(viewDate, 'MMMM yyyy')}
        </span>
        <button
          type='button'
          onClick={() => setViewDate((d) => addMonths(d, 1))}
          className='flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
          aria-label='Next month'
        >
          <FiChevronRight className='h-4 w-4' />
        </button>
      </div>

      {/* Weekday headers */}
      <div className='grid grid-cols-7 px-1 pb-1'>
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className='py-1 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500'
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className='grid grid-cols-7 gap-y-0.5 px-1'>
        {days.map((day) => {
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const isCurMonth = isSameMonth(day, viewDate);
          const isTodayDay = isToday(day);
          return (
            <button
              key={day.toISOString()}
              type='button'
              onClick={() => select(day)}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-emerald-500 font-bold text-white shadow-md shadow-emerald-500/30'
                  : isTodayDay
                    ? 'border border-emerald-400 text-emerald-600 dark:border-emerald-600 dark:text-emerald-400'
                    : isCurMonth
                      ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      : 'text-slate-300 dark:text-slate-600'
              }`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className='mt-1 flex items-center justify-between border-t border-slate-100 px-2 pt-2 dark:border-slate-800'>
        <button
          type='button'
          onClick={() => {
            onChange('');
            setOpen(false);
          }}
          className='rounded-lg px-2 py-1 text-xs font-bold text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300'
        >
          Clear
        </button>
        <button
          type='button'
          onClick={() => select(new Date())}
          className='rounded-lg px-2 py-1 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20'
        >
          Today
        </button>
      </div>
    </div>
  );

  return (
    <div className={label ? 'flex flex-col gap-1' : undefined}>
      {label && (
        <label className='px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
          {label}
        </label>
      )}
      {trigger}
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        width={300}
        minWidth={288}
        maxHeight={420}
        title='Select date'
      >
        {calendar}
      </Popover>
    </div>
  );
}
