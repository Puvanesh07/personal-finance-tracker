/**
 * src/pages/AIAgent/AIAgentPage.tsx
 *
 * FinTrackly AI Agent — single intelligent chat interface.
 *
 * Five answer paths (from router):
 *   OUT_OF_SCOPE    → static scope message
 *   FEATURE_GUIDE   → built-in how-to answer (aiAgentFeatureGuide)
 *   PERSONAL_DATA   → structured AgentResponse from aiAgentTools (no AI)
 *   PERSONAL_EXPLAIN→ store data → Cloud Function → Groq explanation
 *   GENERAL         → Cloud Function → Groq educational answer
 *
 * Features:
 *   • Structured card / table / stat-grid renderers (no raw markdown for data)
 *   • Proactive insight banners (computed from store, not Groq)
 *   • Contextual suggested questions (personalised from user data)
 *   • Conversation memory (last intent + entity for follow-up questions)
 *   • Clear chat button
 *   • Source label on every message
 */

import {
  FiCpu, FiRefreshCw, FiSend, FiZap, FiDatabase,
  FiFileText, FiTrash2, FiExternalLink, FiInfo,
} from 'react-icons/fi';
import { useCallback, useEffect, useRef, useState } from 'react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant';
type MessageSource = 'groq' | 'firebase' | 'hybrid' | 'scope' | 'report' | 'guide' | 'action';

interface Message {
  id: string;
  role: MessageRole;
  /** For Groq/guide/scope answers — raw text / markdown */
  textContent?: string;
  /** For store-based answers — structured typed response */
  structuredContent?: AgentResponse;
  source: MessageSource;
  timestamp: Date;
  loading?: boolean;
}

