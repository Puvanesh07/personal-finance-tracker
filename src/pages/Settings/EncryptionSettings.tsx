// ============================================================
//  src/components/settings/EncryptionSettings.tsx
//
//  NO external deps beyond firebase — no react-firebase-hooks needed.
//  Import and drop into your SettingsPage.tsx:
//
//    import { EncryptionSettings } from '../../components/settings/EncryptionSettings';
//    ...
//    <EncryptionSettings uid={currentUserId} />
// ============================================================

import {
  isEncryptionEnabled,
  migrateAllDataToEncrypted,
  migrateAllDataToPlain,
  setEncryptionEnabled,
} from '../../services/encryptionService';
import { useCallback, useEffect, useState } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EncryptionSettingsProps {
  /** Pass the Firebase uid from wherever you store auth state, e.g.:
   *    const { uid } = usePortfolioStore();
   *    <EncryptionSettings uid={uid} />
   */
  uid: string | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EncryptionSettings({ uid }: EncryptionSettingsProps) {
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [progressCol, setProgressCol] = useState('');
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');

  // Load current flag on mount
  useEffect(() => {
    if (!uid) return;
    isEncryptionEnabled(uid)
      .then((val) => setEnabledState(val))
      .catch(() => setEnabledState(true)); // Default ON on error
  }, [uid]);

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

  if (!uid) return null;

  const pct =
    progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0;

  return (
    <div
      style={{
        background: 'var(--color-surface, #1e1e2e)',
        border: '1px solid var(--color-border, #313244)',
        borderRadius: 12,
        padding: 24,
        maxWidth: 560,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 24 }}>🔐</span>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            Data Encryption
          </h3>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>
            AES-256-GCM · Key derived from your account
          </p>
        </div>
      </div>

      {enabled === null ? (
        <p style={{ opacity: 0.5 }}>Loading…</p>
      ) : (
        <>
          {/* Status badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 99,
              marginBottom: 20,
              background: enabled
                ? 'rgba(166,227,161,0.15)'
                : 'rgba(243,139,168,0.15)',
              color: enabled ? '#a6e3a1' : '#f38ba8',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: enabled ? '#a6e3a1' : '#f38ba8',
                display: 'inline-block',
              }}
            />
            {enabled ? 'Encryption is ON' : 'Encryption is OFF'}
          </div>

          {/* Description */}
          <p
            style={{
              fontSize: 13,
              opacity: 0.7,
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            When <strong>ON</strong>, every document is encrypted client-side
            before leaving your browser using AES-256-GCM. The raw data in
            Firebase looks like random bytes.
            <br />
            <br />
            The flag <code>encryptionEnabled</code> lives at{' '}
            <code>users/{uid}/settings/config</code>. After toggling, click{' '}
            <strong>Migrate</strong> to re-encrypt or decrypt all existing
            documents.
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              className='cursor-pointer'
              onClick={handleToggle}
              disabled={migrating}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                cursor: migrating ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 14,
                background: enabled ? '#f38ba8' : '#a6e3a1',
                color: '#1e1e2e',
                opacity: migrating ? 0.5 : 1,
              }}
            >
              {enabled ? 'Turn OFF Encryption' : 'Turn ON Encryption'}
            </button>

            <button
              className='cursor-pointer'
              onClick={handleMigrate}
              disabled={migrating}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid var(--color-border, #313244)',
                cursor: migrating ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 14,
                background: 'transparent',
                color: 'inherit',
                opacity: migrating ? 0.5 : 1,
              }}
            >
              {migrating
                ? '⏳ Migrating…'
                : `Migrate existing data (${enabled ? 'encrypt' : 'decrypt'})`}
            </button>
          </div>

          {/* Progress bar */}
          {migrating && progressCol && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 8,
                background: 'rgba(137,180,250,0.1)',
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 6, opacity: 0.7 }}>
                Collection: <strong>{progressCol}</strong>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: 3,
                    background: '#89b4fa',
                    width: `${pct}%`,
                    transition: 'width 0.2s',
                  }}
                />
              </div>
              <div style={{ marginTop: 4, opacity: 0.6 }}>
                {progressDone} / {progressTotal} documents ({pct}%)
              </div>
            </div>
          )}

          {/* Status message */}
          {statusMsg && (
            <p style={{ marginTop: 16, fontSize: 13 }}>{statusMsg}</p>
          )}
        </>
      )}
    </div>
  );
}

export default EncryptionSettings;
