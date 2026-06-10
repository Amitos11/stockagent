import { NextRequest, NextResponse } from "next/server";
import { fetchStock, fetchFullEnrich } from "@/lib/fetcher";
import { applyScores, generateInsight, isValuePlay } from "@/lib/scoring";
import { getStock, putStock } from "@/lib/stockCache";
import type { ScanWeights, StockRow } from "@/lib/types";

// A row counts as "fully enriched" only when it actually carries detail data.
// An empty `quarterly: {}` is truthy but useless, and Yahoo intermittently
// returns empty enrich — so we must not treat that as complete (it would stick
// in cache and never re-fetch the beat/miss + analyst data).
function isEnriched(r: StockRow): boolean {
  return (
    r.lastEarnings?.beat !== undefined ||
    !!r.analyst?.recommendationKey ||
    r.quarterly?.qRevenue != null ||
    r.forecasts?.nextQEps != null
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const url = new URL(req.url);
  const weights: ScanWeights = {
    growth:        Number(url.searchParams.get("growth")        ?? 33),
    profitability: Number(url.searchParams.get("profitability") ?? 33),
    valuation:     Number(url.searchParams.get("valuation")     ?? 34),
  };

  const sym = symbol.toUpperCase();

  // Cache hit with real enriched detail — return immediately.
  const cached = getStock(sym);
  if (cached && isEnriched(cached)) return NextResponse.json(cached);

  // Cached scan row without detail (or a poisoned empty enrich) — enrich now.
  if (cached) {
    const enrich = await fetchFullEnrich(sym);
    const merged = {
      ...cached,
      news:         enrich.news,
      management:   enrich.management,
      quarterly:    enrich.quarterly,
      forecasts:    enrich.forecasts,
      lastEarnings: enrich.lastEarnings,
      // Real analyst targets/recommendation override the scan's 52w fallback.
      analyst:      enrich.analyst,
      ...(enrich.analyst?.targetMean != null ? {
        targetMeanPrice:    enrich.analyst.targetMean,
        targetHighPrice:    enrich.analyst.targetHigh ?? cached.targetHighPrice,
        targetLowPrice:     enrich.analyst.targetLow ?? cached.targetLowPrice,
        numAnalysts:        enrich.analyst.numAnalysts ?? cached.numAnalysts,
        recommendationKey:  enrich.analyst.recommendationKey || cached.recommendationKey,
        recommendationMean: enrich.analyst.recommendationMean ?? cached.recommendationMean,
      } : {}),
    };
    // Only cache if the enrich actually produced detail — never poison the cache
    // with an empty result that would block future re-fetches.
    if (isEnriched(merged)) putStock(merged);
    return NextResponse.json(merged);
  }

  // Cache miss — fetch from yfinance (2 Python calls)
  const [row, enrich] = await Promise.all([
    fetchStock(sym),
    fetchFullEnrich(sym),
  ]);

  if (row.error) return NextResponse.json(row);

  let scored = applyScores(row, weights);
  scored.insight      = generateInsight(scored);
  scored.isValuePlay  = isValuePlay(scored);
  scored.news         = enrich.news;
  scored.management   = enrich.management;
  scored.quarterly    = enrich.quarterly;
  scored.forecasts    = enrich.forecasts;
  scored.lastEarnings = enrich.lastEarnings;
  scored.analyst      = enrich.analyst;
  if (enrich.analyst?.targetMean != null) {
    scored.targetMeanPrice    = enrich.analyst.targetMean;
    scored.targetHighPrice    = enrich.analyst.targetHigh ?? scored.targetHighPrice;
    scored.targetLowPrice     = enrich.analyst.targetLow ?? scored.targetLowPrice;
    scored.numAnalysts        = enrich.analyst.numAnalysts ?? scored.numAnalysts;
    scored.recommendationKey  = enrich.analyst.recommendationKey || scored.recommendationKey;
    scored.recommendationMean = enrich.analyst.recommendationMean ?? scored.recommendationMean;
  }

  // Cache only when enrichment succeeded, so a flaky empty result is retried
  // on the next open instead of sticking for the full TTL.
  if (isEnriched(scored)) putStock(scored);
  return NextResponse.json(scored);
}
