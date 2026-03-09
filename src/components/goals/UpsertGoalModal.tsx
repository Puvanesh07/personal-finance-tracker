import { useEffect, useMemo, useState } from 'react'
import type { Goal } from '../../types/investmentTypes'
import { Modal } from '../ui/Modal'
import { usePortfolioStore } from '../../store/portfolioStore'
import { FiPlus, FiSave } from 'react-icons/fi'

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

  const inputCls = 'w-full rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:border-emerald-500'
  const labelCls = 'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block'

  return (
    <Modal open={props.open} onClose={props.onClose} title={props.mode === 'create' ? 'Add Goal' : 'Edit Goal'}>
      <div className="grid grid-cols-1 gap-5">
        <label className="block">
          <span className={labelCls}>Goal Name</span>
          <input
            className={inputCls}
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g. Retirement, Emergency fund, Child education"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className={labelCls}>Target Amount</span>
            <input
              inputMode="decimal"
              className={inputCls}
              value={state.targetAmount}
              onChange={(e) => setState((s) => ({ ...s, targetAmount: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Current Amount</span>
            <input
              inputMode="decimal"
              className={inputCls}
              value={state.currentAmount}
              onChange={(e) => setState((s) => ({ ...s, currentAmount: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Due Date (Optional)</span>
            <input
              type="date"
              className={inputCls}
              value={state.dueDate}
              onChange={(e) => setState((s) => ({ ...s, dueDate: e.target.value }))}
            />
          </label>
        </div>

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
            disabled={saving || !state.name.trim() || toNum(state.targetAmount) <= 0}
          >
            {saving ? (
              <><FiSave className="h-4 w-4" /><span>Saving…</span></>
            ) : props.mode === 'create' ? (
              <><FiPlus className="h-4 w-4" /><span>Add Goal</span></>
            ) : (
              <><FiSave className="h-4 w-4" /><span>Save Changes</span></>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}