/** Lightweight conversation memory — last identified intent + entity */
interface ConversationContext {
  lastIntent?: string;
  lastEntity?: string;  // stock symbol, borrower name, etc.
  lastModule?: string;  // 'investments' | 'payments' | etc.
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const SCOPE_MESSAGE =
  "I'm FinTrackly's AI assistant. I can help with:\n\n" +
   '- **Your data** — portfolio, cashflow, payments, goals, liabilities, insurance, accounts, lending\n' +
  '- **App help** — how to add/edit/delete anything in FinTrackly\n' +
  '- **Financial education** — concepts, ratios, strategies (via AI)\n\n' +
  'Try: *"What is my net worth?"* or *"How do I add a payment?"*';

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_CFG: Record<MessageSource, { label: string; cls: string }> = {
  groq:     { label: 'AI Answer',        cls: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20' },
  firebase: { label: 'Your Data',        cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
  hybrid:   { label: 'Data + AI',        cls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
  scope:    { label: 'Out of scope',     cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
  report:   { label: 'Report',           cls: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20' },
  guide:    { label: 'FinTrackly Guide', cls: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20' },
  action:   { label: 'Action',           cls: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' },
};

function SourceBadge({ source }: { source: MessageSource }) {
  const { label, cls } = SOURCE_CFG[source];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {source === 'groq' || source === 'hybrid' ? <FiCpu className='h-2.5 w-2.5' /> : <FiDatabase className='h-2.5 w-2.5' />}
      {label}
    </span>
  );
}

// ─── Structured response renderers ────────────────────────────────────────────

function StatGridCard({ resp }: { resp: Extract<AgentResponse, { kind: 'stat_grid' }> }) {
  return (
    <div className='rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 overflow-hidden'>
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
        <div className='px-4 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800'>
          {resp.footer}
        </div>
      )}
    </div>
  );
}

function TableCard({ resp }: { resp: Extract<AgentResponse, { kind: 'table' }> }) {
  return (
    <div className='rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 overflow-hidden'>
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
                <th key={i} className='px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
                  {h}
                </th>
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
        <div className='px-4 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800'>
          {resp.footer}
        </div>
      )}
    </div>
  );
}

function SingleCard({ resp }: { resp: Extract<AgentResponse, { kind: 'card' }> }) {
  const navigate = useNavigate();
  return (
    <div className='rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 overflow-hidden'>
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
          <button
            onClick={() => navigate(resp.linkTo!)}
            className='flex items-center gap-1 text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline ml-auto'
          >
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
    <div className='rounded-xl border border-slate-200/80 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 overflow-hidden'>
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
                <div className={`text-xs font-bold font-mono ${item.severity ? severityColor(item.severity) : 'text-slate-900 dark:text-slate-100'}`}>
                  {item.value}
                </div>
              )}
              {item.valueSub && <div className='text-[10px] text-slate-400 dark:text-slate-500'>{item.valueSub}</div>}
              {item.badge && (
                <span className='rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 text-[9px] font-bold'>
                  {item.badge}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {resp.footer && (
        <div className='px-4 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800'>
          {resp.footer}
        </div>
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

/** Route an AgentResponse to the correct renderer */
function StructuredRenderer({ resp, onConfirm, onCancel }: {
  resp: AgentResponse;
  onConfirm?: (actionPayload: string) => void;
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

function ActionConfirmCard({
  resp,
  onConfirm,
  onCancel,
}: {
  resp: import('../../services/aiAgentResponseTypes').ActionConfirmResponse;
  onConfirm?: (actionPayload: string) => void;
  onCancel?: () => void;
}) {
  return (
    <div className='rounded-xl border border-orange-200/80 dark:border-orange-700/50 bg-orange-50/60 dark:bg-orange-900/10 overflow-hidden'>
      <div className='flex items-center gap-2 px-4 py-2.5 border-b border-orange-100 dark:border-orange-800/50'>
        <span className='text-base'>{resp.emoji}</span>
        <span className='text-sm font-bold text-slate-900 dark:text-slate-100'>{resp.title}</span>
      </div>
      <div className='px-4 py-3'>
        <p className='text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1'>{resp.summary}</p>
        {resp.assumptions && resp.assumptions.length > 0 && (
          <div className='mt-2 space-y-1'>
            {resp.assumptions.map((a, i) => (
              <p key={i} className='text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1'>
                <span>ℹ️</span> {a}
              </p>
            ))}
          </div>
        )}
        <p className='text-xs text-slate-500 dark:text-slate-400 mt-2'>
          Review the details above. Tap <strong>Confirm</strong> to save, or <strong>Cancel</strong>.
        </p>
      </div>
      <div className='flex gap-2 px-4 py-2.5 border-t border-orange-100 dark:border-orange-800/50 bg-orange-50/40 dark:bg-orange-900/5'>
        <button
          onClick={() => onCancel?.()}
          className='flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors'
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm?.(resp.actionPayload)}
          className='flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-colors shadow-sm'
        >
          ✅ Confirm
        </button>
      </div>
    </div>
  );
}

// ─── Plain text / Groq markdown renderer ──────────────────────────────────────

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
                  dangerouslySetInnerHTML={{ __html: inlineFormat(cell.trim()) }} />
              ))}
            </div>
          );
        }

        if (line.match(/^[-*]\s+/)) {
          const content = line.replace(/^[-*]\s+/, '');
          return (
            <div key={i} className='flex gap-2 items-start'>
              <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400' />
              <span className='text-slate-700 dark:text-slate-300 text-[13px]' dangerouslySetInnerHTML={{ __html: inlineFormat(content) }} />
            </div>
          );
        }

        const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) return (
          <div key={i} className='flex gap-2 items-start'>
            <span className='shrink-0 text-[11px] font-bold text-violet-500 mt-0.5 min-w-[16px]'>{numMatch[1]}.</span>
            <span className='text-slate-700 dark:text-slate-300 text-[13px]' dangerouslySetInnerHTML={{ __html: inlineFormat(numMatch[2]) }} />
          </div>
        );

        if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
          return <p key={i} className='text-[11px] text-slate-400 dark:text-slate-500 italic'>{line.slice(1, -1)}</p>;
        }

