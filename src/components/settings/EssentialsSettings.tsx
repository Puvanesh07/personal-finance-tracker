import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { FiShield } from 'react-icons/fi'

export function EssentialsSettings() {
  const essentials = usePortfolioStore((s) => s.essentials)
  const setEssentialsConfig = usePortfolioStore((s) => s.setEssentialsConfig)

  const inputCls = 'w-full rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:border-emerald-500'
  const labelCls = 'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block'

  return (
    <Card 
      title={
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-100/50 p-1.5 dark:bg-emerald-500/10">
            <FiShield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span>Essentials & Safety Net</span>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <label className="block">
          <span className={labelCls}>Term Insurance Cover (₹)</span>
          <input
            inputMode="decimal"
            className={inputCls}
            defaultValue={essentials.termInsuranceCover ?? ''}
            onBlur={(e) => {
              const n = Number(e.target.value.replaceAll(',', '').trim())
              void setEssentialsConfig({
                termInsuranceCover: Number.isFinite(n) && n > 0 ? n : undefined,
              })
            }}
            placeholder="e.g. 10,000,000"
          />
        </label>

        <label className="block">
          <span className={labelCls}>Health Cover (₹)</span>
          <input
            inputMode="decimal"
            className={inputCls}
            defaultValue={essentials.healthCover ?? ''}
            onBlur={(e) => {
              const n = Number(e.target.value.replaceAll(',', '').trim())
              void setEssentialsConfig({
                healthCover: Number.isFinite(n) && n > 0 ? n : undefined,
              })
            }}
            placeholder="e.g. 1,000,000"
          />
        </label>

        <div className="h-px w-full bg-slate-200/60 dark:bg-slate-800/60" />

        <label className="block">
          <span className={labelCls}>Emergency Fund Target (₹)</span>
          <input
            inputMode="decimal"
            className={inputCls}
            defaultValue={essentials.emergencyFundTarget ?? ''}
            onBlur={(e) => {
              const n = Number(e.target.value.replaceAll(',', '').trim())
              void setEssentialsConfig({
                emergencyFundTarget: Number.isFinite(n) && n > 0 ? n : undefined,
              })
            }}
            placeholder="e.g. 500,000"
          />
        </label>

        <label className="block">
          <span className={labelCls}>Emergency Fund Saved (₹)</span>
          <input
            inputMode="decimal"
            className={inputCls}
            defaultValue={essentials.emergencyFundCurrent ?? ''}
            onBlur={(e) => {
              const n = Number(e.target.value.replaceAll(',', '').trim())
              void setEssentialsConfig({
                emergencyFundCurrent: Number.isFinite(n) && n > 0 ? n : 0,
              })
            }}
            placeholder="e.g. 320,000"
          />
        </label>
      </div>
    </Card>
  )
}