import type { StockRow } from "./types";

// Keys match the SectorKey values produced by getSector() in tickers.ts.
export const SECTOR_COLORS: Record<string, string> = {
  Tech: "#6366f1",
  Semis: "#8b5cf6",
  Software: "#22d3ee",
  Healthcare: "#10b981",
  Consumer: "#f59e0b",
  Finance: "#3b82f6",
  Energy: "#f97316",
  Industrial: "#94a3b8",
  Israel: "#60a5fa",
  TASE: "#34d399",
};

export function scoreColor(score: number): string {
  if (score >= 70) return "var(--emerald)";
  if (score >= 45) return "var(--amber)";
  return "var(--red)";
}

export function buildSectorPEMap(rows: StockRow[]): Record<string, number> {
  const buckets: Record<string, number[]> = {};
  for (const r of rows) {
    if (r.sector && r.peRatio != null && r.peRatio > 0) {
      (buckets[r.sector] ??= []).push(r.peRatio);
    }
  }
  const out: Record<string, number> = {};
  for (const [sector, vals] of Object.entries(buckets)) {
    out[sector] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return out;
}

export interface RiskFlag {
  label: string;
  detail: string;
  sev: 1 | 2;
}

// StockRow stores fractions (0.86 = 86%). Prototype used percentages.
export function riskFlags(s: StockRow, sectorPEMap: Record<string, number>): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const secPE = sectorPEMap[s.sector ?? ""] ?? 20;
  const pe = s.peRatio;

  if (pe != null && pe > 0 && pe > secPE * 1.6) {
    flags.push({
      label: "Valuation stretched",
      sev: pe > secPE * 2.4 ? 2 : 1,
      detail: `P/E ${pe.toFixed(1)}× vs. ${s.sector ?? "sector"} avg ${secPE.toFixed(0)}×`,
    });
  }

  const rev = s.revenueGrowth;
  const eps = s.earningsGrowth;
  if ((rev != null && rev < 0) || (eps != null && eps < 0)) {
    flags.push({
      label: "Growth contraction",
      sev: (rev != null && rev < -0.05) || (eps != null && eps < -0.15) ? 2 : 1,
      detail: `Revenue ${rev != null ? (rev * 100).toFixed(1) : "—"}% · EPS ${eps != null ? (eps * 100).toFixed(1) : "—"}%`,
    });
  }

  const om = s.operatingMargin;
  if (om != null && om < 0.05) {
    flags.push({
      label: "Margin pressure",
      sev: om < 0 ? 2 : 1,
      detail: `Operating margin ${(om * 100).toFixed(1)}%`,
    });
  }

  const de = s.debtToEquity;
  if (de != null && de > 120) {
    flags.push({
      label: "Elevated leverage",
      sev: de > 220 ? 2 : 1,
      detail: `Debt/Equity ${de.toFixed(0)}%`,
    });
  }

  const low = s.fiftyTwoWeekLow;
  const price = s.price;
  if (low != null && price != null && price < low * 1.08) {
    flags.push({
      label: "Near 52-week low",
      sev: 1,
      detail: `${price.toFixed(2)} vs. low ${low.toFixed(2)}`,
    });
  }

  return flags;
}

export interface ReadSynthesis {
  head: string;
  tone: "good" | "mixed" | "bad";
  body: string;
}

export function readSynthesis(s: StockRow, flags: RiskFlag[]): ReadSynthesis {
  const score = s.score ?? 0;
  const severeCount = flags.filter((f) => f.sev === 2).length;
  const totalFlags = flags.length;

  let tone: "good" | "mixed" | "bad";
  if (score >= 65 && severeCount === 0) tone = "good";
  else if (score >= 40 && severeCount <= 1) tone = "mixed";
  else tone = "bad";

  const head =
    tone === "good"
      ? "Strong composite — quality across pillars"
      : tone === "mixed"
      ? "Uneven profile — monitor flagged risks"
      : "Weak composite — multiple risk signals";

  const rev = s.revenueGrowth;
  const om = s.operatingMargin;
  const pe = s.peRatio;

  const revStr =
    rev != null
      ? rev > 0.15
        ? `revenue compounding at ${(rev * 100).toFixed(1)}% keeps the growth pillar strong`
        : rev > 0
        ? `revenue growth of ${(rev * 100).toFixed(1)}% is steady rather than spectacular`
        : `contracting revenue (${(rev * 100).toFixed(1)}%) weighs on the growth pillar`
      : "revenue data unavailable";

  const omStr =
    om != null
      ? om > 0.3
        ? `operating margins of ${(om * 100).toFixed(1)}% sit in the top tier`
        : om > 0.12
        ? `margins of ${(om * 100).toFixed(1)}% are healthy for the ${(s.sector ?? "").toLowerCase()} group`
        : `thin margins (${(om * 100).toFixed(1)}%) cap the profitability score`
      : "margin data unavailable";

  const peStr =
    pe == null || pe <= 0
      ? "trailing earnings are negative"
      : pe < 20
      ? `a ${pe.toFixed(1)}× P/E is Buffett-grade value`
      : pe > 40
      ? `a ${pe.toFixed(1)}× multiple prices in years of execution`
      : `the ${pe.toFixed(1)}× P/E is mid-range against peers`;

  const body = `${revStr}; ${omStr}; ${peStr}.${totalFlags > 0 ? ` Watch: ${flags.map((f) => f.label.toLowerCase()).join(", ")}.` : ""}`;

  return { head, tone, body };
}

