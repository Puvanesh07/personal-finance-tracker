// src/store/notificationStore.ts
// In-app notification system — user-scoped, reliable, deduplicated

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotifType =
  // ── Onboarding / system ──────────────────────────────────────────────
  | 'welcome'
  | 'system'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'strategy_tip'
  // ── Trial / subscription ─────────────────────────────────────────────
  | 'trial_started'
  | 'trial_ending'
  | 'trial_expired'
  | 'subscription_activated'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'payment_success'
  | 'payment_failed'
  | 'payment_pending'
  // ── Insurance ────────────────────────────────────────────────────────
  | 'insurance_renewal'
  | 'insurance_expired'
  // ── Liabilities ──────────────────────────────────────────────────────
  | 'liability_due'
  | 'liability_emi'
  | 'liability_overdue'
  // ── Goals ────────────────────────────────────────────────────────────
  | 'goal_achieved'
  | 'goal_progress'
  | 'goal_contribution_reminder'
  // ── Investments ──────────────────────────────────────────────────────
  | 'investment_alert'
  | 'investment_matured'
  | 'investment_maturity_upcoming'
  // ── Payments ─────────────────────────────────────────────────────────
  | 'pending_payment_due'
  | 'pending_payment_overdue'
  | 'payment_tracker_due'
  | 'payment_tracker_overdue'
  // ── Lending ──────────────────────────────────────────────────────────
  | 'lending_due'
  | 'lending_overdue'
  // ── SIP ──────────────────────────────────────────────────────────────
  | 'sip_reminder'
  | 'sip_allocation_mismatch'
  // ── Security / misc ──────────────────────────────────────────────────
  | 'credential_stale'
  | 'emergency_fund_low'
  | 'networth_drop';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  dueDate?: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  updatedAt: string;
  entityId?: string;
  actionLabel?: string;
  actionPath?: string;
  /** e.g. month/year key "2026-08" to prevent same-month duplicates */
  periodKey?: string;
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Stable firing record — persisted per-user, per-day, per-(entity+event).
 * Survives page refresh, navigation, StrictMode double-render, and re-login.
 */
export interface FiringRecord {
  /** `${dateStr}:${entityIdOrKey}` */
  id: string;
  firedAt: string;
}

interface NotificationState {
  /** Authenticated uid these notifications belong to. null = not authenticated */
  uid: string | null;
  notifications: AppNotification[];
  /** Persisted dedup records of "already fired" events — stable across refreshes */
  fired: Record<string, FiringRecord>;

  // ── Auth scoping ────────────────────────────────────────────────────────
  /** Switch to a user's bucket; load persisted notifications for them. */
  setScope: (uid: string) => void;
  /** When user logs out, clear in-memory state. */
  clearScope: () => void;

  // ── Notification CRUD ───────────────────────────────────────────────────
  addNotification: (
    n: Omit<
      AppNotification,
      'id' | 'read' | 'dismissed' | 'createdAt' | 'updatedAt'
    >,
  ) => AppNotification | null;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;

  // ── Deduplication ───────────────────────────────────────────────────────
  /**
   * Deterministic "once" guard — persisted so refreshes/nav don't re-fire.
   * @param entityKey Stable key, e.g. `insurance_renewal:pol_123:2026-08-19`
   * @returns true if this is the first call today for this key; false = already fired.
   */
  oncePerDay: (entityKey: string) => boolean;
  /**
   * Once-per-period guard. periodKey can be `YYYY-MM` (monthly), `YYYY` (yearly).
   * Good for SIP reminders (monthly) and annual recaps.
   */
  oncePerPeriod: (entityKey: string, periodKey: string) => boolean;
  /** Reset firing records (for testing / clear scope) */
  _resetFired: () => void;

  // ── Derived ─────────────────────────────────────────────────────────────
  unreadCount: () => number;
  activeCount: () => number;
}

