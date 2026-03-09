import { format, isValid, parseISO } from 'date-fns'
import type { ISODateString } from '../types/investmentTypes'

export function todayISO(): ISODateString {
  return format(new Date(), 'yyyy-MM-dd')
}

export function safeParseISO(date: string): Date | undefined {
  const d = parseISO(date)
  return isValid(d) ? d : undefined
}

export function formatISODateLabel(date: ISODateString) {
  const d = safeParseISO(date)
  return d ? format(d, 'dd MMM yyyy') : date
}

