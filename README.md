# FinTrackly — Personal Finance Tracker

React + TypeScript + Tailwind CSS personal portfolio dashboard with Firebase auth and cloud persistence (Firestore).

## Stack

| Layer      | Tech                                           |
| ---------- | ---------------------------------------------- |
| Framework  | React 19 + TypeScript 5                        |
| Build      | Vite 7                                         |
| Styling    | Tailwind CSS 4                                 |
| Auth       | Firebase Auth (Google Sign-In)                 |
| Database   | Firebase Firestore (per-user, cloud)           |
| State      | Zustand 5                                      |
| Charts     | Recharts 3                                     |
| Routing    | React Router 7                                 |
| Animations | Framer Motion 12                               |
| Deploy     | Netlify (serverless functions for Notion sync) |

## Run

```bash
npm install
npm run dev
```

Create a `.env` file at the root with your Firebase project config:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Pages & Features

### Dashboard (`/dashboard`)

- Net worth, total assets, total liabilities, and cashflow summary cards
- Asset allocation donut chart
- Maturity timeline (bonds & FDs)
- Sector allocation chart (powered by bundled NSE stock data)
- Market-cap allocation chart (Large / Mid / Small cap)
- Goals & essentials safety net summary panel
- Net worth growth chart from snapshot history

### Investments (`/investments`)

