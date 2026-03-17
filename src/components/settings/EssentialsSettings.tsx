import { FiSave, FiShield } from 'react-icons/fi';
import { useEffect, useState } from 'react';

import { NumericInput } from '../ui/NumericInput';
import { usePortfolioStore } from '../../store/portfolioStore';

export function EssentialsSettings() {
  const essentials = usePortfolioStore((s) => s.essentials);
  // 1. Bring back the setEssentialsConfig function from the store
  const setEssentialsConfig = usePortfolioStore((s) => s.setEssentialsConfig);

  const [local, setLocal] = useState({
    emergencyFundTarget: '0',
    emergencyFundCurrent: '0',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync state when store updates (Safely handling undefined on first load)
  useEffect(() => {
    setLocal({
      emergencyFundTarget: String(essentials?.emergencyFundTarget || 0),
      emergencyFundCurrent: String(essentials?.emergencyFundCurrent || 0),
    });
  }, [essentials?.emergencyFundTarget, essentials?.emergencyFundCurrent]);

  // 2. Add back the handleSave function
  const handleSave = async () => {
    setSaving(true);
    try {
      await setEssentialsConfig({
        emergencyFundTarget: Number(local.emergencyFundTarget) || 0,
        emergencyFundCurrent: Number(local.emergencyFundCurrent) || 0,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save essentials config:', error);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'mt-1 w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-100 outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20';
  const labelCls =
    'block text-xs font-bold uppercase tracking-wider text-slate-400';

  return (
    <div className='animate-in fade-in slide-in-from-bottom-2 duration-500'>
      <div className='mb-6'>
        <h2 className='flex items-center gap-2 text-xl font-bold text-slate-100'>
          <FiShield className='text-emerald-400' />
          Financial Essentials
        </h2>
        <p className='mt-1 text-sm text-slate-400'>
          Configure your emergency fund targets to track your financial safety
          net.
        </p>
      </div>

      <div className='rounded-2xl border border-slate-800 bg-slate-900/30 p-5 sm:p-6'>
        <div className='grid gap-6 sm:grid-cols-2'>
          {/* Emergency Fund Inputs */}
          <div>
            <label className={labelCls}>Emergency Fund Target (₹)</label>
            <p className='mb-2 text-xs text-slate-500'>
              Recommended: 6x Monthly Expenses
            </p>
            <NumericInput
              className={inputCls}
              value={local.emergencyFundTarget}
              onChange={(v) =>
                setLocal((s) => ({ ...s, emergencyFundTarget: v }))
              }
            />
          </div>

          <div>
            <label className={labelCls}>Current Emergency Fund (₹)</label>
            <p className='mb-2 text-xs text-slate-500'>
              How much you currently have saved
            </p>
            <NumericInput
              className={inputCls}
              value={local.emergencyFundCurrent}
              onChange={(v) =>
                setLocal((s) => ({ ...s, emergencyFundCurrent: v }))
              }
            />
          </div>
        </div>

        <div className='mt-8 flex items-center justify-between border-t border-slate-800/60 pt-6'>
          {success ? (
            <span className='text-sm font-medium text-emerald-400 animate-pulse'>
              Saved successfully!
            </span>
          ) : (
            <span />
          )}

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:hover:translate-y-0'
          >
            <FiSave className='h-4 w-4' />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
