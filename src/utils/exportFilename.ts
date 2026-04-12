import { format } from 'date-fns';

/** Expand `{date}`, `{time}`, `{datetime}` in export filename patterns. */
export function expandExportFilenamePattern(pattern: string): string {
  const now = new Date();
  return pattern
    .replaceAll('{date}', format(now, 'yyyy-MM-dd'))
    .replaceAll('{time}', format(now, 'HH-mm-ss'))
    .replaceAll('{datetime}', format(now, 'yyyy-MM-dd_HH-mm'));
}

export function ensureCsvExtension(name: string): string {
  const t = name.trim();
  if (!t.toLowerCase().endsWith('.csv')) return `${t}.csv`;
  return t;
}

export function ensureXlsxExtension(name: string): string {
  const t = name.trim();
  if (!t.toLowerCase().endsWith('.xlsx')) return `${t}.xlsx`;
  return t;
}
