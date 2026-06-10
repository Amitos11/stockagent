"use client";

import type { StockRow } from "@/lib/types";
import { TiltCard, CountUp } from "./primitives";

interface Props {
  rows: StockRow[];
  scanning: boolean;
  tilt?: boolean;
}

export function MetricCards({ rows, scanning, tilt }: Props) {
  const scanned = rows.length;
  const valuePlays = rows.filter((r) => r.isValuePlay).length;
  const avg = scanned ? rows.reduce((a, r) => a + (r.score ?? 0), 0) / scanned : 0;
  const green = rows.filter((r) => (r.dayChange ?? 0) > 0).length;

  const cards = [
    { label: "Scanned",     value: scanned,     dec: 0, color: "#818cf8", live: scanning },
    { label: "Value plays", value: valuePlays,  dec: 0, color: "#fbbf24" },
    { label: "Avg score",   value: avg,         dec: 1, color: "#22d3ee" },
    { label: "Trading up",  value: green,       dec: 0, color: "#34d399" },
  ] as const;

  return (
    <div className="metric-grid">
      {cards.map((c) => (
        <TiltCard key={c.label} className="metric-card depth-1" disabled={!tilt}>
          <span className="metric-label">
            {c.label}
            {"live" in c && c.live ? <span className="live-dot" aria-hidden="true" /> : null}
          </span>
          <span className="metric-value num" style={{ "--mc": c.color } as React.CSSProperties}>
            <CountUp value={c.value} decimals={c.dec} />
          </span>
          <span className="metric-glow" style={{ background: c.color }} aria-hidden="true" />
        </TiltCard>
      ))}
    </div>
  );
}
