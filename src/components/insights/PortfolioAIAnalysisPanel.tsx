import { FiCpu, FiRefreshCw, FiZap } from 'react-icons/fi';
import { useCallback, useState } from 'react';

import { Link } from 'react-router-dom';
import type { PortfolioAIContext } from '../../utils/portfolioAIContext';
import { requestPortfolioAIAnalysis } from '../../services/portfolioAnalysisAI';
import toast from 'react-hot-toast';

function renderAnalysisText(text: string) {
  const lines = text.split('\n');
  return (
    <div className='space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200'>
      {lines.map((line, i) => {
        const h2 = line.match(/^##\s+(.+)$/);
        if (h2) {
          return (
            <h3
              key={i}
              className='text-base font-bold text-slate-900 dark:text-white pt-2 first:pt-0'
            >
              {h2[1]}
            </h3>
          );
        }
        const h3 = line.match(/^###\s+(.+)$/);
        if (h3) {
          return (
            <h4
              key={i}
              className='text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 pt-2'
            >
              {h3[1]}
            </h4>
          );
        }
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className='text-[13px] text-slate-600 dark:text-slate-300'>
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**') ? (
                <strong
                  key={j}
                  className='font-semibold text-slate-900 dark:text-slate-100'
                >
                  {p.slice(2, -2)}
                </strong>
              ) : (
                <span key={j}>{p}</span>
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}

export function PortfolioAIAnalysisPanel({
  context,
  compact = false,
}: {
  context: PortfolioAIContext;
  compact?: boolean;
}) {
  const [question, setQuestion] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [source, setSource] = useState<'openai' | 'local' | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const q = compact ? undefined : question.trim() || undefined;
      const res = await requestPortfolioAIAnalysis(context, q);
      setText(
        compact && res.text.length > 520
          ? `${res.text.slice(0, 520).trim()}…`
          : res.text,
      );
      setSource(res.source);
      if (res.source === 'local') {
        toast.success(
          'Using on-device analysis (add OpenAI key on Netlify for AI).',
          {
            duration: 4500,
          },
        );
      }
    } catch {
      toast.error('Could not generate analysis.');
    } finally {
      setLoading(false);
    }
  }, [context, compact, question]);

  return (
    <div
      className={`rounded-2xl border border-violet-200/70 dark:border-violet-800/50 bg-gradient-to-br from-violet-500/[0.06] to-slate-100/80 dark:from-violet-500/10 dark:to-slate-900/50 shadow-sm ${compact ? 'p-4 md:p-5' : 'p-5 md:p-6'}`}
    >
      <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4'>
        <div className='flex items-start gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400'>
            <FiCpu className='h-5 w-5' />
          </div>
          <div>
            <h2 className='text-base font-bold text-slate-900 dark:text-white flex items-center gap-2'>
              AI portfolio analysis
              <FiZap className='h-4 w-4 text-amber-500' />
            </h2>
            <p className='text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl'>
              {compact
                ? 'Summarizes your aggregated stats. Deploy with OPENAI_API_KEY on Netlify for GPT-powered text; otherwise a smart local briefing runs in your browser.'
                : 'Ask anything about your numbers below. Without a server API key, you still get a detailed rule-based briefing from the same snapshot.'}
            </p>
          </div>
        </div>
        <button
          type='button'
          onClick={() => void run()}
          disabled={loading}
          className='inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500 disabled:opacity-50 transition-colors shrink-0'
        >
          {loading ? (
            <FiRefreshCw className='h-4 w-4 animate-spin' />
          ) : (
            <FiZap className='h-4 w-4' />
          )}
          {text ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {!compact && (
        <div className='mb-4 space-y-2'>
          <div className='flex flex-wrap gap-2'>
            {[
              'What are my top 3 financial risks right now?',
              'Give me a 90-day action plan.',
              'Is my allocation too aggressive?',
            ].map((preset) => (
              <button
                key={preset}
                type='button'
                onClick={() => setQuestion(preset)}
                className='rounded-full border border-violet-200 dark:border-violet-700/60 bg-violet-50 dark:bg-violet-900/20 px-3 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors'
              >
                {preset}
              </button>
            ))}
          </div>
          <label className='block'>
            <span className='text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'>
              Optional focus (sent to AI when configured)
            </span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              placeholder='e.g. Should I reduce equity given my emergency runway?'
              className='mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-violet-500/30 resize-y min-h-[72px]'
            />
          </label>
        </div>
      )}

      {source && (
        <p className='text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3'>
          Source:{' '}
          <span
            className={
              source === 'openai'
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-slate-600 dark:text-slate-300'
            }
          >
            {source === 'openai' ? 'OpenAI (server)' : 'On-device briefing'}
          </span>
        </p>
      )}

      {text ? (
        <div className='rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/40 p-4 max-h-[min(70vh,520px)] overflow-y-auto'>
          {renderAnalysisText(text)}
          {compact && text.endsWith('…') && (
            <p className='mt-4 text-xs font-semibold'>
              <Link
                to='/insights'
                className='text-violet-600 dark:text-violet-400 hover:underline'
              >
                Open Insights for the full briefing &amp; custom questions →
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className='rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400'>
          Tap{' '}
          <strong className='text-slate-700 dark:text-slate-200'>
            Generate
          </strong>{' '}
          to build your briefing from current portfolio data.
        </div>
      )}
    </div>
  );
}
