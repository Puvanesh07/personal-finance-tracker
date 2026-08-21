import { useEffect } from 'react';

import { useAgriStore } from '../store/agricultureStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { usePortfolioStore } from '../store/portfolioStore';

/** Hydrates agriculture data on first use (dashboard agri card, agriculture page).
 *
 * Returns `{ ready, error }`.
 * - `ready` is true once data has been loaded (or failed — the store sets
 *   ready:true on error so we never loop forever).
 * - `error` carries the message from a failed hydration so the UI can show
 *   a proper error state instead of an infinite skeleton.
 */
export function useEnsureAgriHydrated(): { ready: boolean; error: string | null } {
  const uid = usePortfolioStore((s) => s.uid);
  const storeUid = useAgriStore((s) => s.uid);
  const ready = useAgriStore((s) => s.ready);
  const hydrateError = useAgriStore((s) => s.hydrateError);
  const hydrate = useAgriStore((s) => s.hydrate);

  useEffect(() => {
    if (!uid) return;
    // Only call hydrate when we genuinely need to: uid changed, or store has
    // never successfully loaded. `ready:true` is now set even on error, so
    // this condition will not keep firing after a failure.
    if (!ready || storeUid !== uid) void hydrate(uid);
  }, [uid, storeUid, ready, hydrate]);

  return { ready: ready && storeUid === uid, error: hydrateError };
}

/** Hydrates attendance data on first use (attendance page, reports). */
export function useEnsureAttendanceHydrated() {
  const uid = usePortfolioStore((s) => s.uid);
  const storeUid = useAttendanceStore((s) => s.uid);
  const ready = useAttendanceStore((s) => s.ready);
  const hydrate = useAttendanceStore((s) => s.hydrate);

  useEffect(() => {
    if (!uid) return;
    if (!ready || storeUid !== uid) void hydrate(uid);
  }, [uid, storeUid, ready, hydrate]);

  return ready && storeUid === uid;
}
