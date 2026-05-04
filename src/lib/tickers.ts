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
