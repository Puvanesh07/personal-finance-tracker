import type { Toast } from 'react-hot-toast';
import { toast } from 'react-hot-toast';
import { FiRotateCcw, FiX } from 'react-icons/fi';

/**
 * A toast with an "Undo" action (audit I5). Used for destructive-but-reversible
 * actions like deleting a transaction or investment, so a mis-tap is never
 * permanent. The caller passes the re-apply logic; we just render it and wire
 * the button. Auto-dismisses after ~6s.
 */
export function showUndoToast(
  label: string,
  onUndo: () => void | Promise<void>,
) {
  toast.custom(
    (t: Toast) => (
      <div className="pointer-events-auto flex w-[min(92vw,22rem)] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {label}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Deleted — this can still be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void onUndo();
            toast.dismiss(t.id);
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-emerald-500"
        >
          <FiRotateCcw className="h-4 w-4" />
          Undo
        </button>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>
    ),
    { duration: 6000 },
  );
}
