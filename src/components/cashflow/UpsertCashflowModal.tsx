import { useEffect, useMemo, useState } from 'react'
import type { CashflowEntry, CashflowType } from '../../types/investmentTypes'
import { Modal } from '../ui/Modal'
import { usePortfolioStore } from '../../store/portfolioStore'
import { todayISO } from '../../utils/dateUtils'

type Props =
  | { open: boolean; onClose: () => void; mode: 'create'; entry?: undefined }
  | { open: boolean; onClose: () => void; mode: 'edit'; entry: CashflowEntry }

type FormState = {
  type: CashflowType
  date: string
  category: string
  amount: string
  notes: string
}

function toNum(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function UpsertCashflowModal(props: Props) {
  const addCashflow = usePortfolioStore((s) => s.addCashflow)
  const updateCashflow = usePortfolioStore((s) => s.updateCashflow)

  const initial = useMemo<FormState>(() => {
    const base: FormState = { type: 'expense', date: todayISO(), category: '', amount: '0', notes: '' }
    if (props.mode === 'edit') {
      base.type = props.entry.type
      base.date = props.entry.date
      base.category = props.entry.category
      base.amount = String(props.entry.amount)
      base.notes = props.entry.notes ?? ''
    }
    return base
  }, [props.mode, (props as any).entry])

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
        date: state.date,
        category: state.category.trim() || 'Other',
        amount: toNum(state.amount),
        notes: state.notes.trim() || undefined,
      }
      if (props.mode === 'create') await addCashflow(payload as any)
      else await updateCashflow(props.entry.id, payload as any)
      props.onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={props.open} onClose={props.onClose} title={props.mode === 'create' ? 'Add entry' : 'Edit entry'}>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Type</span>
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
              value={state.type}
              onChange={(e) => setState((s) => ({ ...s, type: e.target.value as CashflowType }))}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600">Date</span>
            <input
              type="date"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
              value={state.date}
              onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))}
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-slate-600">Category</span>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
            value={state.category}
            onChange={(e) => setState((s) => ({ ...s, category: e.target.value }))}
            placeholder="e.g. Rent, Groceries, Salary"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-slate-600">Amount</span>
          <input
            inputMode="decimal"
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
            value={state.amount}
            onChange={(e) => setState((s) => ({ ...s, amount: e.target.value }))}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-slate-600">Notes (optional)</span>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
            value={state.notes}
            onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            placeholder="optional"
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
            disabled={saving || !state.category.trim() || toNum(state.amount) <= 0}
          >
            {saving ? 'Saving…' : props.mode === 'create' ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

