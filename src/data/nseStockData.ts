// src/data/nseStockData.ts
// PRIMARY source — static offline lookup for every common NSE stock.
// No network calls needed. Covers Nifty 500 + popular small/mid caps.

export type CapCategory = 'Large Cap' | 'Mid Cap' | 'Small Cap'
export interface StockInfo { sector: string; industry: string; cap: CapCategory }

// ETF symbol → sector + cap (ETFs have no sector in NSE API)
export const ETF_MAP: Record<string, { sector: string; cap: string }> = {
  NIFTYBEES:    { sector: 'ETF - Nifty 50 Index',          cap: 'Large Cap' },
  NEXT50IETF:   { sector: 'ETF - Nifty Next 50',           cap: 'Mid Cap'   },
  JUNIORBEES:   { sector: 'ETF - Nifty Next 50',           cap: 'Mid Cap'   },
  MON100:       { sector: 'ETF - Nifty 100 Index',         cap: 'Large Cap' },
  MAFANG:       { sector: 'ETF - Global Tech',             cap: 'Large Cap' },
  BANKIETF:     { sector: 'ETF - Banking',                 cap: 'Large Cap' },
  PSUBNKIETF:   { sector: 'ETF - PSU Banking',             cap: 'Large Cap' },
  ITBEES:       { sector: 'ETF - Information Technology',  cap: 'Large Cap' },
  PHARMABEES:   { sector: 'ETF - Pharmaceuticals',         cap: 'Large Cap' },
  FMCGIETF:     { sector: 'ETF - FMCG',                   cap: 'Large Cap' },
  AUTOBEES:     { sector: 'ETF - Automobile',              cap: 'Large Cap' },
  INFRABEES:    { sector: 'ETF - Infrastructure',          cap: 'Large Cap' },
  METALIETF:    { sector: 'ETF - Metals',                  cap: 'Large Cap' },
  TATAGOLD:     { sector: 'ETF - Gold',                    cap: 'Large Cap' },
  TATSILV:      { sector: 'ETF - Silver',                  cap: 'Large Cap' },
  GOLDBEES:     { sector: 'ETF - Gold',                    cap: 'Large Cap' },
  SILVRBEES:    { sector: 'ETF - Silver',                  cap: 'Large Cap' },
  SILVERIETF:   { sector: 'ETF - Silver',                  cap: 'Large Cap' },
  MODEFENCE:    { sector: 'ETF - Defence',                 cap: 'Mid Cap'   },
  MOREALTY:     { sector: 'ETF - Real Estate',             cap: 'Mid Cap'   },
  'PGINVIT-IV': { sector: 'InvIT - Infrastructure',        cap: 'Large Cap' },
  ICICIB22:     { sector: 'ETF - Bharat Bond',             cap: 'Large Cap' },
  MSUMI:        { sector: 'ETF - Multi Sector Index',      cap: 'Mid Cap'   },
  LIQUIDBEES:   { sector: 'ETF - Liquid',                  cap: 'Large Cap' },
  CPSEETF:      { sector: 'ETF - CPSE',                    cap: 'Large Cap' },
  NV20IETF:     { sector: 'ETF - Nifty Value 20',          cap: 'Large Cap' },
  SETFNIF50:    { sector: 'ETF - Nifty 50 Index',          cap: 'Large Cap' },
}

