/**
 * src/components/notifications/NotificationSettings.tsx
 *
 * Notification settings panel rendered inside the Settings page.
 *
 * HOW REMINDERS ACTUALLY WORK (this used to promise browser push, which the
 * app never delivered — see the removal of src/services/fcmService.ts):
 *
 *   1. In-app — the bell. Computed live from your data on this device
 *      (shared/alertRules.mjs + src/hooks/useDerivedNotifications.ts).
 *   2. Email — ONE consolidated digest per day, sent by a scheduled job at
 *      08:00 IST to the address on your account. The same rule engine decides
 *      the content, and the same category toggles below switch it on or off.
 *
 * The master switch is stored as `pushEnabled` because the cloud job and
 * existing user documents already use that field name. Renaming it would need
 * a data migration for no user-visible gain.
 */

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FiInfo, FiRefreshCw, FiSave } from 'react-icons/fi';
import { db, auth } from '../../services/firebase';
import { setNotificationSettingsCache } from '../../hooks/useNotificationSettings';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationSettingsConfig {
  /** Master switch for every reminder channel (in-app + email digest). */
  pushEnabled:         boolean;
  paymentReminders:    boolean;
  insuranceReminders:  boolean;
  goalReminders:       boolean;
  emiReminders:        boolean;
  sipReminders:        boolean;
  investmentAlerts:    boolean;
  subscriptionAlerts:  boolean;
  weeklyDigest:        boolean;
  monthlyReport:       boolean;
}

const DEFAULT_SETTINGS: NotificationSettingsConfig = {
  pushEnabled:         true,
  paymentReminders:    true,
  insuranceReminders:  true,
  goalReminders:       true,
  emiReminders:        true,
  sipReminders:        true,
  investmentAlerts:    true,
  subscriptionAlerts:  true,
  weeklyDigest:        true,
  monthlyReport:       true,
};

/** Fields we no longer collect. Removed from the UI (and from new writes)
 *  because nothing honoured them: quiet hours only make sense for a channel
 *  that can wake a phone, and the digest is a single 08:00 email. */
const RETIRED_FIELDS = ['quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd'];

// ── Firestore helpers ─────────────────────────────────────────────────────────

export async function loadNotificationSettings(
  uid: string,
): Promise<NotificationSettingsConfig> {
  const snap = await getDoc(doc(db, 'users', uid, 'notificationSettings', 'config'));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...(snap.data() as Partial<NotificationSettingsConfig>),
  };
}

async function saveSettings(uid: string, cfg: NotificationSettingsConfig): Promise<void> {
  const ref = doc(db, 'users', uid, 'notificationSettings', 'config');
  await setDoc(
    ref,
    { ...cfg, updatedAt: serverTimestamp(), ...Object.fromEntries(RETIRED_FIELDS.map((k) => [k, null])) },
    { merge: true },
  );
  // The bell reads the same values through a small in-memory store, so the
  // toggle takes effect on this device without a reload.
  setNotificationSettingsCache(uid, cfg);
}

