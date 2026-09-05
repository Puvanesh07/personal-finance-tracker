// src/store/notificationStore.ts
// Minimal read/dismissed state for derived notifications — no notification objects stored.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotifType =
  | 'welcome'
  | 'system'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'strategy_tip'
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
  | 'insurance_renewal'
  | 'insurance_expired'
  | 'liability_due'
  | 'liability_emi'
  | 'liability_overdue'
  | 'goal_achieved'
  | 'goal_progress'
  | 'goal_contribution_reminder'
  | 'investment_alert'
  | 'investment_matured'
  | 'investment_maturity_upcoming'
  | 'pending_payment_due'
  | 'pending_payment_overdue'
  | 'payment_tracker_due'
  | 'payment_tracker_overdue'
  | 'sip_reminder'
  | 'sip_allocation_mismatch'
  | 'credential_stale'
  | 'emergency_fund_low'
  | 'networth_drop';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  dueDate?: string;
  expiresAt?: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  updatedAt: string;
  entityId?: string;
  actionLabel?: string;
  actionPath?: string;
  periodKey?: string;
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

interface NotificationState {
  uid: string | null;
  readIds: string[];
  dismissedIds: string[];
  /** ISO timestamp — used for Firestore subscription notifications (which have real createdAt) */
  clearedAt: string | null;
  /** IDs of derived notifications that were visible when "Clear All" was pressed */
  clearedDerivedIds: string[];

  setScope: (uid: string) => void;
  clearScope: () => void;

  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  dismiss: (id: string) => void;
  /** Pass all currently visible notification IDs so they can be hidden */
  clearAll: (currentIds?: string[]) => void;
  setReadState: (readIds: string[], dismissedIds: string[]) => void;

  unreadCount: (total: number) => number;
  activeCount: (total: number) => number;
}

const STORAGE_KEY = 'fintrackly-notifications';

type PersistedShape = {
  uid: string | null;
  readIds: string[];
  dismissedIds: string[];
  clearedAt: string | null;
  clearedDerivedIds: string[];
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      uid: null,
      readIds: [],
      dismissedIds: [],
      clearedAt: null,
      clearedDerivedIds: [],

      setScope: (uid: string) => {
        const current = get();
        if (current.uid === uid) return;
        set({ uid, readIds: [], dismissedIds: [], clearedAt: null, clearedDerivedIds: [] });
      },

      clearScope: () => {
        set({ uid: null, readIds: [], dismissedIds: [], clearedAt: null, clearedDerivedIds: [] });
      },

      markRead: (id: string) =>
        set((s) => ({
          readIds: s.readIds.includes(id) ? s.readIds : [...s.readIds, id],
        })),

      markAllRead: (ids: string[]) =>
        set((s) => ({
          readIds: Array.from(new Set([...s.readIds, ...ids])),
        })),

      dismiss: (id: string) =>
        set((s) => ({
          dismissedIds: s.dismissedIds.includes(id) ? s.dismissedIds : [...s.dismissedIds, id],
          readIds: s.readIds.includes(id) ? s.readIds : [...s.readIds, id],
        })),

      // Clear All: record the IDs of every currently-visible notification.
      // Derived notifications use stable IDs (sourceType:sourceId:date), so storing
      // them as a set reliably hides them. New notifications (new IDs) still appear.
      // Also record clearedAt timestamp for Firestore subscription notifications.
      clearAll: (currentIds: string[] = []) => set({
        readIds: [],
        dismissedIds: [],
        clearedAt: new Date().toISOString(),
        clearedDerivedIds: currentIds,
      }),

      setReadState: (readIds: string[], dismissedIds: string[]) =>
        set({ readIds, dismissedIds }),

      unreadCount: (_total: number) => get().readIds.length,
      activeCount: (_total: number) => get().dismissedIds.length,
    }),
    {
      name: STORAGE_KEY,
      version: 5,
      partialize: (state: NotificationState) =>
        ({
          uid: state.uid,
          readIds: state.readIds,
          dismissedIds: state.dismissedIds,
          clearedAt: state.clearedAt,
          clearedDerivedIds: state.clearedDerivedIds,
        }) as unknown as NotificationState,
      storage: {
        getItem: (name): any => {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw) as PersistedShape | any;
            if (parsed && typeof parsed === 'object') {
              return {
                uid: parsed.uid ?? null,
                readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
                dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
                clearedAt: typeof parsed.clearedAt === 'string' ? parsed.clearedAt : null,
                clearedDerivedIds: Array.isArray(parsed.clearedDerivedIds) ? parsed.clearedDerivedIds : [],
              };
            }
            return null;
          } catch {
            return null;
          }
        },
        setItem: (name, value: any) => {
          const live = useNotificationStore.getState();
          const uid = value?.uid || live.uid || 'orphan';
          const readIds = Array.isArray(value?.readIds) ? value.readIds : live.readIds;
          const dismissedIds = Array.isArray(value?.dismissedIds) ? value.dismissedIds : live.dismissedIds;
          const clearedAt = typeof value?.clearedAt === 'string' ? value.clearedAt : live.clearedAt;
          const clearedDerivedIds = Array.isArray(value?.clearedDerivedIds) ? value.clearedDerivedIds : live.clearedDerivedIds;
          const payload = JSON.stringify({ uid, readIds, dismissedIds, clearedAt, clearedDerivedIds });
          localStorage.setItem(name, payload);
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);

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
  sip_reminder: 'bg-cyan-500/10 border-cyan-500/20',
  sip_allocation_mismatch: 'bg-violet-500/10 border-violet-500/20',
  credential_stale: 'bg-slate-500/10 border-slate-500/30',
  emergency_fund_low: 'bg-amber-500/15 border-amber-500/30',
  networth_drop: 'bg-rose-500/10 border-rose-500/20',
};
