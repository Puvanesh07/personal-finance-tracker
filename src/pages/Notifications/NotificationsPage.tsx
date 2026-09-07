// src/pages/Notifications/NotificationsPage.tsx
// Dedicated notifications page — shares the EXACT pipeline as NotificationBell
// so behaviour (clear all / mark all read / per-card read / dismiss / unread count)
// is 100% identical in both places.

import { useMemo } from 'react';
import { FiBell, FiCheck, FiCheckCircle, FiTrash2, FiX } from 'react-icons/fi';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  NOTIF_CATEGORY,
  NOTIF_COLORS,
  NOTIF_ICONS,
  useNotificationStore,
  type AppNotification,
} from '../../store/notificationStore';
import { useShallow } from 'zustand/react/shallow';
import { useDerivedNotifications } from '../../hooks/useDerivedNotifications';
import { useSubscription } from '../../context/SubscriptionContext';
import { FeatureInfo } from '../../components/ui/FeatureInfo';
import {
  mergeAndNormalizeNotifs,
} from '../../components/notifications/NotificationBell';

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
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
          We&apos;ll let you know when something needs your attention.
        </p>
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const derivedNotifications = useDerivedNotifications();
  const {
    notifications: subscriptionNotifications,
    markNotificationReadRemote,
    markAllNotificationsReadRemote,
    dismissNotificationRemote,
    clearAllNotificationsRemote,
  } = useSubscription();
  // See the Bell component for why we select the raw arrays + use shallow:
  // ensures re-renders actually fire whenever read / dismissed / cleared change.
  const { markRead, markAllRead, dismiss, clearAll, readIds, dismissedIds, clearedAt } =
    useNotificationStore(
      useShallow((s) => ({
        markRead: s.markRead,
        markAllRead: s.markAllRead,
        dismiss: s.dismiss,
        clearAll: s.clearAll,
        readIds: s.readIds,
        dismissedIds: s.dismissedIds,
        clearedAt: s.clearedAt,
      })),
    );

  const notifications = useMemo(() => {
    const combined = mergeAndNormalizeNotifs(derivedNotifications, subscriptionNotifications);
    return useNotificationStore.getState().enrichAndFilter(combined);
  }, [derivedNotifications, subscriptionNotifications, readIds, dismissedIds, clearedAt]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );
  const hasAny = notifications.length > 0;

  const handleMarkRead = (notif: AppNotification) => {
    if (notif.read) return;
    markRead(notif.id);
    markNotificationReadRemote(notif.id);
  };

  const handleDismiss = (notif: AppNotification) => {
    dismiss(notif.id);
    dismissNotificationRemote(notif.id);
  };

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    markAllRead(unreadIds);
    markAllNotificationsReadRemote(unreadIds);
  };

  const handleClearAll = () => {
    const allIds = notifications.map((n) => n.id);
    clearAll(allIds);
    clearAllNotificationsRemote(allIds);
  };

  return (
    <div className='min-h-full flex flex-col'>
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

      <div className='flex-1'>
        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <div className='space-y-2'>
            {notifications.map((notif) => {
              const icon = NOTIF_ICONS[notif.type] ?? '🔔';
              const colorClass =
                NOTIF_COLORS[notif.type] ??
                'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/40';
              const category = NOTIF_CATEGORY[notif.type] ?? 'Notification';
              const isClickable = !!notif.actionPath;

              return (
                <div
                  key={notif.id}
                  className={`group relative flex gap-3 rounded-xl border p-4 transition-all ${colorClass} ${
                    !notif.read ? 'hover:brightness-105 dark:hover:brightness-110' : ''
                  }`}
                  onClick={() => {
                    if (!notif.read) handleMarkRead(notif);
                    if (isClickable && notif.actionPath) {
                      navigate(notif.actionPath);
                    }
                  }}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                >
                  {!notif.read && (
                    <span className='absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full bg-emerald-400' />
                  )}

                  <span className='shrink-0 text-lg leading-none mt-0.5 select-none'>
                    {icon}
                  </span>

                  <div className='min-w-0 flex-1'>
                    <div className='flex items-start justify-between gap-2'>
                      <p
                        className={`text-sm font-bold leading-snug ${
                          notif.read
                            ? 'text-slate-500 dark:text-slate-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span
                          className='h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                          aria-label='Unread'
                        />
                      )}
                    </div>
                    <p
                      className={`mt-1 text-xs leading-relaxed ${
                        notif.read
                          ? 'text-slate-400 dark:text-slate-500'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
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
                    {notif.actionLabel && notif.actionPath && !notif.read && (
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkRead(notif);
                          navigate(notif.actionPath!);
                        }}
                        className='mt-2 flex items-center gap-1 text-xs font-bold text-emerald-500 dark:text-emerald-400 hover:text-emerald-400 dark:hover:text-emerald-300 transition-colors'
                      >
                        {notif.actionLabel}
                        <FiCheck className='h-3 w-3' />
                      </button>
                    )}
                  </div>

                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(notif);
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

      {hasAny && (
        <div className='mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 text-center'>
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''} ·{' '}
          {unreadCount} unread
        </div>
      )}
    </div>
  );
}