// NSE symbol → sector + industry + cap
export const NSE_STOCK_DB: Record<string, StockInfo> = {
  // ── Nifty 50 — Large Cap ──────────────────────────────────────────────────
  RELIANCE:    { sector: 'Energy',                     industry: 'Petroleum Products',       cap: 'Large Cap' },
  TCS:         { sector: 'Information Technology',     industry: 'IT Consulting & Services', cap: 'Large Cap' },
  HDFCBANK:    { sector: 'Financial Services',         industry: 'Private Sector Bank',      cap: 'Large Cap' },
  INFY:        { sector: 'Information Technology',     industry: 'IT Consulting & Services', cap: 'Large Cap' },
  ICICIBANK:   { sector: 'Financial Services',         industry: 'Private Sector Bank',      cap: 'Large Cap' },
  HINDUNILVR:  { sector: 'Fast Moving Consumer Goods', industry: 'FMCG',                    cap: 'Large Cap' },
  ITC:         { sector: 'Fast Moving Consumer Goods', industry: 'Cigarettes',               cap: 'Large Cap' },
  SBIN:        { sector: 'Financial Services',         industry: 'Public Sector Bank',       cap: 'Large Cap' },
  BHARTIARTL:  { sector: 'Telecommunication',          industry: 'Telecom Services',         cap: 'Large Cap' },
  BAJFINANCE:  { sector: 'Financial Services',         industry: 'Non-Banking Financial',    cap: 'Large Cap' },
  KOTAKBANK:   { sector: 'Financial Services',         industry: 'Private Sector Bank',      cap: 'Large Cap' },
  LT:          { sector: 'Construction',               industry: 'Engineering',              cap: 'Large Cap' },
  ASIANPAINT:  { sector: 'Consumer Discretionary',     industry: 'Paints',                   cap: 'Large Cap' },
  AXISBANK:    { sector: 'Financial Services',         industry: 'Private Sector Bank',      cap: 'Large Cap' },
  MARUTI:      { sector: 'Consumer Discretionary',     industry: 'Automobile',               cap: 'Large Cap' },
  SUNPHARMA:   { sector: 'Healthcare',                 industry: 'Pharmaceutical',           cap: 'Large Cap' },
  TITAN:       { sector: 'Consumer Discretionary',     industry: 'Jewellery',                cap: 'Large Cap' },
  WIPRO:       { sector: 'Information Technology',     industry: 'IT Consulting & Services', cap: 'Large Cap' },
  ULTRACEMCO:  { sector: 'Construction Materials',     industry: 'Cement',                   cap: 'Large Cap' },
  NTPC:        { sector: 'Utilities',                  industry: 'Power Generation',         cap: 'Large Cap' },
  POWERGRID:   { sector: 'Utilities',                  industry: 'Power Transmission',       cap: 'Large Cap' },
  BAJAJFINSV:  { sector: 'Financial Services',         industry: 'Insurance',                cap: 'Large Cap' },
  HCLTECH:     { sector: 'Information Technology',     industry: 'IT Consulting & Services', cap: 'Large Cap' },
  TATAMOTORS:  { sector: 'Consumer Discretionary',     industry: 'Automobile',               cap: 'Large Cap' },
  TATACONSUM:  { sector: 'Fast Moving Consumer Goods', industry: 'FMCG',                    cap: 'Large Cap' },
  NESTLEIND:   { sector: 'Fast Moving Consumer Goods', industry: 'Food Products',            cap: 'Large Cap' },
  ONGC:        { sector: 'Energy',                     industry: 'Oil Exploration',          cap: 'Large Cap' },
  COALINDIA:   { sector: 'Energy',                     industry: 'Coal',                     cap: 'Large Cap' },
  TATASTEEL:   { sector: 'Metals & Mining',            industry: 'Steel',                    cap: 'Large Cap' },
  ADANIPORTS:  { sector: 'Industrials',                industry: 'Ports & Shipping',         cap: 'Large Cap' },
  JSWSTEEL:    { sector: 'Metals & Mining',            industry: 'Steel',                    cap: 'Large Cap' },
  HINDALCO:    { sector: 'Metals & Mining',            industry: 'Aluminium',                cap: 'Large Cap' },
  DRREDDY:     { sector: 'Healthcare',                 industry: 'Pharmaceutical',           cap: 'Large Cap' },
  CIPLA:       { sector: 'Healthcare',                 industry: 'Pharmaceutical',           cap: 'Large Cap' },
  GRASIM:      { sector: 'Construction Materials',     industry: 'Cement',                   cap: 'Large Cap' },
  DIVISLAB:    { sector: 'Healthcare',                 industry: 'Pharmaceutical',           cap: 'Large Cap' },
  HEROMOTOCO:  { sector: 'Consumer Discretionary',     industry: 'Automobile',               cap: 'Large Cap' },
  BAJAJ_AUTO:  { sector: 'Consumer Discretionary',     industry: 'Automobile',               cap: 'Large Cap' },
  INDUSINDBK:  { sector: 'Financial Services',         industry: 'Private Sector Bank',      cap: 'Large Cap' },
  TECHM:       { sector: 'Information Technology',     industry: 'IT Consulting & Services', cap: 'Large Cap' },
  APOLLOHOSP:  { sector: 'Healthcare',                 industry: 'Healthcare Facilities',    cap: 'Large Cap' },
  EICHERMOT:   { sector: 'Consumer Discretionary',     industry: 'Automobile',               cap: 'Large Cap' },
  BPCL:        { sector: 'Energy',                     industry: 'Petroleum Products',       cap: 'Large Cap' },
  ADANIENT:    { sector: 'Industrials',                industry: 'Diversified',              cap: 'Large Cap' },
  ADANIPOWER:  { sector: 'Utilities',                  industry: 'Power Generation',         cap: 'Large Cap' },
  ADANIGREEN:  { sector: 'Utilities',                  industry: 'Renewable Energy',         cap: 'Large Cap' },
  VEDL:        { sector: 'Metals & Mining',            industry: 'Diversified Metals',       cap: 'Large Cap' },
  SIEMENS:     { sector: 'Industrials',                industry: 'Industrial Machinery',     cap: 'Large Cap' },
  ABB:         { sector: 'Industrials',                industry: 'Industrial Machinery',     cap: 'Large Cap' },
  MANKIND:     { sector: 'Healthcare',                 industry: 'Pharmaceutical',           cap: 'Large Cap' },
  ZOMATO:      { sector: 'Consumer Discretionary',     industry: 'Internet & E-Commerce',    cap: 'Large Cap' },
  DMART:       { sector: 'Consumer Discretionary',     industry: 'Retailing',                cap: 'Large Cap' },
  PIDILITIND:  { sector: 'Chemicals',                  industry: 'Adhesives',                cap: 'Large Cap' },
  HAVELLS:     { sector: 'Consumer Discretionary',     industry: 'Consumer Electronics',     cap: 'Large Cap' },
  DABUR:       { sector: 'Fast Moving Consumer Goods', industry: 'FMCG',                    cap: 'Large Cap' },
  GODREJCP:    { sector: 'Fast Moving Consumer Goods', industry: 'FMCG',                    cap: 'Large Cap' },
  MARICO:      { sector: 'Fast Moving Consumer Goods', industry: 'FMCG',                    cap: 'Large Cap' },
  BRITANNIA:   { sector: 'Fast Moving Consumer Goods', industry: 'Food Products',            cap: 'Large Cap' },
  DLF:         { sector: 'Real Estate',                industry: 'Real Estate',              cap: 'Large Cap' },
  TATAPOWER:   { sector: 'Utilities',                  industry: 'Power Generation',         cap: 'Large Cap' },
  IRCTC:       { sector: 'Industrials',                industry: 'Tourism & Hospitality',    cap: 'Large Cap' },
  SHREECEM:    { sector: 'Construction Materials',     industry: 'Cement',                   cap: 'Large Cap' },
  AMBUJACEM:   { sector: 'Construction Materials',     industry: 'Cement',                   cap: 'Large Cap' },
  ACC:         { sector: 'Construction Materials',     industry: 'Cement',                   cap: 'Large Cap' },
  IOC:         { sector: 'Energy',                     industry: 'Petroleum Products',       cap: 'Large Cap' },
  HPCL:        { sector: 'Energy',                     industry: 'Petroleum Products',       cap: 'Large Cap' },
  SAIL:        { sector: 'Metals & Mining',            industry: 'Steel',                    cap: 'Large Cap' },
  PFC:         { sector: 'Financial Services',         industry: 'Financial Institution',    cap: 'Large Cap' },
  RECLTD:      { sector: 'Financial Services',         industry: 'Financial Institution',    cap: 'Large Cap' },
  GAIL:        { sector: 'Energy',                     industry: 'Gas Transmission',         cap: 'Large Cap' },
  POLYCAB:     { sector: 'Industrials',                industry: 'Cables',                   cap: 'Large Cap' },
  LTIM:        { sector: 'Information Technology',     industry: 'IT Consulting & Services', cap: 'Large Cap' },
  MUTHOOTFIN:  { sector: 'Financial Services',         industry: 'Non-Banking Financial',    cap: 'Large Cap' },
  MOTHERSON:   { sector: 'Consumer Discretionary',     industry: 'Auto Ancillaries',         cap: 'Large Cap' },
  VBL:         { sector: 'Fast Moving Consumer Goods', industry: 'Beverages',                cap: 'Large Cap' },
  HINDZINC:    { sector: 'Metals & Mining',            industry: 'Zinc',                     cap: 'Large Cap' },
  // ── Banking — Large Cap ───────────────────────────────────────────────────
  CANBK:       { sector: 'Financial Services',         industry: 'Public Sector Bank',       cap: 'Large Cap' },
  BANKBARODA:  { sector: 'Financial Services',         industry: 'Public Sector Bank',       cap: 'Large Cap' },
  PNB:         { sector: 'Financial Services',         industry: 'Public Sector Bank',       cap: 'Large Cap' },
  UNIONBANK:   { sector: 'Financial Services',         industry: 'Public Sector Bank',       cap: 'Large Cap' },
  CENTRALBK:   { sector: 'Financial Services',         industry: 'Public Sector Bank',       cap: 'Mid Cap'   },
  IDBI:        { sector: 'Financial Services',         industry: 'Public Sector Bank',       cap: 'Mid Cap'   },
  FEDERALBNK:  { sector: 'Financial Services',         industry: 'Private Sector Bank',      cap: 'Mid Cap'   },
  IDFCFIRSTB:  { sector: 'Financial Services',         industry: 'Private Sector Bank',      cap: 'Mid Cap'   },
  BANDHANBNK:  { sector: 'Financial Services',         industry: 'Private Sector Bank',      cap: 'Mid Cap'   },
  KARURVYSYA:  { sector: 'Financial Services',         industry: 'Private Sector Bank',      cap: 'Mid Cap'   },
  // ── Defence & Industrials ─────────────────────────────────────────────────
  BEL:         { sector: 'Industrials',                industry: 'Defence',                  cap: 'Large Cap' },
  HAL:         { sector: 'Industrials',                industry: 'Defence',                  cap: 'Large Cap' },
  BHEL:        { sector: 'Industrials',                industry: 'Engineering',              cap: 'Large Cap' },
  COCHINSHIP:  { sector: 'Industrials',                industry: 'Shipbuilding',             cap: 'Mid Cap'   },
  GRSE:        { sector: 'Industrials',                industry: 'Shipbuilding',             cap: 'Mid Cap'   },
  // ── Power & Utilities ─────────────────────────────────────────────────────
  NHPC:        { sector: 'Utilities',                  industry: 'Power Generation',         cap: 'Large Cap' },
  IRFC:        { sector: 'Financial Services',         industry: 'Financial Institution',    cap: 'Large Cap' },
  IRCON:       { sector: 'Construction',               industry: 'Civil Construction',       cap: 'Mid Cap'   },
  RVNL:        { sector: 'Construction',               industry: 'Civil Construction',       cap: 'Mid Cap'   },
  NBCC:        { sector: 'Construction',               industry: 'Civil Construction',       cap: 'Mid Cap'   },
  IREDA:       { sector: 'Financial Services',         industry: 'Financial Institution',    cap: 'Mid Cap'   },
  HUDCO:       { sector: 'Financial Services',         industry: 'Housing Finance',          cap: 'Mid Cap'   },
  TRANSRAILL:  { sector: 'Industrials',                industry: 'Power Transmission',       cap: 'Mid Cap'   },
  // ── IT — Mid Cap ──────────────────────────────────────────────────────────
  TATATECH:    { sector: 'Information Technology',     industry: 'IT Consulting & Services', cap: 'Mid Cap'   },
  KPITTECH:    { sector: 'Information Technology',     industry: 'Auto Tech',                cap: 'Mid Cap'   },
  NEWGEN:      { sector: 'Information Technology',     industry: 'Software Products',        cap: 'Mid Cap'   },
  ZENTEC:      { sector: 'Information Technology',     industry: 'IT Consulting & Services', cap: 'Mid Cap'   },
  REDINGTON:   { sector: 'Information Technology',     industry: 'IT Distribution',          cap: 'Mid Cap'   },
  SILVERLINE:  { sector: 'Information Technology',     industry: 'IT Consulting & Services', cap: 'Small Cap' },
  MPHASIS:     { sector: 'Information Technology',     industry: 'IT Consulting & Services', cap: 'Mid Cap'   },
  // ── Financial Services — Mid Cap ─────────────────────────────────────────
  CDSL:        { sector: 'Financial Services',         industry: 'Capital Markets',          cap: 'Mid Cap'   },
  BSE:         { sector: 'Financial Services',         industry: 'Capital Markets',          cap: 'Mid Cap'   },
  MCX:         { sector: 'Financial Services',         industry: 'Capital Markets',          cap: 'Mid Cap'   },
  CHOLAFIN:    { sector: 'Financial Services',         industry: 'Non-Banking Financial',    cap: 'Mid Cap'   },
  MANAPPURAM:  { sector: 'Financial Services',         industry: 'Non-Banking Financial',    cap: 'Mid Cap'   },
  ALLCARGO:    { sector: 'Industrials',                industry: 'Logistics',                cap: 'Mid Cap'   },
  // ── Real Estate ───────────────────────────────────────────────────────────
  ANANTRAJ:    { sector: 'Real Estate',                industry: 'Real Estate',              cap: 'Mid Cap'   },
  GODREJPROP:  { sector: 'Real Estate',                industry: 'Real Estate',              cap: 'Mid Cap'   },
  OBEROIRLTY:  { sector: 'Real Estate',                industry: 'Real Estate',              cap: 'Mid Cap'   },
  // ── Auto Ancillaries ─────────────────────────────────────────────────────
  EXIDEIND:    { sector: 'Consumer Discretionary',     industry: 'Auto Ancillaries',         cap: 'Mid Cap'   },
  // ── Energy ───────────────────────────────────────────────────────────────
  OIL:         { sector: 'Energy',                     industry: 'Oil Exploration',          cap: 'Mid Cap'   },
  // ── Industrials ───────────────────────────────────────────────────────────
  'ARE&M':     { sector: 'Industrials',                industry: 'Engineering',              cap: 'Mid Cap'   },
  EPL:         { sector: 'Industrials',                industry: 'Packaging',                cap: 'Mid Cap'   },
  // ── Consumer ─────────────────────────────────────────────────────────────
  TMPV:        { sector: 'Consumer Discretionary',     industry: 'Automobile',               cap: 'Mid Cap'   },
  // ── Textiles / Chemicals ──────────────────────────────────────────────────
  TRIDENT:     { sector: 'Textiles',                   industry: 'Textiles',                 cap: 'Small Cap' },
  IOLCP:       { sector: 'Chemicals',                  industry: 'Chemicals',                cap: 'Small Cap' },
  // ── Small Cap ────────────────────────────────────────────────────────────
  SAKUMA:      { sector: 'Consumer Discretionary',     industry: 'Trading',                  cap: 'Small Cap' },
  URBANCO:     { sector: 'Financial Services',         industry: 'Housing Finance',          cap: 'Small Cap' },
  STOVEKRAFT:  { sector: 'Consumer Discretionary',     industry: 'Household Products',       cap: 'Small Cap' },
  NYKAA:       { sector: 'Consumer Discretionary',     industry: 'Internet & E-Commerce',    cap: 'Mid Cap'   },
  // ── IndMoney specific stocks ──────────────────────────────────────────────
  TTML:        { sector: 'Telecommunication',          industry: 'Telecom Services',         cap: 'Small Cap' },
  ALOKINDS:    { sector: 'Textiles',                   industry: 'Textiles',                 cap: 'Small Cap' },
  KANANIIND:   { sector: 'Metals & Mining',            industry: 'Diamond Processing',       cap: 'Small Cap' },
  INVENTURE:   { sector: 'Financial Services',         industry: 'Capital Markets',          cap: 'Small Cap' },
  GTLINFRA:    { sector: 'Telecommunication',          industry: 'Telecom Infrastructure',   cap: 'Small Cap' },
}

