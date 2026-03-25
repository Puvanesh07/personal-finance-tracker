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

    if (Notification.permission === 'granted') {
      const now = new Date();
      // Date exactly 3 days from now
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      liabilities.forEach((liability) => {
        // Only notify for unpaid liabilities that have a due date
        if (liability.endDate && liability.outstanding > 0) {
          const dueDate = new Date(liability.endDate);

          // Check if due date is between today and 3 days from now
          if (
            dueDate <= threeDaysFromNow &&
            dueDate >= new Date(now.setHours(0, 0, 0, 0))
          ) {
            // LocalStorage key to ensure we only send ONE notification per day per liability
            const storageKey = `notified_liability_${liability.id}_${new Date().toDateString()}`;

            if (!localStorage.getItem(storageKey)) {
              // Trigger the Push Notification
              new Notification('Payment Reminder', {
                body: `Repayment for "${liability.name}" (₹${liability.outstanding}) is due on ${dueDate.toLocaleDateString()}.`,
                icon: '/icons/android-chrome-192x192.png', // uses your existing PWA icon
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
