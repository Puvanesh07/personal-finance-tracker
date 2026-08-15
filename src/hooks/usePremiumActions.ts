import toast from 'react-hot-toast';
import { useSubscription } from '../context/SubscriptionContext';

const LOCKED_MESSAGE = 'Your trial has expired. Subscribe to continue.';

export function usePremiumActions() {
  const { canCreateTransactions, hasPremiumAccess, isExpired } = useSubscription();
  const isLocked = !canCreateTransactions;

  const guardAction = <T extends (...args: never[]) => void>(fn: T): T => {
    const wrapped = ((...args: never[]) => {
      if (isLocked) {
        toast.error(LOCKED_MESSAGE);
        return;
      }
      fn(...args);
    }) as T;
    return wrapped;
  };

  const premiumActionProps = {
    'data-premium-action': true,
    disabled: isLocked,
    title: isLocked ? LOCKED_MESSAGE : undefined,
    'aria-disabled': isLocked,
  } as const;

  return {
    canMutate: canCreateTransactions,
    hasPremiumAccess,
    isExpired,
    isLocked,
    guardAction,
    premiumActionProps,
  };
}
