// src/hooks/useLiabilityReminders.ts
//
// UPDATED:
//  • Fires browser push notifications 3 days before endDate
//  • Skips returned, paid, paused liabilities
//  • Also fires for same-day (0 days) with "Due Today!" wording
//  • Uses localStorage to avoid duplicate notifications per day per liability

import { useEffect } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';

export function useLiabilityReminders() {
  const liabilities = usePortfolioStore((s) => s.liabilities);

  useEffect(() => {
    // Only run if browser supports notifications
    if (!('Notification' in window)) return;

    // Request permission if not already granted/denied
    if (
      Notification.permission !== 'granted' &&
      Notification.permission !== 'denied'
    ) {
      Notification.requestPermission();
    }

    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const todayStr = now.toDateString();

    liabilities.forEach((liability) => {
      // Skip returned, paid, paused liabilities
      if (
        liability.status === 'returned' ||
        liability.status === 'paid' ||
        liability.status === 'paused'
      )
        return;

      // Must have a due date and some outstanding amount
      if (!liability.endDate || (liability.outstanding ?? 0) <= 0) return;

      const dueDate = new Date(liability.endDate);

      // Days until due (can be negative if overdue)
      const diffTime =
        dueDate.getTime() - new Date(now.setHours(0, 0, 0, 0)).getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Notify if due within next 3 days (inclusive of today = 0, and 1, 2, 3)
      if (daysLeft >= 0 && daysLeft <= 3) {
        // LocalStorage key: one notification per day per liability
        const storageKey = `notified_liability_${liability.id}_${todayStr}`;

        if (!localStorage.getItem(storageKey)) {
          const title =
            daysLeft === 0
              ? '🔴 Payment Due Today!'
              : `⏰ Payment Due in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}`;

          const body =
            daysLeft === 0
              ? `"${liability.name}" — ₹${liability.outstanding.toLocaleString('en-IN')} is due today.`
              : `"${liability.name}" — ₹${liability.outstanding.toLocaleString('en-IN')} is due on ${dueDate.toLocaleDateString('en-IN')} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left).`;

          new Notification(title, {
            body,
            icon: '/icons/android-chrome-192x192.png',
            badge: '/icons/favicon-32x32.png',
          });

          // Mark as notified for today
          localStorage.setItem(storageKey, 'true');
        }
      }
    });
  }, [liabilities]);
}
