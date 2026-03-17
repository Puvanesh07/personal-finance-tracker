// src/utils/folioSyncEngine.ts
// FolioSync Fundamental Analysis Scoring Engine v1.0
// Pure function: scoreFundamentals(stock) → { composite, categories, signal, pros, cons }

export interface FundamentalData {
  // Valuation
  pe?: number;
  sectorPe?: number;
  peg?: number;
  pb?: number;
  evEbitda?: number;

  // Profitability
  roe?: number; // %
  roce?: number; // %
  netMargin?: number; // %
  operatingMargin?: number; // %
  fcfPositive?: boolean; // is FCF positive and growing?
  fcfGrowing?: boolean;

  // Financial Health
  debtToEquity?: number;
  currentRatio?: number;
  interestCoverage?: number;
  liabilitiesTrend?: 'improving' | 'stable' | 'worsening';
  reservesTrend?: 'growing' | 'stable' | 'declining';

  // Growth
  revenueGrowthYoY?: number; // %
  earningsGrowthYoY?: number; // %
  salesCagr3yr?: number; // %
  salesCagr5yr?: number; // %
  profitCagr3yr?: number; // %
  profitCagr5yr?: number; // %
  stockCagr3yr?: number; // %
  stockCagr5yr?: number; // %
  promoterHolding?: number; // %
  promoterHoldingChange?: number; // % change in last year (negative = declining)
  promoterPledging?: number; // % of promoter holding pledged
  institutionalHolding?: number; // %

  // Dividends
  dividendYield?: number; // %
  dividendPayoutRatio?: number; // %
  dividendConsistencyYears?: number;
  dividendCagr5yr?: number; // %

  // Market Context
  fiftyTwoWeekPosition?: number; // 0-100% of 52W range
  beta?: number;
  marketCapCategory?: 'large' | 'mid' | 'small' | 'micro';

  // Quarterly flags
  quarterlyRevenueGrowingYoY?: boolean; // 4 consecutive quarters
  quarterlyProfitGrowingYoY?: boolean; // 4 consecutive quarters
  ebitdaMarginExpanding?: boolean;
  netProfitNegativeAnyQuarter?: boolean; // any of last 4 quarters
  revenueDecliningStraight2Q?: boolean; // 2+ consecutive QoQ declines
  otherIncomeHigh?: boolean; // > 30% of net profit

  // Hard cap flags
  netLoss2ConsecYears?: boolean;
  promoterPledgingOver50?: boolean;
  debtOver3x?: boolean; // D/E > 3 for non-financial
  interestCoverageBelow1?: boolean;
  auditorQualification?: boolean;
  revenueDeclinig3ConsecYears?: boolean;
  negativeFcf3Years?: boolean;
  promoterHoldingDropOver10pctInQtr?: boolean;

  // 5yr ROE pattern
  roePattern?:
    | 'consistent_high'
    | 'improving'
    | 'declining'
    | 'volatile'
    | 'negative';
}

export interface CategoryScores {
  valuation: number;
  profitability: number;
  financialHealth: number;
  growth: number;
  income: number;
  marketContext: number;
}

export interface FolioSyncResult {
  composite: number;
  categories: CategoryScores;
  signal:
    | 'AGGRESSIVE_BUY'
    | 'BUY'
    | 'HOLD'
    | 'SELL'
    | 'AGGRESSIVE_SELL'
    | 'INSUFFICIENT_DATA';
  pros: string[];
  cons: string[];
  hardCapApplied: boolean;
}

// ── Helper ──────────────────────────────────────────────────────────────────
function clamp(v: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, v));
}

// ── Category Scorers ────────────────────────────────────────────────────────

