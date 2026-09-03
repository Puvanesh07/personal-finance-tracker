/**
 * src/utils/smartCategorize.ts
 *
 * Smart Transaction Categorization — Feature 11.
 * Maps merchant names, keywords and patterns to FinTrackly categories.
 * Used by: AI Quick Add (parse free text → structured entry),
 *          UpsertCashflowModal (suggest category from notes),
 *          Duplicate Detection context.
 */

interface CategoryRule {
  pattern: RegExp;
  category: string;
  type: 'expense' | 'income' | 'both';
}

const RULES: CategoryRule[] = [
  // ── Food & Dining ────────────────────────────────────────────────────────
  { pattern: /swiggy|zomato|uber\s*eat|food|restaurant|dhaba|hotel|dinner|lunch|breakfast|snack|chai|coffee|starbucks|mcdonalds|kfc|domino|pizza|biryani|thali/i, category: 'Food & Dining', type: 'expense' },
  { pattern: /groceries?|bigbasket|blinkit|zepto|dunzo|vegetable|sabzi|kirana|supermarket|dmart|reliance\s*fresh|milk|bread/i, category: 'Groceries', type: 'expense' },

  // ── Transport ────────────────────────────────────────────────────────────
  { pattern: /uber|ola|rapido|cab|auto|taxi|metro|bus|train|irctc|flight|indigo|spicejet|air\s*india|petrol|fuel|diesel|cng|parking/i, category: 'Transport', type: 'expense' },
  { pattern: /petrol|fuel|diesel|cng|hp|ioc|bharat|pump/i, category: 'Petrol', type: 'expense' },

  // ── Shopping ─────────────────────────────────────────────────────────────
  { pattern: /amazon|flipkart|myntra|ajio|meesho|nykaa|tata\s*cliq|snapdeal|shopping|purchase|buy|order|delivery|clothes|shirt|dress|shoes/i, category: 'Shopping', type: 'expense' },

  // ── Entertainment ────────────────────────────────────────────────────────
  { pattern: /netflix|amazon\s*prime|hotstar|disney|sony\s*liv|zee5|jio\s*cinema|youtube\s*premium|spotify|gaana|wynk|movie|cinema|pvr|inox|multiplex|ticket|game|steam/i, category: 'Entertainment', type: 'expense' },
  { pattern: /subscription|ott|streaming/i, category: 'Subscriptions', type: 'expense' },

  // ── Utilities ────────────────────────────────────────────────────────────
  { pattern: /electricity|electric\s*bill|power\s*bill|mseb|bescom|tneb|bescom|torrent\s*power|water\s*bill|gas\s*bill|lpg|indane|hp\s*gas|cylinder/i, category: 'Utilities', type: 'expense' },
  { pattern: /internet|broadband|wifi|airtel|jio|bsnl|act|tata\s*sky|d2h/i, category: 'Utilities', type: 'expense' },
  { pattern: /mobile|phone\s*bill|recharge|prepaid|postpaid/i, category: 'Utilities', type: 'expense' },

  // ── Healthcare ───────────────────────────────────────────────────────────
  { pattern: /hospital|doctor|clinic|medicine|pharmacy|pharma|1mg|netmedi|apollo|fortis|medplus|medical|health|dental|test\s*report|blood\s*test|scan/i, category: 'Healthcare', type: 'expense' },

  // ── Education ────────────────────────────────────────────────────────────
  { pattern: /school|college|university|fees|tuition|coaching|udemy|coursera|unacademy|byju|vedantu|books?|stationery/i, category: 'Education', type: 'expense' },

  // ── Housing & Rent ───────────────────────────────────────────────────────
  { pattern: /rent|house\s*rent|flat\s*rent|pg\s*rent|maintenance|society|hoa/i, category: 'Housing & Rent', type: 'expense' },

  // ── EMI & Loans ──────────────────────────────────────────────────────────
  { pattern: /emi|loan|home\s*loan|car\s*loan|personal\s*loan|credit\s*card\s*payment|emi\s*payment/i, category: 'EMI & Loans', type: 'expense' },

  // ── Insurance ────────────────────────────────────────────────────────────
  { pattern: /insurance|lic|hdfc\s*life|icici\s*pru|tata\s*aia|bajaj\s*allianz|star\s*health|niva|premium\s*paid/i, category: 'Insurance', type: 'expense' },

  // ── Investment ───────────────────────────────────────────────────────────
  { pattern: /sip|mutual\s*fund|mf|zerodha|groww|upstox|kite|invest|stock|share|nifty|sensex|ipo|demat/i, category: 'Investment', type: 'expense' },

  // ── Travel ───────────────────────────────────────────────────────────────
  { pattern: /hotel|oyo|makemytrip|goibibo|cleartrip|booking\.com|airbnb|trip|vacation|tour|holiday/i, category: 'Travel & Vacations', type: 'expense' },

  // ── Personal Care ────────────────────────────────────────────────────────
  { pattern: /salon|haircut|spa|gym|fitness|yoga|parlour|beauty|cosmetic|skincare|loreal|himalaya|lakme/i, category: 'Personal Care', type: 'expense' },

  // ── Transfers ────────────────────────────────────────────────────────────
  { pattern: /transfer|upi|neft|rtgs|imps|phonepe|gpay|paytm|wallet|send\s*money/i, category: 'Transfers & Remittance', type: 'both' },

  // ── Credit Card ──────────────────────────────────────────────────────────
  { pattern: /credit\s*card|cc\s*bill|hdfc\s*card|axis\s*card|sbi\s*card|icici\s*card|amex|visa|mastercard/i, category: 'Credit Card Payment', type: 'expense' },

  // ── Tax & Government ─────────────────────────────────────────────────────
  { pattern: /tax|income\s*tax|gst|tds|challan|itr|govt|government|municipality|property\s*tax/i, category: 'Taxes', type: 'expense' },

  // ── Income types ─────────────────────────────────────────────────────────
  { pattern: /salary|ctc|payroll|wages|stipend/i, category: 'Salary', type: 'income' },
  { pattern: /freelance|client\s*payment|invoice|consulting|project\s*payment/i, category: 'Freelance', type: 'income' },
  { pattern: /dividend|div\s*credit|nsdl\s*dividend/i, category: 'Dividend', type: 'income' },
  { pattern: /interest|fd\s*interest|savings\s*interest|rd\s*interest/i, category: 'Interest', type: 'income' },
  { pattern: /rent\s*received|rental\s*income|tenant|rental/i, category: 'Rental Income', type: 'income' },
  { pattern: /bonus|performance\s*bonus|annual\s*bonus/i, category: 'Bonus', type: 'income' },
  { pattern: /refund|cashback|reward\s*point|referral\s*bonus/i, category: 'Refund', type: 'income' },
  { pattern: /business\s*income|revenue|sales|profit\s*transfer/i, category: 'Business', type: 'income' },
  { pattern: /gift|shagun|wedding\s*gift/i, category: 'Gift', type: 'income' },
  { pattern: /capital\s*gain|stock\s*sale|mf\s*redemption|redemption/i, category: 'Capital Gains', type: 'income' },
];

