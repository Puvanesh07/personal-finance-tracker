// src/components/ui/Select.tsx
// Themed, responsive replacement for the native <select>. The native popup
// uses OS colors (grey/blue) that clash with the app theme; this renders a
// custom popover list that matches light/dark UI.
//
// Drop-in compatible: it reads <option> children and calls onChange with a
// fake event shaped like { target: { value } }, so existing handlers
// (`(e) => setX(e.target.value)`) keep working unchanged.

import { Children, isValidElement, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FiCheck, FiChevronDown } from 'react-icons/fi';

export type SelectChangeEvent = { target: { value: string } };

type Props = {
  value: string;
  onChange: (e: SelectChangeEvent) => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Align popover to the right edge instead of left. */
  align?: 'left' | 'right';
};

type ParsedOption = { value: string; label: string };

function parseOptions(children: ReactNode): ParsedOption[] {
  const out: ParsedOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as {
      value?: string | number;
      children?: ReactNode;
    };
    const label =
      typeof props.children === 'string' || typeof props.children === 'number'
        ? String(props.children)
        : Array.isArray(props.children)
          ? props.children.join('')
          : '';
    out.push({ value: String(props.value ?? ''), label });
  });
  return out;
}

export function Select({
  value,
  onChange,
  children,
  className,
  disabled,
  placeholder,
  align = 'left',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = parseOptions(children);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className='relative'>
      <button
        type='button'
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 text-left outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`}
      >
        <span className={`truncate ${selected ? '' : 'text-slate-400 dark:text-slate-500'}`}>
          {selected ? selected.label : placeholder ?? 'Select…'}
        </span>
        <FiChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`custom-scrollbar absolute z-50 mt-1 max-h-56 w-full min-w-[10rem] overflow-y-auto rounded-xl border border-slate-200/80 bg-white py-1 shadow-xl dark:border-slate-700/80 dark:bg-slate-900 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type='button'
              onClick={() => {
                onChange({ target: { value: o.value } });
                setOpen(false);
              }}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium transition-colors ${
                o.value === value
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span className='truncate'>{o.label}</span>
              {o.value === value && <FiCheck className='h-4 w-4 shrink-0' />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
