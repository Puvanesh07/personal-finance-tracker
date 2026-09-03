/**
 * src/pages/AIAgent/AIAgentPage.tsx
 *
 * FinTrackly AI Coach — redesigned conversational interface.
 *
 * Answer paths:
 *   OUT_OF_SCOPE    → static scope message
 *   FEATURE_GUIDE   → built-in how-to answer
 *   PERSONAL_DATA   → structured AgentResponse from store (no AI)
 *   PERSONAL_EXPLAIN→ store data → Groq explanation
 *   GENERAL         → Groq educational answer
 *   ACTION          → parse → confirm card → execute → store
 *
 * New features vs old:
 *   • Module quick-action pill strip (Add / Ask shortcuts per module)
 *   • Delete confirmation card (red, destructive styling, separate from regular confirm)
 *   • Multi-turn missing-field: after "incomplete" the next message auto-appends
 *     the original intent context so the follow-up completes the action
 *   • Redesigned bubbles — user pill right, assistant card left with icon strip
 *   • Timestamp on each bubble
 *   • Action result card with link-to navigation button
 */

import {
  FiCpu, FiRefreshCw, FiSend, FiZap, FiDatabase,
  FiFileText, FiTrash2, FiExternalLink, FiInfo,
  FiPlus, FiSearch, FiAlertTriangle, FiCheckCircle,
  FiChevronRight, FiX, FiEdit2,
} from 'react-icons/fi';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { useProactiveInsights } from '../../hooks/useProactiveInsights';
import { useContextualSuggestions } from '../../hooks/useContextualSuggestions';
import { auth } from '../../services/firebase';
import type { AgentResponse } from '../../services/aiAgentResponseTypes';
import { severityColor, severityBg } from '../../services/aiAgentResponseTypes';
import {
  canIAfford,
  detectAffordabilityQuestion,
} from '../../utils/affordabilityEngine';
import { calculateNetWorth } from '../../utils/calculations';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Module quick-action strip ────────────────────────────────────────────────

const MODULE_ACTIONS = [
  { emoji: '💳', label: 'Add Payment',    question: 'Add payment' },
  { emoji: '📈', label: 'Add Stock',      question: 'I bought stock' },
  { emoji: '🎯', label: 'Add Goal',       question: 'Create a savings goal' },
  { emoji: '🏦', label: 'Cash Flow',      question: 'Add expense' },
  { emoji: '🛡️', label: 'Insurance',      question: 'Add insurance policy' },
  { emoji: '💸', label: 'Add Liability',  question: 'Add a loan' },
  { emoji: '🤝', label: 'Lending',        question: 'I lent money to someone' },
  { emoji: '🔍', label: 'Net Worth',      question: 'What is my net worth?' },
] as const;

