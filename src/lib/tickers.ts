// ~210 tickers — US majors + Israeli NASDAQ + TASE
export const TICKERS = [
  // US Mega-cap Tech
  "NVDA", "AAPL", "MSFT", "GOOG", "META", "AMZN", "TSLA", "AVGO", "ORCL", "NFLX",
  // US Semis
  "AMD", "MU", "QCOM", "AMAT", "LRCX", "ASML", "KLAC", "TSM", "ARM",
  "INTC", "TXN", "MRVL", "ON", "MCHP", "ADI", "SWKS",
  // US Software / Cloud / Security
  "PLTR", "CRWD", "NET", "DDOG", "ZS", "PANW", "FTNT", "ADBE", "INTU", "NOW",
  "CRM", "WDAY", "VEEV", "HUBS", "MDB", "SNOW", "TWLO", "OKTA", "BILL", "GTLB",
  // US High-Growth
  "SHOP", "MELI", "UBER", "APP", "AXON", "DUOL", "TTD",
  "RBLX", "SNAP", "PINS", "HOOD", "SOFI", "AFRM",
  // US Healthcare / Biotech
  "UNH", "LLY", "ABBV", "ISRG", "REGN", "VRTX",
  "JNJ", "PFE", "MRK", "BMY", "GILD", "AMGN", "CVS", "CI", "HCA", "MDT", "DXCM",
  // US Consumer / Retail
  "COST", "WMT", "HD", "CMG",
  "NKE", "SBUX", "MCD", "LULU", "TGT", "LOW", "TJX", "BKNG", "ABNB",
  // US Financials
  "JPM", "V", "MA", "COIN",
  "GS", "MS", "BAC", "AXP", "BLK", "SCHW", "SQ", "PYPL", "COF",
  // US Industrials / Defense
  "LMT", "RTX", "CAT",
  "BA", "GE", "HON", "UPS", "FDX", "DE", "ETN",
  // US Energy
  "XOM", "CVX", "COP", "SLB",
  // Israeli on NASDAQ
  "CHKP", "NICE", "MNDY", "WIX", "GLBE", "CYBR",
  "TEVA", "RDNT", "SEDG",
] as const;

export const TASE_TICKERS = [
  "POLI.TA", "LUMI.TA", "DSCT.TA", "MZTF.TA", "FIBI.TA",
  "ICL.TA", "AZRG.TA", "EMMT.TA",
  "DLEKG.TA", "ORL.TA",
  "ESLT.TA", "NICE.TA",
] as const;

export const ALL_TICKERS = [...TICKERS, ...TASE_TICKERS] as const;

export type Ticker = (typeof ALL_TICKERS)[number];

export type SectorKey =
  | "Tech"
  | "Semis"
  | "Software"
  | "Healthcare"
  | "Consumer"
  | "Finance"
  | "Energy"
  | "Industrial"
  | "Israel"
  | "TASE";

export interface SectorMeta {
  label: string;
  cssClass: string;
  color: string;
  market: "US" | "IL";
}

export const SECTOR_META: Record<SectorKey, SectorMeta> = {
  Tech:       { label: "Mega-cap Tech",  cssClass: "sector-tech",       color: "#6366f1", market: "US" },
  Semis:      { label: "Semis & HW",     cssClass: "sector-semis",      color: "#8b5cf6", market: "US" },
  Software:   { label: "Software/Cloud", cssClass: "sector-software",   color: "#22d3ee", market: "US" },
  Healthcare: { label: "Healthcare",     cssClass: "sector-healthcare",  color: "#10b981", market: "US" },
  Consumer:   { label: "Consumer",       cssClass: "sector-consumer",   color: "#f59e0b", market: "US" },
  Finance:    { label: "Financials",     cssClass: "sector-finance",    color: "#3b82f6", market: "US" },
  Energy:     { label: "Energy/Indus.",  cssClass: "sector-energy",     color: "#f97316", market: "US" },
  Industrial: { label: "Industrials",    cssClass: "sector-industrial", color: "#94a3b8", market: "US" },
  Israel:     { label: "Israel NASDAQ",  cssClass: "sector-israel",     color: "#60a5fa", market: "IL" },
  TASE:       { label: "TASE",           cssClass: "sector-tase",       color: "#34d399", market: "IL" },
};

