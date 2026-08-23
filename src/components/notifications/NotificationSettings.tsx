/**
 * src/components/notifications/NotificationSettings.tsx
 *
 * Full notification settings panel rendered inside Settings page.
 * - Per-category push toggles
 * - Quiet hours
 * - Reads/writes users/{uid}/notificationSettings/config in Firestore
 * - Shows current device registration status
 */

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FiBell, FiBellOff, FiInfo, FiRefreshCw, FiSave, FiPlay, FiTrash2, FiZap } from 'react-icons/fi';
import { db, auth } from '../../services/firebase';
import {
  getNotificationPermission,
  isPushSupported,
  registerForPush,
  unregisterDevice,
} from '../../services/fcmService';
import toast from 'react-hot-toast';
import {
  testPushNotifications,
  clearNotificationDedup,
  type TestPushNotificationsResult,
} from '../../services/subscriptionService';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationSettingsConfig {
  pushEnabled:            boolean;
  paymentReminders:       boolean;
  insuranceReminders:     boolean;
  goalReminders:          boolean;
  emiReminders:           boolean;
  lendingReminders:       boolean;
  sipReminders:           boolean;
  subscriptionAlerts:     boolean;
  investmentAlerts:       boolean;
  agricultureReminders:   boolean;
  attendanceReminders:    boolean;
  weeklyDigest:           boolean;
  monthlyReport:          boolean;
  quietHoursEnabled:      boolean;
  quietHoursStart:        string;  // "HH:MM" 24h
  quietHoursEnd:          string;
}

const DEFAULT_SETTINGS: NotificationSettingsConfig = {
  pushEnabled:            true,
  paymentReminders:       true,
  insuranceReminders:     true,
  goalReminders:          true,
  emiReminders:           true,
  lendingReminders:       true,
  sipReminders:           true,
  subscriptionAlerts:     true,
  investmentAlerts:       true,
  agricultureReminders:   false,
  attendanceReminders:    false,
  weeklyDigest:           true,
  monthlyReport:          true,
  quietHoursEnabled:      true,
  quietHoursStart:        '22:00',
  quietHoursEnd:          '07:00',
};

// ── Firestore helpers ─────────────────────────────────────────────────────────

async function loadSettings(uid: string): Promise<NotificationSettingsConfig> {
  const ref = doc(db, 'users', uid, 'notificationSettings', 'config');
  const snap = await getDoc(ref);
  if (!snap.exists()) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<NotificationSettingsConfig>) };
}

async function saveSettings(uid: string, cfg: NotificationSettingsConfig): Promise<void> {
  const ref = doc(db, 'users', uid, 'notificationSettings', 'config');
  await setDoc(ref, { ...cfg, updatedAt: serverTimestamp() }, { merge: true });
}

// ── Toggle row component ──────────────────────────────────────────────────────

