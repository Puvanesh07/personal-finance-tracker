import { useRef, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { parseCSV, rowToInvestmentDraft } from '../../utils/csvImport'
import { parseIndmoneyXlsx } from '../../utils/indmoneyXlsxImport'

export function ImportIndmoneyButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const addInvestment = usePortfolioStore((s) => s.addInvestment)
  const [busy, setBusy] = useState(false)

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
        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="INDmoney import (XLSX/CSV). If it doesn’t map correctly, share a sample export and I’ll add INDmoney-specific auto-mapping."
      >
        {busy ? 'Importing…' : 'INDmoney'}
      </button>
    </>
  )
}

