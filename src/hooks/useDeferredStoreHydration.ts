import { useEffect } from 'react';

import { useAgriStore } from '../store/agricultureStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { usePortfolioStore } from '../store/portfolioStore';

/** Hydrates agriculture data on first use (dashboard agri card, agriculture page). */
export function useEnsureAgriHydrated() {
  const uid = usePortfolioStore((s) => s.uid);
  const storeUid = useAgriStore((s) => s.uid);
  const ready = useAgriStore((s) => s.ready);
  const hydrate = useAgriStore((s) => s.hydrate);

  useEffect(() => {
    if (!uid) return;
    if (!ready || storeUid !== uid) void hydrate(uid);
  }, [uid, storeUid, ready, hydrate]);

  return ready && storeUid === uid;
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
