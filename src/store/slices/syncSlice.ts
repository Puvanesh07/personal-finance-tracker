// src/store/slices/syncSlice.ts
//
// Core session + data-synchronisation slice: identity/ready flags, the phased
// hydrate, the single settings-document live-sync listener, change-stamp
// refresh, one-time migrations, the lazy collection loaders, the cross-module
// undo/restore helper and the reset/wipe actions. Everything here reads other
// collections through `get()` (the composed store), so it stays agnostic of
// which slice owns which field.
import type { StateCreator } from 'zustand';
import {
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore';

import { decryptDoc, type FirestoreDoc } from '../../services/encryptionService';
import { todayISO } from '../../utils/dateUtils';
import { policyStatusOf } from '../../utils/financialProfile';
import { advanceToCurrentOccurrence } from '../../utils/paymentTracker';
import { IN_HAND_CASH_ID } from '../../utils/calculations';
import {
  readDataStamps,
  resetDataVersions,
  staleCollections,
  subscribeDataVersions,
  versionsFromSettings,
} from '../../utils/dataVersion';
import {
  fetchSub,
  settingsDocRef,
  touchedDoc,
  userCol,
  db,
} from '../portfolioPersistence';
import {
  DEFAULT_ALLOCATION_TARGETS,
  DEFAULT_ESSENTIALS,
  DEFAULT_NOTION,
  type SettingsRecord,
} from '../portfolioSettings';
import type {
  Account,
  CashflowEntry,
  Credential,
  Goal,
  GoalContribution,
  InsurancePayment,
  InsurancePolicy,
  Investment,
  Liability,
  NetWorthSnapshot,
  PendingPayment,
  InsightSnapshot,
  SoldTrade,
  TrackedPayment,
  SipPlan,
} from '../../types/investmentTypes';
import {
  clean,
  cashflowDelta,
  makePersistence,
  now,
  reloadCollectionPatch,
  safeCompare,
  saveSettings,
  round2,
  settingsPatch,
  goalTransferCashflow,
  SCHEMA_VERSION,
} from '../shared';
import type { PortfolioState } from '../types';

// ── Live sync handles (one settings-document listener for the signed-in tab) ─
let liveUnsub: (() => void) | null = null;
let liveUid: string | null = null;
let liveTimer: ReturnType<typeof setTimeout> | null = null;

export type SyncSlice = Pick<
  PortfolioState,
  | 'uid'
  | 'ready'
  | 'encryptionEnabled'
  | 'snapshots'
  | '_lastSnapshotDate'
  | '_goalContributionsLoaded'
  | '_insurancePaymentsLoaded'
  | '_pendingPaymentsLoaded'
  | '_credentialsLoaded'
  | '_dataVersions'
  | '_liveStamps'
  | 'lastHydrateAt'
  | '_schemaVersion'
  | 'loadGoalContributions'
  | 'loadInsurancePayments'
  | 'loadPendingPayments'
  | 'loadCredentials'
  | 'hydrate'
  | 'runMigrations'
  | 'backfillInsuranceBills'
  | 'backfillGoalTransfers'
  | 'refreshIfStale'
  | 'startLiveSync'
  | 'stopLiveSync'
  | 'reconcileAccountBalances'
  | 'cleanupLegacyBondCashflows'
  | 'catchUpRecurringSeries'
  | 'restoreEntity'
  | 'clearAllData'
  | 'resetSession'
>;

export const createSyncSlice: StateCreator<PortfolioState, [], [], SyncSlice> = (
  set,
  get,
) => {
  const { saveDoc, saveDocsAtomically } = makePersistence(get);

  return {
    uid: null,
    ready: false,
    encryptionEnabled: true, // default ON; updated from settings on hydrate
    snapshots: [],
    _lastSnapshotDate: null,
    _goalContributionsLoaded: false,
    _insurancePaymentsLoaded: false,
    _pendingPaymentsLoaded: false,
    _credentialsLoaded: false,
    _dataVersions: {},
    _liveStamps: {},
    lastHydrateAt: 0,
    _schemaVersion: 0,

    loadGoalContributions: async () => {
      const { uid, _goalContributionsLoaded } = get();
      if (!uid || _goalContributionsLoaded) return;
      const items = await fetchSub<GoalContribution>(uid, 'goalContributions');
      set({ goalContributions: items.sort((a, b) => safeCompare(b.date, a.date)), _goalContributionsLoaded: true });
    },
    loadInsurancePayments: async () => {
      const { uid, _insurancePaymentsLoaded } = get();
      if (!uid || _insurancePaymentsLoaded) return;
      const items = await fetchSub<InsurancePayment>(uid, 'insurancePayments');
      set({ insurancePayments: items.sort((a, b) => safeCompare(b.paidAt, a.paidAt)), _insurancePaymentsLoaded: true });
    },
    loadPendingPayments: async () => {
      const { uid, _pendingPaymentsLoaded } = get();
      if (!uid || _pendingPaymentsLoaded) return;
      const items = await fetchSub<PendingPayment>(uid, 'pendingPayments');
      set({ pendingPayments: items.sort((a, b) => safeCompare(a.expectedPaymentDate, b.expectedPaymentDate)), _pendingPaymentsLoaded: true });
    },
    loadCredentials: async () => {
      const { uid, _credentialsLoaded } = get();
      if (!uid || _credentialsLoaded) return;
      const items = await fetchSub<Credential>(uid, 'credentials');
      set({ credentials: items.sort((a, b) => safeCompare(b.updatedAt, a.updatedAt)), _credentialsLoaded: true });
    },

    hydrate: async (uid, opts) => {
      const { uid: currentUid, ready } = get();
      if (!opts?.force && currentUid === uid && ready) {
        return { documents: 0, collections: 0 };
      }

      set({ uid });
      try {
        // Phase 1: dashboard-critical only — show UI as soon as this completes.
        const [
          investments,
          liabilities,
          cashflows,
          goals,
          accounts,
          pendingPayments,
          settingsSnap,
        ] = await Promise.all([
          fetchSub<Investment>(uid, 'investments'),
          fetchSub<Liability>(uid, 'liabilities'),
          fetchSub<CashflowEntry>(uid, 'cashflows'),
          fetchSub<Goal>(uid, 'goals'),
          fetchSub<Account>(uid, 'accounts'),
          fetchSub<PendingPayment>(uid, 'pendingPayments'),
          getDoc(settingsDocRef(uid)),
        ]);

        const settings: SettingsRecord = settingsSnap.exists()
          ? (settingsSnap.data() as SettingsRecord)
          : { notion: DEFAULT_NOTION, essentials: DEFAULT_ESSENTIALS };

        // Change stamps as of right now — refreshIfStale() compares against these.
        const loadedVersions = versionsFromSettings(
          settingsSnap.data() as Record<string, unknown> | undefined,
        );

        set({
          ready: true,
          ...settingsPatch(settings),
          investments: investments.sort((a, b) =>
            safeCompare(b.updatedAt, a.updatedAt),
          ),
          liabilities: liabilities.sort((a, b) =>
            safeCompare(b.updatedAt, a.updatedAt),
          ),
          cashflows: cashflows.sort(
            (a, b) =>
              safeCompare(b.date, a.date) ||
              safeCompare(b.updatedAt, a.updatedAt),
          ),
          goals: goals.sort((a, b) => safeCompare(b.updatedAt, a.updatedAt)),
          accounts: accounts.sort((a, b) =>
            safeCompare(b.createdAt, a.createdAt),
          ),
          pendingPayments: pendingPayments.sort((a, b) =>
            safeCompare(a.expectedPaymentDate, b.expectedPaymentDate),
          ),
          _pendingPaymentsLoaded: true,
          _dataVersions: loadedVersions,
          lastHydrateAt: Date.now(),
        });

        // From here on the change stamps are watched, so an edit made on another
        // device (or by a server job) reaches this tab without a reload.
        get().startLiveSync();

        const documentsLoaded =
          investments.length +
          liabilities.length +
          cashflows.length +
          goals.length +
          accounts.length +
          pendingPayments.length;

        const loadPhase1b = async () => {
          const [trackedPayments, soldTrades, insurancePolicies] =
            await Promise.all([
              fetchSub<TrackedPayment>(uid, 'trackedPayments'),
              fetchSub<SoldTrade>(uid, 'soldTrades'),
              fetchSub<InsurancePolicy>(uid, 'insurancePolicies'),
            ]);
          set({
            trackedPayments: trackedPayments.sort((a, b) =>
              safeCompare(a.dueDate, b.dueDate),
            ),
            soldTrades: soldTrades.sort((a, b) =>
              safeCompare(b.soldDate, a.soldDate),
            ),
            insurancePolicies: insurancePolicies.sort((a, b) =>
              safeCompare(a.renewalDate, b.renewalDate),
            ),
          });

          // Legacy one-time fixes, only when this account has an older stamp.
          void get().runMigrations().catch((err) =>
            console.error('[PortfolioStore] migrations failed:', err),
          );

          // Recurring series that ran while the app was closed get re-anchored
          // to their CURRENT occurrence (latest only — missed bills are never
          // minted), so reminders don't pile up stuck in the past (audit I1).
          void get().catchUpRecurringSeries().catch((err) =>
            console.error('[PortfolioStore] recurring catch-up failed:', err),
          );
        };

        const loadPhase2 = async () => {
          const [networthSnapshots, sipPlans] = await Promise.all([
            fetchSub<NetWorthSnapshot>(uid, 'networthSnapshots'),
            fetchSub<SipPlan>(uid, 'sipPlans'),
          ]);

          // Only fetch the single latest insight — no need for the full collection
          const latestInsightSnap = await getDocs(
            query(userCol(uid, 'insights'), orderBy('createdAt', 'desc'), limit(1)),
          );
          const latestInsight = latestInsightSnap.empty
            ? null
            : await decryptDoc<InsightSnapshot>(uid, latestInsightSnap.docs[0].data() as FirestoreDoc)
                .then((d) => d)
                .catch(() => null);

          set({
            networthSnapshots: networthSnapshots.sort((a, b) =>
              safeCompare(b.createdAt, a.createdAt),
            ),
            latestInsight,
            sipPlans: sipPlans.sort((a, b) =>
              safeCompare(a.createdAt, b.createdAt),
            ),
          });
        };

        if (opts?.force) {
          // Import / restore: wait until every collection is in memory including lazy ones
          await Promise.all([
            loadPhase1b().catch((err) =>
              console.error('[PortfolioStore] phase 1b hydrate failed:', err),
            ),
            loadPhase2().catch((err) =>
              console.error('[PortfolioStore] secondary hydrate failed:', err),
            ),
          ]);
          // Force-load lazy collections too so restored data is immediately visible
          await Promise.all([
            get().loadGoalContributions().catch(() => {}),
            get().loadInsurancePayments().catch(() => {}),
            get().loadPendingPayments().catch(() => {}),
            get().loadCredentials().catch(() => {}),
          ]);
          return { documents: documentsLoaded, collections: 6 };
        } else {
          // Phase 1b: other dashboard widgets — background
          void loadPhase1b().catch((err) =>
            console.error('[PortfolioStore] phase 1b hydrate failed:', err),
          );

          // Phase 2: secondary collections — load in background without blocking UI
          void loadPhase2().catch((err) =>
            console.error('[PortfolioStore] secondary hydrate failed:', err),
          );
        }

        return { documents: documentsLoaded, collections: 6 };
      } catch (err) {
        console.error('[PortfolioStore] hydrate failed:', err);
        set({ ready: true });
        return { documents: 0, collections: 0 };
      }
    },

    runMigrations: async () => {
      const uid = get().uid;
      if (!uid) return;
      const from = Number(get()._schemaVersion ?? 0);
      if (from >= SCHEMA_VERSION) return;

      // Migration 1: drop bond interest/maturity entries an old build auto-posted.
      if (from < 1) await get().cleanupLegacyBondCashflows();
      // Migration 2: give insurance policies saved before the bill sync their
      // matching pending bill. Kept idempotent so a half-finished run is safe.
      if (from < 2) await get().backfillInsuranceBills();
      // Migration 3: (re)create any missing derived goal transfer for
      // contributions that move money between two tracked accounts. Additive
      // only — never edits or deletes a user's existing records.
      if (from < 3) await get().backfillGoalTransfers();

      await saveSettings(uid, { schemaVersion: SCHEMA_VERSION });
      set({ _schemaVersion: SCHEMA_VERSION });
    },

    backfillInsuranceBills: async () => {
      const uid = get().uid;
      if (!uid) return;
      const { insurancePolicies, trackedPayments } = get();
      const today = todayISO();
      for (const pol of insurancePolicies) {
        if (!pol.renewalDate || !(pol.premiumAmount > 0)) continue;
        // Lapsed policies are left alone so we never revive a cancelled policy or
        // raise a phantom "overdue" bill.
        if (policyStatusOf(pol.renewalDate, today) === 'expired') continue;
        const hasPending = trackedPayments.some(
          (p) => p.insurancePolicyId === pol.id && p.status === 'pending',
        );
        if (hasPending) continue;
        await get().syncInsuranceBill(uid, pol);
      }
    },

    backfillGoalTransfers: async () => {
      const uid = get().uid;
      if (!uid) return;
      // Contributions are lazy-loaded, so pull them in before scanning.
      await get().loadGoalContributions();
      const { goalContributions, cashflows } = get();
      const existingIds = new Set(cashflows.map((c) => c.id));
      const missing: CashflowEntry[] = [];
      for (const gc of goalContributions) {
        // Only contributions that move money between two tracked accounts get a
        // transfer. Legacy rows (no accounts) intentionally stay untouched —
        // they never changed any balance, so fabricating one here would be wrong.
        if (!gc.accountId || !gc.toAccountId) continue;
        const cfId = `cf_goal_${gc.id}`;
        if (existingIds.has(cfId)) continue;
        missing.push(goalTransferCashflow(uid, gc));
      }
      if (missing.length === 0) return;
      // Additive only: write the missing derived transfers atomically, never
      // modifying or deleting any existing document.
      await saveDocsAtomically(
        uid,
        missing.map((c) => ({ col: 'cashflows', data: c })),
      );
      set((s) => ({
        cashflows: [...missing, ...s.cashflows].sort((a, b) =>
          safeCompare(b.date, a.date),
        ),
      }));
    },

    refreshIfStale: async (stamps) => {
      const uid = get().uid;
      if (!uid || !get().ready) return 0;

      const current = stamps ?? (await readDataStamps(uid));
      // Flatten for `_dataVersions`; collections written by *this* tab are
      // already up to date in memory, so they never appear in `changed`.
      const loaded: Record<string, number> = {};
      for (const [col, stamp] of Object.entries(current)) loaded[col] = stamp.ms;

      const changed = staleCollections(get()._dataVersions, current);
      if (!changed.length) {
        set({ _dataVersions: loaded });
        return 0;
      }

      let documents = 0;
      for (const col of changed) {
        if (col === 'settings') {
          // One document, so this is never expensive — and it is where the
          // category lists, Notion config and schema version live.
          const snap = await getDoc(settingsDocRef(uid));
          if (snap.exists()) {
            const settings = snap.data() as SettingsRecord;
            set(settingsPatch(settings));
            if (Number(settings.schemaVersion ?? 0) > get()._schemaVersion) {
              void get().runMigrations().catch(() => {});
            }
          }
          continue;
        }
        if (col === 'insights') {
          // Only the latest snapshot is ever displayed, so only fetch that one.
          const snap = await getDocs(
            query(userCol(uid, 'insights'), orderBy('createdAt', 'desc'), limit(1)),
          );
          const latestInsight = snap.empty
            ? null
            : await decryptDoc<InsightSnapshot>(
                uid,
                snap.docs[0].data() as FirestoreDoc,
              ).catch(() => null);
          set({ latestInsight });
          documents += snap.empty ? 0 : 1;
          continue;
        }
        const res = await reloadCollectionPatch(uid, col, get());
        if (!res) continue;
        set(res.patch);
        documents += res.documents;
      }
      set({ _dataVersions: loaded, lastHydrateAt: Date.now() });
      return documents;
    },

    startLiveSync: () => {
      const uid = get().uid;
      if (!uid || liveUid === uid) return;
      liveUnsub?.();
      liveUnsub = null;
      if (liveTimer) {
        clearTimeout(liveTimer);
        liveTimer = null;
      }
      liveUid = uid;

      liveUnsub = subscribeDataVersions(uid, (stamps) => {
        set({ _liveStamps: stamps });
        if (!staleCollections(get()._dataVersions, stamps).length) return;
        // Several collections can move in one server-side job; reload once.
        if (liveTimer) return;
        liveTimer = setTimeout(() => {
          liveTimer = null;
          void get().refreshIfStale(get()._liveStamps).catch(() => {});
        }, 800);
      });
    },

    stopLiveSync: () => {
      liveUnsub?.();
      liveUnsub = null;
      liveUid = null;
      if (liveTimer) {
        clearTimeout(liveTimer);
        liveTimer = null;
      }
    },

    reconcileAccountBalances: async () => {
      const uid = get().uid;
      if (!uid) return { changed: 0, legacy: 0 };
      const { accounts, cashflows } = get();

      // Balance per account that an old build corrupted: it added every cashflow
      // delta straight into `balance` on save, while the live figure (opening
      // balance ± linked cashflows) adds them again. Only repair a balance whose
      // drift is fully explained by those writes — anything else was edited by
      // hand and must stay untouched.
      const linkedDelta = (acc: Account) =>
        cashflows
          .filter(
            (cf) =>
              cf.accountId === acc.id ||
              (cf.type === 'transfer' && cf.toAccountId === acc.id),
          )
          .filter((cf) => cf.date >= (acc.openingBalanceDate ?? '1900-01-01'))
          .reduce(
            (sum, cf) =>
              sum +
              (cf.type === 'transfer' && cf.toAccountId === acc.id
                ? cf.amount
                : cashflowDelta(cf)),
            0,
          );

      let changed = 0;
      let legacy = 0;
      const repairs = new Map<string, Account>();
      for (const acc of accounts) {
        // Cash in Hand is re-anchored on every edit by setInHandAmount, so its
        // stored balance is deliberately different from the opening balance.
        if (acc.id === IN_HAND_CASH_ID) continue;

        const stored = round2(acc.balance ?? 0);
        const delta = round2(linkedDelta(acc));

        if (acc.openingBalance !== undefined) {
          const expected = round2(acc.openingBalance);
          if (stored === expected) continue;
          if (round2(expected + delta) !== stored) {
            legacy++;
            continue;
          }
          const next = clean({
            ...acc,
            balance: expected,
            updatedAt: now(),
          }) as Account;
          await saveDoc(uid, 'accounts', next);
          repairs.set(acc.id, next);
          changed++;
          continue;
        }

        // No opening balance recorded: the stored field *is* the anchor, so the
        // cashflows folded into it have to come back out.
        if (delta === 0) continue;
        const repaired = round2(stored - delta);
        const next = clean({
          ...acc,
          balance: repaired,
          openingBalance: repaired,
          openingBalanceDate: acc.openingBalanceDate ?? todayISO(),
          updatedAt: now(),
        }) as Account;
        await saveDoc(uid, 'accounts', next);
        repairs.set(acc.id, next);
        legacy++;
      }

      set((s) => ({
        accounts: s.accounts.map((a) => repairs.get(a.id) ?? a),
      }));
      return { changed, legacy };
    },

    cleanupLegacyBondCashflows: async () => {
      const uid = get().uid;
      if (!uid) return;

      // Only the deterministic ids this feature ever wrote — never user entries.
      const legacy = get().cashflows.filter(
        (c) => c.id.startsWith('cf_bondint_') || c.id.startsWith('cf_bondmat_'),
      );
      if (legacy.length === 0) return;

      const t = now();
      const legacyIds = new Set(legacy.map((c) => c.id));

      // Reverse the balance credit each legacy entry applied to its account.
      const deltas = new Map<string, number>();
      for (const cf of legacy) {
        if (!cf.accountId) continue;
        deltas.set(
          cf.accountId,
          (deltas.get(cf.accountId) ?? 0) - (cf.amount ?? 0),
        );
      }

      // Delete the auto-posted entries from Firestore.
      await Promise.all(
        legacy.map((cf) =>
          deleteDoc(touchedDoc(uid, 'cashflows', cf.id)).catch((err) =>
            console.error(
              '[PortfolioStore] legacy bond cashflow delete failed:',
              err,
            ),
          ),
        ),
      );

      // Persist the reversed account balances.
      const touchedAccounts = new Map<string, Account>();
      for (const [accId, delta] of deltas) {
        const base = get().accounts.find((a) => a.id === accId);
        if (!base) continue;
        const next = clean({
          ...base,
          balance: Math.round(((base.balance ?? 0) + delta) * 100) / 100,
          updatedAt: t,
        }) as Account;
        touchedAccounts.set(accId, next);
        await saveDoc(uid, 'accounts', next);
      }

      set((s) => ({
        cashflows: s.cashflows.filter((c) => !legacyIds.has(c.id)),
        accounts: s.accounts.map((a) => touchedAccounts.get(a.id) ?? a),
      }));
    },

    catchUpRecurringSeries: async () => {
      const uid = get().uid;
      if (!uid) return;
      const today = todayISO();
      const overdue = get().trackedPayments.filter(
        (p) =>
          p.status === 'pending' &&
          p.recurrence !== 'none' &&
          p.dueDate < today,
      );
      if (overdue.length === 0) return;
      const advanced = new Map<string, TrackedPayment>();
      for (const p of overdue) {
        const next = advanceToCurrentOccurrence(p, today);
        if (!next) continue; // within grace / series ended → stays a real overdue bill
        const updated = clean({
          ...p,
          ...next,
          updatedAt: now(),
        }) as TrackedPayment;
        await saveDoc(uid, 'trackedPayments', updated);
        advanced.set(p.id, updated);
      }
      if (advanced.size === 0) return;
      set((s) => ({
        trackedPayments: s.trackedPayments
          .map((x) => advanced.get(x.id) ?? x)
          .sort((a, b) => safeCompare(a.dueDate, b.dueDate)),
      }));
    },

    restoreEntity: async (col, entity) => {
      const uid = get().uid;
      if (!uid) return;
      await saveDoc(uid, col, entity as never);
      set((s) => {
        const e = entity as { id: string };
        switch (col) {
          case 'investments':
            return s.investments.some((x) => x.id === e.id)
              ? {}
              : { investments: [entity as never, ...s.investments] };
          case 'cashflows':
            return s.cashflows.some((x) => x.id === e.id)
              ? {}
              : {
                  cashflows: [entity as never, ...s.cashflows].sort((a, b) =>
                    safeCompare(b.date, a.date),
                  ),
                };
          case 'liabilities':
            return s.liabilities.some((x) => x.id === e.id)
              ? {}
              : { liabilities: [entity as never, ...s.liabilities] };
          case 'accounts':
            return s.accounts.some((x) => x.id === e.id)
              ? {}
              : { accounts: [entity as never, ...s.accounts] };
          case 'goals':
            return s.goals.some((x) => x.id === e.id)
              ? {}
              : { goals: [entity as never, ...s.goals] };
          case 'trackedPayments':
            return s.trackedPayments.some((x) => x.id === e.id)
              ? {}
              : { trackedPayments: [entity as never, ...s.trackedPayments] };
          default:
            return {};
        }
      });
    },

    clearAllData: async () => {
      const uid = get().uid;
      if (!uid) return;

      const subCollections = [
        'investments',
        'liabilities',
        'pendingPayments',
        'trackedPayments',
        'cashflows',
        'goals',
        'goalContributions',
        'credentials',
        'snapshots',
        'networthSnapshots',
        'insights',
        'accounts',
        'soldTrades',
        'insurancePolicies',
        'insurancePayments',
        'sipPlans',
        'notificationJobs',
      ];

      try {
        for (const colName of subCollections) {
          const snap = await getDocs(userCol(uid, colName));
          if (snap.empty) continue;
          const refs = snap.docs.map((d) => d.ref);
          for (let i = 0; i < refs.length; i += 499) {
            const batch = writeBatch(db);
            refs.slice(i, i + 499).forEach((ref) => batch.delete(ref));
            await batch.commit();
          }
        }

        const b = writeBatch(db);
        b.delete(settingsDocRef(uid));
        await b.commit();

        set({
          investments: [],
          snapshots: [],
          liabilities: [],
          pendingPayments: [],
          trackedPayments: [],
          cashflows: [],
          goals: [],
          goalContributions: [],
          credentials: [],
          networthSnapshots: [],
          latestInsight: null,
          notion: { enabled: false },
          essentials: {},
          accounts: [],
          soldTrades: [],
          insurancePolicies: [],
          insurancePayments: [],
          sipPlans: [],
          _lastSnapshotDate: null,
        });
      } catch (error) {
        console.error('Cloud wipe failed:', error);
        throw error;
      }
    },

    resetSession: () => {
      // Forget any stamp write still queued for the previous account, and its
      // change stamps, so a re-login refetches instead of trusting stale marks.
      const previousUid = get().uid;
      if (previousUid) resetDataVersions(previousUid);
      get().stopLiveSync();
      set({
        uid: null,
        ready: false,
        investments: [],
        snapshots: [],
        liabilities: [],
        pendingPayments: [],
        trackedPayments: [],
        cashflows: [],
        goals: [],
        goalContributions: [],
        credentials: [],
        networthSnapshots: [],
        latestInsight: null,
        notion: DEFAULT_NOTION,
        essentials: DEFAULT_ESSENTIALS,
        allocationTargets: DEFAULT_ALLOCATION_TARGETS,
        accounts: [],
        soldTrades: [],
        insurancePolicies: [],
        insurancePayments: [],
        sipPlans: [],
        _lastSnapshotDate: null,
        _goalContributionsLoaded: false,
        _insurancePaymentsLoaded: false,
        _pendingPaymentsLoaded: false,
        _credentialsLoaded: false,
        _dataVersions: {},
        _liveStamps: {},
        lastHydrateAt: 0,
        _schemaVersion: 0,
      });
    },
  };
};
