// ~70 reliable tickers — high yfinance data availability, quality fundamentals.
export const TICKERS = [
  // US Mega-cap Tech
  "NVDA", "AAPL", "MSFT", "GOOG", "META", "AMZN", "TSLA", "AVGO", "ORCL", "NFLX",
  // US Semis
  "AMD", "MU", "QCOM", "AMAT", "LRCX", "ASML", "KLAC", "TSM", "ARM",
  // US Software / Cloud / Security
  "PLTR", "CRWD", "NET", "DDOG", "ZS", "PANW", "FTNT", "ADBE", "INTU", "NOW",
  // US High-Growth
  "SHOP", "MELI", "UBER", "APP", "AXON", "DUOL", "TTD",
  // US Healthcare / Biotech
  "UNH", "LLY", "ABBV", "ISRG", "REGN", "VRTX",
  // US Consumer / Retail
  "COST", "WMT", "HD", "CMG",
  // US Financials
  "JPM", "V", "MA", "COIN",
  // US Industrials / Defense
  "LMT", "RTX", "CAT",
  // Israeli on NASDAQ
  "CHKP", "NICE", "MNDY", "WIX", "GLBE", "CYBR",
] as const;

export type Ticker = (typeof TICKERS)[number];

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
  // Software / Cloud / Security
  PLTR: "Software", CRWD: "Software", NET: "Software", DDOG: "Software",
  ZS: "Software", PANW: "Software", FTNT: "Software", ADBE: "Software",
  INTU: "Software", NOW: "Software",
  // High-Growth
  SHOP: "Software", MELI: "Consumer", UBER: "Consumer", APP: "Software",
  AXON: "Industrial", DUOL: "Software", TTD: "Software",
  // Healthcare
  UNH: "Healthcare", LLY: "Healthcare", ABBV: "Healthcare",
  ISRG: "Healthcare", REGN: "Healthcare", VRTX: "Healthcare",
  // Consumer
  COST: "Consumer", WMT: "Consumer", HD: "Consumer", CMG: "Consumer",
  // Finance
  JPM: "Finance", V: "Finance", MA: "Finance", COIN: "Finance",
  // Industrial / Defense
  LMT: "Industrial", RTX: "Industrial", CAT: "Industrial",
  // Israeli NASDAQ
  CHKP: "Israel", NICE: "Israel", MNDY: "Israel",
  WIX: "Israel", GLBE: "Israel", CYBR: "Israel",
  // TASE
  "POLI.TA": "TASE", "LUMI.TA": "TASE", "DSCT.TA": "TASE",
  "MZTF.TA": "TASE", "FIBI.TA": "TASE", "ICL.TA": "TASE", "AZRG.TA": "TASE",
};

export function getSector(symbol: string): SectorKey {
  return SECTOR_MAP[symbol] ?? (symbol.endsWith(".TA") ? "TASE" : "Tech");
}

export const SECTOR_ORDER: SectorKey[] = [
  "Tech", "Semis", "Software", "Healthcare",
  "Consumer", "Finance", "Energy", "Industrial",
  "Israel", "TASE",
];
