import { useRef, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { exportCSV, exportExcel } from '../../utils/exportUtils'
import { exportFullBackup, importFullBackup } from '../../utils/backup'

export function DataManagement() {
  const investments = usePortfolioStore((s) => s.investments)
  const clearAllData = usePortfolioStore((s) => s.clearAllData)
  const hydrate = usePortfolioStore((s) => s.hydrate)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <Card title="Data management">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portfolio exports</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => exportCSV(investments, 'portfolio.csv')}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => exportExcel(investments, 'portfolio.xlsx')}
            >
              Export Excel
            </button>
          </div>
        </div>

        <div className="h-px w-full bg-slate-100" />

        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full backup</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => void exportFullBackup()}
            >
              Export backup (JSON)
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setBusy(true)
                try {
                  const text = await file.text()
                  await importFullBackup(text)
                  await hydrate()
                  alert('Backup imported successfully.')
                } catch (err: any) {
                  alert(err?.message ?? 'Backup import failed.')
                } finally {
                  setBusy(false)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }
              }}
            />
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              Import backup (JSON)
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Backup includes investments, liabilities, cashflow, goals, snapshots, and settings. Import will overwrite existing data.
          </div>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <div className="text-sm font-semibold text-rose-800">Danger zone</div>
          <div className="mt-1 text-xs text-rose-700">
            Clears all data stored locally on this device (investments, liabilities, cashflow, goals, snapshots, settings).
          </div>
          <button
            type="button"
            className="mt-3 rounded-xl bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
            onClick={() => {
              if (confirm('This will delete ALL local data for this app. Continue?')) void clearAllData()
            }}
          >
            Clear all data
          </button>
        </div>
      </div>
    </Card>
  )
}

