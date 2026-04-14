import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type PrivacyState = {
  hideAmounts: boolean;
  setHideAmounts: (hide: boolean) => void;
  toggleHideAmounts: () => void;
};

const STORAGE_KEY = 'fintrackly-privacy';

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set, get) => ({
      hideAmounts: false,
      setHideAmounts: (hide) => set({ hideAmounts: hide }),
      toggleHideAmounts: () => set({ hideAmounts: !get().hideAmounts }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({ hideAmounts: s.hideAmounts }),
    },
  ),
);