function QuickActions({ onSend, disabled }: { onSend: (q: string) => void; disabled: boolean }) {
  return (
    <div className='flex gap-1.5 overflow-x-auto pb-1 scrollbar-none'>
      {MODULE_ACTIONS.map(({ emoji, label, question }) => (
        <button
          key={label}
          onClick={() => onSend(question)}
          disabled={disabled}
          className='flex items-center gap-1.5 shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all disabled:opacity-40'
        >
          <span className='text-sm'>{emoji}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Structured response renderers ────────────────────────────────────────────

function StatGridCard({ resp }: { resp: Extract<AgentResponse, { kind: 'stat_grid' }> }) {
  return (
    <div className='rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60 overflow-hidden'>
      <div className='flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800'>
        {resp.emoji && <span className='text-base'>{resp.emoji}</span>}
        <span className='text-sm font-bold text-slate-900 dark:text-slate-100'>{resp.title}</span>
      </div>
      <div className='grid grid-cols-2 sm:grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800'>
        {resp.stats.map((s, i) => (
          <div key={i} className='bg-white dark:bg-slate-900/80 px-3 py-2.5'>
            <div className='text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1'>{s.label}</div>
            <div className={`text-sm font-bold font-mono ${s.severity ? severityColor(s.severity) : 'text-slate-900 dark:text-slate-100'}`}>{s.value}</div>
            {s.sub && <div className='text-[10px] text-slate-400 dark:text-slate-500 mt-0.5'>{s.sub}</div>}
          </div>
        ))}
      </div>
      {resp.alerts?.length ? (
        <div className='px-4 py-2 flex flex-col gap-1.5 border-t border-slate-100 dark:border-slate-800'>
          {resp.alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold border ${severityBg(a.severity)}`}>
              <span>{a.emoji}</span>
              <span className={severityColor(a.severity)}>{a.text}</span>
            </div>
          ))}
        </div>
      ) : null}
      {resp.footer && (
        <div className='px-4 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800'>{resp.footer}</div>
      )}
    </div>
  );
}

function TableCard({ resp }: { resp: Extract<AgentResponse, { kind: 'table' }> }) {
  return (
    <div className='rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60 overflow-hidden'>
      <div className='flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800'>
        {resp.emoji && <span className='text-base'>{resp.emoji}</span>}
        <span className='text-sm font-bold text-slate-900 dark:text-slate-100'>{resp.title}</span>
      </div>
      {resp.summary && (
        <div className='px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30'>
          {resp.summary}
        </div>
      )}
      <div className='overflow-x-auto'>
        <table className='w-full text-xs'>
          <thead>
            <tr className='bg-slate-50 dark:bg-slate-800/50'>
              {resp.headers.map((h, i) => (
                <th key={i} className='px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resp.rows.map((row, ri) => (
              <tr key={ri} className='border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors'>
                {row.cells.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-2 ${ci === 0 ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400 font-mono'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {resp.footer && (
        <div className='px-4 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800'>{resp.footer}</div>
      )}
    </div>
  );
}

function SingleCard({ resp }: { resp: Extract<AgentResponse, { kind: 'card' }> }) {
  const navigate = useNavigate();
  return (
    <div className='rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60 overflow-hidden'>
      <div className='flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800'>
        <div className='flex items-center gap-2'>
          {resp.emoji && <span className='text-base'>{resp.emoji}</span>}
          <span className='text-sm font-bold text-slate-900 dark:text-slate-100'>{resp.title}</span>
        </div>
        {resp.badge && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${resp.badgeSeverity ? `${severityColor(resp.badgeSeverity)} ${severityBg(resp.badgeSeverity)} border` : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            {resp.badge}
          </span>
        )}
      </div>
      <div className='divide-y divide-slate-100 dark:divide-slate-800'>
        {resp.stats.map((s, i) => (
          <div key={i} className='flex items-center justify-between px-4 py-2'>
            <span className='text-xs text-slate-500 dark:text-slate-400 font-medium'>{s.label}</span>
            <div className='text-right'>
              <span className={`text-xs font-bold font-mono ${s.severity ? severityColor(s.severity) : 'text-slate-900 dark:text-slate-100'}`}>{s.value}</span>
              {s.sub && <div className='text-[10px] text-slate-400 dark:text-slate-500'>{s.sub}</div>}
            </div>
          </div>
        ))}
      </div>
      <div className='flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800'>
        {resp.footer && <span className='text-[10px] text-slate-400 dark:text-slate-500'>{resp.footer}</span>}
        {resp.linkTo && (
          <button onClick={() => navigate(resp.linkTo!)} className='flex items-center gap-1 text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline ml-auto'>
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
    <div className='rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60 overflow-hidden'>
      <div className='flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800'>
        {resp.emoji && <span className='text-base'>{resp.emoji}</span>}
        <span className='text-sm font-bold text-slate-900 dark:text-slate-100'>{resp.title}</span>
      </div>
      {resp.summary && (
        <div className='px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30'>
          {resp.summary}
        </div>
      )}
      <div className='divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto'>
        {resp.items.map((item, i) => (
          <div
            key={i}
            className='flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer'
            onClick={() => item.linkTo && navigate(item.linkTo)}
            role={item.linkTo ? 'button' : undefined}
          >
            <div className='flex items-center gap-2.5 min-w-0'>
              {item.emoji && <span className='text-base shrink-0'>{item.emoji}</span>}
              <div className='min-w-0'>
                <div className='text-xs font-semibold text-slate-900 dark:text-slate-100 truncate'>{item.title}</div>
                {item.subtitle && <div className='text-[10px] text-slate-500 dark:text-slate-400 truncate'>{item.subtitle}</div>}
              </div>
            </div>
            <div className='shrink-0 text-right'>
              {item.value && (
                <div className={`text-xs font-bold font-mono ${item.severity ? severityColor(item.severity) : 'text-slate-900 dark:text-slate-100'}`}>{item.value}</div>
              )}
              {item.valueSub && <div className='text-[10px] text-slate-400 dark:text-slate-500'>{item.valueSub}</div>}
              {item.badge && (
                <span className='rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 text-[9px] font-bold'>{item.badge}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {resp.footer && (
        <div className='px-4 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800'>{resp.footer}</div>
      )}
    </div>
  );
}

function EmptyCard({ resp }: { resp: Extract<AgentResponse, { kind: 'empty' }> }) {
  return (
    <div className='rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/20 px-4 py-6 text-center'>
      {resp.emoji && <div className='text-2xl mb-2'>{resp.emoji}</div>}
      <p className='text-sm font-semibold text-slate-600 dark:text-slate-300'>{resp.message}</p>
      {resp.hint && <p className='text-xs text-slate-400 dark:text-slate-500 mt-1'>{resp.hint}</p>}
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
      <div className='rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/60 dark:bg-rose-900/10 overflow-hidden'>
        <div className='flex items-center gap-2 px-4 py-2.5 border-b border-rose-100 dark:border-rose-800/40 bg-rose-100/50 dark:bg-rose-900/20'>
          <FiAlertTriangle className='h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0' />
          <span className='text-sm font-bold text-rose-800 dark:text-rose-200'>Confirm Delete</span>
        </div>
        <div className='px-4 py-3'>
          <p className='text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1'>{resp.summary}</p>
          {resp.assumptions?.map((a, i) => (
            <p key={i} className='text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1.5'>
              <FiAlertTriangle className='h-3 w-3 shrink-0' /> {a}
            </p>
          ))}
          <p className='text-xs text-slate-500 dark:text-slate-400 mt-2'>
            This <strong className='text-rose-600 dark:text-rose-400'>permanently deletes</strong> this record and cannot be undone.
          </p>
        </div>
        <div className='flex gap-2 px-4 py-2.5 border-t border-rose-100 dark:border-rose-800/40'>
          <button
            onClick={() => onCancel?.()}
            className='flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors'
          >
            <FiX className='h-3.5 w-3.5' /> Cancel
          </button>
          <button
            onClick={() => onConfirm?.(resp.actionPayload)}
            className='flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white transition-colors shadow-sm'
          >
            <FiTrash2 className='h-3.5 w-3.5' /> Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='rounded-xl border border-violet-200/80 dark:border-violet-700/50 bg-violet-50/40 dark:bg-violet-900/10 overflow-hidden'>
      <div className='flex items-center gap-2 px-4 py-2.5 border-b border-violet-100 dark:border-violet-800/40'>
        <FiEdit2 className='h-3.5 w-3.5 text-violet-600 dark:text-violet-400' />
        <span className='text-sm font-bold text-slate-900 dark:text-slate-100'>{resp.title}</span>
      </div>
      <div className='px-4 py-3'>
        <p className='text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1'>{resp.summary}</p>
        {resp.assumptions && resp.assumptions.length > 0 && (
          <div className='mt-2 space-y-1'>
            {resp.assumptions.map((a, i) => (
              <p key={i} className='text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1'>
                <FiInfo className='h-3 w-3 shrink-0' /> {a}
              </p>
            ))}
          </div>
        )}
        <p className='text-xs text-slate-500 dark:text-slate-400 mt-2'>
          Review the details. Tap <strong>Confirm</strong> to save, or <strong>Cancel</strong>.
        </p>
      </div>
      <div className='flex gap-2 px-4 py-2.5 border-t border-violet-100 dark:border-violet-800/40'>
        <button
          onClick={() => onCancel?.()}
          className='flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors'
        >
          <FiX className='h-3.5 w-3.5' /> Cancel
        </button>
        <button
          onClick={() => onConfirm?.(resp.actionPayload)}
          className='flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-colors shadow-sm'
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
    <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-3 ${headerBg}`}>
        <span className='text-xl'>{result.verdictEmoji}</span>
        <span className={`text-sm font-bold ${textColor}`}>{result.verdictLabel}</span>
      </div>
      {/* Summary */}
      <div className='px-4 py-3 border-b border-slate-100 dark:border-slate-800'>
        <p className='text-sm text-slate-700 dark:text-slate-300'>{result.summary}</p>
      </div>
      {/* Impact table */}
      <div className='divide-y divide-slate-100 dark:divide-slate-800'>
        {result.details.map((d, i) => (
          <div key={i} className='flex items-start justify-between gap-3 px-4 py-2.5'>
            <span className='text-xs font-semibold text-slate-500 dark:text-slate-400 w-28 shrink-0'>{d.label}</span>
            <div className='flex items-center gap-2 text-xs font-mono'>
              <span className='text-slate-700 dark:text-slate-300'>{d.before}</span>
              <span className='text-slate-400'>→</span>
              <span className={impactColor[d.impact] ?? 'text-slate-700 dark:text-slate-300'}>{d.after}</span>
            </div>
            {d.note && (
              <span className={`text-[10px] text-right flex-1 ${impactColor[d.impact]}`}>{d.note}</span>
            )}
          </div>
        ))}
      </div>
      {/* Recommended budget */}
      {result.recommendedBudget && (
        <div className='px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800'>
          <p className='text-xs text-slate-600 dark:text-slate-400'>
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
    <div className='space-y-1.5 text-sm leading-relaxed'>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className='h-1' />;
        const h2 = line.match(/^##\s+(.+)$/);
        if (h2) return <h3 key={i} className='text-sm font-bold text-slate-900 dark:text-white pt-2'>{h2[1]}</h3>;
        const h3 = line.match(/^###\s+(.+)$/);
        if (h3) return <h4 key={i} className='text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 pt-1'>{h3[1]}</h4>;
        if (/^\|[-| ]+\|$/.test(line.trim())) return null;
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
          const cells = line.split('|').filter((c) => c.trim());
          return (
            <div key={i} className='flex gap-2 text-xs border-b border-slate-100 dark:border-slate-800 py-1'>
              {cells.map((cell, j) => (
                <span key={j} className={`flex-1 ${j === 0 ? 'text-slate-500 dark:text-slate-400' : 'font-semibold text-slate-900 dark:text-slate-100 text-right'}`}
                  dangerouslySetInnerHTML={{ __html: inlineFmt(cell.trim()) }} />
              ))}
            </div>
          );
        }
        if (line.match(/^[-*]\s+/)) {
          const content = line.replace(/^[-*]\s+/, '');
          return (
            <div key={i} className='flex gap-2 items-start'>
              <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400' />
              <span className='text-slate-700 dark:text-slate-300 text-[13px]' dangerouslySetInnerHTML={{ __html: inlineFmt(content) }} />
            </div>
          );
        }
        const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) return (
          <div key={i} className='flex gap-2 items-start'>
            <span className='shrink-0 text-[11px] font-bold text-violet-500 mt-0.5 min-w-[16px]'>{numMatch[1]}.</span>
            <span className='text-slate-700 dark:text-slate-300 text-[13px]' dangerouslySetInnerHTML={{ __html: inlineFmt(numMatch[2]) }} />
          </div>
        );
        return <p key={i} className='text-[13px] text-slate-700 dark:text-slate-300' dangerouslySetInnerHTML={{ __html: inlineFmt(line) }} />;
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
    <div className='flex items-center gap-1.5 px-4 py-3'>
      {[0, 0.18, 0.36].map((d, i) => (
        <div key={i} className='h-2 w-2 rounded-full bg-violet-400/70 dark:bg-violet-500/70'
          style={{ animation: `aiCoachBounce 1.1s ease-in-out ${d}s infinite` }} />
      ))}
      <style>{`@keyframes aiCoachBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}

// ─── Proactive insight banner ─────────────────────────────────────────────────

function InsightBanner({
  insight,
  onAsk,
}: {
  insight: import('../../hooks/useProactiveInsights').ProactiveInsight;
  onAsk: (q: string) => void;
}) {
  const navigate = useNavigate();
  const sevCls: Record<import('../../hooks/useProactiveInsights').InsightSeverity, string> = {
    danger:  'border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-900/10',
    warning: 'border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/10',
    good:    'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/10',
    info:    'border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-900/10',
  };
  const textCls: Record<import('../../hooks/useProactiveInsights').InsightSeverity, string> = {
    danger: 'text-rose-700 dark:text-rose-400', warning: 'text-amber-700 dark:text-amber-400',
    good: 'text-emerald-700 dark:text-emerald-400', info: 'text-blue-700 dark:text-blue-400',
  };
  return (
    <button
      onClick={() => onAsk(insight.question)}
      className={`w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${sevCls[insight.severity]}`}
    >
      <span className='text-base shrink-0 mt-0.5'>{insight.emoji}</span>
      <div className='min-w-0 flex-1'>
        <p className={`text-xs font-bold ${textCls[insight.severity]}`}>{insight.title}</p>
        <p className='text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate'>{insight.body}</p>
      </div>
      {insight.linkTo && (
        <FiChevronRight
          className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${textCls[insight.severity]}`}
          onClick={(e) => { e.stopPropagation(); navigate(insight.linkTo!); }}
        />
      )}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AIAgentPage() {
  const { ready } = usePortfolioStore();
  const proactiveInsights = useProactiveInsights();
  const suggestions       = useContextualSuggestions();

  const [messages,         setMessages]         = useState<Message[]>([]);
  const [input,            setInput]            = useState('');
  const [loading,          setLoading]          = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [convCtx,          setConvCtx]          = useState<ConversationContext>({});
  const [pendingActionId,  setPendingActionId]  = useState<string | null>(null);

  const inputRef  = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      // ── Can I afford? — intercept before routing ──────────────────────
      const affordAmount = detectAffordabilityQuestion(question);
      if (affordAmount !== null && affordAmount > 0) {
        const {
          investments, liabilities, cashflows, accounts,
          trackedPayments, goals, goalContributions, essentials,
        } = usePortfolioStore.getState();

        const { totalAssets, totalLiabilities } = calculateNetWorth(investments, liabilities);
        void totalAssets; void totalLiabilities;

        const totalCash        = accounts.reduce((a, ac) => a + (ac.balance ?? 0), 0);
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
      inputRef.current?.focus();
    }
  }, [loading, ready, convCtx, enrichQuestion, appendMessage, updateLastAssistant]);

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

  const userInitial = (
    auth.currentUser?.displayName?.[0] ?? auth.currentUser?.email?.[0] ?? 'U'
  ).toUpperCase();

  const isEmpty = messages.length === 0;

  const navigate = useNavigate();

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <SubscriptionGuard feature='ai_insights'>
      <div className='flex flex-col max-w-3xl mx-auto h-[calc(100dvh-140px)] md:h-[calc(100dvh-120px)] gap-2'>

        {/* ── Header ── */}
        <header className='flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent px-4 py-2.5 border border-violet-500/20 shadow-sm shrink-0'>
          <div className='flex items-center gap-3'>
            <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-500/30'>
              <FiCpu className='h-4 w-4' />
            </div>
            <div>
              <h1 className='text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5'>
                AI Coach <FiZap className='h-3 w-3 text-amber-400' />
              </h1>
              <p className='text-[10px] text-slate-500 dark:text-slate-400 leading-none'>
                Add · Update · Delete · Ask · Analyse
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2 shrink-0'>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setConvCtx({}); setPendingActionId(null); }}
                title='Clear conversation'
                className='flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors'
              >
                <FiTrash2 className='h-3 w-3' /> Clear
              </button>
            )}
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport || !ready}
              title='Generate full financial report'
              className='flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg shadow-teal-500/20 disabled:opacity-40 hover:-translate-y-0.5 transition-all'
            >
              {generatingReport ? <FiRefreshCw className='h-3 w-3 animate-spin' /> : <FiFileText className='h-3 w-3' />}
              Report
            </button>
          </div>
        </header>

        {/* ── Message thread ── */}
        <div className='flex-1 overflow-y-auto rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 px-3 py-3 space-y-4 min-h-0'>

          {/* ── Empty state ── */}
          {isEmpty && (
            <div className='flex flex-col gap-4 h-full'>
              {/* Proactive insights */}
              {proactiveInsights.length > 0 && (
                <div>
                  <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2'>
                    Needs attention
                  </p>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                    {proactiveInsights.map((insight) => (
                      <InsightBanner key={insight.id} insight={insight} onAsk={(q) => void sendMessage(q)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested questions */}
              <div>
                <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2'>
                  {proactiveInsights.length > 0 ? 'Or ask' : 'Suggested'}
                </p>
                <div className='flex flex-wrap gap-1.5'>
                  {suggestions.map(({ emoji, label, question }) => (
                    <button
                      key={label}
                      onClick={() => void sendMessage(question)}
                      disabled={loading}
                      className='flex items-center gap-1 rounded-full border border-violet-200/70 dark:border-violet-700/50 bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors disabled:opacity-50'
                    >
                      <span>{emoji}</span>{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Capability legend */}
              <div className='flex flex-wrap items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500 mt-auto pb-1'>
                <span className='flex items-center gap-1'><FiDatabase className='h-3 w-3 text-emerald-500' />Instant from your data</span>
                <span className='flex items-center gap-1'><FiCpu className='h-3 w-3 text-violet-500' />AI via Groq</span>
                <span className='flex items-center gap-1'><FiPlus className='h-3 w-3 text-orange-500' />CRUD actions</span>
                <span className='flex items-center gap-1'><FiInfo className='h-3 w-3 text-sky-500' />App guides</span>
              </div>
            </div>
          )}

          {/* ── Messages ── */}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

              {/* Assistant avatar */}
              {msg.role === 'assistant' && (
                <div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow mt-1'>
                  <FiCpu className='h-3 w-3' />
                </div>
              )}

              {/* Bubble */}
              <div className={`max-w-[88%] min-w-0 ${msg.role === 'user' ? '' : 'flex-1'}`}>
                {msg.loading ? (
                  <div className='bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl rounded-tl-sm'>
                    <ThinkingBubble />
                  </div>
                ) : msg.role === 'user' ? (
                  <div className='flex flex-col items-end gap-0.5'>
                    <div className='bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm font-medium'>
                      {msg.textContent}
                    </div>
                    <span className='text-[9px] text-slate-400 dark:text-slate-500 pr-1'>{fmtTime(msg.timestamp)}</span>
                  </div>
                ) : (
                  <div className='space-y-1.5'>
                    {/* Badge + time row */}
                    <div className='flex items-center gap-2'>
                      <SourceBadge source={msg.source} />
                      <span className='text-[9px] text-slate-400 dark:text-slate-500'>{fmtTime(msg.timestamp)}</span>
                    </div>

                    {/* Content */}
                    {msg.affordabilityResult
                      ? (
                        <AffordabilityCard result={msg.affordabilityResult} />
                      )
                      : msg.structuredContent
                      ? (
                        <StructuredRenderer
                          resp={msg.structuredContent}
                          onConfirm={handleConfirmAction}
                          onCancel={handleCancelAction}
                        />
                      )
                      : (
                        <div className='bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/50 rounded-xl rounded-tl-sm px-4 py-3'>
                          <MarkdownRenderer text={msg.textContent ?? ''} />
                        </div>
                      )
                    }

                    {/* Action success navigation button */}
                    {msg.actionLinkTo && msg.source === 'firebase' && (
                      <button
                        onClick={() => navigate(msg.actionLinkTo!)}
                        className='flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline mt-0.5'
                      >
                        <FiExternalLink className='h-3 w-3' /> View in app
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* User avatar */}
              {msg.role === 'user' && (
                <div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-700 text-white text-[10px] font-bold mt-1'>
                  {userInitial}
                </div>
              )}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* ── Quick actions ── */}
        <div className='shrink-0 px-0.5'>
          <QuickActions onSend={(q) => void sendMessage(q)} disabled={loading} />
        </div>

        {/* ── Input bar ── */}
        <div className='shrink-0'>
          <div className='flex gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-violet-500/30 transition-all'>
            {/* Search icon hint */}
            <div className='flex items-center pl-2 text-slate-400 dark:text-slate-500'>
              <FiSearch className='h-3.5 w-3.5' />
            </div>
            <input
              ref={inputRef}
              type='text'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Ask or say "Add ₹2500 electricity bill for Sep 15"…'
              disabled={loading}
              className='flex-1 bg-transparent px-2 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50'
            />
            <button
              onClick={() => void sendMessage(input)}
              disabled={loading || !input.trim()}
              aria-label='Send'
              className='flex items-center justify-center h-9 w-9 rounded-xl bg-violet-600 text-white disabled:opacity-40 hover:bg-violet-500 active:scale-95 transition-all'
            >
              {loading
                ? <FiRefreshCw className='h-4 w-4 animate-spin' />
                : <FiSend className='h-4 w-4' />
              }
            </button>
          </div>
          <p className='mt-1 text-center text-[9px] text-slate-400 dark:text-slate-500'>
            AI via Groq (direct) · Not investment advice ·{' '}
            <Link to='/settings' className='text-violet-500 hover:underline'>Settings</Link>
          </p>
        </div>

      </div>
    </SubscriptionGuard>
  );
}
