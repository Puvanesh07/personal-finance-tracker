// src/store/slices/credentialsSlice.ts
//
// Credentials module (password vault entries). Newest-edited first so the list
// order stays stable across a background refresh.
import type { StateCreator } from 'zustand';
import { deleteDoc } from 'firebase/firestore';

import { createId } from '../../utils/id';
import { touchedDoc } from '../portfolioPersistence';
import type { Credential } from '../../types/investmentTypes';
import {
  blockIfLimited,
  clean,
  makePersistence,
  now,
  safeCompare,
} from '../shared';
import type { PortfolioState } from '../types';

export type CredentialsSlice = Pick<
  PortfolioState,
  'credentials' | 'addCredential' | 'updateCredential' | 'deleteCredential'
>;

export const createCredentialsSlice: StateCreator<
  PortfolioState,
  [],
  [],
  CredentialsSlice
> = (set, get) => {
  const { saveDoc } = makePersistence(get);

  return {
    credentials: [],

    addCredential: async (credential) => {
      const uid = get().uid;
      if (!uid) return;
      if (blockIfLimited('credentials', get().credentials.length)) return;
      const t = now();
      const withMeta = clean({
        ...credential,
        id: createId('cred'),
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as Credential;
      await saveDoc(uid, 'credentials', withMeta);
      set((s) => ({
        credentials: [withMeta, ...s.credentials].sort((a, b) =>
          safeCompare(b.updatedAt, a.updatedAt),
        ),
      }));
    },

    updateCredential: async (id, patch) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().credentials.find((x) => x.id === id);
      if (!existing) return;
      const updated = clean({
        ...existing,
        ...patch,
        id,
        updatedAt: now(),
      }) as Credential;
      await saveDoc(uid, 'credentials', updated);
      set((s) => ({
        credentials: s.credentials.map((x) => (x.id === id ? updated : x)),
      }));
    },

    deleteCredential: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      await deleteDoc(touchedDoc(uid, 'credentials', id));
      set((s) => ({ credentials: s.credentials.filter((x) => x.id !== id) }));
    },
  };
};
