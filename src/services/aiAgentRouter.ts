/**
 * src/services/aiAgentRouter.ts
 *
 * Scored intent matching — replaces the fragile first-match-wins waterfall.
 *
 * How it works
 * ─────────────
 * Every intent has a list of { pattern, weight } scoring rules.
 * Each rule adds its weight when the pattern matches the question.
 * The intent with the highest total score wins.
 * Ties are broken by the order of INTENT_SCORES (more specific first).
 *
 * Fixed bugs:
 *   • "how much interest am I paying on my liabilities" → liabilities, not portfolio
 *   • "outstanding lending" → lending, not liabilities
 *   • "income and expense" → cashflow summary, not income-only
 *   • "next goal deadline" → goals, not payments_next
 *   • "how much did I save" → cashflow savings, not savings rate
 *   • Date scopes (today/this week) correctly applied to cashflow AND payments
 *   • "what did I invest in VEDL stock" → stock_lookup (symbol extractor runs first)
 *   • All CRUD actions (add/update/delete + new modules) route to ACTION correctly
 *   • "search" / "find" intent added
 */

import { matchFeatureGuide, isFeatureGuideQuestion } from './aiAgentFeatureGuide';
import { detectActionType } from './aiAgentActionParser';

export type QuestionType =
  | 'GENERAL'
  | 'PERSONAL_DATA'
  | 'PERSONAL_EXPLAIN'
  | 'FEATURE_GUIDE'
  | 'ACTION'
  | 'OUT_OF_SCOPE';

export interface RouteResult {
  type: QuestionType;
  intent: string;
  symbol?: string;
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
  'lending', 'lend', 'borrow', 'borrower',
  'financial', 'finance', 'money', 'rupee', 'inr', 'tax',
  'inflation', 'compounding', 'emergency fund', 'fintrackly',
  'overview', 'situation', 'health', 'risk', 'focus', 'owe',
  'account', 'balance', 'bank',
  // CRUD verbs — ensure "add X", "delete X", "update X" are always in-scope
  'add ', 'buy ', 'bought', 'record ', 'delete ', 'remove ', 'update ',
  'change ', 'edit ', 'mark ', 'paid', 'lent ', 'lend ', 'gave ',
  'create ', 'search ', 'find ',
];

// ─── Personal-data signals ────────────────────────────────────────────────────

const PERSONAL_SIGNALS = [
  'my ', 'mine', "i've", 'i have', 'i own', 'i invested', 'i spent',
  'i earned', 'i owe', 'i lent', 'i lend',
  'what is my', 'what are my', "what's my",
  'how much do i', 'how much did i', 'how much have i', 'how much am i',
  'which of my', 'show me my', 'give me my', 'list my', 'tell me my',
  'do i have', 'am i ',
  'my portfolio', 'my investment', 'my stock', 'my fund', 'my holding',
  'my mutual', 'my sip',
  'my cashflow', 'my income', 'my expense', 'my spending', 'my savings',
  'my surplus', 'my saving rate', 'my savings rate',
  'my net worth', 'my asset', 'my account', 'my balance', 'my wealth',
  'my liabilit', 'my loan', 'my debt', 'my emi',
  'my payment', 'due this', 'due next', 'upcoming payment',
  'overdue payment', 'paid this',
  'my insur', 'my policy', 'my policies', 'my coverage', 'my premium',
  'my goal', 'my target', 'my financial goal',
  'my lending', 'my borrower', 'money i lent', 'money i have lent',
  'my financial', 'my current', 'my overall', 'my situation',
  'my health', 'my risk', 'my focus',
  'best performing', 'worst performing', 'top stock', 'biggest loss',
  'highest return', 'lowest return', 'most profitable', 'in loss',
  'in profit', 'profitable invest', 'priorit',
];

const EXPLAIN_SIGNALS = [
  'why is my', 'why are my',
  'explain my', 'analyse my', 'analyze my',
  'what does my', 'what is causing',
  'reason for my', 'how is my',
  'what should i focus', 'what are my biggest',
  'am i on track', 'should i prioritiz',
  'what are the most important',
];