function ToggleRow({
  icon, label, description, checked, onChange, disabled,
}: {
  icon: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 py-3 border-b border-slate-200/60 dark:border-slate-800/60 last:border-0 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className='flex items-center gap-3 min-w-0'>
        <span className='text-base shrink-0'>{icon}</span>
        <div className='min-w-0'>
          <p className='text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight'>{label}</p>
          {description && (
            <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed'>{description}</p>
          )}
        </div>
      </div>
      <button
        type='button'
        role='switch'
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
          checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationSettings() {
  const uid = auth.currentUser?.uid;
  const [cfg, setCfg] = useState<NotificationSettingsConfig>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permState, setPermState] = useState(getNotificationPermission());
  const supported = isPushSupported();

  const [testing, setTesting] = useState(false);
  const [clearingDedup, setClearingDedup] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<TestPushNotificationsResult | null>(null);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    loadSettings(uid).then((s) => { setCfg(s); setLoading(false); });
  }, [uid]);

  const update = (key: keyof NotificationSettingsConfig, value: boolean | string) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      await saveSettings(uid, cfg);
      toast.success('Notification settings saved.');
    } catch {
      toast.error('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAll = async (force: boolean) => {
    if (!uid) return;
    setTesting(true);
    setLastTestResult(null);
    const toastId = toast.loading(force ? 'Running force-testing reminders (bypassing dedup)…' : 'Testing all reminder rules…');
    try {
      const res = await testPushNotifications({ force });
      setLastTestResult(res);
      toast.dismiss(toastId);
      if (res.ok) {
        const sentCount = (res.results ?? []).filter((r) => r.startsWith('SENT:')).length;
        const failCount = (res.results ?? []).filter((r) => r.startsWith('FAILED')).length;
        const skipCount = (res.results ?? []).filter((r) => r.startsWith('SKIPPED:')).length;
        const noMatchCount = (res.results ?? []).filter((r) => r.startsWith('NO MATCH:')).length;
        toast.success(
          `Test complete — sent=${sentCount}  failed=${failCount}  skipped=${skipCount}  no-match=${noMatchCount}`,
          { duration: 6000 },
        );
      } else {
        toast.error(res.reason || 'Test failed.');
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      const msg = err?.message || String(err || 'Unknown error');
      toast.error(`Test failed: ${msg.slice(0, 140)}`);
    } finally {
      setTesting(false);
    }
  };

  const handleClearDedup = async () => {
    if (!uid) return;
    setClearingDedup(true);
    const toastId = toast.loading('Clearing reminder history (next scheduler run will re-fire)…');
    try {
      const res = await clearNotificationDedup();
      toast.dismiss(toastId);
      toast.success(res.message || `Deleted ${res.deleted} record(s).`, { duration: 5000 });
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err?.message || 'Failed to clear dedup.');
    } finally {
      setClearingDedup(false);
    }
  };

  const handleEnablePush = async () => {
    if (!uid) return;
    setSaving(true);
    const result = await registerForPush(uid);
    setPermState(getNotificationPermission());
    if (result === 'granted') {
      update('pushEnabled', true);
      await saveSettings(uid, { ...cfg, pushEnabled: true });
      toast.success('Push notifications enabled for this device.');
    } else if (result === 'denied') {
      toast.error('Permission denied. Allow notifications in your browser site settings.');
    } else {
      toast.error('Push notifications are not supported in this browser.');
    }
    setSaving(false);
  };

  const handleDisablePush = async () => {
    if (!uid) return;
    setSaving(true);
    await unregisterDevice(uid);
    update('pushEnabled', false);
    await saveSettings(uid, { ...cfg, pushEnabled: false });
    setPermState(getNotificationPermission());
    toast.success('Push notifications disabled for this device.');
    setSaving(false);
  };

  if (loading) {
    return (
      <div className='flex items-center gap-2 py-10 text-slate-500 dark:text-slate-400'>
        <FiRefreshCw className='h-4 w-4 animate-spin' />
        <span className='text-sm'>Loading notification settings…</span>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* ── Push status banner ─────────────────────────────────────────── */}
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${
        !supported
          ? 'border-slate-200/80 dark:border-slate-700/50 bg-slate-100/60 dark:bg-slate-800/40'
          : permState === 'granted'
          ? 'border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-900/10'
          : permState === 'denied'
          ? 'border-rose-400/30 bg-rose-50/60 dark:bg-rose-900/10'
          : 'border-amber-400/30 bg-amber-50/60 dark:bg-amber-900/10'
      }`}>
        {!supported ? (
          <><FiBellOff className='h-5 w-5 shrink-0 text-slate-400 mt-0.5' />
          <div>
            <p className='text-sm font-bold text-slate-700 dark:text-slate-300'>Push not supported</p>
            <p className='text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5'>
              Push notifications require a browser that supports Web Push (Chrome, Edge, Firefox). 
              Safari on iOS requires iOS 16.4+ with the app added to Home Screen.
            </p>
          </div></>
        ) : permState === 'granted' ? (
          <><FiBell className='h-5 w-5 shrink-0 text-emerald-500 mt-0.5' />
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-bold text-emerald-700 dark:text-emerald-400'>Push notifications active</p>
            <p className='text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5'>
              This device is registered. You'll receive alerts even when the app is closed.
            </p>
            <div className='mt-2 flex items-center gap-3 flex-wrap'>
              <button
                onClick={handleDisablePush}
                disabled={saving}
                className='text-[11px] font-bold text-rose-500 hover:text-rose-400 transition-colors'
              >
                Disable for this device
              </button>
            </div>
          </div></>
        ) : permState === 'denied' ? (
          <><FiBellOff className='h-5 w-5 shrink-0 text-rose-400 mt-0.5' />
          <div>
            <p className='text-sm font-bold text-rose-600 dark:text-rose-400'>Notifications blocked</p>
            <p className='text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5'>
              To enable, open your browser's <strong>Site Settings</strong> → 
              Notifications → Allow, then come back and click Enable.
            </p>
          </div></>
        ) : (
          <><FiInfo className='h-5 w-5 shrink-0 text-amber-500 mt-0.5' />
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-bold text-amber-700 dark:text-amber-400'>Push not yet enabled</p>
            <p className='text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5'>
              Enable push notifications to get alerts when the app is closed.
            </p>
            <button
              onClick={handleEnablePush}
              disabled={saving}
              className='mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-3 py-1.5 text-[11px] font-bold text-white transition-colors'
            >
              🔔 Enable Push Notifications
            </button>
          </div></>
        )}
      </div>

      {/* ── Per-category toggles ──────────────────────────────────────── */}
      <div className='rounded-xl border border-slate-200/80 dark:border-slate-800/60 bg-white dark:bg-slate-900/60 divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden'>
        <div className='px-4 py-3 bg-slate-50/60 dark:bg-slate-800/30'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
            Notification Categories
          </p>
        </div>
        <div className='px-4'>
          <ToggleRow icon='�' label='Enable All Reminders'
            description='Master switch — turn OFF to stop all emails. Individual categories below depend on this.'
            checked={cfg.pushEnabled}
            onChange={(v) => update('pushEnabled', v)} />
          <ToggleRow icon='�💳' label='Payment Reminders'
            description='Payment tracker dues, overdue alerts'
            checked={cfg.paymentReminders}
            onChange={(v) => update('paymentReminders', v)}
            disabled={!cfg.pushEnabled} />
          <ToggleRow icon='🛡️' label='Insurance Renewals'
            description='30d, 15d, 7d, 3d, 1d before renewal'
            checked={cfg.insuranceReminders}
            onChange={(v) => update('insuranceReminders', v)}
            disabled={!cfg.pushEnabled} />
          <ToggleRow icon='🎯' label='Goal Reminders'
            description='Milestones, deadlines, monthly contributions'
            checked={cfg.goalReminders}
            onChange={(v) => update('goalReminders', v)}
            disabled={!cfg.pushEnabled} />
          <ToggleRow icon='💸' label='EMI & Loan Reminders'
            description='Due dates and overdue liability alerts'
            checked={cfg.emiReminders}
            onChange={(v) => update('emiReminders', v)}
            disabled={!cfg.pushEnabled} />
          <ToggleRow icon='🤝' label='Lending Reminders'
            description='Borrower repayment dues and overdue'
            checked={cfg.lendingReminders}
            onChange={(v) => update('lendingReminders', v)}
            disabled={!cfg.pushEnabled} />
          <ToggleRow icon='📅' label='SIP Reminders'
            description='Monthly investment reminder on 5th'
            checked={cfg.sipReminders}
            onChange={(v) => update('sipReminders', v)}
            disabled={!cfg.pushEnabled} />
          <ToggleRow icon='📈' label='Investment Alerts'
            description='Maturity alerts, FD/bond upcoming'
            checked={cfg.investmentAlerts}
            onChange={(v) => update('investmentAlerts', v)}
            disabled={!cfg.pushEnabled} />
          <ToggleRow icon='⏳' label='Subscription Alerts'
            description='Trial ending, expiry, billing reminders'
            checked={cfg.subscriptionAlerts}
            onChange={(v) => update('subscriptionAlerts', v)}
            disabled={!cfg.pushEnabled} />
          <ToggleRow icon='🌾' label='Agriculture Reminders'
            description='Crop cycles, harvest, livestock events'
            checked={cfg.agricultureReminders}
            onChange={(v) => update('agricultureReminders', v)}
            disabled={!cfg.pushEnabled} />
          <ToggleRow icon='👷' label='Attendance Reminders'
            description='Salary due, advance tracking'
            checked={cfg.attendanceReminders}
            onChange={(v) => update('attendanceReminders', v)}
            disabled={!cfg.pushEnabled} />
          <ToggleRow icon='📊' label='Monthly Report Email'
            description='Email digest on 1st of each month'
            checked={cfg.monthlyReport}
            onChange={(v) => update('monthlyReport', v)} />
        </div>
      </div>

      {/* ── Quiet hours ───────────────────────────────────────────────── */}
      <div className='rounded-xl border border-slate-200/80 dark:border-slate-800/60 bg-white dark:bg-slate-900/60 overflow-hidden'>
        <div className='px-4 py-3 bg-slate-50/60 dark:bg-slate-800/30'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
            Quiet Hours
          </p>
        </div>
        <div className='px-4 pb-4'>
          <ToggleRow icon='🌙' label='Enable Quiet Hours'
            description='No push notifications during these hours'
            checked={cfg.quietHoursEnabled}
            onChange={(v) => update('quietHoursEnabled', v)} />
          {cfg.quietHoursEnabled && (
            <div className='flex items-center gap-4 mt-3'>
              <div className='flex-1'>
                <label className='block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5'>
                  From
                </label>
                <input
                  type='time'
                  value={cfg.quietHoursStart}
                  onChange={(e) => update('quietHoursStart', e.target.value)}
                  className='w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
                />
              </div>
              <div className='flex-1'>
                <label className='block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5'>
                  Until
                </label>
                <input
                  type='time'
                  value={cfg.quietHoursEnd}
                  onChange={(e) => update('quietHoursEnd', e.target.value)}
                  className='w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Save button ───────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={saving}
        className='flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-5 py-2.5 text-sm font-bold text-white transition-colors shadow-md shadow-emerald-500/15'
      >
        <FiSave className='h-4 w-4' />
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

      {/* ── Test Tools ────────────────────────────────────────────────── */}
      <div className='rounded-xl border border-indigo-400/30 bg-indigo-50/60 dark:border-indigo-500/20 dark:bg-indigo-900/10 p-5 space-y-4'>
        <div className='flex items-start gap-3'>
          <div className='h-9 w-9 shrink-0 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center'>
            <FiZap className='h-4 w-4 text-indigo-500' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-bold text-indigo-800 dark:text-indigo-300'>
              Email &amp; Reminder Test Tools
            </p>
            <p className='text-[11.5px] text-indigo-700/80 dark:text-indigo-400/80 mt-0.5'>
              Run the reminder engine instantly for your own account. No need to wait for the 30-minute scheduler.
              If you have NO matching data in a module, no email is sent (that is expected — see "NO MATCH" lines below).
            </p>
          </div>
        </div>

        <div className='flex flex-col sm:flex-row gap-3'>
          <button
            type='button'
            onClick={() => handleTestAll(false)}
            disabled={testing}
            className='flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-2.5 text-xs font-bold text-white transition-colors flex-1'
          >
            <FiPlay className='h-3.5 w-3.5' />
            {testing ? 'Running…' : 'Test All Reminders'}
          </button>
          <button
            type='button'
            onClick={() => handleTestAll(true)}
            disabled={testing}
            className='flex items-center justify-center gap-2 rounded-lg border border-indigo-400/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-60 px-4 py-2.5 text-xs font-bold transition-colors flex-1'
            title='Bypass "already sent today" dedup. Use this when clicking Test twice on the same day.'
          >
            <FiZap className='h-3.5 w-3.5' />
            Force Retest (Skip Dedup)
          </button>
          <button
            type='button'
            onClick={handleClearDedup}
            disabled={clearingDedup}
            className='flex items-center justify-center gap-2 rounded-lg border border-amber-400/60 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 disabled:opacity-60 px-4 py-2.5 text-xs font-bold transition-colors flex-1'
            title='Delete all "already sent" records so the 30-minute scheduler fires them again.'
          >
            <FiTrash2 className='h-3.5 w-3.5' />
            {clearingDedup ? 'Clearing…' : 'Reset Scheduler Dedup'}
          </button>
        </div>

        {lastTestResult && (
          <div className='rounded-lg border border-slate-300/70 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden'>
            <div className='flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-700'>
              <div className='flex items-center gap-2 min-w-0'>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                    lastTestResult.ok
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400'
                  }`}
                >
                  {lastTestResult.ok ? 'OK' : 'STOPPED'}
                </span>
                <p className='text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate'>
                  {lastTestResult.ok
                    ? `Results: ${(lastTestResult.results ?? []).length} line(s)${
                        lastTestResult.userEmail ? ` · email=${lastTestResult.userEmail}` : ''
                      }`
                    : lastTestResult.reason || 'No details'}
                </p>
              </div>
            </div>
            {lastTestResult.results && lastTestResult.results.length > 0 && (
              <div className='max-h-80 overflow-auto divide-y divide-slate-100 dark:divide-slate-800/60'>
                {lastTestResult.results.map((line, i) => {
                  const isSent = line.startsWith('SENT:');
                  const isFailed = line.startsWith('FAILED');
                  const isSkipped = line.startsWith('SKIPPED:');
                  const isNoMatch = line.startsWith('NO MATCH:');
                  const isInfo = line.startsWith('INFO (');
                  const isError = line.startsWith('ERROR (');
                  return (
                    <div
                      key={i}
                      className={`px-4 py-2 text-[11px] leading-relaxed font-mono break-all ${
                        isSent
                          ? 'bg-emerald-50/60 text-emerald-800 dark:bg-emerald-500/5 dark:text-emerald-300'
                          : isFailed
                          ? 'bg-rose-50/60 text-rose-800 dark:bg-rose-500/5 dark:text-rose-300'
                          : isSkipped
                          ? 'bg-amber-50/60 text-amber-800 dark:bg-amber-500/5 dark:text-amber-300'
                          : isNoMatch
                          ? 'text-slate-600 dark:text-slate-400'
                          : isError
                          ? 'bg-rose-100 text-rose-900 dark:bg-rose-500/10 dark:text-rose-300'
                          : isInfo
                          ? 'bg-sky-50/50 text-sky-800 dark:bg-sky-500/5 dark:text-sky-300'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}