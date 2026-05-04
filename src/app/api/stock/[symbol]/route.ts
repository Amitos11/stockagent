import { NextRequest, NextResponse } from "next/server";
import { fetchStock, fetchFullEnrich } from "@/lib/fetcher";
import { applyScores, generateInsight, isValuePlay } from "@/lib/scoring";
import type { ScanWeights } from "@/lib/types";

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

  // 2 Python calls instead of 6 — reduces Yahoo rate-limit risk
  const [row, enrich] = await Promise.all([
    fetchStock(sym),
    fetchFullEnrich(sym),
  ]);

  if (row.error) return NextResponse.json(row);

  let scored = applyScores(row, weights);
  scored.insight = generateInsight(scored);
  scored.isValuePlay = isValuePlay(scored);
  scored.news = enrich.news;
  scored.management = enrich.management;
  scored.quarterly = enrich.quarterly;
  scored.forecasts = enrich.forecasts;
  scored.lastEarnings = enrich.lastEarnings;

  return NextResponse.json(scored);
}
