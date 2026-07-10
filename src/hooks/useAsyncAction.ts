import { useCallback, useRef, useState } from 'react';

/** Prevents double-click / duplicate async submissions across the app. */
export function useAsyncAction() {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
