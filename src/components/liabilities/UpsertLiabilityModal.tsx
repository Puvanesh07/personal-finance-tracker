import { useEffect, useMemo, useState } from 'react'
import type { Liability, LiabilityType } from '../../types/investmentTypes'
import { Modal } from '../ui/Modal'
import { usePortfolioStore } from '../../store/portfolioStore'

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
        interestRate: state.interestRate.trim() ? toNum(state.interestRate) : undefined,
      }
      if (props.mode === 'create') await addLiability(payload as any)
      else await updateLiability(props.liability.id, payload as any)
      props.onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={props.open} onClose={props.onClose} title={props.mode === 'create' ? 'Add liability' : 'Edit liability'}>
      <div className="grid grid-cols-1 gap-4">
        {props.mode === 'create' ? (
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Type</span>
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
              value={state.type}
              onChange={(e) => setState((s) => ({ ...s, type: e.target.value as LiabilityType }))}
            >
              <option value="loan">Loan</option>
              <option value="credit_card">Credit card</option>
              <option value="other">Other</option>
            </select>
          </label>
        ) : null}

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-slate-600">Name</span>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g. Home loan, Car loan"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Principal</span>
            <input
              inputMode="decimal"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
              value={state.principal}
              onChange={(e) => setState((s) => ({ ...s, principal: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Outstanding</span>
            <input
              inputMode="decimal"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
              value={state.outstanding}
              onChange={(e) => setState((s) => ({ ...s, outstanding: e.target.value }))}
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-slate-600">Interest rate (% p.a., optional)</span>
          <input
            inputMode="decimal"
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
            value={state.interestRate}
            onChange={(e) => setState((s) => ({ ...s, interestRate: e.target.value }))}
            placeholder="e.g. 9.25"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={props.onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            onClick={() => void onSubmit()}
            disabled={saving || !state.name.trim()}
          >
            {saving ? 'Saving…' : props.mode === 'create' ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