// ─── Scored intent definitions ────────────────────────────────────────────────
//
// Each rule: { re, w }
//   re — regex tested against the lowercased question
//   w  — weight added to this intent's score when the regex matches
//        positive: evidence FOR this intent
//        negative: evidence AGAINST this intent (another module's keyword appearing)
//
// Design principles:
//   • Module-specific terms get high weight (10–20)
//   • Generic terms that could belong to multiple modules get low weight (2–5)
//   • A rival module's strong keyword gets a negative weight (-8 to -15)
//   • Sub-intent specifics (e.g. "biggest loss", "overdue") get a bonus (+10)

type Rule = { re: RegExp; w: number };

interface IntentDef {
  id: string;
  rules: Rule[];
}

function r(pattern: string, flags = 'i'): RegExp {
  return new RegExp(pattern, flags);
}

// Helper: quick positive + negative rule pairs
function pos(pattern: string, weight: number): Rule { return { re: r(pattern), w: weight }; }
function neg(pattern: string, weight: number): Rule { return { re: r(pattern), w: -weight }; }

const INTENT_DEFS: IntentDef[] = [

  // ── DASHBOARD / OVERVIEW ────────────────────────────────────────────────────
  {
    id: 'dashboard',
    rules: [
      pos('overview|financial\\s+situation|financial\\s+health|financial\\s+position', 12),
      pos('give me (a |an )?overview|complete (overview|picture|summary)', 10),
      pos('overall.*financ|financ.*overall', 8),
      pos('everything|all modules|all my finances|full picture', 8),
      neg('invest|stock|portfolio|fund', 6),
      neg('payment|due|bill', 6),
      neg('cashflow|cash flow|income|expense', 6),
      neg('goal|insurance|liabilit|account', 4),
    ],
  },

  // ── NET WORTH ───────────────────────────────────────────────────────────────
  {
    id: 'net_worth',
    rules: [
      pos('net worth', 20),
      pos('total assets.*minus|assets minus liabilit', 15),
      pos('how much (am i|are you) worth', 12),
      pos('total asset', 8),
      pos('total wealth|overall wealth', 8),
      neg('invest|stock|portfolio|fund', 4),
    ],
  },

  // ── PORTFOLIO (general summary) ─────────────────────────────────────────────
  {
    id: 'portfolio',
    rules: [
      pos('portfolio', 12),
      pos('all (my )?investments|my investments', 10),
      pos('total invest|invested amount|how much (have i |did i )?invest', 8),
      pos('portfolio (performance|summary|overview|value|return)', 10),
      pos('current (portfolio|holding|investment) value', 8),
      pos('unrealiz|unrealis|p&l|pnl', 6),
      pos('invest|holding', 4),
      neg('which.*(stock|fund|invest).*loss|losing|at a loss|in loss', 5),
      neg('which.*(stock|fund|invest).*best|best perform|top perform|highest return', 5),
      neg('sector|allocation', 4),
    ],
  },

  // ── PORTFOLIO WORST / LOSS ───────────────────────────────────────────────────
  {
    id: 'portfolio_worst',
    rules: [
      pos('biggest.*loss|largest.*loss', 20),
      pos('worst.*perform|most.*loss|performing.*worst', 18),
      pos('at (a )?loss|in (a )?loss|currently.*loss|down (the )?most', 15),
      pos('lowest.*return|negative.*return|most.*negative', 14),
      pos('losing (money|the most|most)|which.*(stock|fund|invest).*down', 12),
      pos('shares?.*negative|stocks?.*negative', 12),
      pos('which.*invest.*losing|losing.*invest', 10),
      pos('loss', 4),
      pos('invest|stock|portfolio|fund|holding', 3),
      neg('best|top|profit|gain|positive|highest return', 8),
    ],
  },

  // ── PORTFOLIO BEST / TOP ─────────────────────────────────────────────────────
  {
    id: 'portfolio_best',
    rules: [
      pos('best.*perform|top.*perform|highest.*return', 18),
      pos('most.*profit|top.*gain|best.*stock|best.*invest', 15),
      pos('performing (the )?best|highest (gain|profit|return)', 14),
      pos('which.*(stock|fund|invest).*(best|top|profit|positive)', 12),
      pos('profit|gain|positive.*return', 4),
      pos('invest|stock|portfolio|fund|holding', 3),
      neg('loss|down|negative|worst|worst.*perform', 8),
    ],
  },

  // ── PORTFOLIO PROFIT/LOSS COUNT ─────────────────────────────────────────────
  {
    id: 'portfolio_profitable_count',
    rules: [
      pos('how many.*invest.*(profit|gain|positive)', 20),
      pos('count.*profit|number.*profit|profitable.*invest', 18),
      pos('how many.*profit', 15),
      pos('how many.*invest', 8),
      pos('invest|portfolio', 3),
    ],
  },
  {
    id: 'portfolio_loss_count',
    rules: [
      pos('how many.*invest.*(loss|losing|negative)', 20),
      pos('count.*loss|number.*loss|how many.*loss', 18),
      pos('investments.*in loss|in loss.*invest', 15),
    ],
  },

  // ── PORTFOLIO SECTOR ────────────────────────────────────────────────────────
  {
    id: 'portfolio_sectors',
    rules: [
      pos('sector.*portfolio|portfolio.*sector', 20),
      pos('by sector|sector.*allocation|allocation.*sector', 18),
      pos('sector.*breakdown|sector.*composition', 16),
      pos('sector', 10),
      pos('invest|portfolio', 3),
    ],
  },

  // ── CASHFLOW SUMMARY ────────────────────────────────────────────────────────
  {
    id: 'cashflow',
    rules: [
      pos('cashflow|cash flow|cash-flow', 15),
      pos('income.*expense|expense.*income', 12),
      pos('how much (did i |do i |have i )?(earn|spend|save)', 10),
      pos('monthly (income|expense|spending|saving)', 10),
      pos('this month.*(income|earn|spend|expense)', 10),
      pos('income this month|earned this month', 10),
      pos('spent this month|expenses? this month', 10),
      pos('saved this month|saving this month', 10),
      pos('surplus|saving rate|savings rate', 8),
      pos('income|expense|spend|earn', 4),
      neg('payment|due|bill|emi|loan', 5),
      neg('invest|stock|portfolio', 4),
      neg('lending|lend|borrow', 8),
      neg('insurance|insur', 4),
      neg('liabilit|debt', 4),
    ],
  },

  // ── CASHFLOW CATEGORIES ─────────────────────────────────────────────────────
  {
    id: 'cashflow_categories',
    rules: [
      pos('spending.*categor|categor.*spending|expense.*categor', 20),
      pos('biggest.*spend|top.*spend|top.*expense|biggest.*expense', 18),
      pos('breakdown.*expense|expense.*breakdown', 16),
      pos('what.*i.*spend.*on|what.*did.*i.*spend.*on', 14),
      pos('where.*money.*go|where.*spend', 12),
      pos('spending pattern|expense pattern', 12),
    ],
  },

  // ── CASHFLOW PEAK MONTHS ────────────────────────────────────────────────────
  {
    id: 'cashflow_peak_expense_month',
    rules: [
      pos('month.*(highest|most).*expense|highest.*expense.*month', 20),
      pos('when.*spend.*most|most.*expensive.*month', 18),
      pos('peak.*expense|expense.*peak', 14),
    ],
  },
  {
    id: 'cashflow_peak_income_month',
    rules: [
      pos('month.*(highest|most).*income|highest.*income.*month', 20),
      pos('when.*earn.*most|most.*income.*month', 18),
      pos('peak.*income|income.*peak', 14),
    ],
  },

  // ── CASHFLOW TREND ──────────────────────────────────────────────────────────
  {
    id: 'cashflow_trend',
    rules: [
      pos('cashflow.*change|change.*cashflow|cash flow.*trend', 20),
      pos('income.*expense.*trend|trend.*income|trend.*expense', 16),
      pos('over (the )?(last|past) (few |several )?months?', 12),
      pos('month.*month|monthly.*trend', 10),
    ],
  },

  // ── CASHFLOW OVERSPEND ──────────────────────────────────────────────────────
  {
    id: 'cashflow_overspend',
    rules: [
      pos('spend.*more.*earn|earn.*less.*spend', 20),
      pos('overspend|spending more than', 18),
      pos('am i spending more|spending more than (i |my )?(earn|make)', 16),
    ],
  },

  // ── SAVINGS RATE ────────────────────────────────────────────────────────────
  {
    id: 'cashflow',   // savings rate maps to general cashflow tool
    rules: [
      pos('saving rate|savings rate|rate of saving', 20),
      pos('what percent.*save|percentage.*save|save.*percent', 15),
      pos('how much.*saving.*monthly|monthly.*saving.*rate', 12),
    ],
  },

  // ── PAYMENTS ────────────────────────────────────────────────────────────────
  {
    id: 'payments',
    rules: [
      pos('payment|upcoming payment|all.*payment', 12),
      pos('what (do i |am i )?owe|what.*i.*pay', 8),
      pos('due (this|next|the)', 10),
      pos('bill|emi.*due', 8),
      neg('interest.*liabilit|liabilit.*interest', 6),
      neg('lending|borrow|loan.*interest', 6),
      neg('insurance.*premium', 4),
    ],
  },
  {
    id: 'payments_week',
    rules: [
      pos('due.*(this|next)\\s*week|this\\s*week.*due|this\\s*week.*payment', 20),
      pos('payment.*(this|next)\\s*week|next 7 days?|within 7 days?', 18),
      pos('7 days?.*due|due.*7 days?', 16),
    ],
  },
  {
    id: 'payments_month',
    rules: [
      pos('due.*this\\s*month|this\\s*month.*payment|payment.*this\\s*month', 20),
      pos('monthly.*payment|payments? this month', 18),
      pos('how much.*pay.*month|need.*pay.*month', 14),
    ],
  },
  {
    id: 'payments_overdue',
    rules: [
      pos('overdue.*payment|payment.*overdue|missed.*payment', 22),
      pos('past.*due.*payment|already.*due', 18),
      pos('overdue', 14),
    ],
  },
  {
    id: 'payments_next',
    rules: [
      pos('next.*payment.*due|which.*payment.*next|payment.*due.*next', 20),
      pos('next.*due.*payment|due.*next', 14),
      pos('which.*pay.*first|upcoming.*next', 12),
      neg('goal|lending', 6),
    ],
  },
  {
    id: 'payments_recurring',
    rules: [
      pos('recurring.*payment|repeat.*payment|subscription', 22),
      pos('monthly.*recurring|auto.*debit', 16),
    ],
  },
  {
    id: 'payments_largest',
    rules: [
      pos('largest.*payment|biggest.*payment|highest.*payment', 20),
      pos('most.*expensive.*payment|max.*payment', 16),
    ],
  },

  // ── INSURANCE ───────────────────────────────────────────────────────────────
  {
    id: 'insurance',
    rules: [
      pos('insurance|insur', 15),
      pos('my polic(y|ies)|policy|policies', 10),
      pos('coverage|sum insured', 8),
      pos('premium.*insurance|insurance.*premium', 10),
      neg('payment.*due|emi', 4),
    ],
  },
  {
    id: 'insurance_next_renewal',
    rules: [
      pos('renew.*next|next.*renew|which.*renew', 20),
      pos('insurance.*expir|policy.*expir', 16),
      pos('coming up.*renew|renew.*soon', 14),
      pos('insurance|insur|policy', 5),
    ],
  },
  {
    id: 'insurance_expiring_soon',
    rules: [
      pos('expir.*soon|soon.*expir|renew.*30 days?|30 days?.*renew', 22),
      pos('coming.*renewal|upcoming.*renewal', 16),
      pos('insurance|insur|policy', 5),
    ],
  },
  {
    id: 'insurance_coverage',
    rules: [
      pos('total.*coverage|coverage.*total|how much.*coverage', 20),
      pos('sum insured|insured.*amount', 18),
      pos('insurance|insur', 5),
      neg('premium', 4),
    ],
  },
  {
    id: 'insurance_premium',
    rules: [
      pos('total.*premium|how much.*premium|annual.*premium', 20),
      pos('premium.*insurance|insurance.*premium|how much.*pay.*insurance', 16),
      pos('insurance|insur', 5),
      neg('coverage|sum insured', 4),
    ],
  },
  {
    id: 'insurance_highest_coverage',
    rules: [
      pos('highest.*coverage|most.*coverage|best.*coverage|maximum.*coverage', 22),
      pos('which.*policy.*highest.*coverage|most covered', 18),
      pos('insurance|insur', 5),
    ],
  },
  {
    id: 'insurance_highest_premium',
    rules: [
      pos('highest.*premium|most.*premium|expensive.*policy|most.*expensive.*insur', 22),
      pos('which.*policy.*highest.*premium', 18),
      pos('insurance|insur', 5),
    ],
  },

  // ── LIABILITIES ─────────────────────────────────────────────────────────────
  {
    id: 'liabilities',
    rules: [
      pos('liabilit', 15),
      pos('my (loan|debt|emi|borrow)', 12),
      pos('how much (do i |am i )?owe|total.*owe', 10),
      pos('outstanding (balance|debt|loan|emi)', 8),
      pos('debt|loan|emi', 6),
      // KEY FIX: "interest on my liabilities" should go here, not portfolio
      pos('interest.*liabilit|liabilit.*interest|interest.*loan|loan.*interest', 14),
      pos('interest.*pay.*on|how much.*interest.*pay', 10),
      neg('lending|lend.*money|money.*lend|borrower', 10),
      neg('invest|stock|portfolio', 6),
    ],
  },
  {
    id: 'liabilities_highest_interest',
    rules: [
      pos('highest.*interest.*debt|debt.*highest.*interest', 22),
      pos('highest.*interest.*loan|loan.*highest.*interest', 22),
      pos('most.*interest.*rate|highest.*rate.*loan|highest.*rate.*debt', 20),
      pos('interest rate.*liabilit|liabilit.*interest rate', 18),
      pos('liabilit', 5),
      neg('lending|borrower', 8),
    ],
  },
  {
    id: 'liabilities_priority',
    rules: [
      pos('which.*debt.*pay.*first|pay.*first.*debt|priorit.*debt', 22),
      pos('which.*loan.*pay.*off.*first', 20),
      pos('debt.*priorit|priorit.*loan', 18),
      pos('liabilit', 5),
    ],
  },
  {
    id: 'liabilities_debt_ratio',
    rules: [
      pos('debt.?to.?asset|debt.*asset.*ratio|liabilit.*asset', 22),
      pos('what percent.*debt|percent.*asset.*debt', 18),
      pos('debt ratio|leverage ratio', 16),
    ],
  },

  // ── GOALS ───────────────────────────────────────────────────────────────────
  {
    id: 'goals',
    rules: [
      pos('(my )?goal(s)?', 15),
      pos('financial goal|saving goal|target amount', 12),
      pos('progress.*goal|goal.*progress', 10),
      pos('all.*goal|list.*goal', 8),
      neg('next.*payment|payment.*due', 6),
    ],
  },
  {
    id: 'goals_closest',
    rules: [
      pos('closest.*complet|near.*complet|almost.*done|near.*achiev', 22),
      pos('goal.*nearly.*done|most.*complet.*goal', 18),
      pos('highest.*progress.*goal|goal.*highest.*progress', 16),
      pos('goal', 5),
    ],
  },
  {
    id: 'goals_lowest_progress',
    rules: [
      pos('lowest.*progress|least.*progress|furthest.*goal|far.*goal', 22),
      pos('goal.*least.*complet|behind.*goal|most.*remaining', 16),
      pos('goal', 5),
    ],
  },
  {
    id: 'goals_nearest_deadline',
    rules: [
      // KEY FIX: "goal deadline" must score much higher than "next payment"
      pos('goal.*deadline|deadline.*goal', 22),
      pos('nearest.*deadline.*goal|soonest.*deadline.*goal', 22),
      pos('earliest.*deadline.*goal|next.*goal.*due', 20),
      pos('which.*goal.*due.*first|goal.*due.*soonest', 18),
      pos('goal', 5),
      neg('payment|bill|emi', 8),
    ],
  },
  {
    id: 'goals_on_track',
    rules: [
      pos('on track.*goal|goal.*on track|am i on track', 22),
      pos('reach.*goal|going to.*goal|achieve.*goal', 16),
      pos('goal.*achievable|will i.*goal', 14),
      pos('goal', 5),
    ],
  },
  {
    id: 'goals_remaining',
    rules: [
      pos('how much.*remain.*goal|remaining.*each.*goal', 22),
      pos('how much.*still.*need.*goal|need.*reach.*goal', 18),
      pos('goal.*remaining|remaining.*goal', 14),
      pos('goal', 5),
    ],
  },
  {
    id: 'goals_next_focus',
    rules: [
      pos('which.*goal.*focus.*next|focus.*next.*goal|next.*goal.*work', 22),
      pos('goal.*priorit|priorit.*goal', 16),
      pos('goal', 5),
    ],
  },

  // ── ACCOUNTS ────────────────────────────────────────────────────────────────
  {
    id: 'accounts',
    rules: [
      pos('(bank )?account|my accounts?', 15),
      pos('account.*balance|balance.*account', 12),
      pos('bank.*balance|savings.*balance|how much.*in.*account', 12),
      pos('how many.*account|which.*account', 8),
      neg('invest|stock|portfolio', 4),
      neg('payment|due|bill', 4),
    ],
  },
  {
    id: 'accounts_highest',
    rules: [
      pos('highest.*balance.*account|account.*highest.*balance', 22),
      pos('richest.*account|most.*money.*account|largest.*account', 18),
      pos('account', 5),
    ],
  },
  {
    id: 'accounts_distribution',
    rules: [
      pos('distribut.*account|wealth.*distribut.*account', 22),
      pos('breakdown.*account|account.*breakdown', 18),
      pos('account.*percent|percent.*account', 14),
      pos('account', 5),
    ],
  },
  {
    id: 'accounts_cash',
    rules: [
      pos('how much.*cash|total.*cash|liquid.*cash', 20),
      pos('cash.*position|available cash|cash on hand', 18),
      pos('cash', 8),
      neg('cashflow|cash flow', 5),
    ],
  },

  // ── LENDING ─────────────────────────────────────────────────────────────────
  // KEY FIX: Lending rules now heavily penalise liabilities keywords and vice versa.
  {
    id: 'lending',
    rules: [
      pos('lending|money.*lent|lent.*money|money i lend', 20),
      pos('borrower|how much.*lent|lend.*to', 18),
      pos('i lent|i have lent|outstanding.*lending|lending.*outstanding', 16),
      pos('money.*owe.*me|owes.*me', 14),
      // KEY FIX: "outstanding" alone should NOT map here without lending context
      neg('my loan|my debt|my emi|my liabilit', 15),
      neg('payment.*due|bill.*due', 8),
    ],
  },
  {
    id: 'lending_outstanding',
    rules: [
      pos('outstanding.*lending|lending.*outstanding|outstanding.*lent', 24),
      pos('still.*owe.*me|how much.*lent.*outstanding', 20),
      pos('outstanding.*borrower|borrower.*outstanding', 18),
      pos('lending|lent', 8),
      neg('my loan|my debt|my emi|liabilit', 15),
    ],
  },
  {
    id: 'lending_top_borrower',
    rules: [
      pos('owes.*me.*most|who.*owes.*most|borrower.*most|most.*borrow', 22),
      pos('highest.*borrow|which.*borrower.*most', 18),
      pos('lending|borrower', 8),
    ],
  },
  {
    id: 'lending_interest_collected',
    rules: [
      // KEY FIX: "interest collected from lending" must not route to liabilities
      pos('interest.*collect|interest.*receive.*lend|lend.*interest.*receive', 24),
      pos('how much.*interest.*lend|interest.*from.*borrow', 20),
      pos('lending', 8),
    ],
  },
  {
    id: 'lending_overdue',
    rules: [
      pos('overdue.*lend|lend.*overdue|overdue.*repay|late.*repay.*lend', 22),
      pos('borrower.*overdue|overdue.*borrower', 18),
      pos('lending|borrower', 8),
    ],
  },
  {
    id: 'lending_recovered',
    rules: [
      pos('recover.*lend|lend.*recover|recoup', 22),
      pos('how much.*recover.*lend|repaid.*lend', 18),
      pos('lending', 8),
    ],
  },
];

