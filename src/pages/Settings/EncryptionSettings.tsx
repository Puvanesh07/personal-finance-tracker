// ============================================================
//  src/pages/Settings/EncryptionSettings.tsx
//  Theme-aware (light / dark) — matches FinTrackly settings cards.
// ============================================================

import { SettingsLoader } from '../../components/ui/SectionLoader';
import {
  isEncryptionEnabled,
  migrateAllDataToEncrypted,
  migrateAllDataToPlain,
  setEncryptionEnabled,
} from '../../services/encryptionService';
import { useCallback, useEffect, useState } from 'react';

interface EncryptionSettingsProps {
  uid: string | null;
}

export function EncryptionSettings({ uid }: EncryptionSettingsProps) {
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [progressCol, setProgressCol] = useState('');
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!uid) return;
    isEncryptionEnabled(uid)
      .then((val) => setEnabledState(val))
      .catch(() => setEnabledState(true));
  }, [uid]);

  if (!uid) return null;

  const handleToggle = useCallback(async () => {
    if (!uid || enabled === null || migrating) return;
    const next = !enabled;
    try {
      await setEncryptionEnabled(uid, next);
      setEnabledState(next);
      setStatusMsg(
        next
          ? '✅ Encryption turned ON. New writes are encrypted. Click "Migrate" to encrypt existing data.'
          : '⚠️ Encryption turned OFF. New writes are plain. Click "Migrate" to decrypt existing data.',
      );
    } catch (e) {
      setStatusMsg('❌ Failed to update flag. Check console.');
      console.error(e);
    }
  }, [uid, enabled, migrating]);

  const handleMigrate = useCallback(async () => {
    if (!uid || enabled === null || migrating) return;
    setMigrating(true);
    setProgressCol('');
    setProgressDone(0);
    setProgressTotal(0);
    setStatusMsg('');

    const onProgress = (col: string, done: number, total: number) => {
      setProgressCol(col);
      setProgressDone(done);
      setProgressTotal(total);
    };

    try {
      if (enabled) {
        await migrateAllDataToEncrypted(uid, onProgress);
        setStatusMsg('✅ All existing data encrypted successfully!');
      } else {
        await migrateAllDataToPlain(uid, onProgress);
        setStatusMsg('✅ All existing data decrypted successfully!');
      }
    } catch (e) {
      setStatusMsg('❌ Migration failed. Check console for details.');
      console.error('[EncryptionSettings] migration error:', e);
    } finally {
      setMigrating(false);
      setProgressCol('');
    }
  }, [uid, enabled, migrating]);

  // All hooks above — single conditional return AFTER all hooks (Rules of Hooks)
  if (!uid) return null;

  const pct =
    progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0;

  return (
    <div className='max-w-xl rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60'>
      <div className='mb-4 flex items-center gap-3'>
        <span className='text-2xl' aria-hidden>
          🔐
        </span>
        <div>
          <h3 className='text-base font-bold text-slate-900 dark:text-slate-100'>
            Data Encryption
          </h3>
          <p className='text-xs text-slate-500 dark:text-slate-400'>
            AES-256-GCM · Key derived from your account
          </p>
        </div>
      </div>

      {enabled === null ? (
        <SettingsLoader />
      ) : (
        <>
          <div
            className={`mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold ${
              enabled
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-rose-500'}`}
            />
            {enabled ? 'Encryption is ON' : 'Encryption is OFF'}
          </div>

          <p className='mb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400'>
            When <strong className='text-slate-900 dark:text-slate-200'>ON</strong>
            , every document is encrypted client-side before leaving your browser
            using AES-256-GCM. The raw data in Firebase looks like random bytes.
            <br />
            <br />
            The flag <code className='rounded bg-slate-200 px-1 py-0.5 text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-200'>encryptionEnabled</code>{' '}
            lives at{' '}
            <code className='rounded bg-slate-200 px-1 py-0.5 text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-200'>
              users/{uid}/settings/config
            </code>
            . After toggling, click <strong className='text-slate-900 dark:text-slate-200'>Migrate</strong> to re-encrypt or decrypt all existing documents.
          </p>

          <div className='flex flex-wrap gap-3'>
            <button
              type='button'
              className='cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold text-slate-900 transition-opacity disabled:cursor-not-allowed disabled:opacity-50'
              style={{
                background: enabled ? '#fb7185' : '#34d399',
              }}
              onClick={handleToggle}
              disabled={migrating}
            >
              {enabled ? 'Turn OFF Encryption' : 'Turn ON Encryption'}
            </button>
            <button
              type='button'
              className='cursor-pointer rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              onClick={handleMigrate}
              disabled={migrating}
            >
              {migrating
                ? '⏳ Migrating…'
                : `Migrate existing data (${enabled ? 'encrypt' : 'decrypt'})`}
            </button>
          </div>

          {migrating && progressCol && (
            <div className='mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-slate-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-slate-200'>
              <div className='mb-1.5 text-slate-600 dark:text-slate-400'>
                Collection: <strong className='text-slate-900 dark:text-slate-100'>{progressCol}</strong>
              </div>
              <div className='h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700'>
                <div
                  className='h-full rounded-full bg-blue-500 transition-[width] duration-200'
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className='mt-1 text-xs text-slate-500 dark:text-slate-400'>
                {progressDone} / {progressTotal} documents ({pct}%)
              </div>
            </div>
          )}

          {statusMsg && (
            <p className='mt-4 text-sm text-slate-700 dark:text-slate-300'>
              {statusMsg}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default EncryptionSettings;
