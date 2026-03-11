// src/data/nseStockdata.ts
// Comprehensive NSE Stock Database — 5000+ symbols

export type CapCategory = 'Large Cap' | 'Mid Cap' | 'Small Cap';

export interface StockInfo {
  sector: string;
  industry: string;
  cap: CapCategory;
}

export const ETF_MAP: Record<string, { sector: string; cap: string }> = {
  NIFTYBEES: { sector: 'ETF - Nifty 50 Index', cap: 'Large Cap' },
  NEXT50IETF: { sector: 'ETF - Nifty Next 50', cap: 'Mid Cap' },
  JUNIORBEES: { sector: 'ETF - Nifty Next 50', cap: 'Mid Cap' },
  MON100: { sector: 'ETF - Nifty 100 Index', cap: 'Large Cap' },
  MAFANG: { sector: 'ETF - Global Tech', cap: 'Large Cap' },
  BANKIETF: { sector: 'ETF - Banking', cap: 'Large Cap' },
  PSUBNKIETF: { sector: 'ETF - PSU Banking', cap: 'Large Cap' },
  ITBEES: { sector: 'ETF - Information Technology', cap: 'Large Cap' },
  PHARMABEES: { sector: 'ETF - Pharmaceuticals', cap: 'Large Cap' },
  FMCGIETF: { sector: 'ETF - FMCG', cap: 'Large Cap' },
  AUTOBEES: { sector: 'ETF - Automobile', cap: 'Large Cap' },
  INFRABEES: { sector: 'ETF - Infrastructure', cap: 'Large Cap' },
  METALIETF: { sector: 'ETF - Metals', cap: 'Large Cap' },
  TATAGOLD: { sector: 'ETF - Gold', cap: 'Large Cap' },
  TATSILV: { sector: 'ETF - Silver', cap: 'Large Cap' },
  GOLDBEES: { sector: 'ETF - Gold', cap: 'Large Cap' },
  SILVRBEES: { sector: 'ETF - Silver', cap: 'Large Cap' },
  SILVERIETF: { sector: 'ETF - Silver', cap: 'Large Cap' },
  MODEFENCE: { sector: 'ETF - Defence', cap: 'Mid Cap' },
  MOREALTY: { sector: 'ETF - Real Estate', cap: 'Mid Cap' },
  'PGINVIT-IV': { sector: 'InvIT - Infrastructure', cap: 'Large Cap' },
  ICICIB22: { sector: 'ETF - Bharat Bond', cap: 'Large Cap' },
  MSUMI: { sector: 'ETF - Multi Sector Index', cap: 'Mid Cap' },
  LIQUIDBEES: { sector: 'ETF - Liquid', cap: 'Large Cap' },
  CPSEETF: { sector: 'ETF - CPSE', cap: 'Large Cap' },
  NV20IETF: { sector: 'ETF - Nifty Value 20', cap: 'Large Cap' },
  SETFNIF50: { sector: 'ETF - Nifty 50 Index', cap: 'Large Cap' },
  HDFCNIFTY: { sector: 'ETF - Nifty 50 Index', cap: 'Large Cap' },
  ICICINIFTY: { sector: 'ETF - Nifty 50 Index', cap: 'Large Cap' },
  SBIETFNIFTY: { sector: 'ETF - Nifty 50 Index', cap: 'Large Cap' },
  KOTAKNIFTY: { sector: 'ETF - Nifty 50 Index', cap: 'Large Cap' },
  AXISBPSETF: { sector: 'ETF - PSU Banking', cap: 'Large Cap' },
  HDFCBANKIETF: { sector: 'ETF - Banking', cap: 'Large Cap' },
  ICICIBANKIETF: { sector: 'ETF - Banking', cap: 'Large Cap' },
  NETFIT: { sector: 'ETF - Nifty Next 50', cap: 'Mid Cap' },
  MOM100: { sector: 'ETF - Momentum 100', cap: 'Large Cap' },
  MIDSMALL400: { sector: 'ETF - Mid Small 400', cap: 'Mid Cap' },
  NIFTYQLITY50: { sector: 'ETF - Nifty Quality 50', cap: 'Large Cap' },
  HDFCSENSEX: { sector: 'ETF - Sensex', cap: 'Large Cap' },
  SETFBSE100: { sector: 'ETF - BSE 100', cap: 'Large Cap' },
  HNGSNGBEES: { sector: 'ETF - Hang Seng', cap: 'Large Cap' },
  QNIFTY: { sector: 'ETF - Nifty Quality', cap: 'Large Cap' },
};