function genId(prefix = 'n') {
  return (
    prefix +
    '_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 8)
  );
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthKey = () => new Date().toISOString().slice(0, 7);

/**
 * Storage layout under `fintrackly-notifications` key (zustand persist).
 *
 * To keep user A's notifications from leaking to user B on the same device,
 * we namespace all data by uid:
 * {
 *   uid: "...",
 *   buckets: {
 *     [uid1]: { notifications, fired },
 *     [uid2]: { notifications, fired },
 *   }
 * }
 *
 * The *active* uid determines which bucket the actions mutate. This keeps
 * notifications for multiple users isolated while using a single localStorage
 * key (simple, no dynamic persist names needed).
 */
type PersistedShape = {
  uid: string | null;
  buckets: Record<
    string,
    { notifications: AppNotification[]; fired: Record<string, FiringRecord> }
  >;
};



const STORAGE_KEY = 'fintrackly-notifications';

function loadBucketFromStorage(uid: string): {
  notifications: AppNotification[];
  fired: Record<string, FiringRecord>;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { notifications: [], fired: {} };
    const parsed = JSON.parse(raw) as PersistedShape;
    if (!parsed || !parsed.buckets) return { notifications: [], fired: {} };
    const bucket = parsed.buckets[uid];
    return bucket
      ? {
          notifications: bucket.notifications ?? [],
          fired: bucket.fired ?? {},
        }
      : { notifications: [], fired: {} };
  } catch {
    return { notifications: [], fired: {} };
  }
}

function cleanupOldNotifications(list: AppNotification[]): AppNotification[] {
  const cutoffMs = Date.now() - 60 * 86_400_000; // 60 days
  return list
    .filter((n) => new Date(n.createdAt).getTime() >= cutoffMs)
    .slice(0, 200);
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      uid: null,
      notifications: [],
      fired: {},

      setScope: (uid: string) => {
        const current = get();
        if (current.uid === uid) return;
        // Load this user's persisted bucket directly from localStorage.
        // zustand onRehydrateStorage only runs once on mount, so we
        // must manually read buckets when switching users.
        const bucket = loadBucketFromStorage(uid);
        set({
          uid,
          notifications: cleanupOldNotifications(bucket.notifications),
          fired: bucket.fired,
        });
      },

      clearScope: () => {
        set({
          uid: null,
          notifications: [],
          fired: {},
        });
      },

      addNotification: (n) => {
        if (!get().uid) return null; // refuse to add until scoped to user

        // Deduplicate: same entityId + periodKey OR same title+message+type in same day
        const { notifications } = get();
        if (n.entityId) {
          const dup = notifications.find(
            (x) =>
              x.entityId === n.entityId &&
              x.type === n.type &&
              (x.periodKey ?? monthKey()) === (n.periodKey ?? monthKey()),
          );
          if (dup) return null;
        }
        // Heuristic dedup for same title+message in last 48h
        const cutoff = Date.now() - 2 * 86_400_000;
        const dupTitle = notifications.find((x) =>
          x.type === n.type &&
          x.title === n.title &&
          x.message === n.message &&
          new Date(x.createdAt).getTime() > cutoff,
        );
        if (dupTitle) return null;

        const now = new Date().toISOString();
        const created: AppNotification = {
          ...n,
          id: genId('notif'),
          read: false,
          dismissed: false,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          notifications: cleanupOldNotifications([created, ...s.notifications]),
        }));
        return created;
      },

      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true, updatedAt: new Date().toISOString() } : n,
          ),
        })),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.read ? n : { ...n, read: true, updatedAt: new Date().toISOString() },
          ),
        })),

      dismiss: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id
              ? { ...n, dismissed: true, read: true, updatedAt: new Date().toISOString() }
              : n,
          ),
        })),

      clearAll: () => set({ notifications: [] }),

      oncePerDay: (entityKey: string) => {
        const key = `${todayStr()}:${entityKey}`;
        const { fired } = get();
        if (fired[key]) return false;
        const rec: FiringRecord = { id: key, firedAt: new Date().toISOString() };
        set((s) => ({ fired: { ...s.fired, [key]: rec } }));
        // GC old firing records to keep storage small (keep last 45 days)
        const cutoffMs = Date.now() - 45 * 86_400_000;
        const cleaned: Record<string, FiringRecord> = {};
        Object.values(get().fired).forEach((r) => {
          if (new Date(r.firedAt).getTime() >= cutoffMs) cleaned[r.id] = r;
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        Object.keys(cleaned).length < Object.keys(get().fired).length &&
          set({ fired: cleaned });
        return true;
      },

      oncePerPeriod: (entityKey: string, periodKey: string) => {
        const key = `PERIOD:${periodKey}:${entityKey}`;
        const { fired } = get();
        if (fired[key]) return false;
        const rec: FiringRecord = { id: key, firedAt: new Date().toISOString() };
        set((s) => ({ fired: { ...s.fired, [key]: rec } }));
        return true;
      },

      _resetFired: () => set({ fired: {} }),

      unreadCount: () =>
        get().notifications.filter((n) => !n.read && !n.dismissed).length,
      activeCount: () =>
        get().notifications.filter((n) => !n.dismissed).length,
    }),
    {
      name: 'fintrackly-notifications',
      version: 2,
      // ── Persist per-user buckets ───────────────────────────────────────────
      // Include full runtime state: uid + notifications + fired.
      // The custom storage.setItem below re-wraps them into buckets layout.
      partialize: (state: NotificationState) =>
        ({
          uid: state.uid,
          notifications: state.notifications,
          fired: state.fired,
        }) as unknown as NotificationState,
      /**
       * Custom storage wrapper — we actually encode the full buckets object
       * by capturing the current state's notifications + fired under its uid.
       */
      storage: {
        getItem: (name): any => {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          try {
            const parsed: PersistedShape | any = JSON.parse(raw);
            // Legacy v1 shape — flat { notifications, fired, uid }
            if (!parsed.buckets && Array.isArray(parsed.notifications)) {
              const legacyUid = parsed.uid || 'legacy';
              const migrated: PersistedShape = {
                uid: legacyUid,
                buckets: {
                  [legacyUid]: {
                    notifications: parsed.notifications ?? [],
                    fired: parsed.fired ?? {},
                  },
                },
              };
              return migrated as any;
            }
            return parsed as any;
          } catch {
            return null;
          }
        },
        setItem: (name, value: any) => {
          // value is the partialized state: { uid, notifications, fired }.
          // But to be robust, always read the actual state via getState()
          // because some zustand versions or edge cases may strip data.
          const live = useNotificationStore.getState();
          const uid: string = value?.uid || live.uid || 'orphan';
          const notifications: AppNotification[] = Array.isArray(value?.notifications)
            ? value.notifications
            : live.notifications;
          const fired: Record<string, FiringRecord> =
            value?.fired && typeof value.fired === 'object'
              ? value.fired
              : live.fired;

          const existingRaw = localStorage.getItem(name);
          let persisted: PersistedShape = {
            uid,
            buckets: {},
          };
          if (existingRaw) {
            try {
              const p = JSON.parse(existingRaw);
              if (p && typeof p === 'object' && p.buckets) persisted = p;
              else if (p && Array.isArray(p.notifications)) {
                // legacy during write — wrap
                persisted = {
                  uid: p.uid || uid,
                  buckets: {
                    [p.uid || uid]: {
                      notifications: p.notifications ?? [],
                      fired: p.fired ?? {},
                    },
                  },
                };
              }
            } catch { /* ignore */ }
          }
          persisted.uid = uid;
          persisted.buckets[uid] = {
            notifications: cleanupOldNotifications(notifications),
            fired,
          };
          localStorage.setItem(name, JSON.stringify(persisted));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        // Zustand will have loaded the PersistedShape via storage.getItem above.
        // But zustand expects NotificationState at runtime.
        // So we convert buckets back to the active uid's data.
        const hydrated = state as unknown as PersistedShape & NotificationState;
        if (!hydrated.buckets) return; // didn't migrate
        const activeUid = hydrated.uid || Object.keys(hydrated.buckets)[0] || null;
        const bucket = activeUid ? hydrated.buckets[activeUid] : null;
        hydrated.uid = activeUid;
        hydrated.notifications = bucket?.notifications ?? [];
        hydrated.fired = bucket?.fired ?? {};
      },
    },
  ),
);

