/**
 * src/services/aiAgentRouter.ts
 *
 * Routes every user question to the correct data source.
 *
 * PERSONAL_DATA    → Zustand store only (instant, no AI)
 * PERSONAL_EXPLAIN → Store data + Groq explains it
 * GENERAL          → Groq answers from financial knowledge
 * OUT_OF_SCOPE     → Static rejection message
 *
 * Intent strings map 1-to-1 with fetchPersonalData() cases in
 * aiAgentDataFetcher.ts — keep them in sync.
 */

import { matchFeatureGuide, isFeatureGuideQuestion } from './aiAgentFeatureGuide';

export type QuestionType =
  | 'GENERAL'
  | 'PERSONAL_DATA'
  | 'PERSONAL_EXPLAIN'
  | 'FEATURE_GUIDE'
  | 'OUT_OF_SCOPE';

export interface RouteResult {
  type: QuestionType;
  /** Intent key — maps to a fetcher in aiAgentDataFetcher.ts */
  intent: string;
  /** Specific stock / fund ticker extracted from the question */
  symbol?: string;
  /** Date scope when the question mentions today / this week / this month */
  dateScope?: 'today' | 'this_week' | 'this_month';
}

// ─── Hard out-of-scope patterns ───────────────────────────────────────────────
const OUT_OF_SCOPE_PATTERNS = [
  /\b(write|create|generate|make)\s+(a\s+)?(program|code|script|app|game|website|function)/i,
  /\b(python|javascript|java|c\+\+|golang|rust|kotlin|swift)\b/i,
  /\b(recipe|cook|ingredient|restaurant)\b/i,
  /\b(movie|film|actor|actress|celebrity|song|music|lyrics)\b/i,
  /\b(sport|cricket|football|soccer|tennis|ipl|nfl)\b/i,
  /\b(weather|temperature|forecast)\b/i,
  /\b(news|politics|election|government|parliament)\b/i,
  /\b(medical|doctor|diagnosis|symptom|medicine|hospital)\b/i,
  /\b(relationship|love|dating|marriage|divorce)\b/i,
];

// ─── FinTrackly topic allow-list ──────────────────────────────────────────────
const FINTRACKLY_TOPICS = [
  'invest', 'portfolio', 'stock', 'share', 'mutual fund', 'equity',
  'bond', 'fixed deposit', 'fd', 'nav', 'sip', 'dividend', 'return',
  'profit', 'loss', 'p&l', 'pnl', 'unrealised', 'unrealized',
  'capital gain', 'market cap', 'sector', 'diversif', 'rebalanc',
  'benchmark', 'alpha', 'nifty', 'sensex',
  'cash flow', 'cashflow', 'income', 'expense', 'surplus',
  'savings rate', 'saving rate', 'budget', 'spend', 'earning',
  'net worth', 'asset', 'wealth', 'liabilit', 'debt', 'loan',
  'emi', 'interest rate',
  'payment', 'due date', 'recurring', 'chit fund', 'reminder',
  'insur', 'coverage', 'premium', 'policy', 'nominee', 'renewal',
  'goal', 'target amount', 'financial goal', 'retirement', 'fire',
  'agricultur', 'farm', 'crop', 'harvest', 'field', 'livestock',
  'milk', 'produce', 'fertilizer', 'cultivation',
  'labour', 'labor', 'attendance', 'employee', 'salary', 'wage',
  'lending', 'lend', 'borrow', 'borrower', 'outstanding',
  'financial', 'finance', 'money', 'rupee', 'inr', 'tax',
  'inflation', 'compounding', 'emergency fund', 'fintrackly',
  'overview', 'situation', 'health', 'risk', 'focus', 'owe',
  'account', 'balance', 'bank',
];

