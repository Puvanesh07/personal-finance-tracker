// src/components/goals/AssetLinkPicker.tsx
// Searchable, grouped (by asset type) multi-select of investments to link to
// a Goal. Linked assets' live market value is rolled into the goal's current
// amount automatically (see utils/goalLinks.ts).

import { useMemo, useState } from 'react';
import {
  FiChevronDown,
  FiChevronRight,
  FiLink,
  FiSearch,
} from 'react-icons/fi';
import type { Investment, InvestmentType } from '../../types/investmentTypes';
import { currentValue } from '../../utils/calculations';
import { formatINR } from '../../utils/format';
import {
  INVESTMENT_GROUP_LABEL,
  INVESTMENT_GROUP_ORDER,
} from '../../utils/goalLinks';

type Props = {
  investments: Investment[];
  selected: string[];
  onChange: (ids: string[]) => void;
};

export function AssetLinkPicker({ investments, selected, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<InvestmentType>>(new Set());

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<InvestmentType, Investment[]>();
    for (const t of INVESTMENT_GROUP_ORDER) map.set(t, []);
    for (const inv of investments) {
      if (
        q &&
        !`${inv.name} ${inv.symbol ?? ''}`.toLowerCase().includes(q)
      )
        continue;
      const arr = map.get(inv.type);
      if (arr) arr.push(inv);
      else map.set(inv.type, [inv]);
    }
    for (const arr of map.values())
      arr.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [investments, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const toggleGroup = (t: InvestmentType) => {
    const next = new Set(openGroups);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setOpenGroups(next);
  };

  return (
    <div className='rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-900/40'>
      {/* Search */}
      <div className='flex items-center gap-2 rounded-xl border border-slate-300/70 bg-white px-3 py-2 dark:border-slate-700/70 dark:bg-slate-900/60'>
        <FiSearch className='h-4 w-4 shrink-0 text-slate-400' />
        <input
          className='w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search assets & accounts...'
        />
      </div>

      {/* Selected summary */}
      {selected.length > 0 && (
        <div className='mt-2 flex items-center justify-between'>
          <span className='text-xs font-bold text-emerald-600 dark:text-emerald-400'>
            {selected.length} selected
          </span>
          <button
            type='button'
            className='cursor-pointer text-xs font-bold text-slate-500 transition-colors hover:text-rose-500 dark:text-slate-300'
            onClick={() => onChange([])}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Grouped list */}
      <div className='custom-scrollbar mt-2 max-h-64 overflow-y-auto pr-1'>
        {INVESTMENT_GROUP_ORDER.map((t) => {
          const items = groups.get(t) ?? [];
          if (items.length === 0) return null;
          const selCount = items.filter((i) => selectedSet.has(i.id)).length;
          const open = openGroups.has(t) || query.trim().length > 0;
          return (
            <div key={t} className='mb-1'>
              <button
                type='button'
                onClick={() => toggleGroup(t)}
                className='flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60'
              >
                <span className='flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200'>
                  {open ? (
                    <FiChevronDown className='h-3.5 w-3.5' />
                  ) : (
                    <FiChevronRight className='h-3.5 w-3.5' />
                  )}
                  {INVESTMENT_GROUP_LABEL[t]}
                </span>
                <span className='flex items-center gap-1.5'>
                  <span className='text-xs font-bold text-slate-500 dark:text-slate-400'>
                    {items.length}
                  </span>
                  {selCount > 0 && (
                    <span className='rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400'>
                      {selCount}
                    </span>
                  )}
                </span>
              </button>
              {open &&
                items.map((inv) => (
                  <label
                    key={inv.id}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                      selectedSet.has(inv.id)
                        ? 'bg-emerald-500/10'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <span className='flex min-w-0 items-center gap-2'>
                      <input
                        type='checkbox'
                        checked={selectedSet.has(inv.id)}
                        onChange={() => toggle(inv.id)}
                        className='h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700'
                      />
                      <span className='truncate text-sm font-semibold text-slate-800 dark:text-slate-100'>
                        {inv.name}
                      </span>
                    </span>
                    <span className='shrink-0 text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400'>
                      {formatINR(currentValue(inv))}
                    </span>
                  </label>
                ))}
            </div>
          );
        })}
        {investments.length === 0 && (
          <p className='px-2 py-3 text-xs text-slate-500 dark:text-slate-400'>
            No investments yet — add assets first to link them.
          </p>
        )}
      </div>

      <p className='mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400'>
        <FiLink className='h-3 w-3 shrink-0' />
        Linked assets' live value is added to the goal amount automatically.
      </p>
    </div>
  );
}