// ── Convenience exports ──────────────────────────────────────────────────────

/** Human-readable category label for each notification type */
export const NOTIF_CATEGORY: Record<NotifType, string> = {
  welcome: 'Welcome',
  system: 'System',
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  error: 'Alert',
  strategy_tip: 'Tip',
  trial_started: 'Subscription',
  trial_ending: 'Subscription',
  trial_expired: 'Subscription',
  subscription_activated: 'Subscription',
  subscription_renewed: 'Subscription',
  subscription_cancelled: 'Subscription',
  subscription_expiring: 'Subscription',
  subscription_expired: 'Subscription',
  payment_success: 'Payment',
  payment_failed: 'Payment',
  payment_pending: 'Payment',
  insurance_renewal: 'Insurance',
  insurance_expired: 'Insurance',
  liability_due: 'Liability',
  liability_emi: 'Liability',
  liability_overdue: 'Liability',
  goal_achieved: 'Goals',
  goal_progress: 'Goals',
  goal_contribution_reminder: 'Goals',
  investment_alert: 'Investment',
  investment_matured: 'Investment',
  investment_maturity_upcoming: 'Investment',
  pending_payment_due: 'Payments',
  pending_payment_overdue: 'Payments',
  payment_tracker_due: 'Payments',
  payment_tracker_overdue: 'Payments',
  lending_due: 'Lending',
  lending_overdue: 'Lending',
  sip_reminder: 'SIP',
  sip_allocation_mismatch: 'SIP',
  credential_stale: 'Security',
  emergency_fund_low: 'Emergency Fund',
  networth_drop: 'Net Worth',
};

