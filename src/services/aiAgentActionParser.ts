/**
 * src/services/aiAgentActionParser.ts
 *
 * Parses natural-language commands into typed action payloads that can be
 * confirmed by the user and then executed against the Zustand store.
 *
 * Supported actions
 * ─────────────────
 *  add_cashflow_income   — "Add ₹500 as income", "Record salary of 45000"
 *  add_cashflow_expense  — "Add ₹1200 food expense", "Spent 800 on groceries"
 *  add_payment           — "Add ₹5000 rent payment for September 1"
 *  add_goal              — "Create a ₹1 lakh savings goal", "Set goal for car"
 *  add_liability         — "Add home loan of ₹20 lakh"
 *  mark_payment_paid     — "Mark rent as paid", "Electricity bill paid"
 *
 * Architecture
 * ─────────────
 *  1. detectActionType(q)  → which action is being requested
 *  2. extractAmount(q)     → ₹ / Rs / number
 *  3. extractDate(q)       → today / tomorrow / September 1 / YYYY-MM-DD
 *  4. extractCategory(q)   → food, salary, rent, etc.
 *  5. extractTitle(q)      → payment / goal title
 *  Combine into a typed ActionPayload + a human-readable summary for the
 *  confirmation card.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionType =
  | 'add_cashflow_income'
  | 'add_cashflow_expense'
  | 'add_payment'
  | 'add_goal'
  | 'add_liability'
  | 'mark_payment_paid'
  | 'unknown';

export interface AddCashflowAction {
  kind: 'add_cashflow_income' | 'add_cashflow_expense';
  amount: number;
  category: string;
  date: string;           // YYYY-MM-DD
  notes?: string;
}

export interface AddPaymentAction {
  kind: 'add_payment';
  title: string;
  amount: number;
  dueDate: string;        // YYYY-MM-DD
  paymentType: string;
  recurrence: 'none' | 'monthly' | 'yearly';
}

export interface AddGoalAction {
  kind: 'add_goal';
  name: string;
  targetAmount: number;
  dueDate?: string;
}

export interface AddLiabilityAction {
  kind: 'add_liability';
  name: string;
  type: 'loan' | 'credit_card' | 'other';
  principal: number;
  outstanding: number;
  interestRate?: number;
  emiAmount?: number;
}

export interface MarkPaymentPaidAction {
  kind: 'mark_payment_paid';
  /** Partial title to match against pending payments */
  titleHint: string;
}

export type ParsedAction =
  | AddCashflowAction
  | AddPaymentAction
  | AddGoalAction
  | AddLiabilityAction
  | MarkPaymentPaidAction;

export interface ActionParseResult {
  action: ParsedAction | null;
  /** Human-readable summary shown in the confirmation card */
  summary: string;
  /** Fields that were missing / assumed — shown as warnings */
  assumptions: string[];
  /** If true, a required field is missing and we should ask the user */
  incomplete: boolean;
  /** A follow-up question to ask when incomplete */
  missingPrompt?: string;
}

// ─── Amount extraction ────────────────────────────────────────────────────────

export function extractAmount(q: string): number | null {
  // ₹5,000 / Rs 5000 / 5000 rupees / 5k / 5 lakh / 5.5 lakh / 5 crore
  const lakhMatch = q.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/i);
  if (lakhMatch) return parseFloat(lakhMatch[1]) * 100_000;

  const croreMatch = q.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*crore/i);
  if (croreMatch) return parseFloat(croreMatch[1]) * 10_000_000;

  const kMatch = q.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return parseFloat(kMatch[1]) * 1_000;

  // ₹5,000 or 5000 or 5,000
  const rupeesMatch = q.match(/(?:₹|rs\.?\s*)(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (rupeesMatch) return parseFloat(rupeesMatch[1].replace(/,/g, ''));

  // bare number followed by rupee/rs/amount context
  const bareMatch = q.match(/\b(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees?|inr|rs\.?)\b/i);
  if (bareMatch) return parseFloat(bareMatch[1].replace(/,/g, ''));

  // just a bare number anywhere (last resort, only if 3+ digits)
  const anyNum = q.match(/\b(\d{3,}(?:,\d{3})*(?:\.\d{1,2})?)\b/);
  if (anyNum) return parseFloat(anyNum[1].replace(/,/g, ''));

  return null;
}

// ─── Date extraction ──────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan:1, january:1, feb:2, february:2, mar:3, march:3,
  apr:4, april:4, may:5, jun:6, june:6, jul:7, july:7,
  aug:8, august:8, sep:9, sept:9, september:9,
  oct:10, october:10, nov:11, november:11, dec:12, december:12,
};

