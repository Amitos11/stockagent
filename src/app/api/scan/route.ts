import { NextRequest, NextResponse } from "next/server";
import { ALL_TICKERS } from "@/lib/tickers";
import { fetchBatch, fetchFullEnrich } from "@/lib/fetcher";
import { hasMinData, applyScores, generateInsight, isValuePlay } from "@/lib/scoring";
import type { ScanWeights, StockRow } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const weights: ScanWeights = {
    growth:        body.growth        ?? 33,
    profitability: body.profitability ?? 33,
    valuation:     body.valuation     ?? 34,
  };

  // Fetch all tickers in batches of 10 via Python (yfinance handles its own pacing)
  const BATCH_SIZE = 10;
  const allRows: StockRow[] = [];

  for (let i = 0; i < ALL_TICKERS.length; i += BATCH_SIZE) {
    const batch = Array.from(ALL_TICKERS.slice(i, i + BATCH_SIZE));
    const results = await fetchBatch(batch);
    allRows.push(...results);
  }

  // Score rows that have enough data
  const scored: StockRow[] = allRows.map((r) => {
    if (!hasMinData(r)) return r;
    const s = applyScores(r, weights);
    return { ...s, insight: generateInsight(s), isValuePlay: isValuePlay(s) };
  });

  // Sort valid rows by score desc and assign ranks
  const valid = scored
    .filter(hasMinData)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const top10 = valid.slice(0, 10);

  // Enrich Top 10 in parallel (news + management + quarterly + forward + earnings)
  await Promise.all(
    top10.map(async (row) => {
      const enriched = await fetchFullEnrich(row.symbol);
      row.news         = enriched.news;
      row.management   = enriched.management;
      row.quarterly    = enriched.quarterly;
      row.forecasts    = enriched.forecasts;
      row.lastEarnings = enriched.lastEarnings;
    })
  );

  // Full list: ranked valid + unscored at end
  const failed = scored.filter((r) => !hasMinData(r));

  return NextResponse.json({
    allRows:   [...valid, ...failed],
    valid,
    top10,
    scannedAt: new Date().toISOString(),
    weights,
  });
}
