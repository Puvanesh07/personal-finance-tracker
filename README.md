# Personal Finance Tracker (Frontend-only)

React + TypeScript + Tailwind CSS personal portfolio dashboard with local persistence (IndexedDB).

## Run

```bash
npm install
npm run dev
```

## Features implemented

- Dashboard summary cards + allocation pie + growth (daily snapshots) + maturity timeline
- Investments CRUD (Stocks, Mutual Funds, Bonds, Fixed Deposits, Other)
- Local persistence via IndexedDB (Dexie)
- Export: CSV + Excel (`exceljs`)
- CSV import (basic)
- Notion sync (manual, frontend-only)

## CSV import format

Upload a `.csv` with a header row. Supported headers (case-sensitive):

- `Type` (stock | mutual_fund | bond | fixed_deposit | other)
- `Name`
- Optional: `Symbol`, `Platform`
- Stocks: `Quantity`, `BuyPrice`, `CurrentPrice`
- Mutual funds: `Units`, `NAV`, `InvestedAmount`
- Bonds/FD: `InvestedAmount`, `InterestRate`, `DurationMonths`, `StartDate` (YYYY-MM-DD), `MaturityDate` (YYYY-MM-DD)
- FD optional: `BankName`
- Other: `InvestedAmount`, `CurrentValue`

## Notion setup notes

This app creates **new pages** in the target database on each sync (no dedupe yet). The database should include these properties:

- `Name` (title)
- `Investment Type` (select)
- `Amount Invested` (number)
- `Expected Gain` (number)
- `Date Added` (date)
- Optional: `Interest Rate` (number), `Duration` (number)

