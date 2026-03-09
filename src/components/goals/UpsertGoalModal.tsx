import { useEffect, useMemo, useState } from 'react'
import type { Goal } from '../../types/investmentTypes'
import { Modal } from '../ui/Modal'
import { usePortfolioStore } from '../../store/portfolioStore'

type Props =
  | { open: boolean; onClose: () => void; mode: 'create'; goal?: undefined }
  | { open: boolean; onClose: () => void; mode: 'edit'; goal: Goal }

type FormState = {
  name: string
  targetAmount: string
  currentAmount: string
  dueDate: string
}

function toNum(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function UpsertGoalModal(props: Props) {
  const addGoal = usePortfolioStore((s) => s.addGoal)
  const updateGoal = usePortfolioStore((s) => s.updateGoal)

  const initial = useMemo<FormState>(() => {
    const base: FormState = { name: '', targetAmount: '0', currentAmount: '0', dueDate: '' }
    if (props.mode === 'edit') {
      base.name = props.goal.name
      base.targetAmount = String(props.goal.targetAmount)
      base.currentAmount = String(props.goal.currentAmount)
      base.dueDate = props.goal.dueDate ?? ''
    }
    return base
  }, [props.mode, (props as any).goal])

  const [state, setState] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (props.open) setState(initial)
  }, [props.open, initial])

  async function onSubmit() {
    setSaving(true)
    try {
      const payload = {
        name: state.name.trim(),
        targetAmount: toNum(state.targetAmount),
        currentAmount: toNum(state.currentAmount),
        dueDate: state.dueDate || undefined,
      }
      if (props.mode === 'create') await addGoal(payload as any)
      else await updateGoal(props.goal.id, payload as any)
      props.onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={props.open} onClose={props.onClose} title={props.mode === 'create' ? 'Add goal' : 'Edit goal'}>
      <div className="grid grid-cols-1 gap-4">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-slate-600">Name</span>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g. Retirement, Emergency fund, Child education"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Target amount</span>
            <input
              inputMode="decimal"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
              value={state.targetAmount}
              onChange={(e) => setState((s) => ({ ...s, targetAmount: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Current amount</span>
            <input
              inputMode="decimal"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
              value={state.currentAmount}
              onChange={(e) => setState((s) => ({ ...s, currentAmount: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Due date (optional)</span>
            <input
              type="date"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
              value={state.dueDate}
              onChange={(e) => setState((s) => ({ ...s, dueDate: e.target.value }))}
            />
          </label>
        </div>

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
            disabled={saving || !state.name.trim() || toNum(state.targetAmount) <= 0}
          >
            {saving ? 'Saving…' : props.mode === 'create' ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