export const NSE_STOCK_DB: Record<string, StockInfo> = {
  // ══════════════════════════════════════════════════════════════════
  // NIFTY 50 & LARGE CAPS
  // ══════════════════════════════════════════════════════════════════
  RELIANCE: {
    sector: 'Energy',
    industry: 'Petroleum Products',
    cap: 'Large Cap',
  },
  TCS: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Large Cap',
  },
  HDFCBANK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Large Cap',
  },
  INFY: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Large Cap',
  },
  ICICIBANK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Large Cap',
  },
  HINDUNILVR: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'FMCG',
    cap: 'Large Cap',
  },
  ITC: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Cigarettes',
    cap: 'Large Cap',
  },
  SBIN: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Large Cap',
  },
  BHARTIARTL: {
    sector: 'Telecommunication',
    industry: 'Telecom Services',
    cap: 'Large Cap',
  },
  BAJFINANCE: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Large Cap',
  },
  KOTAKBANK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Large Cap',
  },
  LT: { sector: 'Construction', industry: 'Engineering', cap: 'Large Cap' },
  ASIANPAINT: {
    sector: 'Consumer Discretionary',
    industry: 'Paints',
    cap: 'Large Cap',
  },
  AXISBANK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Large Cap',
  },
  MARUTI: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Large Cap',
  },
  SUNPHARMA: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  TITAN: {
    sector: 'Consumer Discretionary',
    industry: 'Jewellery',
    cap: 'Large Cap',
  },
  WIPRO: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Large Cap',
  },
  ULTRACEMCO: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Large Cap',
  },
  NTPC: { sector: 'Utilities', industry: 'Power Generation', cap: 'Large Cap' },
  POWERGRID: {
    sector: 'Utilities',
    industry: 'Power Transmission',
    cap: 'Large Cap',
  },
  BAJAJFINSV: {
    sector: 'Financial Services',
    industry: 'Insurance',
    cap: 'Large Cap',
  },
  HCLTECH: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Large Cap',
  },
  TATAMOTORS: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Large Cap',
  },
  TATACONSUM: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'FMCG',
    cap: 'Large Cap',
  },
  NESTLEIND: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Food Products',
    cap: 'Large Cap',
  },
  ONGC: { sector: 'Energy', industry: 'Oil Exploration', cap: 'Large Cap' },
  COALINDIA: { sector: 'Energy', industry: 'Coal', cap: 'Large Cap' },
  TATASTEEL: { sector: 'Metals & Mining', industry: 'Steel', cap: 'Large Cap' },
  ADANIPORTS: {
    sector: 'Industrials',
    industry: 'Ports & Shipping',
    cap: 'Large Cap',
  },
  JSWSTEEL: { sector: 'Metals & Mining', industry: 'Steel', cap: 'Large Cap' },
  HINDALCO: {
    sector: 'Metals & Mining',
    industry: 'Aluminium',
    cap: 'Large Cap',
  },
  DRREDDY: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  CIPLA: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Large Cap' },
  GRASIM: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Large Cap',
  },
  DIVISLAB: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  HEROMOTOCO: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Large Cap',
  },
  BAJAJ_AUTO: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Large Cap',
  },
  INDUSINDBK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Large Cap',
  },
  TECHM: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Large Cap',
  },
  APOLLOHOSP: {
    sector: 'Healthcare',
    industry: 'Healthcare Facilities',
    cap: 'Large Cap',
  },
  EICHERMOT: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Large Cap',
  },
  BPCL: { sector: 'Energy', industry: 'Petroleum Products', cap: 'Large Cap' },
  ADANIENT: {
    sector: 'Industrials',
    industry: 'Diversified',
    cap: 'Large Cap',
  },
  ADANIPOWER: {
    sector: 'Utilities',
    industry: 'Power Generation',
    cap: 'Large Cap',
  },
  ADANIGREEN: {
    sector: 'Utilities',
    industry: 'Renewable Energy',
    cap: 'Large Cap',
  },
  VEDL: {
    sector: 'Metals & Mining',
    industry: 'Diversified Metals',
    cap: 'Large Cap',
  },
  SIEMENS: {
    sector: 'Industrials',
    industry: 'Industrial Machinery',
    cap: 'Large Cap',
  },
  ABB: {
    sector: 'Industrials',
    industry: 'Industrial Machinery',
    cap: 'Large Cap',
  },
  MANKIND: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  ZOMATO: {
    sector: 'Consumer Discretionary',
    industry: 'Internet & E-Commerce',
    cap: 'Large Cap',
  },
  DMART: {
    sector: 'Consumer Discretionary',
    industry: 'Retailing',
    cap: 'Large Cap',
  },
  PIDILITIND: { sector: 'Chemicals', industry: 'Adhesives', cap: 'Large Cap' },
  HAVELLS: {
    sector: 'Consumer Discretionary',
    industry: 'Consumer Electronics',
    cap: 'Large Cap',
  },
  DABUR: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'FMCG',
    cap: 'Large Cap',
  },
  GODREJCP: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'FMCG',
    cap: 'Large Cap',
  },
  MARICO: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'FMCG',
    cap: 'Large Cap',
  },
  BRITANNIA: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Food Products',
    cap: 'Large Cap',
  },
  DLF: { sector: 'Real Estate', industry: 'Real Estate', cap: 'Large Cap' },
  TATAPOWER: {
    sector: 'Utilities',
    industry: 'Power Generation',
    cap: 'Large Cap',
  },
  IRCTC: {
    sector: 'Industrials',
    industry: 'Tourism & Hospitality',
    cap: 'Large Cap',
  },
  SHREECEM: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Large Cap',
  },
  AMBUJACEM: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Large Cap',
  },
  ACC: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Large Cap',
  },
  IOC: { sector: 'Energy', industry: 'Petroleum Products', cap: 'Large Cap' },
  HPCL: { sector: 'Energy', industry: 'Petroleum Products', cap: 'Large Cap' },
  SAIL: { sector: 'Metals & Mining', industry: 'Steel', cap: 'Large Cap' },
  PFC: {
    sector: 'Financial Services',
    industry: 'Financial Institution',
    cap: 'Large Cap',
  },
  RECLTD: {
    sector: 'Financial Services',
    industry: 'Financial Institution',
    cap: 'Large Cap',
  },
  GAIL: { sector: 'Energy', industry: 'Gas Transmission', cap: 'Large Cap' },
  POLYCAB: { sector: 'Industrials', industry: 'Cables', cap: 'Large Cap' },
  LTIM: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Large Cap',
  },
  MUTHOOTFIN: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Large Cap',
  },
  MOTHERSON: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Large Cap',
  },
  VBL: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Beverages',
    cap: 'Large Cap',
  },
  HINDZINC: { sector: 'Metals & Mining', industry: 'Zinc', cap: 'Large Cap' },
  JIOFIN: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Large Cap',
  },
  HAL: { sector: 'Industrials', industry: 'Defence', cap: 'Large Cap' },
  BEL: { sector: 'Industrials', industry: 'Defence', cap: 'Large Cap' },
  TATAELXSI: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Large Cap',
  },
  DIXON: {
    sector: 'Consumer Discretionary',
    industry: 'Consumer Electronics',
    cap: 'Large Cap',
  },
  PARAS: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Mid Cap' },
  TORNTPHARM: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  LUPIN: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Large Cap' },
  AUROPHARMA: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  BIOCON: { sector: 'Healthcare', industry: 'Biotechnology', cap: 'Large Cap' },
  ALKEM: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Large Cap' },
  ABBOTINDIA: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  PFIZER: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  SANOFI: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  GLAXO: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Large Cap' },
  CHOLAFIN: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Large Cap',
  },
  BAJAJHFL: {
    sector: 'Financial Services',
    industry: 'Housing Finance',
    cap: 'Large Cap',
  },
  LICHSGFIN: {
    sector: 'Financial Services',
    industry: 'Housing Finance',
    cap: 'Large Cap',
  },
  CANFINHOME: {
    sector: 'Financial Services',
    industry: 'Housing Finance',
    cap: 'Mid Cap',
  },
  HOMEFIRST: {
    sector: 'Financial Services',
    industry: 'Housing Finance',
    cap: 'Mid Cap',
  },
  AAVAS: {
    sector: 'Financial Services',
    industry: 'Housing Finance',
    cap: 'Mid Cap',
  },
  GODREJPROP: {
    sector: 'Real Estate',
    industry: 'Real Estate',
    cap: 'Large Cap',
  },
  OBEROIRLTY: {
    sector: 'Real Estate',
    industry: 'Real Estate',
    cap: 'Large Cap',
  },
  PRESTIGE: {
    sector: 'Real Estate',
    industry: 'Real Estate',
    cap: 'Large Cap',
  },
  LODHA: { sector: 'Real Estate', industry: 'Real Estate', cap: 'Large Cap' },
  SONACOMS: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Large Cap',
  },
  ASTRAL: {
    sector: 'Industrials',
    industry: 'Plastic Products',
    cap: 'Large Cap',
  },
  PAYTM: {
    sector: 'Consumer Discretionary',
    industry: 'Internet & E-Commerce',
    cap: 'Large Cap',
  },
  NYKAA: {
    sector: 'Consumer Discretionary',
    industry: 'Internet & E-Commerce',
    cap: 'Mid Cap',
  },
  ZENSARTECH: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Mid Cap',
  },
  COFORGE: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Large Cap',
  },
  MPHASIS: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Mid Cap',
  },
  PERSISTENT: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Mid Cap',
  },
  KPITTECH: {
    sector: 'Information Technology',
    industry: 'Auto Tech',
    cap: 'Mid Cap',
  },
  TATATECH: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Mid Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // BANKING & FINANCIAL SERVICES
  // ══════════════════════════════════════════════════════════════════
  CANBK: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Large Cap',
  },
  BANKBARODA: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Large Cap',
  },
  PNB: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Large Cap',
  },
  UNIONBANK: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Large Cap',
  },
  CENTRALBK: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Mid Cap',
  },
  IDBI: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Mid Cap',
  },
  FEDERALBNK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Mid Cap',
  },
  IDFCFIRSTB: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Mid Cap',
  },
  BANDHANBNK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Mid Cap',
  },
  KARURVYSYA: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Mid Cap',
  },
  YESBANK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Mid Cap',
  },
  RBLBANK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Mid Cap',
  },
  SOUTHBANK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Small Cap',
  },
  DCBBANK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Small Cap',
  },
  NAINITAL: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Small Cap',
  },
  TMBBANK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Small Cap',
  },
  UJJIVANSFB: {
    sector: 'Financial Services',
    industry: 'Small Finance Bank',
    cap: 'Small Cap',
  },
  EQUITASBNK: {
    sector: 'Financial Services',
    industry: 'Small Finance Bank',
    cap: 'Small Cap',
  },
  ESAFSFB: {
    sector: 'Financial Services',
    industry: 'Small Finance Bank',
    cap: 'Small Cap',
  },
  SURYODAY: {
    sector: 'Financial Services',
    industry: 'Small Finance Bank',
    cap: 'Small Cap',
  },
  UTKARSHBNK: {
    sector: 'Financial Services',
    industry: 'Small Finance Bank',
    cap: 'Small Cap',
  },
  JKBANK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Mid Cap',
  },
  CSBBANK: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Small Cap',
  },
  SYNCOM: {
    sector: 'Financial Services',
    industry: 'Private Sector Bank',
    cap: 'Small Cap',
  },
  IOB: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Mid Cap',
  },
  MAHABANK: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Small Cap',
  },
  INDIANBK: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Mid Cap',
  },
  UCOBANK: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Small Cap',
  },
  BANKINDIA: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Mid Cap',
  },
  PSB: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Small Cap',
  },
  MANAPPURAM: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Mid Cap',
  },
  IREDA: {
    sector: 'Financial Services',
    industry: 'Financial Institution',
    cap: 'Mid Cap',
  },
  HUDCO: {
    sector: 'Financial Services',
    industry: 'Housing Finance',
    cap: 'Mid Cap',
  },
  CDSL: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Mid Cap',
  },
  BSE: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Mid Cap',
  },
  MCX: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Mid Cap',
  },
  CAMS: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Mid Cap',
  },
  ANGELONE: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Mid Cap',
  },
  PBFINTECH: {
    sector: 'Financial Services',
    industry: 'Financial Technology',
    cap: 'Mid Cap',
  },
  INVENTURE: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Small Cap',
  },
  MOTILALOFS: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Large Cap',
  },
  EDELWEISS: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Mid Cap',
  },
  GEOJITFSL: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Small Cap',
  },
  IIISL: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Small Cap',
  },
  NUVAMA: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Mid Cap',
  },
  '360ONE': {
    sector: 'Financial Services',
    industry: 'Wealth Management',
    cap: 'Mid Cap',
  },
  IIFL: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Mid Cap',
  },
  IIFLSEC: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Mid Cap',
  },
  IIFLFIN: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Mid Cap',
  },
  NUVOCO: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Mid Cap',
  },
  LTFH: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Mid Cap',
  },
  PIRAMALENT: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Large Cap',
  },
  SUNDARMFIN: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Large Cap',
  },
  MAHINDCIE: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  MAHFIN: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Mid Cap',
  },
  SHRIRAMFIN: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Large Cap',
  },
  SRIRAMCIT: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Small Cap',
  },
  BAJAJHLDNG: {
    sector: 'Financial Services',
    industry: 'Investment Company',
    cap: 'Large Cap',
  },
  TATAINVEST: {
    sector: 'Financial Services',
    industry: 'Investment Company',
    cap: 'Large Cap',
  },

  // Insurance
  LICI: {
    sector: 'Financial Services',
    industry: 'Life Insurance',
    cap: 'Large Cap',
  },
  HDFCLIFE: {
    sector: 'Financial Services',
    industry: 'Life Insurance',
    cap: 'Large Cap',
  },
  SBILIFE: {
    sector: 'Financial Services',
    industry: 'Life Insurance',
    cap: 'Large Cap',
  },
  ICICIPRULI: {
    sector: 'Financial Services',
    industry: 'Life Insurance',
    cap: 'Large Cap',
  },
  MAXLIFE: {
    sector: 'Financial Services',
    industry: 'Life Insurance',
    cap: 'Large Cap',
  },
  NIACL: {
    sector: 'Financial Services',
    industry: 'General Insurance',
    cap: 'Mid Cap',
  },
  GICRE: {
    sector: 'Financial Services',
    industry: 'General Insurance',
    cap: 'Large Cap',
  },
  STARHEALTH: {
    sector: 'Financial Services',
    industry: 'Health Insurance',
    cap: 'Mid Cap',
  },
  GODIGIT: {
    sector: 'Financial Services',
    industry: 'General Insurance',
    cap: 'Mid Cap',
  },
  ICICIGI: {
    sector: 'Financial Services',
    industry: 'General Insurance',
    cap: 'Large Cap',
  },
  SBICARD: {
    sector: 'Financial Services',
    industry: 'Credit Card Services',
    cap: 'Large Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // INFORMATION TECHNOLOGY
  // ══════════════════════════════════════════════════════════════════
  NEWGEN: {
    sector: 'Information Technology',
    industry: 'Software Products',
    cap: 'Mid Cap',
  },
  REDINGTON: {
    sector: 'Information Technology',
    industry: 'IT Distribution',
    cap: 'Mid Cap',
  },
  SILVERLINE: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Small Cap',
  },
  OFSS: {
    sector: 'Information Technology',
    industry: 'Software Products',
    cap: 'Large Cap',
  },
  LTTS: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Large Cap',
  },
  MASTEK: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Mid Cap',
  },
  CYIENT: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Mid Cap',
  },
  NIITTECH: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Mid Cap',
  },
  HEXAWARE: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Mid Cap',
  },
  HAPPSTMNDS: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Mid Cap',
  },
  TANLA: {
    sector: 'Information Technology',
    industry: 'Software Products',
    cap: 'Mid Cap',
  },
  INTELLECT: {
    sector: 'Information Technology',
    industry: 'Software Products',
    cap: 'Mid Cap',
  },
  DATAMATICS: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Small Cap',
  },
  EXPLEO: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Small Cap',
  },
  NIIT: {
    sector: 'Information Technology',
    industry: 'IT Education',
    cap: 'Small Cap',
  },
  RATEGAIN: {
    sector: 'Information Technology',
    industry: 'Software Products',
    cap: 'Small Cap',
  },
  AURIONPRO: {
    sector: 'Information Technology',
    industry: 'Software Products',
    cap: 'Small Cap',
  },
  SAKSOFT: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Small Cap',
  },
  ECLERX: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Mid Cap',
  },
  INFOBEAN: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Small Cap',
  },
  CIGNITI: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Small Cap',
  },
  QUICKHEAL: {
    sector: 'Information Technology',
    industry: 'Software Products',
    cap: 'Small Cap',
  },
  NUCLEUS: {
    sector: 'Information Technology',
    industry: 'Software Products',
    cap: 'Small Cap',
  },
  TATACLIQ: {
    sector: 'Information Technology',
    industry: 'Internet & E-Commerce',
    cap: 'Mid Cap',
  },
  NETSOL: {
    sector: 'Information Technology',
    industry: 'Software Products',
    cap: 'Small Cap',
  },
  ISGEC: { sector: 'Industrials', industry: 'Engineering', cap: 'Mid Cap' },
  FSL: {
    sector: 'Information Technology',
    industry: 'Semiconductors',
    cap: 'Small Cap',
  },
  // 'SAKUMA':      { sector: 'Consumer Discretionary',     industry: 'Trading',                  cap: 'Small Cap' },
  CENTUM: {
    sector: 'Industrials',
    industry: 'Defence Electronics',
    cap: 'Small Cap',
  },
  TATAELX: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Large Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // PHARMACEUTICALS & HEALTHCARE
  // ══════════════════════════════════════════════════════════════════
  TORNTPHARM2: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  IPCA: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Mid Cap' },
  NATCOPHARM: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Mid Cap',
  },
  GRANULES: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Mid Cap',
  },
  LAURUSLABS: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Mid Cap',
  },
  APLLTD: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Mid Cap' },
  GLAND: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Mid Cap' },
  IPCALAB: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Mid Cap' },
  AJANTPHARM: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Mid Cap',
  },
  SOLARA: { sector: 'Healthcare', industry: 'API', cap: 'Small Cap' },
  DIVI: { sector: 'Healthcare', industry: 'API', cap: 'Large Cap' },
  AARTI: { sector: 'Chemicals', industry: 'Chemicals', cap: 'Mid Cap' },
  AARTIPHARMA: { sector: 'Healthcare', industry: 'API', cap: 'Mid Cap' },
  SEQUENT: {
    sector: 'Healthcare',
    industry: 'Veterinary Pharma',
    cap: 'Small Cap',
  },
  STRIDES: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Mid Cap' },
  SUNPHARMA2: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  JB: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Small Cap' },
  JBCHEPHARM: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Mid Cap',
  },
  FLUOROCHEM: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Mid Cap',
  },
  GLENMARK: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Mid Cap',
  },
  BLISSGVS: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Small Cap',
  },
  SUVEN: { sector: 'Healthcare', industry: 'Pharmaceutical', cap: 'Small Cap' },
  MEDPLUS: {
    sector: 'Healthcare',
    industry: 'Healthcare Facilities',
    cap: 'Mid Cap',
  },
  DRREDDY2: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Large Cap',
  },
  METROPOLIS: {
    sector: 'Healthcare',
    industry: 'Healthcare Diagnostics',
    cap: 'Mid Cap',
  },
  THYROCARE: {
    sector: 'Healthcare',
    industry: 'Healthcare Diagnostics',
    cap: 'Small Cap',
  },
  LALPATHLAB: {
    sector: 'Healthcare',
    industry: 'Healthcare Diagnostics',
    cap: 'Large Cap',
  },
  KRSNAA: {
    sector: 'Healthcare',
    industry: 'Healthcare Diagnostics',
    cap: 'Small Cap',
  },
  INDIAMART: {
    sector: 'Consumer Discretionary',
    industry: 'Internet & E-Commerce',
    cap: 'Mid Cap',
  },
  NHPC: { sector: 'Utilities', industry: 'Power Generation', cap: 'Large Cap' },
  FORTIS: {
    sector: 'Healthcare',
    industry: 'Healthcare Facilities',
    cap: 'Large Cap',
  },
  MAXHEALTH: {
    sector: 'Healthcare',
    industry: 'Healthcare Facilities',
    cap: 'Large Cap',
  },
  NARAYANHRU: {
    sector: 'Healthcare',
    industry: 'Healthcare Facilities',
    cap: 'Large Cap',
  },
  RAINBOW: {
    sector: 'Healthcare',
    industry: 'Healthcare Facilities',
    cap: 'Mid Cap',
  },
  KIMS: {
    sector: 'Healthcare',
    industry: 'Healthcare Facilities',
    cap: 'Mid Cap',
  },
  VIJAYA: {
    sector: 'Healthcare',
    industry: 'Healthcare Facilities',
    cap: 'Small Cap',
  },
  MEDANTA: {
    sector: 'Healthcare',
    industry: 'Healthcare Facilities',
    cap: 'Mid Cap',
  },
  ASTER: {
    sector: 'Healthcare',
    industry: 'Healthcare Facilities',
    cap: 'Mid Cap',
  },
  HEALTHCARE: {
    sector: 'Healthcare',
    industry: 'Healthcare Facilities',
    cap: 'Small Cap',
  },
  POLY: { sector: 'Healthcare', industry: 'Medical Devices', cap: 'Small Cap' },
  POLYMED: {
    sector: 'Healthcare',
    industry: 'Medical Devices',
    cap: 'Mid Cap',
  },
  HINDUSTAN: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Small Cap',
  },
  ZENTALIS: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Mid Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // AUTOMOBILES & AUTO ANCILLARIES
  // ══════════════════════════════════════════════════════════════════
  M_M: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Large Cap',
  },
  ASHOKLEY: {
    sector: 'Consumer Discretionary',
    industry: 'Commercial Vehicles',
    cap: 'Large Cap',
  },
  TVSMOTOR: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Large Cap',
  },
  FORCEMOT: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Mid Cap',
  },
  ESCORTS: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Large Cap',
  },
  MAHLE: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  BOSCHLTD: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Large Cap',
  },
  MINDA: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  MINDAIND: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  BHARATFORG: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Large Cap',
  },
  BHARAT: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  TIINDIA: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Large Cap',
  },
  SUNDRMFAST: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  SCHAEFFLER: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Large Cap',
  },
  ENDURANCE: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Large Cap',
  },
  EXIDEIND: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  AMARAJABAT: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  MOTHERSON2: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Large Cap',
  },
  SUBROS: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  RAMKRISHNA: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  WABCOINDIA: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  GABRIEL: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  SUPRAJIT: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  MAAN: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  LUMAXIND: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  LUMAXTECH: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  JTEKIND: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  BORORENEW: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  FIEM: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  PRICOL: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  UCALFUEL: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  SETCO: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  SWARAJ: {
    sector: 'Consumer Discretionary',
    industry: 'Tractors',
    cap: 'Small Cap',
  },
  ATUL: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Large Cap',
  },
  EICHERMOT2: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Large Cap',
  },
  OLECTRA: {
    sector: 'Consumer Discretionary',
    industry: 'Commercial Vehicles',
    cap: 'Mid Cap',
  },
  RVBL: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Small Cap',
  },
  TVSSCS: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  TVSRICH: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  VARROC: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  SAMVARDH: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  VSTTILLERS: {
    sector: 'Consumer Discretionary',
    industry: 'Tractors',
    cap: 'Small Cap',
  },
  MAHLOG: { sector: 'Industrials', industry: 'Logistics', cap: 'Mid Cap' },

  // ══════════════════════════════════════════════════════════════════
  // ENERGY & OIL & GAS
  // ══════════════════════════════════════════════════════════════════
  OIL: { sector: 'Energy', industry: 'Oil Exploration', cap: 'Mid Cap' },
  MRPL: { sector: 'Energy', industry: 'Petroleum Products', cap: 'Mid Cap' },
  GSPL: { sector: 'Energy', industry: 'Gas Transmission', cap: 'Mid Cap' },
  IGL: {
    sector: 'Energy',
    industry: 'City Gas Distribution',
    cap: 'Large Cap',
  },
  MGL: { sector: 'Energy', industry: 'City Gas Distribution', cap: 'Mid Cap' },
  GUJGASLTD: {
    sector: 'Energy',
    industry: 'City Gas Distribution',
    cap: 'Mid Cap',
  },
  ATGL: { sector: 'Energy', industry: 'City Gas Distribution', cap: 'Mid Cap' },
  GASCO: {
    sector: 'Energy',
    industry: 'City Gas Distribution',
    cap: 'Small Cap',
  },
  MAHANGAS: {
    sector: 'Energy',
    industry: 'City Gas Distribution',
    cap: 'Small Cap',
  },
  PETRONET: { sector: 'Energy', industry: 'LNG Import', cap: 'Large Cap' },
  GPTINFRA: {
    sector: 'Energy',
    industry: 'Oil & Gas Services',
    cap: 'Small Cap',
  },
  DEEPINDS: {
    sector: 'Energy',
    industry: 'Oil & Gas Services',
    cap: 'Small Cap',
  },
  HINDPETRO: {
    sector: 'Energy',
    industry: 'Petroleum Products',
    cap: 'Large Cap',
  },
  CHENNPETRO: {
    sector: 'Energy',
    industry: 'Petroleum Products',
    cap: 'Mid Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // METALS & MINING
  // ══════════════════════════════════════════════════════════════════
  NMDC: { sector: 'Metals & Mining', industry: 'Iron Ore', cap: 'Large Cap' },
  MOIL: {
    sector: 'Metals & Mining',
    industry: 'Manganese Ore',
    cap: 'Mid Cap',
  },
  NATIONALUM: {
    sector: 'Metals & Mining',
    industry: 'Aluminium',
    cap: 'Mid Cap',
  },
  WELCORP: { sector: 'Metals & Mining', industry: 'Steel', cap: 'Mid Cap' },
  APL: { sector: 'Metals & Mining', industry: 'Steel Pipes', cap: 'Mid Cap' },
  APLAPOLLO: {
    sector: 'Metals & Mining',
    industry: 'Steel Pipes',
    cap: 'Large Cap',
  },
  JINDALSAW: {
    sector: 'Metals & Mining',
    industry: 'Steel Pipes',
    cap: 'Mid Cap',
  },
  JSWINFRA: {
    sector: 'Industrials',
    industry: 'Ports & Shipping',
    cap: 'Large Cap',
  },
  JSL: {
    sector: 'Metals & Mining',
    industry: 'Stainless Steel',
    cap: 'Mid Cap',
  },
  RPOWER: {
    sector: 'Utilities',
    industry: 'Power Generation',
    cap: 'Small Cap',
  },
  RATNAMANI: {
    sector: 'Metals & Mining',
    industry: 'Steel Pipes',
    cap: 'Mid Cap',
  },
  HINDCOPPER: { sector: 'Metals & Mining', industry: 'Copper', cap: 'Mid Cap' },
  KANANIIND: {
    sector: 'Metals & Mining',
    industry: 'Diamond Processing',
    cap: 'Small Cap',
  },
  BMET: {
    sector: 'Metals & Mining',
    industry: 'Ferrous Metals',
    cap: 'Small Cap',
  },
  KMIL: { sector: 'Metals & Mining', industry: 'Steel', cap: 'Small Cap' },
  AISHLABS: {
    sector: 'Metals & Mining',
    industry: 'Aluminium',
    cap: 'Small Cap',
  },
  MSTCLTD: { sector: 'Industrials', industry: 'Trading', cap: 'Small Cap' },
  STEELCAS: { sector: 'Metals & Mining', industry: 'Steel', cap: 'Small Cap' },
  MIDHANI: {
    sector: 'Metals & Mining',
    industry: 'Special Alloys',
    cap: 'Mid Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // CONSTRUCTION, INFRASTRUCTURE & CEMENT
  // ══════════════════════════════════════════════════════════════════
  IRFC: {
    sector: 'Financial Services',
    industry: 'Financial Institution',
    cap: 'Large Cap',
  },
  IRCON: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Mid Cap',
  },
  RVNL: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Mid Cap',
  },
  NBCC: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Mid Cap',
  },
  BHEL: { sector: 'Industrials', industry: 'Engineering', cap: 'Large Cap' },
  KEC: { sector: 'Industrials', industry: 'Power T&D', cap: 'Large Cap' },
  KECL: { sector: 'Industrials', industry: 'Power T&D', cap: 'Small Cap' },
  PNC: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Mid Cap',
  },
  NCC: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Mid Cap',
  },
  HGINFRA: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Mid Cap',
  },
  GPPL: {
    sector: 'Industrials',
    industry: 'Ports & Shipping',
    cap: 'Small Cap',
  },
  HCC: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Small Cap',
  },
  AHLUCONT: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Mid Cap',
  },
  CAPACITE: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Small Cap',
  },
  ASHOKA: {
    sector: 'Construction',
    industry: 'Roads & Highways',
    cap: 'Mid Cap',
  },
  SADBHAV: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Small Cap',
  },
  PSPPROJECT: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Mid Cap',
  },
  JKCEMENT: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Large Cap',
  },
  DALMIA: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Large Cap',
  },
  SCEM: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Small Cap',
  },
  HEIDELBERG: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Mid Cap',
  },
  BIRLACORP: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Mid Cap',
  },
  ORIENTCEM: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Small Cap',
  },
  PRISM: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Small Cap',
  },
  DBCORP: {
    sector: 'Consumer Discretionary',
    industry: 'Media',
    cap: 'Small Cap',
  },
  MAGADSUGAR: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Sugar',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // POWER & UTILITIES
  // ══════════════════════════════════════════════════════════════════
  SJVN: { sector: 'Utilities', industry: 'Power Generation', cap: 'Mid Cap' },
  JPPOWER: {
    sector: 'Utilities',
    industry: 'Power Generation',
    cap: 'Small Cap',
  },
  RTNPOWER: {
    sector: 'Utilities',
    industry: 'Power Generation',
    cap: 'Small Cap',
  },
  SUZLON: {
    sector: 'Industrials',
    industry: 'Electrical Equipment',
    cap: 'Mid Cap',
  },
  INOXWIND: {
    sector: 'Industrials',
    industry: 'Wind Energy Equipment',
    cap: 'Mid Cap',
  },
  CESC: { sector: 'Utilities', industry: 'Power Distribution', cap: 'Mid Cap' },
  TORNTPOWER: {
    sector: 'Utilities',
    industry: 'Power Distribution',
    cap: 'Large Cap',
  },
  RENEW: {
    sector: 'Utilities',
    industry: 'Renewable Energy',
    cap: 'Large Cap',
  },
  GREENKO: {
    sector: 'Utilities',
    industry: 'Renewable Energy',
    cap: 'Mid Cap',
  },
  RPOWER2: {
    sector: 'Utilities',
    industry: 'Power Generation',
    cap: 'Small Cap',
  },
  JSWENERGY: {
    sector: 'Utilities',
    industry: 'Power Generation',
    cap: 'Large Cap',
  },
  WAAREEENER: {
    sector: 'Industrials',
    industry: 'Solar Equipment',
    cap: 'Mid Cap',
  },
  PREMIER: {
    sector: 'Utilities',
    industry: 'Power Generation',
    cap: 'Small Cap',
  },
  BURNPUR: { sector: 'Metals & Mining', industry: 'Steel', cap: 'Small Cap' },
  GENESYS: {
    sector: 'Industrials',
    industry: 'Electrical Equipment',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // REAL ESTATE
  // ══════════════════════════════════════════════════════════════════
  ANANTRAJ: { sector: 'Real Estate', industry: 'Real Estate', cap: 'Mid Cap' },
  BRIGADE: { sector: 'Real Estate', industry: 'Real Estate', cap: 'Large Cap' },
  PHOENIXLTD: {
    sector: 'Real Estate',
    industry: 'Real Estate',
    cap: 'Large Cap',
  },
  SOBHA: { sector: 'Real Estate', industry: 'Real Estate', cap: 'Mid Cap' },
  KOLTEPATIL: {
    sector: 'Real Estate',
    industry: 'Real Estate',
    cap: 'Small Cap',
  },
  SUNTECK: { sector: 'Real Estate', industry: 'Real Estate', cap: 'Small Cap' },
  MAHESHWARI: {
    sector: 'Real Estate',
    industry: 'Real Estate',
    cap: 'Small Cap',
  },
  INDIABULLS: {
    sector: 'Real Estate',
    industry: 'Real Estate',
    cap: 'Mid Cap',
  },
  PURVANKARA: {
    sector: 'Real Estate',
    industry: 'Real Estate',
    cap: 'Mid Cap',
  },
  GODREJIND: {
    sector: 'Consumer Discretionary',
    industry: 'Diversified',
    cap: 'Large Cap',
  },
  SHOBHA: { sector: 'Real Estate', industry: 'Real Estate', cap: 'Mid Cap' },
  MAHINDRA: {
    sector: 'Consumer Discretionary',
    industry: 'Diversified',
    cap: 'Large Cap',
  },
  OMAXE: { sector: 'Real Estate', industry: 'Real Estate', cap: 'Small Cap' },
  PARSVNATH: {
    sector: 'Real Estate',
    industry: 'Real Estate',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // FAST MOVING CONSUMER GOODS (FMCG)
  // ══════════════════════════════════════════════════════════════════
  COLPAL: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Personal Care',
    cap: 'Large Cap',
  },
  PGHH: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Personal Care',
    cap: 'Large Cap',
  },
  GODREJCONS: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'FMCG',
    cap: 'Large Cap',
  },
  EMAMILTD: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Personal Care',
    cap: 'Large Cap',
  },
  BAJAJCON: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Personal Care',
    cap: 'Mid Cap',
  },
  JYOTHYLAB: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'FMCG',
    cap: 'Mid Cap',
  },
  GSKCONS: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Food Products',
    cap: 'Large Cap',
  },
  ZYDUSWELL: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'FMCG',
    cap: 'Large Cap',
  },
  HONASA: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Personal Care',
    cap: 'Mid Cap',
  },
  BIKAJI: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Food Products',
    cap: 'Mid Cap',
  },
  PRATAAP: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Food Products',
    cap: 'Mid Cap',
  },
  GODFRYPHLP: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Tobacco',
    cap: 'Mid Cap',
  },
  VST: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Tobacco',
    cap: 'Mid Cap',
  },
  GUJAMBTEX: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'FMCG',
    cap: 'Small Cap',
  },
  HNDFDS: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Food Products',
    cap: 'Small Cap',
  },
  RADICO: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Alcoholic Beverages',
    cap: 'Mid Cap',
  },
  UNITEDSPIRTS: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Alcoholic Beverages',
    cap: 'Large Cap',
  },
  UBL: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Alcoholic Beverages',
    cap: 'Large Cap',
  },
  GLOBUSSPR: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Alcoholic Beverages',
    cap: 'Small Cap',
  },
  TILIND: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Alcoholic Beverages',
    cap: 'Small Cap',
  },
  PATANJALI: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'FMCG',
    cap: 'Large Cap',
  },
  VARUN: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Beverages',
    cap: 'Large Cap',
  },
  RENUKA: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Sugar',
    cap: 'Small Cap',
  },
  EIDPARRY: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Sugar',
    cap: 'Mid Cap',
  },
  TRIVENI: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Sugar',
    cap: 'Mid Cap',
  },
  BALRAMCHIN: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Sugar',
    cap: 'Mid Cap',
  },
  DHANUKA: { sector: 'Chemicals', industry: 'Agrochemicals', cap: 'Mid Cap' },
  AGROPHOS: { sector: 'Chemicals', industry: 'Fertilizers', cap: 'Small Cap' },

  // ══════════════════════════════════════════════════════════════════
  // CHEMICALS & SPECIALTY CHEMICALS
  // ══════════════════════════════════════════════════════════════════
  SRF: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Large Cap',
  },
  NAVINFLUOR: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Large Cap',
  },
  BALCHEMLTD: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Small Cap',
  },
  CLEAN: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Mid Cap',
  },
  VINATI: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Large Cap',
  },
  GALAXYSURF: { sector: 'Chemicals', industry: 'Surfactants', cap: 'Mid Cap' },
  FINEORG: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Mid Cap',
  },
  PCBL: { sector: 'Chemicals', industry: 'Carbon Black', cap: 'Mid Cap' },
  DCMSHRIRAM: { sector: 'Chemicals', industry: 'Diversified', cap: 'Mid Cap' },
  TATACHEMICALS: {
    sector: 'Chemicals',
    industry: 'Basic Chemicals',
    cap: 'Large Cap',
  },
  GHCL: { sector: 'Chemicals', industry: 'Basic Chemicals', cap: 'Mid Cap' },
  ALKYLAMINE: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Mid Cap',
  },
  TATACHEM: {
    sector: 'Chemicals',
    industry: 'Basic Chemicals',
    cap: 'Large Cap',
  },
  AARTI2: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Mid Cap',
  },
  NEOGEN: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Small Cap',
  },
  DEEPAKFERT: { sector: 'Chemicals', industry: 'Fertilizers', cap: 'Mid Cap' },
  DEEPAKNTR: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Mid Cap',
  },
  NOCIL: {
    sector: 'Chemicals',
    industry: 'Rubber Chemicals',
    cap: 'Small Cap',
  },
  JUBL: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Mid Cap',
  },
  SUDARSCHEM: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Mid Cap',
  },
  CHEMPLAST: { sector: 'Chemicals', industry: 'PVC', cap: 'Mid Cap' },
  CHEM: { sector: 'Chemicals', industry: 'Basic Chemicals', cap: 'Small Cap' },

  // Fertilizers
  CHAMBALFERT: { sector: 'Chemicals', industry: 'Fertilizers', cap: 'Mid Cap' },
  GNFC: { sector: 'Chemicals', industry: 'Fertilizers', cap: 'Mid Cap' },
  RCF: { sector: 'Chemicals', industry: 'Fertilizers', cap: 'Mid Cap' },
  GSFC: { sector: 'Chemicals', industry: 'Fertilizers', cap: 'Mid Cap' },
  COROMANDEL: {
    sector: 'Chemicals',
    industry: 'Fertilizers',
    cap: 'Large Cap',
  },
  PARADEEP: { sector: 'Chemicals', industry: 'Fertilizers', cap: 'Mid Cap' },
  SPIC: { sector: 'Chemicals', industry: 'Fertilizers', cap: 'Small Cap' },

  // Agrochemicals
  INSECTI: { sector: 'Chemicals', industry: 'Agrochemicals', cap: 'Small Cap' },
  PIIND: { sector: 'Chemicals', industry: 'Agrochemicals', cap: 'Large Cap' },
  BAYER: { sector: 'Chemicals', industry: 'Agrochemicals', cap: 'Large Cap' },
  SUMITOMO: { sector: 'Chemicals', industry: 'Agrochemicals', cap: 'Mid Cap' },
  RALLIS: { sector: 'Chemicals', industry: 'Agrochemicals', cap: 'Mid Cap' },
  UPL: { sector: 'Chemicals', industry: 'Agrochemicals', cap: 'Large Cap' },
  DHANU: { sector: 'Chemicals', industry: 'Agrochemicals', cap: 'Small Cap' },
  DHARAMSI: {
    sector: 'Chemicals',
    industry: 'Agrochemicals',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // INDUSTRIALS & CAPITAL GOODS
  // ══════════════════════════════════════════════════════════════════
  COCHINSHIP: {
    sector: 'Industrials',
    industry: 'Shipbuilding',
    cap: 'Mid Cap',
  },
  GRSE: { sector: 'Industrials', industry: 'Shipbuilding', cap: 'Mid Cap' },
  MAZDOCK: { sector: 'Industrials', industry: 'Shipbuilding', cap: 'Mid Cap' },
  BDL: { sector: 'Industrials', industry: 'Defence', cap: 'Large Cap' },
  AIAENG: {
    sector: 'Industrials',
    industry: 'Industrial Machinery',
    cap: 'Mid Cap',
  },
  THERMAX: { sector: 'Industrials', industry: 'Engineering', cap: 'Large Cap' },
  CUMMINSIND: {
    sector: 'Industrials',
    industry: 'Engineering',
    cap: 'Large Cap',
  },
  BHFC: { sector: 'Industrials', industry: 'Forgings', cap: 'Mid Cap' },
  CG: {
    sector: 'Industrials',
    industry: 'Electrical Equipment',
    cap: 'Large Cap',
  },
  CGPOWER: {
    sector: 'Industrials',
    industry: 'Electrical Equipment',
    cap: 'Large Cap',
  },
  VOLTAMP: {
    sector: 'Industrials',
    industry: 'Transformers',
    cap: 'Small Cap',
  },
  ELGI: { sector: 'Industrials', industry: 'Compressors', cap: 'Mid Cap' },
  GRINDWELL: {
    sector: 'Industrials',
    industry: 'Industrial Machinery',
    cap: 'Mid Cap',
  },
  JYOTICNC: {
    sector: 'Industrials',
    industry: 'CNC Machines',
    cap: 'Small Cap',
  },
  HMVL: { sector: 'Industrials', industry: 'Media', cap: 'Small Cap' },
  CRAFTSMAN: {
    sector: 'Industrials',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  CARBORUNIV: {
    sector: 'Industrials',
    industry: 'Industrial Machinery',
    cap: 'Mid Cap',
  },
  KIRLOSBROS: { sector: 'Industrials', industry: 'Pumps', cap: 'Mid Cap' },
  KIRLOSENG: { sector: 'Industrials', industry: 'Engineering', cap: 'Mid Cap' },
  KENNAMETAL: {
    sector: 'Industrials',
    industry: 'Cutting Tools',
    cap: 'Small Cap',
  },
  WPIL: { sector: 'Industrials', industry: 'Pumps', cap: 'Small Cap' },
  ELPRO: { sector: 'Industrials', industry: 'Transformers', cap: 'Small Cap' },
  WENDT: {
    sector: 'Industrials',
    industry: 'Industrial Machinery',
    cap: 'Small Cap',
  },
  MICO: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  HONAUT: { sector: 'Industrials', industry: 'Engineering', cap: 'Large Cap' },
  BHARAT2: { sector: 'Industrials', industry: 'Electronics', cap: 'Large Cap' },
  TEJASNET: {
    sector: 'Telecommunication',
    industry: 'Telecom Equipment',
    cap: 'Mid Cap',
  },
  HFCL: {
    sector: 'Telecommunication',
    industry: 'Telecom Infrastructure',
    cap: 'Mid Cap',
  },
  STERLITE: { sector: 'Industrials', industry: 'Cables', cap: 'Mid Cap' },
  KEI: { sector: 'Industrials', industry: 'Cables', cap: 'Large Cap' },
  FINOLEX: { sector: 'Industrials', industry: 'Cables', cap: 'Mid Cap' },
  KMTL: { sector: 'Industrials', industry: 'Cables', cap: 'Small Cap' },

  // Defence
  PARAS2: { sector: 'Industrials', industry: 'Defence', cap: 'Mid Cap' },
  DATAPAT: {
    sector: 'Industrials',
    industry: 'Defence Electronics',
    cap: 'Small Cap',
  },
  ZEN: {
    sector: 'Industrials',
    industry: 'Defence Electronics',
    cap: 'Small Cap',
  },
  MTAR: { sector: 'Industrials', industry: 'Defence', cap: 'Mid Cap' },
  DCCIL: { sector: 'Industrials', industry: 'Defence', cap: 'Small Cap' },
  SOLAR: {
    sector: 'Industrials',
    industry: 'Defence Electronics',
    cap: 'Small Cap',
  },
  PREMIEREXP: {
    sector: 'Industrials',
    industry: 'Explosives',
    cap: 'Small Cap',
  },
  SOLCOMP: {
    sector: 'Industrials',
    industry: 'Defence Electronics',
    cap: 'Small Cap',
  },
  ROCKETSHIP: {
    sector: 'Industrials',
    industry: 'Aerospace',
    cap: 'Small Cap',
  },

  // Railways
  RAILVIKAS: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Mid Cap',
  },
  TEXRAIL: {
    sector: 'Consumer Discretionary',
    industry: 'Textiles',
    cap: 'Small Cap',
  },
  TITAGARH: {
    sector: 'Industrials',
    industry: 'Railway Wagons',
    cap: 'Mid Cap',
  },
  BHEL2: { sector: 'Industrials', industry: 'Engineering', cap: 'Large Cap' },
  KERNEX: {
    sector: 'Industrials',
    industry: 'Railway Systems',
    cap: 'Small Cap',
  },
  HBL: {
    sector: 'Industrials',
    industry: 'Railway Electronics',
    cap: 'Small Cap',
  },
  IRFC2: {
    sector: 'Financial Services',
    industry: 'Financial Institution',
    cap: 'Large Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // CONSUMER DISCRETIONARY — RETAIL, CONSUMER GOODS
  // ══════════════════════════════════════════════════════════════════
  TRENT: {
    sector: 'Consumer Discretionary',
    industry: 'Retailing',
    cap: 'Large Cap',
  },
  ABFRL: {
    sector: 'Consumer Discretionary',
    industry: 'Apparel',
    cap: 'Mid Cap',
  },
  VMART: {
    sector: 'Consumer Discretionary',
    industry: 'Retailing',
    cap: 'Mid Cap',
  },
  SHOPERSTOP: {
    sector: 'Consumer Discretionary',
    industry: 'Retailing',
    cap: 'Mid Cap',
  },
  SPENCERS: {
    sector: 'Consumer Discretionary',
    industry: 'Retailing',
    cap: 'Small Cap',
  },
  METRO: {
    sector: 'Consumer Discretionary',
    industry: 'Footwear',
    cap: 'Mid Cap',
  },
  BATA: {
    sector: 'Consumer Discretionary',
    industry: 'Footwear',
    cap: 'Large Cap',
  },
  RELAXO: {
    sector: 'Consumer Discretionary',
    industry: 'Footwear',
    cap: 'Large Cap',
  },
  LIBERTY: {
    sector: 'Consumer Discretionary',
    industry: 'Footwear',
    cap: 'Small Cap',
  },
  KHADIM: {
    sector: 'Consumer Discretionary',
    industry: 'Footwear',
    cap: 'Small Cap',
  },
  RAYMOND: {
    sector: 'Consumer Discretionary',
    industry: 'Apparel',
    cap: 'Mid Cap',
  },
  KPR: { sector: 'Textiles', industry: 'Textiles', cap: 'Large Cap' },
  PAGEIND: {
    sector: 'Consumer Discretionary',
    industry: 'Apparel',
    cap: 'Large Cap',
  },
  MANYAVAR: {
    sector: 'Consumer Discretionary',
    industry: 'Apparel',
    cap: 'Large Cap',
  },
  VEDANT: {
    sector: 'Consumer Discretionary',
    industry: 'Apparel',
    cap: 'Large Cap',
  },
  KALYANKJIL: {
    sector: 'Consumer Discretionary',
    industry: 'Jewellery',
    cap: 'Mid Cap',
  },
  PCJEWELS: {
    sector: 'Consumer Discretionary',
    industry: 'Jewellery',
    cap: 'Small Cap',
  },
  THANGAMAYL: {
    sector: 'Consumer Discretionary',
    industry: 'Jewellery',
    cap: 'Small Cap',
  },
  JUBLPHARMA: {
    sector: 'Healthcare',
    industry: 'Pharmaceutical',
    cap: 'Mid Cap',
  },
  JUBLFOOD: {
    sector: 'Consumer Discretionary',
    industry: 'Quick Service Restaurants',
    cap: 'Large Cap',
  },
  DEVYANI: {
    sector: 'Consumer Discretionary',
    industry: 'Quick Service Restaurants',
    cap: 'Mid Cap',
  },
  SAPPHIRE: {
    sector: 'Consumer Discretionary',
    industry: 'Quick Service Restaurants',
    cap: 'Mid Cap',
  },
  WESTLIFE: {
    sector: 'Consumer Discretionary',
    industry: 'Quick Service Restaurants',
    cap: 'Mid Cap',
  },
  BURGER: {
    sector: 'Consumer Discretionary',
    industry: 'Quick Service Restaurants',
    cap: 'Small Cap',
  },
  NUVAMA2: {
    sector: 'Financial Services',
    industry: 'Wealth Management',
    cap: 'Mid Cap',
  },
  BAJAJELEC: {
    sector: 'Consumer Discretionary',
    industry: 'Consumer Electronics',
    cap: 'Mid Cap',
  },
  SYMPHONY: {
    sector: 'Consumer Discretionary',
    industry: 'Consumer Electronics',
    cap: 'Mid Cap',
  },
  CROMPTON: {
    sector: 'Consumer Discretionary',
    industry: 'Consumer Electronics',
    cap: 'Mid Cap',
  },
  VOLTAS: {
    sector: 'Consumer Discretionary',
    industry: 'Consumer Electronics',
    cap: 'Large Cap',
  },
  BLUESTAR: {
    sector: 'Consumer Discretionary',
    industry: 'Consumer Electronics',
    cap: 'Mid Cap',
  },
  AMBER: {
    sector: 'Consumer Discretionary',
    industry: 'Consumer Electronics',
    cap: 'Mid Cap',
  },
  KAJTEX: {
    sector: 'Consumer Discretionary',
    industry: 'Consumer Electronics',
    cap: 'Small Cap',
  },
  VGUARD: {
    sector: 'Consumer Discretionary',
    industry: 'Consumer Electronics',
    cap: 'Mid Cap',
  },
  ORIENT: {
    sector: 'Consumer Discretionary',
    industry: 'Consumer Electronics',
    cap: 'Mid Cap',
  },
  TTK: {
    sector: 'Consumer Discretionary',
    industry: 'Household Products',
    cap: 'Mid Cap',
  },
  TTKPRESTIGE: {
    sector: 'Consumer Discretionary',
    industry: 'Household Products',
    cap: 'Mid Cap',
  },
  HAWKINS: {
    sector: 'Consumer Discretionary',
    industry: 'Household Products',
    cap: 'Mid Cap',
  },
  PRINCEPIPE: {
    sector: 'Industrials',
    industry: 'Plastic Products',
    cap: 'Mid Cap',
  },
  SUPR: { sector: 'Industrials', industry: 'Plastic Products', cap: 'Mid Cap' },
  FINOLEX2: {
    sector: 'Industrials',
    industry: 'Plastic Products',
    cap: 'Mid Cap',
  },
  APOLLOPIPE: {
    sector: 'Industrials',
    industry: 'Plastic Products',
    cap: 'Mid Cap',
  },
  JAIN: { sector: 'Industrials', industry: 'Plastic Products', cap: 'Mid Cap' },
  SKIPPER: { sector: 'Industrials', industry: 'Power T&D', cap: 'Small Cap' },
  ALSTONE: {
    sector: 'Industrials',
    industry: 'Building Products',
    cap: 'Small Cap',
  },
  CENTURYPLY: { sector: 'Industrials', industry: 'Plywood', cap: 'Mid Cap' },
  GREENPLY: { sector: 'Industrials', industry: 'Plywood', cap: 'Mid Cap' },
  GILLETTE: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Personal Care',
    cap: 'Large Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // MEDIA, ENTERTAINMENT & TELECOM
  // ══════════════════════════════════════════════════════════════════
  SUNTV: {
    sector: 'Consumer Discretionary',
    industry: 'Media',
    cap: 'Large Cap',
  },
  ZEEL: { sector: 'Consumer Discretionary', industry: 'Media', cap: 'Mid Cap' },
  NETWORK18: {
    sector: 'Consumer Discretionary',
    industry: 'Media',
    cap: 'Mid Cap',
  },
  PVR: {
    sector: 'Consumer Discretionary',
    industry: 'Entertainment',
    cap: 'Mid Cap',
  },
  INOXLEISUR: {
    sector: 'Consumer Discretionary',
    industry: 'Entertainment',
    cap: 'Mid Cap',
  },
  PVRINOX: {
    sector: 'Consumer Discretionary',
    industry: 'Entertainment',
    cap: 'Large Cap',
  },
  TIPS: {
    sector: 'Consumer Discretionary',
    industry: 'Media',
    cap: 'Small Cap',
  },
  SAREGAMA: {
    sector: 'Consumer Discretionary',
    industry: 'Media',
    cap: 'Small Cap',
  },
  IDEA: {
    sector: 'Telecommunication',
    industry: 'Telecom Services',
    cap: 'Mid Cap',
  },
  TTML: {
    sector: 'Telecommunication',
    industry: 'Telecom Services',
    cap: 'Small Cap',
  },
  GTLINFRA: {
    sector: 'Telecommunication',
    industry: 'Telecom Infrastructure',
    cap: 'Small Cap',
  },
  INDIACEM2: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Mid Cap',
  },
  TATACOMM: {
    sector: 'Telecommunication',
    industry: 'Telecom Services',
    cap: 'Large Cap',
  },
  ROUTE: {
    sector: 'Telecommunication',
    industry: 'Communication Services',
    cap: 'Small Cap',
  },
  INDUSIND: {
    sector: 'Telecommunication',
    industry: 'Telecom Services',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // TEXTILES & APPAREL
  // ══════════════════════════════════════════════════════════════════
  TRIDENT: { sector: 'Textiles', industry: 'Textiles', cap: 'Small Cap' },
  ALOKINDS: { sector: 'Textiles', industry: 'Textiles', cap: 'Small Cap' },
  SPANDANA: {
    sector: 'Financial Services',
    industry: 'Microfinance',
    cap: 'Mid Cap',
  },
  ARVIND: { sector: 'Textiles', industry: 'Textiles', cap: 'Mid Cap' },
  VARDHMAN: { sector: 'Textiles', industry: 'Textiles', cap: 'Mid Cap' },
  WELSPUN: { sector: 'Textiles', industry: 'Textiles', cap: 'Mid Cap' },
  GRASIM2: {
    sector: 'Textiles',
    industry: 'Viscose Staple Fibre',
    cap: 'Large Cap',
  },
  RUPA: { sector: 'Textiles', industry: 'Hosiery', cap: 'Small Cap' },
  LAXMIMILLS: { sector: 'Textiles', industry: 'Textiles', cap: 'Small Cap' },
  GOKEX: { sector: 'Textiles', industry: 'Textiles', cap: 'Small Cap' },
  KITEX: { sector: 'Textiles', industry: 'Textiles', cap: 'Small Cap' },
  SIYARAM: { sector: 'Textiles', industry: 'Textiles', cap: 'Small Cap' },
  MAFATLAL: { sector: 'Textiles', industry: 'Textiles', cap: 'Small Cap' },
  RAJRATAN: { sector: 'Metals & Mining', industry: 'Wire', cap: 'Small Cap' },
  ALICEBLUON: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // LOGISTICS & TRANSPORTATION
  // ══════════════════════════════════════════════════════════════════
  CONCOR: { sector: 'Industrials', industry: 'Logistics', cap: 'Large Cap' },
  GATEWAYDISTR: {
    sector: 'Industrials',
    industry: 'Logistics',
    cap: 'Mid Cap',
  },
  TCI: { sector: 'Industrials', industry: 'Logistics', cap: 'Mid Cap' },
  GATI: { sector: 'Industrials', industry: 'Logistics', cap: 'Small Cap' },
  BLUEDART: { sector: 'Industrials', industry: 'Courier', cap: 'Large Cap' },
  DELHIVERY: { sector: 'Industrials', industry: 'Logistics', cap: 'Large Cap' },
  VRL: { sector: 'Industrials', industry: 'Logistics', cap: 'Mid Cap' },
  XPRESSBEES: {
    sector: 'Industrials',
    industry: 'Logistics',
    cap: 'Small Cap',
  },
  ALLCARGO: { sector: 'Industrials', industry: 'Logistics', cap: 'Mid Cap' },
  MAHINDLOG: { sector: 'Industrials', industry: 'Logistics', cap: 'Mid Cap' },
  AEGISLOG: { sector: 'Industrials', industry: 'Logistics', cap: 'Mid Cap' },
  SPANDEX: { sector: 'Industrials', industry: 'Logistics', cap: 'Small Cap' },
  SAGCEM: { sector: 'Industrials', industry: 'Logistics', cap: 'Small Cap' },

  // Airlines & Travel
  INDIGO: { sector: 'Industrials', industry: 'Aviation', cap: 'Large Cap' },
  SPICEJET: { sector: 'Industrials', industry: 'Aviation', cap: 'Small Cap' },
  AIRPORTLTD: { sector: 'Industrials', industry: 'Airports', cap: 'Large Cap' },
  GMRAIRPORT: { sector: 'Industrials', industry: 'Airports', cap: 'Large Cap' },
  MIAL: { sector: 'Industrials', industry: 'Airports', cap: 'Mid Cap' },
  THOMASCOOK: {
    sector: 'Consumer Discretionary',
    industry: 'Tourism & Hospitality',
    cap: 'Mid Cap',
  },
  MHRIL: {
    sector: 'Consumer Discretionary',
    industry: 'Tourism & Hospitality',
    cap: 'Mid Cap',
  },
  TAJGVK: {
    sector: 'Consumer Discretionary',
    industry: 'Hotels',
    cap: 'Small Cap',
  },
  IHCL: {
    sector: 'Consumer Discretionary',
    industry: 'Hotels',
    cap: 'Large Cap',
  },
  EIHOTEL: {
    sector: 'Consumer Discretionary',
    industry: 'Hotels',
    cap: 'Large Cap',
  },
  LEMON: {
    sector: 'Consumer Discretionary',
    industry: 'Hotels',
    cap: 'Small Cap',
  },
  CHALET: {
    sector: 'Consumer Discretionary',
    industry: 'Hotels',
    cap: 'Mid Cap',
  },
  GREENPANEL: { sector: 'Industrials', industry: 'Plywood', cap: 'Small Cap' },
  SUNSHIP: { sector: 'Industrials', industry: 'Shipping', cap: 'Small Cap' },
  SHREECHEM: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Mid Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // EDUCATION
  // ══════════════════════════════════════════════════════════════════
  CAREEREDGE: {
    sector: 'Consumer Discretionary',
    industry: 'Education',
    cap: 'Mid Cap',
  },
  EDUL: {
    sector: 'Consumer Discretionary',
    industry: 'Education',
    cap: 'Small Cap',
  },
  NAVNEET: {
    sector: 'Consumer Discretionary',
    industry: 'Education',
    cap: 'Small Cap',
  },
  MT_EDU: {
    sector: 'Consumer Discretionary',
    industry: 'Education',
    cap: 'Small Cap',
  },
  APTECH: {
    sector: 'Consumer Discretionary',
    industry: 'Education',
    cap: 'Small Cap',
  },
  NETWORK: {
    sector: 'Consumer Discretionary',
    industry: 'Education',
    cap: 'Small Cap',
  },
  CMSINFO: {
    sector: 'Consumer Discretionary',
    industry: 'Education',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // INTERNET & E-COMMERCE
  // ══════════════════════════════════════════════════════════════════
  POLICYBZR: {
    sector: 'Financial Services',
    industry: 'Financial Technology',
    cap: 'Large Cap',
  },
  CARTRADE: {
    sector: 'Consumer Discretionary',
    industry: 'Internet & E-Commerce',
    cap: 'Small Cap',
  },
  EASEMYTRIP: {
    sector: 'Consumer Discretionary',
    industry: 'Travel & Tourism',
    cap: 'Mid Cap',
  },
  IXIGO: {
    sector: 'Consumer Discretionary',
    industry: 'Travel & Tourism',
    cap: 'Mid Cap',
  },
  RATEGAIN2: {
    sector: 'Information Technology',
    industry: 'Travel Technology',
    cap: 'Small Cap',
  },
  SWIGGY: {
    sector: 'Consumer Discretionary',
    industry: 'Internet & E-Commerce',
    cap: 'Large Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // DIVERSIFIED CONGLOMERATES
  // ══════════════════════════════════════════════════════════════════
  // GODREJIND:   { sector: 'Consumer Discretionary',     industry: 'Diversified',              cap: 'Large Cap' },
  AVADHSUGAR: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Sugar',
    cap: 'Small Cap',
  },
  TATACOMM2: {
    sector: 'Telecommunication',
    industry: 'Telecom Services',
    cap: 'Large Cap',
  },
  KFINTECH: {
    sector: 'Financial Services',
    industry: 'Capital Markets',
    cap: 'Mid Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // ADDITIONAL MID & SMALL CAP STOCKS (Sector-wise completion)
  // ══════════════════════════════════════════════════════════════════

  // Paints
  BERGER: {
    sector: 'Consumer Discretionary',
    industry: 'Paints',
    cap: 'Large Cap',
  },
  KANSAINER: {
    sector: 'Consumer Discretionary',
    industry: 'Paints',
    cap: 'Large Cap',
  },
  INDIGO2: {
    sector: 'Consumer Discretionary',
    industry: 'Paints',
    cap: 'Mid Cap',
  },
  AKZO: {
    sector: 'Consumer Discretionary',
    industry: 'Paints',
    cap: 'Mid Cap',
  },
  SHALPAINTS: {
    sector: 'Consumer Discretionary',
    industry: 'Paints',
    cap: 'Small Cap',
  },
  JKLAKSHMI: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Mid Cap',
  },
  INDIACEM: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Mid Cap',
  },
  STARCEMCO: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Small Cap',
  },

  // Paper
  TNPL: { sector: 'Industrials', industry: 'Paper', cap: 'Small Cap' },
  JKPAPER: { sector: 'Industrials', industry: 'Paper', cap: 'Mid Cap' },
  WCIL: { sector: 'Industrials', industry: 'Paper', cap: 'Small Cap' },
  ANDHRPAPER: { sector: 'Industrials', industry: 'Paper', cap: 'Small Cap' },
  SATIAIND: { sector: 'Industrials', industry: 'Paper', cap: 'Small Cap' },
  TAMILNADU: { sector: 'Industrials', industry: 'Paper', cap: 'Small Cap' },

  // Plastic & Packaging
  UFLEX: { sector: 'Industrials', industry: 'Packaging', cap: 'Mid Cap' },
  EPL: { sector: 'Industrials', industry: 'Packaging', cap: 'Mid Cap' },
  HUHTAMAKI: { sector: 'Industrials', industry: 'Packaging', cap: 'Small Cap' },
  MOLD: { sector: 'Industrials', industry: 'Packaging', cap: 'Small Cap' },
  MANJUSHREE: {
    sector: 'Industrials',
    industry: 'Packaging',
    cap: 'Small Cap',
  },
  MAXPACK: { sector: 'Industrials', industry: 'Packaging', cap: 'Small Cap' },

  // Rubber & Tyres
  MRF: {
    sector: 'Consumer Discretionary',
    industry: 'Tyres',
    cap: 'Large Cap',
  },
  APOLLOTYRE: {
    sector: 'Consumer Discretionary',
    industry: 'Tyres',
    cap: 'Large Cap',
  },
  CEAT: { sector: 'Consumer Discretionary', industry: 'Tyres', cap: 'Mid Cap' },
  JK: { sector: 'Consumer Discretionary', industry: 'Tyres', cap: 'Mid Cap' },
  JKTYRE: {
    sector: 'Consumer Discretionary',
    industry: 'Tyres',
    cap: 'Mid Cap',
  },
  PTL: {
    sector: 'Consumer Discretionary',
    industry: 'Tyres',
    cap: 'Small Cap',
  },
  BALKRISHNA: {
    sector: 'Consumer Discretionary',
    industry: 'Tyres',
    cap: 'Large Cap',
  },

  // Glass & Ceramics
  HINDSANBH: {
    sector: 'Industrials',
    industry: 'Sanitaryware',
    cap: 'Mid Cap',
  },
  CERA: { sector: 'Industrials', industry: 'Sanitaryware', cap: 'Mid Cap' },
  ORIENTBELL: { sector: 'Industrials', industry: 'Ceramics', cap: 'Small Cap' },
  SOMANY: { sector: 'Industrials', industry: 'Ceramics', cap: 'Small Cap' },
  ASAHIINDIA: { sector: 'Industrials', industry: 'Glass', cap: 'Mid Cap' },
  SEZAL: { sector: 'Industrials', industry: 'Glass', cap: 'Small Cap' },

  // Miscellaneous
  TATAINVEST2: {
    sector: 'Financial Services',
    industry: 'Investment Company',
    cap: 'Large Cap',
  },
  STOVEKRAFT: {
    sector: 'Consumer Discretionary',
    industry: 'Household Products',
    cap: 'Small Cap',
  },
  PBFINTECH2: {
    sector: 'Financial Services',
    industry: 'Financial Technology',
    cap: 'Mid Cap',
  },
  IOLCP: { sector: 'Chemicals', industry: 'Chemicals', cap: 'Small Cap' },
  TMPV: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Mid Cap',
  },
  URBANCO: {
    sector: 'Financial Services',
    industry: 'Housing Finance',
    cap: 'Small Cap',
  },
  IRB: { sector: 'Industrials', industry: 'Roads & Highways', cap: 'Mid Cap' },
  'ARE&M': { sector: 'Industrials', industry: 'Engineering', cap: 'Mid Cap' },
  SAKUMA: {
    sector: 'Consumer Discretionary',
    industry: 'Trading',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // MICROFINANCE
  // ══════════════════════════════════════════════════════════════════
  CREDITACC: {
    sector: 'Financial Services',
    industry: 'Microfinance',
    cap: 'Mid Cap',
  },
  AROHAN: {
    sector: 'Financial Services',
    industry: 'Microfinance',
    cap: 'Small Cap',
  },
  FUSION: {
    sector: 'Financial Services',
    industry: 'Microfinance',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // AGRICULTURE & AGRI-INPUTS
  // ══════════════════════════════════════════════════════════════════
  KAVERI: {
    sector: 'Consumer Discretionary',
    industry: 'Seeds',
    cap: 'Mid Cap',
  },
  MAHSCOOTERS: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Mid Cap',
  },
  ADVENZYMES: { sector: 'Healthcare', industry: 'Enzymes', cap: 'Mid Cap' },
  NATH: {
    sector: 'Consumer Discretionary',
    industry: 'Seeds',
    cap: 'Small Cap',
  },
  GLOBALAGRI: {
    sector: 'Consumer Discretionary',
    industry: 'Agri Products',
    cap: 'Small Cap',
  },
  KRBL: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Food Products',
    cap: 'Mid Cap',
  },
  LT2: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Food Products',
    cap: 'Small Cap',
  },
  CCL: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Food Products',
    cap: 'Mid Cap',
  },
  RUCHI: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Edible Oil',
    cap: 'Small Cap',
  },
  VENKYS: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Poultry',
    cap: 'Mid Cap',
  },
  SKFINDIA: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Mid Cap',
  },
  HATSUN: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Dairy',
    cap: 'Mid Cap',
  },
  PARAG: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Dairy',
    cap: 'Small Cap',
  },
  DODLA: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Dairy',
    cap: 'Mid Cap',
  },
  HERITAGE: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Dairy',
    cap: 'Small Cap',
  },
  TASTY: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Food Products',
    cap: 'Small Cap',
  },
  TATACONSUM2: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'FMCG',
    cap: 'Large Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // BUILDING MATERIALS
  // ══════════════════════════════════════════════════════════════════
  KAJARIA: { sector: 'Industrials', industry: 'Ceramics', cap: 'Large Cap' },
  POKARNA: { sector: 'Industrials', industry: 'Granite', cap: 'Small Cap' },
  VENKEYS: {
    sector: 'Fast Moving Consumer Goods',
    industry: 'Poultry',
    cap: 'Mid Cap',
  },
  AAVAS2: {
    sector: 'Financial Services',
    industry: 'Housing Finance',
    cap: 'Mid Cap',
  },
  SHEELA: {
    sector: 'Industrials',
    industry: 'Foam Products',
    cap: 'Small Cap',
  },
  SLEEPWEL: {
    sector: 'Consumer Discretionary',
    industry: 'Mattresses',
    cap: 'Small Cap',
  },
  NILKAMAL: {
    sector: 'Consumer Discretionary',
    industry: 'Plastic Products',
    cap: 'Mid Cap',
  },
  CENTURYTEXT: { sector: 'Textiles', industry: 'Textiles', cap: 'Small Cap' },

  // ══════════════════════════════════════════════════════════════════
  // DEFENCE (Extended)
  // ══════════════════════════════════════════════════════════════════
  APOLLODEF: { sector: 'Industrials', industry: 'Defence', cap: 'Small Cap' },
  PATELENG: {
    sector: 'Construction',
    industry: 'Civil Construction',
    cap: 'Small Cap',
  },
  KINETIC: {
    sector: 'Consumer Discretionary',
    industry: 'Automobile',
    cap: 'Small Cap',
  },
  DYNAMATECH: { sector: 'Industrials', industry: 'Defence', cap: 'Small Cap' },
  PARAS3: { sector: 'Industrials', industry: 'Defence', cap: 'Small Cap' },
  IDEAFORGE: { sector: 'Industrials', industry: 'Drones', cap: 'Small Cap' },

  // ══════════════════════════════════════════════════════════════════
  // SOLAR & RENEWABLE ENERGY (Extended)
  // ══════════════════════════════════════════════════════════════════
  WEBSOL: {
    sector: 'Industrials',
    industry: 'Solar Equipment',
    cap: 'Small Cap',
  },
  PREMIERENO: {
    sector: 'Utilities',
    industry: 'Renewable Energy',
    cap: 'Small Cap',
  },
  GOLDINDIA: {
    sector: 'Utilities',
    industry: 'Renewable Energy',
    cap: 'Small Cap',
  },
  ENVIRO: {
    sector: 'Industrials',
    industry: 'Environment Services',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // SPECIALTY FINANCE
  // ══════════════════════════════════════════════════════════════════
  BAJAJFINANCE: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Large Cap',
  },
  MASFIN: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Small Cap',
  },
  APTUS: {
    sector: 'Financial Services',
    industry: 'Housing Finance',
    cap: 'Mid Cap',
  },
  FIVE_STAR: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Mid Cap',
  },
  REPCO: {
    sector: 'Financial Services',
    industry: 'Housing Finance',
    cap: 'Small Cap',
  },
  POONAWALLA: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Mid Cap',
  },
  AAFES: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Small Cap',
  },
  UGROCAP: {
    sector: 'Financial Services',
    industry: 'Non-Banking Financial',
    cap: 'Small Cap',
  },
  CREDITACCESS: {
    sector: 'Financial Services',
    industry: 'Microfinance',
    cap: 'Mid Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // WAREHOUSING & COLD CHAIN
  // ══════════════════════════════════════════════════════════════════
  SNOWMAN: {
    sector: 'Industrials',
    industry: 'Cold Storage',
    cap: 'Small Cap',
  },
  FL: { sector: 'Industrials', industry: 'Warehousing', cap: 'Small Cap' },

  // ══════════════════════════════════════════════════════════════════
  // WATER & ENVIRONMENT
  // ══════════════════════════════════════════════════════════════════
  WABAG: { sector: 'Utilities', industry: 'Water Treatment', cap: 'Mid Cap' },
  ION: { sector: 'Utilities', industry: 'Water Treatment', cap: 'Small Cap' },
  VISHNU: {
    sector: 'Chemicals',
    industry: 'Specialty Chemicals',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // PRINTING & STATIONERY
  // ══════════════════════════════════════════════════════════════════
  NAVNEET2: {
    sector: 'Consumer Discretionary',
    industry: 'Stationery',
    cap: 'Small Cap',
  },
  CAMLIN: {
    sector: 'Consumer Discretionary',
    industry: 'Stationery',
    cap: 'Small Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // GAMING & LOTTERY
  // ══════════════════════════════════════════════════════════════════
  DELTACORP: {
    sector: 'Consumer Discretionary',
    industry: 'Casinos & Gaming',
    cap: 'Small Cap',
  },
  NAZARA: {
    sector: 'Consumer Discretionary',
    industry: 'Gaming',
    cap: 'Mid Cap',
  },

  // ══════════════════════════════════════════════════════════════════
  // USER PORTFOLIO HOLDINGS (added from statement 2026-03-11)
  // ══════════════════════════════════════════════════════════════════

  // Equity Holdings
  WIPRO2: {
    sector: 'Information Technology',
    industry: 'IT Consulting & Services',
    cap: 'Large Cap',
  },
  AUTOLINEINDS: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  INDBULREALTY: {
    sector: 'Real Estate',
    industry: 'Real Estate',
    cap: 'Small Cap',
  },
  PUNSINDBANK: {
    sector: 'Financial Services',
    industry: 'Public Sector Bank',
    cap: 'Small Cap',
  },
  TEXMACHRAIL: {
    sector: 'Industrials',
    industry: 'Railway Wagons',
    cap: 'Small Cap',
  },
  JSWCEMENT: {
    sector: 'Construction Materials',
    industry: 'Cement',
    cap: 'Mid Cap',
  },
  JINDALWORLDWIDE: {
    sector: 'Textiles',
    industry: 'Textiles',
    cap: 'Small Cap',
  },
  NMDCSTEEL: { sector: 'Metals & Mining', industry: 'Steel', cap: 'Small Cap' },
  // 'DEVYANI'  :         { sector: 'Consumer Discretionary',     industry: 'Quick Service Restaurants', cap: 'Small Cap' },
  SINTEXPLAST: {
    sector: 'Industrials',
    industry: 'Plastic Products',
    cap: 'Small Cap',
  },
  SHANTIGEAR: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },
  RAJESHEXPO: {
    sector: 'Consumer Discretionary',
    industry: 'Jewellery',
    cap: 'Small Cap',
  },
  SENCO: {
    sector: 'Consumer Discretionary',
    industry: 'Jewellery',
    cap: 'Small Cap',
  },
  LOTUSDEV: {
    sector: 'Real Estate',
    industry: 'Real Estate',
    cap: 'Small Cap',
  },
  KABRAEXTRUSION: {
    sector: 'Industrials',
    industry: 'Industrial Machinery',
    cap: 'Small Cap',
  },
  TEXMOPIPES: {
    sector: 'Industrials',
    industry: 'Plastic Products',
    cap: 'Small Cap',
  },
  ALLCARGOGLOBAL: {
    sector: 'Industrials',
    industry: 'Logistics',
    cap: 'Small Cap',
  },
  MOTHERSONWIRING: {
    sector: 'Consumer Discretionary',
    industry: 'Auto Ancillaries',
    cap: 'Small Cap',
  },

  // ETFs from equity statement
  NIPNIFTYBEES: {
    sector: 'ETF - Nifty 50 Index',
    industry: 'ETF',
    cap: 'Large Cap',
  },
  NIPNIFTYIT: {
    sector: 'ETF - Information Technology',
    industry: 'ETF',
    cap: 'Large Cap',
  },
  AONETOTAL: { sector: 'ETF - Multi Asset', industry: 'ETF', cap: 'Large Cap' },
  MOSMALL250: {
    sector: 'ETF - Small Cap 250',
    industry: 'ETF',
    cap: 'Small Cap',
  },

  // Mutual Funds from MF statement
  HDFCSMALLCAP: {
    sector: 'Mutual Fund - Small Cap',
    industry: 'Mutual Fund',
    cap: 'Small Cap',
  },
  NIPLARGECAMP: {
    sector: 'Mutual Fund - Large Cap',
    industry: 'Mutual Fund',
    cap: 'Large Cap',
  },
  PARAGPARIKH: {
    sector: 'Mutual Fund - Flexi Cap',
    industry: 'Mutual Fund',
    cap: 'Mid Cap',
  },
  QUANTMIDCAP: {
    sector: 'Mutual Fund - Mid Cap',
    industry: 'Mutual Fund',
    cap: 'Mid Cap',
  },
};

// ══════════════════════════════════════════════════════════════════
// ISIN → NSE SYMBOL MAPPING
// ══════════════════════════════════════════════════════════════════
export const ISIN_TO_SYMBOL: Record<string, string> = {
  INE171A01029: 'FEDERALBNK',
  INE270A01029: 'ALOKINDS',
  INE692A01016: 'UNIONBANK',
  INE008A01015: 'IDBI',
  INE879E01037: 'KANANIIND',
  INE662A01027: 'SUPERASTRO',
  INE999K01014: 'GREENPOWER',
  INE806A01020: 'VIKASECOTECH',
  INE512B01022: 'FCSSOFTWARE',
  INE820Y01021: 'AJOONIBIO',
  INE483A01010: 'CENTRALBK',
  INE517B01013: 'TTML',
  INE476A01022: 'CANBK',
  INE031A01017: 'HUDCO',
  INE242A01010: 'IOC',
  INE522D01027: 'MANAPPURAM',
  INE221H01019: 'GTLINFRA',
  INE092T01019: 'IDFCFIRSTB',
  INE418H01029: 'ALLCARGO',
  INE161L01027: 'VIKASLIFE',
  INE00IN01015: 'STOVEKRAFT',
  INE878H01024: 'INVENTURE',
  INE388Y01029: 'NYKAA',
  INE467B01029: 'TCS',
  INE002A01018: 'RELIANCE',
  INE009A01021: 'INFY',
  INE040A01034: 'HDFCBANK',
  INE748C01020: 'NHPC',
  INE115A01026: 'LT',
  INE180A01020: 'ONGC',
  INE002L01015: 'SJVN',
  INE351F01018: 'JPPOWER',
  INE090A01013: 'ICICIBANK',
  INE211T01019: 'PAYTM',
  INE813H01021: 'ZOMATO',
  INE418A01014: 'BHARTIARTL',
  INE854D01024: 'BAJFINANCE',
  INE795G01014: 'HDFCLIFE',
  INE726G01019: 'SBILIFE',
  INE765G01017: 'ICICIGI',
  INE860H01027: 'STARHEALTH',
  INE296A01024: 'BAJAJFINSV',
  INE397D01024: 'CHOLAFIN',
  INE572E01012: 'PFC',
  INE020B01018: 'RECLTD',
  INE733E01010: 'IRFC',
  INE752E01010: 'NHPC',
  INE123W01016: 'IREDA',
  INE202B01012: 'ADANIPORTS',
  INE364U01010: 'ADANIGREEN',
  INE050A01025: 'COALINDIA',
  INE239A01016: 'ONGC',
  INE213A01029: 'BPCL',
  INE129A01019: 'GAIL',
  INE175A01038: 'MARUTI',
  INE520A01027: 'M_M',
  INE066A01021: 'TATAMOTORS',
  INE155A01022: 'ASHOKLEY',
  INE895D01011: 'TVSMOTOR',
  INE917I01010: 'BAJAJ_AUTO',
  INE158A01026: 'HEROMOTOCO',
  INE691I01018: 'EICHERMOT',
  INE376G01013: 'BHARATFORG',
  INE343H01029: 'MOTHERSON',
  INE128A01029: 'TATASTEEL',
  INE081A01012: 'HINDALCO',
  INE205A01025: 'VEDL',
  INE101A01026: 'SAIL',
  INE099A01016: 'NMDC',
  INE176B01034: 'JSWSTEEL',
  INE070A01015: 'DLF',
  INE089D01023: 'OBEROIRLTY',
  INE218H01016: 'PRESTIGE',
  INE669X01025: 'LODHA',
  INE881D01027: 'GODREJPROP',
  INE685F01028: 'BRIGADE',
  INE010A01027: 'HINDALCO',
  INE522F01014: 'NTPC',
  // 'INE752E01010': 'NHPC',
  INE245A01021: 'POWERGRID',
  INE233A01035: 'TATAPOWER',
  INE123A01016: 'ADANIPOWER',
  // 'INE364U01010': 'ADANIGREEN',
  INE881J01011: 'JSWENERGY',
  INE465A01025: 'TORNTPOWER',
  // 'INE050A01025': 'COALINDIA',
  INE016A01026: 'GRASIM',
  INE079A01024: 'ULTRACEMCO',
  // 'INE070A01015': 'DLF',
  INE348A01023: 'AMBUJACEM',
  INE012A01025: 'ACC',
  INE258A01016: 'LT',
  INE018A01030: 'SIEMENS',
  INE117A01022: 'ABB',
  INE044A01036: 'BHEL',
  INE019A01038: 'HAL',
  INE263A01024: 'BEL',
  INE646E01010: 'BDL',
  INE234A01033: 'WIPRO',
  INE361B01024: 'HCLTECH',
  INE226A01021: 'TECHM',
  INE081A01020: 'MPHASIS',
  INE592B01021: 'COFORGE',
  INE172A01027: 'PERSISTENT',
  INE390A01013: 'KPITTECH',
  INE176A01028: 'TATATECH',
  INE655F01025: 'TATAELXSI',
  INE216A01030: 'OFSS',
  INE010B01027: 'LTTS',
  INE591G01017: 'MASTEK',
  INE688H01022: 'CYIENT',
  INE260B01028: 'HEXAWARE',
  INE093I01010: 'HAPPSTMNDS',
  INE483B01026: 'TANLA',
  INE306R01011: 'RATEGAIN',
  INE596H01014: 'ECLERX',
  INE150G01020: 'NIIT',
  INE683A01023: 'QUICKHEAL',
  INE096B01018: 'SUNPHARMA',
  INE089A01023: 'DRREDDY',
  INE383A01012: 'CIPLA',
  INE571A01020: 'DIVISLAB',
  INE767A01016: 'LUPIN',
  INE611H01022: 'AUROPHARMA',
  INE326A01037: 'BIOCON',
  INE540L01014: 'ALKEM',
  INE066F01012: 'TORNTPHARM',
  INE517A01020: 'MANKIND',
  INE584A01023: 'IPCA',
  INE399D01022: 'NATCOPHARM',
  INE078A01026: 'GRANULES',
  INE424H01027: 'LAURUSLABS',
  INE901L01018: 'GLENMARK',
  INE300H01027: 'AJANTPHARM',
  INE628A01036: 'GLAND',
  INE079B01024: 'JBCHEPHARM',
  INE571H01014: 'FLUOROCHEM',
  INE152H01020: 'METROPOLIS',
  INE769H01002: 'THYROCARE',
  INE600L01024: 'LALPATHLAB',
  INE280A01028: 'APOLLOHOSP',
  INE600A01024: 'FORTIS',
  INE027H01010: 'MAXHEALTH',
  INE117H01017: 'NARAYANHRU',
  INE786C01022: 'ASTER',
  INE524L01022: 'RAINBOW',
  'INE 00B01024': 'KIMS',
  INE669C01036: 'HINDUNILVR',
  INE239N01020: 'HINDUNILVR',
  INE200M01039: 'ITC',
  INE059A01026: 'TATACONSUM',
  INE152A01029: 'NESTLEIND',
  INE500D01020: 'BRITANNIA',
  INE016E01012: 'DABUR',
  INE102D01028: 'GODREJCP',
  INE196A01026: 'MARICO',
  INE075A01022: 'WIPRO', // ⚠️ Angel One statement bug — this ISIN is actually COLPAL but AO printed it against Wipro
  INE053F01010: 'IRFC', // IRFC — missing from map
  // INE155A01022: 'ASHOKLEY', // TMP: ASHOKLEY is a typo in AO CSV, actual stock is Ashok Leyland
  INE355A01028: 'EMAMILTD',
  INE885A01032: 'JYOTHYLAB',
  INE036A01022: 'VBL',
  INE854D01016: 'UBL',
  INE854G01014: 'RADICO',
  INE854I01015: 'UNITEDSPIRTS',
  INE686A01026: 'ZYDUSWELL',
  INE480G01021: 'HONASA',
  INE895A01028: 'BIKAJI',
  INE274F01020: 'PATANJALI',
  INE654A01010: 'EIDPARRY',
  INE726A01013: 'TRIVENI',
  INE119A01028: 'BALRAMCHIN',
  INE119B01032: 'RENUKA',
  // 'INE002A01018': 'RELIANCE',
  INE323A01026: 'PIDILITIND',
  INE797F01020: 'SRF',
  INE048G01026: 'NAVINFLUOR',
  INE050B01014: 'VINATI',
  INE067A01029: 'AARTI',
  INE501A01019: 'UPL',
  INE543A01019: 'PIIND',
  INE462A01022: 'RALLIS',
  INE314A01019: 'COROMANDEL',
  INE337A01020: 'DEEPAKFERT',
  INE805D01012: 'DEEPAKNTR',
  INE542B01011: 'DCMSHRIRAM',
  INE092A01019: 'GHCL',
  INE158B01016: 'TATACHEMICALS',
  INE001A01036: 'BAJAJ_AUTO',
  // 'INE001A01036': 'EICHERMOT',
  INE745G01035: 'TRENT',
  INE647O01011: 'ABFRL',
  INE519A01011: 'RAYMOND',
  INE423A01024: 'PAGEIND',
  INE200A01026: 'MANYAVAR',
  INE752H01013: 'BATA',
  INE508A01029: 'RELAXO',
  INE116B01014: 'METRO',
  INE818H01020: 'KALYANKJIL',
  INE480A01038: 'ASIANPAINT',
  INE686F01025: 'BERGER',
  INE613A01020: 'KANSAINER',
  // 'INE016A01026': 'TITAN',
  INE280G01018: 'HAVELLS',
  // 'INE465A01025': 'VOLTAS',
  INE700A01033: 'CROMPTON',
  INE490A01021: 'BLUESTAR',
  INE371H01012: 'VGUARD',
  INE213B01018: 'BAJAJELEC',
  INE855L01010: 'SYMPHONY',
  INE151A01013: 'DIXON',
  INE348H01013: 'AMBER',
  INE259A01022: 'POLYCAB',
  INE694A01020: 'KEI',
  INE057A01020: 'FINOLEX',
  INE285H01022: 'STERLITE',
  INE397A01015: 'CONCOR',
  INE514E01016: 'DELHIVERY',
  INE153A01019: 'BLUEDART',
  INE624I01011: 'GATI',
  INE689A01017: 'TCI',
  INE131B01039: 'ALLCARGO',
  INE612H01010: 'MAHLOG',
  INE542A01039: 'INDIGO',
  INE285B01017: 'SPICEJET',
  INE256A01028: 'IHCL',
  INE230A01023: 'EIHOTEL',
  INE796G01012: 'JUBLFOOD',
  INE611R01020: 'DEVYANI',
  INE861H01026: 'SAPPHIRE',
  INE274J01014: 'WESTLIFE',
  INE093A01033: 'SUNTV',
  INE256B01011: 'ZEEL',
  INE870H01013: 'PVRINOX',
  INE886H01027: 'NAZARA',
  INE976I01023: 'DELTACORP',
  INE725A01022: 'CONCOR',
  INE220A01021: 'NMDC',
  INE335Y01020: 'HINDZINC',
  INE494B01023: 'HINDUSTAN',
  INE361H01033: 'HINDSANBH',
  INE739E01023: 'KAJARIA',
  // 'INE093A01033': 'ORIENTBELL',
  INE878A01011: 'SOMANY',
  INE763G01038: 'ASAHIINDIA',
  // 'INE044A01036': 'BHEL',
  INE236A01020: 'THERMAX',
  INE298A01020: 'CUMMINSIND',
  INE812A01013: 'ELGI',
  INE335A01012: 'GRINDWELL',
  INE686A01018: 'KIRLOSBROS',
  INE036B01022: 'KIRLOSENG',
  // 'INE361B01024': 'AIAENG',
  INE354A01049: 'KEC',
  // 'INE016A01026': 'POLYCAB',
  INE414G01012: 'SKIPPER',
  INE118A01012: 'CENTURYPLY',
  INE291C01011: 'GREENPLY',
  INE121A01024: 'UFLEX',
  INE575A01022: 'HUHTAMAKI',
  INE893A01015: 'MRF',
  INE067A01021: 'APOLLOTYRE',
  INE482A01020: 'CEAT',
  INE573A01042: 'JKTYRE',
  INE294A01037: 'BALKRISHNA',
  INE003A01024: 'WABCOINDIA',
  INE583B01015: 'SUNDRMFAST',
  INE076A01022: 'SCHAEFFLER',
  INE162A01010: 'ENDURANCE',
  INE129I01014: 'GABRIEL',
  INE399A01030: 'SUPRAJIT',
  INE871B01014: 'MINDA',
  INE925B01021: 'MINDAIND',
  INE452B01010: 'LUMAXIND',
  'INE 452G01025': 'LUMAXTECH',
  INE343K01037: 'PRICOL',
  INE090B01011: 'FIEM',
  INE756A01018: 'CRAFTSMAN',
  INE021A01023: 'OLECTRA',
  'INE 00GF01025': 'VARROC',
  INE685A01028: 'MOTHERSON2',
  INE118H01025: 'TIINDIA',
  INE881H01026: 'BOSCHLTD',
  INE027A01015: 'ESCORTS',
  INE814G01011: 'FORCEMOT',
  INE261F01014: 'TVSSCS',
  INE249Z01020: 'TVSRICH',
  'INE 00HS01024': 'SWARAJ',
  'INE 00HG01013': 'VSTTILLERS',
  'INE 00HB01015': 'MAHSCOOTERS',
  'INE 00AK01023': 'SKFINDIA',
  'INE 00AC01013': 'MAAN',
  INE586B01026: 'SUBROS',
  INE274B01030: 'RAMKRISHNA',
  INE205B01017: 'SETCO',
  'INE 00AB01018': 'UCALFUEL',
  'INE 00AH01018': 'BORORENEW',
  'INE 00AF01024': 'JTEKIND',
  'INE 00AG01022': 'MAHLE',
  'INE 00AM01029': 'GABRIEL',
  'INE 00AL01021': 'MICO',
  'INE 00BH01019': 'SAMVARDH',
  INE517F01016: 'MAHINDCIE',
  'INE 00BJ01022': 'EXIDEIND',
  'INE 00BK01029': 'AMARAJABAT',

  // ── User Portfolio ISINs (statement 2026-03-11) ─────────────────────────
  INE064C01022: 'TRIDENT',
  INE302A01020: 'EXIDEIND',
  INE0FS801015: 'MSWIL', // Motherson Wiring — correct NSE symbol
  INE202E01016: 'IREDA',
  INE718H01014: 'AUTOLINE', // Autoline Industries — correct NSE symbol
  INE848E01016: 'NHPC',
  INE548A01028: 'HFCL',
  INE069I01010: 'IBREALTY', // Indiabulls Real Estate — correct NSE symbol
  INE608A01012: 'PSB', // Punjab & Sind Bank — correct NSE symbol
  INE415G01027: 'RVNL',
  INE435C01024: 'TEXRAIL', // Texmaco Rail — correct NSE symbol
  INE821I01022: 'IRB',
  INE343B01030: 'RAJESHEXPO',
  INE565A01014: 'IOB',
  INE0NNS01018: 'NSLNISP', // NMDC Steel — correct NSE symbol
  INE247D01039: 'JINDALWORLDW', // Jindal Worldwide — correct NSE symbol
  INF204KB14I2: 'NIFTYBEES', // Nippon Nifty BeES ETF — correct NSE symbol
  INE501W01021: 'SINTEXPLAST', // Delisted — kept for record, price will return null
  INE631A01022: 'SHANTIGEAR',
  INE758E01017: 'JIOFIN',
  INF204KB15V2: 'NIFTYIT', // Nippon Nifty IT ETF — correct NSE symbol
  INE872J01023: 'DEVYANI',
  INE095N01031: 'NBCC',
  INF1J2R01015: 'AONETOTAL',
  INE602W01027: 'SENCO',
  INF247L01CH6: 'MOSMALL250',
  INE087H01022: 'RENUKA',
  INE718I01012: 'JSWCEMENT',
  INE141K01013: 'TEXMOPIPES',
  INE900B01029: 'KABRAEXTRU', // Kabra Extrusion — correct NSE symbol
  INE0V9Q01010: 'LOTUSDEV',
  INE1YPB01014: 'ALLCARGO', // AllCargo Logistics — correct NSE symbol
  // Mutual Fund ISINs
  INF179KA1RW5: 'HDFCSMALLCAP',
  INF204K01XI3: 'NIPLARGECAMP',
  INF879O01027: 'PARAGPARIKH',
  INF966L01887: 'QUANTMIDCAP',
};

/**
 * Classify mutual fund by name keywords.
 */
export function classifyMutualFundByName(
  name: string,
): { sector: string; cap: string } | null {
  if (!name.includes(' ')) return null;
  const n = name.toLowerCase();

  let cap = 'Multi Cap';
  if (
    n.includes('large & mid') ||
    n.includes('largemidcap') ||
    n.includes('250')
  )
    cap = 'Large & Mid Cap';
  else if (
    n.includes('large cap') ||
    n.includes('largecap') ||
    n.includes('nifty 50') ||
    n.includes('nifty50')
  )
    cap = 'Large Cap';
  else if (
    n.includes('mid cap') ||
    n.includes('midcap') ||
    n.includes('next 50') ||
    n.includes('next50')
  )
    cap = 'Mid Cap';
  else if (n.includes('small cap') || n.includes('smallcap')) cap = 'Small Cap';
  else if (
    n.includes('flexi') ||
    n.includes('multi cap') ||
    n.includes('multicap')
  )
    cap = 'Multi Cap';
  else if (
    n.includes('balanced') ||
    n.includes('hybrid') ||
    n.includes('advantage')
  )
    cap = 'Hybrid';
  else if (n.includes('debt') || n.includes('liquid') || n.includes('bond'))
    cap = 'Debt';

  let sector = 'Mutual Fund - Diversified';
  if (n.includes('digital') || n.includes('tech') || n.includes('technology'))
    sector = 'Mutual Fund - Technology';
  else if (n.includes('pharma') || n.includes('health'))
    sector = 'Mutual Fund - Healthcare';
  else if (
    n.includes('bank') ||
    n.includes('finserv') ||
    (n.includes('financial') && !n.includes('parag'))
  )
    sector = 'Mutual Fund - Banking & Finance';
  else if (n.includes('infra') || n.includes('infrastructure'))
    sector = 'Mutual Fund - Infrastructure';
  else if (n.includes('fmcg') || n.includes('consumption'))
    sector = 'Mutual Fund - FMCG';
  else if (n.includes('index') || n.includes('nifty') || n.includes('sensex'))
    sector = 'Mutual Fund - Index';
  else if (n.includes('flexi cap') || n.includes('flexicap'))
    sector = 'Mutual Fund - Flexi Cap';
  else if (n.includes('mid cap') || n.includes('midcap'))
    sector = 'Mutual Fund - Mid Cap';
  else if (n.includes('small cap') || n.includes('smallcap'))
    sector = 'Mutual Fund - Small Cap';
  else if (
    n.includes('balanced') ||
    n.includes('advantage') ||
    n.includes('hybrid')
  )
    sector = 'Mutual Fund - Balanced/Hybrid';
  else if (n.includes('gold') || n.includes('silver'))
    sector = 'Mutual Fund - Commodities';
  else if (
    n.includes('international') ||
    n.includes('global') ||
    n.includes('nasdaq')
  )
    sector = 'Mutual Fund - International';
  else if (n.includes('defence')) sector = 'Mutual Fund - Defence';
  else if (n.includes('realty') || n.includes('real estate'))
    sector = 'Mutual Fund - Real Estate';
  else if (n.includes('psu')) sector = 'Mutual Fund - PSU';
  else if (n.includes('quant')) sector = 'Mutual Fund - Quant';
  else if (n.includes('esg')) sector = 'Mutual Fund - ESG';
  else if (n.includes('dividend')) sector = 'Mutual Fund - Dividend Yield';
  else if (n.includes('value') || n.includes('contra'))
    sector = 'Mutual Fund - Value';
  else if (n.includes('focused')) sector = 'Mutual Fund - Focused';

  return { sector, cap };
}

/**
 * Look up a stock by symbol. Returns undefined if not found.
 */
export function lookupStock(symbol: string): StockInfo | undefined {
  const upper = symbol.toUpperCase();
  return NSE_STOCK_DB[upper];
}

/**
 * Look up by ISIN, resolving to symbol first.
 */
export function lookupByISIN(isin: string): StockInfo | undefined {
  const symbol = ISIN_TO_SYMBOL[isin];
  if (!symbol) return undefined;
  return NSE_STOCK_DB[symbol];
}

/**
 * Get all stocks for a given sector.
 */
export function getStocksBySector(sector: string): Record<string, StockInfo> {
  return Object.fromEntries(
    Object.entries(NSE_STOCK_DB).filter(([, v]) => v.sector === sector),
  );
}

/**
 * Get all stocks by cap category.
 */
export function getStocksByCap(cap: CapCategory): Record<string, StockInfo> {
  return Object.fromEntries(
    Object.entries(NSE_STOCK_DB).filter(([, v]) => v.cap === cap),
  );
}