export function extractDate(q: string): string {
  const now  = new Date();
  const pad  = (n: number) => String(n).padStart(2, '0');
  const fmt  = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // today / yesterday / tomorrow
  if (/\btoday\b/i.test(q))     return fmt(now);
  if (/\byesterday\b/i.test(q)) {
    const d = new Date(now); d.setDate(d.getDate() - 1); return fmt(d);
  }
  if (/\btomorrow\b/i.test(q)) {
    const d = new Date(now); d.setDate(d.getDate() + 1); return fmt(d);
  }

  // "September 1" / "Sep 1" / "1 September"
  const namedMonth1 = q.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\w*\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (namedMonth1) {
    const m = MONTHS[namedMonth1[1].toLowerCase().slice(0, 3)];
    const d = parseInt(namedMonth1[2]);
    const y = now.getMonth() + 1 > m ? now.getFullYear() + 1 : now.getFullYear();
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  const namedMonth2 = q.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\w*\b/i);
  if (namedMonth2) {
    const d = parseInt(namedMonth2[1]);
    const m = MONTHS[namedMonth2[2].toLowerCase().slice(0, 3)];
    const y = now.getMonth() + 1 > m ? now.getFullYear() + 1 : now.getFullYear();
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  // DD/MM/YYYY or MM/DD/YYYY or YYYY-MM-DD
  const isoMatch = q.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return isoMatch[0];

  const slashMatch = q.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const d = parseInt(slashMatch[1]);
    const m = parseInt(slashMatch[2]);
    const y = slashMatch[3] ? parseInt(slashMatch[3]) : now.getFullYear();
    const yr = y < 100 ? 2000 + y : y;
    return `${yr}-${pad(m)}-${pad(d)}`;
  }

  // "next month" / "this month"
  if (/\bnext\s+month\b/i.test(q)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    return fmt(d);
  }
  if (/\bthis\s+month\b/i.test(q)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return fmt(d);
  }

  // default: today
  return fmt(now);
}

// ─── Category extraction ──────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: [RegExp, string][] = [
  [/\bfood\b|groceries|grocery|veg|vegetable|meat|restaurant|hotel|lunch|dinner|breakfast|snack|coffee|tea\b/i, 'Food'],
  [/\brent\b|house rent|home rent/i, 'Rent'],
  [/\btransport\b|travel|petrol|diesel|fuel|auto|cab|bus|train|uber|ola|bike|vehicle/i, 'Transport'],
  [/\bemi\b/i, 'EMI'],
  [/\belectricity\b|electric bill|power bill|eb bill/i, 'Electricity'],
  [/\bwater\b|water bill/i, 'Water'],
  [/\bgas\b|lpg|cylinder/i, 'Gas'],
  [/\binternet\b|broadband|wifi/i, 'Internet'],
  [/\bphone\b|mobile bill|recharge/i, 'Phone'],
  [/\bmedical\b|medicine|hospital|doctor|health/i, 'Medical'],
  [/\beducation\b|school|college|fees|tuition/i, 'Education'],
  [/\bshopping\b|clothes|clothing|apparel/i, 'Shopping'],
  [/\binsurance\b/i, 'Insurance'],
  [/\bsubscription\b|netflix|amazon|spotify|ott\b/i, 'Subscription'],
  [/\bmaintenance\b|repair|service\b/i, 'Maintenance'],
  [/\bcharity\b|donation|donate/i, 'Charity'],
  [/\bwedding\b|marriage|function/i, 'Wedding'],
  [/\bsalary.*advance\b/i, 'Salary Advance'],
  [/\blend\b|lent\b|given to\b|borrow/i, 'Lending'],
];

