// src/store/themeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'fintrackly-theme';

export function applyThemeToDocument(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', mode === 'dark' ? '#020617' : '#f8fafc');
  }
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'dark';
    const parsed = JSON.parse(raw) as { state?: { mode?: ThemeMode } };
    const m = parsed?.state?.mode;
    return m === 'light' || m === 'dark' ? m : 'dark';
  } catch {
    return 'dark';
  }
}

if (typeof window !== 'undefined') {
  applyThemeToDocument(readStoredMode());
}

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: readStoredMode(),
      setMode: (mode) => {
        set({ mode });
        applyThemeToDocument(mode);
      },
      toggleMode: () => {
        const next = get().mode === 'dark' ? 'light' : 'dark';
        get().setMode(next);
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({ mode: s.mode }),
      onRehydrateStorage: () => (state) => {
        if (state?.mode) applyThemeToDocument(state.mode);
      },
    },
  ),
);