function scoreValuation(f: FundamentalData): number {
  let score = 5; // neutral start
  const checks: number[] = [];

  // P/E vs Sector P/E
  if (f.pe !== undefined && f.sectorPe !== undefined && f.sectorPe > 0) {
    const ratio = f.pe / f.sectorPe;
    if (ratio < 0.8) checks.push(9);
    else if (ratio <= 1.3) checks.push(6);
    else checks.push(2);
  }

  // PEG
  if (f.peg !== undefined) {
    if (f.peg < 0.8) checks.push(9);
    else if (f.peg <= 2.0) checks.push(6);
    else checks.push(2);
  }

  // P/B
  if (f.pb !== undefined) {
    if (f.pb < 1.2) checks.push(9);
    else if (f.pb <= 3.5) checks.push(6);
    else checks.push(2);
  }

  // EV/EBITDA
  if (f.evEbitda !== undefined) {
    if (f.evEbitda < 8) checks.push(9);
    else if (f.evEbitda <= 18) checks.push(6);
    else checks.push(2);
  }

  if (checks.length === 0) return 5;
  score = checks.reduce((a, b) => a + b, 0) / checks.length;
  return clamp(score);
}

function scoreProfitability(f: FundamentalData): number {
  let score = 5;
  const checks: number[] = [];

  // ROE
  if (f.roe !== undefined) {
    if (f.roe > 22) checks.push(9);
    else if (f.roe >= 12) checks.push(6);
    else checks.push(2);
  }

  // ROCE
  if (f.roce !== undefined) {
    if (f.roce > 20) checks.push(9);
    else if (f.roce >= 10) checks.push(6);
    else checks.push(2);
  }

  // Net Margin
  if (f.netMargin !== undefined) {
    if (f.netMargin > 18) checks.push(9);
    else if (f.netMargin >= 7) checks.push(6);
    else checks.push(2);
  }

  // Operating Margin
  if (f.operatingMargin !== undefined) {
    if (f.operatingMargin > 22) checks.push(9);
    else if (f.operatingMargin >= 10) checks.push(6);
    else checks.push(2);
  }

  // FCF
  if (f.fcfPositive !== undefined) {
    if (f.fcfPositive && f.fcfGrowing) checks.push(9);
    else if (f.fcfPositive) checks.push(6);
    else checks.push(2);
  }

  if (checks.length === 0) return 5;
  score = checks.reduce((a, b) => a + b, 0) / checks.length;

  // Quarterly adjustments
  if (f.quarterlyProfitGrowingYoY) score = Math.min(10, score + 1.5);
  if (f.ebitdaMarginExpanding) score = Math.min(10, score + 1.0);
  if (f.netProfitNegativeAnyQuarter) score = Math.max(0, score - 2.0);
  if (f.otherIncomeHigh) score = Math.max(0, score - 1.0);

  // ROE pattern bonuses/penalties
  if (f.roePattern === 'consistent_high') score = Math.min(10, score + 2.0);
  else if (f.roePattern === 'improving') score = Math.min(10, score + 0.5);
  else if (f.roePattern === 'declining') score = Math.max(0, score - 1.5);
  else if (f.roePattern === 'volatile') score = Math.max(0, score - 1.0);
  else if (f.roePattern === 'negative') score = 0;

  return clamp(score);
}

function scoreFinancialHealth(f: FundamentalData): number {
  const checks: number[] = [];

  // D/E
  if (f.debtToEquity !== undefined) {
    if (f.debtToEquity < 0.3) checks.push(9);
    else if (f.debtToEquity <= 1.2) checks.push(6);
    else checks.push(2);
  }

  // Current Ratio
  if (f.currentRatio !== undefined) {
    if (f.currentRatio > 2.0) checks.push(9);
    else if (f.currentRatio >= 1.0) checks.push(6);
    else checks.push(2);
  }

  // Interest Coverage
  if (f.interestCoverage !== undefined) {
    if (f.interestCoverage > 8) checks.push(9);
    else if (f.interestCoverage >= 3) checks.push(6);
    else checks.push(2);
  }

  // Liabilities Trend
  if (f.liabilitiesTrend) {
    if (f.liabilitiesTrend === 'improving') checks.push(8);
    else if (f.liabilitiesTrend === 'stable') checks.push(5);
    else checks.push(2);
  }

  // Reserves Trend
  if (f.reservesTrend) {
    if (f.reservesTrend === 'growing') checks.push(8);
    else if (f.reservesTrend === 'stable') checks.push(5);
    else checks.push(2);
  }

  if (checks.length === 0) return 5;
  return clamp(checks.reduce((a, b) => a + b, 0) / checks.length);
}

