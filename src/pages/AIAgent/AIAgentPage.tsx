/**
 * src/pages/AIAgent/AIAgentPage.tsx — Rewamped
 * Three tabs: Chat | Brief | Search
 * + AI Quick Add NLP bar, URL ?q= prefill from AskAIButton
 */

import {
  FiCpu, FiRefreshCw, FiSend, FiZap, FiDatabase,
  FiFileText, FiTrash2, FiExternalLink, FiInfo,
  FiSearch, FiAlertTriangle, FiCheckCircle,
  FiX, FiEdit2, FiMessageSquare, FiLayers,
} from 'react-icons/fi';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { generateFinancialAI } from '../../services/ai/aiService';
import { buildAgentContext, buildGeneralQuestionContext } from '../../services/aiAgentContextBuilder';
import { routeQuestion } from '../../services/aiAgentRouter';
import { fetchAgentResponse, generateFullReport } from '../../services/aiAgentDataFetcher';
import { matchFeatureGuide } from '../../services/aiAgentFeatureGuide';
import { parseAction } from '../../services/aiAgentActionParser';
import { executeAction } from '../../services/aiAgentActionExecutor';
import { SubscriptionGuard } from '../../components/subscription/SubscriptionGuard';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useContextualSuggestions } from '../../hooks/useContextualSuggestions';
import { useViewportPinnedShell } from '../../hooks/useViewportPinnedShell';
import { dismissKeyboard } from '../../hooks/useKeyboardFieldNavigation';
import { auth } from '../../services/firebase';
import type { AgentResponse } from '../../services/aiAgentResponseTypes';
import { severityColor, severityBg } from '../../services/aiAgentResponseTypes';
import { canIAfford, detectAffordabilityQuestion } from '../../utils/affordabilityEngine';
import { parseNaturalLanguageTransaction } from '../../utils/smartCategorize';
import { calculateNetWorth, getLiveBankTotal } from '../../utils/calculations';
import { generateMonthlyPlan } from '../../utils/aiFinancialPlan';
import { formatINR } from '../../utils/format';
import { BriefTab, SearchTab } from './AICoachPanels';
import { BulkAddPanel } from '../../components/ai/BulkAddPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'chat' | 'brief' | 'search';
type MessageRole   = 'user' | 'assistant';
type MessageSource = 'groq' | 'firebase' | 'hybrid' | 'scope' | 'report' | 'guide' | 'action';

interface Message {
  id: string;
  role: MessageRole;
  textContent?: string;
  structuredContent?: AgentResponse;
  source: MessageSource;
  timestamp: Date;
  loading?: boolean;
  /** Route to navigate after an action succeeds */
  actionLinkTo?: string;
  /** Affordability engine result — renders AffordabilityCard */
  affordabilityResult?: import('../../utils/affordabilityEngine').AffordabilityResult;
}

interface ConversationContext {
  lastIntent?: string;
  lastEntity?: string;
  lastModule?: string;
  /** When incomplete action was asked, store the original intent prefix here */
  pendingActionPrefix?: string;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const SCOPE_MESSAGE =
  "I'm FinTrackly's AI Coach. Here's what I can do:\n\n" +
  '- **Add records** — "Add ₹2500 electricity bill for Sep 15"\n' +
  '- **Update** — "Update TCS price to ₹3800"\n' +
  '- **Delete** — "Delete my home loan"\n' +
  '- **Your data** — "What is my net worth?" · "Show my investments"\n' +
  '- **App help** — "How do I add a goal?"\n' +
  '- **Finance education** — "What is SIP?" · "Explain XIRR"\n\n' +
  'Try one of the quick actions below ↓';

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_CFG: Record<MessageSource, { label: string; cls: string }> = {
  groq:     { label: 'AI',           cls: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-200/60 dark:border-violet-700/40' },
  firebase: { label: 'Your Data',    cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/60 dark:border-emerald-700/40' },
  hybrid:   { label: 'Data + AI',    cls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200/60 dark:border-blue-700/40' },
  scope:    { label: 'Info',         cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200/60 dark:border-amber-700/40' },
  report:   { label: 'Report',       cls: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 border-teal-200/60 dark:border-teal-700/40' },
  guide:    { label: 'Guide',        cls: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 border-sky-200/60 dark:border-sky-700/40' },
  action:   { label: 'Action',       cls: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200/60 dark:border-orange-700/40' },
};

function SourceBadge({ source }: { source: MessageSource }) {
  const { label, cls } = SOURCE_CFG[source];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cls}`}>
      {source === 'groq' || source === 'hybrid' ? <FiCpu className='h-2 w-2' /> : <FiDatabase className='h-2 w-2' />}
      {label}
    </span>
  );
}



// ─── Structured response renderers ────────────────────────────────────────────
// ─── Module quick-action pills ───────────────────────────────────────────────

const MODULE_ACTIONS = [
  { emoji: '💸', label: 'Expense',    question: 'Add expense' },
  { emoji: '💰', label: 'Income',     question: 'Add income' },
  { emoji: '💳', label: 'Payment',    question: 'Add payment reminder' },
  { emoji: '📈', label: 'Investment', question: 'I bought stock' },
  { emoji: '🎯', label: 'Goal',       question: 'Create a savings goal' },
  { emoji: '🏦', label: 'Loan',       question: 'Add a loan' },
  { emoji: '🛡️', label: 'Insurance',  question: 'Add insurance policy' },
  { emoji: '📊', label: 'Net Worth',  question: 'What is my net worth?' },
] as const;

function QuickActions({ onSend, disabled }: { onSend: (q: string) => void; disabled: boolean }) {
  return (
    <div className='flex gap-1.5 overflow-x-auto overscroll-x-contain py-0.5 scrollbar-none'>
      {MODULE_ACTIONS.map(({ emoji, label, question }) => (
        <button
          key={label}
          type='button'
          onClick={() => onSend(question)}
          disabled={disabled}
          className='flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all disabled:opacity-40 active:scale-95'
        >
          <span className='text-[13px] leading-none'>{emoji}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

function StatGridCard({ resp }: { resp: Extract<AgentResponse, { kind: 'stat_grid' }> }) {
  return (
    <div className='overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60'>
      <div className='flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 px-2.5 py-2 sm:gap-2 sm:px-4 sm:py-2.5'>
        {resp.emoji && <span className='text-[13px] sm:text-base'>{resp.emoji}</span>}
        <span className='min-w-0 truncate text-[12px] sm:text-sm font-bold text-slate-900 dark:text-slate-100'>{resp.title}</span>
      </div>
      <div className='grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 sm:grid-cols-3'>
        {resp.stats.map((s, i) => (
          <div key={i} className='min-w-0 bg-white dark:bg-slate-900/80 px-2.5 py-2 sm:px-3 sm:py-2.5'>
            <div className='mb-0.5 truncate text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400'>{s.label}</div>
            <div className={`break-words text-[13px] sm:text-sm font-bold tabular-nums ${s.severity ? severityColor(s.severity) : 'text-slate-900 dark:text-slate-100'}`}>{s.value}</div>
            {s.sub && <div className='mt-0.5 text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400'>{s.sub}</div>}
          </div>
        ))}
      </div>
      {resp.alerts?.length ? (
        <div className='flex flex-col gap-1 border-t border-slate-100 dark:border-slate-800 px-2.5 py-2 sm:gap-1.5 sm:px-4 sm:py-2'>
          {resp.alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px] sm:text-xs font-semibold ${severityBg(a.severity)}`}>
              <span className='shrink-0'>{a.emoji}</span>
              <span className={severityColor(a.severity)}>{a.text}</span>
            </div>
          ))}
        </div>
      ) : null}
      {resp.footer && (
        <div className='border-t border-slate-100 dark:border-slate-800 px-2.5 py-1.5 text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400'>{resp.footer}</div>
      )}
    </div>
  );
}

