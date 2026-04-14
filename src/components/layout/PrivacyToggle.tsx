import { FiEye, FiEyeOff } from 'react-icons/fi';
import { usePrivacyStore } from '../../store/privacyStore';

export function PrivacyToggle() {
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const toggleHideAmounts = usePrivacyStore((s) => s.toggleHideAmounts);

  return (
    <button
      type='button'
      role='switch'
      aria-checked={hideAmounts}
      aria-label={hideAmounts ? 'Show numbers' : 'Hide numbers'}
      title={hideAmounts ? 'Show amounts' : 'Hide amounts'}
      onClick={toggleHideAmounts}
      className='group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300/80 bg-white/90 text-slate-600 shadow-sm transition-all hover:scale-[1.04] hover:border-emerald-400/60 hover:bg-slate-50 active:scale-95 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:border-emerald-400/60 dark:hover:bg-slate-800'
    >
      {hideAmounts ? (
        <FiEyeOff className='h-4 w-4' aria-hidden />
      ) : (
        <FiEye className='h-4 w-4' aria-hidden />
      )}
      <span className='sr-only'>
        {hideAmounts ? 'Amounts hidden' : 'Amounts visible'}
      </span>
    </button>
  );
}

