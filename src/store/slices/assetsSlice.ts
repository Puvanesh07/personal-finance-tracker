// src/store/slices/assetsSlice.ts
//
// Assets module: live holdings (`investments`), realised sales (`soldTrades`)
// and the bond lifecycle helpers. Reads other collections (cashflows, accounts)
// through `get()` so it stays decoupled from the slices that own them.
import type { StateCreator } from 'zustand';
import { setDoc, writeBatch } from 'firebase/firestore';
import { deleteDoc } from 'firebase/firestore';

import { createId } from '../../utils/id';
import { showUndoToast } from '../../utils/undoToast';
import { todayISO } from '../../utils/dateUtils';
import {
  bondCouponId,
  bondMaturityItemId,
  generateBondSchedule,
} from '../../utils/bondSchedule';
import { analyseAfterInvestment } from '../../services/financialEventEngine';
import { encryptDoc } from '../../services/encryptionService';
import { markDataDirty } from '../../utils/dataVersion';
import { db, touchedDoc, userDoc } from '../portfolioPersistence';
import type {
  CashflowEntry,
  Investment,
  SoldTrade,
} from '../../types/investmentTypes';
import {
  blockIfLimited,
  clean,
  makePersistence,
  now,
  safeCompare,
} from '../shared';
import type { PortfolioState } from '../types';

export type AssetsSlice = Pick<
  PortfolioState,
  | 'investments'
  | 'soldTrades'
  | 'addInvestment'
  | 'importInvestments'
  | 'updateInvestment'
  | 'deleteInvestment'
  | 'syncBondInterest'
  | 'settleBondMaturity'
  | 'addSoldTrade'
  | 'updateSoldTrade'
  | 'deleteSoldTrade'
>;

export const createAssetsSlice: StateCreator<
  PortfolioState,
  [],
  [],
  AssetsSlice
