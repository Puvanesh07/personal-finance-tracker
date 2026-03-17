import type {
  InsurancePolicy,
  InsuranceType,
} from '../../types/investmentTypes';
import { useEffect, useMemo, useState } from 'react';

import { FiSave } from 'react-icons/fi';
import { Modal } from '../ui/Modal';
import { NumericInput } from '../ui/NumericInput';
import { todayISO } from '../../utils/dateUtils';
import { usePortfolioStore } from '../../store/portfolioStore';

type Props =
  | { open: boolean; onClose: () => void; mode: 'create'; entry?: undefined }
  | {
      open: boolean;
      onClose: () => void;
      mode: 'edit';
      entry: InsurancePolicy;
    };

type FormState = {
  type: InsuranceType;
  provider: string;
  policyName: string;
  coverageAmount: string;
  premiumAmount: string;
  premiumFrequency: 'monthly' | 'yearly';
  renewalDate: string;
  nominee: string;
  notes: string;
};

const toNum = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function UpsertInsuranceModal(props: Props) {
  const addPolicy = usePortfolioStore((s) => s.addInsurancePolicy);
  const updatePolicy = usePortfolioStore((s) => s.updateInsurancePolicy);

  const initial = useMemo<FormState>(() => {
    if (props.mode === 'edit') {
      return {
        type: props.entry.type,
        provider: props.entry.provider,
        policyName: props.entry.policyName,
        coverageAmount: String(props.entry.coverageAmount),
        premiumAmount: String(props.entry.premiumAmount),
        premiumFrequency: props.entry.premiumFrequency,
        renewalDate: props.entry.renewalDate,
        nominee: props.entry.nominee || '',
        notes: props.entry.notes || '',
      };
    }
    return {
      type: 'life',
      provider: '',
      policyName: '',
      coverageAmount: '0',
      premiumAmount: '0',
      premiumFrequency: 'yearly',
      renewalDate: todayISO(),
      nominee: '',
      notes: '',
    };
  }, [props.mode, props.entry]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (props.open) setState(initial);
  }, [props.open, initial]);

  async function onSubmit() {
    setSaving(true);
    try {
      const payload = {
        type: state.type,
        provider: state.provider.trim(),
        policyName: state.policyName.trim(),
        coverageAmount: toNum(state.coverageAmount),
        premiumAmount: toNum(state.premiumAmount),
        premiumFrequency: state.premiumFrequency,
        renewalDate: state.renewalDate,
        ...(state.nominee.trim() ? { nominee: state.nominee.trim() } : {}),
        ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
      };

      if (props.mode === 'create') await addPolicy(payload);
      else await updatePolicy(props.entry.id, payload);

      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-600';
  const labelCls =
    'text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block';

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === 'create' ? 'Add Insurance Policy' : 'Edit Policy'}
    >
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div>
          <label className={labelCls}>Policy Type</label>
          <select
            className={inputCls}
            value={state.type}
            onChange={(e) =>
              setState((s) => ({ ...s, type: e.target.value as InsuranceType }))
            }
          >
            <option value='life'>Life / Term</option>
            <option value='health'>Health / Medical</option>
            <option value='vehicle'>Vehicle (Car/Bike)</option>
            <option value='property'>Property</option>
            <option value='other'>Other</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Provider (e.g., LIC, HDFC Ergo)</label>
          <input
            className={inputCls}
            value={state.provider}
            onChange={(e) =>
              setState((s) => ({ ...s, provider: e.target.value }))
            }
            placeholder='Company Name'
          />
        </div>

        <div className='md:col-span-2'>
          <label className={labelCls}>Policy Name / Identifier</label>
          <input
            className={inputCls}
            value={state.policyName}
            onChange={(e) =>
              setState((s) => ({ ...s, policyName: e.target.value }))
            }
            placeholder='e.g. Optima Secure'
          />
        </div>

        <div>
          <label className={labelCls}>Coverage Amount (₹)</label>
          <NumericInput
            className={inputCls}
            value={state.coverageAmount}
            onChange={(v) => setState((s) => ({ ...s, coverageAmount: v }))}
          />
        </div>

        <div>
          <label className={labelCls}>Premium Amount (₹)</label>
          <NumericInput
            className={inputCls}
            value={state.premiumAmount}
            onChange={(v) => setState((s) => ({ ...s, premiumAmount: v }))}
          />
        </div>

        <div>
          <label className={labelCls}>Premium Frequency</label>
          <select
            className={inputCls}
            value={state.premiumFrequency}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                premiumFrequency: e.target.value as 'monthly' | 'yearly',
              }))
            }
          >
            <option value='yearly'>Yearly</option>
            <option value='monthly'>Monthly</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Next Renewal Date</label>
          <input
            type='date'
            className={inputCls}
            value={state.renewalDate}
            onChange={(e) =>
              setState((s) => ({ ...s, renewalDate: e.target.value }))
            }
          />
        </div>

        <div className='md:col-span-2'>
          <label className={labelCls}>Nominee (Optional)</label>
          <input
            className={inputCls}
            value={state.nominee}
            onChange={(e) =>
              setState((s) => ({ ...s, nominee: e.target.value }))
            }
            placeholder='Nominee Name'
          />
        </div>
      </div>

      <div className='mt-6 flex items-center justify-end gap-3 border-t border-slate-800/60 pt-5'>
        <button
          type='button'
          className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 hover:bg-slate-800'
          onClick={props.onClose}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type='button'
          className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60'
          onClick={onSubmit}
          disabled={
            saving ||
            !state.provider ||
            !state.policyName ||
            toNum(state.premiumAmount) <= 0
          }
        >
          <FiSave className='h-4 w-4' />
          <span>{saving ? 'Saving…' : 'Save Policy'}</span>
        </button>
      </div>
    </Modal>
  );
}
