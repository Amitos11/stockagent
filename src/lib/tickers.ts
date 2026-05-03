export const TICKERS = [
  // US Mega-cap Tech
  "NVDA", "AAPL", "MSFT", "GOOG", "META", "AMZN", "TSLA", "AVGO", "ORCL", "NFLX",
  // US Semis & Hardware
  "AMD", "MU", "QCOM", "INTC", "SMCI", "AMAT", "LRCX", "MRVL", "ASML", "KLAC",
  // US Software / Cloud
  "PLTR", "CRWD", "NET", "DDOG", "SNOW", "MDB", "ZS", "OKTA", "S", "ESTC",
  "PANW", "FTNT",
  // US Healthcare / Biotech
  "JNJ", "UNH", "MRK", "ABBV", "LLY", "ISRG", "REGN", "VRTX",
  // US Consumer / Retail
  "COST", "WMT", "HD", "LULU", "ULTA", "ELF", "CMG", "NKE",
  // US Financials
  "JPM", "V", "MA", "BAC", "GS", "HOOD", "SOFI", "COIN",
  // US Industrials / Energy
  "LMT", "RTX", "GE", "CAT", "XOM", "CVX", "BA",
  // Israeli on NASDAQ
  "TEVA", "CHKP", "NICE", "MNDY", "WIX", "MBLY", "GLBE", "ESLT",
  "CYBR", "INMD", "NVMI", "AUDC", "GILT",
  // TASE-only
  "POLI.TA", "LUMI.TA", "DSCT.TA", "MZTF.TA", "FIBI.TA", "ICL.TA", "AZRG.TA",
] as const;

export type Ticker = (typeof TICKERS)[number];