export interface CategorizeResult {
  category: string;
  type: 'expense' | 'income';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Categorize a transaction description / merchant name.
 * Returns the best matching category + type.
 */
export function smartCategorize(
  description: string,
  amountHint?: number,
): CategorizeResult {
  const text = description.trim();

  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      const type: 'expense' | 'income' =
        rule.type === 'both'
          ? (amountHint && amountHint > 10_000 ? 'income' : 'expense')
          : rule.type;
      return { category: rule.category, type, confidence: 'high' };
    }
  }

  // Fallback: guess type from amount
  const guessedType: 'expense' | 'income' =
    amountHint && amountHint > 20_000 ? 'income' : 'expense';
  return {
    category: guessedType === 'income' ? 'Other Income' : 'Other Expense',
    type: guessedType,
    confidence: 'low',
  };
}

// ── Natural language amount + date parser (for AI Quick Add) ─────────────────

export interface ParsedTransaction {
  amount: number | null;
  description: string;
  category: string;
  type: 'expense' | 'income';
  date: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
}

export function parseNaturalLanguageTransaction(text: string): ParsedTransaction {
  const lower  = text.trim();
  const today2 = new Date().toISOString().slice(0, 10);

  // ── Amount extraction ────────────────────────────────────────────────────
  let amount: number | null = null;
  const lakhM  = lower.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/i);
  const croreM = lower.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*crore/i);
  const kM     = lower.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*k\b/i);
  const inrM   = lower.match(/(?:₹|rs\.?\s*)(\d[\d,]*(?:\.\d{1,2})?)/i);
  const bareM  = lower.match(/\b(\d{3,}(?:,\d{3})*(?:\.\d{1,2})?)\b/);

  if (lakhM)       amount = parseFloat(lakhM[1])  * 1_00_000;
  else if (croreM) amount = parseFloat(croreM[1]) * 1_00_00_000;
  else if (kM)     amount = parseFloat(kM[1])     * 1_000;
  else if (inrM)   amount = parseFloat(inrM[1].replace(/,/g, ''));
  else if (bareM)  amount = parseFloat(bareM[1].replace(/,/g, ''));

  // ── Date extraction ──────────────────────────────────────────────────────
  let date = today2;
  if (/\byesterday\b/i.test(lower)) {
    const d = new Date(); d.setDate(d.getDate() - 1);
    date = d.toISOString().slice(0, 10);
  } else if (/\blast\s+week\b/i.test(lower)) {
    const d = new Date(); d.setDate(d.getDate() - 7);
    date = d.toISOString().slice(0, 10);
  }
  const isoM = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoM) date = isoM[1];

  // ── Type detection ───────────────────────────────────────────────────────
  const isIncome =
    /\b(received|got|earned|salary|income|credited|deposited|transferred\s*to\s*me|refund)\b/i.test(lower) ||
    /\bas\s+income\b/i.test(lower);
  const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';
  void isIncome;

  // ── Description extraction (remove amount/date words) ───────────────────
  let description = text
    .replace(/(?:₹|rs\.?\s*)\d[\d,.]*/gi, '')
    .replace(/\d+(?:\.\d+)?\s*(?:lakh|lac|l\b|crore|k\b)/gi, '')
    .replace(/\b(spent|paid|bought|received|got|earned|on|for|as)\b/gi, '')
    .replace(/\b(yesterday|today|last\s+week)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!description) description = 'Transaction';

  // ── Smart categorization ─────────────────────────────────────────────────
  const catResult = smartCategorize(description + ' ' + lower, amount ?? undefined);

  // Override type if categorizer is more confident
  const finalType = catResult.type === type || catResult.confidence === 'low' ? type : catResult.type;

  return {
    amount,
    description,
    category:   catResult.category,
    type:       finalType,
    date,
    notes:      text,
    confidence: amount ? catResult.confidence : 'low',
  };
}
