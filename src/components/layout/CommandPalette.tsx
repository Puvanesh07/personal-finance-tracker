import { ALL_NAV_ITEMS } from '../../navigation/appNav';
import { FiSearch } from 'react-icons/fi';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlight, setHighlight] = useState(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ALL_NAV_ITEMS;
    return ALL_NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(s) ||
        item.to.toLowerCase().includes(s),
    );
  }, [q]);

  useEffect(() => {
    if (open) {
      setQ('');
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setHighlight((h) =>
      filtered.length ? Math.min(h, filtered.length - 1) : 0,
    );
  }, [filtered.length]);

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) =>
          filtered.length ? (h + 1) % filtered.length : 0,
        );
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) =>
          filtered.length ? (h - 1 + filtered.length) % filtered.length : 0,
        );
      }
      if (e.key === 'Enter' && filtered[highlight]) {
        e.preventDefault();
        go(filtered[highlight].to);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, highlight, onClose, navigate]);

  if (!open) return null;

  return (
    <div
      className='fixed inset-0 z-[200] flex items-start justify-center bg-slate-950/50 backdrop-blur-sm p-3 pt-[12vh] sm:pt-[15vh]'
      role='dialog'
      aria-modal='true'
      aria-label='Command palette'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className='w-full max-w-lg rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150'>
        <div className='flex items-center gap-3 border-b border-slate-200/70 dark:border-slate-800/70 px-4 py-3'>
          <FiSearch className='h-5 w-5 shrink-0 text-slate-400' />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Jump to page…'
            className='flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400'
          />
          <kbd className='hidden sm:inline rounded-md border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-500'>
            esc
          </kbd>
        </div>
        <ul className='max-h-[min(50vh,360px)] overflow-y-auto py-2'>
          {filtered.length === 0 ? (
            <li className='px-4 py-6 text-center text-sm text-slate-500'>
              No matches
            </li>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              const active = i === highlight;
              return (
                <li key={item.to}>
                  <button
                    type='button'
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => go(item.to)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${active ? 'text-emerald-600 dark:text-emerald-400' : item.accent}`}
                    />
                    <span>{item.label}</span>
                    <span className='ml-auto text-[10px] font-mono text-slate-400 truncate max-w-[40%]'>
                      {item.to}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className='border-t border-slate-200/70 dark:border-slate-800/70 px-4 py-2 text-[10px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1'>
          <span>
            <kbd className='font-mono rounded bg-slate-100 dark:bg-slate-800 px-1'>↑</kbd>{' '}
            <kbd className='font-mono rounded bg-slate-100 dark:bg-slate-800 px-1'>↓</kbd>{' '}
            navigate
          </span>
          <span>
            <kbd className='font-mono rounded bg-slate-100 dark:bg-slate-800 px-1'>↵</kbd> open
          </span>
        </div>
      </div>
    </div>
  );
}
