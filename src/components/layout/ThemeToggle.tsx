// src/components/layout/ThemeToggle.tsx
import { FiMoon, FiSun } from 'react-icons/fi';
import { useThemeStore } from '../../store/themeStore';

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const isDark = mode === 'dark';

  return (
    <div
      className='flex items-center gap-2 rounded-full border border-slate-300/80 bg-slate-100/90 py-1 pl-2 pr-1 shadow-sm backdrop-blur-sm dark:border-slate-600/80 dark:bg-slate-800/90'
      title={isDark ? 'Dark mode' : 'Light mode'}
    >
      <span className='hidden text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:inline dark:text-slate-400'>
        {isDark ? 'Dark' : 'Light'}
      </span>
      <button
        type='button'
        role='switch'
        aria-checked={isDark}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => toggleMode()}
        className='relative flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full bg-slate-200/90 p-0.5 transition-colors dark:bg-slate-900/80'
      >
        <span
          className={`absolute left-0.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-amber-500 shadow-md transition-transform duration-200 ease-out dark:bg-slate-700 dark:text-sky-300 ${
            isDark ? 'translate-x-[22px]' : 'translate-x-0'
          }`}
        >
          {isDark ? (
            <FiMoon className='h-3.5 w-3.5' aria-hidden />
          ) : (
            <FiSun className='h-3.5 w-3.5' aria-hidden />
          )}
        </span>
      </button>
    </div>
  );
}