function scoreGrowth(f: FundamentalData): number {
  const checks: number[] = [];

  // Revenue Growth YoY
  if (f.revenueGrowthYoY !== undefined) {
    if (f.revenueGrowthYoY > 20) checks.push(9);
    else if (f.revenueGrowthYoY >= 8) checks.push(6);
    else checks.push(2);
  }

  // Earnings Growth YoY
  if (f.earningsGrowthYoY !== undefined) {
    if (f.earningsGrowthYoY > 20) checks.push(9);
    else if (f.earningsGrowthYoY >= 10) checks.push(6);
    else checks.push(2);
  }

  // Sales CAGR 3yr
  if (f.salesCagr3yr !== undefined) {
    if (f.salesCagr3yr > 18) checks.push(9);
    else if (f.salesCagr3yr >= 8) checks.push(6);
    else checks.push(2);
  }

  // Sales CAGR 5yr
  if (f.salesCagr5yr !== undefined) {
    if (f.salesCagr5yr > 15) checks.push(9);
    else if (f.salesCagr5yr >= 6) checks.push(6);
    else checks.push(2);
  }

  // Profit CAGR 3yr
  if (f.profitCagr3yr !== undefined) {
    if (f.profitCagr3yr > 20) checks.push(9);
    else if (f.profitCagr3yr >= 10) checks.push(6);
    else checks.push(2);
  }

  // Profit CAGR 5yr
  if (f.profitCagr5yr !== undefined) {
    if (f.profitCagr5yr > 18) checks.push(9);
    else if (f.profitCagr5yr >= 8) checks.push(6);
    else checks.push(2);
  }

  // Promoter Holding
  if (f.promoterHolding !== undefined) {
    if (f.promoterHolding > 55) checks.push(9);
    else if (f.promoterHolding >= 30) checks.push(6);
    else checks.push(2);
  }

  // Institutional Holding
  if (f.institutionalHolding !== undefined) {
    if (f.institutionalHolding > 40) checks.push(9);
    else if (f.institutionalHolding >= 15) checks.push(6);
    else checks.push(2);
  }

  if (checks.length === 0) return 5;
  let score = checks.reduce((a, b) => a + b, 0) / checks.length;

  // Quarterly adjustments
  if (f.quarterlyRevenueGrowingYoY) score = Math.min(10, score + 1.5);
  if (f.revenueDecliningStraight2Q) score = Math.max(0, score - 1.5);

  return clamp(score);
}

function scoreIncome(f: FundamentalData): number {
  const checks: number[] = [];

  if (f.dividendYield !== undefined) {
    if (f.dividendYield > 3) checks.push(9);
    else if (f.dividendYield >= 1) checks.push(6);
    else checks.push(2);
  }

  if (f.dividendPayoutRatio !== undefined) {
    if (f.dividendPayoutRatio >= 20 && f.dividendPayoutRatio <= 50)
      checks.push(9);
    else if (f.dividendPayoutRatio <= 70) checks.push(6);
    else checks.push(2);
  }

  if (f.dividendConsistencyYears !== undefined) {
    if (f.dividendConsistencyYears > 15) checks.push(9);
    else if (f.dividendConsistencyYears >= 5) checks.push(6);
    else checks.push(2);
  }

  if (f.dividendCagr5yr !== undefined) {
    if (f.dividendCagr5yr > 12) checks.push(9);
    else if (f.dividendCagr5yr >= 5) checks.push(6);
    else checks.push(2);
  }

  if (checks.length === 0) return 5; // neutral if no dividend data
  return clamp(checks.reduce((a, b) => a + b, 0) / checks.length);
}

