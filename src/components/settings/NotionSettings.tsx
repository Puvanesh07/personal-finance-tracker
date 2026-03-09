import { useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { Card } from '../ui/Card'
import { syncInvestmentsToNotion } from '../../services/notionService'

export function NotionSettings() {
  const notion = usePortfolioStore((s) => s.notion)
  const investments = usePortfolioStore((s) => s.investments)
  const setNotionConfig = usePortfolioStore((s) => s.setNotionConfig)

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function onSync() {
    setBusy(true)
    setStatus(null)
    try {
      await syncInvestmentsToNotion(notion, investments)
      await setNotionConfig({ lastSyncAt: new Date().toISOString() })
      setStatus('Sync completed (created pages in Notion).')
    } catch (e: any) {
      setStatus(e?.message ?? 'Sync failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Notion integration" right={notion.lastSyncAt ? `Last sync: ${new Date(notion.lastSyncAt).toLocaleString()}` : undefined}>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notion.enabled}
            onChange={(e) => void setNotionConfig({ enabled: e.target.checked })}
          />
          Enable Notion sync
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-slate-600">Notion integration token</span>
          <input
            type="password"
            value={notion.token ?? ''}
            onChange={(e) => void setNotionConfig({ token: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            placeholder="secret_..."
          />
          <div className="text-xs text-slate-500">Stored locally in IndexedDB. Don’t use your Notion password.</div>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-slate-600">Notion database id</span>
          <input
            value={notion.databaseId ?? ''}
            onChange={(e) => void setNotionConfig({ databaseId: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400"
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
          <div className="text-xs text-slate-500">
            Expected properties: <span className="font-medium">Name</span> (title), <span className="font-medium">Investment Type</span> (select),{' '}
            <span className="font-medium">Amount Invested</span> (number), <span className="font-medium">Expected Gain</span> (number),{' '}
            <span className="font-medium">Date Added</span> (date). Optional: <span className="font-medium">Interest Rate</span>, <span className="font-medium">Duration</span>.
          </div>
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            onClick={() => void onSync()}
            disabled={busy || !notion.enabled}
          >
            {busy ? 'Syncing…' : 'Sync now'}
          </button>
          <div className="text-xs text-slate-500">This creates new pages each sync (no dedupe yet).</div>
        </div>

        {status ? <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{status}</div> : null}
      </div>
    </Card>
  )
}

