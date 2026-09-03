/**
 * src/services/aiAgentActionParser.ts
 *
 * Parses natural-language commands into typed action payloads.
 * Supported actions (full CRUD across all modules):
 *
 * CREATE
 *   add_cashflow_income / add_cashflow_expense
 *   add_payment          add_goal          add_liability
 *   add_investment       add_insurance     add_account
 *   add_lending_borrower add_lending_transaction
 *
 * UPDATE
 *   update_payment       update_goal       update_liability
 *   update_investment
 *
 * DELETE
 *   delete_payment       delete_goal       delete_liability
 *   delete_investment    delete_insurance  delete_account
 *   delete_lending_borrower
 *
 * OTHER
 *   mark_payment_paid    search_records
 */

// ─── Action types ─────────────────────────────────────────────────────────────

export type ActionType =
  // CREATE
  | 'add_cashflow_income'
  | 'add_cashflow_expense'
  | 'add_payment'
  | 'add_goal'
  | 'add_liability'
  | 'add_investment'
  | 'add_insurance'
  | 'add_account'
  | 'add_lending_borrower'
  | 'add_lending_transaction'
  // UPDATE
  | 'update_payment'
  | 'update_goal'
  | 'update_liability'
  | 'update_investment'
  // DELETE
  | 'delete_payment'
  | 'delete_goal'
  | 'delete_liability'
  | 'delete_investment'
  | 'delete_insurance'
  | 'delete_account'
  | 'delete_lending_borrower'
  // OTHER
  | 'mark_payment_paid'
  | 'search_records'
  | 'unknown';

// ─── Parsed action shapes ─────────────────────────────────────────────────────

export interface AddCashflowAction {
  kind: 'add_cashflow_income' | 'add_cashflow_expense';
  amount: number;
  category: string;
  date: string;
  notes?: string;
}

export interface AddPaymentAction {
  kind: 'add_payment';
  title: string;
  amount: number;
  dueDate: string;
  paymentType: string;
  recurrence: 'none' | 'monthly' | 'yearly';
  notes?: string;
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

export interface AddInvestmentAction {
  kind: 'add_investment';
  investmentType: 'stock' | 'mutual_fund' | 'fixed_deposit' | 'bond' | 'other';
  name: string;
  symbol?: string;
  // stock
  quantity?: number;
  buyPrice?: number;
  currentPrice?: number;
  // mutual fund
  units?: number;
  nav?: number;
  // fd / bond / other
  investedAmount?: number;
  interestRate?: number;
  durationMonths?: number;
  startDate?: string;
  maturityDate?: string;
  bankName?: string;
  // other
  currentValue?: number;
  assetType?: string;
  platform?: string;
  notes?: string;
}

export interface AddInsuranceAction {
  kind: 'add_insurance';
  policyName: string;
  provider: string;
  type: 'life' | 'health' | 'vehicle' | 'property' | 'other';
  premiumAmount: number;
  premiumFrequency: 'monthly' | 'yearly' | 'quarterly' | 'half-yearly';
  coverageAmount: number;
  renewalDate: string;
  notes?: string;
}

export interface AddAccountAction {
  kind: 'add_account';
  name: string;
  type: 'bank' | 'credit';
  balance: number;
  openingBalance?: number;
  openingBalanceDate?: string;
}

export interface AddLendingBorrowerAction {
  kind: 'add_lending_borrower';
  name: string;
  phone?: string;
  interestRate?: number;
  notes?: string;
}

export interface AddLendingTransactionAction {
  kind: 'add_lending_transaction';
  borrowerNameHint: string;
  txType: 'principal_given' | 'interest_paid' | 'principal_returned';
  amount: number;
  date: string;
  notes?: string;
}

export interface UpdatePaymentAction {
  kind: 'update_payment';
  titleHint: string;
  patch: { amount?: number; dueDate?: string; title?: string; recurrence?: string };
}

export interface UpdateGoalAction {
  kind: 'update_goal';
  nameHint: string;
  patch: { targetAmount?: number; dueDate?: string; name?: string; currentAmount?: number };
}

export interface UpdateLiabilityAction {
  kind: 'update_liability';
  nameHint: string;
  patch: { outstanding?: number; emiAmount?: number; interestRate?: number; status?: string };
}

export interface UpdateInvestmentAction {
  kind: 'update_investment';
  nameHint: string;
  patch: { currentPrice?: number; quantity?: number; nav?: number; units?: number; notes?: string };
}

export interface DeleteAction {
  kind:
    | 'delete_payment'
    | 'delete_goal'
    | 'delete_liability'
    | 'delete_investment'
    | 'delete_insurance'
    | 'delete_account'
    | 'delete_lending_borrower';
  nameHint: string;
}

export interface MarkPaymentPaidAction {
  kind: 'mark_payment_paid';
  titleHint: string;
}

export interface SearchAction {
  kind: 'search_records';
  module: string;
  query: string;
}

export type ParsedAction =
  | AddCashflowAction
  | AddPaymentAction
  | AddGoalAction
  | AddLiabilityAction
  | AddInvestmentAction
  | AddInsuranceAction
  | AddAccountAction
  | AddLendingBorrowerAction
  | AddLendingTransactionAction
  | UpdatePaymentAction
  | UpdateGoalAction
  | UpdateLiabilityAction
  | UpdateInvestmentAction
  | DeleteAction
  | MarkPaymentPaidAction
  | SearchAction;

export interface ActionParseResult {
  action: ParsedAction | null;
  summary: string;
  assumptions: string[];
  incomplete: boolean;
  missingPrompt?: string;
}

// ─── Amount extraction ────────────────────────────────────────────────────────

export function extractAmount(q: string): number | null {
  const lakhMatch = q.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/i);
  if (lakhMatch) return parseFloat(lakhMatch[1]) * 100_000;