const INCOME_CATEGORIES: [RegExp, string][] = [
  [/\bsalary\b|wage\b|pay(slip)?\b/i, 'Salary'],
  [/\bfreelance\b|freelancing|client payment/i, 'Freelance'],
  [/\bbusiness\b|profit from\b/i, 'Business'],
  [/\bdividend\b/i, 'Dividend'],
  [/\binterest\b/i, 'Interest Income'],
  [/\brent(al)? income\b|rental received\b/i, 'Rental Income'],
  [/\brefund\b/i, 'Refund'],
  [/\bgift\b|received.*gift|gift.*received/i, 'Gift'],
  [/\bbonus\b/i, 'Bonus'],
  [/\brepay(ment)?\b|returned.*loan|loan.*returned\b/i, 'Loan Repayment'],
];

function extractCategory(q: string, type: 'income' | 'expense'): string {
  const map = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  for (const [re, cat] of map) {
    if (re.test(q)) return cat;
  }
  return type === 'income' ? 'Income' : 'Expense';
}

// ─── Payment type mapping ─────────────────────────────────────────────────────

function detectPaymentType(q: string): string {
  if (/\brent\b/i.test(q))           return 'rent';
  if (/\bemi\b/i.test(q))            return 'emi';
  if (/\bhome\s*loan\b/i.test(q))    return 'home_loan';
  if (/\bvehicle\s*loan\b|car\s*loan\b/i.test(q)) return 'vehicle_loan';
  if (/\bpersonal\s*loan\b/i.test(q)) return 'personal_loan';
  if (/\binsurance\b/i.test(q))      return 'insurance';
  if (/\bchit\s*fund\b/i.test(q))    return 'chit_fund';
  if (/\bcredit\s*card\b/i.test(q))  return 'credit_card';
  if (/\bfd\b|fixed\s*deposit\b/i.test(q)) return 'fd_maturity';
  return 'custom';
}

function detectRecurrence(q: string): 'none' | 'monthly' | 'yearly' {
  if (/\bevery\s*month\b|monthly\b|month(ly)?\s*payment\b/i.test(q)) return 'monthly';
  if (/\beveryyear\b|annually\b|yearly\b|every\s*year\b/i.test(q))   return 'yearly';
  return 'none';
}

// ─── Title / name extraction ──────────────────────────────────────────────────

function extractPaymentTitle(q: string): string {
  // "add ₹5000 rent payment for september 1" → "Rent"
  // "remind me to pay the electricity bill" → "Electricity Bill"
  // "Add a reminder for my loan EMI" → "Loan EMI"

  const presets: [RegExp, string][] = [
    [/\belectricity\b/i, 'Electricity Bill'],
    [/\bwater\s*bill\b/i, 'Water Bill'],
    [/\bgas\b|lpg\b/i, 'Gas Bill'],
    [/\bphone\s*bill\b|mobile\s*bill\b/i, 'Phone Bill'],
    [/\binternet\b|broadband\b/i, 'Internet Bill'],
    [/\brent\b/i, 'Rent'],
    [/\bhome\s*loan\s*emi\b/i, 'Home Loan EMI'],
    [/\bcar\s*loan\s*emi\b|vehicle\s*loan\s*emi\b/i, 'Car Loan EMI'],
    [/\bpersonal\s*loan\s*emi\b/i, 'Personal Loan EMI'],
    [/\bemi\b/i, 'EMI'],
    [/\bchit\s*fund\b/i, 'Chit Fund'],
    [/\binsurance\s*premium\b/i, 'Insurance Premium'],
    [/\bcredit\s*card\s*bill\b/i, 'Credit Card Bill'],
    [/\bschool\s*fees?\b|college\s*fees?\b/i, 'School Fees'],
    [/\bsubscription\b/i, 'Subscription'],
  ];

  for (const [re, title] of presets) {
    if (re.test(q)) return title;
  }

  // Try to extract a word before "payment" / "reminder" / "bill"
  const m1 = q.match(/\b(\w+(?:\s+\w+)?)\s+(?:payment|bill|reminder|due|fee)\b/i);
  if (m1 && m1[1].length > 2) return toTitleCase(m1[1]);

  // Just use "Payment" as fallback
  return 'Payment';
}