// ─── Personal-data signals ────────────────────────────────────────────────────
const PERSONAL_SIGNALS = [
  // possessive / first-person
  'my ', 'mine', "i've", 'i have', 'i own', 'i invested', 'i spent',
  'i earned', 'i owe', 'i lent', 'i lend',
  // question starters about personal data
  'what is my', 'what are my', 'what\'s my',
  'how much do i', 'how much did i', 'how much have i', 'how much am i',
  'which of my', 'show me my', 'give me my', 'list my', 'tell me my',
  'do i have', 'am i ',
  // portfolio-specific
  'my portfolio', 'my investment', 'my stock', 'my fund', 'my holding',
  'my mutual', 'my sip',
  // cashflow
  'my cashflow', 'my income', 'my expense', 'my spending', 'my savings',
  'my surplus', 'my saving rate', 'my savings rate',
  // financial position
  'my net worth', 'my asset', 'my account', 'my balance', 'my wealth',
  // liabilities
  'my liabilit', 'my loan', 'my debt', 'my emi',
  // payments
  'my payment', 'due this', 'due next', 'upcoming payment',
  'overdue payment', 'paid this',
  // insurance
  'my insur', 'my policy', 'my policies', 'my coverage', 'my premium',
  // goals
  'my goal', 'my target', 'my financial goal',
  // agriculture
  'my agriculture', 'my farm', 'my crop', 'my field', 'my harvest',
  'my livestock', 'my produce',
  // lending
  'my lending', 'my borrower', 'money i lent', 'money i have lent',
  // dashboard / overview
  'my financial', 'my current', 'my overall', 'my situation',
  'my health', 'my risk', 'my focus',
  // common short-hands
  'best performing', 'worst performing', 'top stock', 'biggest loss',
  'highest return', 'lowest return', 'most profitable', 'in loss',
  'in profit', 'profitable invest', 'priorit',
];

// ─── Explain signals (hybrid — fetch data then ask Groq to explain) ───────────
const EXPLAIN_SIGNALS = [
  'why is my', 'why are my',
  'explain my', 'analyse my', 'analyze my',
  'what does my', 'what is causing',
  'reason for my', 'how is my',
  'what should i focus', 'what are my biggest',
  'am i on track', 'should i prioritiz',
  'what are the most important',
];

