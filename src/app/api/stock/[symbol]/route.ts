import { NextRequest, NextResponse } from "next/server";
import { fetchStock, fetchFullEnrich } from "@/lib/fetcher";
import { applyScores, generateInsight, isValuePlay } from "@/lib/scoring";
import { getStock, putStock } from "@/lib/stockCache";
import { getFinnhubQuote, getFinnhubProfile } from "@/lib/finnhub";
import type { ScanWeights, StockRow } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const url = new URL(req.url);
  const weights: ScanWeights = {
    growth: Number(url.searchParams.get("growth") ?? 33),
    profitability: Number(url.searchParams.get("profitability") ?? 33),
    valuation: Number(url.searchParams.get("valuation") ?? 34),
  };

  const sym = symbol.toUpperCase();

  // Cache hit — return immediately without hitting Yahoo Finance
  const cached = getStock(sym);
  if (cached) return NextResponse.json(cached);

  // Cache miss — fetch from Yahoo (2 Python calls)
  const [row, enrich] = await Promise.all([
    fetchStock(sym),
    fetchFullEnrich(sym),
  ]);

  // Fallback: if yfinance rate-limited, try Finnhub for basic price data
  if (row.error && (row.error.includes("Rate") || row.error.includes("429") || row.error.includes("Too Many"))) {
    const [quote, profile] = await Promise.all([getFinnhubQuote(sym), getFinnhubProfile(sym)]);
    if (quote && quote.c > 0) {
      const fallback: StockRow = {
        symbol: sym,
        name: profile?.name ?? sym,
        price: quote.c,
        currency: profile?.currency ?? "USD",
        sector: profile?.finnhubIndustry ?? "",
        marketCap: (profile?.marketCapitalization ?? 0) * 1_000_000,
        marketCapDisplay: profile?.marketCapitalization
          ? `$${(profile.marketCapitalization / 1000).toFixed(1)}B` : "",
        dayChange: quote.dp,
        fiftyTwoWeekHigh: quote.h,
        fiftyTwoWeekLow: quote.l,
      };
      return NextResponse.json(fallback);
    }
    return NextResponse.json(row);
  }

  if (row.error) return NextResponse.json(row);

  let scored = applyScores(row, weights);
  scored.insight = generateInsight(scored);
  scored.isValuePlay = isValuePlay(scored);
  scored.news = enrich.news;
  scored.management = enrich.management;
  scored.quarterly = enrich.quarterly;
  scored.forecasts = enrich.forecasts;
  scored.lastEarnings = enrich.lastEarnings;

  putStock(scored); // save for next time
  return NextResponse.json(scored);
}
