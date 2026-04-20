// src/components/insurance/UpsertInsuranceModal.tsx
//
// ENHANCED:
//  1. Added LIC / traditional policy fields: policy number, sum assured,
//     policy term (years), premium paying term, commencement date, maturity date,
//     mode of payment, bonus type, agent name/code
//  2. Fields shown conditionally based on insurance type
//  3. All fields optional so existing simple policies still work

import { FiInfo, FiSave } from 'react-icons/fi';
import type {
  InsurancePolicy,
  InsuranceType,
} from '../../types/investmentTypes';
import { useEffect, useMemo, useState } from 'react';

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
  premiumFrequency: 'monthly' | 'yearly' | 'quarterly' | 'half-yearly';
  renewalDate: string;
  nominee: string;
  notes: string;
  // Extended / LIC fields
  policyNumber: string;
  commencementDate: string;
  maturityDate: string;
  policyTermYears: string;
  premiumPayingTermYears: string;
  sumAssured: string;
  bonusType: string;
  agentName: string;
  agentCode: string;
  modeOfPayment: string;
};

const toNum = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Whether to show LIC/traditional fields
const isTraditional = (type: InsuranceType) => type === 'life';

const PAYMENT_MODES = [
  'ECS / Auto-debit',
  'Cheque',
  'Online / Net Banking',
  'Cash',
  'Credit Card',
];
const BONUS_TYPES = [
  'Simple Reversionary Bonus',
  'Compound Reversionary Bonus',
  'Final Additional Bonus',
  'None',
];

