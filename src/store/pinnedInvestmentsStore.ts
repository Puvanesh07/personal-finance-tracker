// Persisted list of investment IDs to keep at the top of the table (order preserved).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type State = {
  ids: string[];
  /** Unpin, or pin and move to the top of the pinned block. */
  togglePin: (id: string) => void;
  isPinned: (id: string) => boolean;
};

export const usePinnedInvestmentsStore = create<State>()(
  persist(
    (set, get) => ({
      ids: [],
      togglePin: (id) =>
        set((s) =>
          s.ids.includes(id)
            ? { ids: s.ids.filter((x) => x !== id) }
            : { ids: [id, ...s.ids.filter((x) => x !== id)] },
        ),
      isPinned: (id) => get().ids.includes(id),
    }),
    { name: 'fintrackly-pinned-investments', partialize: (s) => ({ ids: s.ids }) },
  ),
);
