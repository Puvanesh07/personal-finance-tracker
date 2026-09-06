// src/components/ui/FeatureInfo.tsx
//
// Reusable (ℹ) button that shows a two-level tooltip for every feature:
//   Level 1 — one sentence a beginner understands, shown immediately
//   Level 2 — "Know more" panel with What / Why / How / Q&A
//
// Usage:
//   <FeatureInfo feature="cashflow" />
//   <FeatureInfo feature="goals" />

import { useEffect, useRef, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiInfo, FiX } from 'react-icons/fi';

// ─── Content database ─────────────────────────────────────────────────────────

export type FeatureKey =
  | 'dashboard'
  | 'cashflow'
  | 'investments'
  | 'liabilities'
  | 'payments'
  | 'insurance'
  | 'accounts'
  | 'goals'
  | 'credentials'
  | 'insights'
  | 'ai_coach'
  | 'simulator'
  | 'timeline'
  | 'calendar'
  | 'budget'
  | 'forecast'
  | 'dna'
  | 'milestones'
  | 'cfo'
  | 'tools'
  | 'snapshots'
  | 'reports'
  | 'notifications'
  | 'settings'
  | 'profits';

interface FeatureContent {
  /** One sentence — plain language, no jargon */
  summary: string;
  /** Emoji for the feature */
  emoji: string;
  what: string;
  why: string;
  how: string;
  questions: { q: string; a: string }[];
}