export function UpsertInsuranceModal(props: Props) {
  const addPolicy = usePortfolioStore((s) => s.addInsurancePolicy);
  const updatePolicy = usePortfolioStore((s) => s.updateInsurancePolicy);

  const initial = useMemo<FormState>(() => {
    if (props.mode === 'edit') {
      const e = props.entry as any;
      return {
        type: e.type,
        provider: e.provider,
        policyName: e.policyName,
        coverageAmount: String(e.coverageAmount),
        premiumAmount: String(e.premiumAmount),
        premiumFrequency: e.premiumFrequency,
        renewalDate: e.renewalDate,
        nominee: e.nominee || '',
        notes: e.notes || '',
        policyNumber: e.policyNumber || '',
        commencementDate: e.commencementDate || '',
        maturityDate: e.maturityDate || '',
        policyTermYears: e.policyTermYears ? String(e.policyTermYears) : '',
        premiumPayingTermYears: e.premiumPayingTermYears
          ? String(e.premiumPayingTermYears)
          : '',
        sumAssured: e.sumAssured ? String(e.sumAssured) : '',
        bonusType: e.bonusType || '',
        agentName: e.agentName || '',
        agentCode: e.agentCode || '',
        modeOfPayment: e.modeOfPayment || '',
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
      policyNumber: '',
      commencementDate: '',
      maturityDate: '',
      policyTermYears: '',
      premiumPayingTermYears: '',
      sumAssured: '',
      bonusType: '',
      agentName: '',
      agentCode: '',
      modeOfPayment: '',
    };
  }, [props.mode, props.entry]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = (patch: Partial<FormState>) =>
    setState((s) => ({ ...s, ...patch }));

  useEffect(() => {
    if (props.open) {
      setState(initial);
      setShowAdvanced(false);
    }
  }, [props.open, initial]);

  async function onSubmit() {
    setSaving(true);
    try {
      const payload: any = {
        type: state.type,
        provider: state.provider.trim(),
        policyName: state.policyName.trim(),
        coverageAmount: toNum(state.coverageAmount),
        premiumAmount: toNum(state.premiumAmount),
        premiumFrequency: state.premiumFrequency,
        renewalDate: state.renewalDate,
        ...(state.nominee.trim() ? { nominee: state.nominee.trim() } : {}),
        ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
        // Extended fields (save if present)
        ...(state.policyNumber.trim()
          ? { policyNumber: state.policyNumber.trim() }
          : {}),
        ...(state.commencementDate
          ? { commencementDate: state.commencementDate }
          : {}),
        ...(state.maturityDate ? { maturityDate: state.maturityDate } : {}),
        ...(state.policyTermYears
          ? { policyTermYears: Number(state.policyTermYears) }
          : {}),
        ...(state.premiumPayingTermYears
          ? { premiumPayingTermYears: Number(state.premiumPayingTermYears) }
          : {}),
        ...(state.sumAssured ? { sumAssured: toNum(state.sumAssured) } : {}),
        ...(state.bonusType ? { bonusType: state.bonusType } : {}),
        ...(state.agentName.trim()
          ? { agentName: state.agentName.trim() }
          : {}),
        ...(state.agentCode.trim()
          ? { agentCode: state.agentCode.trim() }
          : {}),
        ...(state.modeOfPayment ? { modeOfPayment: state.modeOfPayment } : {}),
      };

      if (props.mode === 'create') await addPolicy(payload);
      else await updatePolicy(props.entry.id, payload);

      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-500 dark:text-slate-600';
  const labelCls =
    'text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-500 mb-1.5 block';
  const sectionLabel =
    'text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-500 col-span-2 mt-2 pb-1 border-b border-slate-200/70 dark:border-slate-800/60';

  const showLicFields = isTraditional(state.type);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={
        props.mode === 'create' ? '🛡 Add Insurance Policy' : 'Edit Policy'
      }
    >
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        {/* ── Basic Fields ── */}
        <div>
          <label className={labelCls}>Policy Type</label>
          <select
            className={inputCls}
            value={state.type}
            onChange={(e) => set({ type: e.target.value as InsuranceType })}
          >
            <option value='life'>Life / Term (LIC, HDFC Life…)</option>
            <option value='health'>Health / Medical</option>
            <option value='vehicle'>Vehicle (Car / Bike)</option>
            <option value='property'>Property / Home</option>
            <option value='other'>Other</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Provider / Company</label>
          <input
            className={inputCls}
            value={state.provider}
            onChange={(e) => set({ provider: e.target.value })}
            placeholder='e.g. LIC, HDFC Ergo, Max Life'
            list='provider-list'
          />
          <datalist id='provider-list'>
            {[
              'LIC',
              'HDFC Life',
              'ICICI Prudential',
              'SBI Life',
              'Max Life',
              'Bajaj Allianz',
              'Tata AIA',
              'HDFC Ergo',
              'Star Health',
              'Niva Bupa',
            ].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

        <div className='md:col-span-2'>
          <label className={labelCls}>Policy Name / Plan</label>
          <input
            className={inputCls}
            value={state.policyName}
            onChange={(e) => set({ policyName: e.target.value })}
            placeholder={
              showLicFields
                ? 'e.g. Jeevan Anand, Tech Term, New Endowment…'
                : 'e.g. Optima Secure, Comprehensive'
            }
          />
        </div>

        {/* Sum Assured vs Coverage */}
        <div>
          <label className={labelCls}>
            {showLicFields ? 'Sum Assured (₹)' : 'Coverage Amount (₹)'}
          </label>
          <NumericInput
            className={inputCls}
            value={state.coverageAmount}
            onChange={(v) => set({ coverageAmount: v })}
          />
        </div>

        <div>
          <label className={labelCls}>Premium Amount (₹)</label>
          <NumericInput
            className={inputCls}
            value={state.premiumAmount}
            onChange={(v) => set({ premiumAmount: v })}
          />
        </div>

        <div>
          <label className={labelCls}>Premium Frequency</label>
          <select
            className={inputCls}
            value={state.premiumFrequency}
            onChange={(e) =>
              set({
                premiumFrequency: e.target
                  .value as FormState['premiumFrequency'],
              })
            }
          >
            <option value='yearly'>Yearly</option>
            <option value='half-yearly'>Half-Yearly</option>
            <option value='quarterly'>Quarterly</option>
            <option value='monthly'>Monthly</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Next Renewal / Due Date</label>
          <input
            type='date'
            className={inputCls}
            value={state.renewalDate}
            onChange={(e) => set({ renewalDate: e.target.value })}
          />
        </div>

        <div className='md:col-span-2'>
          <label className={labelCls}>Nominee Name (Optional)</label>
          <input
            className={inputCls}
            value={state.nominee}
            onChange={(e) => set({ nominee: e.target.value })}
            placeholder='e.g. Spouse / Parent name'
          />
        </div>

        {/* ── LIC / Traditional Policy Section ── */}
        {showLicFields && (
          <>
            <div className='md:col-span-2'>
              <button
                type='button'
                onClick={() => setShowAdvanced((v) => !v)}
                className='flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors mt-1'
              >
                <FiInfo className='h-3.5 w-3.5' />
                {showAdvanced ? '▲ Hide' : '▼ Show'} LIC / Traditional Policy
                Details
              </button>
            </div>

            {showAdvanced && (
              <>
                <div className={sectionLabel}>Policy Details</div>

                <div>
                  <label className={labelCls}>Policy Number</label>
                  <input
                    className={inputCls}
                    value={state.policyNumber}
                    onChange={(e) => set({ policyNumber: e.target.value })}
                    placeholder='e.g. 123456789'
                  />
                </div>

                <div>
                  <label className={labelCls}>Policy Term (Years)</label>
                  <input
                    type='number'
                    className={inputCls}
                    value={state.policyTermYears}
                    onChange={(e) => set({ policyTermYears: e.target.value })}
                    placeholder='e.g. 20'
                    min={1}
                    max={40}
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    Premium Paying Term (Years)
                  </label>
                  <input
                    type='number'
                    className={inputCls}
                    value={state.premiumPayingTermYears}
                    onChange={(e) =>
                      set({ premiumPayingTermYears: e.target.value })
                    }
                    placeholder='e.g. 15'
                    min={1}
                    max={40}
                  />
                </div>

                <div>
                  <label className={labelCls}>Sum Assured (if different)</label>
                  <NumericInput
                    className={inputCls}
                    value={state.sumAssured}
                    onChange={(v) => set({ sumAssured: v })}
                  />
                </div>

                <div>
                  <label className={labelCls}>Commencement Date</label>
                  <input
                    type='date'
                    className={inputCls}
                    value={state.commencementDate}
                    onChange={(e) => set({ commencementDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className={labelCls}>Maturity Date</label>
                  <input
                    type='date'
                    className={inputCls}
                    value={state.maturityDate}
                    onChange={(e) => set({ maturityDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className={labelCls}>Mode of Payment</label>
                  <select
                    className={inputCls}
                    value={state.modeOfPayment}
                    onChange={(e) => set({ modeOfPayment: e.target.value })}
                  >
                    <option value=''>Select…</option>
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Bonus Type</label>
                  <select
                    className={inputCls}
                    value={state.bonusType}
                    onChange={(e) => set({ bonusType: e.target.value })}
                  >
                    <option value=''>Select…</option>
                    {BONUS_TYPES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={sectionLabel}>Agent Details (Optional)</div>

                <div>
                  <label className={labelCls}>Agent Name</label>
                  <input
                    className={inputCls}
                    value={state.agentName}
                    onChange={(e) => set({ agentName: e.target.value })}
                    placeholder='Agent / Advisor name'
                  />
                </div>

                <div>
                  <label className={labelCls}>Agent Code</label>
                  <input
                    className={inputCls}
                    value={state.agentCode}
                    onChange={(e) => set({ agentCode: e.target.value })}
                    placeholder='Agent code / ID'
                  />
                </div>
              </>
            )}
          </>
        )}

        <div className='md:col-span-2'>
          <label className={labelCls}>Notes (Optional)</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={state.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder='Any additional notes about this policy…'
          />
        </div>
      </div>

      <div className='mt-6 flex items-center justify-end gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-5'>
        <button
          type='button'
          className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-200 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-60'
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
