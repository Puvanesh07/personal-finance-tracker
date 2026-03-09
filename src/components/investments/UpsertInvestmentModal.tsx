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

  // Modernized UI Classes
  const inputCls = 'w-full rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:border-emerald-500'
  const labelCls = 'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block'

  return (
    <Modal open={props.open} onClose={props.onClose} title={props.mode === 'create' ? 'Add New Asset' : 'Edit Asset Details'}>
      <div className="grid grid-cols-1 gap-5">
        
        {props.mode === 'create' && (
          <label className="block">
            <span className={labelCls}>Investment Type</span>
            <select className={`${inputCls} appearance-none cursor-pointer`} value={state.type} onChange={(e) => setState((s) => ({ ...s, type: e.target.value as InvestmentType }))}>
              <option value="stock">Stock</option>
              <option value="mutual_fund">Mutual Fund</option>
              <option value="bond">Bond</option>
              <option value="fixed_deposit">Fixed Deposit</option>
              <option value="other">Other Asset</option>
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Name</span>
            <input className={inputCls} value={state.name} onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))} placeholder={state.type === 'fixed_deposit' ? 'FD label (optional)' : 'Asset name'} />
          </label>
          <label className="block">
            <span className={labelCls}>Platform</span>
            <input className={inputCls} value={state.platform} onChange={(e) => setState((s) => ({ ...s, platform: e.target.value }))} placeholder="zerodha / angel_one / manual" />
          </label>
        </div>

        {(state.type === 'stock' || state.type === 'mutual_fund') && (
          <label className="block">
            <span className={labelCls}>Symbol (Optional)</span>
            <input className={inputCls} value={state.symbol} onChange={(e) => setState((s) => ({ ...s, symbol: e.target.value }))} placeholder="e.g. RELIANCE, TCS, RVNL" />
          </label>
        )}

        {state.type === 'stock' && (
          <div className="block">
            <div className="mb-1.5 flex items-center justify-between">
              <span className={labelCls.replace('mb-1.5 block', '')}>Sector (Optional)</span>
              <button
                type="button"
                onClick={autoDetectSector}
                disabled={detecting || !state.symbol.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-100/50 px-2.5 py-1 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
              >
                <FiZap className="h-3.5 w-3.5" />
                {detecting ? 'Detecting…' : 'Auto-Detect'}
              </button>
            </div>
            <input className={inputCls} value={state.sector} onChange={(e) => setState((s) => ({ ...s, sector: e.target.value }))} placeholder="e.g. Defence, Energy, IT" />
            {detectMsg && (
              <p className={`mt-1.5 text-xs font-semibold ${detectMsg.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{detectMsg}</p>
            )}
            <p className="mt-1 text-[11px] text-slate-400">Powered by Yahoo Finance. Enter a valid symbol first.</p>
          </div>
        )}

        {state.type === 'stock' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block"><span className={labelCls}>Quantity</span><input inputMode="decimal" className={inputCls} value={state.quantity} onChange={(e) => setState((s) => ({ ...s, quantity: e.target.value }))} /></label>
            <label className="block"><span className={labelCls}>Buy Price</span><input inputMode="decimal" className={inputCls} value={state.buyPrice} onChange={(e) => setState((s) => ({ ...s, buyPrice: e.target.value }))} /></label>
            <label className="block"><span className={labelCls}>Current Price</span><input inputMode="decimal" className={inputCls} value={state.currentPrice} onChange={(e) => setState((s) => ({ ...s, currentPrice: e.target.value }))} /></label>
          </div>
        )}

        {state.type === 'mutual_fund' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block"><span className={labelCls}>Units</span><input inputMode="decimal" className={inputCls} value={state.units} onChange={(e) => setState((s) => ({ ...s, units: e.target.value }))} /></label>
            <label className="block"><span className={labelCls}>NAV</span><input inputMode="decimal" className={inputCls} value={state.nav} onChange={(e) => setState((s) => ({ ...s, nav: e.target.value }))} /></label>
            <label className="block"><span className={labelCls}>Invested Amt</span><input inputMode="decimal" className={inputCls} value={state.investedAmount} onChange={(e) => setState((s) => ({ ...s, investedAmount: e.target.value }))} /></label>
          </div>
        )}

        {(state.type === 'bond' || state.type === 'fixed_deposit') && (
          <>
            {state.type === 'fixed_deposit' && (
              <label className="block"><span className={labelCls}>Bank Name</span><input className={inputCls} value={state.bankName} onChange={(e) => setState((s) => ({ ...s, bankName: e.target.value }))} placeholder="e.g. HDFC" /></label>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="block"><span className={labelCls}>Invested Amt</span><input inputMode="decimal" className={inputCls} value={state.investedAmount} onChange={(e) => setState((s) => ({ ...s, investedAmount: e.target.value }))} /></label>
              <label className="block"><span className={labelCls}>Interest (% p.a.)</span><input inputMode="decimal" className={inputCls} value={state.interestRate} onChange={(e) => setState((s) => ({ ...s, interestRate: e.target.value }))} /></label>
              <label className="block"><span className={labelCls}>Duration (mo)</span><input inputMode="numeric" className={inputCls} value={state.durationMonths} onChange={(e) => setState((s) => ({ ...s, durationMonths: e.target.value }))} /></label>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block"><span className={labelCls}>Start Date</span><input type="date" className={inputCls} value={state.startDate} onChange={(e) => setState((s) => ({ ...s, startDate: e.target.value }))} /></label>
              <label className="block"><span className={labelCls}>Maturity Date</span><input type="date" className={inputCls} value={state.maturityDate} onChange={(e) => setState((s) => ({ ...s, maturityDate: e.target.value }))} /></label>
            </div>
          </>
        )}

        {state.type === 'other' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block"><span className={labelCls}>Invested Amt</span><input inputMode="decimal" className={inputCls} value={state.investedAmount} onChange={(e) => setState((s) => ({ ...s, investedAmount: e.target.value }))} /></label>
            <label className="block"><span className={labelCls}>Current Value</span><input inputMode="decimal" className={inputCls} value={state.currentValue} onChange={(e) => setState((s) => ({ ...s, currentValue: e.target.value }))} /></label>
          </div>
        )}

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
              <><FiPlus className="h-4 w-4" /><span>Add Asset</span></>
            ) : (
              <><FiSave className="h-4 w-4" /><span>Save Changes</span></>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}