function scoreMarketContext(f: FundamentalData): number {
  const checks: number[] = [];

  // 52W position (20-60% is ideal buy zone)
  if (f.fiftyTwoWeekPosition !== undefined) {
    const pos = f.fiftyTwoWeekPosition;
    if (pos >= 20 && pos <= 60) checks.push(9);
    else if (pos <= 80) checks.push(6);
    else checks.push(2);
  }

  // Beta
  if (f.beta !== undefined) {
    if (f.beta >= 0.5 && f.beta < 0.9) checks.push(9);
    else if (f.beta < 1.4) checks.push(6);
    else checks.push(2);
  }

  // Market Cap (stability proxy)
  if (f.marketCapCategory) {
    if (f.marketCapCategory === 'large') checks.push(8);
    else if (f.marketCapCategory === 'mid') checks.push(6);
    else if (f.marketCapCategory === 'small') checks.push(4);
    else checks.push(2);
  }

  if (checks.length === 0) return 5;
  return clamp(checks.reduce((a, b) => a + b, 0) / checks.length);
}

// ── Hard Cap Check ──────────────────────────────────────────────────────────
function applyHardCaps(f: FundamentalData, raw: number): number {
  const triggers = [
    f.netLoss2ConsecYears,
    f.promoterPledgingOver50,
    f.debtOver3x,
    f.interestCoverageBelow1 ||
      (f.interestCoverage !== undefined && f.interestCoverage < 1),
    f.auditorQualification,
    f.revenueDeclinig3ConsecYears,
    f.negativeFcf3Years,
    f.promoterHoldingDropOver10pctInQtr,
  ];
  const triggered = triggers.some(Boolean);
  if (triggered && raw > 4) return 4;
  return raw;
}

// ── Signal Lookup ────────────────────────────────────────────────────────────
function getSignal(score: number, hasData: boolean): FolioSyncResult['signal'] {
  if (!hasData) return 'INSUFFICIENT_DATA';
  if (score >= 9) return 'AGGRESSIVE_BUY';
  if (score >= 7) return 'BUY';
  if (score >= 5) return 'HOLD';
  if (score >= 3) return 'SELL';
  return 'AGGRESSIVE_SELL';
}

