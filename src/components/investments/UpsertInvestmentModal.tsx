// src/components/investments/UpsertInvestmentModal.tsx
// Updated: "Auto-detect" button next to Sector field fetches from Yahoo Finance.

import { useEffect, useMemo, useState } from 'react'
import type { Investment, InvestmentType } from '../../types/investmentTypes'
import { Modal } from '../ui/Modal'
import { usePortfolioStore } from '../../store/portfolioStore'
import { todayISO } from '../../utils/dateUtils'
import { FiSave, FiPlus, FiZap } from 'react-icons/fi'
import { fetchStockMetadata } from '../../services/stockMetadataService'

type Props =
  | { open: boolean; onClose: () => void; mode: 'create'; investment?: undefined }
  | { open: boolean; onClose: () => void; mode: 'edit'; investment: Investment }

type FormState = {
  type: InvestmentType
  name: string
  symbol: string
  platform: string
  sector: string
  quantity: string
  buyPrice: string
  currentPrice: string
  units: string
  nav: string
  investedAmount: string
  interestRate: string
  durationMonths: string
  startDate: string
  maturityDate: string
  bankName: string
  currentValue: string
}

function toNumber(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function UpsertInvestmentModal(props: Props) {
  const addInvestment    = usePortfolioStore((s) => s.addInvestment)
  const updateInvestment = usePortfolioStore((s) => s.updateInvestment)

  const initial = useMemo<FormState>(() => {
    const base: FormState = {
      type: 'stock', name: '', symbol: '', platform: 'manual', sector: '',
      quantity: '0', buyPrice: '0', currentPrice: '0',
      units: '0', nav: '0', investedAmount: '0',
      interestRate: '0', durationMonths: '12',
      startDate: todayISO(), maturityDate: todayISO(),
      bankName: '', currentValue: '0',
    }
    if (props.mode === 'edit') {
      const inv = props.investment
      base.type     = inv.type
      base.name     = inv.name
      base.symbol   = inv.symbol ?? ''
      base.platform = String(inv.platform ?? 'manual')
      base.sector   = inv.type === 'stock' ? inv.sector ?? '' : ''
      if (inv.type === 'stock') { base.quantity = String(inv.quantity); base.buyPrice = String(inv.buyPrice); base.currentPrice = String(inv.currentPrice) }
      if (inv.type === 'mutual_fund') { base.units = String(inv.units); base.nav = String(inv.nav); base.investedAmount = String(inv.investedAmount) }
      if (inv.type === 'bond') { base.investedAmount = String(inv.investedAmount); base.interestRate = String(inv.interestRate); base.durationMonths = String(inv.durationMonths); base.startDate = inv.startDate; base.maturityDate = inv.maturityDate }
      if (inv.type === 'fixed_deposit') { base.bankName = inv.bankName; base.investedAmount = String(inv.investedAmount); base.interestRate = String(inv.interestRate); base.durationMonths = String(inv.durationMonths); base.startDate = inv.startDate; base.maturityDate = inv.maturityDate }
      if (inv.type === 'other') { base.investedAmount = String(inv.investedAmount); base.currentValue = String(inv.currentValue) }
    }
    return base
  }, [props.mode, (props as any).investment])

  const [state, setState]           = useState<FormState>(initial)
  const [saving, setSaving]         = useState(false)
  const [detecting, setDetecting]   = useState(false)
  const [detectMsg, setDetectMsg]   = useState<string | null>(null)

  useEffect(() => { if (props.open) { setState(initial); setDetectMsg(null) } }, [props.open, initial])

  async function autoDetectSector() {
    const sym = state.symbol.trim()
    if (!sym) { setDetectMsg('Enter a symbol first.'); return }
    setDetecting(true)
    setDetectMsg(null)
    try {
      const meta = await fetchStockMetadata({ symbol: sym })
      if (meta.sector && meta.sector !== 'Unknown') {
        setState((s) => ({ ...s, sector: meta.sector }))
        setDetectMsg(`✓ ${meta.sector} · ${meta.marketCapCategory}`)
      } else {
        setDetectMsg('Sector not found — try entering manually.')
      }
    } catch {
      setDetectMsg('Could not fetch sector. Check symbol.')
    } finally {
      setDetecting(false)
    }
  }

  async function onSubmit() {
    setSaving(true)
    try {
      if (state.type === 'stock') {
        const payload = { type: 'stock' as const, name: state.name.trim(), symbol: state.symbol.trim() || undefined, platform: state.platform.trim() || undefined, quantity: toNumber(state.quantity), buyPrice: toNumber(state.buyPrice), currentPrice: toNumber(state.currentPrice), sector: state.sector.trim() || undefined }
        if (props.mode === 'create') await addInvestment(payload as any)
        else await updateInvestment(props.investment.id, payload as any)
      }
      if (state.type === 'mutual_fund') {
        const payload = { type: 'mutual_fund' as const, name: state.name.trim(), symbol: state.symbol.trim() || undefined, platform: state.platform.trim() || undefined, units: toNumber(state.units), nav: toNumber(state.nav), investedAmount: toNumber(state.investedAmount) }
        if (props.mode === 'create') await addInvestment(payload as any)
        else await updateInvestment(props.investment.id, payload as any)
      }
      if (state.type === 'bond') {
        const payload = { type: 'bond' as const, name: state.name.trim(), platform: state.platform.trim() || 'manual', investedAmount: toNumber(state.investedAmount), interestRate: toNumber(state.interestRate), durationMonths: toNumber(state.durationMonths), startDate: state.startDate, maturityDate: state.maturityDate }
        if (props.mode === 'create') await addInvestment(payload as any)
        else await updateInvestment(props.investment.id, payload as any)
      }
      if (state.type === 'fixed_deposit') {
        const payload = { type: 'fixed_deposit' as const, name: state.name.trim() || state.bankName.trim() || 'Fixed Deposit', bankName: state.bankName.trim() || 'Bank', platform: 'manual', investedAmount: toNumber(state.investedAmount), interestRate: toNumber(state.interestRate), durationMonths: toNumber(state.durationMonths), startDate: state.startDate, maturityDate: state.maturityDate }
        if (props.mode === 'create') await addInvestment(payload as any)
        else await updateInvestment(props.investment.id, payload as any)
      }
      if (state.type === 'other') {
        const payload = { type: 'other' as const, name: state.name.trim(), platform: state.platform.trim() || 'manual', investedAmount: toNumber(state.investedAmount), currentValue: toNumber(state.currentValue) }
        if (props.mode === 'create') await addInvestment(payload as any)
        else await updateInvestment(props.investment.id, payload as any)
      }
      props.onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-emerald-500'

  return (
    <Modal open={props.open} onClose={props.onClose} title={props.mode === 'create' ? 'Add investment' : 'Edit investment'}>
      <div className="grid grid-cols-1 gap-4">
        {props.mode === 'create' && (
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Investment type</span>
            <select className={inputCls} value={state.type} onChange={(e) => setState((s) => ({ ...s, type: e.target.value as InvestmentType }))}>
              <option value="stock">Stock</option>
              <option value="mutual_fund">Mutual fund</option>
              <option value="bond">Bond</option>
              <option value="fixed_deposit">Fixed deposit</option>
              <option value="other">Other</option>
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Name</span>
            <input className={inputCls} value={state.name} onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))} placeholder={state.type === 'fixed_deposit' ? 'FD label (optional)' : 'Asset name'} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Platform</span>
            <input className={inputCls} value={state.platform} onChange={(e) => setState((s) => ({ ...s, platform: e.target.value }))} placeholder="zerodha / angel_one / indmoney / manual" />
          </label>
        </div>

        {(state.type === 'stock' || state.type === 'mutual_fund') && (
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Symbol (optional)</span>
            <input className={inputCls} value={state.symbol} onChange={(e) => setState((s) => ({ ...s, symbol: e.target.value }))} placeholder="e.g. RELIANCE, TCS, RVNL" />
          </label>
        )}

        {state.type === 'stock' && (
          <div className="grid gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Sector (optional)</span>
              <button
                type="button"
                onClick={autoDetectSector}
                disabled={detecting || !state.symbol.trim()}
                className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                <FiZap className="h-3 w-3" />
                {detecting ? 'Detecting…' : 'Auto-detect'}
              </button>
            </div>
            <input className={inputCls} value={state.sector} onChange={(e) => setState((s) => ({ ...s, sector: e.target.value }))} placeholder="e.g. Defence, Railway, Energy, IT" />
            {detectMsg && (
              <p className={`text-[11px] ${detectMsg.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{detectMsg}</p>
            )}
            <p className="text-[10px] text-slate-400">Auto-detect uses Yahoo Finance. Enter symbol first, then click Auto-detect.</p>
          </div>
        )}

        {state.type === 'stock' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Quantity</span><input inputMode="decimal" className={inputCls} value={state.quantity} onChange={(e) => setState((s) => ({ ...s, quantity: e.target.value }))} /></label>
            <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Buy price</span><input inputMode="decimal" className={inputCls} value={state.buyPrice} onChange={(e) => setState((s) => ({ ...s, buyPrice: e.target.value }))} /></label>
            <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Current price</span><input inputMode="decimal" className={inputCls} value={state.currentPrice} onChange={(e) => setState((s) => ({ ...s, currentPrice: e.target.value }))} /></label>
          </div>
        )}

        {state.type === 'mutual_fund' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Units</span><input inputMode="decimal" className={inputCls} value={state.units} onChange={(e) => setState((s) => ({ ...s, units: e.target.value }))} /></label>
            <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">NAV</span><input inputMode="decimal" className={inputCls} value={state.nav} onChange={(e) => setState((s) => ({ ...s, nav: e.target.value }))} /></label>
            <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Invested amount</span><input inputMode="decimal" className={inputCls} value={state.investedAmount} onChange={(e) => setState((s) => ({ ...s, investedAmount: e.target.value }))} /></label>
          </div>
        )}

        {(state.type === 'bond' || state.type === 'fixed_deposit') && (
          <>
            {state.type === 'fixed_deposit' && (
              <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Bank name</span><input className={inputCls} value={state.bankName} onChange={(e) => setState((s) => ({ ...s, bankName: e.target.value }))} placeholder="e.g. HDFC" /></label>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Invested amount</span><input inputMode="decimal" className={inputCls} value={state.investedAmount} onChange={(e) => setState((s) => ({ ...s, investedAmount: e.target.value }))} /></label>
              <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Interest rate (% p.a.)</span><input inputMode="decimal" className={inputCls} value={state.interestRate} onChange={(e) => setState((s) => ({ ...s, interestRate: e.target.value }))} /></label>
              <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Duration (months)</span><input inputMode="numeric" className={inputCls} value={state.durationMonths} onChange={(e) => setState((s) => ({ ...s, durationMonths: e.target.value }))} /></label>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Start date</span><input type="date" className={inputCls} value={state.startDate} onChange={(e) => setState((s) => ({ ...s, startDate: e.target.value }))} /></label>
              <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Maturity date</span><input type="date" className={inputCls} value={state.maturityDate} onChange={(e) => setState((s) => ({ ...s, maturityDate: e.target.value }))} /></label>
            </div>
          </>
        )}

        {state.type === 'other' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Invested amount</span><input inputMode="decimal" className={inputCls} value={state.investedAmount} onChange={(e) => setState((s) => ({ ...s, investedAmount: e.target.value }))} /></label>
            <label className="grid gap-1 text-sm"><span className="text-xs font-medium text-slate-600 dark:text-slate-400">Current value</span><input inputMode="decimal" className={inputCls} value={state.currentValue} onChange={(e) => setState((s) => ({ ...s, currentValue: e.target.value }))} /></label>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3">
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" onClick={props.onClose} disabled={saving}>Cancel</button>
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60" onClick={() => void onSubmit()} disabled={saving || !state.name.trim()}>
            {saving ? <><FiSave className="h-4 w-4" /><span>Saving…</span></> : props.mode === 'create' ? <><FiPlus className="h-4 w-4" /><span>Add</span></> : <><FiSave className="h-4 w-4" /><span>Save</span></>}
          </button>
        </div>
      </div>
    </Modal>
  )
}