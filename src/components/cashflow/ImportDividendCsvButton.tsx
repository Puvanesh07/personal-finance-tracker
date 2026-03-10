import { useRef, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { parseZerodhaDividendCsv, parseZerodhaDividendXlsx } from '../../utils/dividendImport'
import toast from 'react-hot-toast'
import { FiDownload } from 'react-icons/fi'

export function ImportDividendCsvButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const addCashflow = usePortfolioStore((s) => s.addCashflow)
  const [busy, setBusy] = useState(false)

  async function onPickFile(file: File) {
    setBusy(true)
    try {
      const lower = file.name.toLowerCase()
      let drafts = []

      // Route based on file extension
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        drafts = await parseZerodhaDividendXlsx(file)
      } else {
        const text = await file.text()
        drafts = parseZerodhaDividendCsv(text)
      }
      
      let ok = 0
      for (const draft of drafts) {
        await addCashflow(draft as any)
        ok++
      }
      
      if (ok > 0) {
         toast.success(`Successfully imported ${ok} dividend entries!`)
      } else {
         toast.error("No valid dividend entries found in the file.")
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Dividend import failed.')
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
        // Updated accept attribute to show Excel files in the picker
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onPickFile(file)
        }}
      />
      <button
        type="button"
        className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-white/50 px-4 py-2.5 text-sm font-semibold text-emerald-700 backdrop-blur-sm transition-all hover:bg-emerald-50 hover:shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Upload Zerodha Equity Dividends File (XLSX/CSV)"
      >
        <FiDownload className="h-4 w-4" />
        <span>{busy ? 'Importing…' : 'Import Dividends'}</span>
      </button>
    </>
  )
}