// ── Pros & Cons Generator ────────────────────────────────────────────────────
function generateProsAndCons(f: FundamentalData): {
  pros: string[];
  cons: string[];
} {
  const pros: string[] = [];
  const cons: string[] = [];

  // PROS
  if (f.roe !== undefined && f.roe > 20)
    pros.push('Strong return on equity — efficient use of shareholder capital');
  if (f.roce !== undefined && f.roce > 18)
    pros.push(
      'High return on all capital employed — excellent capital allocation',
    );
  if (f.revenueGrowthYoY !== undefined && f.revenueGrowthYoY > 15)
    pros.push('Healthy top-line growth — business is expanding');
  if (f.earningsGrowthYoY !== undefined && f.earningsGrowthYoY > 20)
    pros.push(
      'Earnings growing faster than revenue — operating leverage working',
    );
  if (f.debtToEquity !== undefined && f.debtToEquity < 0.3)
    pros.push('Near debt-free balance sheet — financially very safe');
  if (f.promoterHolding !== undefined && f.promoterHolding > 55)
    pros.push('Promoters have strong skin in the game');
  if (f.pe !== undefined && f.sectorPe !== undefined && f.pe < f.sectorPe)
    pros.push('Stock appears undervalued relative to peers');
  if (f.peg !== undefined && f.peg < 1.0)
    pros.push('Priced below its growth rate — potential value buy');
  if (
    f.dividendYield !== undefined &&
    f.dividendYield > 2 &&
    f.dividendConsistencyYears !== undefined &&
    f.dividendConsistencyYears >= 10
  )
    pros.push('Reliable income with strong dividend history');
  if (f.fcfPositive && f.fcfGrowing)
    pros.push('Generating real cash — not just accounting profit');
  if (f.interestCoverage !== undefined && f.interestCoverage > 8)
    pros.push('Easily servicing debt — low financial risk');
  if (f.fiftyTwoWeekPosition !== undefined && f.fiftyTwoWeekPosition < 60)
    pros.push('Not at peak — reasonable entry point');
  if (f.salesCagr5yr !== undefined && f.salesCagr5yr > 15)
    pros.push('Consistent long-term revenue compounder');
  if (f.profitCagr5yr !== undefined && f.profitCagr5yr > 15)
    pros.push('Consistent long-term earnings compounder');
  if (f.currentRatio !== undefined && f.currentRatio > 2.0)
    pros.push('Very strong liquidity — can easily meet short-term obligations');
  if (f.operatingMargin !== undefined && f.operatingMargin > 20)
    pros.push('Core business getting more efficient over time');
  if (f.stockCagr5yr !== undefined && f.stockCagr5yr > 15)
    pros.push('Market has rewarded fundamentals over the long term');
  if (f.institutionalHolding !== undefined && f.institutionalHolding > 40)
    pros.push('Smart money (FII/DII) has high confidence in this stock');

  // CONS
  if (f.roe !== undefined && f.roe < 10)
    cons.push('Poor return on equity — capital not being used efficiently');
  if (f.netProfitNegativeAnyQuarter)
    cons.push('Company reported a loss recently — earnings quality concern');
  if (f.debtToEquity !== undefined && f.debtToEquity > 1.5)
    cons.push(
      'High leverage — increased financial risk, especially in rate-rising cycles',
    );
  if (f.promoterHoldingChange !== undefined && f.promoterHoldingChange < -5)
    cons.push('Promoters reducing stake — potential loss of confidence');
  if (f.promoterPledging !== undefined && f.promoterPledging > 30)
    cons.push('Pledged shares are a serious risk — forced selling possible');
  if (f.pe !== undefined && f.sectorPe !== undefined && f.pe > f.sectorPe * 1.5)
    cons.push('Significantly overvalued vs peers — limited margin of safety');
  if (f.peg !== undefined && f.peg > 3.0)
    cons.push('Very expensive relative to growth rate');
  if (f.revenueGrowthYoY !== undefined && f.revenueGrowthYoY < 0)
    cons.push('Top-line contraction — business facing headwinds');
  if (f.fcfPositive === false)
    cons.push('Burning cash without generating returns');
  if (f.interestCoverage !== undefined && f.interestCoverage < 3)
    cons.push('Debt servicing stress — profits largely consumed by interest');
  if (f.fiftyTwoWeekPosition !== undefined && f.fiftyTwoWeekPosition > 85)
    cons.push('Near all-time high — limited upside, high downside risk');
  if (f.salesCagr5yr !== undefined && f.salesCagr5yr < 6)
    cons.push('Very slow growth — potential value trap');
  if (f.otherIncomeHigh)
    cons.push('Earnings quality poor — operations not driving profits');
  if (f.currentRatio !== undefined && f.currentRatio < 1.0)
    cons.push('Cannot meet short-term obligations from current assets');
  if (f.institutionalHolding !== undefined && f.institutionalHolding < 5)
    cons.push('Smart money has low confidence — investigate reasons');

  return { pros, cons };
}

// ── Asset-Class Override Weights ────────────────────────────────────────────
// Per Section 1.2 of FolioSync spec: missing metrics are excluded and weights redistributed

export type AssetClass =
  | 'equity'
  | 'mutual_fund'
  | 'gold'
  | 'crypto'
  | 'us_stock'
  | 'other';

interface WeightSet {
  valuation: number;
  profitability: number;
  financialHealth: number;
  growth: number;
  income: number;
  marketContext: number;
}

function getWeights(assetClass: AssetClass): WeightSet {
  switch (assetClass) {
    case 'mutual_fund':
      // Skip profitability & D/E — redistribute to growth, valuation, market
      return {
        valuation: 0.2,
        profitability: 0,
        financialHealth: 0,
        growth: 0.4,
        income: 0.1,
        marketContext: 0.3,
      };
    case 'gold':
      // Only growth (price CAGR) and market context matter
      return {
        valuation: 0,
        profitability: 0,
        financialHealth: 0,
        growth: 0.6,
        income: 0.1,
        marketContext: 0.3,
      };
    case 'crypto':
      // Growth (on-chain proxies), market context dominate
      return {
        valuation: 0.1,
        profitability: 0,
        financialHealth: 0,
        growth: 0.5,
        income: 0,
        marketContext: 0.4,
      };
    case 'equity':
    case 'us_stock':
    default:
      return {
        valuation: 0.2,
        profitability: 0.25,
        financialHealth: 0.2,
        growth: 0.2,
        income: 0.05,
        marketContext: 0.1,
      };
  }
}