        return <p key={i} className='text-[13px] text-slate-700 dark:text-slate-300' dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />;
      })}
    </div>
  );
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-900 dark:text-slate-100">$1</strong>')
    .replace(/\*([^*]+)\*/g,     '<em class="italic text-slate-500 dark:text-slate-400">$1</em>')
    .replace(/`([^`]+)`/g,       '<code class="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[11px]">$1</code>');
}

// ─── Thinking dots ────────────────────────────────────────────────────────────

function ThinkingBubble() {
  return (
    <div className='flex items-center gap-1.5 px-4 py-3'>
      {[0, 0.2, 0.4].map((d, i) => (
        <div key={i} className='h-2 w-2 rounded-full bg-violet-400'
          style={{ animation: `agentBounce 1.2s ease-in-out ${d}s infinite` }} />
      ))}
      <style>{`@keyframes agentBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
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
        <FiExternalLink
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
  /** messageId of the pending action confirm card, if any */
  const [pendingActionId,  setPendingActionId]  = useState<string | null>(null);

  const inputRef  = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Enrich question with conversation context for follow-ups
  const enrichQuestion = useCallback((q: string, ctx: ConversationContext): string => {
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

    appendMessage({ id: genId(), role: 'user', textContent: rawQuestion.trim(), source: 'firebase', timestamp: new Date() });

    const loadingId = genId();
    appendMessage({ id: loadingId, role: 'assistant', source: 'firebase', timestamp: new Date(), loading: true });

    try {
      const route = routeQuestion(question);

      // ── Out of scope ────────────────────────────────────────────────────
      if (route.type === 'OUT_OF_SCOPE') {
        updateLastAssistant({ id: loadingId, textContent: SCOPE_MESSAGE, source: 'scope', loading: false });
        return;
      }

      // ── Feature guide — instant how-to ──────────────────────────────────
      if (route.type === 'FEATURE_GUIDE') {
        const guide = matchFeatureGuide(question);
        updateLastAssistant({
          id: loadingId,
          textContent: guide?.answer ?? "Try: *How do I add a payment?* or *What can FinTrackly do?*",
          source: 'guide',
          loading: false,
        });
        setConvCtx({ lastModule: 'guide' });
        return;
      }

      // ── ACTION — parse, show confirmation card ──────────────────────────
      if (route.type === 'ACTION') {
        const parsed = parseAction(question);

        if (parsed.incomplete) {
          updateLastAssistant({
            id: loadingId,
            textContent: parsed.missingPrompt ?? 'Please provide more details.',
            source: 'action',
            loading: false,
          });
          return;
        }

        if (!parsed.action) {
          updateLastAssistant({
            id: loadingId,
            textContent: "I understood you want to add something, but couldn't parse the details. Try: *\"Add ₹500 food expense\"* or *\"Add ₹5000 rent payment for September 1\"*",
            source: 'action',
            loading: false,
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
          id: loadingId,
          structuredContent: confirmCard,
          source: 'action',
          loading: false,
        });
        return;
      }

      // ── Personal data — structured store answer ─────────────────────────
      if (route.type === 'PERSONAL_DATA') {
        if (!ready) {
          updateLastAssistant({
            id: loadingId,
            textContent: '⏳ Your data is still loading. Please try again in a moment.',
            source: 'firebase',
            loading: false,
          });
          return;
        }
        const structured = fetchAgentResponse(route.intent, route.symbol, route.dateScope);
        updateLastAssistant({ id: loadingId, structuredContent: structured, source: 'firebase', loading: false });
        setConvCtx({ lastIntent: route.intent, lastEntity: route.symbol, lastModule: route.intent.split('_')[0] });
        return;
      }

      // ── Personal + AI explanation ───────────────────────────────────────
      if (route.type === 'PERSONAL_EXPLAIN') {
        if (!ready) {
          updateLastAssistant({
            id: loadingId,
            textContent: '⏳ Your data is still loading. Please try again in a moment.',
            source: 'firebase',
            loading: false,
          });
          return;
        }
        const context = buildAgentContext();
        const result  = await generateFinancialAI({ type: 'question', question, context });
        updateLastAssistant({ id: loadingId, textContent: result.text, source: 'hybrid', loading: false });
        setConvCtx({ lastIntent: route.intent, lastModule: route.intent.split('_')[0] });
        return;
      }

      // ── General financial education ─────────────────────────────────────
      const context = buildGeneralQuestionContext();
      const result  = await generateFinancialAI({ type: 'question', question, context });
      updateLastAssistant({ id: loadingId, textContent: result.text, source: 'groq', loading: false });
      setConvCtx({ lastModule: 'general' });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateLastAssistant({
        id: loadingId,
        textContent: `❌ ${msg.slice(0, 300)}`,
        source: 'scope',
        loading: false,
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

    // Replace the confirm card with a loading state
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
      });
    } catch {
      updateLastAssistant({
        id: execId,
        textContent: '❌ Action failed. Please try again.',
        source: 'scope',
        loading: false,
      });
    }
  }, [appendMessage, updateLastAssistant]);

  const handleCancelAction = useCallback(() => {
    if (!pendingActionId) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === pendingActionId
          ? { ...m, textContent: '❌ Action cancelled.', structuredContent: undefined, source: 'scope' as const }
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

  // Memoised empty-state check
  const isEmpty = messages.length === 0;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SubscriptionGuard feature='ai_insights'>
      <div className='flex flex-col max-w-3xl mx-auto h-[calc(100dvh-140px)] md:h-[calc(100dvh-120px)] gap-3'>

        {/* ── Header ── */}
        <header className='flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent px-4 py-3 border border-violet-500/20 shadow-sm shrink-0'>
          <div className='flex items-center gap-3'>
            <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-500/30'>
              <FiCpu className='h-4 w-4' />
            </div>
            <div>
              <h1 className='text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5'>
                FinTrackly AI Agent <FiZap className='h-3.5 w-3.5 text-amber-400' />
              </h1>
              <p className='text-[10px] text-slate-500 dark:text-slate-400'>
                Ask about your finances, app features, or financial concepts
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2 shrink-0'>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setConvCtx({}); }}
                title='Clear conversation'
                className='flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors'
              >
                <FiTrash2 className='h-3 w-3' /> Clear
              </button>
            )}
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport || !ready}
              title='Generate complete financial report'
              className='flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg shadow-teal-500/20 disabled:opacity-40 hover:-translate-y-0.5 transition-all'
            >
              {generatingReport ? <FiRefreshCw className='h-3 w-3 animate-spin' /> : <FiFileText className='h-3 w-3' />}
              Report
            </button>
          </div>
        </header>

        {/* ── Message thread ── */}
        <div className='flex-1 overflow-y-auto rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-4 space-y-4 min-h-0'>

          {/* ── Empty state ── */}
          {isEmpty && (
            <div className='flex flex-col gap-5 h-full'>
              {/* Proactive insights */}
              {proactiveInsights.length > 0 && (
                <div>
                  <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2'>
                    Needs your attention
                  </p>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                    {proactiveInsights.map((insight) => (
                      <InsightBanner
                        key={insight.id}
                        insight={insight}
                        onAsk={(q) => void sendMessage(q)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Contextual suggestions */}
              <div>
                <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2'>
                  {proactiveInsights.length > 0 ? 'Or ask' : 'Suggested questions'}
                </p>
                <div className='flex flex-wrap gap-2'>
                  {suggestions.map(({ emoji, label, question }) => (
                    <button
                      key={label}
                      onClick={() => void sendMessage(question)}
                      disabled={loading}
                      className='flex items-center gap-1.5 rounded-full border border-violet-200/70 dark:border-violet-700/50 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors disabled:opacity-50'
                    >
                      <span>{emoji}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className='flex flex-wrap items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 mt-auto pb-2'>
                <span className='flex items-center gap-1'><FiDatabase className='h-3 w-3 text-emerald-500' />Your data (instant)</span>
                <span className='flex items-center gap-1'><FiCpu className='h-3 w-3 text-violet-500' />AI via direct Groq</span>
                <span className='flex items-center gap-1'><FiInfo className='h-3 w-3 text-sky-500' />App how-to guides</span>
              </div>
            </div>
          )}

          {/* ── Messages ── */}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

              {/* Assistant avatar */}
              {msg.role === 'assistant' && (
                <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow mt-0.5'>
                  <FiCpu className='h-3.5 w-3.5' />
                </div>
              )}

              {/* Bubble */}
              <div className={`max-w-[88%] ${msg.role === 'user'
                ? 'bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm font-medium'
                : 'min-w-[200px] rounded-2xl rounded-tl-sm'}`}
              >
                {msg.loading ? (
                  <div className='bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-2xl rounded-tl-sm'>
                    <ThinkingBubble />
                  </div>
                ) : msg.role === 'user' ? (
                  <span>{msg.textContent}</span>
                ) : (
                  <div className='space-y-2'>
                    <div><SourceBadge source={msg.source} /></div>
                    {msg.structuredContent
                      ? <StructuredRenderer resp={msg.structuredContent} onConfirm={handleConfirmAction} onCancel={handleCancelAction} />
                      : <div className='bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-xl px-4 py-3'>
                          <MarkdownRenderer text={msg.textContent ?? ''} />
                        </div>
                    }
                  </div>
                )}
              </div>

              {/* User avatar */}
              {msg.role === 'user' && (
                <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-700 text-white text-xs font-bold mt-0.5'>
                  {userInitial}
                </div>
              )}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div className='shrink-0'>
          <div className='flex gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-violet-500/20 transition-all'>
            <input
              ref={inputRef}
              type='text'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Ask FinTrackly AI…'
              disabled={loading}
              className='flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50'
            />
            <button
              onClick={() => void sendMessage(input)}
              disabled={loading || !input.trim()}
              aria-label='Send'
              className='flex items-center justify-center h-9 w-9 rounded-xl bg-violet-600 text-white disabled:opacity-40 hover:bg-violet-500 transition-colors'
            >
              {loading ? <FiRefreshCw className='h-4 w-4 animate-spin' /> : <FiSend className='h-4 w-4' />}
            </button>
          </div>
          <p className='mt-1 text-center text-[10px] text-slate-400 dark:text-slate-500'>
            Data answers from Firebase · AI via Groq · Not personalized investment advice ·{' '}
            <Link to='/settings' className='text-violet-500 hover:underline'>Settings</Link>
          </p>
        </div>

      </div>
    </SubscriptionGuard>
  );
}
