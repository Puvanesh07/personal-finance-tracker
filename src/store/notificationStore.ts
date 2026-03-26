// src/store/notificationStore.ts
// In-app notification system

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotifType =
  | 'insurance_renewal'
  | 'liability_due'
  | 'goal_achieved'
  | 'goal_progress'
  | 'investment_alert'
  | 'system'
  | 'strategy_tip';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  dueDate?: string;
  read: boolean;
  createdAt: string;
  entityId?: string;
  actionLabel?: string;
  actionPath?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  unreadCount: () => number;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: (n) => {
        // Deduplicate by entityId + type within last 24h
        if (n.entityId) {
          const existing = get().notifications.find(
            (x) => x.entityId === n.entityId && x.type === n.type &&
              Date.now() - new Date(x.createdAt).getTime() < 86_400_000
          );
          if (existing) return;
        }
        set((s) => ({
          notifications: [
            { ...n, id: genId(), read: false, createdAt: new Date().toISOString() },
            ...s.notifications,
          ].slice(0, 100), // keep max 100
        }));
      },

      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),

      dismiss: (id) =>
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        })),

      clearAll: () => set({ notifications: [] }),

      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    {
      name: 'fintrackly-notifications',
    }
  )
);