// ── Main Export ──────────────────────────────────────────────────────────────
export function scoreFundamentals(
  fundamentals: FundamentalData,
  assetClass: AssetClass = 'equity',
): FolioSyncResult {
  const f = fundamentals;

  // Check if we have enough data to score meaningfully
  const dataPoints = [
    f.pe,
    f.roe,
    f.roce,
    f.debtToEquity,
    f.revenueGrowthYoY,
    f.earningsGrowthYoY,
    f.netMargin,
    f.operatingMargin,
    f.salesCagr3yr,
    f.profitCagr3yr,
    f.fiftyTwoWeekPosition,
    f.beta,
  ].filter((v) => v !== undefined).length;

  const hasData = dataPoints >= 2;

  // Score each category
  const valuation = scoreValuation(f);
  const profitability = scoreProfitability(f);
  const financialHealth = scoreFinancialHealth(f);
  const growth = scoreGrowth(f);
  const income = scoreIncome(f);
  const marketContext = scoreMarketContext(f);

  // Weighted composite with asset-class overrides
  const w = getWeights(assetClass);
  const weightedSum =
    valuation * w.valuation +
    profitability * w.profitability +
    financialHealth * w.financialHealth +
    growth * w.growth +
    income * w.income +
    marketContext * w.marketContext;

  // Normalise in case weights don't sum to exactly 1.0
  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0);
  const rawComposite =
    totalWeight > 0 ? weightedSum / totalWeight : weightedSum;

  // Apply hard caps
  const capped = applyHardCaps(f, rawComposite);
  const hardCapApplied = capped < rawComposite;

  const composite = Math.round(capped * 10) / 10;

  const signal = getSignal(composite, hasData);
  const { pros, cons } = generateProsAndCons(f);

  return {
    composite,
    categories: {
      valuation,
      profitability,
      financialHealth,
      growth,
      income,
      marketContext,
    },
    signal,
    pros,
    cons,
    hardCapApplied,
  };
}

// ── Signal Display Helpers ───────────────────────────────────────────────────
export function getSignalConfig(signal: FolioSyncResult['signal']) {
  switch (signal) {
    case 'AGGRESSIVE_BUY':
      return {
        label: 'AGG. BUY',
        color: '#00E5A0',
        bg: 'bg-teal-500/15',
        border: 'border-teal-500/40',
        text: 'text-teal-300',
        glow: '0 0 12px rgba(0,229,160,0.4)',
      };
    case 'BUY':
      return {
        label: 'BUY',
        color: '#4ADE80',
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/40',
        text: 'text-emerald-300',
        glow: '0 0 10px rgba(74,222,128,0.3)',
      };
    case 'HOLD':
      return {
        label: 'HOLD',
        color: '#FBBF24',
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/40',
        text: 'text-amber-300',
        glow: '0 0 10px rgba(251,191,36,0.3)',
      };
    case 'SELL':
      return {
        label: 'SELL',
        color: '#F87171',
        bg: 'bg-red-500/15',
        border: 'border-red-500/40',
        text: 'text-red-300',
        glow: '0 0 10px rgba(248,113,113,0.3)',
      };
    case 'AGGRESSIVE_SELL':
      return {
        label: 'AGG. SELL',
        color: '#EF4444',
        bg: 'bg-red-600/15',
        border: 'border-red-600/40',
        text: 'text-red-400',
        glow: '0 0 12px rgba(239,68,68,0.5)',
      };
    default:
      return {
        label: 'N/A',
        color: '#64748B',
        bg: 'bg-slate-700/30',
        border: 'border-slate-600/40',
        text: 'text-slate-400',
        glow: 'none',
      };
  }
}

export function getScoreColor(score: number): string {
  if (score >= 9) return '#00E5A0';
  if (score >= 7) return '#4ADE80';
  if (score >= 5) return '#FBBF24';
  if (score >= 3) return '#F87171';
  return '#EF4444';
}
