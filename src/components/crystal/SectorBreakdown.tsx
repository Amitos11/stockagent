"use client";

import { useState, useMemo } from "react";
import type { StockRow } from "@/lib/types";
import { SECTOR_COLORS } from "@/lib/signals";
import { fmtPrice } from "@/lib/formatters";
import { SectorChip, ScorePill, DayChange } from "./primitives";

function fmtPriceLocal(v?: number | null, symbol = "") {
  if (v == null) return "—";
  const sym = symbol.includes(".TA") ? "₪" : "$";
  return sym + (v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(2));
}

interface Props {
  rows: StockRow[];
  onSelect: (r: StockRow) => void;
}

export function SectorBreakdown({ rows, onSelect }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const m = new Map<string, { sector: string; count: number; sum: number; stocks: StockRow[] }>();
    rows.forEach((r) => {
      const s = r.sector ?? "Other";
      if (!m.has(s)) m.set(s, { sector: s, count: 0, sum: 0, stocks: [] });
      const g = m.get(s)!;
      g.count++;
      g.sum += r.score ?? 0;
      g.stocks.push(r);
    });
    return [...m.values()]
      .map((g) => ({ ...g, avg: g.sum / g.count }))
      .sort((a, b) => b.avg - a.avg);
  }, [rows]);

  const max = Math.max(...groups.map((g) => g.count), 1);

  return (
    <div className="glass depth-2 sector-panel">
      {groups.map((g) => {
        const c = SECTOR_COLORS[g.sector] ?? "#94a3b8";
        const isOpen = open === g.sector;
        return (
          <div key={g.sector} className={`sector-block${isOpen ? " open" : ""}`}>
            <button
              className="sector-row"
              onClick={() => setOpen(isOpen ? null : g.sector)}
              aria-expanded={isOpen}
            >
              <span className="sector-chevron" aria-hidden="true">▶</span>
              <span className="sector-row-name"><SectorChip sector={g.sector} /></span>
              <span className="sector-track">
                <span
                  className="sector-fill"
                  style={{
                    width: (g.count / max) * 100 + "%",
                    background: `linear-gradient(90deg, ${c}33, ${c}cc)`,
                    boxShadow: `0 0 12px ${c}44`,
                  }}
                />
              </span>
              <span className="sector-stats num">
                <b>{g.count}</b> stocks · avg <b style={{ color: c }}>{g.avg.toFixed(0)}</b>
              </span>
            </button>
            {isOpen && (
              <div className="sector-stocks">
                {g.stocks.map((r, i) => (
                  <button key={r.symbol} className="sector-stock-row" onClick={() => onSelect(r)}>
                    <span className="sector-stock-rank num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="sector-stock-id">
                      <span className="sym num">{r.symbol}</span>
                      <span className="sector-stock-name">{r.name}</span>
                    </span>
                    <ScorePill score={r.score ?? 0} />
                    <span className="sector-stock-price num">{fmtPriceLocal(r.price, r.symbol)}</span>
                    <DayChange value={r.dayChange} />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
