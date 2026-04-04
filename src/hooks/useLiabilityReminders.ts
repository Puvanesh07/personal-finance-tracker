// src/hooks/useLiabilityReminders.ts

import { useEffect } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';

export function useLiabilityReminders() {
  const liabilities = usePortfolioStore((s) => s.liabilities);

  useEffect(() => {
    // Only run if browser supports notifications
    if (!('Notification' in window)) return;

    if (
      Notification.permission !== 'granted' &&
      Notification.permission !== 'denied'
    ) {
      Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
      const now = new Date();
      // Set the time to midnight for accurate day difference calculations
      const today = new Date(now.setHours(0, 0, 0, 0));

      liabilities.forEach((liability) => {
        // Guard: skip if marked as paid or no outstanding balance
        if (liability.status === 'paid' || (liability.outstanding || 0) <= 0)
          return;

        if (liability.endDate) {
          const dueDate = new Date(liability.endDate);
          dueDate.setHours(0, 0, 0, 0); // Normalize due date time

          // Calculate raw difference in days
          const diffTime = dueDate.getTime() - today.getTime();
          const daysToDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Check if due date is between today (0) and 3 days from now
          if (daysToDue >= 0 && daysToDue <= 3) {
            // LocalStorage key to ensure we only send ONE notification per day per liability
            const storageKey = `notified_liability_popup_${liability.id}_${today.toDateString()}`;

            if (!localStorage.getItem(storageKey)) {
              // Trigger the Push Notification
              new Notification('🚨 Payment Reminder!', {
                body: `Repayment for "${liability.name}" (₹${liability.outstanding}) is due ${daysToDue === 0 ? 'TODAY' : `in ${daysToDue} days`}.`,
                icon: '/icons/android-chrome-192x192.png',
              });

              // Mark as notified for today
              localStorage.setItem(storageKey, 'true');
            }
          }
        }
      });
    }
  }, [liabilities]);
}
