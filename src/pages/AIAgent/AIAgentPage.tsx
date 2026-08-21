/**
 * src/pages/AIAgent/AIAgentPage.tsx
 *
 * FinTrackly AI Agent — secure financial Q&A backed by the
 * `generateFinanceAI` Firebase Cloud Function.
 *
 * Architecture
 * ─────────────
 *  Question → Router
 *    OUT_OF_SCOPE    → static rejection message (no AI call)
 *    PERSONAL_DATA   → Firebase store → structured markdown (no AI call)
 *    FEATURE_GUIDE   → built-in FinTrackly how-to guide (no AI call)
 *    PERSONAL_EXPLAIN→ Firebase store + buildAgentContext() → Cloud Function
 *    GENERAL         → buildGeneralQuestionContext() → Cloud Function
 *
 * The Groq API key lives in Firebase Secret Manager and is NEVER sent to
 * or stored in the browser.
 */

import {
  FiCpu,
  FiRefreshCw,
  FiSend,
  FiZap,
  FiDatabase,
  FiBarChart2,
  FiFileText,
} from 'react-icons/fi';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { callGroqViaFunction } from '../../services/groqService';
import { buildAgentContext, buildGeneralQuestionContext } from '../../services/aiAgentContextBuilder';
import { routeQuestion } from '../../services/aiAgentRouter';
import { fetchPersonalData, generateFullReport } from '../../services/aiAgentDataFetcher';
import { matchFeatureGuide } from '../../services/aiAgentFeatureGuide';
import { SubscriptionGuard } from '../../components/subscription/SubscriptionGuard';
import { usePortfolioStore } from '../../store/portfolioStore';
import { auth } from '../../services/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant';
type MessageSource = 'groq' | 'firebase' | 'hybrid' | 'scope' | 'report' | 'guide';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  source?: MessageSource;
  timestamp: Date;
  loading?: boolean;
}

// ─── Suggested questions (8 rotating, one per feature group) ─────────────────

const SUGGESTED_QUESTIONS = [
  { label: '📈 Which investment is at the biggest loss?', q: 'Which of my investments is currently at the biggest loss?' },
  { label: '💰 How much did I save this month?',          q: 'How much money did I save this month?' },
  { label: '💳 Payments due in the next 7 days',          q: 'What payments are due in the next 7 days?' },
  { label: '🎯 Which goal is closest to completion?',     q: 'Which of my financial goals is closest to completion?' },
  { label: '💸 Which liability has the highest interest?',q: 'Which of my liabilities has the highest interest rate?' },
  { label: '🛡️ Which insurance policy renews next?',      q: 'Which of my insurance policies renews next?' },
  { label: '🌾 Which crop has the highest profit?',       q: 'Which of my crops is generating the highest profit?' },
  { label: '🤝 How much lending is outstanding?',         q: 'How much of my lending money is still outstanding?' },
];

// ─── Scope rejection message ──────────────────────────────────────────────────