export const NOTIF_ICONS: Record<NotifType, string> = {
  welcome: '👋',
  system: '🔔',
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  strategy_tip: '💡',
  trial_started: '🎉',
  trial_ending: '⏳',
  trial_expired: '🔒',
  subscription_activated: '⭐',
  subscription_renewed: '🔄',
  subscription_cancelled: '❌',
  subscription_expiring: '⏰',
  subscription_expired: '🔒',
  payment_success: '💳',
  payment_failed: '❌',
  payment_pending: '⏳',
  insurance_renewal: '🛡️',
  insurance_expired: '🚨',
  liability_due: '💳',
  liability_emi: '💸',
  liability_overdue: '🔴',
  goal_achieved: '🎯',
  goal_progress: '📊',
  goal_contribution_reminder: '💰',
  investment_alert: '📈',
  investment_matured: '🎉',
  investment_maturity_upcoming: '⏰',
  pending_payment_due: '💰',
  pending_payment_overdue: '⚠️',
  payment_tracker_due: '🔔',
  payment_tracker_overdue: '📌',
  lending_due: '🤝',
  lending_overdue: '❗',
  sip_reminder: '📅',
  sip_allocation_mismatch: '🧭',
  credential_stale: '🔐',
  emergency_fund_low: '🛟',
  networth_drop: '📉',
};

export const NOTIF_COLORS: Record<NotifType, string> = {
  welcome: 'bg-emerald-500/10 border-emerald-500/25',
  system: 'bg-slate-500/5 border-slate-400/20',
  info: 'bg-blue-500/10 border-blue-500/20',
  success: 'bg-emerald-500/10 border-emerald-500/20',
  warning: 'bg-amber-500/10 border-amber-500/20',
  error: 'bg-rose-500/10 border-rose-500/20',
  strategy_tip: 'bg-violet-500/10 border-violet-500/20',
  trial_started: 'bg-emerald-500/10 border-emerald-500/25',
  trial_ending: 'bg-amber-500/15 border-amber-500/30',
  trial_expired: 'bg-rose-500/10 border-rose-500/20',
  subscription_activated: 'bg-emerald-500/10 border-emerald-500/20',
  subscription_renewed: 'bg-emerald-500/10 border-emerald-500/20',
  subscription_cancelled: 'bg-rose-500/10 border-rose-500/20',
  subscription_expiring: 'bg-amber-500/10 border-amber-500/20',
  subscription_expired: 'bg-rose-500/15 border-rose-500/30',
  payment_success: 'bg-emerald-500/10 border-emerald-500/20',
  payment_failed: 'bg-rose-500/15 border-rose-500/30',
  payment_pending: 'bg-amber-500/10 border-amber-500/20',
  insurance_renewal: 'bg-blue-500/10 border-blue-500/20',
  insurance_expired: 'bg-rose-500/15 border-rose-500/30',
  liability_due: 'bg-rose-500/10 border-rose-500/20',
  liability_emi: 'bg-sky-500/10 border-sky-500/20',
  liability_overdue: 'bg-rose-600/15 border-rose-600/30',
  goal_achieved: 'bg-emerald-500/10 border-emerald-500/20',
  goal_progress: 'bg-teal-500/10 border-teal-500/20',
  goal_contribution_reminder: 'bg-amber-500/10 border-amber-500/20',
  investment_alert: 'bg-amber-500/10 border-amber-500/20',
  investment_matured: 'bg-emerald-500/10 border-emerald-500/20',
  investment_maturity_upcoming: 'bg-amber-500/10 border-amber-500/20',
  pending_payment_due: 'bg-indigo-500/10 border-indigo-500/20',
  pending_payment_overdue: 'bg-orange-500/10 border-orange-500/30',
  payment_tracker_due: 'bg-sky-500/10 border-sky-500/20',
  payment_tracker_overdue: 'bg-rose-500/10 border-rose-500/30',
  lending_due: 'bg-cyan-500/10 border-cyan-500/20',
  lending_overdue: 'bg-orange-500/15 border-orange-500/30',
  sip_reminder: 'bg-cyan-500/10 border-cyan-500/20',
  sip_allocation_mismatch: 'bg-violet-500/10 border-violet-500/20',
  credential_stale: 'bg-slate-500/10 border-slate-500/30',
  emergency_fund_low: 'bg-amber-500/15 border-amber-500/30',
  networth_drop: 'bg-rose-500/10 border-rose-500/20',
};