- Full CRUD for all asset types: **Stocks, Mutual Funds, Bonds, Fixed Deposits, Gold, Crypto, PPF, NPS, Other**
- Search by name, symbol, or platform; filter by asset type
- Invested amount, current value, and P&L shown per row
- Import from four platforms (see [Import section](#imports) below)
- Export as CSV or Excel via the Reports page

### Cashflow (`/cashflow`)

- Monthly income and expense tracking with a 12-month history picker
- Auto-calculated income, expenses, and savings rate metric cards
- Full transaction table with add, edit, and delete

### Liabilities (`/liabilities`)

- Track loans, mortgages, credit cards, and any custom debt type
- Outstanding amount and interest rate per entry
- Total outstanding debt summary card
- Feeds into net worth calculation on the Dashboard

### Goals (`/goals`)

- Create goals with a name, target amount, current amount, and optional due date
- Auto-calculated progress bar (current / target)
- Completed state when 100% reached
- Goals summary also shown on the Dashboard

### Snapshots (`/snapshots`)

- One-click net worth snapshot with a custom label (e.g. "Q1 End")
- Records total assets, total liabilities, and computed net worth at that moment
- Full snapshot history table
- Snapshot data powers the growth chart on the Dashboard

### Reports (`/reports`)

- Portfolio summary: total invested, current value, net P&L
- Asset allocation table grouped by investment type
- Expected interest earnings for bonds and fixed deposits
- Export investments as **CSV** or **Excel (.xlsx)** with computed P&L columns

### Settings (`/settings`)

- **Notion Integration** — connect a Notion workspace via API token and database ID
- **Essentials & Safety Net** — record term insurance cover, health cover, emergency fund target and current amount (surfaced on the Dashboard)
- **Data Management** — export a full JSON backup, restore from backup, or wipe all data

---

## Imports

All importers are platform-specific parsers — no broker API access required.

| Platform  | Format             | Parser                                  |
| --------- | ------------------ | --------------------------------------- |
| Zerodha   | `.csv`             | `csvImport.ts`                          |
| Angel One | `.pdf` (statement) | `angelOnePdfImport.ts` via `pdfjs-dist` |
| Groww     | `.csv`             | `csvImport.ts` (Groww column mapping)   |
| INDmoney  | `.xlsx`            | `indmoneyXlsxImport.ts` via `exceljs`   |

### Generic CSV import format

Upload a `.csv` with a header row. Supported headers (case-sensitive):

```
Type          stock | mutual_fund | bond | fixed_deposit | other
Name
Symbol        (optional)
Platform      (optional)
```

Type-specific fields:

| Type            | Required fields                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `stock`         | `Quantity`, `BuyPrice`, `CurrentPrice`                                                                    |
| `mutual_fund`   | `Units`, `NAV`, `InvestedAmount`                                                                          |
| `bond`          | `InvestedAmount`, `InterestRate`, `DurationMonths`, `StartDate` (YYYY-MM-DD), `MaturityDate` (YYYY-MM-DD) |
| `fixed_deposit` | Same as bond + optional `BankName`                                                                        |
| `other`         | `InvestedAmount`, `CurrentValue`                                                                          |

---

## Notion Sync

Configured in **Settings → Notion Integration**. Sync is triggered manually from the Settings panel and runs via a Netlify serverless function (`netlify/functions/notion-sync.ts`).

Each sync push creates new pages in the target Notion database (no deduplication yet). The database must have these properties:

| Property          | Type              |
| ----------------- | ----------------- |
| `Name`            | title             |
| `Investment Type` | select            |
| `Amount Invested` | number            |
| `Expected Gain`   | number            |
| `Date Added`      | date              |
| `Interest Rate`   | number (optional) |
| `Duration`        | number (optional) |

---

## Data & Auth

- **Authentication**: Google Sign-In via Firebase Auth. All data is scoped to the authenticated user's UID in Firestore.
- **Backup**: Export all data as a JSON file from Settings. Restore by re-importing the same JSON.
- **Wipe**: One-click full data delete from Settings (removes all Firestore documents for the user).
- **NSE stock metadata**: 500+ NSE symbols with sector and market-cap classification are bundled in `src/data/nseStockdata.ts` — no external API needed for the allocation charts# FinTrackly — Personal Finance Tracker

React + TypeScript + Tailwind CSS personal portfolio dashboard with Firebase auth and cloud persistence (Firestore). Built for Indian investors with 14 fully live modules including a dedicated Agriculture / Farm management tracker.

## Stack

| Layer      | Tech                                           |
| ---------- | ---------------------------------------------- |
| Framework  | React 19 + TypeScript 5                        |
| Build      | Vite 7                                         |
| Styling    | Tailwind CSS 4                                 |
| Auth       | Firebase Auth (Google Sign-In)                 |
| Database   | Firebase Firestore (per-user, cloud)           |
| State      | Zustand 5                                      |
| Charts     | Recharts 3                                     |
| Routing    | React Router 7                                 |
| Animations | Framer Motion 12                               |
| Deploy     | Netlify (serverless functions for Notion sync) |

## Run

```bash
npm install
npm run dev
```

Create a `.env` file at the root with your Firebase project config:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Pages & Features

### Dashboard (`/dashboard`)

- Net worth, total assets, total liabilities, and cashflow summary cards
- Asset allocation donut chart
- Maturity timeline (bonds & FDs)
- Sector allocation chart (powered by bundled NSE stock data)
- Market-cap allocation chart (Large / Mid / Small cap)
- Goals & essentials safety net summary panel
- Net worth growth chart from snapshot history

### Investments (`/investments`)

- Full CRUD for all asset types: **Stocks, Mutual Funds, Bonds, Fixed Deposits, Gold, Crypto, PPF, NPS, Other**
- Search by name, symbol, or platform; filter by asset type
- Invested amount, current value, and P&L shown per row
- Import from four platforms (see [Import section](#imports) below)
- Export as CSV or Excel via the Reports page

### Cashflow (`/cashflow`)

- Monthly income and expense tracking with a 12-month history picker
- Auto-calculated income, expenses, and savings rate metric cards
- Full transaction table with add, edit, and delete

### Liabilities (`/liabilities`)

- Track loans, mortgages, credit cards, and any custom debt type
- Outstanding amount and interest rate per entry
- Total outstanding debt summary card
- Feeds into net worth calculation on the Dashboard

### Goals (`/goals`)

- Create goals with a name, target amount, current amount, and optional due date
- Auto-calculated progress bar (current / target)
- Completed state when 100% reached
- Goals summary also shown on the Dashboard

### Snapshots (`/snapshots`)

- One-click net worth snapshot with a custom label (e.g. "Q1 End")
- Records total assets, total liabilities, and computed net worth at that moment
- Full snapshot history table
- Snapshot data powers the growth chart on the Dashboard

### Reports (`/reports`)

- Portfolio summary: total invested, current value, net P&L
- Asset allocation table grouped by investment type
- Expected interest earnings for bonds and fixed deposits
- Export investments as **CSV** or **Excel (.xlsx)** with computed P&L columns

### Settings (`/settings`)

- **Notion Integration** — connect a Notion workspace via API token and database ID
- **Essentials & Safety Net** — record term insurance cover, health cover, emergency fund target and current amount (surfaced on the Dashboard)
- **Data Management** — export a full JSON backup, restore from backup, or wipe all data

### Accounts (`/accounts`)

- Track bank accounts and credit cards with per-account balance
- Total liquid balance summary card
- Donut chart showing distribution across accounts
- Bar chart comparing balances side by side
- Full add / edit / delete support

### Agriculture (`/agriculture`)

A standalone farm management module with 6 tabs:

| Tab           | What it tracks                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| **Overview**  | Season-wise income, expenses, and net profit charts                                                       |
| **Crops**     | Crop cycles — sowing date, harvest, yield, P&L per season                                                 |
| **Expenses**  | Farm costs across 12 categories (seeds, fertilizer, labor, tractor fuel, irrigation, veterinary, etc.)    |
| **Livestock** | Animal register (cow, buffalo, goat, sheep, poultry) with events log (purchase, sale, vaccination, death) |
| **Milk**      | Daily milk production and sales records per animal                                                        |
| **Coconut**   | Harvest batch tracking with selling method and price per nut                                              |

---

## Imports

All importers are platform-specific parsers — no broker API access required.

| Platform  | Format             | Parser                                  |
| --------- | ------------------ | --------------------------------------- |
| Zerodha   | `.csv`             | `csvImport.ts`                          |
| Angel One | `.pdf` (statement) | `angelOnePdfImport.ts` via `pdfjs-dist` |
| Groww     | `.csv`             | `csvImport.ts` (Groww column mapping)   |
| INDmoney  | `.xlsx`            | `indmoneyXlsxImport.ts` via `exceljs`   |

### Generic CSV import format

Upload a `.csv` with a header row. Supported headers (case-sensitive):

```
Type          stock | mutual_fund | bond | fixed_deposit | other
Name
Symbol        (optional)
Platform      (optional)
```

Type-specific fields:

| Type            | Required fields                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `stock`         | `Quantity`, `BuyPrice`, `CurrentPrice`                                                                    |
| `mutual_fund`   | `Units`, `NAV`, `InvestedAmount`                                                                          |
| `bond`          | `InvestedAmount`, `InterestRate`, `DurationMonths`, `StartDate` (YYYY-MM-DD), `MaturityDate` (YYYY-MM-DD) |
| `fixed_deposit` | Same as bond + optional `BankName`                                                                        |
| `other`         | `InvestedAmount`, `CurrentValue`                                                                          |

---

## Notion Sync

Configured in **Settings → Notion Integration**. Sync is triggered manually from the Settings panel and runs via a Netlify serverless function (`netlify/functions/notion-sync.ts`).

Each sync push creates new pages in the target Notion database (no deduplication yet). The database must have these properties:

| Property          | Type              |
| ----------------- | ----------------- |
| `Name`            | title             |
| `Investment Type` | select            |
| `Amount Invested` | number            |
| `Expected Gain`   | number            |
| `Date Added`      | date              |
| `Interest Rate`   | number (optional) |
| `Duration`        | number (optional) |

---

## Data & Auth

- **Authentication**: Google Sign-In via Firebase Auth. All data is scoped to the authenticated user's UID in Firestore.
- **Backup**: Export all data as a JSON file from Settings. Restore by re-importing the same JSON.
- **Wipe**: One-click full data delete from Settings (removes all Firestore documents for the user).
- **NSE stock metadata**: 500+ NSE symbols with sector and market-cap classification are bundled in `src/data/nseStockdata.ts` — no external API needed for the allocation charts.
