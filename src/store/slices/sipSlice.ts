// src/store/slices/sipSlice.ts
//
// SIP planning module. `sipPlans` is a discriminated union: one optional
// monthly budget row (type 'budget') plus any number of instrument
// allocations (type 'instrument'). The type guards keep the two shapes from
// leaking into each other on read or write.
import type { StateCreator } from 'zustand';
import { deleteDoc } from 'firebase/firestore';

import { createId } from '../../utils/id';
import { touchedDoc, userDoc } from '../portfolioPersistence';
import type {
  SipBudgetPlan,
  SipInstrumentPlan,
} from '../../types/investmentTypes';
import { clean, makePersistence, now } from '../shared';
import type { PortfolioState } from '../types';

export type SipSlice = Pick<
  PortfolioState,
  | 'sipPlans'
  | 'addSipInstrument'
  | 'updateSipInstrument'
  | 'deleteSipInstrument'
  | 'upsertSipBudget'
  | 'deleteSipBudget'
>;

export const createSipSlice: StateCreator<PortfolioState, [], [], SipSlice> = (
  set,
  get,
) => {
  const { saveDoc } = makePersistence(get);

  return {
    sipPlans: [],

    addSipInstrument: async (instrument) => {
      const uid = get().uid;
      if (!uid) return;
      const t = now();
      const item = clean({
        ...instrument,
        id: createId('sip'),
        type: 'instrument' as const,
        userId: uid,
        createdAt: t,
        updatedAt: t,
      });
      await saveDoc(uid, 'sipPlans', item);
      set((s) => ({ sipPlans: [...s.sipPlans, item] }));
    },

    updateSipInstrument: async (id, patch) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().sipPlans.find((x) => x.id === id);
      if (!existing) return;
      const updated = clean({
        ...(existing as SipInstrumentPlan),
        ...patch,
        id,
        updatedAt: now(),
      }) as SipInstrumentPlan;
      await saveDoc(uid, 'sipPlans', updated);
      set((s) => ({
        sipPlans: s.sipPlans.map((x) => (x.id === id ? updated : x)),
      }));
    },

    deleteSipInstrument: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      await deleteDoc(touchedDoc(uid, 'sipPlans', id));
      set((s) => ({ sipPlans: s.sipPlans.filter((x) => x.id !== id) }));
    },

    upsertSipBudget: async (budget) => {
      const uid = get().uid;
      if (!uid) return '';
      const existing = get().sipPlans.find(
        (x): x is SipBudgetPlan => x.type === 'budget',
      );
      const t = now();
      if (existing) {
        const updated = clean({ ...existing, budget, updatedAt: t });
        await saveDoc(uid, 'sipPlans', updated);
        set((s) => ({
          sipPlans: s.sipPlans.map((x) =>
            x.id === existing.id ? updated : x,
          ),
        }));
        return existing.id;
      } else {
        const item = clean({
          id: createId('sipb'),
          type: 'budget' as const,
          budget,
          userId: uid,
          createdAt: t,
          updatedAt: t,
        });
        await saveDoc(uid, 'sipPlans', item);
        set((s) => ({ sipPlans: [...s.sipPlans, item] }));
        return item.id;
      }
    },

    deleteSipBudget: async () => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().sipPlans.find(
        (x): x is SipBudgetPlan => x.type === 'budget',
      );
      if (!existing) return;
      await deleteDoc(userDoc(uid, 'sipPlans', existing.id));
      set((s) => ({
        sipPlans: s.sipPlans.filter((x) => x.id !== existing.id),
      }));
    },
  };
};
