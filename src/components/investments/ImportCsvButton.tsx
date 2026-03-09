import { useRef, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { parseCSV, rowToInvestmentDraft } from '../../utils/csvImport'

export function ImportCsvButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const addInvestment = usePortfolioStore((s) => s.addInvestment)
  const [busy, setBusy] = useState(false)

  async function onPickFile(file: File) {
    setBusy(true)
    try {
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
        accept=".csv,text/csv"
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
        title="Supports Zerodha holdings export (Instrument/Qty./Avg. cost/LTP/Invested/Cur. val) and generic CSV headers (Type/Name/etc.)"
      >
        {busy ? 'Importing…' : 'Zerodha'}
      </button>
    </>
  )
}

