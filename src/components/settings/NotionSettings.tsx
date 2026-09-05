import { useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { syncInvestmentsToNotion } from '../../services/notionService'
import { FiDatabase, FiCloud } from 'react-icons/fi'

export function NotionSettings() {
  const notion = usePortfolioStore((s) => s.notion)
  const investments = usePortfolioStore((s) => s.investments)
  const setNotionConfig = usePortfolioStore((s) => s.setNotionConfig)

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const inputCls = 'w-full rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:focus:border-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500'
  const labelCls = 'text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block'

  async function onSync() {
    setBusy(true)
    setStatus(null)
    try {
      await syncInvestmentsToNotion(notion, investments)
      await setNotionConfig({ lastSyncAt: new Date().toISOString() })
      setStatus('Sync completed successfully (pages created in Notion).')
    } catch (e: any) {
      setStatus(e?.message ?? 'Sync failed. Please check your token and ID.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-slate-100 p-1.5 dark:bg-slate-800">
            <FiDatabase className="h-4 w-4 text-slate-700 dark:text-slate-300" />
          </div>
          <span>Notion Integration</span>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50 dark:border-slate-800/60 dark:bg-slate-800/30">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Enable Notion Sync</span>
          <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300" style={{ backgroundColor: notion.enabled ? '#10b981' : '#cbd5e1' }}>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={notion.enabled}
              onChange={(e) => void setNotionConfig({ enabled: e.target.checked })}
            />
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-300 ${notion.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
        </label>

        <label className="block">
          <span className={labelCls}>Integration Token</span>
          <input
            type="password"
            value={notion.token ?? ''}
            onChange={(e) => void setNotionConfig({ token: e.target.value })}
            className={inputCls}
            placeholder="secret_..."
            disabled={!notion.enabled}
          />
          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Stored securely in your local IndexedDB. Do not use your Notion account password.</div>
        </label>

        <label className="block">
          <span className={labelCls}>Database ID</span>
          <input
            value={notion.databaseId ?? ''}
            onChange={(e) => void setNotionConfig({ databaseId: e.target.value })}
            className={inputCls}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            disabled={!notion.enabled}
          />
          <div className="mt-1.5 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Expected properties: <span className="text-slate-500 dark:text-slate-300">Name</span> (title), <span className="text-slate-500 dark:text-slate-300">Investment type</span> (select),{' '}
            <span className="text-slate-500 dark:text-slate-300">Amount invested</span> (number), <span className="text-slate-500 dark:text-slate-300">Expected gain</span> (number),{' '}
            <span className="text-slate-500 dark:text-slate-300">Date added</span> (date).
          </div>
        </label>

        <div className="mt-2 flex flex-col items-start gap-3 border-t border-slate-200/60 pt-4 dark:border-slate-800/60">
          <button
            type="button"
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 to-slate-50 dark:to-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 dark:from-slate-600 dark:to-slate-800"
            onClick={() => void onSync()}
            disabled={busy || !notion.enabled}
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full transition-transform group-hover:translate-y-0" />
            <FiCloud className="relative h-4 w-4" />
            <span className="relative">{busy ? 'Syncing to Notion…' : 'Sync Now'}</span>
          </button>
          
          <div className="flex w-full justify-between items-center text-xs font-medium text-slate-900 dark:text-slate-500">
            <span>{notion.lastSyncAt ? `Last sync: ${new Date(notion.lastSyncAt).toLocaleString()}` : 'Never synced'}</span>
          </div>
        </div>

        {status && (
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${status.includes('failed') ? 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'}`}>
            {status}
          </div>
        )}
      </div>
    </Card>
  )
}