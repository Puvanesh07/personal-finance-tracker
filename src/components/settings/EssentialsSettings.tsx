import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'

export function EssentialsSettings() {
  const essentials = usePortfolioStore((s) => s.essentials)
  const setEssentialsConfig = usePortfolioStore((s) => s.setEssentialsConfig)

  return (
    <Card title="Essentials">
      <div className="flex flex-col gap-3 text-sm">
        <label className="grid gap-1">
          <span className="text-xs font-medium text-slate-600">Term insurance cover (₹)</span>
          <input
            inputMode="decimal"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            defaultValue={essentials.termInsuranceCover ?? ''}
            onBlur={(e) => {
              const n = Number(e.target.value.replaceAll(',', '').trim())
              void setEssentialsConfig({
                termInsuranceCover: Number.isFinite(n) && n > 0 ? n : undefined,
              })
            }}
            placeholder="e.g. 10000000"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-medium text-slate-600">Health cover (₹)</span>
          <input
            inputMode="decimal"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            defaultValue={essentials.healthCover ?? ''}
            onBlur={(e) => {
              const n = Number(e.target.value.replaceAll(',', '').trim())
              void setEssentialsConfig({
                healthCover: Number.isFinite(n) && n > 0 ? n : undefined,
              })
            }}
            placeholder="e.g. 1000000"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-medium text-slate-600">Emergency fund target (₹)</span>
          <input
            inputMode="decimal"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            defaultValue={essentials.emergencyFundTarget ?? ''}
            onBlur={(e) => {
              const n = Number(e.target.value.replaceAll(',', '').trim())
              void setEssentialsConfig({
                emergencyFundTarget: Number.isFinite(n) && n > 0 ? n : undefined,
              })
            }}
            placeholder="e.g. 500000"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-medium text-slate-600">Emergency fund saved (₹)</span>
          <input
            inputMode="decimal"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            defaultValue={essentials.emergencyFundCurrent ?? ''}
            onBlur={(e) => {
              const n = Number(e.target.value.replaceAll(',', '').trim())
              void setEssentialsConfig({
                emergencyFundCurrent: Number.isFinite(n) && n > 0 ? n : 0,
              })
            }}
            placeholder="e.g. 320000"
          />
        </label>
      </div>
    </Card>
  )
}

