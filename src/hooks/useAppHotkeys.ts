import { useEffect, useRef } from 'react';

function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export type AppHotkeyHandlers = {
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
  onFocusInvestmentsSearch?: () => void;
  investmentsPath?: string;
  currentPath: string;
};

export function useAppHotkeys(handlers: AppHotkeyHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const o = ref.current;
      const palette =
        (e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey);
      if (palette) {
        e.preventDefault();
        o.onOpenPalette();
        return;
      }

      if (isTypingTarget(e.target)) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        o.onOpenShortcuts();
        return;
      }

      if (
        e.key === '/' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        o.onFocusInvestmentsSearch &&
        o.investmentsPath &&
        o.currentPath.startsWith(o.investmentsPath)
      ) {
        e.preventDefault();
        o.onFocusInvestmentsSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
