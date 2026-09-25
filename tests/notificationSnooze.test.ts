// tests/notificationSnooze.test.ts — audit I3 per-item snooze
import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from '../src/store/notificationStore';
import type { AppNotification } from '../src/store/notificationStore';

const mk = (id: string): AppNotification =>
  ({
    id,
    type: 'info',
    title: `n-${id}`,
    message: 'hello',
    createdAt: new Date(Date.now() - 1000).toISOString(),
    read: false,
    dismissed: false,
  }) as unknown as AppNotification;

describe('notification per-item snooze (I3)', () => {
  beforeEach(() => {
    // Reset ledger between tests.
    useNotificationStore.setState({
      uid: 'test',
      readIds: [],
      dismissedIds: [],
      clearedAt: null,
      clearedDerivedIds: [],
      snoozedMap: {},
    });
  });

  it('hides a snoozed notification and marks it read', () => {
    const until = new Date(Date.now() + 3600_000).toISOString();
    useNotificationStore.getState().snooze('a', until);
    const out = useNotificationStore.getState().enrichAndFilter([mk('a'), mk('b')]);
    expect(out.map((n) => n.id)).toEqual(['b']);
    expect(useNotificationStore.getState().readIds).toContain('a');
  });

  it('re-surfaces once the snooze window passes and prunes the stale entry', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    useNotificationStore.setState({ snoozedMap: { a: past } });
    const out = useNotificationStore.getState().enrichAndFilter([mk('a')]);
    expect(out.map((n) => n.id)).toEqual(['a']); // expired → visible again
    expect(useNotificationStore.getState().snoozedMap.a).toBeUndefined(); // pruned
  });

  it('activeSnoozeCount ignores expired entries', () => {
    useNotificationStore.setState({
      snoozedMap: {
        a: new Date(Date.now() + 3600_000).toISOString(),
        b: new Date(Date.now() - 3600_000).toISOString(),
      },
    });
    expect(useNotificationStore.getState().activeSnoozeCount()).toBe(1);
  });
});