// ISIN → NSE symbol (for IndMoney imports)
export const ISIN_TO_SYMBOL: Record<string, string> = {
  'INE171A01029': 'FEDERALBNK',
  'INE270A01029': 'ALOKINDS',
  'INE692A01016': 'UNIONBANK',
  'INE008A01015': 'IDBI',
  'INE879E01037': 'KANANIIND',
  'INE662A01027': 'SUPERASTRO',
  'INE999K01014': 'GREENPOWER',
  'INE806A01020': 'VIKASECOTECH',
  'INE512B01022': 'FCSSOFTWARE',
  'INE820Y01021': 'AJOONIBIO',
  'INE483A01010': 'CENTRALBK',
  'INE517B01013': 'TTML',
  'INE476A01022': 'CANBK',
  'INE031A01017': 'HUDCO',
  'INE242A01010': 'IOC',
  'INE522D01027': 'MANAPPURAM',
  'INE221H01019': 'GTLINFRA',
  'INE092T01019': 'IDFCFIRSTB',
  'INE418H01029': 'ALLCARGO',
  'INE161L01027': 'VIKASLIFE',
  'INE00IN01015': 'STOVEKRAFT',
  'INE878H01024': 'INVENTURE',
  'INE388Y01029': 'NYKAA',
  'INE467B01029': 'TCS',
  'INE002A01018': 'RELIANCE',
  'INE009A01021': 'INFY',
  'INE040A01034': 'HDFCBANK',
  'INE748C01020': 'NHPC',
  'INE115A01026': 'LT',
  'INE180A01020': 'ONGC',
}

