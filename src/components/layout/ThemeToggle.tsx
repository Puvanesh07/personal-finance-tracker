// src/components/layout/ThemeToggle.tsx
import { FiMoon, FiSun } from 'react-icons/fi';
import { useThemeStore } from '../../store/themeStore';

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const isDark = mode === 'dark';

  return (
    <button
      type='button'
      role='switch'
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => toggleMode()}
      title={isDark ? 'Dark mode' : 'Light mode'}
      className='group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300/80 bg-white/90 text-amber-500 shadow-sm transition-all hover:scale-[1.04] hover:border-amber-400/60 hover:bg-amber-50 active:scale-95 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-sky-300 dark:hover:border-sky-400/60 dark:hover:bg-slate-800'
    >
      <FiSun
        className={`absolute h-4 w-4 transition-all duration-300 ${
          isDark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
        }`}
        aria-hidden
      />
      <FiMoon
        className={`absolute h-4 w-4 transition-all duration-300 ${
          isDark
            ? 'scale-100 rotate-0 opacity-100'
            : 'scale-0 -rotate-90 opacity-0'
        }`}
        aria-hidden
      />
      <span className='sr-only'>{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
