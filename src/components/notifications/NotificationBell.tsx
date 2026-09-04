// src/components/notifications/NotificationBell.tsx
// Modern, professional notification panel for Fintrackly
// Uses derived notifications from useDerivedNotifications hook.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiBell,
  FiCheck,
  FiCheckCircle,
  FiChevronRight,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

import {
  NOTIF_CATEGORY,
  NOTIF_COLORS,
  NOTIF_ICONS,
  useNotificationStore,
  type AppNotification,
} from '../../store/notificationStore';
import { useDerivedNotifications } from '../../hooks/useDerivedNotifications';
import { useSubscription } from '../../context/SubscriptionContext';

// ─── Severity accent bar ──────────────────────────────────────────────────────
const SEVERITY_BAR: Record<string, string> = {
  critical: 'bg-rose-500',
  high: 'bg-orange-400',
  medium: 'bg-amber-400',
  low: 'bg-blue-400',
  info: 'bg-emerald-400',
};

// ─── Severity label ───────────────────────────────────────────────────────────
const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-rose-500/15 text-rose-400 border border-rose-500/25',
  high: 'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  medium: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  low: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  info: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
};

// ─── Friendly timestamp ───────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true });
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'dd MMM, h:mm a');
}

// ─── Individual notification card ────────────────────────────────────────────
function NotifCard({
  notif,
  onRead,
  onDismiss,
  onAction,
}: {
  notif: AppNotification;
  onRead: () => void;
  onDismiss: (e: React.MouseEvent) => void;
  onAction: () => void;
}) {
  const icon = NOTIF_ICONS[notif.type] ?? '🔔';
  const colorClass =
    NOTIF_COLORS[notif.type] ??
    'bg-slate-100/80 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/40';
  const severityBar = SEVERITY_BAR[notif.severity ?? 'info'] ?? 'bg-slate-400';
  const severityBadge = SEVERITY_BADGE[notif.severity ?? 'info'] ?? '';
  const category = NOTIF_CATEGORY[notif.type] ?? 'Notification';
  const isClickable = !!notif.actionPath;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: notif.read ? 0.65 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`group relative flex gap-3 rounded-xl border p-3 transition-colors ${colorClass} ${
        isClickable && !notif.read
          ? 'cursor-pointer hover:brightness-105 dark:hover:brightness-110'
          : ''
      }`}
      onClick={() => {
        if (!notif.read) onRead();
        if (isClickable) onAction();
      }}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (!notif.read) onRead();
          if (isClickable) onAction();
        }
      }}
      aria-label={notif.title}
    >
      {/* Left severity accent bar */}
      {!notif.read && (
        <span
          className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full ${severityBar}`}
          aria-hidden='true'
        />
      )}

      {/* Emoji icon */}
      <span
        className='shrink-0 text-base leading-none mt-0.5 select-none'
        aria-hidden='true'
      >
        {icon}
      </span>

      {/* Body */}
      <div className='min-w-0 flex-1'>
        {/* Title row */}
        <div className='flex items-start justify-between gap-2'>
          <p
            className={`text-xs font-bold leading-snug ${
              notif.read
                ? 'text-slate-500 dark:text-slate-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {notif.title}
          </p>
          {/* Unread dot */}
          {!notif.read && (
            <span
              className='mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
              aria-label='Unread'
            />
          )}
        </div>

        {/* Message */}
        <p
          className={`mt-0.5 text-[11px] leading-relaxed ${
            notif.read
              ? 'text-slate-400 dark:text-slate-500'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {notif.message}
        </p>

        {/* Due date */}
        {notif.dueDate && (
          <p className='mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-500'>
            Due{' '}
            {format(new Date(notif.dueDate), 'dd MMM yyyy')}
          </p>
        )}

        {/* Footer row: category badge + severity + time */}
        <div className='mt-1.5 flex flex-wrap items-center gap-1.5'>
          {/* Category pill */}
          <span className='rounded-full bg-slate-200/70 dark:bg-slate-700/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'>
            {category}
          </span>

          {/* Severity badge — only for non-info/non-read */}
          {notif.severity && notif.severity !== 'info' && !notif.read && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${severityBadge}`}
            >
              {notif.severity}
            </span>
          )}

          {/* Time */}
          <span className='ml-auto text-[9px] text-slate-400 dark:text-slate-600 tabular-nums'>
            {relativeTime(notif.createdAt)}
          </span>
        </div>

        {/* Action button — only shown when unread and actionLabel exists */}
        {notif.actionLabel && !notif.read && notif.actionPath && (
          <button
            type='button'
            className='mt-2 flex items-center gap-0.5 text-[11px] font-bold text-emerald-500 dark:text-emerald-400 hover:text-emerald-400 dark:hover:text-emerald-300 transition-colors'
            onClick={(e) => {
              e.stopPropagation();
              onRead();
              onAction();
            }}
            aria-label={notif.actionLabel}
          >
            {notif.actionLabel}
            <FiChevronRight className='h-3 w-3' />
          </button>
        )}
      </div>

      {/* Dismiss (×) button — always visible on hover */}
      <button
        type='button'
        onClick={onDismiss}
        className='shrink-0 flex h-5 w-5 items-center justify-center rounded-md text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 hover:text-slate-700 dark:hover:text-slate-200 transition-all'
        title='Dismiss notification'
        aria-label='Dismiss notification'
      >
        <FiX className='h-3 w-3' />
      </button>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.05 }}
      className='flex flex-col items-center justify-center gap-3 py-14 px-6 text-center'
    >
      <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-2xl'>
        🎉
      </div>
      <div>
        <p className='text-sm font-bold text-slate-800 dark:text-slate-200'>
          You're all caught up!
        </p>
        <p className='mt-1 text-xs text-slate-400 dark:text-slate-500 leading-relaxed max-w-[200px] mx-auto'>
          No new notifications right now. We'll let you know when something
          needs your attention.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main bell component ──────────────────────────────────────────────────────
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const { notifications: subscriptionNotifications } = useSubscription();
  const derivedNotifications = useDerivedNotifications();
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const clearedAt = useNotificationStore((s) => s.clearedAt);

  // ── Merge derived + Firestore subscription notifications ─────────────────
  // Strategy:
  //   1. Start with all derived in-app notifications (stable IDs, already deduped).
  //   2. Map Firestore subscription docs to AppNotification shape.
  //   3. Drop any Firestore item whose *type* is already covered by a derived
  //      notification — this prevents the same subscription event appearing twice
  //      (once from useDerivedNotifications, once from the Firestore listener).
  //   4. Final dedup on stable `id` to catch any remaining exact duplicates.
  //   5. Sort newest-first.

  const derivedTypeSet = new Set(derivedNotifications.map((n) => n.type));

  const firestoreNotifs: AppNotification[] = subscriptionNotifications
    .map(
      (n): AppNotification => ({
        id: `sub_${n.id}`,
        title: n.title,
        message: n.message,
        type:
          n.type === 'warning'
            ? 'subscription_expiring'
            : n.type === 'error'
              ? 'subscription_expired'
              : n.type === 'success'
                ? 'subscription_activated'
                : 'system',
        read: n.read,
        dismissed: false,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.createdAt.toISOString(),
        actionPath: '/pricing',
        actionLabel: 'View Subscription',
        severity:
          n.type === 'error' ? 'critical' : n.type === 'warning' ? 'high' : 'info',
      }),
    )
    // Drop if the derived hook already covers the same notification type
    .filter((n) => !derivedTypeSet.has(n.type))
    // Apply clearedAt filter — hide Firestore notifications older than the last clear
    .filter((n) => !clearedAt || n.createdAt > clearedAt);

  const seenIds = new Set<string>();
  const mergedNotifications: AppNotification[] = [
    ...derivedNotifications,
    ...firestoreNotifs,
  ]
    .filter((n) => {
      if (seenIds.has(n.id)) return false;
      seenIds.add(n.id);
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const unreadCount = mergedNotifications.filter((n) => !n.read).length;
  const hasAny = mergedNotifications.length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleRead = (notif: AppNotification) => {
    if (notif.read) return;
    if (notif.id.startsWith('sub_')) return; // Firestore notifs don't need client-side mark
    markRead(notif.id);
  };

  const handleDismiss = (notif: AppNotification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (notif.id.startsWith('sub_')) return;
    dismiss(notif.id);
  };

  // Mark ALL visible notifications as read — both derived (via store IDs) and
  // Firestore sub_ notifications (simply moved to readIds so the unread dot hides).
  const handleMarkAllRead = () => {
    const allIds = mergedNotifications.filter((n) => !n.read).map((n) => n.id);
    if (allIds.length > 0) markAllRead(allIds);
  };

  // Clear All: records the current timestamp in the store.
  // useDerivedNotifications and firestoreNotifs both filter out anything older,
  // so every notification visually disappears immediately and the bell goes to 0.
  const handleClearAll = () => {
    clearAll(); // sets clearedAt = now(), resets readIds / dismissedIds
  };

  // ── Close on outside click / Escape ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Show up to 25 most recent
  const visible = mergedNotifications.slice(0, 25);

  return (
    <div className='relative'>
      {/* ── Bell button ──────────────────────────────────────────────────── */}
      <button
        ref={buttonRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup='dialog'
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
          open
            ? 'border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
            : 'border-slate-200/70 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <FiBell className='h-4 w-4' aria-hidden='true' />

        {/* Unread badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key='badge'
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className='absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-[0_2px_8px_rgba(239,68,68,0.5)]'
              aria-hidden='true'
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* ── Panel ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            key='panel'
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            role='dialog'
            aria-label='Notifications'
            aria-modal='true'
            className={`
              absolute right-0 top-full z-[200] mt-2
              w-[min(360px,_calc(100vw_-_16px))]
              rounded-2xl border
              border-slate-200 dark:border-slate-700/80
              bg-white dark:bg-slate-900
              shadow-[0_16px_48px_-4px_rgba(0,0,0,0.28),0_4px_16px_-2px_rgba(0,0,0,0.16)]
              dark:shadow-[0_16px_48px_-4px_rgba(0,0,0,0.6),0_4px_16px_-2px_rgba(0,0,0,0.4)]
              flex flex-col overflow-hidden
              max-h-[min(580px,_calc(100dvh_-_80px))]
            `}
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className='flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-3'>
              <div className='flex items-center gap-2.5 min-w-0'>
                <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20'>
                  <FiBell className='h-3.5 w-3.5 text-emerald-500' aria-hidden='true' />
                </div>
                <span className='text-sm font-bold text-slate-900 dark:text-slate-100 truncate'>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className='shrink-0 rounded-full bg-rose-500/15 border border-rose-500/20 px-1.5 py-0.5 text-[10px] font-black text-rose-500'>
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className='flex shrink-0 items-center gap-1'>
                {/* Mark all as read */}
                {unreadCount > 0 && (
                  <button
                    type='button'
                    onClick={handleMarkAllRead}
                    className='flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors'
                    title='Mark all notifications as read'
                    aria-label='Mark all notifications as read'
                  >
                    <FiCheckCircle className='h-3.5 w-3.5' aria-hidden='true' />
                    <span className='hidden sm:inline'>Mark all read</span>
                  </button>
                )}

                {/* Close panel */}
                <button
                  type='button'
                  onClick={() => setOpen(false)}
                  className='flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors'
                  title='Close notifications'
                  aria-label='Close notifications panel'
                >
                  <FiX className='h-4 w-4' aria-hidden='true' />
                </button>
              </div>
            </div>

            {/* ── Notification list ───────────────────────────────────────── */}
            <div
              className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 space-y-1.5'
              role='list'
              aria-live='polite'
              aria-label='Notification list'
            >
              <AnimatePresence initial={false}>
                {visible.length === 0 ? (
                  <EmptyState key='empty' />
                ) : (
                  visible.map((n) => (
                    <div key={n.id} role='listitem'>
                      <NotifCard
                        notif={n}
                        onRead={() => handleRead(n)}
                        onDismiss={(e) => handleDismiss(n, e)}
                        onAction={() => {
                          if (n.actionPath) {
                            navigate(n.actionPath);
                            setOpen(false);
                          }
                        }}
                      />
                    </div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            {hasAny && (
              <div className='shrink-0 border-t border-slate-100 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2'>
                <p className='text-[10px] text-slate-400 dark:text-slate-600'>
                  {mergedNotifications.length} notification
                  {mergedNotifications.length !== 1 ? 's' : ''}
                  {unreadCount > 0 ? ` · ${unreadCount} unread` : ' · all read'}
                </p>
                <div className='flex items-center gap-2'>
                  {/* View All Notifications */}
                  <button
                    type='button'
                    onClick={() => {
                      navigate('/notifications');
                      setOpen(false);
                    }}
                    className='flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
                  >
                    View All
                    <FiChevronRight className='h-3 w-3' />
                  </button>
                  {/* Clear All */}
                  <button
                    type='button'
                    onClick={handleClearAll}
                    className='flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 hover:bg-rose-500/10 hover:text-rose-500 transition-colors'
                    title='Clear all notifications'
                    aria-label='Clear all notifications'
                  >
                    <FiTrash2 className='h-3 w-3' aria-hidden='true' />
                    Clear all
                  </button>
                </div>
              </div>
            )}

            {/* All-read confirmation */}
            {hasAny && unreadCount === 0 && (
              <div className='shrink-0 border-t border-slate-100 dark:border-slate-800 px-4 py-2.5 flex items-center gap-2'>
                <FiCheck
                  className='h-3.5 w-3.5 text-emerald-400 shrink-0'
                  aria-hidden='true'
                />
                <p className='text-[11px] font-medium text-slate-400 dark:text-slate-500'>
                  All notifications read
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
