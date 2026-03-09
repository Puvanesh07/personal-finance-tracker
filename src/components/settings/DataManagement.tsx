import { useRef, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { exportCSV, exportExcel } from '../../utils/exportUtils'
import { exportFullBackup, importFullBackup } from '../../utils/backup'
import { FiDownload, FiUpload, FiTrash2 } from 'react-icons/fi'

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
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Portfolio exports
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              onClick={() => exportCSV(investments, 'portfolio.csv')}
            >
              <FiDownload className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              onClick={() => exportExcel(investments, 'portfolio.xlsx')}
            >
              <FiDownload className="h-4 w-4" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        <div className="h-px w-full bg-slate-100" />

        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full backup</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              onClick={() => void exportFullBackup()}
            >
              <FiDownload className="h-4 w-4" />
              <span>Export backup (JSON)</span>
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
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <FiUpload className="h-4 w-4" />
              <span>Import backup (JSON)</span>
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Backup includes investments, liabilities, cashflow, goals, snapshots, and settings. Import will overwrite existing data.
          </div>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
            <FiTrash2 className="h-4 w-4" />
            <span>Danger zone</span>
          </div>
          <div className="mt-1 text-xs text-rose-700">
            Clears all data stored locally on this device (investments, liabilities, cashflow, goals, snapshots, settings).
          </div>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-600"
            onClick={() => {
              if (confirm('This will delete ALL local data for this app. Continue?')) void clearAllData()
            }}
          >
            <FiTrash2 className="h-4 w-4" />
            <span>Clear all data</span>
          </button>
        </div>
      </div>
    </Card>
  )
}