function TableCard({ resp }: { resp: Extract<AgentResponse, { kind: 'table' }> }) {
  return (
    <div className='overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60'>
      <div className='flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 px-2.5 py-2 sm:gap-2 sm:px-4 sm:py-2.5'>
        {resp.emoji && <span className='text-[13px] sm:text-base'>{resp.emoji}</span>}
        <span className='min-w-0 truncate text-[12px] sm:text-sm font-bold text-slate-900 dark:text-slate-100'>{resp.title}</span>
      </div>
      {resp.summary && (
        <div className='border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300'>
          {resp.summary}
        </div>
      )}
      {/* Wide tables are the one place horizontal scroll is intentional. */}
      <div className='overflow-x-auto overscroll-x-contain'>
        <table className='w-full text-[11px] sm:text-xs'>
          <thead>
            <tr className='bg-slate-50 dark:bg-slate-800/50'>
              {resp.headers.map((h, i) => (
                <th key={i} className='whitespace-nowrap px-2 py-1.5 text-left text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resp.rows.map((row, ri) => (
              <tr key={ri} className='border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors'>
                {row.cells.map((cell, ci) => (
                  <td key={ci} className={`px-2 py-1.5 ${ci === 0 ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 tabular-nums'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {resp.footer && (
        <div className='border-t border-slate-100 dark:border-slate-800 px-2.5 py-1.5 text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400'>{resp.footer}</div>
      )}
    </div>
  );
}

function SingleCard({ resp }: { resp: Extract<AgentResponse, { kind: 'card' }> }) {
  const navigate = useNavigate();
  return (
    <div className='overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60'>
      <div className='flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-2.5 py-2 sm:px-4 sm:py-2.5'>
        <div className='flex min-w-0 items-center gap-1.5 sm:gap-2'>
          {resp.emoji && <span className='text-[13px] sm:text-base'>{resp.emoji}</span>}
          <span className='truncate text-[12px] sm:text-sm font-bold text-slate-900 dark:text-slate-100'>{resp.title}</span>
        </div>
        {resp.badge && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold ${resp.badgeSeverity ? `${severityColor(resp.badgeSeverity)} ${severityBg(resp.badgeSeverity)} border` : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            {resp.badge}
          </span>
        )}
      </div>
      <div className='divide-y divide-slate-100 dark:divide-slate-800'>
        {resp.stats.map((s, i) => (
          <div key={i} className='flex items-center justify-between gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2'>
            <span className='min-w-0 truncate text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400'>{s.label}</span>
            <div className='shrink-0 text-right'>
              <span className={`text-[11px] sm:text-xs font-bold tabular-nums ${s.severity ? severityColor(s.severity) : 'text-slate-900 dark:text-slate-100'}`}>{s.value}</span>
              {s.sub && <div className='text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400'>{s.sub}</div>}
            </div>
          </div>
        ))}
      </div>
      <div className='flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 px-2.5 py-1.5 sm:px-4 sm:py-2'>
        {resp.footer && <span className='min-w-0 truncate text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400'>{resp.footer}</span>}
        {resp.linkTo && (
          <button onClick={() => navigate(resp.linkTo!)} className='ml-auto flex h-7 shrink-0 items-center gap-1 text-[10px] sm:text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline'>
            View <FiExternalLink className='h-3 w-3' />
          </button>
        )}
      </div>
    </div>
  );
}

function ListCardComp({ resp }: { resp: Extract<AgentResponse, { kind: 'list_card' }> }) {
  const navigate = useNavigate();
  return (
    <div className='overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60'>
      <div className='flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 px-2.5 py-2 sm:gap-2 sm:px-4 sm:py-2.5'>
        {resp.emoji && <span className='text-[13px] sm:text-base'>{resp.emoji}</span>}
        <span className='min-w-0 truncate text-[12px] sm:text-sm font-bold text-slate-900 dark:text-slate-100'>{resp.title}</span>
      </div>
      {resp.summary && (
        <div className='border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300'>
          {resp.summary}
        </div>
      )}
      {/* Height is viewport-relative so a long list never pushes the input bar
          out of the pinned shell. */}
      <div className='max-h-[38vh] divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto overscroll-contain sm:max-h-72'>
        {resp.items.map((item, i) => (
          <div
            key={i}
            className='flex min-h-[40px] items-center justify-between gap-2 px-2.5 py-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors sm:gap-3 sm:px-4 sm:py-2.5'
            onClick={() => item.linkTo && navigate(item.linkTo)}
            role={item.linkTo ? 'button' : undefined}
          >
            <div className='flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5'>
              {item.emoji && <span className='shrink-0 text-[13px] sm:text-base'>{item.emoji}</span>}
              <div className='min-w-0'>
                <div className='truncate text-[12px] sm:text-xs font-semibold text-slate-900 dark:text-slate-100'>{item.title}</div>
                {item.subtitle && <div className='truncate text-[10px] text-slate-500 dark:text-slate-400'>{item.subtitle}</div>}
              </div>
            </div>
            <div className='shrink-0 text-right'>
              {item.value && (
                <div className={`text-[12px] sm:text-xs font-bold tabular-nums ${item.severity ? severityColor(item.severity) : 'text-slate-900 dark:text-slate-100'}`}>{item.value}</div>
              )}
              {item.valueSub && <div className='text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400'>{item.valueSub}</div>}
              {item.badge && (
                <span className='rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 text-[9px] font-bold'>{item.badge}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {resp.footer && (
        <div className='border-t border-slate-100 dark:border-slate-800 px-2.5 py-1.5 text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400'>{resp.footer}</div>
      )}
    </div>
  );
}

function EmptyCard({ resp }: { resp: Extract<AgentResponse, { kind: 'empty' }> }) {
  return (
    <div className='rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/20 px-3 py-5 sm:px-4 sm:py-6 text-center'>
      {resp.emoji && <div className='mb-1.5 text-xl sm:text-2xl'>{resp.emoji}</div>}
      <p className='text-[13px] sm:text-sm font-semibold text-slate-600 dark:text-slate-300'>{resp.message}</p>
      {resp.hint && <p className='mt-1 text-[11px] sm:text-xs text-slate-400 dark:text-slate-400'>{resp.hint}</p>}
    </div>
  );
}

// ─── Action confirm card (standard + delete variant) ─────────────────────────

function ActionConfirmCard({
  resp,
  onConfirm,
  onCancel,
}: {
  resp: import('../../services/aiAgentResponseTypes').ActionConfirmResponse;
  onConfirm?: (payload: string) => void;
  onCancel?: () => void;
}) {
  // Detect delete action — use red destructive styling
  let payload: { kind?: string } = {};
  try { payload = JSON.parse(resp.actionPayload); } catch { /* */ }
  const isDelete = typeof payload.kind === 'string' && payload.kind.startsWith('delete_');

  if (isDelete) {
    return (
      <div className='overflow-hidden rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/60 dark:bg-rose-900/10'>
        <div className='flex items-center gap-2 border-b border-rose-100 dark:border-rose-800/40 bg-rose-100/50 dark:bg-rose-900/20 px-3 py-2 sm:px-4 sm:py-2.5'>
          <FiAlertTriangle className='h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400' />
          <span className='text-[13px] sm:text-sm font-bold text-rose-800 dark:text-rose-200'>Confirm Delete</span>
        </div>
        <div className='px-3 py-2.5 sm:px-4 sm:py-3'>
          <p className='mb-1 break-words text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200'>{resp.summary}</p>
          {resp.assumptions?.map((a, i) => (
            <p key={i} className='mt-1.5 flex items-start gap-1 text-[11px] text-rose-600 dark:text-rose-400'>
              <FiAlertTriangle className='mt-0.5 h-3 w-3 shrink-0' /> {a}
            </p>
          ))}
          <p className='mt-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400'>
            This <strong className='text-rose-600 dark:text-rose-400'>permanently deletes</strong> this record and cannot be undone.
          </p>
        </div>
        <div className='flex gap-2 border-t border-rose-100 dark:border-rose-800/40 px-3 py-2.5 sm:px-4 sm:py-2.5'>
          <button
            onClick={() => onCancel?.()}
            className='flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]'
          >
            <FiX className='h-3.5 w-3.5' /> Cancel
          </button>
          <button
            onClick={() => onConfirm?.(resp.actionPayload)}
            className='flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 text-[13px] font-bold text-white shadow-sm hover:bg-rose-500 transition-colors active:scale-[0.98]'
          >
            <FiTrash2 className='h-3.5 w-3.5' /> Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='overflow-hidden rounded-xl border border-violet-200/80 dark:border-violet-700/50 bg-violet-50/40 dark:bg-violet-900/10'>
      <div className='flex items-center gap-2 border-b border-violet-100 dark:border-violet-800/40 px-3 py-2 sm:px-4 sm:py-2.5'>
        <FiEdit2 className='h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400' />
        <span className='truncate text-[13px] sm:text-sm font-bold text-slate-900 dark:text-slate-100'>{resp.title}</span>
      </div>
      <div className='px-3 py-2.5 sm:px-4 sm:py-3'>
        <p className='mb-1 break-words text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200'>{resp.summary}</p>
        {resp.assumptions && resp.assumptions.length > 0 && (
          <div className='mt-2 space-y-1'>
            {resp.assumptions.map((a, i) => (
              <p key={i} className='flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-400'>
                <FiInfo className='mt-0.5 h-3 w-3 shrink-0' /> {a}
              </p>
            ))}
          </div>
        )}
        <p className='mt-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400'>
          Review the details. Tap <strong>Confirm</strong> to save, or <strong>Cancel</strong>.
        </p>
      </div>
      {/* Buttons fill the row and clear 44px — reachable with a thumb while the
          keyboard is up, since the shell stops above it. */}
      <div className='flex gap-2 border-t border-violet-100 dark:border-violet-800/40 px-3 py-2.5 sm:px-4 sm:py-2.5'>
        <button
          onClick={() => onCancel?.()}
          className='flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]'
        >
          <FiX className='h-3.5 w-3.5' /> Cancel
        </button>
        <button
          onClick={() => onConfirm?.(resp.actionPayload)}
          className='flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[13px] font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors active:scale-[0.98]'
        >
          <FiCheckCircle className='h-3.5 w-3.5' /> Confirm
        </button>
      </div>
    </div>
  );
}

// ─── Affordability result card ────────────────────────────────────────────────

function AffordabilityCard({ result }: { result: import('../../utils/affordabilityEngine').AffordabilityResult }) {
  const borderColor =
    result.verdict === 'yes'               ? 'border-emerald-200 dark:border-emerald-700/50'
    : result.verdict === 'possible'        ? 'border-amber-200 dark:border-amber-700/50'
    : result.verdict === 'not_recommended' ? 'border-orange-200 dark:border-orange-700/50'
    : 'border-rose-200 dark:border-rose-700/50';

  const headerBg =
    result.verdict === 'yes'               ? 'bg-emerald-50 dark:bg-emerald-900/20'
    : result.verdict === 'possible'        ? 'bg-amber-50 dark:bg-amber-900/20'
    : result.verdict === 'not_recommended' ? 'bg-orange-50 dark:bg-orange-900/20'
    : 'bg-rose-50 dark:bg-rose-900/20';

  const textColor =
    result.verdict === 'yes'               ? 'text-emerald-800 dark:text-emerald-300'
    : result.verdict === 'possible'        ? 'text-amber-800 dark:text-amber-300'
    : result.verdict === 'not_recommended' ? 'text-orange-800 dark:text-orange-300'
    : 'text-rose-800 dark:text-rose-300';

  const impactColor: Record<string, string> = {
    good:    'text-emerald-600 dark:text-emerald-400',
    neutral: 'text-slate-500 dark:text-slate-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger:  'text-rose-600 dark:text-rose-400',
  };

  return (
    <div className={`overflow-hidden rounded-xl border ${borderColor}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 sm:px-4 ${headerBg}`}>
        <span className='text-lg sm:text-xl'>{result.verdictEmoji}</span>
        <span className={`text-[13px] sm:text-sm font-bold ${textColor}`}>{result.verdictLabel}</span>
      </div>
      {/* Summary */}
      <div className='border-b border-slate-100 dark:border-slate-800 px-3 py-2.5 sm:px-4'>
        <p className='text-[13px] sm:text-sm text-slate-700 dark:text-slate-300'>{result.summary}</p>
      </div>
      {/* Impact rows — stacked on phones so the before→after pair never wraps
          into a clipped third column. */}
      <div className='divide-y divide-slate-100 dark:divide-slate-800'>
        {result.details.map((d, i) => (
          <div key={i} className='px-3 py-2 sm:flex sm:items-baseline sm:gap-3 sm:px-4 sm:py-2.5'>
            <span className='text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:w-28 sm:shrink-0 sm:normal-case sm:tracking-normal sm:text-[11px]'>{d.label}</span>
            <div className='mt-0.5 flex items-baseline gap-2 text-[12px] sm:mt-0 sm:flex-1 sm:text-xs tabular-nums'>
              <span className='text-slate-700 dark:text-slate-300'>{d.before}</span>
              <span className='text-slate-400 dark:text-slate-400'>→</span>
              <span className={impactColor[d.impact] ?? 'text-slate-700 dark:text-slate-300'}>{d.after}</span>
              {d.note && <span className={`hidden min-w-0 flex-1 text-right text-[10px] sm:block ${impactColor[d.impact]}`}>{d.note}</span>}
            </div>
            {d.note && <span className={`mt-0.5 block text-[10px] sm:hidden ${impactColor[d.impact]}`}>{d.note}</span>}
          </div>
        ))}
      </div>
      {/* Recommended budget */}
      {result.recommendedBudget && (
        <div className='border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 px-3 py-2 sm:px-4'>
          <p className='text-[11px] sm:text-xs text-slate-600 dark:text-slate-400'>
            💡 <strong>Recommended budget:</strong>{' '}
            ₹{result.recommendedBudget.min.toLocaleString('en-IN')} – ₹{result.recommendedBudget.max.toLocaleString('en-IN')}
          </p>
        </div>
      )}
    </div>
  );
}

function StructuredRenderer({ resp, onConfirm, onCancel }: {
  resp: AgentResponse;
  onConfirm?: (payload: string) => void;
  onCancel?: () => void;
}) {
  switch (resp.kind) {
    case 'stat_grid':      return <StatGridCard resp={resp} />;
    case 'table':          return <TableCard resp={resp} />;
    case 'card':           return <SingleCard resp={resp} />;
    case 'list_card':      return <ListCardComp resp={resp} />;
    case 'empty':          return <EmptyCard resp={resp} />;
    case 'text':           return <MarkdownRenderer text={resp.content} />;
    case 'action_confirm': return <ActionConfirmCard resp={resp} onConfirm={onConfirm} onCancel={onCancel} />;
    default:               return null;
  }
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownRenderer({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className='min-w-0 space-y-1 text-[13px] leading-relaxed sm:space-y-1.5 sm:text-sm'>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className='h-1' />;
        const h2 = line.match(/^##\s+(.+)$/);
        if (h2) return <h3 key={i} className='pt-1.5 text-[13px] font-bold text-slate-900 dark:text-white sm:pt-2 sm:text-sm'>{h2[1]}</h3>;
        const h3 = line.match(/^###\s+(.+)$/);
        if (h3) return <h4 key={i} className='pt-1 text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 sm:text-xs'>{h3[1]}</h4>;
        if (/^\|[-| ]+\|$/.test(line.trim())) return null;
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
          const cells = line.split('|').filter((c) => c.trim());
          return (
            <div key={i} className='flex gap-2 border-b border-slate-100 dark:border-slate-800 py-1 text-[12px] sm:text-xs'>
              {cells.map((cell, j) => (
                <span key={j} className={`min-w-0 flex-1 break-words ${j === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-right font-semibold text-slate-900 dark:text-slate-100'}`}
                  dangerouslySetInnerHTML={{ __html: inlineFmt(cell.trim()) }} />
              ))}
            </div>
          );
        }
        if (line.match(/^[-*]\s+/)) {
          const content = line.replace(/^[-*]\s+/, '');
          return (
            <div key={i} className='flex items-start gap-2'>
              <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400 dark:bg-violet-500' />
              <span className='min-w-0 flex-1 text-inherit text-slate-700 dark:text-slate-300' dangerouslySetInnerHTML={{ __html: inlineFmt(content) }} />
            </div>
          );
        }
        const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) return (
          <div key={i} className='flex items-start gap-2'>
            <span className='mt-0.5 min-w-[16px] shrink-0 text-[11px] font-bold text-violet-500 dark:text-violet-400'>{numMatch[1]}.</span>
            <span className='min-w-0 flex-1 text-inherit text-slate-700 dark:text-slate-300' dangerouslySetInnerHTML={{ __html: inlineFmt(numMatch[2]) }} />
          </div>
        );
        return <p key={i} className='text-inherit text-slate-700 dark:text-slate-300' dangerouslySetInnerHTML={{ __html: inlineFmt(line) }} />;
      })}
    </div>
  );
}

