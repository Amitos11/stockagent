// Curated list — biased toward strong fundamentals (growth + profitability + reasonable PE).
// Chronic underperformers on the scoring model (INTC, BA, TEVA, BAC, GS, XOM, CVX, NKE,
// most TASE-only banks, micro-cap Israelis with thin yfinance data) were removed.
export const TICKERS = [
  // US Mega-cap Tech
  "NVDA", "AAPL", "MSFT", "GOOG", "META", "AMZN", "TSLA", "AVGO", "ORCL", "NFLX",
  // US Semis & Hardware
  "AMD", "MU", "QCOM", "SMCI", "AMAT", "LRCX", "MRVL", "ASML", "KLAC",
  // US Software / Cloud / Security
  "PLTR", "CRWD", "NET", "DDOG", "SNOW", "MDB", "ZS", "OKTA", "S", "ESTC",
  "PANW", "FTNT",
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
  // TASE-only (kept: industrials with usable yfinance data)
  "ICL.TA", "AZRG.TA", "POLI.TA",
] as const;

export type Ticker = (typeof TICKERS)[number];
