import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import type { Investment } from '../types/investmentTypes'
import { currentValue, investedValue, profitLoss, typeLabel } from './calculations'

function toFlatRows(investments: Investment[]) {
  return investments.map((inv) => ({
    Type: typeLabel(inv.type),
    Name: inv.name,
    Symbol: inv.symbol ?? '',
    Platform: inv.platform ?? '',
    Invested: investedValue(inv),
    Current: currentValue(inv),
    ProfitLoss: profitLoss(inv),
    UpdatedAt: inv.updatedAt,
  }))
}

export function exportCSV(investments: Investment[], filename = 'portfolio.csv') {
  const rows = toFlatRows(investments)
  const headers = rows.length ? Object.keys(rows[0]) : ['Type', 'Name', 'Symbol', 'Platform', 'Invested', 'Current', 'ProfitLoss', 'UpdatedAt']
  const escapeCell = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  const csv =
    [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCell((r as any)[h])).join(','))].join('\n') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, filename)
}

export function exportExcel(investments: Investment[], filename = 'portfolio.xlsx') {
  const rows = toFlatRows(investments)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Investments')
  const headers = rows.length ? Object.keys(rows[0]) : ['Type', 'Name', 'Symbol', 'Platform', 'Invested', 'Current', 'ProfitLoss', 'UpdatedAt']

  sheet.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.max(12, Math.min(32, h.length + 6)),
  }))
  rows.forEach((r) => sheet.addRow(r as any))
  sheet.getRow(1).font = { bold: true }

  void workbook.xlsx.writeBuffer().then((buf) => {
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, filename)
  })
}

