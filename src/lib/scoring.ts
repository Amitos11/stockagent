import type { StockRow, ScanWeights } from "./types";

export function scoreGrowth(row: StockRow, weight: number): number {
  const epsNorm = row.earningsGrowth != null ? Math.max(0, Math.min(1, row.earningsGrowth / 0.5)) : null;
  const revNorm = row.revenueGrowth != null ? Math.max(0, Math.min(1, row.revenueGrowth / 0.3)) : null;
  const available = [epsNorm, revNorm].filter((x): x is number => x != null);
  if (!available.length) return 0;
  return (available.reduce((a, b) => a + b, 0) / available.length) * weight;
}

export function scoreProfitability(row: StockRow, weight: number): number {
  const omNorm = row.operatingMargin != null ? Math.max(0, Math.min(1, row.operatingMargin / 0.25)) : null;
  const roeNorm = row.roe != null ? Math.max(0, Math.min(1, row.roe / 0.25)) : null;
  const available = [omNorm, roeNorm].filter((x): x is number => x != null);
  if (!available.length) return 0;
  return (available.reduce((a, b) => a + b, 0) / available.length) * weight;
}

export function scoreValuation(row: StockRow, weight: number): number {
  const pe = row.peRatio;
  if (pe == null || pe <= 0) return 0;
  let norm: number;
  if (pe <= 10) norm = 1.0;
  else if (pe <= 20) norm = 1.0 - (pe - 10) * 0.05;
  else if (pe <= 40) norm = 0.5 - (pe - 20) * 0.0225;
  else norm = Math.max(0, 0.05 - (pe - 40) * 0.001);
  return norm * weight;
}

/** Enough data to score (needs at least price + one growth metric or PE) */
export function hasMinData(row: StockRow): boolean {
  if (row.error) return false;
  if (row.price == null) return false;
  // Need at least PE or some growth metric to produce a meaningful score
  const hasValuation = row.peRatio != null && row.peRatio > 0;
  const hasGrowth = row.earningsGrowth != null || row.revenueGrowth != null;
  const hasProfitability = row.operatingMargin != null || row.roe != null;
  return hasValuation || hasGrowth || hasProfitability;
}

export function applyScores(row: StockRow, weights: ScanWeights): StockRow {
  const sg = scoreGrowth(row, weights.growth);
  const sp = scoreProfitability(row, weights.profitability);
  const sv = scoreValuation(row, weights.valuation);
  return {
    ...row,
    scoreGrowth: sg,
    scoreProfitability: sp,
    scoreValuation: sv,
    score: sg + sp + sv,
  };
}

export function generateInsight(row: StockRow): string {
  const parts: string[] = [];
  const { earningsGrowth: eps, revenueGrowth: rev, operatingMargin: om, peRatio: pe, debtToEquity: de } = row;

  if (eps != null && eps > 0.5) parts.push(`Earnings +${(eps * 100).toFixed(0)}% YoY`);
  else if (eps != null && eps > 0.2) parts.push(`Stable earnings (${(eps * 100).toFixed(0)}%)`);

  if (rev != null && rev > 0.3) parts.push(`Revenue +${(rev * 100).toFixed(0)}% YoY`);
  else if (rev != null && rev > 0.15) parts.push(`Growing revenue (${(rev * 100).toFixed(0)}%)`);

  if (om != null && om > 0.3) parts.push(`High margin (${(om * 100).toFixed(0)}%) — pricing power`);
  else if (om != null && om > 0.2) parts.push(`Solid profitability (${(om * 100).toFixed(0)}%)`);

  if (pe != null && pe > 0 && pe < 12) parts.push(`Low P/E (${pe.toFixed(1)}) — modest valuation`);
  else if (pe != null && pe > 0 && pe < 20) parts.push(`Fair P/E (${pe.toFixed(1)})`);

  if (de != null && de < 50) parts.push("Clean balance sheet");

  return parts.slice(0, 3).join(" • ") || "Balanced profile";
}

/** Value Investing: P/E < 20 AND Debt/Equity < 50 (yfinance stores D/E as %) */
export function isValuePlay(row: StockRow): boolean {
  const pe = row.peRatio;
  const de = row.debtToEquity;
  return pe != null && pe > 0 && pe < 20 && de != null && de < 50;
}