const SCOPE_MESSAGE =
  "I'm FinTrackly's financial assistant. I can help with investments, " +
  'cash flow, transactions, assets, liabilities, payments, insurance, ' +
  'goals, agriculture, lending, and other financial topics supported by ' +
  'FinTrackly. Try asking something like:\n\n' +
  '- *What is unrealized P&L?*\n' +
  '- *Show me my portfolio performance*\n' +
  '- *How is savings rate calculated?*';

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  return (
    <div className='space-y-1.5 text-sm leading-relaxed'>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className='h-1' />;

        const h2 = line.match(/^##\s+(.+)$/);
        if (h2) return (
          <h3 key={i} className='text-sm font-bold text-slate-900 dark:text-white pt-2 first:pt-0'>
            {h2[1]}
          </h3>
        );

        const h3 = line.match(/^###\s+(.+)$/);
        if (h3) return (
          <h4 key={i} className='text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 pt-1'>
            {h3[1]}
          </h4>
        );

        // Table separator row — skip rendering
        if (/^\|[-| ]+\|$/.test(line.trim())) return null;

        // Table data row
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
          const cells = line.split('|').filter((c) => c.trim());
          return (
            <div key={i} className='flex gap-2 text-xs border-b border-slate-100 dark:border-slate-800 py-1'>
              {cells.map((cell, j) => (
                <span
                  key={j}
                  className={`flex-1 ${j === 0 ? 'text-slate-500 dark:text-slate-400' : 'font-semibold text-slate-900 dark:text-slate-100 text-right'}`}
                  dangerouslySetInnerHTML={{ __html: renderInline(cell.trim()) }}
                />
              ))}
            </div>
          );
        }

        if (line.match(/^[-*]\s+/)) {
          const content = line.replace(/^[-*]\s+/, '');
          return (
            <div key={i} className='flex gap-2 items-start'>
              <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400' />
              <span
                className='text-slate-700 dark:text-slate-300 text-[13px]'
                dangerouslySetInnerHTML={{ __html: renderInline(content) }}
              />
            </div>
          );
        }

        const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) return (
          <div key={i} className='flex gap-2 items-start'>
            <span className='shrink-0 text-[11px] font-bold text-violet-500 mt-0.5 min-w-[16px]'>{numMatch[1]}.</span>
            <span
              className='text-slate-700 dark:text-slate-300 text-[13px]'
              dangerouslySetInnerHTML={{ __html: renderInline(numMatch[2]) }}
            />
          </div>
        );

        if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
          return (
            <p key={i} className='text-[11px] text-slate-400 dark:text-slate-500 italic'>
              {line.slice(1, -1)}
            </p>
          );
        }

        return (
          <p
            key={i}
            className='text-[13px] text-slate-700 dark:text-slate-300'
            dangerouslySetInnerHTML={{ __html: renderInline(line) }}
          />
        );
      })}
    </div>
  );
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-900 dark:text-slate-100">$1</strong>')
    .replace(/\*([^*]+)\*/g,     '<em class="italic text-slate-500 dark:text-slate-400">$1</em>')
    .replace(/`([^`]+)`/g,       '<code class="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[11px]">$1</code>');
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: MessageSource }) {
  const cfg: Record<MessageSource, { label: string; color: string }> = {
    groq:     { label: 'AI Answer',    color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20' },
    firebase: { label: 'Your Data',    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
    hybrid:   { label: 'Data + AI',    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
    scope:    { label: 'Out of scope', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
    report:   { label: 'Report',       color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20' },
    guide:    { label: 'FinTrackly Guide', color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20' },
  };
  const { label, color } = cfg[source];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${color}`}>
      {source === 'groq' || source === 'hybrid'
        ? <FiCpu className='h-2.5 w-2.5' />
        : <FiDatabase className='h-2.5 w-2.5' />}
      {label}
    </span>
  );
}

// ─── Thinking animation ───────────────────────────────────────────────────────