// ── Toggle row component ──────────────────────────────────────────────────────

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  icon: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-3 border-b border-slate-200/60 dark:border-slate-800/60 last:border-0 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className='flex items-center gap-3 min-w-0'>
        {/* Use aria-hidden span so screen readers skip the decorative emoji */}
        <span className='text-base shrink-0 leading-none select-none' aria-hidden='true'>
          {icon}
        </span>
        <div className='min-w-0'>
          <p className='text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight'>
            {label}
          </p>
          {description && (
            <p className='text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed'>
              {description}
            </p>
          )}
        </div>
      </div>
      <button
        type='button'
        role='switch'
        aria-checked={checked}
        aria-label={`${label} ${checked ? 'on' : 'off'}`}
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
  const user = auth.currentUser;
  const uid = user?.uid;
  const email = user?.email ?? null;

  const [cfg, setCfg] = useState<NotificationSettingsConfig>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadNotificationSettings(uid)
      .then((s) => {
        if (!cancelled) setCfg(s);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load your notification settings.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const update = (key: keyof NotificationSettingsConfig, value: boolean) =>
    setCfg((prev) => ({ ...prev, [key]: value }));

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
      {/* ── Where reminders arrive ───────────────────────────────────── */}
      <div className='flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-900/10 p-4'>
        <FiInfo className='h-5 w-5 shrink-0 text-emerald-500 mt-0.5' />
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-bold text-emerald-800 dark:text-emerald-300'>
            Reminders appear in the bell, and once a day by email at 08:00 IST
          </p>
          <p className='text-[11.5px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed'>
            {email ? (
              <>
                The digest is sent to <strong>{email}</strong>.{' '}
              </>
            ) : null}
            Every toggle below applies to both — turn one off and it stops
            appearing in the bell as well as in the email.
          </p>
          <a
            href='/settings'
            className='inline-block mt-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline'
          >
            Change the email address in Settings → Profile
          </a>
        </div>
      </div>

      {/* ── Per-category toggles ─────────────────────────────────────── */}
      <div className='rounded-xl border border-slate-200/80 dark:border-slate-800/60 bg-white dark:bg-slate-900/60 overflow-hidden'>
        <div className='px-4 py-3 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-200/60 dark:border-slate-800/60'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
            Notification Categories
          </p>
        </div>
        <div className='px-4 divide-y divide-slate-100 dark:divide-slate-800/60'>
          <ToggleRow
            icon='🔔'
            label='Enable All Reminders'
            description='Master switch — turn OFF to pause every reminder. The individual toggles below keep their own state.'
            checked={cfg.pushEnabled}
            onChange={(v) => update('pushEnabled', v)}
          />
          <ToggleRow
            icon='💳'
            label='Payment Reminders'
            description='Payment tracker dues, overdue alerts, and receivables'
            checked={cfg.paymentReminders}
            onChange={(v) => update('paymentReminders', v)}
            disabled={!cfg.pushEnabled}
          />
          <ToggleRow
            icon='🛡️'
            label='Insurance Renewals'
            description='30 / 15 / 7 / 3 / 1 days before renewal — and expired policy alerts'
            checked={cfg.insuranceReminders}
            onChange={(v) => update('insuranceReminders', v)}
            disabled={!cfg.pushEnabled}
          />
          <ToggleRow
            icon='💸'
            label='EMI & Loan Reminders'
            description='Due dates and final-payment notices on your liabilities'
            checked={cfg.emiReminders}
            onChange={(v) => update('emiReminders', v)}
            disabled={!cfg.pushEnabled}
          />
          <ToggleRow
            icon='📈'
            label='Investment Alerts'
            description='FD / bond maturity upcoming and matured notifications'
            checked={cfg.investmentAlerts}
            onChange={(v) => update('investmentAlerts', v)}
            disabled={!cfg.pushEnabled}
          />
          <ToggleRow
            icon='🎯'
            label='Goal Reminders'
            description='Milestones reached and monthly contribution nudges (in-app)'
            checked={cfg.goalReminders}
            onChange={(v) => update('goalReminders', v)}
            disabled={!cfg.pushEnabled}
          />
          <ToggleRow
            icon='📅'
            label='SIP Reminders'
            description='Monthly SIP execution nudge and allocation mismatch (in-app)'
            checked={cfg.sipReminders}
            onChange={(v) => update('sipReminders', v)}
            disabled={!cfg.pushEnabled}
          />
          <ToggleRow
            icon='⏳'
            label='Subscription Alerts'
            description='Trial ending, plan expiry, and billing reminders (in-app)'
            checked={cfg.subscriptionAlerts}
            onChange={(v) => update('subscriptionAlerts', v)}
            disabled={!cfg.pushEnabled}
          />
        </div>
      </div>

      {/* ── Scheduled emails ─────────────────────────────────────────── */}
      <div className='rounded-xl border border-slate-200/80 dark:border-slate-800/60 bg-white dark:bg-slate-900/60 overflow-hidden'>
        <div className='px-4 py-3 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-200/60 dark:border-slate-800/60'>
          <p className='text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400'>
            Scheduled Emails
          </p>
        </div>
        <div className='px-4 divide-y divide-slate-100 dark:divide-slate-800/60'>
          <ToggleRow
            icon='📧'
            label='Daily Summary Email (08:00 IST)'
            description='One consolidated mail with everything due today. Nothing is mailed when nothing is due.'
            checked={cfg.pushEnabled}
            onChange={(v) => update('pushEnabled', v)}
          />
          <ToggleRow
            icon='📊'
            label='Monthly Report Email'
            description='Full portfolio summary mailed on the 1st of each month'
            checked={cfg.monthlyReport}
            onChange={(v) => update('monthlyReport', v)}
            disabled={!cfg.pushEnabled}
          />
        </div>
      </div>

      {/* ── Save button ──────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={saving}
        className='flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-5 py-2.5 text-sm font-bold text-white transition-colors shadow-md shadow-emerald-500/15'
      >
        <FiSave className='h-4 w-4' />
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

      {/* ── How reminders work ───────────────────────────────────────── */}
      <div className='rounded-xl border border-slate-200/80 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-800/30 p-5 space-y-3'>
        <p className='text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400'>
          What you will receive
        </p>
        <ul className='space-y-1 text-[12px] leading-relaxed text-slate-700 dark:text-slate-300'>
          <li>💳 Payment dues &amp; overdue warnings</li>
          <li>🛡️ Insurance renewal 30 / 15 / 7 / 3 / 1 days before</li>
          <li>🏦 EMI, loan and final-payment notices</li>
          <li>📈 Bonds &amp; fixed deposits maturing</li>
          <li>🎯 Goals, SIP and trial alerts — inside the app</li>
        </ul>
        <div className='rounded-lg border border-amber-400/40 bg-amber-50/70 dark:bg-amber-500/5 dark:border-amber-500/25 px-4 py-3'>
          <div className='flex items-start gap-2.5'>
            <FiInfo className='h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5' />
            <p className='text-[12px] leading-relaxed text-amber-800 dark:text-amber-300'>
              <span className='font-bold'>Tip:</span> If the first email does not
              appear, check your <span className='font-semibold'>Spam /
              Promotions</span> folder, mark it "Not spam" and add{' '}
              <span className='font-semibold'>fintracklysupport@gmail.com</span>{' '}
              to your contacts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