export const SECTOR_MAP: Record<string, SectorKey> = {
  // Tech mega-cap
  NVDA: "Tech", AAPL: "Tech", MSFT: "Tech", GOOG: "Tech", META: "Tech",
  AMZN: "Tech", TSLA: "Tech", AVGO: "Tech", ORCL: "Tech", NFLX: "Tech",
  // Semis
  AMD: "Semis", MU: "Semis", QCOM: "Semis", AMAT: "Semis", LRCX: "Semis",
  ASML: "Semis", KLAC: "Semis", TSM: "Semis", ARM: "Semis",
  INTC: "Semis", TXN: "Semis", MRVL: "Semis", ON: "Semis",
  MCHP: "Semis", ADI: "Semis", SWKS: "Semis",
  // Software / Cloud / Security
  PLTR: "Software", CRWD: "Software", NET: "Software", DDOG: "Software",
  ZS: "Software", PANW: "Software", FTNT: "Software", ADBE: "Software",
  INTU: "Software", NOW: "Software",
  CRM: "Software", WDAY: "Software", VEEV: "Software", HUBS: "Software",
  MDB: "Software", SNOW: "Software", TWLO: "Software", OKTA: "Software",
  BILL: "Software", GTLB: "Software",
  // High-Growth
  SHOP: "Software", MELI: "Consumer", UBER: "Consumer", APP: "Software",
  AXON: "Industrial", DUOL: "Software", TTD: "Software",
  RBLX: "Software", SNAP: "Software", PINS: "Software",
  HOOD: "Finance", SOFI: "Finance", AFRM: "Finance",
  // Healthcare
  UNH: "Healthcare", LLY: "Healthcare", ABBV: "Healthcare",
  ISRG: "Healthcare", REGN: "Healthcare", VRTX: "Healthcare",
  JNJ: "Healthcare", PFE: "Healthcare", MRK: "Healthcare",
  BMY: "Healthcare", GILD: "Healthcare", AMGN: "Healthcare",
  CVS: "Healthcare", CI: "Healthcare", HCA: "Healthcare",
  MDT: "Healthcare", DXCM: "Healthcare",
  // Consumer
  COST: "Consumer", WMT: "Consumer", HD: "Consumer", CMG: "Consumer",
  NKE: "Consumer", SBUX: "Consumer", MCD: "Consumer", LULU: "Consumer",
  TGT: "Consumer", LOW: "Consumer", TJX: "Consumer", BKNG: "Consumer",
  ABNB: "Consumer",
  // Finance
  JPM: "Finance", V: "Finance", MA: "Finance", COIN: "Finance",
  GS: "Finance", MS: "Finance", BAC: "Finance", AXP: "Finance",
  BLK: "Finance", SCHW: "Finance", SQ: "Finance", PYPL: "Finance",
  COF: "Finance",
  // Industrial / Defense
  LMT: "Industrial", RTX: "Industrial", CAT: "Industrial",
  BA: "Industrial", GE: "Industrial", HON: "Industrial",
  UPS: "Industrial", FDX: "Industrial", DE: "Industrial", ETN: "Industrial",
  // Energy
  XOM: "Energy", CVX: "Energy", COP: "Energy", SLB: "Energy",
  // Israeli NASDAQ
  CHKP: "Israel", NICE: "Israel", MNDY: "Israel",
  WIX: "Israel", GLBE: "Israel", CYBR: "Israel",
  TEVA: "Israel", RDNT: "Israel", SEDG: "Israel",
  // TASE
  "POLI.TA": "TASE", "LUMI.TA": "TASE", "DSCT.TA": "TASE",
  "MZTF.TA": "TASE", "FIBI.TA": "TASE", "ICL.TA": "TASE",
  "AZRG.TA": "TASE", "EMMT.TA": "TASE",
  "DLEKG.TA": "TASE", "ORL.TA": "TASE",
  "ESLT.TA": "TASE", "NICE.TA": "TASE",
};

export function getSector(symbol: string): SectorKey {
  return SECTOR_MAP[symbol] ?? (symbol.endsWith(".TA") ? "TASE" : "Tech");
}

export const SECTOR_ORDER: SectorKey[] = [
  "Tech", "Semis", "Software", "Healthcare",
  "Consumer", "Finance", "Energy", "Industrial",
  "Israel", "TASE",
];

export const BUFFETT_QUOTES = [
  { text: "Price is what you pay. Value is what you get.", context: "On value investing" },
  { text: "Be fearful when others are greedy and greedy when others are fearful.", context: "On market timing" },
  { text: "It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.", context: "On quality" },
  { text: "Our favorite holding period is forever.", context: "On long-term thinking" },
  { text: "The stock market is a device for transferring money from the impatient to the patient.", context: "On patience" },
  { text: "Risk comes from not knowing what you're doing.", context: "On risk management" },
  { text: "In the short run, the market is a voting machine, but in the long run it is a weighing machine.", context: "On market behavior" },
  { text: "Time is the friend of the wonderful company, the enemy of the mediocre.", context: "On holding quality" },
  { text: "Never invest in a business you cannot understand.", context: "On circle of competence" },
  { text: "The most important quality for an investor is temperament, not intellect.", context: "On psychology" },
  { text: "Diversification is protection against ignorance. It makes little sense if you know what you are doing.", context: "On concentration" },
  { text: "I will tell you how to become rich. Close the doors. Be fearful when others are greedy. Be greedy when others are fearful.", context: "On contrarian investing" },
  { text: "Someone's sitting in the shade today because someone planted a tree a long time ago.", context: "On compounding" },
  { text: "Only buy something that you'd be perfectly happy to hold if the market shut down for 10 years.", context: "On conviction" },
  { text: "Rule No.1: Never lose money. Rule No.2: Never forget rule No.1.", context: "On capital preservation" },
  { text: "The difference between successful people and really successful people is that really successful people say no to almost everything.", context: "On focus" },
  { text: "We simply attempt to be fearful when others are greedy and to be greedy only when others are fearful.", context: "On contrarian approach" },
  { text: "Wide diversification is only required when investors do not understand what they are doing.", context: "On knowledge" },
  { text: "The best investment you can make is in yourself.", context: "On self-improvement" },
  { text: "An investor should act as though he had a lifetime decision card with just 20 punches on it.", context: "On selectivity" },
  { text: "It takes 20 years to build a reputation and five minutes to ruin it.", context: "On integrity" },
  { text: "Look at market fluctuations as your friend rather than your enemy; profit from folly rather than participate in it.", context: "On volatility" },
];
