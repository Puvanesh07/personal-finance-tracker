// src/pages/Notifications/NotificationsPage.tsx
// Dedicated notifications page — shows all valid notifications.
// Newest first, clear distinction between read/unread.
// Supports mark as read, dismiss, and clear all.

import { FiBell, FiCheck, FiCheckCircle, FiTrash2, FiX } from 'react-icons/fi';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { NOTIF_CATEGORY, NOTIF_COLORS, NOTIF_ICONS, useNotificationStore } from '../../store/notificationStore';
import { useDerivedNotifications } from '../../hooks/useDerivedNotifications';
import { useSubscription } from '../../context/SubscriptionContext';
import type { AppNotification } from '../../store/notificationStore';
import { FeatureInfo } from '../../components/ui/FeatureInfo';

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true });
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'dd MMM, h:mm a');
}

function EmptyState() {
  return (
    <div className='flex flex-col items-center justify-center gap-4 py-20 px-6 text-center'>
      <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-2xl'>
        <FiBell className='h-7 w-7 text-emerald-500' aria-hidden='true' />
      </div>
      <div>
        <p className='text-base font-bold text-slate-800 dark:text-slate-200'>
          No notifications yet
        </p>
        <p className='mt-1 text-sm text-slate-400 dark:text-slate-500 leading-relaxed max-w-[280px] mx-auto'>
          We'll let you know when something needs your attention.
        </p>
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const derivedNotifications = useDerivedNotifications();
  const { notifications: subscriptionNotifications } = useSubscription();
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const clearedAt = useNotificationStore((s) => s.clearedAt);

  // Merge derived + Firestore subscription notifications (same logic as Bell)
  const derivedTypeSet = new Set(derivedNotifications.map((n) => n.type));
  const firestoreNotifs: AppNotification[] = subscriptionNotifications
    .map((n): AppNotification => ({
      id: `sub_${n.id}`,
      title: n.title,
      message: n.message,
      type: n.type === 'warning' ? 'subscription_expiring'
          : n.type === 'error'   ? 'subscription_expired'
          : n.type === 'success' ? 'subscription_activated'
          : 'system',
      read: n.read,
      dismissed: false,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.createdAt.toISOString(),
      actionPath: '/pricing',
      actionLabel: 'View Subscription',
      severity: n.type === 'error' ? 'critical' : n.type === 'warning' ? 'high' : 'info',
    }))
    .filter((n) => !derivedTypeSet.has(n.type))
    .filter((n) => !clearedAt || n.createdAt > clearedAt);

  const seenIds = new Set<string>();
  const notifications: AppNotification[] = [
    ...derivedNotifications,
    ...firestoreNotifs,
  ]
    .filter((n) => { if (seenIds.has(n.id)) return false; seenIds.add(n.id); return true; })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasAny = notifications.length > 0;

  const handleMarkRead = (id: string) => {
    if (!id.startsWith('sub_')) markRead(id);
  };

  const handleDismiss = (id: string) => {
    if (!id.startsWith('sub_')) dismiss(id);
  };

  // Mark ALL notifications (derived + Firestore) as read in the local store
  const handleMarkAllRead = () => {
    markAllRead(notifications.filter((n) => !n.read).map((n) => n.id));
  };

  // Clear All: stores the IDs of every current notification so they stay hidden.
  // New notifications (new IDs) still appear.
  const handleClearAll = () => {
    clearAll(notifications.map((n) => n.id));
  };

  return (
    <div className='min-h-full flex flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center gap-3'>
          <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20'>
            <FiBell className='h-4 w-4 text-emerald-500' aria-hidden='true' />
          </div>
            <h1 className='text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2'>
              Notifications
              <FeatureInfo feature='notifications' align='left' />
            </h1>
          {unreadCount > 0 && (
            <span className='rounded-full bg-rose-500/15 border border-rose-500/20 px-2 py-0.5 text-xs font-black text-rose-500'>
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          {unreadCount > 0 && (
            <button
              type='button'
              onClick={handleMarkAllRead}
              className='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors'
            >
              <FiCheckCircle className='h-3.5 w-3.5' aria-hidden='true' />
              Mark all read
            </button>
          )}
          {hasAny && (
            <button
              type='button'
              onClick={handleClearAll}
              className='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 hover:bg-rose-500/10 hover:text-rose-500 transition-colors'
            >
              <FiTrash2 className='h-3.5 w-3.5' aria-hidden='true' />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Notification list */}
      <div className='flex-1'>
        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <div className='space-y-2'>
            {notifications.map((notif) => {
              const icon = NOTIF_ICONS[notif.type] ?? '🔔';
              const colorClass = NOTIF_COLORS[notif.type] ?? 'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/40';
              const category = NOTIF_CATEGORY[notif.type] ?? 'Notification';
              const isClickable = !!notif.actionPath;

              return (
                <div
                  key={notif.id}
                  className={`group relative flex gap-3 rounded-xl border p-4 transition-all ${colorClass} ${
                    !notif.read ? 'hover:brightness-105 dark:hover:brightness-110' : ''
                  }`}
                  onClick={() => {
                    if (!notif.read) handleMarkRead(notif.id);
                    if (isClickable && notif.actionPath) {
                      window.location.href = notif.actionPath;
                    }
                  }}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                >
                  {/* Unread indicator */}
                  {!notif.read && (
                    <span className='absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full bg-emerald-400' />
                  )}

                  {/* Icon */}
                  <span className='shrink-0 text-lg leading-none mt-0.5 select-none'>
                    {icon}
                  </span>

                  {/* Content */}
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-start justify-between gap-2'>
                      <p className={`text-sm font-bold leading-snug ${
                        notif.read
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className='h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' aria-label='Unread' />
                      )}
                    </div>
                    <p className={`mt-1 text-xs leading-relaxed ${
                      notif.read
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      {notif.message}
                    </p>
                    <div className='mt-2 flex items-center gap-2 flex-wrap'>
                      <span className='rounded-full bg-slate-200/70 dark:bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'>
                        {category}
                      </span>
                      <span className='text-[10px] text-slate-400 dark:text-slate-500 tabular-nums'>
                        {relativeTime(notif.createdAt)}
                      </span>
                      {notif.dueDate && (
                        <span className='text-[10px] text-slate-400 dark:text-slate-500'>
                          Due {format(new Date(notif.dueDate), 'dd MMM yyyy')}
                        </span>
                      )}
                    </div>
                    {notif.actionLabel && notif.actionPath && (
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!notif.read) handleMarkRead(notif.id);
                          if (notif.actionPath) window.location.href = notif.actionPath;
                        }}
                        className='mt-2 flex items-center gap-1 text-xs font-bold text-emerald-500 dark:text-emerald-400 hover:text-emerald-400 dark:hover:text-emerald-300 transition-colors'
                      >
                        {notif.actionLabel}
                        <FiCheck className='h-3 w-3' />
                      </button>
                    )}
                  </div>

                  {/* Dismiss button */}
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(notif.id);
                    }}
                    className='shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 hover:text-slate-700 dark:hover:text-slate-200 transition-all'
                    title='Dismiss notification'
                    aria-label='Dismiss notification'
                  >
                    <FiX className='h-3.5 w-3.5' />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {hasAny && (
        <div className='mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 text-center'>
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''} · {unreadCount} unread
        </div>
      )}
    </div>
  );
}
