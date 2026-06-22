import type { StockRow, ScanWeights } from "./types";

// ── Raw pillar quality (0–1), independent of weight ─────────────────────────────

function normGrowth(row: StockRow): number {
  const epsNorm = row.earningsGrowth != null ? Math.max(0, Math.min(1, row.earningsGrowth / 0.5)) : null;
  const revNorm = row.revenueGrowth != null ? Math.max(0, Math.min(1, row.revenueGrowth / 0.3)) : null;
  const available = [epsNorm, revNorm].filter((x): x is number => x != null);
  if (!available.length) return 0;
  return available.reduce((a, b) => a + b, 0) / available.length;
}

function normProfitability(row: StockRow): number {
  const omNorm = row.operatingMargin != null ? Math.max(0, Math.min(1, row.operatingMargin / 0.25)) : null;
  const roeNorm = row.roe != null ? Math.max(0, Math.min(1, row.roe / 0.25)) : null;
  const available = [omNorm, roeNorm].filter((x): x is number => x != null);
  if (!available.length) return 0;
  return available.reduce((a, b) => a + b, 0) / available.length;
}

function normValuation(row: StockRow): number {
  const pe = row.peRatio;
  if (pe == null || pe <= 0) return 0;
  if (pe <= 10) return 1.0;
  if (pe <= 20) return 1.0 - (pe - 10) * 0.05;
  if (pe <= 40) return 0.5 - (pe - 20) * 0.0225;
  return Math.max(0, 0.05 - (pe - 40) * 0.001);
}

export function scoreGrowth(row: StockRow, weight: number): number {
  return normGrowth(row) * weight;
}
export function scoreProfitability(row: StockRow, weight: number): number {
  return normProfitability(row) * weight;
}
export function scoreValuation(row: StockRow, weight: number): number {
  return normValuation(row) * weight;
}

/**
 * Financial-health guard (0.70–1.0). High leverage and weak liquidity drag the
 * composite down so a cheap-looking, fast-growing but debt-laden company (e.g.
 * a post-acquisition rollup) can't top the rankings on growth alone. Missing
 * data → no penalty (we don't punish absent fundamentals).
 */
export function financialHealthFactor(row: StockRow): number {
  let f = 1;
  const de = row.debtToEquity; // stored as a percentage (150 = 150%)
  if (de != null) {
    if (de > 300)      f *= 0.80;
    else if (de > 200) f *= 0.88;
    else if (de > 120) f *= 0.94;
  }
  const cr = row.currentRatio;
  if (cr != null) {
    if (cr < 0.5)    f *= 0.90;
    else if (cr < 1) f *= 0.96;
  }
  return f;
}

/**
 * Recompute the weighted composite score (0–100 when weights sum to 100)
 * from the raw pillar quality already stored on the row. Used for instant
 * client-side re-ranking when the user changes weights after a scan.
 */
export function computeWeightedScore(row: StockRow, weights: ScanWeights): number {
  const qg = row.qualityGrowth ?? 0;
  const qp = row.qualityProfitability ?? 0;
  const qv = row.qualityValuation ?? 0;
  const base = (qg * weights.growth + qp * weights.profitability + qv * weights.valuation) / 100;
  return base * (row.healthFactor ?? financialHealthFactor(row));
}

/** Enough data to score meaningfully */
export function hasMinData(row: StockRow): boolean {
  if (row.error) return false;
  if (row.price == null || row.price <= 0) return false;
  const hasValuation     = row.peRatio != null && row.peRatio > 0;
  const hasGrowth        = row.earningsGrowth != null || row.revenueGrowth != null;
  const hasProfitability = row.operatingMargin != null || row.roe != null;
  // For FMP (PE only) accept PE alone; for yfinance accept any financial metric
  return hasValuation || hasGrowth || hasProfitability;
}

export function applyScores(row: StockRow, weights: ScanWeights): StockRow {
  const qg = normGrowth(row) * 100;
  const qp = normProfitability(row) * 100;
  const qv = normValuation(row) * 100;
  const sg = (qg * weights.growth) / 100;
  const sp = (qp * weights.profitability) / 100;
  const sv = (qv * weights.valuation) / 100;
  const hf = financialHealthFactor(row);
  return {
    ...row,
    qualityGrowth: qg,
    qualityProfitability: qp,
    qualityValuation: qv,
    scoreGrowth: sg,
    scoreProfitability: sp,
    scoreValuation: sv,
    healthFactor: hf,
    score: (sg + sp + sv) * hf,
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
