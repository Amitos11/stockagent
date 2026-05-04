// Curated list — biased toward strong fundamentals (growth + profitability + reasonable PE).
export const TICKERS = [
  // US Mega-cap Tech
  "NVDA", "AAPL", "MSFT", "GOOG", "META", "AMZN", "TSLA", "AVGO", "ORCL", "NFLX",
  // US Semis & Hardware
  "AMD", "MU", "QCOM", "SMCI", "AMAT", "LRCX", "MRVL", "ASML", "KLAC", "TSM", "ARM",
  // US Software / Cloud / Security
  "PLTR", "CRWD", "NET", "DDOG", "SNOW", "MDB", "ZS", "OKTA", "S", "ESTC",
  "PANW", "FTNT", "ADBE", "INTU", "NOW", "HUBS",
  // US High-Growth / Consumer Tech
  "SHOP", "MELI", "UBER", "ABNB", "APP", "AXON", "DUOL", "CELH", "TTD",
  // US Healthcare / Biotech
  "JNJ", "UNH", "MRK", "ABBV", "LLY", "ISRG", "REGN", "VRTX",
  // US Consumer / Retail
  "COST", "WMT", "HD", "LULU", "ULTA", "ELF", "CMG",
  // US Financials
  "JPM", "V", "MA", "HOOD", "SOFI", "COIN",
  // US Industrials / Defense
  "LMT", "RTX", "GE", "CAT",
  // Israeli on NASDAQ
  "CHKP", "NICE", "MNDY", "WIX", "MBLY", "GLBE", "ESLT",
  "CYBR", "NVMI",
  // TASE-only
  "ICL.TA", "AZRG.TA", "POLI.TA",
] as const;

export type Ticker = (typeof TICKERS)[number];
