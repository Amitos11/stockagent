import { NextRequest, NextResponse } from "next/server";
import { fetchStock, fetchNews, fetchManagement, fetchQuarterly, fetchForwardEstimates, fetchEarningsHistory } from "@/lib/fetcher";
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
  let row = await fetchStock(sym);
  if (row.error) return NextResponse.json(row);

  row = applyScores(row, weights);
  row.insight = generateInsight(row);
  row.isValuePlay = isValuePlay(row);

  const [news, management, quarterly, forecasts, lastEarnings] = await Promise.all([
    fetchNews(sym),
    fetchManagement(sym),
    fetchQuarterly(sym),
    fetchForwardEstimates(sym),
    fetchEarningsHistory(sym),
  ]);

  row.news = news;
  row.management = management;
  row.quarterly = quarterly;
  row.forecasts = forecasts;
  row.lastEarnings = lastEarnings;

  return NextResponse.json(row);
}
