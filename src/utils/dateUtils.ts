import type { ISODateString } from '../types/investmentTypes';
import {
  formatBusinessDateLabel,
  parseBusinessDate,
  todayBusinessDate,
} from '../services/dateService';

export function todayISO(): ISODateString {
  return todayBusinessDate();
}

export function safeParseISO(date: string): Date | undefined {
  const parsed = parseBusinessDate(date);
  return parsed ?? undefined;
}

export function formatISODateLabel(date: ISODateString) {
  return formatBusinessDateLabel(date);
}