  const croreMatch = q.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*crore/i);
  if (croreMatch) return parseFloat(croreMatch[1]) * 10_000_000;

  const kMatch = q.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return parseFloat(kMatch[1]) * 1_000;

  const rupeesMatch = q.match(/(?:₹|rs\.?\s*)(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (rupeesMatch) return parseFloat(rupeesMatch[1].replace(/,/g, ''));

  const bareMatch = q.match(/\b(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees?|inr|rs\.?)\b/i);
  if (bareMatch) return parseFloat(bareMatch[1].replace(/,/g, ''));

  const anyNum = q.match(/\b(\d{3,}(?:,\d{3})*(?:\.\d{1,2})?)\b/);
  if (anyNum) return parseFloat(anyNum[1].replace(/,/g, ''));

  return null;
}

// Extract a second distinct amount (for buy price, coverage, etc.)
export function extractSecondAmount(q: string): number | null {
  const matches = [...q.matchAll(/(?:₹|rs\.?\s*)(\d[\d,]*(?:\.\d{1,2})?)/gi)];
  if (matches.length >= 2) return parseFloat(matches[1][1].replace(/,/g, ''));

  // "at 3200" or "@ 3200" pattern
  const atMatch = q.match(/(?:at|@|price\s+of|priced\s+at)\s+(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (atMatch) return parseFloat(atMatch[1].replace(/,/g, ''));

  return null;
}

// ─── Date extraction ──────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan:1, january:1, feb:2, february:2, mar:3, march:3,
  apr:4, april:4, may:5, jun:6, june:6, jul:7, july:7,
  aug:8, august:8, sep:9, september:9, oct:10, october:10,
  nov:11, november:11, dec:12, december:12,
};

export function extractDate(q: string): string {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  if (/\btoday\b/i.test(q)) return fmt(today);
  if (/\btomorrow\b/i.test(q)) { const d = new Date(today); d.setDate(d.getDate()+1); return fmt(d); }
  if (/\byesterday\b/i.test(q)) { const d = new Date(today); d.setDate(d.getDate()-1); return fmt(d); }

  // "next month" or "end of month"
  if (/\bnext month\b/i.test(q)) {
    const d = new Date(today.getFullYear(), today.getMonth()+1, 1);
    return fmt(d);
  }

  // "September 15" or "15 September" or "Sep 15"
  const monthDayMatch = q.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i,
  );
  if (monthDayMatch) {
    const mon = MONTHS[monthDayMatch[1].toLowerCase().slice(0,3)];
    const day = parseInt(monthDayMatch[2]);
    let year  = today.getFullYear();
    if (mon < today.getMonth() + 1) year++;
    return `${year}-${pad(mon)}-${pad(day)}`;
  }

  // "15 September"
  const dayMonthMatch = q.match(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i,
  );
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1]);
    const mon = MONTHS[dayMonthMatch[2].toLowerCase().slice(0,3)];
    let year  = today.getFullYear();
    if (mon < today.getMonth() + 1) year++;
    return `${year}-${pad(mon)}-${pad(day)}`;
  }

  // "in X months" or "in X years"
  const inMonthsMatch = q.match(/\bin\s+(\d+)\s+months?\b/i);
  if (inMonthsMatch) {
    const d = new Date(today);
    d.setMonth(d.getMonth() + parseInt(inMonthsMatch[1]));
    return fmt(d);
  }
  const inYearsMatch = q.match(/\bin\s+(\d+)\s+years?\b/i);
  if (inYearsMatch) {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() + parseInt(inYearsMatch[1]));
    return fmt(d);
  }

  // YYYY-MM-DD
  const iso = q.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  return fmt(today);
}

// ─── Category extraction ──────────────────────────────────────────────────────

const INCOME_CATEGORIES: [RegExp, string][] = [
  [/\bsalar(y|ies)\b/i, 'Salary'],
  [/\bfreelance|freelancing\b/i, 'Freelance'],
  [/\bbusiness\b/i, 'Business'],
  [/\bdividend\b/i, 'Dividend'],
  [/\brent(al)? (income|received)\b/i, 'Rent Income'],
  [/\binterest (income|earned|received)\b/i, 'Interest'],
  [/\bbonus\b/i, 'Bonus'],
  [/\bgift\b/i, 'Gift'],
  [/\brefund\b/i, 'Refund'],
];

const EXPENSE_CATEGORIES: [RegExp, string][] = [
  [/\bfood|groceries|grocery|eat|restaurant|dining\b/i, 'Food'],
  [/\brent\b/i, 'Rent'],
  [/\belectricit(y|ies)|electric\s+bill\b/i, 'Electricity'],
  [/\bwater\s+bill\b/i, 'Water'],
  [/\bgas\s+bill|cooking\s+gas\b/i, 'Gas'],
  [/\binternet|broadband|wifi\b/i, 'Internet'],
  [/\bphone|mobile\s+bill|recharge\b/i, 'Phone'],
  [/\btransport|fuel|petrol|diesel|cab|auto|bus|train\b/i, 'Transport'],
  [/\bmedical|doctor|hospital|medicine|pharmacy\b/i, 'Medical'],
  [/\beducation|school|college|fees\b/i, 'Education'],
  [/\bemi\b/i, 'EMI'],
  [/\binsurance\b/i, 'Insurance'],
  [/\bshopping|clothes|clothing\b/i, 'Shopping'],
  [/\bentertain|movie|ott|subscription\b/i, 'Entertainment'],
  [/\btravel|hotel|flight|vacation\b/i, 'Travel'],
  [/\bchit\b/i, 'Chit Fund'],
];