// ─── Scorer ───────────────────────────────────────────────────────────────────

interface ScoredIntent { id: string; score: number; }

function scoreIntents(q: string): ScoredIntent[] {
  // Deduplicate same intent — later rules for the same id accumulate
  const totals = new Map<string, number>();
  for (const def of INTENT_DEFS) {
    const existing = totals.get(def.id) ?? 0;
    let add = 0;
    for (const rule of def.rules) {
      if (rule.re.test(q)) add += rule.w;
    }
    totals.set(def.id, existing + add);
  }
  return Array.from(totals.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

function detectPersonalIntent(q: string): string {
  const scores = scoreIntents(q);
  // Must beat a minimum threshold — avoids accidental weak matches
  if (scores[0] && scores[0].score >= 5) return scores[0].id;
  // No confident match → fall back to overview
  return 'dashboard';
}

// ─── Main router ──────────────────────────────────────────────────────────────

export function routeQuestion(question: string): RouteResult {
  const q = question.trim().toLowerCase();

  // 1. Hard out-of-scope — but never block CRUD commands (add/delete/update/buy/lent)
  const isCrudCommand = /^(add|buy|bought|record|create|delete|remove|update|change|edit|mark|lent|lend|gave|i (bought|lent|spent|received|got))\b/i.test(question.trim());
  const isHardOutOfScope = !isCrudCommand && OUT_OF_SCOPE_PATTERNS.some((rx) => rx.test(q));
  const isTopicInScope   = FINTRACKLY_TOPICS.some((t) => q.includes(t));
  const hasPersonal      = hasPersonalSignal(q);

  if (isHardOutOfScope || (!isTopicInScope && !hasPersonal && !isCrudCommand)) {
    return { type: 'OUT_OF_SCOPE', intent: 'out_of_scope' };
  }

  // 1b. ACTION — check BEFORE explain/personal so "add ₹500 income",
  //     "delete my TCS stock", "update home loan outstanding" all go here.
  //     search_records also routes as ACTION (executor returns instant results).
  const actionType = detectActionType(q);
  if (actionType !== 'unknown') {
    return { type: 'ACTION', intent: actionType };
  }

  // 2. Explain / analyse → hybrid (Groq + data)
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

  // 4. FinTrackly feature guide
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
  if (/\btoday\b|today'?s\b|this\s+day\b/.test(q))                    return 'today';
  if (/\bthis\s+week\b|past\s+7\s+days\b|last\s+7\s+days\b/.test(q)) return 'this_week';
  if (/\bthis\s+month\b|current\s+month\b/.test(q))                   return 'this_month';
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

// ─── Dev helper: expose scoring for debugging ─────────────────────────────────
// Call debugIntent("your question") in the browser console to see scores.

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>)['debugIntent'] = (q: string) => {
    const scores = scoreIntents(q.toLowerCase()).slice(0, 10);
    console.table(scores);
    return scores[0]?.id;
  };
}
