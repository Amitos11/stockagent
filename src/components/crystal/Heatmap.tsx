"use client";

import type { StockRow } from "@/lib/types";

function fmtPct(v?: number | null) {
  if (v == null) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
}

interface Props {
  rows: StockRow[];
  onSelect: (r: StockRow) => void;
}

export function Heatmap({ rows, onSelect }: Props) {
  return (
    <div className="glass depth-2 heatmap">
      {rows.map((r) => {
        const dc = r.dayChange ?? 0;
        const up = dc >= 0;
        const mag = Math.min(1, Math.abs(dc) / 2.5);
        const base = up ? "16,185,129" : "248,113,113";
        return (
          <button
            key={r.symbol}
            className="heat-tile"
            onClick={() => onSelect(r)}
            style={{
              background: `linear-gradient(160deg, rgba(${base},${0.10 + mag * 0.30}), rgba(${base},${0.04 + mag * 0.16}))`,
              boxShadow: `inset 0 0 0 1px rgba(${base},${0.18 + mag * 0.3})`,
            }}
          >
            <span className="heat-sym num">{r.symbol}</span>
            <span className={`heat-chg num ${up ? "pos" : "neg"}`}>{fmtPct(r.dayChange)}</span>
            <span className="heat-score num">{Math.round(r.score ?? 0)}</span>
          </button>
        );
      })}
    </div>
  );
}
