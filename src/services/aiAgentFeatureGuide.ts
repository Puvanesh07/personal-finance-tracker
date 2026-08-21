/**
 * src/services/aiAgentFeatureGuide.ts
 *
 * Answers "how do I…" / "where do I…" / "what is the … feature" questions
 * about FinTrackly itself — instantly, with zero Groq calls.
 *
 * Each guide entry has:
 *  - keywords: matched against the lowercased question
 *  - answer:   markdown explaining how to use the feature in FinTrackly
 */

export interface FeatureGuide {
  keywords: string[];
  answer: string;
}

// ─── Guide entries (one per FinTrackly feature area) ─────────────────────────

const GUIDES: FeatureGuide[] = [
  // ── Payments ──────────────────────────────────────────────────────────────
  {
    keywords: ['add payment', 'create payment', 'new payment', 'set up payment',
               'add a payment', 'add tracked payment', 'add bill', 'add reminder',
               'how to pay', 'record payment', 'log payment'],
    answer: `## 🔔 How to Add a Payment in FinTrackly

Go to **Sidebar → Payments**.

### Adding a tracked payment (upcoming bill / EMI reminder)
1. Tap **+ Add Payment** (top-right button).
2. Fill in:
   - **Title** — e.g. "Electricity Bill"
   - **Amount** — the expected payment amount
   - **Due Date** — when it needs to be paid
   - **Payment Type** — EMI / Insurance / Rent / Credit Card / Custom etc.
   - **Recurrence** — None / Monthly / Yearly
   - **Reminder Days** — how many days before due date to get notified
3. Tap **Save**.

### Marking a payment as paid
- Open the Payments list, find the payment, and tap **Mark as Paid**.
- The payment moves to your paid history and (if recurring) auto-schedules the next due date.

### Tips
- Use **Monthly** recurrence for EMIs, subscriptions, and rent.
- Set **Reminder Days = 3** to get a 3-day heads-up before each due date.
- Overdue payments are highlighted in red — check the Payments page regularly.`,
  },

  // ── Investments ───────────────────────────────────────────────────────────
  {
    keywords: ['add investment', 'add stock', 'add mutual fund', 'add mf',
               'add sip', 'add fd', 'add fixed deposit', 'add bond',
               'record investment', 'new investment', 'create investment',
               'how to add stock', 'how to add fund', 'log investment'],
    answer: `## 📈 How to Add an Investment in FinTrackly

Go to **Sidebar → Investments**.

### Adding a stock
1. Tap **+ Add** → select **Stock**.
2. Enter: Name / Symbol, Quantity, Buy Price, Current Price, Platform, Sector.
3. Tap **Save**.

### Adding a Mutual Fund
1. Tap **+ Add** → select **Mutual Fund**.
2. Enter: Fund Name, Units, NAV (current), Invested Amount.
3. Tap **Save**.

### Adding a Fixed Deposit / Bond
1. Tap **+ Add** → select **Fixed Deposit** or **Bond**.
2. Enter: Bank Name, Amount, Interest Rate, Start & Maturity Dates.

### Adding Gold, Crypto, Real Estate, PPF, NPS
1. Tap **+ Add** → select **Other Asset**.
2. Choose Asset Type, enter Invested Amount and Current Value.

### Tips
- Use **Import** (top toolbar) to bulk-upload investments from a CSV.
- Update current prices regularly so P&L stays accurate.
- Add **lots** to a stock to track multiple buy dates at different prices.`,
  },

  // ── Cashflow ──────────────────────────────────────────────────────────────
  {
    keywords: ['add cashflow', 'add cash flow', 'add income', 'add expense',
               'record income', 'record expense', 'log income', 'log expense',
               'how to add income', 'how to add expense', 'new cashflow entry',
               'add transaction', 'log transaction', 'record transaction'],
    answer: `## 💸 How to Add a Cashflow Entry in FinTrackly

Go to **Sidebar → Cashflow**.

### Adding Income
1. Tap **+ Add Entry**.
2. Set **Type = Income**.
3. Fill in: Amount, Category (Salary / Business / Dividend etc.), Date, Notes (optional).
4. Tap **Save**.

### Adding an Expense
1. Tap **+ Add Entry**.
2. Set **Type = Expense**.
3. Fill in: Amount, Category (Food / Transport / Rent / EMI etc.), Date, Notes.
4. Tap **Save**.

### Tips
- Use the **Date** field to enter past entries — not just today.
- Consistent categories make the spending breakdown more useful.
- Link entries to an **Account** to keep your account balances accurate.`,
  },

  // ── Goals ─────────────────────────────────────────────────────────────────
  {
    keywords: ['add goal', 'create goal', 'set goal', 'new goal',
               'add financial goal', 'set financial goal', 'how to add goal',
               'record goal', 'set a goal'],
    answer: `## 🎯 How to Add a Financial Goal in FinTrackly

Go to **Sidebar → Goals**.

1. Tap **+ Add Goal**.
2. Fill in:
   - **Goal Name** — e.g. "Emergency Fund" or "New Car"
   - **Target Amount** — the total amount you want to reach
   - **Current Amount** — how much you've already saved (can be 0)
   - **Due Date** (optional) — your target deadline
3. Tap **Save**.

### Adding a contribution later
- Open the goal → tap **+ Add Contribution** → enter the amount and date.
- FinTrackly tracks your progress and shows how much is still remaining.

### Tips
- Set a **Due Date** so the AI Agent can tell you if you're on track.
- Use the Goals page to see all goals ranked by completion percentage.`,
  },

  // ── Liabilities ───────────────────────────────────────────────────────────
  {
    keywords: ['add liability', 'add loan', 'add debt', 'add emi',
               'record loan', 'create liability', 'new loan',
               'how to add loan', 'how to add liability', 'log debt'],
    answer: `## 💳 How to Add a Liability in FinTrackly

Go to **Sidebar → Liabilities**.

1. Tap **+ Add Liability**.
2. Fill in:
   - **Name** — e.g. "Home Loan" or "Car Loan"
   - **Type** — Loan / Credit Card / Other
   - **Principal** — original loan amount
   - **Outstanding** — current amount still owed
   - **Interest Rate** — annual rate (%)
   - **EMI Amount** — your monthly payment
   - **EMI Day** — day of month when EMI is due
   - **Start / End Date** (optional)
3. Tap **Save**.

### Tips
- Update **Outstanding** periodically as you repay to keep net worth accurate.
- The AI Agent uses interest rate to recommend which debt to pay down first.`,
  },

  // ── Insurance ────────────────────────────────────────────────────────────
  {
    keywords: ['add insurance', 'add policy', 'add insurance policy',
               'record insurance', 'new policy', 'create insurance',
               'how to add insurance', 'log insurance', 'add coverage'],
    answer: `## 🛡️ How to Add an Insurance Policy in FinTrackly

Go to **Sidebar → Insurance**.

1. Tap **+ Add Policy**.
2. Fill in:
   - **Policy Name** — e.g. "LIC Term Plan"
   - **Type** — Life / Health / Vehicle / Property / Other
   - **Provider** — insurer name
   - **Coverage Amount** — total sum insured
   - **Premium Amount** — amount per payment
   - **Premium Frequency** — Monthly / Quarterly / Half-Yearly / Yearly
   - **Renewal Date** — when the policy needs to be renewed
   - **Nominee** (optional)
3. Tap **Save**.

### Tips
- Set the **Renewal Date** accurately — FinTrackly will alert you 30 days before renewal.
- Add all policies so the AI Agent can show your total coverage in one place.`,
  },

  // ── Agriculture ───────────────────────────────────────────────────────────
  {
    keywords: ['add agriculture', 'add crop', 'add field', 'add farm',
               'add crop cycle', 'add harvest', 'add farm expense',
               'how to add crop', 'how to add agriculture', 'log crop',
               'record crop', 'new crop cycle', 'add livestock'],
    answer: `## 🌾 How to Add Agriculture Records in FinTrackly

Go to **Sidebar → Agriculture**.

### Adding a Field
1. Tap **Fields → + Add Field**.
2. Enter: Field Name, Area (acres), Location, Soil Type.

### Adding a Crop Cycle
1. Tap **Crop Cycles → + Add Cycle**.
2. Fill in: Field, Crop Name, Season, Start Date, Expected Harvest Date, Investment Amount.
3. After harvest: update **Actual Harvest Date** and **Harvest Income**.

### Adding an Expense
1. Tap **Expenses → + Add**.
2. Choose Category: Seeds / Fertilizer / Pesticides / Labour / Irrigation / Other.
3. Enter Amount, Date, and optionally link to a crop cycle.

### Tips
- Link expenses to crop cycles for per-crop profitability analysis.
- Update harvest income after each crop to see your net profit.`,
  },

  // ── Lending ───────────────────────────────────────────────────────────────
  {
    keywords: ['add lending', 'add borrower', 'add loan given', 'lend money',
               'record lending', 'new borrower', 'how to add lending',
               'log lending', 'add money lent', 'record money lent'],
    answer: `## 🤝 How to Add a Lending Record in FinTrackly

Go to **Sidebar → Lending** (under the Lending / Finance section).

### Adding a Borrower
1. Tap **+ Add Borrower**.
2. Enter: Name, Phone (optional), Interest Rate (%), Status = Active.
3. Tap **Save**.

### Recording a Transaction
1. Open the borrower → tap **+ Add Transaction**.
2. Choose type:
   - **Principal Given** — money you lent out
   - **Principal Returned** — repayment received
   - **Interest Paid** — interest collected
3. Enter Amount and Date.
4. Tap **Save**.

### Tips
- Set a **Next Due Date** on the borrower to track upcoming repayments.
- The AI Agent uses these records to show total outstanding and interest earned.`,
  },

  // ── Accounts ─────────────────────────────────────────────────────────────
  {
    keywords: ['add account', 'add bank account', 'new account',
               'create account', 'record account', 'how to add account',
               'add credit account', 'log account'],
    answer: `## 🏦 How to Add a Bank Account in FinTrackly

Go to **Sidebar → Accounts**.

1. Tap **+ Add Account**.
2. Fill in:
   - **Account Name** — e.g. "SBI Savings" or "HDFC Salary Account"
   - **Type** — Bank / Credit
   - **Opening Balance** — your balance on the opening date
   - **Opening Balance Date** — the date of that balance
3. Tap **Save**.

### Tips
- Link Cashflow entries to accounts so FinTrackly auto-updates balances.
- Add both savings and credit accounts to see your full financial picture.`,
  },

  // ── Attendance / Labour ───────────────────────────────────────────────────
  {
    keywords: ['add employee', 'add attendance', 'add labour', 'add labor',
               'add worker', 'record attendance', 'mark attendance',
               'how to add employee', 'add salary', 'log attendance'],
    answer: `## 👷 How to Add Labour / Attendance Records in FinTrackly

Go to **Sidebar → Attendance**.

### Adding an Employee
1. Tap **+ Add Employee**.
2. Enter: Name, Daily Wage or Monthly Salary, Role (optional).

### Marking Attendance
1. Open an employee → tap **Mark Attendance**.
2. Select the date and status: Present / Absent / Half Day.

### Recording a Payment
1. Open an employee → tap **+ Payment**.
2. Enter Amount and Date to record wages paid.

### Tips
- Use the attendance summary to calculate total wages owed vs paid.
- Useful for farm workers, daily labourers, and household staff.`,
  },

  // ── Snapshots ────────────────────────────────────────────────────────────
  {
    keywords: ['take snapshot', 'add snapshot', 'create snapshot', 'save snapshot',
               'net worth snapshot', 'how to snapshot', 'record net worth'],
    answer: `## 📸 How to Take a Net Worth Snapshot in FinTrackly

Go to **Sidebar → Snapshots** (or from **Insights → Save Snapshot**).

1. From **Insights**: tap the **Save Snapshot** button in the top-right.
2. From **Snapshots page**: tap **+ Take Snapshot**.
3. FinTrackly saves your current net worth, assets, and liabilities as a point-in-time record.

### Tips
- Take a snapshot once a month to track your net worth growth over time.
- Snapshots are shown as a chart on the Snapshots page.`,
  },

  // ── General navigation ────────────────────────────────────────────────────
  {
    keywords: ['how do i use fintrackly', 'how to use fintrackly',
               'what can fintrackly do', 'what features does fintrackly have',
               'fintrackly features', 'what modules', 'how to get started',
               'where do i start'],
    answer: `## ✨ What Can You Do in FinTrackly?

FinTrackly is a complete personal finance tracker. Here's what each module does:

| Module | What it tracks |
|---|---|
| **Dashboard** | Net worth, portfolio, cashflow, goals overview |
| **Investments** | Stocks, mutual funds, FDs, bonds, gold, crypto |
| **Profits** | Sold trades and realized gains/losses |
| **Cashflow** | Monthly income, expenses, savings rate |
| **Accounts** | Bank accounts, credit accounts |
| **Payments** | Upcoming bills, EMIs, reminders |
| **Liabilities** | Loans, credit card debt |
| **Insurance** | Policies, premiums, renewals |
| **Goals** | Financial targets and progress tracking |
| **Agriculture** | Crops, fields, harvest income, farm expenses |
| **Attendance** | Employee attendance and wage tracking |
| **Lending** | Money you've lent to others |
| **Insights** | Financial health score, FIRE projection |
| **AI Agent** | Ask questions about your own data |
| **Reports** | Full financial summary |
| **Snapshots** | Monthly net worth history |

Ask the AI Agent anything about your data — or ask *"how do I add [feature]?"* for step-by-step guides.`,
  },
];

// ─── Matcher ──────────────────────────────────────────────────────────────────

/**
 * Returns a matching FeatureGuide if the question is a FinTrackly how-to /
 * navigation question. Returns null if no guide matches.
 */
export function matchFeatureGuide(question: string): FeatureGuide | null {
  const q = question.trim().toLowerCase();
  for (const guide of GUIDES) {
    if (guide.keywords.some((kw) => q.includes(kw))) return guide;
  }
  return null;
}

/**
 * True if the question looks like a "how do I use / add / set up" question
 * about a FinTrackly feature — regardless of whether a specific guide exists.
 */
export function isFeatureGuideQuestion(question: string): boolean {
  const q = question.trim().toLowerCase();
  return /\b(how\s+(do\s+i|to|can\s+i)|where\s+(do\s+i|can\s+i)|how\s+(does|is)|what\s+is\s+the)\b/.test(q)
      && /\b(add|create|set\s+up|record|log|track|use|find|open|navigate|access|mark|update|delete|edit|remove|view|see)\b/.test(q);
}
