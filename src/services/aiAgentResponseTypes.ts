/**
 * src/services/aiAgentResponseTypes.ts
 *
 * Typed response objects returned by every agent tool/fetcher.
 * The UI renders each type with a dedicated component — no raw markdown needed
 * for data answers. Groq text answers still use the markdown renderer.
 *
 * Union: AgentResponse = TextResponse | TableResponse | CardResponse
 *                      | ListCardResponse | StatGridResponse | EmptyResponse
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

export type Severity = 'good' | 'warning' | 'danger' | 'neutral' | 'info';

export interface StatItem {
  label: string;
  value: string;         // pre-formatted (formatINR / formatNumber already applied)
  sub?: string;
  severity?: Severity;
}

export interface TableRow {
  cells: string[];       // pre-formatted cell values
}

export interface CardItem {
  emoji?: string;
  title: string;
  subtitle?: string;
  value?: string;
  valueSub?: string;
  severity?: Severity;
  badge?: string;
  /** Route to navigate to when user taps "View" */
  linkTo?: string;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

/** Plain text / markdown — used for Groq answers and guide answers */
export interface TextResponse {
  kind: 'text';
  content: string;
}

/** A compact grid of stat tiles (e.g. net worth overview) */
export interface StatGridResponse {
  kind: 'stat_grid';
  title: string;
  emoji?: string;
  stats: StatItem[];
  footer?: string;
  /** Alerts shown below the grid */
  alerts?: { emoji: string; text: string; severity: Severity }[];
}

/** A data table with headers and rows */
export interface TableResponse {
  kind: 'table';
  title: string;
  emoji?: string;
  headers: string[];
  rows: TableRow[];
  footer?: string;
  summary?: string;        // bold line above table (e.g. total)
}

/** A single highlighted card (e.g. "best performing stock") */
export interface CardResponse {
  kind: 'card';
  title: string;
  emoji?: string;
  stats: StatItem[];
  badge?: string;
  badgeSeverity?: Severity;
  footer?: string;
  linkTo?: string;
}

/** A list of cards (e.g. all investments in loss, all upcoming payments) */
export interface ListCardResponse {
  kind: 'list_card';
  title: string;
  emoji?: string;
  summary?: string;
  items: CardItem[];
  footer?: string;
}

/** Empty / no data state */
export interface EmptyResponse {
  kind: 'empty';
  emoji?: string;
  message: string;
  hint?: string;
}

/** Union of all structured responses */
export type AgentResponse =
  | TextResponse
  | StatGridResponse
  | TableResponse
  | CardResponse
  | ListCardResponse
  | EmptyResponse
  | ActionConfirmResponse;

/** Pending action waiting for user confirmation */
export interface ActionConfirmResponse {
  kind: 'action_confirm';
  emoji: string;
  title: string;
  /** Pre-parsed human-readable summary of what will happen */
  summary: string;
  /** Caveats / assumptions made during parsing */
  assumptions?: string[];
  /** Serialised action payload — passed back to executeAction() on confirm */
  actionPayload: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function textResponse(content: string): TextResponse {
  return { kind: 'text', content };
}

export function emptyResponse(message: string, hint?: string, emoji = '📭'): EmptyResponse {
  return { kind: 'empty', emoji, message, hint };
}

export function severityColor(s: Severity): string {
  switch (s) {
    case 'good':    return 'text-emerald-600 dark:text-emerald-400';
    case 'warning': return 'text-amber-600 dark:text-amber-400';
    case 'danger':  return 'text-rose-600 dark:text-rose-400';
    case 'info':    return 'text-blue-600 dark:text-blue-400';
    default:        return 'text-slate-700 dark:text-slate-300';
  }
}

export function severityBg(s: Severity): string {
  switch (s) {
    case 'good':    return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
    case 'warning': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
    case 'danger':  return 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800';
    case 'info':    return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    default:        return 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700';
  }
}
