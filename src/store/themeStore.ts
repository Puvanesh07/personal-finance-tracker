// src/store/themeStore.ts
import { create } from 'zustand'

export type ThemeMode = 'dark'

type ThemeState = {
  mode: ThemeMode
}

export const useThemeStore = create<ThemeState>(() => ({
  mode: 'dark',
}))