function ThinkingBubble() {
  return (
    <div className='flex items-center gap-1.5 px-4 py-3'>
      {[0, 0.2, 0.4].map((d, i) => (
        <div
          key={i}
          className='h-2 w-2 rounded-full bg-violet-400'
          style={{ animation: `agentBounce 1.2s ease-in-out ${d}s infinite` }}
        />
      ))}
      <style>{`@keyframes agentBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AIAgentPage() {
  const { ready } = usePortfolioStore();

  const [messages,         setMessages]         = useState<Message[]>([]);
  const [input,            setInput]            = useState('');
  const [loading,          setLoading]          = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const inputRef  = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
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

  // ── Send a message ──────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading) return;

      setInput('');
      setLoading(true);

      appendMessage({ id: genId(), role: 'user', content: q, timestamp: new Date() });

      const loadingId = genId();
      appendMessage({ id: loadingId, role: 'assistant', content: '', timestamp: new Date(), loading: true });

      try {
        const route = routeQuestion(q);

        // ── Out of scope ────────────────────────────────────────────────────
        if (route.type === 'OUT_OF_SCOPE') {
          updateLastAssistant({ id: loadingId, content: SCOPE_MESSAGE, source: 'scope', loading: false });
          return;
        }

        // ── Personal data only — answer directly from store ─────────────────
        if (route.type === 'PERSONAL_DATA') {
          if (!ready) {
            updateLastAssistant({
              id: loadingId,
              content: '⏳ Your financial data is still loading. Please wait a moment and try again.',
              source: 'firebase',
              loading: false,
            });
            return;
          }
          const result = fetchPersonalData(route.intent, route.symbol, route.dateScope);
          updateLastAssistant({ id: loadingId, content: result.answer, source: 'firebase', loading: false });
          return;
        }

        // ── FinTrackly feature guide — instant how-to answer ─────────────────
        if (route.type === 'FEATURE_GUIDE') {
          const guide = matchFeatureGuide(q);
          const content = guide
            ? guide.answer
            : "I can help you navigate FinTrackly! Try asking:\n\n" +
              "- *How do I add a payment?*\n" +
              "- *How do I add an investment?*\n" +
              "- *How do I record income or expenses?*\n" +
              "- *How do I add a goal?*\n" +
              "- *What can FinTrackly do?*";
          updateLastAssistant({ id: loadingId, content, source: 'guide', loading: false });
          return;
        }

        // ── Personal + AI explanation — build full context ──────────────────
        if (route.type === 'PERSONAL_EXPLAIN') {
          if (!ready) {
            updateLastAssistant({
              id: loadingId,
              content: '⏳ Your financial data is still loading. Please wait a moment and try again.',
              source: 'firebase',
              loading: false,
            });
            return;
          }
          const context = buildAgentContext();
          const result  = await callGroqViaFunction({ type: 'question', question: q, context });
          updateLastAssistant({ id: loadingId, content: result.text, source: 'hybrid', loading: false });
          return;
        }

        // ── General / educational — minimal context, AI answers from knowledge
        const context = buildGeneralQuestionContext();
        const result  = await callGroqViaFunction({ type: 'question', question: q, context });
        updateLastAssistant({ id: loadingId, content: result.text, source: 'groq', loading: false });

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateLastAssistant({
          id: loadingId,
          content: `❌ ${msg.slice(0, 300)}`,
          source: 'scope',
          loading: false,
        });
        toast.error('AI request failed. Please try again.');
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [loading, ready, appendMessage, updateLastAssistant],
  );

  // ── Generate full data report (no AI) ──────────────────────────────────

  const handleGenerateReport = useCallback(async () => {
    if (generatingReport || !ready) return;
    setGeneratingReport(true);

    appendMessage({
      id: genId(), role: 'user',
      content: '📊 Generate my complete financial report',
      timestamp: new Date(),
    });

    const loadingId = genId();
    appendMessage({ id: loadingId, role: 'assistant', content: '', timestamp: new Date(), loading: true });

    try {
      const report = generateFullReport();
      updateLastAssistant({ id: loadingId, content: report, source: 'report', loading: false });
    } catch {
      updateLastAssistant({
        id: loadingId,
        content: '❌ Could not generate report. Please try again.',
        source: 'scope',
        loading: false,
      });
    } finally {
      setGeneratingReport(false);
    }
  }, [generatingReport, ready, appendMessage, updateLastAssistant]);

  // ── Enter key to submit ───────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SubscriptionGuard feature='ai_insights'>
      <div className='flex flex-col gap-0 max-w-3xl mx-auto h-[calc(100dvh-140px)] md:h-[calc(100dvh-120px)]'>

        {/* ── Header ── */}
        <header className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent p-4 sm:p-5 border border-violet-500/20 shadow-sm mb-4 shrink-0'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-500/30'>
              <FiCpu className='h-5 w-5' />
            </div>
            <div>
              <h1 className='text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2'>
                FinTrackly AI Agent
                <FiZap className='h-4 w-4 text-amber-400' />
              </h1>
              <p className='text-xs text-slate-500 dark:text-slate-400 mt-0.5'>
                Ask about your finances or general financial concepts
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={generatingReport || !ready}
            title='Generate complete financial report from your data'
            className='flex items-center gap-2 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-teal-500/20 disabled:opacity-40 hover:-translate-y-0.5 transition-all shrink-0'
          >
            {generatingReport
              ? <FiRefreshCw className='h-3.5 w-3.5 animate-spin' />
              : <FiFileText className='h-3.5 w-3.5' />}
            Generate Report
          </button>
        </header>

        {/* ── Message thread ── */}
        <div className='flex-1 overflow-y-auto rounded-2xl border border-slate-200/70 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/40 p-4 space-y-4 min-h-0'>

          {/* Empty state */}
          {messages.length === 0 && (
            <div className='flex flex-col items-center justify-center h-full gap-6 py-8'>
              <div className='text-center'>
                <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 mx-auto mb-4'>
                  <FiCpu className='h-8 w-8 text-violet-500' />
                </div>
                <h2 className='text-base font-bold text-slate-900 dark:text-slate-100'>
                  Ask FinTrackly AI
                </h2>
                <p className='text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm'>
                  Ask anything about your FinTrackly data or general financial concepts.
                </p>
              </div>

              <div className='w-full max-w-md'>
                <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 text-center'>
                  Suggested questions
                </p>
                <div className='flex flex-wrap gap-2 justify-center'>
                  {SUGGESTED_QUESTIONS.map(({ label, q }) => (
                    <button
                      key={label}
                      onClick={() => void sendMessage(q)}
                      disabled={loading}
                      className='rounded-full border border-violet-200/70 dark:border-violet-700/50 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors disabled:opacity-50'
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className='flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400 dark:text-slate-500'>
                <div className='flex items-center gap-1.5'>
                  <FiDatabase className='h-3 w-3 text-emerald-500' />
                  <span>Personal data from Firebase</span>
                </div>
                <div className='flex items-center gap-1.5'>
                  <FiCpu className='h-3 w-3 text-violet-500' />
                  <span>AI via secure Cloud Function</span>
                </div>
                <div className='flex items-center gap-1.5'>
                  <FiBarChart2 className='h-3 w-3 text-teal-500' />
                  <span>Reports from your data</span>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow mt-0.5'>
                  <FiCpu className='h-3.5 w-3.5' />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-tr-sm text-sm font-medium'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 rounded-tl-sm'
                }`}
              >
                {msg.loading ? (
                  <ThinkingBubble />
                ) : msg.role === 'user' ? (
                  <span>{msg.content}</span>
                ) : (
                  <div>
                    {msg.source && (
                      <div className='mb-2'>
                        <SourceBadge source={msg.source} />
                      </div>
                    )}
                    {renderMarkdown(msg.content)}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-700 text-white text-xs font-bold mt-0.5'>
                  {(auth.currentUser?.displayName?.[0] ?? auth.currentUser?.email?.[0] ?? 'U').toUpperCase()}
                </div>
              )}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div className='mt-3 shrink-0'>
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
              aria-label='Send message'
              className='flex items-center justify-center h-9 w-9 rounded-xl bg-violet-600 text-white disabled:opacity-40 hover:bg-violet-500 transition-colors'
            >
              {loading
                ? <FiRefreshCw className='h-4 w-4 animate-spin' />
                : <FiSend className='h-4 w-4' />}
            </button>
          </div>
          <p className='mt-1.5 text-center text-[10px] text-slate-400 dark:text-slate-500'>
            AI answers are for education only — not personalized investment advice.
            Powered by Groq via a secure server-side API call.
          </p>
        </div>

      </div>
    </SubscriptionGuard>
  );
}