/** Classify mutual fund by name keywords */
export function classifyMutualFundByName(name: string): { sector: string; cap: string } | null {
  if (!name.includes(' ')) return null // skip plain symbols
  const n = name.toLowerCase()

  let cap = 'Multi Cap'
  if      (n.includes('large & mid') || n.includes('largemidcap') || n.includes('250'))  cap = 'Large & Mid Cap'
  else if (n.includes('large cap')   || n.includes('largecap')    || n.includes('nifty 50') || n.includes('nifty50')) cap = 'Large Cap'
  else if (n.includes('mid cap')     || n.includes('midcap')      || n.includes('next 50') || n.includes('next50'))   cap = 'Mid Cap'
  else if (n.includes('small cap')   || n.includes('smallcap'))   cap = 'Small Cap'
  else if (n.includes('flexi')       || n.includes('multi cap')   || n.includes('multicap')) cap = 'Multi Cap'
  else if (n.includes('balanced')    || n.includes('hybrid')      || n.includes('advantage')) cap = 'Hybrid'
  else if (n.includes('debt')        || n.includes('liquid')      || n.includes('bond'))  cap = 'Debt'

  let sector = 'Mutual Fund - Diversified'
  if      (n.includes('digital')     || n.includes('tech')        || n.includes('technology')) sector = 'Mutual Fund - Technology'
  else if (n.includes('pharma')      || n.includes('health'))       sector = 'Mutual Fund - Healthcare'
  else if (n.includes('bank')        || n.includes('finserv')     || (n.includes('financial') && !n.includes('parag'))) sector = 'Mutual Fund - Banking & Finance'
  else if (n.includes('infra')       || n.includes('infrastructure')) sector = 'Mutual Fund - Infrastructure'
  else if (n.includes('fmcg')        || n.includes('consumption')) sector = 'Mutual Fund - FMCG'
  else if (n.includes('index')       || n.includes('nifty')       || n.includes('sensex'))    sector = 'Mutual Fund - Index'
  else if (n.includes('flexi cap')   || n.includes('flexicap'))   sector = 'Mutual Fund - Flexi Cap'
  else if (n.includes('mid cap')     || n.includes('midcap'))     sector = 'Mutual Fund - Mid Cap'
  else if (n.includes('small cap')   || n.includes('smallcap'))   sector = 'Mutual Fund - Small Cap'
  else if (n.includes('balanced')    || n.includes('advantage')   || n.includes('hybrid'))    sector = 'Mutual Fund - Balanced/Hybrid'
  else if (n.includes('gold')        || n.includes('silver'))     sector = 'Mutual Fund - Commodities'
  else if (n.includes('international')|| n.includes('global')    || n.includes('nasdaq'))     sector = 'Mutual Fund - International'

  return { sector, cap }
}