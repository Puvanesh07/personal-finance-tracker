import { useEffect, useMemo, useState } from 'react'
import type { CashflowEntry, CashflowType } from '../../types/investmentTypes'
import { Modal } from '../ui/Modal'
import { usePortfolioStore } from '../../store/portfolioStore'
import { todayISO } from '../../utils/dateUtils'
import { FiPlus, FiSave } from 'react-icons/fi'

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

  const inputCls = 'w-full rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:border-emerald-500'
  const labelCls = 'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block'

  return (
    <Modal open={props.open} onClose={props.onClose} title={props.mode === 'create' ? 'Add Transaction' : 'Edit Transaction'}>
      <div className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Transaction Type</span>
            <select
              className={`${inputCls} appearance-none`}
              value={state.type}
              onChange={(e) => setState((s) => ({ ...s, type: e.target.value as CashflowType }))}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Date</span>
            <input
              type="date"
              className={inputCls}
              value={state.date}
              onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelCls}>Category</span>
          <input
            className={inputCls}
            value={state.category}
            onChange={(e) => setState((s) => ({ ...s, category: e.target.value }))}
            placeholder="e.g. Rent, Groceries, Salary"
          />
        </label>

        <label className="block">
          <span className={labelCls}>Amount</span>
          <input
            inputMode="decimal"
            className={inputCls}
            value={state.amount}
            onChange={(e) => setState((s) => ({ ...s, amount: e.target.value }))}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Notes (Optional)</span>
          <input
            className={inputCls}
            value={state.notes}
            onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Add any extra details..."
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
            disabled={saving || !state.category.trim() || toNum(state.amount) <= 0}
          >
            {saving ? (
              <><FiSave className="h-4 w-4" /><span>Saving…</span></>
            ) : props.mode === 'create' ? (
              <><FiPlus className="h-4 w-4" /><span>Add Entry</span></>
            ) : (
              <><FiSave className="h-4 w-4" /><span>Save Changes</span></>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}