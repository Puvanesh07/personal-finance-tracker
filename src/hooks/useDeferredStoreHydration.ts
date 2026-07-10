import { useEffect } from 'react';

import { useAgriStore } from '../store/agricultureStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { usePortfolioStore } from '../store/portfolioStore';

/** Hydrates agriculture data on first use (dashboard agri card, agriculture page). */
export function useEnsureAgriHydrated() {
  const uid = usePortfolioStore((s) => s.uid);
  const ready = useAgriStore((s) => s.ready);
  const hydrate = useAgriStore((s) => s.hydrate);

  useEffect(() => {
    if (uid && !ready) void hydrate(uid);
  }, [uid, ready, hydrate]);

  return ready;
}

/** Hydrates attendance data on first use (attendance page, reports). */
export function useEnsureAttendanceHydrated() {
  const uid = usePortfolioStore((s) => s.uid);
  const ready = useAttendanceStore((s) => s.ready);
  const hydrate = useAttendanceStore((s) => s.hydrate);

  useEffect(() => {
    if (uid && !ready) void hydrate(uid);
  }, [uid, ready, hydrate]);

  return ready;
}