export function aiInsightTemplate(s: StockRow): string {
  const name = s.name ?? s.symbol;
  const rev = s.revenueGrowth;
  const om = s.operatingMargin;
  const pe = s.peRatio;
  const de = s.debtToEquity;

  const revPart =
    rev != null
      ? rev > 0.15
        ? `revenue compounding at ${(rev * 100).toFixed(1)}% keeps the growth pillar strong`
        : rev > 0
        ? `revenue growth of ${(rev * 100).toFixed(1)}% is steady rather than spectacular`
        : `contracting revenue (${(rev * 100).toFixed(1)}%) weighs on the growth pillar`
      : "revenue data is limited";

  const omPart =
    om != null
      ? om > 0.3
        ? `operating margins of ${(om * 100).toFixed(1)}% sit in the top tier of the scan`
        : om > 0.12
        ? `margins of ${(om * 100).toFixed(1)}% are healthy for the ${(s.sector ?? "").toLowerCase()} group`
        : `thin margins (${(om * 100).toFixed(1)}%) cap the profitability score`
      : "margin data is limited";

  const pePart =
    pe == null || pe <= 0
      ? `negative trailing earnings leave the valuation pillar resting on the ${s.forwardPE?.toFixed(1) ?? "N/A"}× forward multiple`
      : pe < 20
      ? `a ${pe.toFixed(1)}× P/E clears the value filter, supporting the valuation pillar`
      : pe > 40
      ? `a ${pe.toFixed(1)}× multiple prices in years of execution`
      : `the ${pe.toFixed(1)}× multiple is mid-range against peers`;

  const deStr =
    de != null ? (de < 50 ? "a conservative balance sheet" : "elevated leverage worth monitoring") : "balance sheet data limited";

  return `${name}: ${revPart}; ${omPart}; and ${pePart}. Debt-to-equity of ${de?.toFixed(0) ?? "N/A"}% indicates ${deStr}. Next earnings ${s.nextEarnings ?? "TBD"}.`;
}

export interface HealthTier {
  level: "good" | "watch" | "risk" | "unknown";
  label: string;
  color: string;
  detail: string;
}

// Visual financial-health rating from leverage + liquidity. Mirrors the
// scoring penalty (financialHealthFactor) so a high score with balance-sheet
// risk is always visible at a glance.
export function healthTier(s: StockRow): HealthTier {
  const de = s.debtToEquity;   // percent (150 = 150%)
  const cr = s.currentRatio;
  if (de == null && cr == null) {
    return { level: "unknown", label: "—", color: "#64748b", detail: "Balance-sheet data unavailable" };
  }
  let points = 0;
  if (de != null) { if (de > 300) points += 2; else if (de > 150) points += 1; }
  if (cr != null) { if (cr < 0.5) points += 2; else if (cr < 1) points += 1; }
  const bits: string[] = [];
  if (de != null) bits.push(`D/E ${de.toFixed(0)}%`);
  if (cr != null) bits.push(`current ratio ${cr.toFixed(2)}`);
  const detail = bits.join(" · ");
  if (points >= 3) return { level: "risk",  label: "High risk", color: "#f87171", detail };
  if (points >= 1) return { level: "watch", label: "Elevated",  color: "#fbbf24", detail };
  return { level: "good", label: "Healthy", color: "#34d399", detail };
}
