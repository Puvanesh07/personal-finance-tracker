import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SavedViewRecord = {
  id: string;
  pageId: string;
  name: string;
  state: Record<string, unknown>;
  createdAt: number;
};

const MAX_VIEWS_PER_PAGE = 14;

function randomId() {
  return `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type Store = {
  views: SavedViewRecord[];
  saveView: (pageId: string, name: string, state: Record<string, unknown>) => void;
  removeView: (id: string) => void;
};

export const useSavedViewsStore = create<Store>()(
  persist(
    (set) => ({
      views: [],
      saveView: (pageId, name, state) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const id = randomId();
        const createdAt = Date.now();
        set((s) => {
          const otherPages = s.views.filter((v) => v.pageId !== pageId);
          const samePage = s.views.filter((v) => v.pageId === pageId);
          const nextForPage = [
            { id, pageId, name: trimmed, state: { ...state }, createdAt },
            ...samePage.filter((v) => v.name !== trimmed),
          ].slice(0, MAX_VIEWS_PER_PAGE);
          return { views: [...otherPages, ...nextForPage] };
        });
      },
      removeView: (id) =>
        set((s) => ({ views: s.views.filter((v) => v.id !== id) })),
    }),
    { name: 'fintrackly-saved-views', partialize: (s) => ({ views: s.views }) },
  ),
);
