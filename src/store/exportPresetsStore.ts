import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Logical export targets (filename templates per scope). */
export type ExportScope =
  | 'reports-investments-csv'
  | 'reports-investments-xlsx'
  | 'investments-bulk-csv'
  | 'cashflow-bulk-csv';

export type ExportFilenamePreset = {
  id: string;
  scope: ExportScope;
  label: string;
  /** Supports {date}, {time}, {datetime} */
  pattern: string;
  createdAt: number;
};

function rid() {
  return `ep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

type Store = {
  presets: ExportFilenamePreset[];
  lastFilenameByScope: Partial<Record<ExportScope, string>>;
  addPreset: (scope: ExportScope, label: string, pattern: string) => void;
  removePreset: (id: string) => void;
  rememberFilename: (scope: ExportScope, filename: string) => void;
  getLastFilename: (scope: ExportScope) => string | undefined;
};

export const useExportPresetsStore = create<Store>()(
  persist(
    (set, get) => ({
      presets: [],
      lastFilenameByScope: {},
      addPreset: (scope, label, pattern) => {
        const trimmedLabel = label.trim();
        const trimmedPattern = pattern.trim();
        if (!trimmedLabel || !trimmedPattern) return;
        set((s) => ({
          presets: [
            {
              id: rid(),
              scope,
              label: trimmedLabel,
              pattern: trimmedPattern,
              createdAt: Date.now(),
            },
            ...s.presets.filter(
              (p) =>
                !(p.scope === scope && p.label === trimmedLabel),
            ),
          ].slice(0, 40),
        }));
      },
      removePreset: (id) =>
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
      rememberFilename: (scope, filename) =>
        set((s) => ({
          lastFilenameByScope: {
            ...s.lastFilenameByScope,
            [scope]: filename,
          },
        })),
      getLastFilename: (scope) => get().lastFilenameByScope[scope],
    }),
    {
      name: 'fintrackly-export-presets',
      partialize: (s) => ({
        presets: s.presets,
        lastFilenameByScope: s.lastFilenameByScope,
      }),
    },
  ),
);
