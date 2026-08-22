/**
 * src/components/notifications/NotificationPermissionBanner.tsx
 *
 * Shows once (per device) after the user logs into the installed PWA.
 * - "default" permission  → show the onboarding banner
 * - "granted"             → silently re-register (no UI)
 * - "denied"              → show a small info chip (no nag)
 * - "unsupported"         → show nothing
 *
 * Dismissal is persisted in localStorage so it never re-appears on the
 * same device.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiBell, FiBellOff, FiX } from 'react-icons/fi';
import {
  getNotificationPermission,
  isPushSupported,
  registerForPush,
  silentReRegisterIfGranted,
} from '../../services/fcmService';
import { auth } from '../../services/firebase';

const DISMISSED_KEY = 'fintrackly_notif_banner_dismissed';

function wasDismissed(): boolean {
  return localStorage.getItem(DISMISSED_KEY) === 'true';
}
function setDismissed() {
  localStorage.setItem(DISMISSED_KEY, 'true');
}

export function NotificationPermissionBanner() {
  const [status, setStatus] = useState<
    'idle' | 'showing' | 'denied_info' | 'done'
  >('idle');
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;

    const perm = getNotificationPermission();

    if (perm === 'granted') {
      // Already granted — silently refresh the token, no UI needed
      const uid = auth.currentUser?.uid;
      if (uid) void silentReRegisterIfGranted(uid);
      return;
    }

    if (perm === 'denied') {
      // Only show the denied-info chip if user hasn't dismissed it
      if (!wasDismissed()) setStatus('denied_info');
      return;
    }

    // 'default' — ask once per device
    if (perm === 'default' && !wasDismissed()) {
      // Small delay so the app finishes rendering before the banner pops
      const t = setTimeout(() => setStatus('showing'), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const handleEnable = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setEnabling(true);
    const result = await registerForPush(uid);
    setEnabling(false);
    if (result === 'granted') {
      setDismissed();
      setStatus('done');
    } else {
      setStatus('denied_info');
      setDismissed();
    }
  };

  const handleDismiss = () => {
    setDismissed();
    setStatus('done');
  };

  return (
    <AnimatePresence>
      {status === 'showing' && (
        <motion.div
          key='banner'
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className='fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] w-[min(420px,calc(100vw-24px))]'
          role='dialog'
          aria-label='Enable push notifications'
        >
          <div className='rounded-2xl border border-emerald-500/30 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md shadow-[0_20px_60px_-4px_rgba(0,0,0,0.55)] p-5'>
            {/* Header */}
            <div className='flex items-start justify-between gap-3 mb-3'>
              <div className='flex items-center gap-3'>
                <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30'>
                  <FiBell className='h-5 w-5 text-emerald-400' />
                </div>
                <div>
                  <p className='text-sm font-bold text-slate-100'>
                    Never miss an important update
                  </p>
                  <p className='text-[11px] text-slate-400 mt-0.5'>
                    Fintrackly can remind you about:
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors'
                aria-label='Dismiss'
              >
                <FiX className='h-4 w-4' />
              </button>
            </div>

            {/* Feature list */}
            <div className='grid grid-cols-2 gap-1.5 mb-4 pl-1'>
              {[
                '💳 Upcoming payments',
                '🛡️ Insurance renewals',
                '🎯 Goal milestones',
                '💸 EMI / loan dues',
                '⏳ Trial / subscription',
                '📅 Monthly SIP',
              ].map((item) => (
                <div key={item} className='flex items-center gap-1.5 text-[11px] text-slate-400'>
                  <span className='text-emerald-500 text-base leading-none'>{item.slice(0, 2)}</span>
                  <span>{item.slice(3)}</span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div className='flex gap-2'>
              <button
                onClick={handleDismiss}
                className='flex-1 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-300 transition-colors'
              >
                Maybe Later
              </button>
              <button
                onClick={handleEnable}
                disabled={enabling}
                className='flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-4 py-2.5 text-xs font-bold text-white transition-colors shadow-lg shadow-emerald-500/20'
              >
                {enabling ? 'Enabling…' : '🔔 Enable Notifications'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {status === 'denied_info' && (
        <motion.div
          key='denied'
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
          className='fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] w-[min(380px,calc(100vw-24px))]'
        >
          <div className='flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-slate-900/95 backdrop-blur-md px-4 py-3 shadow-xl'>
            <FiBellOff className='h-4 w-4 shrink-0 text-amber-400' />
            <p className='flex-1 text-[11.5px] text-slate-300'>
              Notifications are blocked. To enable, go to your browser's{' '}
              <strong className='text-amber-400'>Site Settings</strong> → Allow Notifications.
            </p>
            <button
              onClick={() => { setDismissed(); setStatus('done'); }}
              className='shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors'
              aria-label='Dismiss'
            >
              <FiX className='h-3.5 w-3.5' />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
