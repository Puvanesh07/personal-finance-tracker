import { useRef, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { parseCSV, rowToInvestmentDraft } from '../../utils/csvImport'
import { parseIndmoneyXlsx } from '../../utils/indmoneyXlsxImport'
import { FiPieChart } from 'react-icons/fi'

export function ImportIndmoneyButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const addInvestment = usePortfolioStore((s) => s.addInvestment)
  const [busy, setBusy] = useState(false)

  // (Keeping the onPickFile logic identical)
  async function onPickFile(file: File) {
    setBusy(true)
    try {
      const lower = file.name.toLowerCase()
      if (lower.endsWith('.xlsx')) {
        const drafts = await parseIndmoneyXlsx(file)
        for (const d of drafts) await addInvestment(d as any)
        alert(`Imported ${drafts.length} INDmoney holding(s).`)
        return
      }

      const text = await file.text()
      const rows = parseCSV(text)
      let ok = 0
      let skipped = 0
      for (const row of rows) {
        const draft = rowToInvestmentDraft(row)
        if (!draft) {
          skipped++
          continue
        }
        await addInvestment(draft as any)
        ok++
      }
      alert(`Imported ${ok} row(s). Skipped ${skipped} row(s).`)
    } catch (e: any) {
      alert(e?.message ?? 'INDmoney import failed.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onPickFile(file)
        }}
      />
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-violet-600 transition-colors hover:bg-violet-100/80 disabled:opacity-50 dark:text-violet-400 dark:hover:bg-violet-500/20"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="INDmoney import (XLSX/CSV). If it doesn’t map correctly, share a sample export and I’ll add INDmoney-specific auto-mapping."
      >
        <FiPieChart className="h-3.5 w-3.5" />
        <span>{busy ? 'Importing…' : 'INDmoney'}</span>
      </button>
    </>
  )
}