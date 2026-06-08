import { FiChevronDown } from 'react-icons/fi';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type DropdownOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
};

type DropdownProps<T extends string = string> = {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
};

export function Dropdown<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  className = '',
  menuClassName = '',
  align = 'left',
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.value === value);

  const updatePos = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const w = Math.max(r.width, 200);
    let left = align === 'right' ? r.right - w : r.left;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    setPos({
      top: r.bottom + 6,
      left: Math.max(8, left),
      width: w,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onResize = () => updatePos();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type='button'
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (!open) updatePos();
          setOpen((v) => !v);
        }}
        className='flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all hover:border-slate-400/80 dark:hover:border-slate-600/80 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60'
      >
        <span className={selected ? '' : 'text-slate-500 dark:text-slate-400'}>
          {selected?.label ?? placeholder}
        </span>
        <FiChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <>
            <div
              className='fixed inset-0 z-[120]'
              aria-hidden
              onMouseDown={() => setOpen(false)}
            />
            <div
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: pos.width,
              }}
              className={`z-[121] max-h-60 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-xl ${menuClassName}`}
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full flex-col items-start px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/80 ${
                    opt.value === value
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.description && (
                    <span className='text-[11px] text-slate-500 dark:text-slate-400'>
                      {opt.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
