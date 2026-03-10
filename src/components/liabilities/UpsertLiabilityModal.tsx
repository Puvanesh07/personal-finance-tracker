import { useEffect, useMemo, useState } from 'react'
import type { Liability, LiabilityType } from '../../types/investmentTypes'
import { Modal } from '../ui/Modal'
import { usePortfolioStore } from '../../store/portfolioStore'
import { FiPlus, FiSave } from 'react-icons/fi'

type Props =
  | { open: boolean; onClose: () => void; mode: 'create'; liability?: undefined }
  | { open: boolean; onClose: () => void; mode: 'edit'; liability: Liability }

type FormState = {
  type: LiabilityType
  name: string
  principal: string
  outstanding: string
  interestRate: string
}

function toNum(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function UpsertLiabilityModal(props: Props) {
  const addLiability = usePortfolioStore((s) => s.addLiability)
  const updateLiability = usePortfolioStore((s) => s.updateLiability)

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      type: 'loan',
      name: '',
      principal: '0',
      outstanding: '0',
      interestRate: '',
    }
    if (props.mode === 'edit') {
      base.type = props.liability.type
      base.name = props.liability.name
      base.principal = String(props.liability.principal)
      base.outstanding = String(props.liability.outstanding)
      base.interestRate = props.liability.interestRate == null ? '' : String(props.liability.interestRate)
    }
    return base
  }, [props.mode, (props as any).liability])

  const [state, setState] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (props.open) setState(initial)
  }, [props.open, initial])

  async function onSubmit() {
    setSaving(true)
    try {
      const payload = {
        type: state.type,
        name: state.name.trim(),
        principal: toNum(state.principal),
        outstanding: toNum(state.outstanding),
        ...(state.interestRate.trim() ? { interestRate: toNum(state.interestRate) } : {}),
      }
      if (props.mode === 'create') await addLiability(payload as any)
      else await updateLiability(props.liability.id, payload as any)
      props.onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:border-emerald-500'
  const labelCls = 'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block'

  return (
    <Modal open={props.open} onClose={props.onClose} title={props.mode === 'create' ? 'Add Liability' : 'Edit Liability'}>
      <div className="grid grid-cols-1 gap-5">
        {props.mode === 'create' ? (
          <label className="block">
            <span className={labelCls}>Liability Type</span>
            <select
              className={`${inputCls} appearance-none`}
              value={state.type}
              onChange={(e) => setState((s) => ({ ...s, type: e.target.value as LiabilityType }))}
            >
              <option value="loan">Loan</option>
              <option value="credit_card">Credit Card</option>
              <option value="other">Other</option>
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className={labelCls}>Name</span>
          <input
            className={inputCls}
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g. Home loan, Car loan"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Principal Amount</span>
            <input
              inputMode="decimal"
              className={inputCls}
              value={state.principal}
              onChange={(e) => setState((s) => ({ ...s, principal: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Outstanding Balance</span>
            <input
              inputMode="decimal"
              className={inputCls}
              value={state.outstanding}
              onChange={(e) => setState((s) => ({ ...s, outstanding: e.target.value }))}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelCls}>Interest Rate (% p.a., Optional)</span>
          <input
            inputMode="decimal"
            className={inputCls}
            value={state.interestRate}
            onChange={(e) => setState((s) => ({ ...s, interestRate: e.target.value }))}
            placeholder="e.g. 9.25"
          />
        </label>

        <div className="mt-4 flex items-center justify-end gap-3 border-t border-slate-200/60 pt-5 dark:border-slate-800/60">
          <button
            type="button"
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            onClick={props.onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 disabled:opacity-60 disabled:hover:translate-y-0"
            onClick={() => void onSubmit()}
            disabled={saving || !state.name.trim()}
          >
            {saving ? (
              <><FiSave className="h-4 w-4" /><span>Saving…</span></>
            ) : props.mode === 'create' ? (
              <><FiPlus className="h-4 w-4" /><span>Add Liability</span></>
            ) : (
              <><FiSave className="h-4 w-4" /><span>Save Changes</span></>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}