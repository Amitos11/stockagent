export function fmtPrice(price?: number, symbol = "", currency = ""): string {
  if (price == null) return "N/A";
  const sym = currency || (symbol.includes(".TA") ? "₪" : "$");
  return `${sym}${price.toFixed(2)}`;
}

export function fmtPct(val?: number | null): string {
  if (val == null) return "—";
  const sign = val >= 0 ? "+" : "";
  return `${sign}${(val * 100).toFixed(1)}%`;
}

export function fmtNum(val?: number | null, decimals = 0): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

export function fmtBigMoney(value?: number | null, currency = "USD"): string {
  if (value == null) return "N/A";
  const sym = ["ILS", "ILA"].includes(currency) ? "₪" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}${sym}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${sym}${abs.toLocaleString()}`;
}

export function fmt_mc(mc: number, symbol: string): string {
  const sym = symbol.includes(".TA") ? "₪" : "$";
  if (mc >= 1e12) return `${sym}${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9)  return `${sym}${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6)  return `${sym}${(mc / 1e6).toFixed(1)}M`;
  return `${sym}${mc.toFixed(0)}`;
}

export function fmtMarketCap(mc?: number | null, symbol = ""): string {
  if (!mc) return "—";
  const sym = symbol.includes(".TA") ? "₪" : "$";
  if (mc >= 1e12) return `${sym}${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `${sym}${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `${sym}${(mc / 1e6).toFixed(1)}M`;
  return `${sym}${mc}`;
}

export function fmtDayChange(val?: number | null): string {
  if (val == null) return "—";
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

const REC_MAP: Record<string, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  underperform: "Underperform",
  sell: "Sell",
  strong_sell: "Strong Sell",
};

export function fmtRecommendation(key?: string): string {
  if (!key) return "—";
  return REC_MAP[key.toLowerCase()] ?? key;
}
