// src/components/settings/DataManagement.tsx
import { useRef, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { exportCSV, exportExcel } from '../../utils/exportUtils'
import { exportFullBackup, importFullBackup } from '../../utils/backup'
import { FiDownload, FiUpload, FiTrash2, FiDatabase, FiAlertOctagon, FiLogOut } from 'react-icons/fi'
import { signOut } from 'firebase/auth' // Added
import { auth } from '../../services/firebase' // Added

export function DataManagement() {
  const investments = usePortfolioStore((s) => s.investments)
  const clearAllData = usePortfolioStore((s) => s.clearAllData)
  const hydrate = usePortfolioStore((s) => s.hydrate)
  const uid = usePortfolioStore((s) => s.uid) // Get uid for re-hydration

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <Card title={<div className="flex items-center gap-2"><FiDatabase className="text-slate-500 dark:text-slate-400"/> Data Management</div>}>
      <div className="flex flex-col gap-6">
        
        {/* Account Management (Logout) */}
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Account
          </div>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-semibold text-slate-700 backdrop-blur-sm transition-all hover:bg-slate-50 hover:shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => signOut(auth)}
          >
            <FiLogOut className="h-4 w-4 text-rose-500" />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="h-px w-full bg-slate-200/60 dark:bg-slate-800/60" />

        {/* Portfolio Exports */}
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Portfolio Exports
          </div>
          <div className="flex flex-col xl:flex-row gap-2">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-semibold text-slate-700 backdrop-blur-sm transition-all hover:bg-slate-50 hover:shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => exportCSV(investments, 'portfolio.csv')}
            >
              <FiDownload className="h-4 w-4 text-slate-400" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2.5 text-sm font-semibold text-slate-700 backdrop-blur-sm transition-all hover:bg-slate-50 hover:shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => exportExcel(investments, 'portfolio.xlsx')}
            >
              <FiDownload className="h-4 w-4 text-slate-400" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        <div className="h-px w-full bg-slate-200/60 dark:bg-slate-800/60" />

        {/* Full Backup Management */}
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Full Backup (JSON)
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Backup includes all your tracked assets, liabilities, goals, and history. Importing will overwrite existing cloud data.
          </div>
          <div className="flex flex-col xl:flex-row gap-2">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-100 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
              onClick={() => void exportFullBackup()}
            >
              <FiDownload className="h-4 w-4" />
              <span>Export Backup</span>
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
                  if (uid) await hydrate(uid) // Re-hydrate with current UID
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
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <FiUpload className="h-4 w-4" />
              <span>Import Backup</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-2 rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-400">
            <FiAlertOctagon className="h-5 w-5" />
            <span>Danger Zone</span>
          </div>
          <p className="mt-2 text-xs font-medium text-rose-600/80 dark:text-rose-400/80">
            Clears all financial data from the cloud. This action is irreversible unless you have a backup.
          </p>
          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
            onClick={() => {
              if (confirm('This will delete ALL data for this account. Continue?')) void clearAllData()
            }}
          >
            <FiTrash2 className="h-4 w-4" />
            <span>Clear All Data</span>
          </button>
        </div>

      </div>
    </Card>
  )
}