import ExcelJS from 'exceljs'
import type { CashflowEntry } from '../types/investmentTypes'

// 1. Existing CSV Parser
export function parseZerodhaDividendCsv(text: string): Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>[] {
  const lines = text.split(/\r?\n/).map(l => l.trim())
  let headerIndex = -1
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Symbol') && lines[i].includes('Net Dividend Amount')) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) {
    throw new Error("Could not find dividend headers in the CSV. Make sure it's the Zerodha Equity Dividends report.")
  }

  const headers = lines[headerIndex].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  
  const symbolIdx = headers.indexOf('Symbol')
  const dateIdx = headers.indexOf('Ex-Date')
  const amountIdx = headers.indexOf('Net Dividend Amount')

  if (symbolIdx === -1 || amountIdx === -1) throw new Error("Missing required columns: Symbol or Net Dividend Amount.")

  const results: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>[] = []

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.includes('Total Dividend Amount')) break

    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const symbol = cols[symbolIdx]
    const rawDate = dateIdx !== -1 ? cols[dateIdx] : ''
    const rawAmount = cols[amountIdx]

    if (!symbol || !rawAmount) continue

    const amount = Number(rawAmount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) continue

    let dateStr = new Date().toISOString().split('T')[0]
    if (rawDate) {
       if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) dateStr = rawDate
       else {
         const d = new Date(rawDate)
         if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0]
       }
    }

    results.push({
      type: 'income',
      category: 'Dividend',
      amount,
      date: dateStr,
      notes: `Dividend from ${symbol}`,
    })
  }

  return results
}

// 2. New XLSX Parser
export async function parseZerodhaDividendXlsx(file: File): Promise<Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error("No worksheets found in the Excel file.")

  let headerRowIndex = -1
  let symbolCol = -1
  let dateCol = -1
  let amountCol = -1

  sheet.eachRow((row, rowNumber) => {
    if (headerRowIndex !== -1) return
    row.eachCell((cell, colNumber) => {
      const val = String(cell.value || '').trim()
      if (val.includes('Symbol')) symbolCol = colNumber
      if (val.includes('Ex-Date')) dateCol = colNumber
      if (val.includes('Net Dividend Amount')) amountCol = colNumber
    })

    if (symbolCol !== -1 && amountCol !== -1) headerRowIndex = rowNumber
  })

  if (headerRowIndex === -1) {
    throw new Error("Could not find dividend headers (Symbol, Net Dividend Amount) in the Excel file.")
  }

  const results: Omit<CashflowEntry, 'id' | 'createdAt' | 'updatedAt'>[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return

    const symbol = String(row.getCell(symbolCol).value || '').trim()
    if (!symbol || symbol.includes('Total Dividend Amount')) return

    const amountVal = row.getCell(amountCol).value
    const amount = Number(String(amountVal).replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) return

    let dateStr = new Date().toISOString().split('T')[0]
    const dateVal = row.getCell(dateCol).value
    if (dateVal) {
      if (dateVal instanceof Date) {
        dateStr = dateVal.toISOString().split('T')[0]
      } else {
        const d = new Date(String(dateVal))
        if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0]
      }
    }

    results.push({
      type: 'income',
      category: 'Dividend',
      amount,
      date: dateStr,
      notes: `Dividend from ${symbol}`,
    })
  })

  return results
}