const FEATURE_INFO: Record<FeatureKey, FeatureContent> = {
  dashboard: {
    emoji: '🏠',
    summary: 'Your complete financial picture in one screen — net worth, investments, cashflow, goals, and alerts at a glance.',
    what: 'The Dashboard is your personal finance homepage. It pulls data from every module and shows you the numbers that matter most — how much you own, how much you owe, how your investments are doing, and what needs your attention today.',
    why: 'Most people have their money scattered across banks, apps, and spreadsheets. The Dashboard brings it all together so you can see your full financial health in under 30 seconds without opening multiple apps.',
    how: 'Add data to any module (Cashflow, Investments, Liabilities, Goals, Insurance, Accounts) and the Dashboard automatically updates. No manual entry needed here.',
    questions: [
      { q: 'What is Net Worth?', a: 'Net Worth = Total Assets − Total Liabilities. It\'s the single most important number in personal finance. If it grows month over month, you\'re making financial progress.' },
      { q: 'Why do some cards show ₹0?', a: 'A module has no data yet. Click the card or use the Quick Actions to add your first entry — the dashboard fills in automatically.' },
      { q: 'How often does the Dashboard update?', a: 'Instantly — every time you add, edit, or delete a record anywhere in the app, the Dashboard recalculates in real time.' },
      { q: 'What is the Health Score?', a: 'A 0–100 score calculated from your debt ratio, emergency fund coverage, savings rate, and investment diversification. Higher is better.' },
    ],
  },

  cashflow: {
    emoji: '💸',
    summary: 'Track every rupee coming in and going out so you always know where your money goes.',
    what: 'Cashflow is your income and expense log. Every salary credit, rent payment, grocery bill, and side income is recorded here by date, category, and account. This is the foundation of all budgeting and planning.',
    why: 'You cannot improve what you don\'t measure. Most people are surprised to discover how much they spend on subscriptions, dining, or EMIs. Tracking cashflow for even one month reveals patterns that can save you thousands.',
    how: 'Tap "+ Add Entry" and record: type (Income/Expense), amount, category, date, and optionally link it to a bank account. Use the Quick Add bar in AI Coach to type naturally: "Spent ₹450 on dinner Sep 12".',
    questions: [
      { q: 'What categories should I use?', a: 'Use whatever matches your life — Salary, Rent, Groceries, EMI, Entertainment, Freelance, etc. You can create custom categories in Settings.' },
      { q: 'What is a Ledger Entry?', a: 'A ledger entry is automatically created when you link a cashflow to an account. It keeps your account balances accurate without manual updates.' },
      { q: 'Can I import bank statements?', a: 'Yes — use the Import button to upload CSV files from major banks. FinTrackly maps the columns automatically.' },
      { q: 'How is my Savings Rate calculated?', a: 'Savings Rate = (Total Income − Total Expenses) / Total Income × 100. A rate above 20% is healthy; above 40% is excellent.' },
      { q: 'What is the Forecast tab?', a: 'It projects your account balances 6 months ahead based on your recurring income and expense patterns.' },
    ],
  },

  investments: {
    emoji: '📈',
    summary: 'Track all your investments — stocks, mutual funds, FDs, bonds, gold, and more — in one portfolio view.',
    what: 'The Investments module is your complete portfolio manager. You can add stocks, mutual funds, fixed deposits, bonds, PPF, NPS, gold, real estate, crypto, and other assets. It calculates your current value, profit/loss, XIRR, and more.',
    why: 'Having investments across Zerodha, Angel One, INDmoney, and a local FD is common — but seeing their combined performance in one place is rare. This module gives you that single view so you can make informed rebalancing decisions.',
    how: 'Tap "+ Add Investment" and fill in the type, name, quantity (or units), buy price, and current price. You can also import directly from Angel One CSV, Groww CSV, or INDmoney XLSX.',
    questions: [
      { q: 'What is XIRR?', a: 'XIRR (Extended Internal Rate of Return) measures your actual annualised return accounting for the timing of each investment. It\'s more accurate than simple return % for SIPs and multiple buys.' },
      { q: 'What is Unrealised P&L?', a: 'The profit or loss on investments you still hold. It becomes "Realised" only when you sell — recorded automatically in the Profits module.' },
      { q: 'What is the SIP Plan tab?', a: 'A planner for your monthly Systematic Investment Plan. Set a total monthly budget, allocate % to each instrument, and the app reminds you to execute every month.' },
      { q: 'How do I record a sale?', a: 'Click on an investment → tap "Record Sale". Enter sell price and date. FinTrackly moves it to Profits and calculates your realised gain.' },
      { q: 'What is Asset Allocation?', a: 'The % split of your portfolio across asset types (equity, debt, gold, real estate, etc.). A balanced allocation reduces risk.' },
    ],
  },

  liabilities: {
    emoji: '🏦',
    summary: 'Keep track of all your loans — home loan, car loan, personal loan, credit cards — and their EMIs.',
    what: 'Liabilities are debts you owe: bank loans, credit card outstanding, personal loans, or any money you borrowed. Track the original amount, outstanding balance, interest rate, EMI, and due date.',
    why: 'Debt costs money every day via interest. Knowing exactly what you owe, at what rate, helps you prioritise repayment — pay the highest-interest debt first to minimise total interest paid over your lifetime.',
    how: 'Tap "+ Add Liability" and fill in the loan name, type, principal, outstanding amount, interest rate, EMI amount, and EMI date. FinTrackly will remind you 3 days before each EMI.',
    questions: [
      { q: 'What is the difference between Principal and Outstanding?', a: 'Principal is the original loan amount you borrowed. Outstanding is how much you still owe today after making payments.' },
      { q: 'What is EMI Day?', a: 'The day of the month your EMI is due (e.g. 5th = every 5th of the month). FinTrackly sends you a reminder before it.' },
      { q: 'How do I mark a loan as closed?', a: 'Open the liability → tap Edit → change Status to "Paid". It moves out of active liabilities and your net worth updates instantly.' },
      { q: 'What is the Debt-to-Asset Ratio?', a: 'Total Liabilities ÷ Total Assets. Below 30% is healthy. Above 50% means more than half your assets are financed by debt — a warning sign.' },
    ],
  },

  payments: {
    emoji: '🔔',
    summary: 'Never miss a bill or EMI again — schedule reminders for any recurring or one-time payment.',
    what: 'The Payment Tracker is your bill reminder system. Add any upcoming payment — electricity, OTT subscription, insurance premium, EMI, rent — and FinTrackly will alert you before it\'s due.',
    why: 'Late payments cost money (late fees, interest) and hurt your credit score. A central reminder system prevents this even when you\'re busy.',
    how: 'Tap "+ Add Payment" with title, amount, due date, and recurrence (one-time / weekly / monthly / quarterly / half-yearly / yearly). Set reminder days (e.g. remind me 3 days before). Mark as paid when done.',
    questions: [
      { q: 'What is the difference between Payments and Liabilities?', a: 'Liabilities are long-term debts (loans). Payments are one-time or recurring bills (electricity, subscriptions). Both generate reminders, but Liabilities also track your outstanding balance.' },
      { q: 'What are Pending Payments?', a: 'Money people owe you — e.g. a friend who bought something and hasn\'t paid back yet. Track the expected receipt date and get reminders to follow up.' },
      { q: 'What does "Mark as Paid" do?', a: 'It closes the reminder and records the payment date. If it\'s a recurring payment, a new reminder is created for the next cycle automatically.' },
    ],
  },

  insurance: {
    emoji: '🛡️',
    summary: 'Store all your insurance policies and get renewal reminders before they expire.',
    what: 'The Insurance module keeps a record of every policy you hold — life insurance, health insurance, vehicle insurance, term plans. Track the coverage amount, premium, and renewal date.',
    why: 'Insurance is the safety net for everything else you\'ve built. Letting a policy lapse — especially health or term — can be catastrophic. A central tracker prevents accidental lapses.',
    how: 'Tap "+ Add Policy" with type, provider, policy name, coverage amount, premium, and renewal date. FinTrackly alerts you 30, 7, and 1 day before renewal.',
    questions: [
      { q: 'What types of insurance should I track?', a: 'Life (term plan), Health (self + family floater), Vehicle (car, bike), Home, and any business insurance. All are tracked the same way.' },
      { q: 'What is Sum Assured / Coverage Amount?', a: 'The maximum amount the insurer pays if you make a claim. For term life, it\'s what your family receives. For health, it\'s the annual limit for medical bills.' },
      { q: 'How do I record a premium payment?', a: 'Open a policy → tap "Record Payment". It logs the date and amount, and creates a payment history for that policy.' },
      { q: 'What is the recommended life cover?', a: 'Financial thumb rule: 10–15× your annual income. So if you earn ₹8L/year, aim for ₹80L–₹1.2Cr term cover.' },
    ],
  },

  accounts: {
    emoji: '🏧',
    summary: 'Link your bank accounts and credit cards so your account balances stay accurate automatically.',
    what: 'The Accounts module tracks your bank accounts and credit cards. When you link cashflow entries to an account, the balance updates automatically — no manual entry needed.',
    why: 'Knowing how much liquid cash you have across all accounts is essential for short-term financial decisions. It also feeds the Dashboard\'s "Available Cash" metric.',
    how: 'Tap "+ Add Account" with name, type (Bank/Credit), and opening balance on a specific date. Then when you log cashflow entries, select the account — balances update live.',
    questions: [
      { q: 'What is Opening Balance?', a: 'Your account balance on the date you start tracking. Future cashflow adds or subtracts from this to keep the balance accurate.' },
      { q: 'Why is my balance wrong?', a: 'Check that cashflow entries are linked to this account and the opening balance date is correct. Entries before the opening date are excluded.' },
      { q: 'Should I add credit cards?', a: 'Yes — add them as "Credit" type. Your credit card balance represents a liability (money you owe), so it helps track total debt accurately.' },
    ],
  },

  goals: {
    emoji: '🎯',
    summary: 'Set financial targets — emergency fund, house down payment, vacation — and track your progress.',
    what: 'Goals lets you define what you\'re saving toward and track how close you are. Each goal has a name, target amount, and optional deadline. Add contributions to mark progress.',
    why: 'Saving without a goal feels abstract and is easy to abandon. A specific target (₹5L for a car by Dec 2026) makes it concrete, measurable, and motivating.',
    how: 'Tap "+ Add Goal" with name, target amount, and due date. Then add contributions as you save. FinTrackly shows your progress % and reminds you to contribute each month.',
    questions: [
      { q: 'What is a Goal Contribution?', a: 'An amount you\'ve set aside specifically for this goal. Adding contributions tracks your actual savings separately from your general bank balance.' },
      { q: 'What should my first goal be?', a: 'An Emergency Fund — 3–6 months of living expenses kept in a liquid account. It\'s the most important financial safety net.' },
      { q: 'What does the AI Coach say about goals?', a: 'Ask "Am I on track for my [goal name]?" and the AI calculates how much you need to save per month to hit your target by the deadline.' },
      { q: 'What is FIRE?', a: 'Financial Independence, Retire Early — the goal of accumulating enough wealth (typically 25× annual expenses) that your investments cover your living costs forever.' },
    ],
  },

  credentials: {
    emoji: '🔐',
    summary: 'Securely store financial account numbers, PAN, Aadhaar, and login details — encrypted on your device.',
    what: 'Credentials is an encrypted vault for sensitive financial information: bank account numbers, PAN card, Aadhaar, demat account IDs, brokerage logins, and insurance policy numbers.',
    why: 'Financial credentials are scattered — PAN in one email, Aadhaar in another, bank account number memorised. Having them in one encrypted place means you always have them when needed (e.g. filing taxes, opening a new account).',
    how: 'Tap "+ Add Credential" with title, category, identifier, and optional notes. All data is encrypted before being saved — even FinTrackly cannot read your stored values.',
    questions: [
      { q: 'Is it safe to store passwords here?', a: 'All credential data is encrypted using AES-256 with your personal encryption key before it reaches our servers. Only your device can decrypt it.' },
      { q: 'What categories should I use?', a: 'Identity (PAN, Aadhaar, Passport), Finance (account numbers, demat IDs), Login (net banking usernames), and Note (policy numbers, tax info).' },
      { q: 'Will I get a reminder if a password is stale?', a: 'Yes — if a login credential hasn\'t been updated in over a year, FinTrackly notifies you to review and rotate it.' },
    ],
  },

  insights: {
    emoji: '⚡',
    summary: 'Deep analytics on your portfolio — health score, FIRE projection, tax-loss opportunities, and more.',
    what: 'Insights is your premium analytics engine. It calculates your Financial Health Score, emergency fund runway, debt-to-asset ratio, passive income potential, FIRE number, tax-loss harvesting opportunities, and lifestyle inflation trend.',
    why: 'Raw numbers don\'t tell the full story. Insights translates your data into actionable signals — "your savings rate dropped 8% this quarter" or "you can retire in 14 years at this rate".',
    how: 'Available with a premium subscription. Open Insights and all metrics calculate automatically from your existing data. Use the "Save Snapshot" button to record a point-in-time snapshot for future comparison.',
    questions: [
      { q: 'What is the FIRE Number?', a: 'The investment corpus needed to retire — calculated as 25× your annual expenses (based on the 4% withdrawal rule). It tells you exactly how much you need to never need a job again.' },
      { q: 'What is Tax-Loss Harvesting?', a: 'Selling investments that are at a loss to offset taxable gains. FinTrackly identifies which holdings could be sold for a tax benefit.' },
      { q: 'What is Lifestyle Inflation?', a: 'When your spending grows faster than your income — you earn more but save the same %. FinTrackly tracks this trend across your cashflow history.' },
      { q: 'What is Passive Income?', a: 'Money earned without active work — dividends, FD interest, rental income. FinTrackly calculates your monthly passive income from investments.' },
    ],
  },

  ai_coach: {
    emoji: '🤖',
    summary: 'Ask anything about your finances in plain language — the AI answers using your actual data.',
    what: 'The AI Coach is a conversational financial assistant powered by Groq AI. It can answer questions about your data ("what is my net worth?"), add records ("add ₹2500 electricity bill"), and explain financial concepts ("what is XIRR?").',
    why: 'Most financial apps give you raw numbers. The AI Coach helps you understand what those numbers mean and what to do about them — like having a personal CFO in your pocket.',
    how: 'Type any question or command in the chat box. Use the Quick Add bar for instant expense/income logging. Use the Brief tab for an AI-generated financial summary. Use the Search tab to query your data.',
    questions: [
      { q: 'Can the AI add records for me?', a: 'Yes — type "Add ₹2500 electricity bill for Sep 15" or "I bought 10 TCS shares at ₹3200" and the AI parses it and adds it after your confirmation.' },
      { q: 'Can it add multiple records at once?', a: 'Yes — use the Bulk Add panel (the stack icon in the chat bar). Paste multiple entries, edit dates, and save all at once.' },
      { q: 'Is the AI connected to real-time market data?', a: 'No — it only uses your FinTrackly data and general financial knowledge. It cannot fetch live stock prices or make buy/sell predictions.' },
      { q: 'What questions can I ask?', a: '"What is my savings rate?" · "How much have I spent on food this month?" · "Am I on track for my house goal?" · "What is SIP?" · "Plan my finances for October"' },
    ],
  },

  simulator: {
    emoji: '🧮',
    summary: 'Run "what if" scenarios — what if I invest ₹10k/month? What if I pay off my loan early?',
    what: 'The What-If Simulator lets you model financial decisions before making them. Simulate SIP growth, loan prepayment impact, salary hike scenarios, and major purchase affordability.',
    why: 'Financial decisions have long-term consequences. Simulating them first — in 2 minutes, risk-free — prevents costly mistakes and reveals the power of compounding.',
    how: 'Choose a scenario type, input your numbers, and the simulator calculates the projected outcome with charts. Scenarios don\'t affect your real data.',
    questions: [
      { q: 'What scenarios are available?', a: 'SIP Growth, Loan Prepayment, Goal Achievement, Retirement Corpus, and Life Event Planner (marriage, home purchase, children).' },
      { q: 'Does this change my actual data?', a: 'No — it\'s completely hypothetical. Changes made in the Simulator are never saved to your portfolio.' },
    ],
  },

  timeline: {
    emoji: '📊',
    summary: 'See how your net worth has changed over time as a chart.',
    what: 'The Net Worth Timeline shows a line chart of every net worth snapshot you\'ve taken, plotted over time. It\'s the most visual way to see your financial progress.',
    why: 'Progress is invisible day-to-day but obvious month-to-month. The Timeline makes growth (and setbacks) concrete and motivating.',
    how: 'Take snapshots regularly from the Snapshots page (or the Dashboard Quick Action). The Timeline automatically plots them in chronological order.',
    questions: [
      { q: 'How do I get more data points?', a: 'Take a snapshot at least once a month. Go to Snapshots → "Take Snapshot". Give it a label like "Jan 2026" for clarity.' },
      { q: 'Why does it only show a few points?', a: 'Each data point is a manually taken snapshot. The more snapshots you take, the richer the chart.' },
    ],
  },

  calendar: {
    emoji: '📅',
    summary: 'A financial calendar showing all your upcoming payments, EMIs, renewals, and goals on one view.',
    what: 'The Financial Calendar overlays all your upcoming financial events — payment due dates, EMIs, insurance renewals, goal deadlines, and SIP dates — on a monthly calendar grid.',
    why: 'Seeing all financial obligations in a calendar view makes it easy to spot cash-flow crunches (months when multiple bills are due) and plan accordingly.',
    how: 'No setup needed — the calendar auto-populates from your Payments, Liabilities, Insurance, and Goals data. View by month and tap any event for details.',
    questions: [
      { q: 'Can I add custom events?', a: 'Calendar events come from existing modules. To add an event, add the underlying record (payment, liability, insurance) and it appears automatically.' },
    ],
  },

  budget: {
    emoji: '💰',
    summary: 'Set monthly spending limits by category and track whether you\'re staying within them.',
    what: 'The Budget module lets you set monthly spending limits per category (Groceries: ₹8,000; Dining: ₹3,000; etc.) and compares your actual cashflow spending against those limits in real time.',
    why: 'Without a budget, money just disappears. A budget makes every spending decision conscious — you know exactly how much "room" you have left in each category.',
    how: 'Set your monthly income and spending limits per category. FinTrackly automatically pulls your actual cashflow expenses and shows you a progress bar for each category.',
    questions: [
      { q: 'What is the 50/30/20 rule?', a: '50% of income on needs, 30% on wants, 20% on savings/investments. It\'s a simple starting framework for anyone new to budgeting.' },
      { q: 'What happens if I overspend a category?', a: 'The progress bar turns red and you get a notification. The budget is advisory — it doesn\'t block you from adding expenses.' },
    ],
  },

  forecast: {
    emoji: '🔮',
    summary: 'See predicted account balances for the next 6 months based on your income/expense patterns.',
    what: 'The Forecast module projects your bank account balances 3–6 months into the future using your recurring income and expense patterns. It helps you spot future cash shortfalls before they happen.',
    why: 'You can see that in March your balance will dip below ₹20,000 because three big bills coincide — and take action now (save more in Jan/Feb) rather than scramble in March.',
    how: 'The forecast runs automatically based on your cashflow history and recurring payments. You can adjust assumptions (expected income, one-time expenses) to model scenarios.',
    questions: [
      { q: 'How accurate is the forecast?', a: 'It\'s a projection, not a guarantee. Accuracy improves with more cashflow history (3+ months of data).' },
      { q: 'What is a recurring pattern?', a: 'An income or expense that repeats monthly (salary, rent, EMI). The forecast identifies these automatically from your cashflow entries.' },
    ],
  },

  dna: {
    emoji: '🧬',
    summary: 'Discover your financial personality — are you a Saver, Investor, Spender, or Protector?',
    what: 'Financial DNA analyses your spending, saving, investing, and protection patterns to assign you a financial personality type with a detailed breakdown of your strengths and blind spots.',
    why: 'Self-awareness is the first step to improvement. Knowing you\'re a "Spender" who underinvests, or an "Investor" who neglects insurance, gives you a clear direction to work on.',
    how: 'Calculated automatically from at least 30 days of cashflow and investment data. The more data you have, the more accurate the profile.',
    questions: [
      { q: 'What are the personality types?', a: 'Saver (prioritises cash buffer), Investor (maximises investment allocation), Spender (high discretionary expenses), Protector (insurance-first mindset), and Balanced (even distribution).' },
      { q: 'Can my DNA type change?', a: 'Yes — it recalculates monthly as your patterns change. Improving your savings rate or starting investments will shift your type.' },
    ],
  },

  milestones: {
    emoji: '🏆',
    summary: 'Mark and celebrate major life financial milestones — first crore, debt-free, FIRE number reached.',
    what: 'Milestones are significant financial achievements you can define and track — first ₹1L saved, debt-free, net worth ₹1Cr, emergency fund complete, FIRE number reached.',
    why: 'Large financial goals take years. Milestones break the journey into visible checkpoints and give you a sense of progress and celebration along the way.',
    how: 'FinTrackly auto-detects some milestones (net worth thresholds, debt paid off). You can also define custom milestones and manually mark them when achieved.',
    questions: [
      { q: 'What are the default milestones?', a: 'First ₹1L net worth, First ₹10L, Debt-Free, Emergency Fund Complete, First ₹1Cr, and FIRE Number Reached.' },
    ],
  },

  cfo: {
    emoji: '👔',
    summary: 'A CFO-style dashboard with your most important financial KPIs and strategic recommendations.',
    what: 'The Personal CFO view presents your finances the way a Chief Financial Officer would see a company — key ratios, strategic health indicators, cash runway, investment allocation analysis, and recommended actions.',
    why: 'Most people manage money reactively. A CFO thinks strategically — "my emergency runway is 2.3 months; that\'s below the 3-month target; corrective action needed." This view encourages that mindset.',
    how: 'Automatic — calculated from all your existing data. Review it monthly to track strategic KPIs beyond just net worth.',
    questions: [
      { q: 'What KPIs does it show?', a: 'Net Worth, Savings Rate, Debt-to-Asset Ratio, Emergency Runway (months), Investment Allocation %, Monthly Surplus, and Passive Income Ratio.' },
      { q: 'What is Cash Runway?', a: 'How many months you could survive without any income if you only spent from your savings. Target: 3–6 months minimum.' },
    ],
  },

  tools: {
    emoji: '🛠️',
    summary: 'Financial calculators — SIP returns, loan EMI, tax estimation, compound interest, and more.',
    what: 'Tools is a collection of financial calculators: SIP return projector, loan EMI calculator, tax estimator, compound interest calculator, inflation-adjusted value, and portfolio analyser.',
    why: 'Quick calculations that used to require a spreadsheet or financial advisor — now in seconds, with your real data pre-filled where applicable.',
    how: 'Open any calculator, fill in the inputs, and get instant results. Some tools use your actual portfolio data to give personalised numbers.',
    questions: [
      { q: 'What is the EMI calculator?', a: 'Enter loan amount, interest rate, and tenure — it tells you the exact monthly EMI and total interest you\'ll pay over the loan lifetime.' },
      { q: 'What is the SIP projector?', a: 'Enter monthly investment amount, expected return rate, and duration — it shows the final corpus using compound interest.' },
    ],
  },

  snapshots: {
    emoji: '📸',
    summary: 'Freeze your entire financial picture at a moment in time and compare it to past snapshots.',
    what: 'A Snapshot records your complete financial state right now — net worth, investments, cashflow, goals, insurance, SIP, and liabilities — as a permanent, timestamped record. Compare snapshots over time to see exactly how you\'ve grown.',
    why: 'Financial progress is invisible without measurement. A monthly snapshot turns abstract growth into concrete numbers: "My net worth grew ₹82,000 in the last 3 months."',
    how: 'Tap "Take Snapshot" and optionally add a label (e.g. "Before Job Change", "Q1 2026"). All current numbers are saved automatically. Take one at least once a month.',
    questions: [
      { q: 'What does a Snapshot capture?', a: 'Investment value, net worth (assets − liabilities), this month\'s income/expenses, account balance, goals progress %, insurance coverage, SIP budget, and active loan count.' },
      { q: 'Can I compare two snapshots?', a: 'Yes — click any snapshot row to expand the full breakdown. The Change column shows ₹ and % change vs the previous snapshot.' },
      { q: 'How is this different from the Timeline?', a: 'Snapshots store every detail across all modules. The Timeline only charts the net worth number. Snapshots are the full data; Timeline is the chart.' },
    ],
  },

  reports: {
    emoji: '📑',
    summary: 'A complete financial report — income, expenses, investments, goals, and insurance in one document.',
    what: 'Reports is your premium financial summary — a comprehensive breakdown of your cashflow (by category and timeframe), investment performance, goal progress, insurance coverage, and key financial ratios.',
    why: 'Useful for tax planning, annual financial review, or sharing a financial summary with a family member or advisor without giving them full app access.',
    how: 'Available with a premium subscription. Select a time period and the report auto-generates from your data. You can export it as a PDF.',
    questions: [
      { q: 'What periods can I report on?', a: '1 month, 3 months, 6 months, 1 year, and all-time.' },
      { q: 'Can I export the report?', a: 'PDF export is available. Use Settings → Export/Import for CSV/JSON full data exports.' },
    ],
  },

  notifications: {
    emoji: '🔔',
    summary: 'All your financial alerts — upcoming bills, EMI dues, insurance renewals, goal reminders — in one place.',
    what: 'The Notifications page shows every alert FinTrackly has generated from your data: payment reminders, EMI due dates, insurance renewals, goal milestones, SIP reminders, and subscription status.',
    why: 'A single place to review all alerts means you never miss something important buried in SMS or email. One glance shows everything that needs attention today.',
    how: 'Notifications are generated automatically from your data — no setup needed. Mark individual ones as read, dismiss them, or clear all. Configure which types you receive in Settings → Notifications.',
    questions: [
      { q: 'How do I turn off certain notifications?', a: 'Go to Settings → Notifications and toggle any category on/off. You can also set Quiet Hours to pause alerts at night.' },
      { q: 'What does "Clear All" do?', a: 'Hides all current notifications. Any new alerts generated after you clear will appear fresh.' },
      { q: 'Can I get email reminders?', a: 'Yes — FinTrackly sends automated email digests every morning for due payments, insurance renewals, and goal reminders. Configure in Settings → Notifications.' },
    ],
  },

  settings: {
    emoji: '⚙️',
    summary: 'Configure your account, subscription, data exports, notifications, encryption, and integrations.',
    what: 'Settings is your control centre: manage your profile, view subscription status, export/import data (CSV or JSON backup), configure notification preferences, enable encryption, set up Notion sync, and access admin tools.',
    why: 'Your financial data belongs to you. Settings gives you full control — export at any time, enable military-grade encryption, set up automated reminders, and manage your subscription.',
    how: 'Navigate using the tab menu on the left. Key actions: Export/Import tab for backups, Notifications tab for alert preferences, App & Security for encryption.',
    questions: [
      { q: 'How do I back up my data?', a: 'Settings → Export/Import → "Export Full Backup (JSON)". Download the file and keep it safe. You can restore from it at any time.' },
      { q: 'What is Encryption?', a: 'When enabled, all your financial data is encrypted with AES-256 before being saved to the database — even FinTrackly staff cannot read it. Requires you to remember your encryption key.' },
      { q: 'How do I cancel my subscription?', a: 'Settings → Subscription → the subscription details are shown there with options to manage your plan.' },
    ],
  },

  profits: {
    emoji: '💹',
    summary: 'See all your realised profits and losses from sold investments in one place.',
    what: 'The Profits page tracks every investment you\'ve sold — showing buy price, sell price, profit/loss, and return %. It gives you an audit trail of your trading history and realised gains.',
    why: 'Knowing your realised P&L is essential for tax filing (STCG/LTCG), portfolio review, and understanding which investment strategies worked.',
    how: 'Records are created automatically when you use "Record Sale" on an investment. You can also add sold trades manually.',
    questions: [
      { q: 'What is STCG vs LTCG?', a: 'Short-Term Capital Gain (held < 1 year for equity) is taxed at 20%. Long-Term Capital Gain (held > 1 year) above ₹1.25L/year is taxed at 12.5% for equity.' },
      { q: 'What is Win Rate?', a: 'The % of your trades that were profitable. If 7 out of 10 trades made money, your win rate is 70%.' },
    ],
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface FeatureInfoProps {
  feature: FeatureKey;
  /** Where to anchor the panel — 'left' | 'right' | 'center' */
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function FeatureInfo({ feature, align = 'right', className = '' }: FeatureInfoProps) {
  const [open, setOpen]         = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef  = useRef<HTMLButtonElement>(null);
  const content    = FEATURE_INFO[feature];

  // Position the panel using fixed coords so it's never clipped by overflow:hidden parents
  const positionPanel = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const panelWidth = 340;
    const margin = 8;

    let left = rect.right - panelWidth; // right-align by default
    if (align === 'left')   left = rect.left;
    if (align === 'center') left = rect.left + rect.width / 2 - panelWidth / 2;

    // Clamp so panel never goes off-screen
    left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));

    const top = rect.bottom + 6; // 6px gap below button

    setPanelStyle({ position: 'fixed', top, left, width: panelWidth });
  };

  useEffect(() => {
    if (!open) return;
    positionPanel();
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        buttonRef.current  && !buttonRef.current.contains(target)
      ) {
        setOpen(false); setExpanded(false);
      }
    };
    const onKey   = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setExpanded(false); } };
    const onScroll = () => positionPanel();
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!content) return null;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>

      {/* ── Trigger button ── */}
      <button
        ref={buttonRef}
        type='button'
        onClick={() => { setOpen((v) => !v); if (open) setExpanded(false); }}
        aria-label={`Learn about ${feature}`}
        aria-expanded={open}
        title={`What is ${feature.replace(/_/g, ' ')}?`}
        className={`
          flex h-6 w-6 items-center justify-center rounded-full border
          transition-all select-none
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
          ${open
            ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-400/40'
            : 'border-slate-300 bg-white/90 text-slate-500 shadow-sm hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400'
          }
        `}
      >
        <FiInfo className='h-3.5 w-3.5' />
      </button>

      {/* ── Panel — fixed position so it's never clipped ── */}
      {open && (
        <div
          ref={wrapperRef}
          style={panelStyle}
          className='z-[9999] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_24px_64px_-8px_rgba(0,0,0,0.28),0_4px_16px_-4px_rgba(0,0,0,0.14)] dark:shadow-[0_24px_64px_-8px_rgba(0,0,0,0.7)] overflow-hidden'
          role='dialog'
          aria-label={`${feature} feature information`}
        >
          {/* ── Header ── */}
          <div className='flex items-start gap-3 px-4 py-3.5 bg-emerald-500/5 dark:bg-emerald-500/10 border-b border-slate-100 dark:border-slate-800'>
            <span className='text-2xl shrink-0 leading-none mt-0.5 select-none'>{content.emoji}</span>
            <div className='min-w-0 flex-1'>
              <p className='text-[13px] font-bold text-slate-900 dark:text-slate-50 capitalize leading-tight'>
                {feature.replace(/_/g, ' ')}
              </p>
              <p className='text-[12px] font-normal text-slate-600 dark:text-slate-300 leading-relaxed mt-1'>
                {content.summary}
              </p>
            </div>
            <button
              type='button'
              onClick={() => { setOpen(false); setExpanded(false); }}
              aria-label='Close'
              className='shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors'
            >
              <FiX className='h-4 w-4' />
            </button>
          </div>

          {/* ── Know more toggle ── */}
          <button
            type='button'
            onClick={() => setExpanded((v) => !v)}
            className='flex w-full items-center justify-between gap-2 px-4 py-2.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border-b border-slate-100 dark:border-slate-800'
          >
            <span>{expanded ? '▲ Show less' : '✨ Know more — What, Why, How & FAQs'}</span>
            {expanded
              ? <FiChevronUp className='h-4 w-4 shrink-0' />
              : <FiChevronDown className='h-4 w-4 shrink-0' />}
          </button>

          {/* ── Expanded detail ── */}
          {expanded && (
            <div className='max-h-[380px] overflow-y-auto overscroll-contain'>
              <div className='px-4 pt-4 pb-2 space-y-4'>
                {[
                  { label: '📌 What is it?',         text: content.what },
                  { label: '💡 Why does it matter?',  text: content.why },
                  { label: '🛠️ How do I use it?',     text: content.how },
                ].map(({ label, text }) => (
                  <div key={label}>
                    <p className='text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-500 mb-1.5'>
                      {label}
                    </p>
                    <p className='text-[12.5px] font-normal leading-relaxed text-slate-700 dark:text-slate-200'>
                      {text}
                    </p>
                  </div>
                ))}
              </div>

              <div className='px-4 pb-4'>
                <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 mt-1'>
                  ❓ Common questions
                </p>
                <div className='space-y-2'>
                  {content.questions.map(({ q, a }) => (
                    <div
                      key={q}
                      className='rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5'
                    >
                      <p className='text-[12px] font-semibold text-slate-800 dark:text-slate-100 mb-1 leading-snug'>
                        {q}
                      </p>
                      <p className='text-[12px] font-normal leading-relaxed text-slate-600 dark:text-slate-300'>
                        {a}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
