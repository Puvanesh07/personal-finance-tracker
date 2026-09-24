// src/components/essentials/EssentialsStatusBadge.tsx
//
// Shared Perfect / Good / Risky pill used by the Essentials health cards and
// their expand-detail modals.

import type { EssentialsStatus } from '../../utils/financialProfile';

export function EssentialsStatusBadge({ status }: { status: EssentialsStatus }) {
  const cls =
    status === 'Perfect'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
      : status === 'Good'
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25';
  const dot =
    status === 'Perfect'
      ? 'bg-emerald-500'
      : status === 'Good'
        ? 'bg-amber-500'
        : 'bg-rose-500';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}