// ─── Main router ──────────────────────────────────────────────────────────────
export function routeQuestion(question: string): RouteResult {
  const q = question.trim().toLowerCase();

  // 1. Hard out-of-scope
  const isHardOutOfScope = OUT_OF_SCOPE_PATTERNS.some((rx) => rx.test(q));
  const isTopicInScope   = FINTRACKLY_TOPICS.some((t) => q.includes(t));
  const hasPersonal      = hasPersonalSignal(q);

  if (isHardOutOfScope || (!isTopicInScope && !hasPersonal)) {
    return { type: 'OUT_OF_SCOPE', intent: 'out_of_scope' };
  }

  // 2. Explain / analyse → hybrid
  if (EXPLAIN_SIGNALS.some((s) => q.includes(s))) {
    return { type: 'PERSONAL_EXPLAIN', intent: detectPersonalIntent(q) };
  }

  // 3. Personal data → store only
  if (hasPersonal) {
    const symbol    = extractSymbol(q);
    const dateScope = detectDateScope(q);
    const intent    = symbol ? 'stock_lookup' : detectPersonalIntent(q);
    return {
      type: 'PERSONAL_DATA',
      intent,
      ...(symbol    ? { symbol }    : {}),
      ...(dateScope ? { dateScope } : {}),
    };
  }

  // 4. FinTrackly feature guide ("how do I add payment", "where do I find goals")
  if (isFeatureGuideQuestion(q) || matchFeatureGuide(q)) {
    return { type: 'FEATURE_GUIDE', intent: 'feature_guide' };
  }

  // 5. General financial education → Groq
  return { type: 'GENERAL', intent: 'general_finance' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasPersonalSignal(q: string): boolean {
  return PERSONAL_SIGNALS.some((s) => q.includes(s));
}

function detectDateScope(q: string): 'today' | 'this_week' | 'this_month' | undefined {
  if (/\btoday\b|today'?s\b|this\s+day\b/.test(q))                      return 'today';
  if (/\bthis\s+week\b|past\s+7\s+days\b|last\s+7\s+days\b/.test(q))   return 'this_week';
  if (/\bthis\s+month\b|current\s+month\b/.test(q))                      return 'this_month';
  return undefined;
}

function extractSymbol(qLower: string): string | undefined {
  const STOPWORDS = new Set([
    'in','on','at','by','my','me','the','a','an','is','it','of','to',
    'for','and','or','how','what','when','where','stock','fund','share',
    'investment','page','check','have','invested','invest','i','did',
    'do','does','about','with','from','much','many','this','that',
    'which','who','whose','am','are','was','were','be','been',
  ]);

  // "in <TICKER> stock/fund/share"
  const inStockMatch = qLower.match(
    /\bin\s+([a-z0-9]{2,10})\s+(?:stock|share|fund|mf|etf|equity|scrip)/,
  );
  if (inStockMatch && !STOPWORDS.has(inStockMatch[1]))
    return inStockMatch[1].toUpperCase();

  // "<TICKER> stock/share/fund"
  const beforeStockMatch = qLower.match(
    /\b([a-z]{2,8})\s+(?:stock|share|fund|scrip|equity)\b/,
  );
  if (beforeStockMatch && !STOPWORDS.has(beforeStockMatch[1]))
    return beforeStockMatch[1].toUpperCase();

  // word after "in/about/for/of/on" that looks like a ticker
  const words = qLower.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const prev  = words[i - 1].replace(/[^a-z]/g, '');
    const clean = words[i].replace(/[^a-z0-9]/g, '');
    if (['in','about','for','of','on'].includes(prev)
      && clean.length >= 2 && clean.length <= 7
      && !STOPWORDS.has(clean)
      && /^[a-z]{2,7}$/.test(clean)) {
      return clean.toUpperCase();
    }
  }

  return undefined;
}

/**
 * Maps the lowercased question to a specific intent string.
 * Every returned string must have a matching case in fetchPersonalData().
 */
function detectPersonalIntent(q: string): string {

  // ── Dashboard / overview ─────────────────────────────────────────────────
  if (/overview|overall.*financial|financial.*situation|financial.*health|net\s*worth|total.*asset|total.*own|currently\s+owe|total.*liabil|biggest.*risk|focus.*right\s+now|most\s+important/i.test(q) &&
      !/cashflow|cash\s+flow|income|expense|invest|stock|payment|insur|goal|liabilit|account|lend|agri|farm/i.test(q)) {
    return 'dashboard';
  }

  // ── Investment / portfolio sub-intents ───────────────────────────────────
  if (/best.*perform|highest.*return|top.*perform|most.*profit/i.test(q))
    return 'portfolio_best';

  if (/biggest.*loss|worst.*perform|lowest.*return|most.*loss|at.*loss/i.test(q))
    return 'portfolio_worst';

  if (/how many.*profit|count.*profit|number.*profit|profitable/i.test(q))
    return 'portfolio_profitable_count';

  if (/how many.*loss|count.*loss|number.*loss|in\s+loss/i.test(q))
    return 'portfolio_loss_count';

  if (/highest.*percent|best.*percent|highest.*pct|best.*pct/i.test(q) &&
      /return|gain|profit/i.test(q))
    return 'portfolio_best_pct';

  if (/sector|allocation.*sector|sector.*allocation/i.test(q))
    return 'portfolio_sectors';

  if (/unrealiz|unrealis|p&l|pnl|overall.*p|total.*p&l/i.test(q) &&
      /invest|portfolio|stock|fund/i.test(q))
    return 'portfolio_pnl';

  if (/total.*invest|how much.*invest|invest.*amount/i.test(q))
    return 'portfolio_invested';

  if (/current.*value|portfolio.*value|current.*portfolio/i.test(q))
    return 'portfolio_value';

  if (/invest|stock|portfolio|mutual|fund|holding|p&l|pnl|return|profit|loss/i.test(q))
    return 'portfolio';

  // ── Cash flow sub-intents ────────────────────────────────────────────────
  if (/earn.*month|income.*month|month.*income|how much.*earn/i.test(q))
    return 'cashflow';

  if (/spend.*month|expense.*month|month.*expense|how much.*spend/i.test(q))
    return 'cashflow';

  if (/save.*month|saving.*month|month.*saving|how much.*save/i.test(q))
    return 'cashflow';

  if (/saving.*rate|savings.*rate|rate.*saving/i.test(q))
    return 'cashflow';

  if (/biggest.*spend|top.*spend|top.*expense|biggest.*expense|spending.*categor|expense.*categor/i.test(q))
    return 'cashflow_categories';

  if (/highest.*expense|most.*expensive|month.*highest.*expense/i.test(q))
    return 'cashflow_peak_expense_month';

  if (/highest.*income|most.*income|month.*highest.*income/i.test(q))
    return 'cashflow_peak_income_month';

  if (/cash.?flow.*change|change.*cash.?flow|over.*month|trend/i.test(q) &&
      /income|expense|cashflow/i.test(q))
    return 'cashflow_trend';

  if (/spend.*more.*earn|earn.*less.*spend|more.*spend|overspend/i.test(q))
    return 'cashflow_overspend';

  if (/cashflow|cash\s+flow|income|expense|spend|surplus|earn|saving/i.test(q))
    return 'cashflow';

  // ── Payments sub-intents ─────────────────────────────────────────────────
  if (/due.*7\s*day|next\s*7\s*day|this\s*week.*payment|payment.*this\s*week/i.test(q))
    return 'payments_week';

  if (/due.*month|this\s*month.*payment|payment.*this\s*month/i.test(q))
    return 'payments_month';

  if (/overdue|missed.*payment|past.*due/i.test(q))
    return 'payments_overdue';

  if (/recurring.*payment|repeat.*payment|subscription/i.test(q))
    return 'payments_recurring';

  if (/largest.*payment|biggest.*payment|highest.*payment|most.*payment/i.test(q))
    return 'payments_largest';

  if (/next.*payment|which.*pay.*next|pay.*next/i.test(q))
    return 'payments_next';

  if (/how much.*paid|already.*paid|paid.*month|paid.*this/i.test(q))
    return 'payments_paid';

  if (/how much.*pay.*week|pay.*this\s*week|need.*pay.*week/i.test(q))
    return 'payments_week';

  if (/how much.*pay.*month|need.*pay.*month/i.test(q))
    return 'payments_month';

  if (/payment|due|pay|bill/i.test(q))
    return 'payments';

  // ── Insurance sub-intents ────────────────────────────────────────────────
  if (/how many.*polic|count.*polic|number.*polic/i.test(q))
    return 'insurance_count';

  if (/total.*coverage|coverage.*total|how much.*coverage|sum.*insured/i.test(q))
    return 'insurance_coverage';

  if (/annual.*premium|total.*premium|how much.*premium|premium.*pay/i.test(q))
    return 'insurance_premium';

  if (/renew.*next|next.*renew|which.*renew/i.test(q))
    return 'insurance_next_renewal';

  if (/renew.*30\s*day|30\s*day.*renew|expir.*soon|soon.*expir|coming.*renew/i.test(q))
    return 'insurance_expiring_soon';

  if (/highest.*coverage|most.*coverage|best.*coverage/i.test(q))
    return 'insurance_highest_coverage';

  if (/highest.*premium|most.*premium|expensive.*policy/i.test(q))
    return 'insurance_highest_premium';

  if (/insur|policy|policies|coverage|premium|renewal/i.test(q))
    return 'insurance';

  // ── Liabilities sub-intents ──────────────────────────────────────────────
  if (/how many.*liabilit|count.*liabilit|number.*liabilit/i.test(q))
    return 'liabilities_count';

  if (/highest.*interest|most.*interest|highest.*rate.*debt|debt.*highest.*rate/i.test(q))
    return 'liabilities_highest_interest';

  if (/highest.*outstanding|biggest.*debt|most.*owed|highest.*balance.*loan/i.test(q))
    return 'liabilities_highest_balance';

  if (/priorit.*debt|which.*pay.*first|pay.*first.*debt/i.test(q))
    return 'liabilities_priority';

  if (/percent.*asset|asset.*percent|debt.*asset.*ratio|liabilit.*asset/i.test(q))
    return 'liabilities_debt_ratio';

  if (/liabilit|loan|debt|emi|owe|borrow/i.test(q))
    return 'liabilities';

  // ── Goals sub-intents ────────────────────────────────────────────────────
  if (/closest.*complet|near.*complet|almost.*done|near.*achiev/i.test(q))
    return 'goals_closest';

  if (/lowest.*progress|least.*progress|furthest.*goal|far.*goal/i.test(q))
    return 'goals_lowest_progress';

  if (/how much.*still.*need|remaining.*goal|need.*each.*goal/i.test(q))
    return 'goals_remaining';

  if (/percent.*complet|how many.*complet|complet.*goal/i.test(q))
    return 'goals_completion_rate';

  if (/nearest.*deadline|soonest.*deadline|earliest.*deadline|next.*goal.*due/i.test(q))
    return 'goals_nearest_deadline';

  if (/on track|track.*goal|reach.*goal/i.test(q))
    return 'goals_on_track';

  if (/how much.*save.*goal|how much.*reach/i.test(q))
    return 'goals_savings_needed';

  if (/focus.*next|next.*goal|which.*goal.*next/i.test(q))
    return 'goals_next_focus';

  if (/goal|target|financial.*goal/i.test(q))
    return 'goals';

  // ── Accounts / assets sub-intents ───────────────────────────────────────
  if (/how many.*account|count.*account|number.*account/i.test(q))
    return 'accounts_count';

  if (/highest.*balance|most.*balance|largest.*account/i.test(q))
    return 'accounts_highest';

  if (/distribut.*account|wealth.*distribut|breakdown.*account/i.test(q))
    return 'accounts_distribution';

  if (/how much.*cash|total.*cash|liquid.*cash/i.test(q))
    return 'accounts_cash';

  if (/percent.*account|account.*percent|share.*account/i.test(q))
    return 'accounts_distribution';

  if (/account|balance|bank/i.test(q))
    return 'accounts';

  // ── Agriculture sub-intents ──────────────────────────────────────────────
  if (/highest.*profit.*crop|best.*crop|most.*profit.*crop/i.test(q))
    return 'agriculture_best_crop';

  if (/highest.*expense.*crop|most.*expensive.*crop|highest.*cost.*crop/i.test(q))
    return 'agriculture_highest_expense_crop';

  if (/active.*crop|current.*crop|ongoing.*crop/i.test(q))
    return 'agriculture_active_crops';

  if (/closest.*harvest|near.*harvest|soonest.*harvest/i.test(q))
    return 'agriculture_next_harvest';

  if (/fertiliz|pesticide|farm.*expense|agri.*expense/i.test(q))
    return 'agriculture_expenses';

  if (/agri|farm|crop|harvest|field|livestock|milk|produce|cultivat/i.test(q))
    return 'agriculture';

  // ── Lending sub-intents ──────────────────────────────────────────────────
  if (/how much.*lent|total.*lent|amount.*lent|total.*lend/i.test(q))
    return 'lending_total';

  if (/outstanding.*lend|lend.*outstanding|still.*owe.*me|how much.*out/i.test(q))
    return 'lending_outstanding';

  if (/how many.*borrower|count.*borrower|number.*borrower/i.test(q))
    return 'lending_borrower_count';

  if (/most.*owe|owes.*most|highest.*borrow|which.*borrow/i.test(q))
    return 'lending_top_borrower';

  if (/interest.*receiv|interest.*collect|how much.*interest.*lend/i.test(q))
    return 'lending_interest_collected';

  if (/highest.*interest.*lend|highest.*rate.*lend/i.test(q))
    return 'lending_highest_rate';

  if (/overdue.*lend|lend.*overdue|late.*repay/i.test(q))
    return 'lending_overdue';

  if (/recover|how much.*recover|recoup/i.test(q))
    return 'lending_recovered';

  if (/lend|borrow|borrower|outstanding/i.test(q))
    return 'lending';

  // ── Net worth / assets fallback ──────────────────────────────────────────
  if (/net\s*worth|total.*asset|total.*own|wealth/i.test(q))
    return 'net_worth';

  return 'dashboard';
}
