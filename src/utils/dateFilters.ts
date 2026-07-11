export type DateFilterMode = 'all' | 'week' | 'month' | 'year' | 'custom';

export type DateFilterState = {
  mode: DateFilterMode;
  customStart: string;
  customEnd: string;
};

export function createDefaultDateFilter(
  mode: DateFilterMode = 'month',
): DateFilterState {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  return { mode, customStart: monthStart, customEnd: todayStr };
}

export function getDateRange(
  state: DateFilterState,
): { start: string; end: string } | null {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  if (state.mode === 'all') return null;
  if (state.mode === 'custom') {
    if (!state.customStart || !state.customEnd) return null;
    return {
      start: state.customStart <= state.customEnd ? state.customStart : state.customEnd,
      end: state.customStart <= state.customEnd ? state.customEnd : state.customStart,
    };
  }
  if (state.mode === 'week') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { start: start.toISOString().split('T')[0], end: todayStr };
  }
  if (state.mode === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: start.toISOString().split('T')[0], end: todayStr };
  }
  if (state.mode === 'year') {
    const start = new Date(today.getFullYear(), 0, 1);
    return { start: start.toISOString().split('T')[0], end: todayStr };
  }
  return null;
}

export function isDateInRange(
  dateStr: string | undefined,
  range: { start: string; end: string } | null,
): boolean {
  if (!dateStr) return false;
  if (!range) return true;
  return dateStr >= range.start && dateStr <= range.end;
}

export function dateFilterLabel(state: DateFilterState): string {
  const range = getDateRange(state);
  if (!range) return 'All time';
  if (state.mode === 'week') return 'Last 7 days';
  if (state.mode === 'month') return 'This month';
  if (state.mode === 'year') return 'This year';
  if (state.mode === 'custom') return `${range.start} → ${range.end}`;
  return 'All time';
}