export function extractCategory(q: string, type: 'income' | 'expense'): string {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  for (const [re, cat] of list) {
    if (re.test(q)) return cat;
  }
  return type === 'income' ? 'Other Income' : 'Other Expense';
}

// ─── Helper: title case ───────────────────────────────────────────────────────

function toTitleCase(s: string) {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

// ─── Payment title extraction ─────────────────────────────────────────────────

function extractPaymentTitle(q: string): string {
  const presets: [RegExp, string][] = [
    [/\belectricity\b/i, 'Electricity Bill'],
    [/\bwater\b/i, 'Water Bill'],
    [/\bgas\b/i, 'Gas Bill'],
    [/\brent\b/i, 'Rent'],
    [/\binternet|broadband\b/i, 'Internet Bill'],
    [/\bphone|mobile\b/i, 'Phone Bill'],
    [/\bhome\s*loan\b/i, 'Home Loan EMI'],
    [/\bcar\s*loan\b/i, 'Car Loan EMI'],
    [/\bcredit\s*card\b/i, 'Credit Card'],
    [/\binsurance\b/i, 'Insurance Premium'],
    [/\bchit\b/i, 'Chit Fund'],
    [/\bemi\b/i, 'EMI'],
    [/\bschool\s*fees|college\s*fees\b/i, 'School Fees'],
  ];
  for (const [re, name] of presets) {
    if (re.test(q)) return name;
  }
  // "add X payment" or "set up X reminder"
  const m = q.match(/(?:add|set|create|remind(?:\s+me)?(?:\s+to\s+pay)?|record)\s+(?:a\s+)?(?:my\s+)?(?:the\s+)?([a-z][a-z\s]{2,30}?)\s+(?:payment|bill|reminder|due|emi)/i);
  if (m) return toTitleCase(m[1].trim());
  return 'Payment';
}

function extractPaymentType(q: string): string {
  if (/\bcredit\s*card\b/i.test(q)) return 'credit_card';
  if (/\bhome\s*loan\b/i.test(q)) return 'home_loan';
  if (/\bcar\s*loan|vehicle\s*loan\b/i.test(q)) return 'vehicle_loan';
  if (/\bpersonal\s*loan\b/i.test(q)) return 'personal_loan';
  if (/\binsurance\b/i.test(q)) return 'insurance';
  if (/\bchit\b/i.test(q)) return 'chit_fund';
  if (/\bemi\b/i.test(q)) return 'emi';
  if (/\brent\b/i.test(q)) return 'rent';
  if (/\bfd\b|fixed\s*deposit\b/i.test(q)) return 'fd_maturity';
  return 'custom';
}

function extractRecurrence(q: string): 'none' | 'monthly' | 'yearly' {
  if (/\b(every\s+month|monthly|recurring\s+monthly)\b/i.test(q)) return 'monthly';
  if (/\b(every\s+year|yearly|annual)\b/i.test(q)) return 'yearly';
  return 'none';
}

// ─── Goal name extraction ─────────────────────────────────────────────────────

function extractGoalName(q: string): string {
  const presets: [RegExp, string][] = [
    [/\bhouse|home\b/i, 'Buy House'],
    [/\bcar|vehicle\b/i, 'Buy Car'],
    [/\beducation|college\b/i, 'Education Fund'],
    [/\bwedding|marriage\b/i, 'Wedding Fund'],
    [/\bretirement\b/i, 'Retirement Fund'],
    [/\bvacation|travel|trip\b/i, 'Vacation Fund'],
    [/\bemergency\b/i, 'Emergency Fund'],
    [/\bbusiness\b/i, 'Business Fund'],
  ];
  for (const [re, name] of presets) if (re.test(q)) return name;
  const m = q.match(/goal\s+(?:for|to|named?|called?|of)\s+([a-z][a-z\s]{2,25})/i);
  if (m) return toTitleCase(m[1].trim());
  const m2 = q.match(/save\s+for\s+([a-z][a-z\s]{2,25})/i);
  if (m2) return toTitleCase(m2[1].trim());
  return 'Savings Goal';
}

// ─── Liability name extraction ────────────────────────────────────────────────

function extractLiabilityName(q: string): string {
  const presets: [RegExp, string][] = [
    [/\bhome\s*loan\b/i, 'Home Loan'],
    [/\bcar\s*loan|vehicle\s*loan\b/i, 'Car Loan'],
    [/\bpersonal\s*loan\b/i, 'Personal Loan'],
    [/\bcredit\s*card\b/i, 'Credit Card'],
    [/\beducation\s*loan\b/i, 'Education Loan'],
    [/\bbusiness\s*loan\b/i, 'Business Loan'],
    [/\bgold\s*loan\b/i, 'Gold Loan'],
  ];
  for (const [re, name] of presets) if (re.test(q)) return name;
  const m = q.match(/(?:add|record|create)\s+(?:a\s+)?(?:my\s+)?([a-z][a-z\s]{2,25})\s+(?:loan|debt|liability|credit)/i);
  if (m) return toTitleCase(m[1].trim()) + ' Loan';
  return 'Loan';
}

// ─── Investment extraction helpers ────────────────────────────────────────────

function extractStockSymbol(q: string): string | undefined {
  // "TCS", "RELIANCE", "HDFC" — all-caps word 2-12 chars
  const m = q.match(/\b([A-Z]{2,12})\b/);
  if (m && !['ADD','BUY','SELL','EMI','SIP','FD','AT','IN','OF','FOR','MY','THE','A'].includes(m[1])) {
    return m[1];
  }
  // "TCS stock", "RELIANCE shares"
  const m2 = q.match(/\b([a-zA-Z]{2,12})\s+(?:stock|share|equity)/i);
  if (m2) return m2[1].toUpperCase();
  return undefined;
}

function extractInvestmentType(q: string): AddInvestmentAction['investmentType'] {
  if (/\bstock|share|equity\b/i.test(q)) return 'stock';
  if (/\bmutual\s*fund|mf\b/i.test(q)) return 'mutual_fund';
  if (/\bfixed\s*deposit|fd\b/i.test(q)) return 'fixed_deposit';
  if (/\bbond\b/i.test(q)) return 'bond';
  if (/\bgold|silver|crypto|ppf|nps|epf|real\s*estate\b/i.test(q)) return 'other';
  return 'stock'; // default
}

function extractOtherAssetType(q: string): string {
  if (/\bgold\b/i.test(q)) return 'gold';
  if (/\bsilver\b/i.test(q)) return 'silver';
  if (/\bcrypto\b/i.test(q)) return 'crypto';
  if (/\breal\s*estate\b/i.test(q)) return 'real_estate';
  if (/\bppf\b/i.test(q)) return 'ppf';
  if (/\bnps\b/i.test(q)) return 'nps';
  if (/\bepf\b/i.test(q)) return 'epf';
  return 'other';
}

function extractQuantity(q: string): number | null {
  // "10 shares", "20 units", "5 qty", "bought 15"
  const m = q.match(/(\d+(?:\.\d+)?)\s*(?:shares?|units?|qty|quantity)/i);
  if (m) return parseFloat(m[1]);
  const m2 = q.match(/(?:bought|buy|purchased?|sold?|sell)\s+(\d+(?:\.\d+)?)/i);
  if (m2) return parseFloat(m2[1]);
  return null;
}

function extractInterestRate(q: string): number | null {
  const m = q.match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return parseFloat(m[1]);
  const m2 = q.match(/(?:at|@|interest\s+rate\s+(?:of|is)?)\s+(\d+(?:\.\d+)?)\s*(?:percent|pa|p\.a\.?)?/i);
  if (m2) return parseFloat(m2[1]);
  return null;
}

function extractDuration(q: string): number | null {
  const yearsMatch = q.match(/(\d+)\s*years?/i);
  if (yearsMatch) return parseInt(yearsMatch[1]) * 12;
  const monthsMatch = q.match(/(\d+)\s*months?/i);
  if (monthsMatch) return parseInt(monthsMatch[1]);
  return null;
}

// ─── Insurance extraction helpers ────────────────────────────────────────────

function extractInsuranceType(q: string): AddInsuranceAction['type'] {
  if (/\blife\b/i.test(q)) return 'life';
  if (/\bhealth|medical\b/i.test(q)) return 'health';
  if (/\bvehicle|car|bike|motor\b/i.test(q)) return 'vehicle';
  if (/\bproperty|home\s*insurance\b/i.test(q)) return 'property';
  return 'other';
}

function extractInsurancePremiumFreq(q: string): AddInsuranceAction['premiumFrequency'] {
  if (/\bmonthly\b/i.test(q)) return 'monthly';
  if (/\bquarterly\b/i.test(q)) return 'quarterly';
  if (/\bhalf.yearly|semi.annual\b/i.test(q)) return 'half-yearly';
  return 'yearly';
}

// ─── Generic name hint (for update/delete/search) ─────────────────────────────

function extractNameHint(q: string, module: string): string {
  // "delete my TCS stock" → "TCS"
  // "remove the home loan" → "home loan"
  // "update electricity bill" → "electricity"
  const stopWords = ['delete', 'remove', 'update', 'change', 'edit', 'find', 'search', 'my', 'the', 'a', 'an', module];
  const words = q
    .replace(/[₹,]/g, '')
    .split(/\s+/)
    .filter((w) => !stopWords.includes(w.toLowerCase()) && !/^\d+$/.test(w) && w.length > 1);
  return words.slice(0, 3).join(' ');
}

// ─── Payment title hint (for mark_paid / update / delete) ────────────────────

function extractPaymentTitleHint(q: string): string {
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
  for (const [re, hint] of presets) if (re.test(q)) return hint;
  const m = q.match(/\bmark\s+(?:my\s+)?(?:the\s+)?([a-z][a-z\s]{1,20})\s+(?:as\s+)?paid\b/i);
  if (m) return m[1].trim().toLowerCase();
  const m2 = q.match(/\b([a-z][a-z\s]{1,20})\s+(?:bill\s+)?paid\b/i);
  if (m2) return m2[1].trim().toLowerCase();
  return '';
}

// ─── Action type detector ─────────────────────────────────────────────────────

export function detectActionType(q: string): ActionType {
  const lower = q.toLowerCase();

  // ── Mark as paid (check before add) ─────────────────────────────────────
  if (/\bmark\b.*\bpaid\b|\bpaid\b.*\bmark\b|\bpayment\s+paid\b|\bpaid\s+today\b/i.test(lower) ||
      /\bmark\b.*\bas\s+paid\b/i.test(lower)) {
    return 'mark_payment_paid';
  }

  // ── DELETE ──────────────────────────────────────────────────────────────
  const isDelete = /\b(delete|remove|erase|clear)\b/i.test(lower);
  if (isDelete) {
    if (/\b(payment|bill|reminder)\b/i.test(lower)) return 'delete_payment';
    if (/\bgoal\b/i.test(lower)) return 'delete_goal';
    if (/\b(loan|liability|debt|emi|credit\s*card)\b/i.test(lower)) return 'delete_liability';
    if (/\b(stock|share|mutual\s*fund|investment|fd|fixed\s*deposit|bond)\b/i.test(lower)) return 'delete_investment';
    if (/\b(insurance|policy)\b/i.test(lower)) return 'delete_insurance';
    if (/\b(account|bank)\b/i.test(lower)) return 'delete_account';
    if (/\b(borrower|lending|lent|lend)\b/i.test(lower)) return 'delete_lending_borrower';
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────
  const isUpdate = /\b(update|change|edit|modify|set|increase|decrease|reduce)\b/i.test(lower);
  if (isUpdate) {
    if (/\b(payment|bill|reminder)\b/i.test(lower)) return 'update_payment';
    if (/\bgoal\b/i.test(lower)) return 'update_goal';
    if (/\b(loan|liability|debt|outstanding)\b/i.test(lower)) return 'update_liability';
    if (/\b(stock|share|mutual\s*fund|investment|price|nav|quantity)\b/i.test(lower)) return 'update_investment';
  }

  // ── SEARCH ──────────────────────────────────────────────────────────────
  if (/\b(find|search|look\s+for|show\s+me|list)\b/i.test(lower) &&
      !/\bmy\b/i.test(lower)) {
    return 'search_records';
  }

  // ── CREATE — investments ─────────────────────────────────────────────────
  if (/\b(add|buy|bought|purchased?|record|log|entered?)\b/i.test(lower) &&
      /\b(stock|share|equity|mutual\s*fund|mf|fd|fixed\s*deposit|bond|gold|ppf|nps|epf)\b/i.test(lower)) {
    return 'add_investment';
  }

  // ── CREATE — insurance ───────────────────────────────────────────────────
  if (/\b(add|create|record|entered?)\b/i.test(lower) &&
      /\b(insurance|policy|lic|term\s*plan|health\s*policy)\b/i.test(lower)) {
    return 'add_insurance';
  }

  // ── CREATE — account ─────────────────────────────────────────────────────
  if (/\b(add|create|register)\b/i.test(lower) &&
      /\b(account|bank\s+account|credit\s+card\s+account|savings\s+account)\b/i.test(lower)) {
    return 'add_account';
  }

  // ── CREATE — lending ─────────────────────────────────────────────────────
  if (/\b(lent|lend|gave|loaned)\b/i.test(lower) ||
      (/\b(add|record)\b/i.test(lower) && /\b(borrower|lending|lend)\b/i.test(lower))) {
    return 'add_lending_transaction';
  }
  if (/\b(add|create)\b/i.test(lower) && /\bborrower\b/i.test(lower)) {
    return 'add_lending_borrower';
  }

  // ── CREATE — income ──────────────────────────────────────────────────────
  if (/\b(add|record|log|enter|received?|got)\b.{0,40}\b(income|salary|earning|revenue|money\s+in|cash\s+in)\b/i.test(lower) ||
      /\b(salary|income|earning)\b.{0,30}\b(add|record|log|of|is|was)\b/i.test(lower) ||
      /\b(received|got)\b.{0,30}₹/i.test(lower) ||
      /\bas\s+(an?\s+)?income\b/i.test(lower)) {
    return 'add_cashflow_income';
  }

  // ── CREATE — expense ─────────────────────────────────────────────────────
  if (/\b(add|record|log|enter|spent|paid\s+for|bought)\b.{0,40}\b(expense|spending|cost|purchase)\b/i.test(lower) ||
      /\b(spent|paid|buy|bought)\b.{0,30}(?:₹|\d)/i.test(lower) ||
      /\bas\s+(an?\s+)?expense\b/i.test(lower) ||
      /\bexpense\b.{0,20}\b(add|record|log|of|is|was)\b/i.test(lower)) {
    return 'add_cashflow_expense';
  }

  // ── CREATE — payment reminder ────────────────────────────────────────────
  if (/\b(add|create|set|remind|record)\b.{0,40}\b(payment|reminder|bill|due|emi)\b/i.test(lower) ||
      /\bremind\s+me\s+to\s+pay\b/i.test(lower)) {
    return 'add_payment';
  }

  // ── CREATE — goal ────────────────────────────────────────────────────────
  if (/\b(add|create|set|make|start)\b.{0,40}\b(goal|target|saving\s*goal|financial\s*goal)\b/i.test(lower) ||
      /\bsave\s+for\b/i.test(lower)) {
    return 'add_goal';
  }

  // ── CREATE — liability ───────────────────────────────────────────────────
  if (/\b(add|record|enter|create)\b.{0,40}\b(loan|debt|liability|credit\s*card\s*bill)\b/i.test(lower)) {
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
      return { action: null, summary: '', assumptions: [], incomplete: true,
        missingPrompt: 'Which payment would you like to mark as paid? (e.g. "Mark rent as paid")' };
    }
    return {
      action: { kind: 'mark_payment_paid', titleHint: hint },
      summary: `Mark "${toTitleCase(hint)}" as paid`,
      assumptions: [],
      incomplete: false,
    };
  }

  // ── DELETE actions ─────────────────────────────────────────────────────────
  if (type.startsWith('delete_')) {
    const module = type.replace('delete_', '');
    const hint = extractNameHint(q, module);
    if (!hint) {
      return { action: null, summary: '', assumptions: [], incomplete: true,
        missingPrompt: `Which ${module} would you like to delete? Please name it.` };
    }
    return {
      action: { kind: type as DeleteAction['kind'], nameHint: hint },
      summary: `Delete ${module.replace(/_/g, ' ')} matching "${hint}"`,
      assumptions: ['⚠️ This action is permanent and cannot be undone'],
      incomplete: false,
    };
  }

  // ── UPDATE — payment ───────────────────────────────────────────────────────
  if (type === 'update_payment') {
    const hint = extractPaymentTitleHint(q) || extractNameHint(q, 'payment');
    const patch: UpdatePaymentAction['patch'] = {};
    const amount = extractAmount(q);
    const date   = q.match(/\bto\b.*\b(\d{4}-\d{2}-\d{2}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2})\b/i) ? extractDate(q) : undefined;
    if (amount) patch.amount = amount;
    if (date && date !== new Date().toISOString().slice(0,10)) patch.dueDate = date;
    const newTitle = q.match(/(?:rename|change.*name|name.*to)\s+([a-z][a-z\s]{2,30})/i)?.[1];
    if (newTitle) patch.title = toTitleCase(newTitle.trim());
    if (!hint) return { action: null, summary: '', assumptions: [], incomplete: true,
      missingPrompt: 'Which payment would you like to update? (e.g. "Update electricity bill to ₹3000")' };
    return {
      action: { kind: 'update_payment', titleHint: hint, patch },
      summary: `Update "${toTitleCase(hint)}" payment${amount ? ` to ₹${amount.toLocaleString('en-IN')}` : ''}`,
      assumptions: Object.keys(patch).length === 0 ? ['No changes detected — please specify what to change'] : [],
      incomplete: false,
    };
  }

  // ── UPDATE — goal ──────────────────────────────────────────────────────────
  if (type === 'update_goal') {
    const hint = extractGoalName(q) !== 'Savings Goal' ? extractGoalName(q) : extractNameHint(q, 'goal');
    const patch: UpdateGoalAction['patch'] = {};
    const amount = extractAmount(q);
    if (amount) patch.targetAmount = amount;
    return {
      action: { kind: 'update_goal', nameHint: hint, patch },
      summary: `Update goal "${hint}"${amount ? ` target to ₹${amount.toLocaleString('en-IN')}` : ''}`,
      assumptions: [],
      incomplete: false,
    };
  }

  // ── UPDATE — liability ─────────────────────────────────────────────────────
  if (type === 'update_liability') {
    const hint = extractLiabilityName(q) !== 'Loan' ? extractLiabilityName(q) : extractNameHint(q, 'liability');
    const patch: UpdateLiabilityAction['patch'] = {};
    const amount = extractAmount(q);
    const rate   = extractInterestRate(q);
    if (amount) {
      if (/\bemi\b/i.test(q)) patch.emiAmount = amount;
      else patch.outstanding = amount;
    }
    if (rate) patch.interestRate = rate;
    if (/\bpaid\s+off|closed|settled\b/i.test(q)) patch.status = 'paid';
    return {
      action: { kind: 'update_liability', nameHint: hint, patch },
      summary: `Update liability "${hint}"`,
      assumptions: [],
      incomplete: false,
    };
  }

  // ── UPDATE — investment ────────────────────────────────────────────────────
  if (type === 'update_investment') {
    const symbol = extractStockSymbol(q);
    const hint   = symbol || extractNameHint(q, 'investment');
    const patch: UpdateInvestmentAction['patch'] = {};
    const amount = extractAmount(q);
    const qty    = extractQuantity(q);
    if (amount) {
      if (/\bnav\b/i.test(q)) patch.nav = amount;
      else patch.currentPrice = amount;
    }
    if (qty) {
      if (/\bunit\b/i.test(q)) patch.units = qty;
      else patch.quantity = qty;
    }
    if (!hint) return { action: null, summary: '', assumptions: [], incomplete: true,
      missingPrompt: 'Which investment would you like to update? (e.g. "Update TCS price to ₹3500")' };
    return {
      action: { kind: 'update_investment', nameHint: hint, patch },
      summary: `Update investment "${hint}"${amount ? ` price to ₹${amount.toLocaleString('en-IN')}` : ''}`,
      assumptions: [],
      incomplete: false,
    };
  }

  // ── ADD — cashflow ─────────────────────────────────────────────────────────
  if (type === 'add_cashflow_income' || type === 'add_cashflow_expense') {
    const cfType = type === 'add_cashflow_income' ? 'income' : 'expense';
    const amount = extractAmount(q);
    if (!amount) return { action: null, summary: '', assumptions: [], incomplete: true,
      missingPrompt: `How much? (e.g. "Add ₹5000 salary income")` };
    const category = extractCategory(q, cfType);
    const date     = extractDate(q);
    if (date === new Date().toISOString().slice(0,10))
      assumptions.push('Date assumed as today');
    return {
      action: { kind: type, amount, category, date },
      summary: `Add ${cfType} of ₹${amount.toLocaleString('en-IN')} · ${category} · ${date}`,
      assumptions,
      incomplete: false,
    };
  }

  // ── ADD — payment ──────────────────────────────────────────────────────────
  if (type === 'add_payment') {
    const amount = extractAmount(q);
    if (!amount) return { action: null, summary: '', assumptions: [], incomplete: true,
      missingPrompt: 'How much is the payment? (e.g. "Add ₹2500 electricity bill for September 15")' };
    const title      = extractPaymentTitle(q);
    const dueDate    = extractDate(q);
    const payType    = extractPaymentType(q);
    const recurrence = extractRecurrence(q);
    if (dueDate === new Date().toISOString().slice(0,10))
      assumptions.push('Due date assumed as today');
    if (recurrence !== 'none')
      assumptions.push(`Recurrence set to ${recurrence}`);
    return {
      action: { kind: 'add_payment', title, amount, dueDate, paymentType: payType, recurrence },
      summary: `Add payment: "${title}" — ₹${amount.toLocaleString('en-IN')} due ${dueDate}`,
      assumptions,
      incomplete: false,
    };
  }

  // ── ADD — goal ─────────────────────────────────────────────────────────────
  if (type === 'add_goal') {
    const targetAmount = extractAmount(q);
    if (!targetAmount) return { action: null, summary: '', assumptions: [], incomplete: true,
      missingPrompt: 'What is the target amount for this goal? (e.g. "Create a goal for ₹5 lakh")' };
    const name    = extractGoalName(q);
    const dueDate = (() => {
      const d = extractDate(q);
      return d === new Date().toISOString().slice(0,10) ? undefined : d;
    })();
    if (!dueDate) assumptions.push('No deadline set');
    return {
      action: { kind: 'add_goal', name, targetAmount, ...(dueDate ? { dueDate } : {}) },
      summary: `Create goal "${name}" — target ₹${targetAmount.toLocaleString('en-IN')}${dueDate ? ` by ${dueDate}` : ''}`,
      assumptions,
      incomplete: false,
    };
  }

  // ── ADD — liability ────────────────────────────────────────────────────────
  if (type === 'add_liability') {
    const principal = extractAmount(q);
    if (!principal) return { action: null, summary: '', assumptions: [], incomplete: true,
      missingPrompt: 'What is the loan amount? (e.g. "Add home loan of ₹20 lakh")' };
    const name         = extractLiabilityName(q);
    const interestRate = extractInterestRate(q);
    const emiAmount    = extractSecondAmount(q);
    const liabType = /\bcredit\s*card\b/i.test(q) ? 'credit_card'
      : /\bloan|debt\b/i.test(q) ? 'loan' : 'other';
    if (!interestRate) assumptions.push('Interest rate not specified');
    return {
      action: {
        kind: 'add_liability',
        name, principal, outstanding: principal, type: liabType,
        ...(interestRate !== null ? { interestRate } : {}),
        ...(emiAmount    !== null ? { emiAmount } : {}),
      },
      summary: `Add liability "${name}" — ₹${principal.toLocaleString('en-IN')}${interestRate ? ` @ ${interestRate}%` : ''}`,
      assumptions,
      incomplete: false,
    };
  }

  // ── ADD — investment ───────────────────────────────────────────────────────
  if (type === 'add_investment') {
    const invType = extractInvestmentType(q);

    if (invType === 'stock') {
      const qty      = extractQuantity(q);
      const buyPrice = extractAmount(q);
      const symbol   = extractStockSymbol(q);
      const name     = symbol || extractNameHint(q, 'stock');
      if (!qty)      return { action: null, summary: '', assumptions: [], incomplete: true,
        missingPrompt: 'How many shares did you buy? (e.g. "I bought 10 TCS shares at ₹3200")' };
      if (!buyPrice) return { action: null, summary: '', assumptions: [], incomplete: true,
        missingPrompt: 'What was the buy price per share?' };
      assumptions.push('Current price set same as buy price — update it later');
      return {
        action: { kind: 'add_investment', investmentType: 'stock', name, symbol,
          quantity: qty, buyPrice, currentPrice: buyPrice },
        summary: `Add stock ${name}: ${qty} shares @ ₹${buyPrice.toLocaleString('en-IN')} (total ₹${(qty*buyPrice).toLocaleString('en-IN')})`,
        assumptions,
        incomplete: false,
      };
    }

    if (invType === 'mutual_fund') {
      const investedAmount = extractAmount(q);
      const nav            = extractSecondAmount(q);
      const name           = extractNameHint(q, 'mutual fund') || 'Mutual Fund';
      if (!investedAmount) return { action: null, summary: '', assumptions: [], incomplete: true,
        missingPrompt: 'What amount did you invest in the mutual fund?' };
      const units = nav && nav > 0 ? investedAmount / nav : undefined;
      if (!nav) assumptions.push('NAV not specified — set it manually later');
      return {
        action: { kind: 'add_investment', investmentType: 'mutual_fund', name,
          investedAmount, ...(nav ? { nav } : {}), ...(units ? { units } : {}) },
        summary: `Add mutual fund "${name}" — ₹${investedAmount.toLocaleString('en-IN')}${nav ? ` @ NAV ₹${nav}` : ''}`,
        assumptions,
        incomplete: false,
      };
    }

    if (invType === 'fixed_deposit') {
      const investedAmount = extractAmount(q);
      const interestRate   = extractInterestRate(q);
      const bankName       = extractNameHint(q, 'fd') || 'Bank';
      const durationMonths = extractDuration(q);
      if (!investedAmount) return { action: null, summary: '', assumptions: [], incomplete: true,
        missingPrompt: 'What is the FD amount? (e.g. "Add FD of ₹1 lakh at 7% for 12 months")' };
      if (!interestRate) assumptions.push('Interest rate not specified');
      if (!durationMonths) assumptions.push('Duration not specified');
      const today = new Date().toISOString().slice(0,10);
      return {
        action: { kind: 'add_investment', investmentType: 'fixed_deposit', name: `${bankName} FD`,
          bankName, investedAmount,
          ...(interestRate    ? { interestRate }    : {}),
          ...(durationMonths  ? { durationMonths }  : {}),
          startDate: today,
        },
        summary: `Add FD at ${bankName} — ₹${investedAmount.toLocaleString('en-IN')}${interestRate ? ` @ ${interestRate}%` : ''}${durationMonths ? ` for ${durationMonths} months` : ''}`,
        assumptions,
        incomplete: false,
      };
    }

    if (invType === 'other') {
      const investedAmount = extractAmount(q);
      const assetType      = extractOtherAssetType(q);
      const name           = toTitleCase(assetType) + ' Investment';
      if (!investedAmount) return { action: null, summary: '', assumptions: [], incomplete: true,
        missingPrompt: 'How much did you invest? (e.g. "Add gold investment of ₹50,000")' };
      return {
        action: { kind: 'add_investment', investmentType: 'other', name, assetType, investedAmount, currentValue: investedAmount },
        summary: `Add ${assetType} investment — ₹${investedAmount.toLocaleString('en-IN')}`,
        assumptions: ['Current value set same as invested amount — update it later'],
        incomplete: false,
      };
    }

    // bond
    const investedAmount = extractAmount(q);
    if (!investedAmount) return { action: null, summary: '', assumptions: [], incomplete: true,
      missingPrompt: 'What is the bond amount?' };
    const interestRate   = extractInterestRate(q);
    const durationMonths = extractDuration(q);
    const name           = extractNameHint(q, 'bond') || 'Bond';
    return {
      action: { kind: 'add_investment', investmentType: 'bond', name, investedAmount,
        ...(interestRate   ? { interestRate }   : {}),
        ...(durationMonths ? { durationMonths } : {}),
        startDate: new Date().toISOString().slice(0,10),
      },
      summary: `Add bond "${name}" — ₹${investedAmount.toLocaleString('en-IN')}`,
      assumptions,
      incomplete: false,
    };
  }

  // ── ADD — insurance ────────────────────────────────────────────────────────
  if (type === 'add_insurance') {
    const premium = extractAmount(q);
    if (!premium) return { action: null, summary: '', assumptions: [], incomplete: true,
      missingPrompt: 'What is the premium amount? (e.g. "Add LIC life insurance ₹25000 per year")' };
    const coverage  = extractSecondAmount(q);
    const insType   = extractInsuranceType(q);
    const freq      = extractInsurancePremiumFreq(q);
    const provider  = extractNameHint(q, 'insurance') || 'Insurance Company';
    const policyName = `${toTitleCase(insType)} Insurance`;
    const renewalDate = extractDate(q);
    if (!coverage) assumptions.push('Coverage amount not specified — set it manually');
    return {
      action: {
        kind: 'add_insurance', policyName, provider: toTitleCase(provider),
        type: insType, premiumAmount: premium, premiumFrequency: freq,
        coverageAmount: coverage ?? 0, renewalDate,
      },
      summary: `Add ${insType} insurance — premium ₹${premium.toLocaleString('en-IN')} ${freq}${coverage ? ` · coverage ₹${coverage.toLocaleString('en-IN')}` : ''}`,
      assumptions,
      incomplete: false,
    };
  }

  // ── ADD — account ──────────────────────────────────────────────────────────
  if (type === 'add_account') {
    const balance = extractAmount(q) ?? 0;
    const name    = extractNameHint(q, 'account') || 'Bank Account';
    const accType: 'bank' | 'credit' = /\bcredit\b/i.test(q) ? 'credit' : 'bank';
    if (!balance) assumptions.push('Opening balance assumed as ₹0');
    return {
      action: {
        kind: 'add_account', name: toTitleCase(name), type: accType,
        balance, openingBalance: balance,
        openingBalanceDate: new Date().toISOString().slice(0,10),
      },
      summary: `Add ${accType} account "${toTitleCase(name)}" — balance ₹${balance.toLocaleString('en-IN')}`,
      assumptions,
      incomplete: false,
    };
  }

  // ── ADD — lending borrower ─────────────────────────────────────────────────
  if (type === 'add_lending_borrower') {
    const name = extractNameHint(q, 'borrower');
    if (!name) return { action: null, summary: '', assumptions: [], incomplete: true,
      missingPrompt: "What is the borrower's name?" };
    const interestRate = extractInterestRate(q);
    return {
      action: { kind: 'add_lending_borrower', name: toTitleCase(name),
        ...(interestRate ? { interestRate } : {}) },
      summary: `Add borrower "${toTitleCase(name)}"${interestRate ? ` at ${interestRate}% interest` : ''}`,
      assumptions: [],
      incomplete: false,
    };
  }

  // ── ADD — lending transaction ──────────────────────────────────────────────
  if (type === 'add_lending_transaction') {
    const amount = extractAmount(q);
    if (!amount) return { action: null, summary: '', assumptions: [], incomplete: true,
      missingPrompt: 'How much did you lend? (e.g. "I lent ₹10000 to Ramesh")' };
    const borrowerName = extractNameHint(q, 'lent') || 'borrower';
    const txType: AddLendingTransactionAction['txType'] =
      /\binterest\b/i.test(q) ? 'interest_paid'
      : /\brepaid|returned|back\b/i.test(q) ? 'principal_returned'
      : 'principal_given';
    const date = extractDate(q);
    return {
      action: { kind: 'add_lending_transaction', borrowerNameHint: borrowerName,
        txType, amount, date },
      summary: `Record lending: ₹${amount.toLocaleString('en-IN')} ${txType.replace(/_/g,' ')} — ${toTitleCase(borrowerName)}`,
      assumptions: [],
      incomplete: false,
    };
  }

  // ── SEARCH ─────────────────────────────────────────────────────────────────
  if (type === 'search_records') {
    const module = /\b(payment|goal|loan|investment|insurance|account|borrower)\b/i.exec(q)?.[1] ?? 'records';
    return {
      action: { kind: 'search_records', module, query: q },
      summary: `Search ${module}: "${q}"`,
      assumptions: [],
      incomplete: false,
    };
  }

  return { action: null, summary: '', assumptions: [], incomplete: false };
}
