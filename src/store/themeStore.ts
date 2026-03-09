import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark'

type ThemeState = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

const getInitialMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light'
  const fromStorage = window.localStorage.getItem('pf-theme')
  if (fromStorage === 'dark' || fromStorage === 'light') return fromStorage
  return 'light'
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: getInitialMode(),
  setMode: (mode) => {
    set({ mode })
  },
  toggle: () => {
    const next = get().mode === 'light' ? 'dark' : 'light'
    set({ mode: next })
  },
}))