function extractGoalName(q: string): string {
  const presets: [RegExp, string][] = [
    [/\bemergency\s*fund\b/i, 'Emergency Fund'],
    [/\bcar\b|vehicle\b/i, 'Car Purchase'],
    [/\bhouse\b|home\b|flat\b|apartment\b/i, 'Home Purchase'],
    [/\bvacation\b|trip\b|travel\b/i, 'Vacation'],
    [/\beducation\b|college\b|fees?\b/i, 'Education'],
    [/\bwedding\b|marriage\b/i, 'Wedding'],
    [/\bretirement\b/i, 'Retirement'],
    [/\bbusiness\b/i, 'Business'],
  ];
  for (const [re, name] of presets) {
    if (re.test(q)) return name;
  }

  // "goal (for|to|named) X"
  const m = q.match(/goal\s+(?:for|to|named?|called?|of)\s+([a-z][a-z\s]{2,25})/i);
  if (m) return toTitleCase(m[1].trim());

  // "save for X"
  const m2 = q.match(/save\s+for\s+([a-z][a-z\s]{2,25})/i);
  if (m2) return toTitleCase(m2[1].trim());

  return 'Savings Goal';
}

function extractLiabilityName(q: string): string {
  const presets: [RegExp, string][] = [
    [/\bhome\s*loan\b/i, 'Home Loan'],
    [/\bcar\s*loan\b|vehicle\s*loan\b/i, 'Car Loan'],
    [/\bpersonal\s*loan\b/i, 'Personal Loan'],
    [/\bcredit\s*card\b/i, 'Credit Card'],
    [/\beducation\s*loan\b/i, 'Education Loan'],
    [/\bbusiness\s*loan\b/i, 'Business Loan'],
    [/\bgold\s*loan\b/i, 'Gold Loan'],
  ];
  for (const [re, name] of presets) {
    if (re.test(q)) return name;
  }
  const m = q.match(/(?:add|record|entered?|create)\s+(?:a\s+)?(?:my\s+)?([a-z][a-z\s]{2,25})\s+(?:loan|debt|liability|credit)/i);
  if (m) return toTitleCase(m[1].trim()) + ' Loan';
  return 'Loan';
}

