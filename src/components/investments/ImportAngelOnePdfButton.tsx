import { useRef, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import { parseAngelOneHoldingsText } from '../../utils/angelOnePdfImport'

import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

async function extractPdfText(file: File) {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  let full = ''
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const strings = content.items
      .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
      .filter(Boolean)
    full += strings.join('\n') + '\n'
  }
  return full
}

export function ImportAngelOnePdfButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const addInvestment = usePortfolioStore((s) => s.addInvestment)
  const [busy, setBusy] = useState(false)

  async function onPickFile(file: File) {
    setBusy(true)
    try {
      const text = await extractPdfText(file)
      const drafts = parseAngelOneHoldingsText(text)
      if (!drafts.length) {
        alert('No holdings detected in this PDF. If possible, export CSV from Angel One and import that instead.')
        return
      }
      for (const d of drafts) await addInvestment(d as any)
      alert(`Imported ${drafts.length} Angel One holding(s).`)
    } catch (e: any) {
      alert(e?.message ?? 'Angel One PDF import failed.')
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
        accept="application/pdf"
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
        title="Imports Angel One PDF holdings statement"
      >
        {busy ? 'Importing…' : 'Angel One'}
      </button>
    </>
  )
}

