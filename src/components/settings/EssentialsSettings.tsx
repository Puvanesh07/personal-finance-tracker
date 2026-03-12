import { useEffect, useState } from 'react';

import { Card } from '../ui/Card';
import { FiShield } from 'react-icons/fi';
import { NumericInput } from '../ui/NumericInput';
import { usePortfolioStore } from '../../store/portfolioStore';

function EssentialField({
  label,
  storedValue,
  onSave,
  inputCls,
  labelCls,
}: {
  label: string;
  storedValue: number | undefined;
  onSave: (n: number | undefined) => void;
  inputCls: string;
  labelCls: string;
}) {
  const [localVal, setLocalVal] = useState(
    storedValue != null && storedValue > 0 ? String(storedValue) : '0',
  );

  // FIX: re-sync local state when store value changes externally
  // (e.g. after clearAllData resets essentials to {})
  useEffect(() => {
    setLocalVal(
      storedValue != null && storedValue > 0 ? String(storedValue) : '0',
    );
  }, [storedValue]);

  function handleBlur() {
    const n = parseFloat(localVal);
    onSave(Number.isFinite(n) && n > 0 ? n : undefined);
  }

  return (
    <label className='block'>
      <span className={labelCls}>{label}</span>
      <NumericInput
        className={inputCls}
        value={localVal}
        onChange={setLocalVal}
        onBlur={handleBlur}
        placeholder='e.g. 10,00,000'
      />
    </label>
  );
}

export function EssentialsSettings() {
  const essentials = usePortfolioStore((s) => s.essentials);
  const setEssentialsConfig = usePortfolioStore((s) => s.setEssentialsConfig);

  const inputCls =
    'w-full rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:border-emerald-500';
  const labelCls =
    'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block';

  return (
    <Card
      title={
        <div className='flex items-center gap-2'>
          <div className='rounded-lg bg-emerald-100/50 p-1.5 dark:bg-emerald-500/10'>
            <FiShield className='h-4 w-4 text-emerald-600 dark:text-emerald-400' />
          </div>
          <span>Essentials & Safety Net</span>
        </div>
      }
    >
      <div className='flex flex-col gap-5'>
        <EssentialField
          label='Term Insurance Cover (₹)'
          storedValue={essentials.termInsuranceCover}
          onSave={(n) => void setEssentialsConfig({ termInsuranceCover: n })}
          inputCls={inputCls}
          labelCls={labelCls}
        />
        <EssentialField
          label='Health Cover (₹)'
          storedValue={essentials.healthCover}
          onSave={(n) => void setEssentialsConfig({ healthCover: n })}
          inputCls={inputCls}
          labelCls={labelCls}
        />

        <div className='h-px w-full bg-slate-200/60 dark:bg-slate-800/60' />

        <EssentialField
          label='Emergency Fund Target (₹)'
          storedValue={essentials.emergencyFundTarget}
          onSave={(n) => void setEssentialsConfig({ emergencyFundTarget: n })}
          inputCls={inputCls}
          labelCls={labelCls}
        />
        <EssentialField
          label='Emergency Fund Saved (₹)'
          storedValue={essentials.emergencyFundCurrent}
          onSave={(n) =>
            void setEssentialsConfig({ emergencyFundCurrent: n ?? 0 })
          }
          inputCls={inputCls}
          labelCls={labelCls}
        />
      </div>
    </Card>
  );
}
