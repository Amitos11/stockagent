"use client";

import type { StockRow, EarningsHistory } from "@/lib/types";
import { fmtPrice, fmtPct } from "@/lib/formatters";
import { WatchStar, SectorChip, ScorePill, ScoreBar, DayChange, TrendArrow, RiskBadge, HealthDot } from "./primitives";

/** Beat / missed last quarter's EPS estimate. undefined = not loaded yet. */
function EarningsMark({ e }: { e?: EarningsHistory }) {
  if (!e || e.beat === undefined) return <span className="earn-mark num dim">·</span>;
  const beat = e.beat;
  const surp = e.surprisePct != null ? `${e.surprisePct >= 0 ? "+" : ""}${(e.surprisePct * 100).toFixed(1)}%` : "";
  return (
    <span
      className={`earn-mark ${beat ? "beat" : "miss"}`}
      title={`${beat ? "Beat" : "Missed"} EPS estimate${surp ? ` · surprise ${surp}` : ""}${
        e.epsActual != null && e.epsEstimate != null ? ` (act ${e.epsActual} vs est ${e.epsEstimate})` : ""
      }`}
    >
      {beat ? "▲ Beat" : "▼ Miss"}
    </span>
  );
}

function fmtPE(v?: number | null) { return v && v > 0 ? v.toFixed(1) : "—"; }
function fmtCap(mc?: number | null) {
  if (!mc) return "—";
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9)  return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6)  return `$${(mc / 1e6).toFixed(1)}M`;
  return `$${mc.toFixed(0)}`;
}

interface Props {
  rows: StockRow[];
  onSelect: (r: StockRow) => void;
  scanning?: boolean;
  newest?: string;
  watchlist: Set<string>;
  onToggleWatch: (symbol: string) => void;
  sectorPEMap: Record<string, number>;
  emptyHint?: string;
  earningsMap?: Record<string, EarningsHistory>;
  isLocked?: (r: StockRow) => boolean;
  onUpgrade?: () => void;
}

export function ResultsTable({ rows, onSelect, scanning, newest, watchlist, onToggleWatch, sectorPEMap, emptyHint, earningsMap, isLocked, onUpgrade }: Props) {
  return (
    <div className="table-wrap glass depth-2">
      <table className="results-table">
        <thead>
          <tr>
            <th className="star-col" />
            <th className="num-col">#</th>
            <th>Company</th>
            <th>Sector</th>
            <th className="score-col">Score</th>
            <th className="num-col">8w trend</th>
            <th className="num-col">Earnings</th>
            <th className="num-col">Price</th>
            <th className="num-col">Day</th>
            <th className="num-col">P/E</th>
            <th className="num-col">Rev growth</th>
            <th className="num-col">Mkt cap</th>
            <th className="flag-col">Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            if (isLocked?.(r)) return (
              <tr key={r.symbol} className="row-in locked-row" onClick={() => onUpgrade?.()} tabIndex={0}>
                <td className="star-col"><span className="lock-mini">🔒</span></td>
                <td className="num-col rank num">{String(i + 1).padStart(2, "0")}</td>
                <td colSpan={11} className="lock-row-cell">
                  <span className="hdot" style={{ background: "#34d399", boxShadow: "0 0 6px #34d399" }} />
                  <b>Top-rated pick</b>
                  <span className="lock-row-sub">— a healthy, high-score stock. Unlock with Pro →</span>
                </td>
              </tr>
            );
            return (
            <tr
              key={r.symbol}
              className={`row-in${r.symbol === newest ? " row-new" : ""}`}
              onClick={() => onSelect(r)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") onSelect(r); }}
            >
              <td className="star-col">
                <WatchStar on={watchlist.has(r.symbol)} onToggle={() => onToggleWatch(r.symbol)} />
              </td>
              <td className="num-col rank num">{String(i + 1).padStart(2, "0")}</td>
              <td>
                <span className="sym-cell">
                  <span className="sym num">{r.symbol}</span>
                  <span className="sym-name">{r.name}</span>
                </span>
              </td>
              <td><SectorChip sector={r.sector} /></td>
              <td className="score-col">
                <span className="score-cell">
                  <ScorePill score={r.score ?? 0} />
                  <HealthDot stock={r} />
                  <ScoreBar score={r.score ?? 0} />
                </span>
              </td>
              <td className="num-col"><TrendArrow /></td>
              <td className="num-col"><EarningsMark e={earningsMap?.[r.symbol]} /></td>
              <td className="num-col num">{fmtPrice(r.price, r.symbol, r.currency)}</td>
              <td className="num-col"><DayChange value={r.dayChange} /></td>
              <td className="num-col num dim">{fmtPE(r.peRatio)}</td>
              <td className="num-col num">{fmtPct(r.revenueGrowth)}</td>
              <td className="num-col num dim">{fmtCap(r.marketCap)}</td>
              <td className="flag-col">
                <span className="flag-stack">
                  <RiskBadge stock={r} sectorPEMap={sectorPEMap} compact />
                  {r.isValuePlay ? (
                    <span className="value-flag" title="Value play — passes the Buffett filter">VALUE</span>
                  ) : null}
                </span>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && emptyHint ? (
        <div className="table-empty">{emptyHint}</div>
      ) : null}
      {scanning ? (
        <div className="table-streaming">
          <span className="live-dot" aria-hidden="true" />
          Streaming results — ranking updates live
        </div>
      ) : null}
    </div>
  );
}
