// src/components/notifications/NotificationBell.tsx
// Top-bar bell icon with dropdown notification panel

import { useRef, useState, useEffect } from 'react';
import { FiBell, FiX, FiCheck, FiCheckCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore, type AppNotification } from '../../store/notificationStore';
import { useSubscription } from '../../context/SubscriptionContext';
import { markAllNotificationsRead, markNotificationRead } from '../../services/subscriptionService';
import { auth } from '../../services/firebase';
import { format, formatDistanceToNow } from 'date-fns';

const TYPE_ICONS: Record<string, string> = {
  insurance_renewal: '🛡️',
  liability_due: '💳',
  goal_achieved: '🎯',
  goal_progress: '📊',
  investment_alert: '📈',
  system: '🔔',
  strategy_tip: '💡',
  investment_matured: '🎉',
  investment_maturity_upcoming: '⏰',
  pending_payment_due: '💰',
  payment_tracker_due: '🔔',
  warning: '⚠️',
  error: '❌',
  success: '✅',
  info: 'ℹ️',
};

const TYPE_COLORS: Record<string, string> = {
  insurance_renewal: 'bg-blue-500/10 border-blue-500/20',
  liability_due: 'bg-rose-500/10 border-rose-500/20',
  goal_achieved: 'bg-emerald-500/10 border-emerald-500/20',
  goal_progress: 'bg-teal-500/10 border-teal-500/20',
  investment_alert: 'bg-amber-500/10 border-amber-500/20',
  system: 'bg-slate-500/5 dark:bg-slate-500/10 border-slate-400/30 dark:border-slate-500/20',
  strategy_tip: 'bg-violet-500/10 border-violet-500/20',
  investment_matured: 'bg-emerald-500/10 border-emerald-500/20',
  investment_maturity_upcoming: 'bg-amber-500/10 border-amber-500/20',
  pending_payment_due: 'bg-indigo-500/10 border-indigo-500/20',
  payment_tracker_due: 'bg-sky-500/10 border-sky-500/20',
  warning: 'bg-amber-500/10 border-amber-500/20',
  error: 'bg-rose-500/10 border-rose-500/20',
  success: 'bg-emerald-500/10 border-emerald-500/20',
  info: 'bg-blue-500/10 border-blue-500/20',
};

function NotifCard({ notif, onRead, onDismiss, onAction }: {
  notif: AppNotification;
  onRead: () => void;
  onDismiss: () => void;
  onAction: () => void;
}) {
  return (
    <div
      className={`relative flex gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
        notif.read ? 'opacity-60' : ''
      } ${TYPE_COLORS[notif.type] || 'bg-slate-100/90 dark:bg-slate-800/40 border-slate-300/50 dark:border-slate-700/40'}`}
      onClick={() => { onRead(); if (notif.actionPath) onAction(); }}
    >
      <span className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[notif.type] || '🔔'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-900 dark:text-slate-200 leading-snug">{notif.title}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{notif.message}</p>
        {notif.dueDate && (
          <p className="text-[10px] text-slate-900 dark:text-slate-500 mt-1">
            Due: {format(new Date(notif.dueDate), 'dd MMM yyyy')}
          </p>
        )}
        <p className="text-[10px] text-slate-500 dark:text-slate-600 mt-1">
          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
        </p>
        {notif.actionLabel && !notif.read && (
          <button
            className="mt-2 text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
            onClick={(e) => { e.stopPropagation(); onRead(); onAction(); }}
          >
            {notif.actionLabel} →
          </button>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="shrink-0 text-slate-500 dark:text-slate-600 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-500 dark:text-slate-400 transition-colors h-4 w-4 mt-0.5"
      >
        <FiX className="h-3.5 w-3.5" />
      </button>
      {!notif.read && (
        <span className="absolute top-2.5 right-8 h-1.5 w-1.5 rounded-full bg-emerald-400" />
      )}
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { notifications, markRead, markAllRead, dismiss } = useNotificationStore();
  const { notifications: subscriptionNotifications } = useSubscription();

  const mergedNotifications: AppNotification[] = [
    ...subscriptionNotifications.map((n) => ({
      id: `sub_${n.id}`,
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      actionPath: '/pricing',
      actionLabel: 'Upgrade',
    })),
    ...notifications,
  ]
    // Drop exact duplicates that can appear from overlapping sources
    .filter((n, idx, arr) => {
      const first = arr.findIndex(
        (x) => x.title === n.title && x.message === n.message && x.type === n.type,
      );
      return first === idx;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const count = mergedNotifications.filter((n) => !n.read).length;

  const handleRead = (notif: AppNotification) => {
    if (notif.id.startsWith('sub_')) {
      const uid = auth.currentUser?.uid;
      const subId = notif.id.replace('sub_', '');
      if (uid) void markNotificationRead(uid, subId);
      return;
    }
    markRead(notif.id);
  };

  const handleMarkAllRead = () => {
    markAllRead();
    const uid = auth.currentUser?.uid;
    if (uid) void markAllNotificationsRead(uid);
  };

  const handleDismiss = (notif: AppNotification) => {
    if (notif.id.startsWith('sub_')) return;
    dismiss(notif.id);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const recent = mergedNotifications.slice(0, 20);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center justify-center h-8 w-8 rounded-lg transition-all border ${
          open
            ? 'bg-slate-300 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-white'
            : 'bg-slate-200/80 dark:bg-slate-800/80 border-slate-300/60 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/80 dark:bg-slate-300 dark:bg-slate-700/80'
        }`}
      >
        <FiBell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-[9px] font-black text-white flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl shadow-black/60 z-[200] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FiBell className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-bold text-slate-900 dark:text-slate-800 dark:text-slate-200">Notifications</span>
              {count > 0 && (
                <span className="text-[10px] font-black bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full">
                  {count} new
                </span>
              )}
            </div>
            {count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <FiCheckCircle className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto p-2 space-y-1.5">
            {recent.length === 0 ? (
              <div className="py-10 text-center">
                <FiCheck className="h-8 w-8 text-slate-600 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-900 dark:text-slate-500 font-medium">You're all caught up!</p>
              </div>
            ) : (
              recent.map((n) => (
                <NotifCard
                  key={n.id}
                  notif={n}
                  onRead={() => handleRead(n)}
                  onDismiss={() => handleDismiss(n)}
                  onAction={() => {
                    if (n.actionPath) navigate(n.actionPath);
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-800 p-2">
              <button
                onClick={() => { useNotificationStore.getState().clearAll(); setOpen(false); }}
                className="w-full text-center text-[11px] font-bold text-slate-900 dark:text-slate-500 hover:text-slate-600 dark:text-slate-700 dark:hover:text-slate-600 dark:text-slate-700 dark:text-slate-300 py-1.5 transition-colors"
              >
                Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