function toTitleCase(s: string) {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

// ─── Mark payment paid hint ───────────────────────────────────────────────────

function extractPaymentTitleHint(q: string): string {
  // "Mark rent as paid" → "rent"
  // "Electricity bill paid" → "electricity"
  const presets: [RegExp, string][] = [
    [/\belectricity\b/i, 'electricity'],
    [/\brent\b/i, 'rent'],
    [/\bwater\b/i, 'water'],
    [/\bgas\b/i, 'gas'],
    [/\bemi\b/i, 'emi'],
    [/\bhome\s*loan\b/i, 'home loan'],
    [/\bcar\s*loan\b/i, 'car loan'],
    [/\bphone\b/i, 'phone'],
    [/\binternet\b/i, 'internet'],
    [/\binsurance\b/i, 'insurance'],
    [/\bchit\b/i, 'chit'],
    [/\bcredit\s*card\b/i, 'credit card'],
  ];
  for (const [re, hint] of presets) {
    if (re.test(q)) return hint;
  }
  // "mark X as paid" pattern
  const m = q.match(/\bmark\s+(?:my\s+)?(?:the\s+)?([a-z][a-z\s]{1,20})\s+(?:as\s+)?paid\b/i);
  if (m) return m[1].trim().toLowerCase();
  // "X paid" pattern
  const m2 = q.match(/\b([a-z][a-z\s]{1,20})\s+(?:bill\s+)?paid\b/i);
  if (m2) return m2[1].trim().toLowerCase();
  return '';
}

// ─── Action type detector ─────────────────────────────────────────────────────

export function detectActionType(q: string): ActionType {
  const lower = q.toLowerCase();

  // Mark as paid — check before add patterns
  if (/\bmark\b.*\bpaid\b|\bpaid\b.*\bmark\b|\bpayment\s+paid\b|\bpaid\s+today\b/i.test(lower) ||
      /\bmark\b.*\bas\s+paid\b/i.test(lower)) {
    return 'mark_payment_paid';
  }

  // Income
  if (/\b(add|record|log|enter|received?|got)\b.{0,40}\b(income|salary|earning|earning|revenue|money in|cash in)\b/i.test(lower) ||
      /\b(salary|income|earning)\b.{0,30}\b(add|record|log|of|is|was)\b/i.test(lower) ||
      /\b(received|got)\b.{0,30}₹/i.test(lower) ||
      /\bas\s+(an?\s+)?income\b/i.test(lower)) {
    return 'add_cashflow_income';
  }

  // Expense
  if (/\b(add|record|log|enter|spent|paid for|bought)\b.{0,40}\b(expense|spending|cost|purchase)\b/i.test(lower) ||
      /\b(spent|paid|buy|bought)\b.{0,30}(?:₹|\d)/i.test(lower) ||
      /\bas\s+(an?\s+)?expense\b/i.test(lower) ||
      /\bexpense\b.{0,20}\b(add|record|log|of|is|was)\b/i.test(lower)) {
    return 'add_cashflow_expense';
  }

  // Payment reminder
  if (/\b(add|create|set|remind|record)\b.{0,40}\b(payment|reminder|bill|due|emi)\b/i.test(lower) ||
      /\bpayment\b.{0,30}\b(add|create|set|for|on|due)\b/i.test(lower) ||
      /\bremind\s+me\s+to\s+pay\b/i.test(lower)) {
    return 'add_payment';
  }

  // Goal
  if (/\b(add|create|set|make|start)\b.{0,40}\b(goal|target|saving goal|financial goal)\b/i.test(lower) ||
      /\bsave\s+for\b/i.test(lower) ||
      /\bgoal\b.{0,20}\b(add|create|of|for|to)\b/i.test(lower)) {
    return 'add_goal';
  }

  // Liability
  if (/\b(add|record|enter|create)\b.{0,40}\b(loan|debt|liability|liabilit|credit card bill)\b/i.test(lower) ||
      /\b(home loan|car loan|personal loan|education loan|gold loan)\b.{0,20}\b(add|record|of)\b/i.test(lower)) {
    return 'add_liability';
  }

  return 'unknown';
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseAction(question: string): ActionParseResult {
  const q    = question.trim();
  const type = detectActionType(q);
  const assumptions: string[] = [];

  if (type === 'unknown') {
    return { action: null, summary: '', assumptions: [], incomplete: false };
  }

  // ── Mark payment paid ──────────────────────────────────────────────────────
  if (type === 'mark_payment_paid') {
    const hint = extractPaymentTitleHint(q);
    if (!hint) {
      return {
        action: null,
        summary: '',
        assumptions: [],
        incomplete: true,
        missingPrompt: 'Which payment would you like to mark as paid? (e.g. "Mark rent as paid")',
      };
    }
    return {
      action: { kind: 'mark_payment_paid', titleHint: hint },
      summary: `Mark "${toTitleCase(hint)}" payment as paid`,
      assumptions: [],
      incomplete: false,
    };
  }

  // ── Add cashflow (income or expense) ───────────────────────────────────────
  if (type === 'add_cashflow_income' || type === 'add_cashflow_expense') {
    const cfType = type === 'add_cashflow_income' ? 'income' : 'expense';
    const amount = extractAmount(q);
    if (!amount) {
      return {
        action: null,
        summary: '',
        assumptions: [],
        incomplete: true,
        missingPrompt: `How much? Please include the amount (e.g. "Add ₹500 salary income")`,
      };
    }
    const category = extractCategory(q, cfType);
    const date     = extractDate(q);

    // Detect if today was assumed
    const hasExplicitDate = /\btoday\b|yesterday\b|tomorrow\b|\d{1,2}[\/\-]\d{1,2}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(q);
    if (!hasExplicitDate) assumptions.push(`Date set to today (${date})`);

    const action: AddCashflowAction = {
      kind: type,
      amount,
      category,
      date,
    };

    const rupee = `₹${amount.toLocaleString('en-IN')}`;
    const label = cfType === 'income' ? '💰 Income' : '💸 Expense';
    return {
      action,
      summary: `${label}: ${rupee} · ${category} · ${date}`,
      assumptions,
      incomplete: false,
    };
  }

  // ── Add payment reminder ───────────────────────────────────────────────────
  if (type === 'add_payment') {
    const amount = extractAmount(q);
    if (!amount) {
      return {
        action: null,
        summary: '',
        assumptions: [],
        incomplete: true,
        missingPrompt: 'What is the payment amount? (e.g. "Add ₹2,500 electricity bill for September 15")',
      };
    }
    const title      = extractPaymentTitle(q);
    const dueDate    = extractDate(q);
    const payType    = detectPaymentType(q);
    const recurrence = detectRecurrence(q);

    const hasExplicitDate = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\d{1,2}[\/\-]\d{1,2}|today|tomorrow/i.test(q);
    if (!hasExplicitDate) assumptions.push(`Due date set to today (${dueDate})`);

    const action: AddPaymentAction = {
      kind: 'add_payment',
      title,
      amount,
      dueDate,
      paymentType: payType,
      recurrence,
    };

    const rupee = `₹${amount.toLocaleString('en-IN')}`;
    const rec   = recurrence !== 'none' ? ` · ${recurrence}` : '';
    return {
      action,
      summary: `🔔 Payment: ${title} · ${rupee} · Due ${dueDate}${rec}`,
      assumptions,
      incomplete: false,
    };
  }

  // ── Add goal ──────────────────────────────────────────────────────────────
  if (type === 'add_goal') {
    const amount = extractAmount(q);
    if (!amount) {
      return {
        action: null,
        summary: '',
        assumptions: [],
        incomplete: true,
        missingPrompt: 'What is the target amount for your goal? (e.g. "Create a ₹1 lakh emergency fund goal")',
      };
    }
    const name    = extractGoalName(q);
    const dueDate = /\bby\b|\bdeadline\b|\bdue\b|\btarget date\b/i.test(q) ? extractDate(q) : undefined;
    const action: AddGoalAction = { kind: 'add_goal', name, targetAmount: amount, dueDate };

    const rupee = `₹${amount.toLocaleString('en-IN')}`;
    const due   = dueDate ? ` · Deadline ${dueDate}` : '';
    return {
      action,
      summary: `🎯 Goal: ${name} · Target ${rupee}${due}`,
      assumptions: [],
      incomplete: false,
    };
  }

  // ── Add liability ─────────────────────────────────────────────────────────
  if (type === 'add_liability') {
    const amount = extractAmount(q);
    if (!amount) {
      return {
        action: null,
        summary: '',
        assumptions: [],
        incomplete: true,
        missingPrompt: 'What is the loan/liability amount? (e.g. "Add home loan of ₹20 lakh")',
      };
    }
    const name = extractLiabilityName(q);

    // Determine type
    let liabType: 'loan' | 'credit_card' | 'other' = 'loan';
    if (/credit\s*card/i.test(q)) liabType = 'credit_card';
    else if (/personal\s*loan|hand\s*loan|friend|family/i.test(q)) liabType = 'other';

    // Interest rate
    const rateMatch = q.match(/(\d+(?:\.\d+)?)\s*%\s*(?:p\.?a\.?|per\s*annum|interest|rate)/i) ||
                      q.match(/interest\s+(?:rate\s+)?(?:of\s+)?(\d+(?:\.\d+)?)\s*%/i);
    const interestRate = rateMatch ? parseFloat(rateMatch[1]) : undefined;

    // EMI
    const emiMatch = q.match(/emi\s+(?:of\s+)?(?:₹|rs\.?\s*)?(\d[\d,]*)/i) ||
                     q.match(/monthly\s+(?:₹|rs\.?\s*)?(\d[\d,]*)\s+emi/i);
    const emiAmount = emiMatch ? parseFloat(emiMatch[1].replace(/,/g, '')) : undefined;

    if (interestRate === undefined) assumptions.push('Interest rate not specified');
    if (emiAmount === undefined)    assumptions.push('EMI amount not specified');

    const action: AddLiabilityAction = {
      kind: 'add_liability',
      name,
      type: liabType,
      principal: amount,
      outstanding: amount,
      ...(interestRate !== undefined ? { interestRate } : {}),
      ...(emiAmount    !== undefined ? { emiAmount }    : {}),
    };

    const rupee = `₹${amount.toLocaleString('en-IN')}`;
    const rate  = interestRate ? ` · ${interestRate}%` : '';
    const emi   = emiAmount ? ` · EMI ₹${emiAmount.toLocaleString('en-IN')}` : '';
    return {
      action,
      summary: `💳 Liability: ${name} · ${rupee}${rate}${emi}`,
      assumptions,
      incomplete: false,
    };
  }

  return { action: null, summary: '', assumptions: [], incomplete: false };
}
