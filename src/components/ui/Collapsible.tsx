// src/components/ui/Collapsible.tsx
//
// A lightweight, animated disclosure panel. Used to tuck heavyweight detail
// (charts, expanded breakdowns) behind a click so dense pages like Cashflow do
// not force the user to scroll past a wall of visuals to reach the data table.
//
// Lazy by default: the children are NOT mounted until the panel is first
// opened, so expensive cards/store-subscriptions/charts never render (or do any
// work) on a collapsed panel. After the first open they stay mounted so
// toggling does not remount charts. Open/closed is measured with a
// ResizeObserver to animate to the real content height, and the choice is
// persisted per `storageKey` so a returning user keeps panels as they left them.

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { FiChevronDown } from 'react-icons/fi';

type CollapsibleProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Optional controls rendered on the header row (right side, before the chevron). */
  actions?: ReactNode;
  /** Initial state on very first load (no stored preference yet). */
  defaultOpen?: boolean;
  /** When set, the open/closed state is remembered in localStorage under this key. */
  storageKey?: string;
  /** Do not mount children until first opened (default true). Set false to always render. */
  lazy?: boolean;
  /** Extra classes on the outer <section> (e.g. `lg:col-span-2` inside a grid). */
  className?: string;
  children: ReactNode;
};

export function Collapsible({
  title,
  subtitle,
  icon,
  actions,
  defaultOpen = false,
  storageKey,
  lazy = true,
  className,
  children,
}: CollapsibleProps) {
  const [open, setOpen] = useState<boolean>(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved === '1') return true;
        if (saved === '0') return false;
      } catch {
        /* ignore quota / privacy mode */
      }
    }
    return defaultOpen;
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<string>(open ? 'none' : '0px');

  // Lazy mounting: children render once the panel has ever been opened (then
  // stay mounted so charts are not remounted on every toggle).
  const [everOpened, setEverOpened] = useState<boolean>(open);
  const mounted = !lazy || everOpened;
  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  // Persist the user's choice.
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [open, storageKey]);

  // Track the real content height so the open/close animates smoothly and
  // re-measures when the content (e.g. a chart legend) changes size.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (!open) {
      // Collapse fully first, then allow the transition to run.
      setMaxHeight('0px');
      return;
    }
    const measure = () => setMaxHeight(`${el.scrollHeight}px`);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, mounted, children]);

  // Once fully open, release the fixed height so nested responsive content is
  // never clipped by a stale measurement.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setMaxHeight('none'), 320);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50 ${className ?? ''}`}>
      <button
        type='button'
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className='flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
      >
        <span className='flex min-w-0 items-center gap-3'>
          {icon && (
            <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'>
              {icon}
            </span>
          )}
          <span className='min-w-0'>
            <span className='block truncate text-sm font-bold text-slate-700 dark:text-slate-200'>
              {title}
            </span>
            {subtitle && (
              <span className='block truncate text-[11px] font-medium text-slate-400 dark:text-slate-500'>
                {subtitle}
              </span>
            )}
          </span>
        </span>
        <span className='flex shrink-0 items-center gap-2'>
          {actions}
          <FiChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      <div
        style={{ maxHeight }}
        className='overflow-hidden transition-[max-height] duration-300 ease-in-out'
      >
        <div ref={contentRef} className='px-5 pb-5 pt-1'>
          {mounted ? children : null}
        </div>
      </div>
    </section>
  );
}