> = (set, get) => {
  const { saveDoc, saveDocsAtomically } = makePersistence(get);

  return {
    investments: [],
    soldTrades: [],

    addInvestment: async (investment) => {
      const uid = get().uid;
      if (!uid) return;
      if (blockIfLimited('investments', get().investments.length)) return;
      const t = now();
      const withMeta = clean({
        ...investment,
        id: createId('inv'),
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as Investment;
      await saveDoc(uid, 'investments', withMeta);
      set((s) => ({ investments: [withMeta, ...s.investments] }));
      void analyseAfterInvestment(withMeta);
    },

    importInvestments: async (drafts) => {
      const uid = get().uid;
      if (!uid) return { added: 0, updated: 0, skipped: 0 };
      const existing = get().investments;
      let added = 0,
        updated = 0,
        skipped = 0;
      const t = now();
      const batch = writeBatch(db);
      const newDocs: Investment[] = [];

      const updatedDocs: Investment[] = [];

      for (const draft of drafts) {
        const match = existing.find(
          (inv) =>
            inv.name === draft.name &&
            inv.type === draft.type &&
            inv.platform === draft.platform,
        );
        if (match) {
          const hasChanged =
            ('quantity' in draft && draft.quantity !== (match as any).quantity) ||
            ('units' in draft && draft.units !== (match as any).units) ||
            ('buyPrice' in draft && draft.buyPrice !== (match as any).buyPrice) ||
            ('investedAmount' in draft &&
              draft.investedAmount !== (match as any).investedAmount) ||
            ('currentPrice' in draft &&
              draft.currentPrice !== (match as any).currentPrice) ||
            ('nav' in draft && draft.nav !== (match as any).nav);
          if (hasChanged) {
            const mergedDoc = clean({
              ...match,
              ...draft,
              updatedAt: t,
            }) as Investment;
            const payload = await encryptDoc(uid, mergedDoc);
            await setDoc(userDoc(uid, 'investments', match.id), payload);
            updatedDocs.push(mergedDoc);
            updated++;
          } else skipped++;
        } else {
          const withMeta = clean({
            ...draft,
            id: createId('inv'),
            createdAt: t,
            updatedAt: t,
            userId: uid,
          }) as Investment;
          const payload = await encryptDoc(uid, withMeta);
          batch.set(userDoc(uid, 'investments', withMeta.id), payload);
          newDocs.push(withMeta);
          added++;
        }
      }
      if (newDocs.length > 0) {
        await batch.commit();
      }
      if (newDocs.length > 0 || updatedDocs.length > 0) {
        markDataDirty(uid, 'investments');
      }
      if (newDocs.length > 0 || updatedDocs.length > 0) {
        set((s) => {
          const updatedIds = new Set(updatedDocs.map((d) => d.id));
          const merged = s.investments.map((inv) =>
            updatedIds.has(inv.id)
              ? updatedDocs.find((d) => d.id === inv.id)!
              : inv,
          );
          return { investments: [...newDocs, ...merged] };
        });
      }
      return { added, updated, skipped };
    },

    updateInvestment: async (id, patch) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().investments.find((x) => x.id === id);
      if (!existing) return;
      const updated = clean({
        ...existing,
        ...patch,
        id,
        updatedAt: now(),
      }) as Investment;
      await saveDoc(uid, 'investments', updated);
      set((s) => ({
        investments: s.investments.map((x) => (x.id === id ? updated : x)),
      }));
    },

    deleteInvestment: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      const removed = get().investments.find((x) => x.id === id);
      await deleteDoc(touchedDoc(uid, 'investments', id));
      set((s) => ({ investments: s.investments.filter((x) => x.id !== id) }));
      if (removed)
        showUndoToast('Investment deleted', () =>
          get().restoreEntity('investments', removed),
        );
    },

    syncBondInterest: async (bondId, indexes) => {
      const uid = get().uid;
      if (!uid) return 0;
      const bond = get().investments.find((x) => x.id === bondId);
      if (!bond || bond.type !== 'bond') return 0;

      const existingIds = new Set(get().cashflows.map((c) => c.id));
      const today = todayISO();
      const t = now();
      const onlyIdx = indexes ? new Set(indexes) : null;

      const newCF: CashflowEntry[] = [];
      for (const row of generateBondSchedule(bond)) {
        if (row.interest <= 0) continue; // nothing to post
        if (row.date > today) continue; // only money actually received
        if (onlyIdx && !onlyIdx.has(row.index)) continue;
        const id = bondCouponId(bond.id, row.index);
        if (existingIds.has(id)) continue; // idempotent — never duplicate
        newCF.push(
          clean({
            id,
            type: 'income' as const,
            date: row.date,
            category: 'Bond Interest',
            amount: row.interest,
            notes: `${bond.name} · interest ${row.date}`,
            accountId: bond.accountId,
            createdAt: t,
            updatedAt: t,
            userId: uid,
          }) as CashflowEntry,
        );
      }
      if (newCF.length === 0) return 0;

      await saveDocsAtomically(
        uid,
        newCF.map((c) => ({ col: 'cashflows', data: c })),
      );
      set((s) => ({
        cashflows: [...newCF, ...s.cashflows].sort((a, b) =>
          safeCompare(b.date, a.date),
        ),
      }));
      return newCF.length;
    },

    settleBondMaturity: async (bondId) => {
      const uid = get().uid;
      if (!uid) return;
      const bond = get().investments.find((x) => x.id === bondId);
      if (!bond || bond.type !== 'bond') return;

      // 1. Post every received coupon's interest as income (idempotent).
      await get().syncBondInterest(bondId);

      // 2. Post the returned principal as a transfer into the linked account.
      const t = now();
      const existingIds = new Set(get().cashflows.map((c) => c.id));
      const maturity = generateBondSchedule(bond).find(
        (r) => r.kind === 'maturity',
      );
      const principal = bond.investedAmount ?? 0;
      const prinId = bondMaturityItemId(bond.id);

      const writes: { col: string; data: object }[] = [];
      let addedPrincipal: CashflowEntry | null = null;
      if (principal > 0 && !existingIds.has(prinId)) {
        addedPrincipal = clean({
          id: prinId,
          type: 'transfer' as const,
          date: maturity?.date ?? todayISO(),
          category: `${bond.name} — Principal Redemption`,
          amount: principal,
          notes: 'Bond matured · principal returned to account',
          toAccountId: bond.accountId,
          createdAt: t,
          updatedAt: t,
          userId: uid,
        }) as CashflowEntry;
        writes.push({ col: 'cashflows', data: addedPrincipal });
      }

      // 3. Mark the bond realized — kept for history, dropped from live assets.
      const updatedBond = clean({
        ...bond,
        status: 'matured' as const,
        updatedAt: t,
      }) as Investment;
      writes.push({ col: 'investments', data: updatedBond });

      await saveDocsAtomically(uid, writes);

      set((s) => ({
        investments: s.investments.map((x) =>
          x.id === bondId ? updatedBond : x,
        ),
        cashflows: addedPrincipal
          ? [addedPrincipal, ...s.cashflows].sort((a, b) =>
              safeCompare(b.date, a.date),
            )
          : s.cashflows,
      }));
    },

    addSoldTrade: async (trade) => {
      const uid = get().uid;
      if (!uid) return;
      const t = now();
      const profit = trade.sellPrice - trade.buyPrice;
      const profitPct = trade.buyPrice > 0 ? (profit / trade.buyPrice) * 100 : 0;
      const raw = clean({
        ...trade,
        id: createId('sold'),
        profit,
        profitPct,
        userId: uid,
        createdAt: t,
        updatedAt: t,
      }) as SoldTrade;
      await saveDoc(uid, 'soldTrades', raw);

      // ── Auto-create cashflow income entry for sale proceeds ──────────────
      const sellCashflow = clean({
        type: 'income' as const,
        date: trade.soldDate,
        category: `Investment Sale — ${trade.investmentName ?? 'Asset'}`,
        amount: trade.sellPrice * (trade.quantity ?? 1),
        notes: `Sold ${trade.investmentName ?? 'investment'}. Profit: ₹${Math.round(profit * (trade.quantity ?? 1)).toLocaleString('en-IN')}`,
        id: createId('cf'),
        createdAt: t,
        updatedAt: t,
        userId: uid,
      }) as CashflowEntry;
      await saveDoc(uid, 'cashflows', sellCashflow);

      set((s) => ({
        soldTrades: [raw, ...s.soldTrades].sort((a, b) =>
          safeCompare(b.soldDate, a.soldDate),
        ),
        cashflows: [sellCashflow, ...s.cashflows].sort((a, b) =>
          safeCompare(b.date, a.date),
        ),
      }));
    },

    updateSoldTrade: async (id, patch) => {
      const uid = get().uid;
      if (!uid) return;
      const existing = get().soldTrades.find((x) => x.id === id);
      if (!existing) return;
      const merged = { ...existing, ...patch, id, updatedAt: now() };
      const profit = merged.sellPrice - merged.buyPrice;
      const profitPct =
        merged.buyPrice > 0 ? (profit / merged.buyPrice) * 100 : 0;
      const updated = clean({ ...merged, profit, profitPct }) as SoldTrade;
      await saveDoc(uid, 'soldTrades', updated);
      set((s) => ({
        soldTrades: s.soldTrades.map((x) => (x.id === id ? updated : x)),
      }));
    },

    deleteSoldTrade: async (id) => {
      const uid = get().uid;
      if (!uid) return;
      await deleteDoc(touchedDoc(uid, 'soldTrades', id));
      set((s) => ({ soldTrades: s.soldTrades.filter((x) => x.id !== id) }));
    },
  };
};
