/**
 * Finnhub API client
 * Used for: news, real-time quote fallback, analyst recommendations
 */

const BASE = "https://finnhub.io/api/v1";
const KEY  = process.env.FINNHUB_API_KEY ?? "";

async function fhGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!KEY) return null;
  try {
    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("token", KEY);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), {
      next: { revalidate: 300 }, // 5-min Next.js cache
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ── News ──────────────────────────────────────────────────────────────────────

export interface FinnhubNewsItem {
  headline: string;
  url: string;
  source: string;
  datetime: number; // unix timestamp
  summary: string;
}

export async function getFinnhubNews(symbol: string, days = 7): Promise<FinnhubNewsItem[]> {
  const to   = new Date();
  const from = new Date(Date.now() - days * 86400_000);
  const fmt  = (d: Date) => d.toISOString().slice(0, 10);

  const data = await fhGet<FinnhubNewsItem[]>("/company-news", {
    symbol,
    from: fmt(from),
    to:   fmt(to),
  });
  return data ?? [];
}

// ── Quote (fallback when yfinance fails) ──────────────────────────────────────

export interface FinnhubQuote {
  c:  number; // current price
  d:  number; // change
  dp: number; // change percent
  h:  number; // high
  l:  number; // low
  o:  number; // open
  pc: number; // previous close
}

export async function getFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
  return fhGet<FinnhubQuote>("/quote", { symbol });
}

// ── Company profile ───────────────────────────────────────────────────────────

export interface FinnhubProfile {
  name:          string;
  ticker:        string;
  exchange:      string;
  finnhubIndustry: string;
  marketCapitalization: number; // in millions
  logo:          string;
  weburl:        string;
  currency:      string;
}

export async function getFinnhubProfile(symbol: string): Promise<FinnhubProfile | null> {
  return fhGet<FinnhubProfile>("/stock/profile2", { symbol });
}

// ── Analyst recommendations ───────────────────────────────────────────────────

export interface FinnhubRec {
  period:     string; // "2024-01-01"
  strongBuy:  number;
  buy:        number;
  hold:       number;
  sell:       number;
  strongSell: number;
}

export async function getFinnhubRecs(symbol: string): Promise<FinnhubRec | null> {
  const data = await fhGet<FinnhubRec[]>("/stock/recommendation", { symbol });
  return data?.[0] ?? null; // most recent
}