function inlineFmt(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-900 dark:text-slate-100">$1</strong>')
    .replace(/\*([^*]+)\*/g,     '<em class="italic text-slate-500 dark:text-slate-400">$1</em>')
    .replace(/`([^`]+)`/g,       '<code class="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[11px]">$1</code>');
}

// ─── Thinking animation ───────────────────────────────────────────────────────

function ThinkingBubble() {
  return (
    <div className='flex items-center gap-1.5 px-3 py-2.5 sm:px-4 sm:py-3'>
      {[0, 0.18, 0.36].map((d, i) => (
        <div key={i} className='h-2 w-2 rounded-full bg-violet-400/70 dark:bg-violet-500/70'
          style={{ animation: `aiCoachBounce 1.1s ease-in-out ${d}s infinite` }} />
      ))}
      <style>{`@keyframes aiCoachBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}

// ─── Proactive insight banner ─────────────────────────────────────────────────

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AIAgentPage() {
  const [searchParams]                      = useSearchParams();
  const ready                               = usePortfolioStore((s) => s.ready);
  const suggestions                         = useContextualSuggestions();

  const [tab,             setTab]           = useState<Tab>('chat');
  const [messages,        setMessages]      = useState<Message[]>([]);
  const [input,           setInput]         = useState('');
  const [loading,         setLoading]       = useState(false);
  const [generatingReport,setGeneratingReport] = useState(false);
  const [convCtx,         setConvCtx]       = useState<ConversationContext>({});
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [showBulk,        setShowBulk]      = useState(false);

  // NLP Quick Add state
  const [nlpInput,  setNlpInput]  = useState('');
  const [nlpParsed, setNlpParsed] = useState<ReturnType<typeof parseNaturalLanguageTransaction> | null>(null);
  const [nlpSaving, setNlpSaving] = useState(false);

  const inputRef  = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate  = useNavigate();

  // On phones the whole shell is pinned to the *visual* viewport, so it always
  // ends exactly at the top of the soft keyboard — the input bar, quick-action
  // pills and Confirm/Cancel buttons can never be hidden by it, and the page
  // cannot be scrolled away from the chat while typing.
  const { shellRef, pinned, shellStyle, reservedHeight, visibleHeight } = useViewportPinnedShell();

  // Pre-fill from ?q= (from AskAIButton on any module page)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setInput(q); setTab('chat'); setTimeout(() => inputRef.current?.focus(), 150); }
  }, [searchParams]);

  // Enrich follow-up questions with conversation context
  const enrichQuestion = useCallback((q: string, ctx: ConversationContext): string => {
    // Multi-turn: if previous turn asked for missing info, prepend the original prefix
    if (ctx.pendingActionPrefix) {
      return `${ctx.pendingActionPrefix} ${q}`;
    }
    const lower = q.toLowerCase().trim();
    const followUpPhrases = ['how much', 'which one', 'what about', 'and that one', 'why', 'explain', 'tell me more'];
    const isFollowUp = followUpPhrases.some((p) => lower.startsWith(p)) && lower.split(' ').length <= 5;
    if (isFollowUp && ctx.lastEntity) return `${q} ${ctx.lastEntity}`;
    return q;
  }, []);

  useEffect(() => {
    // Scroll only the message thread — never the page's <main> container, which
    // would shift the input bar relative to the soft keyboard.
    const thread = bottomRef.current?.parentElement;
    if (thread) thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
    // `visibleHeight` re-runs this when the keyboard opens: the shell shrinks,
    // so the newest reply has to be pulled back above it.
  }, [messages, visibleHeight]);

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateLastAssistant = useCallback((patch: Partial<Message>) => {
    setMessages((prev) => {
      const last = [...prev].reverse().find((m) => m.role === 'assistant');
      if (!last) return prev;
      return prev.map((m) => (m.id === last.id ? { ...m, ...patch } : m));
    });
  }, []);

  // ── Send message ────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (rawQuestion: string) => {
    const question = enrichQuestion(rawQuestion.trim(), convCtx);
    if (!question || loading) return;

    setInput('');
    setLoading(true);

    appendMessage({
      id: genId(), role: 'user', textContent: rawQuestion.trim(),
      source: 'firebase', timestamp: new Date(),
    });

    const loadingId = genId();
    appendMessage({
      id: loadingId, role: 'assistant', source: 'firebase',
      timestamp: new Date(), loading: true,
    });

    try {

      // Plan my finances intercept
      const isPlanRequest = /plan\s+(my\s+)?(finances|budget|month|september|october|november|december|january|february|march|april|may|june|july|august)/i.test(question) || /what\s+should\s+i\s+do\s+this\s+month/i.test(question);
      if (isPlanRequest) {
        const s = usePortfolioStore.getState();
        const planResult = generateMonthlyPlan(s.cashflows, s.investments, s.liabilities, s.goals, s.goalContributions, s.essentials, s.accounts);
        const planText = [
          `## ${planResult.month} Financial Plan ${planResult.status}`,
          `**Income:** ${formatINR(planResult.totalIncome)} | **Savings Rate:** ${Math.round(planResult.savingsRate)}%`,
          '',
          ...planResult.items.map(i => `- ${i.emoji} **${i.label}:** ${formatINR(i.amount)} (${Math.round(i.pct)}%)`),
          '',
          `**Surplus after plan:** ${formatINR(planResult.surplus)}`,
          '',
          `💡 **Top action:** ${planResult.topRecommendation}`,
        ].join('\n');
        updateLastAssistant({ id: loadingId, textContent: planText, source: 'firebase', loading: false });
        return;
      }
      // ── Can I afford? — intercept before routing ──────────────────────
      const affordAmount = detectAffordabilityQuestion(question);
      if (affordAmount !== null && affordAmount > 0) {
        const {
          investments, liabilities, cashflows, accounts,
          trackedPayments, goals, goalContributions, essentials,
        } = usePortfolioStore.getState();

        const { totalAssets, totalLiabilities } = calculateNetWorth(investments, liabilities, undefined, accounts, cashflows);
        void totalAssets; void totalLiabilities;

        const totalCash        = getLiveBankTotal(accounts, cashflows);
        const today            = new Date().toISOString().slice(0, 10);
        const in30             = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        const upcomingBills    = trackedPayments
          .filter((p) => p.status === 'pending' && p.dueDate >= today && p.dueDate <= in30)
          .reduce((a, p) => a + p.amount, 0);

        const incEntries = cashflows.filter((e) => e.type === 'income');
        const expEntries = cashflows.filter((e) => e.type === 'expense');
        const months     = new Set(incEntries.map((e) => e.date.slice(0, 7))).size || 1;
        const avgInc     = incEntries.reduce((a, e) => a + e.amount, 0) / months;
        const avgExp     = expEntries.reduce((a, e) => a + e.amount, 0) /
          (new Set(expEntries.map((e) => e.date.slice(0, 7))).size || 1);

        const totalDebt  = liabilities
          .filter((l) => !l.status || l.status === 'active')
          .reduce((a, l) => a + (l.outstanding ?? 0), 0);
        const totalEMI   = liabilities
          .filter((l) => !l.status || l.status === 'active')
          .reduce((a, l) => a + (l.emiAmount ?? 0), 0);

        const goalList = goals
          .filter((g) => !g.status || g.status === 'active')
          .map((g) => {
            const contributed = goalContributions
              .filter((c) => c.goalId === g.id)
              .reduce((a, c) => a + c.amount, 0);
            return {
              name:        g.name,
              targetAmount: g.targetAmount,
              savedAmount:  g.currentAmount + contributed,
              dueDate:     g.dueDate,
            };
          });

        const affordResult = canIAfford({
          purchaseAmount:              affordAmount,
          totalCash,
          avgMonthlyIncome:            avgInc,
          avgMonthlyExpense:           avgExp,
          emergencyFundCurrent:        essentials.emergencyFundCurrent ?? 0,
          emergencyFundTarget:         essentials.emergencyFundTarget  ?? 0,
          avgMonthlyExpenseForRunway:  avgExp,
          upcomingBillsTotal:          upcomingBills,
          totalOutstandingDebt:        totalDebt,
          totalMonthlyEMI:             totalEMI,
          goals:                       goalList,
        });

        updateLastAssistant({
          id: loadingId,
          textContent: undefined,
          structuredContent: {
            kind:   'text',
            content: `__AFFORDABILITY__${JSON.stringify(affordResult)}`,
          } as any,
          source: 'firebase',
          loading: false,
        });

        // Store affordability result on message for AffordabilityCard renderer
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? { ...m, affordabilityResult: affordResult, structuredContent: undefined,
                  textContent: undefined, loading: false, source: 'firebase' as const }
              : m,
          ),
        );
        return;
      }

      const route = routeQuestion(question);

      // ── Out of scope ──────────────────────────────────────────────────
      if (route.type === 'OUT_OF_SCOPE') {
        updateLastAssistant({ id: loadingId, textContent: SCOPE_MESSAGE, source: 'scope', loading: false });
        setConvCtx({});
        return;
      }

      // ── Feature guide ─────────────────────────────────────────────────
      if (route.type === 'FEATURE_GUIDE') {
        const guide = matchFeatureGuide(question);
        updateLastAssistant({
          id: loadingId,
          textContent: guide?.answer ?? "Try: *How do I add a payment?* or *What can FinTrackly do?*",
          source: 'guide', loading: false,
        });
        setConvCtx({ lastModule: 'guide' });
        return;
      }

      // ── ACTION — parse, confirm, execute ─────────────────────────────
      if (route.type === 'ACTION') {
        const parsed = parseAction(question);

        if (parsed.incomplete) {
          // Store the full question as prefix so the next reply completes it
          updateLastAssistant({
            id: loadingId,
            textContent: parsed.missingPrompt ?? 'Please provide more details.',
            source: 'action', loading: false,
          });
          setConvCtx((prev) => ({
            ...prev,
            pendingActionPrefix: question,
          }));
          return;
        }

        // Clear the pending prefix — the action was successfully parsed
        setConvCtx((prev) => ({ ...prev, pendingActionPrefix: undefined }));

        if (!parsed.action) {
          updateLastAssistant({
            id: loadingId,
            textContent: "I understood you want to act on something, but couldn't parse the details.\n\nTry:\n- *\"Add ₹2500 electricity bill for Sep 15\"*\n- *\"I bought 10 TCS shares at ₹3200\"*\n- *\"Delete my home loan\"*",
            source: 'action', loading: false,
          });
          return;
        }

        const confirmCard: import('../../services/aiAgentResponseTypes').ActionConfirmResponse = {
          kind: 'action_confirm',
          emoji: '✏️',
          title: 'Confirm Action',
          summary: parsed.summary,
          assumptions: parsed.assumptions.length ? parsed.assumptions : undefined,
          actionPayload: JSON.stringify(parsed.action),
        };

        setPendingActionId(loadingId);
        updateLastAssistant({
          id: loadingId, structuredContent: confirmCard,
          source: 'action', loading: false,
        });
        return;
      }

      // ── Personal data — store answer ──────────────────────────────────
      if (route.type === 'PERSONAL_DATA') {
        if (!ready) {
          updateLastAssistant({
            id: loadingId, textContent: '⏳ Your data is still loading. Please try again in a moment.',
            source: 'firebase', loading: false,
          });
          return;
        }
        const structured = fetchAgentResponse(route.intent, route.symbol, route.dateScope);
        updateLastAssistant({ id: loadingId, structuredContent: structured, source: 'firebase', loading: false });
        setConvCtx({ lastIntent: route.intent, lastEntity: route.symbol, lastModule: route.intent.split('_')[0] });
        return;
      }

      // ── Personal + AI explanation ─────────────────────────────────────
      if (route.type === 'PERSONAL_EXPLAIN') {
        if (!ready) {
          updateLastAssistant({
            id: loadingId, textContent: '⏳ Your data is still loading. Please try again in a moment.',
            source: 'firebase', loading: false,
          });
          return;
        }
        const context = buildAgentContext();
        const result  = await generateFinancialAI({ type: 'question', question, context });
        updateLastAssistant({ id: loadingId, textContent: result.text, source: 'hybrid', loading: false });
        setConvCtx({ lastIntent: route.intent, lastModule: route.intent.split('_')[0] });
        return;
      }

      // ── General education ─────────────────────────────────────────────
      const context = buildGeneralQuestionContext();
      const result  = await generateFinancialAI({ type: 'question', question, context });
      updateLastAssistant({ id: loadingId, textContent: result.text, source: 'groq', loading: false });
      setConvCtx({ lastModule: 'general' });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateLastAssistant({
        id: loadingId, textContent: `❌ ${msg.slice(0, 300)}`,
        source: 'scope', loading: false,
      });
      toast.error('Request failed. Please try again.');
    } finally {
      setLoading(false);
      // Re-focus only on tablet/desktop. On a phone, stealing focus after every
      // reply forces the soft keyboard open (even when the answer came from a
      // quick-action pill), which hides the reply the user is trying to read.
      if (!pinned) inputRef.current?.focus();
    }
  }, [loading, ready, convCtx, enrichQuestion, appendMessage, updateLastAssistant, pinned]);

  // ── Confirm action ──────────────────────────────────────────────────────

  const handleConfirmAction = useCallback(async (actionPayload: string) => {
    if (!actionPayload) return;
    const execId = genId();
    appendMessage({ id: execId, role: 'assistant', source: 'action', timestamp: new Date(), loading: true });
    setPendingActionId(null);
    try {
      const action = JSON.parse(actionPayload);
      const result = await executeAction(action);
      updateLastAssistant({
        id: execId,
        textContent: result.message,
        source: result.success ? 'firebase' : 'scope',
        loading: false,
        actionLinkTo: result.linkTo,
      });
    } catch {
      updateLastAssistant({ id: execId, textContent: '❌ Action failed. Please try again.', source: 'scope', loading: false });
    }
  }, [appendMessage, updateLastAssistant]);

  const handleCancelAction = useCallback(() => {
    if (!pendingActionId) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === pendingActionId
          ? { ...m, textContent: 'Action cancelled.', structuredContent: undefined, source: 'scope' as const }
          : m,
      ),
    );
    setPendingActionId(null);
  }, [pendingActionId]);

  // ── Generate report ─────────────────────────────────────────────────────

  const handleGenerateReport = useCallback(async () => {
    if (generatingReport || !ready) return;
    setGeneratingReport(true);
    appendMessage({ id: genId(), role: 'user', textContent: '📊 Generate my complete financial report', source: 'firebase', timestamp: new Date() });
    const loadingId = genId();
    appendMessage({ id: loadingId, role: 'assistant', source: 'report', timestamp: new Date(), loading: true });
    try {
      const report = generateFullReport();
      updateLastAssistant({ id: loadingId, textContent: report, source: 'report', loading: false });
    } catch {
      updateLastAssistant({ id: loadingId, textContent: '❌ Could not generate report.', source: 'scope', loading: false });
    } finally {
      setGeneratingReport(false);
    }
  }, [generatingReport, ready, appendMessage, updateLastAssistant]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(input); }
  };

  const userInitial = (auth.currentUser?.displayName?.[0] ?? auth.currentUser?.email?.[0] ?? 'U').toUpperCase();
  const isEmpty     = messages.length === 0;

  // NLP Quick Add helpers
  const handleNlpParse = () => {
    if (!nlpInput.trim()) return;
    setNlpParsed(parseNaturalLanguageTransaction(nlpInput));
  };
  const handleNlpConfirm = async () => {
    if (!nlpParsed?.amount || nlpSaving) return;
    setNlpSaving(true);
    try {
      await usePortfolioStore.getState().addCashflow({ type: nlpParsed.type, date: nlpParsed.date, category: nlpParsed.category, amount: nlpParsed.amount, ...(nlpParsed.notes ? { notes: nlpParsed.notes } : {}) } as any);
      toast.success(`${nlpParsed.type === 'income' ? 'Income' : 'Expense'} added!`);
      setNlpInput(''); setNlpParsed(null);
    } catch { toast.error('Failed to save.'); } finally { setNlpSaving(false); }
  };

  const tabCls = (t: Tab) =>
    `flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition-all ${tab === t ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`;

  /** Leaving a tab must drop focus, otherwise the keyboard stays up over it. */
  const switchTab = useCallback((next: Tab) => {
    dismissKeyboard();
    setTab(next);
  }, []);

  const toggleBulk = useCallback(() => {
    dismissKeyboard();
    setShowBulk((v) => !v);
  }, []);

  return (
    <SubscriptionGuard feature='ai_insights'>
      {/* In-flow reserve keeps the page length stable while the shell below is
          lifted out of it — no jump when the keyboard opens or closes. */}
      <div style={pinned ? { height: reservedHeight } : undefined} className='w-full'>
      <div ref={shellRef} style={shellStyle} className='mx-auto flex w-full max-w-3xl flex-col gap-2'>

        {/* Header. Dropped while Bulk Add owns a phone screen: with the keyboard
            up there is barely 280px of shell left, and every pixel of the page
            chrome here is a form row the user cannot reach. */}
        {!(showBulk && pinned) && (
        <header className='shrink-0 flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent border border-violet-500/20 shadow-sm px-2.5 py-1.5 sm:gap-3 sm:px-4 sm:py-2.5'>
          <div className='flex min-w-0 items-center gap-2 sm:gap-3'>
            <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-500/30 sm:h-8 sm:w-8'>
              <FiCpu className='h-3.5 w-3.5 sm:h-4 sm:w-4' />
            </div>
            <div className='min-w-0'>
              <h1 className='flex items-center gap-1.5 text-[13px] font-bold text-slate-900 dark:text-white sm:text-sm'>AI Coach <FiZap className='h-3 w-3 text-amber-400' /></h1>
              <p className='hidden text-[10px] leading-none text-slate-500 dark:text-slate-400 sm:block'>Chat · Brief · Search</p>
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-1.5 sm:gap-2'>
            {tab === 'chat' && messages.length > 0 && (
              <button onClick={() => { dismissKeyboard(); setMessages([]); setConvCtx({}); setPendingActionId(null); }} aria-label='Clear conversation' className='flex h-8 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 px-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-colors'>
                <FiTrash2 className='h-3 w-3' /><span className='hidden sm:inline'>Clear</span>
              </button>
            )}
            {/* Bulk Add button */}
            <button
              onClick={toggleBulk}
              title='Bulk add multiple records at once'
              aria-pressed={showBulk}
              className={`flex h-8 items-center gap-1.5 rounded-xl border px-2 text-[10px] font-bold transition-all sm:px-2.5 ${
                showBulk
                  ? 'border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-500/25'
                  : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 dark:hover:border-violet-500 dark:hover:text-violet-300'
              }`}
            >
              <FiLayers className='h-3.5 w-3.5' />
              <span className='hidden sm:inline'>Bulk Add</span>
            </button>
            <button onClick={() => void handleGenerateReport()} disabled={generatingReport || !ready} className='flex h-8 items-center gap-1.5 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 px-2.5 text-[10px] font-bold text-white shadow-lg shadow-teal-500/20 disabled:opacity-40 transition-all sm:px-3'>
              {generatingReport ? <FiRefreshCw className='h-3 w-3 animate-spin' /> : <FiFileText className='h-3 w-3' />}<span className='hidden sm:inline'>Report</span>
            </button>
          </div>
        </header>
        )}

        {/* Tab bar — hidden with the header while Bulk Add is open (the panel
            carries its own title and close button). */}
        {!(showBulk && pinned) && (
        <div className='flex shrink-0 gap-1 rounded-2xl bg-slate-100 dark:bg-slate-800/60 p-0.5 sm:p-1'>
          <button type='button' onClick={() => switchTab('chat')} className={tabCls('chat')}><FiMessageSquare className='h-3 w-3 sm:h-3.5 sm:w-3.5' /> Chat</button>
          <button type='button' onClick={() => switchTab('brief')} className={tabCls('brief')}><FiZap className='h-3 w-3 sm:h-3.5 sm:w-3.5' /> Brief</button>
          <button type='button' onClick={() => switchTab('search')} className={tabCls('search')}><FiSearch className='h-3 w-3 sm:h-3.5 sm:w-3.5' /> Search</button>
        </div>
        )}

        {/* Bulk Add Panel — takes over the content area when toggled */}
        {showBulk && (
          <div className='min-h-0 flex-1 overflow-hidden'>
            <BulkAddPanel onClose={toggleBulk} />
          </div>
        )}

        {/* Brief tab — only when bulk is closed */}
        {!showBulk && tab === 'brief' && <div className='flex-1 overflow-y-auto overscroll-contain min-h-0'><BriefTab onAsk={(q) => { setInput(q); setTab('chat'); void sendMessage(q); }} /></div>}

        {/* Search tab — only when bulk is closed */}
        {!showBulk && tab === 'search' && <div className='flex-1 overflow-y-auto overscroll-contain min-h-0'><SearchTab /></div>}

        {/* Chat tab — only when bulk is closed */}
        {!showBulk && tab === 'chat' && (
          <>
            {/* NLP Quick Add — one-tap expense/income entry */}
            <div className='shrink-0 rounded-2xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/10 p-1.5 sm:p-2'>
              {nlpParsed ? (
                <div className='flex items-center gap-2'>
                  <span className='min-w-0 flex-1 truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-400'>
                    {nlpParsed.type === 'income' ? '💰' : '💸'} <strong>{nlpParsed.category}</strong> · {nlpParsed.amount ? formatINR(nlpParsed.amount) : '?'} · {nlpParsed.date}
                    {nlpParsed.confidence !== 'high' && <span className='ml-1 text-amber-500 dark:text-amber-400'>(low confidence — edit if needed)</span>}
                  </span>
                  <button onClick={() => { dismissKeyboard(); void handleNlpConfirm(); }} disabled={nlpSaving} className='flex h-8 shrink-0 items-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 text-[11px] font-bold disabled:opacity-40 active:scale-95 transition-all'>{nlpSaving ? 'Saving…' : 'Confirm'}</button>
                  <button onClick={() => setNlpParsed(null)} aria-label='Discard parsed entry' className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'><FiX className='h-3.5 w-3.5' /></button>
                </div>
              ) : (
                <div className='flex items-center gap-1.5'>
                  <span className='text-xs sm:text-sm shrink-0 pl-0.5'>✨</span>
                  {/* 16px on phones: iOS zooms the page below that, which throws
                      the pinned layout (and the keyboard) out of place. */}
                  <input value={nlpInput} onChange={e => setNlpInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleNlpParse(); } }}
                    enterKeyHint='go' autoCapitalize='sentences' autoComplete='off' aria-label='Quick add a transaction'
                    placeholder='Spent ₹450 on dinner'
                    className='flex-1 min-w-0 bg-transparent py-1 text-[14px] sm:text-xs text-slate-700 dark:text-slate-300 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500' />
                  {nlpInput.trim() && <button onClick={handleNlpParse} className='flex h-8 shrink-0 items-center rounded-lg bg-emerald-600 text-white px-2.5 text-[11px] font-bold hover:bg-emerald-500 active:scale-95 transition-all'>Parse</button>}
                </div>
              )}
            </div>

            {/* Message thread — the only thing that scrolls inside the shell */}
            <div className='flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 px-2.5 py-2.5 space-y-3 sm:space-y-4 sm:px-3 min-h-0'>
              {isEmpty && (
                <div className='flex flex-col gap-3 h-full'>
                  {/* Quick action pills — all 8 categories */}
                  <div>
                    <p className='text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400 mb-1.5'>Quick Add</p>
                    <div className='grid grid-cols-4 gap-1.5 sm:gap-2'>
                      {[
                        { emoji: '💸', label: 'Expense',    q: 'Add expense' },
                        { emoji: '💰', label: 'Income',     q: 'Add income' },
                        { emoji: '💳', label: 'Payment',    q: 'Add payment reminder' },
                        { emoji: '📈', label: 'Investment', q: 'I bought stock' },
                        { emoji: '🎯', label: 'Goal',       q: 'Create a savings goal' },
                        { emoji: '🏦', label: 'Loan',       q: 'Add a loan' },
                        { emoji: '🛡️', label: 'Insurance',  q: 'Add insurance policy' },
                        { emoji: '🔍', label: 'Net Worth',  q: 'What is my net worth?' },
                      ].map(({ emoji, label, q }) => (
                        <button key={label} type='button' onClick={() => void sendMessage(q)} disabled={loading}
                          className='flex flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 px-1 py-2.5 sm:py-3 transition-all disabled:opacity-40 active:scale-95'>
                          <span className='text-lg leading-none sm:text-xl'>{emoji}</span>
                          <span className='text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-300 text-center leading-tight'>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Suggested questions */}
                  <div>
                    <p className='text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400 mb-1.5'>Ask AI</p>
                    <div className='flex flex-wrap gap-1.5'>
                      {suggestions.map(({ emoji, label, question }) => (
                        <button key={label} onClick={() => void sendMessage(question)} disabled={loading}
                          className='flex h-8 items-center gap-1 rounded-full border border-violet-200/70 dark:border-violet-700/50 bg-violet-50 dark:bg-violet-900/20 px-2.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors disabled:opacity-50 active:scale-95'>
                          <span>{emoji}</span>{label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400 mt-auto pb-0.5'>
                    <span className='flex items-center gap-1'><FiDatabase className='h-3 w-3 text-emerald-500'/>Instant from data</span>
                    <span className='flex items-center gap-1'><FiCpu className='h-3 w-3 text-violet-500'/>AI via Groq</span>
                    <span>✨ Type naturally in the bar above</span>
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-1.5 sm:gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow mt-1'><FiCpu className='h-3 w-3' /></div>
                  )}
                  {/* Bubbles are width-capped so long words can never push a
                      horizontal scrollbar onto the phone screen. */}
                  <div className={`min-w-0 max-w-[86%] sm:max-w-[88%] ${msg.role === 'user' ? '' : 'flex-1'}`}>
                    {msg.loading ? (
                      <div className='bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl rounded-tl-sm'><ThinkingBubble /></div>
                    ) : msg.role === 'user' ? (
                      <div className='flex flex-col items-end gap-0.5'>
                        <div className='break-words rounded-2xl rounded-tr-sm bg-violet-600 px-3 py-2 text-[13px] font-medium leading-snug text-white sm:px-4 sm:py-2.5 sm:text-sm'>{msg.textContent}</div>
                        <span className='text-[9px] text-slate-400 dark:text-slate-400 pr-1'>{fmtTime(msg.timestamp)}</span>
                      </div>
                    ) : (
                      <div className='space-y-1.5 min-w-0'>
                        <div className='flex items-center gap-2'><SourceBadge source={msg.source} /><span className='text-[9px] text-slate-400 dark:text-slate-400'>{fmtTime(msg.timestamp)}</span></div>
                        {msg.affordabilityResult
                          ? <AffordabilityCard result={msg.affordabilityResult} />
                          : msg.structuredContent
                          ? <StructuredRenderer resp={msg.structuredContent} onConfirm={handleConfirmAction} onCancel={handleCancelAction} />
                          : <div className='break-words rounded-xl rounded-tl-sm border border-slate-200/70 dark:border-slate-700/50 bg-white dark:bg-slate-900/60 px-3 py-2.5 sm:px-4 sm:py-3'><MarkdownRenderer text={msg.textContent ?? ''} /></div>
                        }
                        {msg.actionLinkTo && msg.source === 'firebase' && (
                          <button onClick={() => navigate(msg.actionLinkTo!)} className='flex h-8 items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline mt-0.5'><FiExternalLink className='h-3 w-3' /> View in app</button>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-700 text-white text-[10px] font-bold mt-1'>{userInitial}</div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Quick action pills — always visible above input */}
            <div className='shrink-0'>
              <QuickActions onSend={(q) => void sendMessage(q)} disabled={loading} />
            </div>

            {/* Input bar — pinned to the top of the keyboard by the shell */}
            <div className='shrink-0'>
              <div className='flex gap-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 p-1 shadow-sm focus-within:ring-2 focus-within:ring-violet-500/30 transition-all sm:gap-2 sm:p-1.5'>
                <div className='flex items-center pl-2 text-slate-400 dark:text-slate-400 shrink-0'><FiSearch className='h-3.5 w-3.5' /></div>
                <input ref={inputRef} type='text' value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder='Ask AI or type a command…' disabled={loading}
                  enterKeyHint='send' autoCapitalize='sentences' autoComplete='off' aria-label='Message the AI Coach'
                  className='flex-1 min-w-0 bg-transparent px-1.5 py-1.5 text-[14px] text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50 sm:px-2 sm:py-2 sm:text-sm' />
                <button onClick={() => void sendMessage(input)} disabled={loading || !input.trim()} aria-label='Send'
                  className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-40 hover:bg-violet-500 active:scale-95 transition-all'>
                  {loading ? <FiRefreshCw className='h-4 w-4 animate-spin' /> : <FiSend className='h-4 w-4' />}
                </button>
              </div>
              <p className='mt-0.5 text-center text-[9px] text-slate-400 dark:text-slate-400'>AI via Groq · Not investment advice · <Link to='/settings' className='text-violet-500 dark:text-violet-400 hover:underline'>Settings</Link></p>
            </div>
          </>
        )}

      </div>
      </div>
    </SubscriptionGuard>
  );
}
