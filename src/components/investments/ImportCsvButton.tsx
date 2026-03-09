import { useRef, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { parseCSV, rowToInvestmentDraft } from '../../utils/csvImport'
import { FiFileText } from 'react-icons/fi'

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
        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-60 dark:border-sky-500/40 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Supports Zerodha holdings export (Instrument/Qty./Avg. cost/LTP/Invested/Cur. val) and generic CSV headers (Type/Name/etc.)"
      >
        <FiFileText className="h-3.5 w-3.5" />
        <span>{busy ? 'Importing…' : 'Zerodha'}</span>
      </button>
    </>
  )
}

