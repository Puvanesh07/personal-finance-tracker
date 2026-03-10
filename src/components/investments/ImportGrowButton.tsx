// src/components/investments/ImportGrowwButton.tsx
import { useRef, useState } from 'react'
import { FiUserCheck } from 'react-icons/fi'
import { parseCSV, rowToInvestmentDraft } from '../../utils/csvImport'
import { usePortfolioStore } from '../../store/portfolioStore'
import toast from 'react-hot-toast'

export function ImportGrowwButton() {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const addInvestment = usePortfolioStore((s) => s.addInvestment)
    const [busy, setBusy] = useState(false)
  
    // (Keeping the onPickFile logic identical)
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
        toast.success(`Imported ${ok} row(s). Skipped ${skipped} row(s).`) // <-- Replaced alert
      } catch (e: any) {
        toast.error(e?.message ?? 'Groww import failed.') // <-- Added error handling
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
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-sky-600 transition-colors hover:bg-sky-100/80 disabled:opacity-50 dark:text-sky-400 dark:hover:bg-sky-500/20"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title="Supports Zerodha holdings export (Instrument/Qty./Avg. cost/LTP/Invested/Cur. val) and generic CSV headers (Type/Name/etc.)"
        >
          <FiUserCheck className="h-3.5 w-3.5" />
          <span>{busy ? 'Importing…' : 'Groww'}</span>
        </button>
      </>
    )
}