"use client";

import { useMemo, useState } from "react";
import type { StockRow, EarningsHistory } from "@/lib/types";
import { fmtPrice, fmtPct } from "@/lib/formatters";
import { WatchStar, SectorChip, ScorePill, ScoreBar, DayChange, TrendArrow, RiskBadge, HealthDot, CompanyLogo } from "./primitives";

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

/* ── Column sorting — purely a display-order concern, local to this table.
   It never touches the scan, the fetched data, or any parent state. ────── */
type SortKey = "company" | "sector" | "score" | "price" | "day" | "pe" | "revGrowth" | "mktCap";
type SortDir = "asc" | "desc";

const SORT_ACCESSORS: Record<SortKey, (r: StockRow) => string | number | null | undefined> = {
  company:   (r) => r.name || r.symbol,
  sector:    (r) => r.sector,
  score:     (r) => r.score,
  price:     (r) => r.price,
  day:       (r) => r.dayChange,
  pe:        (r) => (r.peRatio && r.peRatio > 0 ? r.peRatio : null),
  revGrowth: (r) => r.revenueGrowth,
  mktCap:    (r) => r.marketCap,
};

// First click's direction per column — cheapest-first for P/E, biggest-first
// elsewhere, A-Z for text columns.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  company: "asc", sector: "asc", score: "desc", price: "desc",
  day: "desc", pe: "asc", revGrowth: "desc", mktCap: "desc",
};

interface SortState { key: SortKey; dir: SortDir }

function sortRows(rows: StockRow[], sort: SortState | null): StockRow[] {
  if (!sort) return rows;
  const get = SORT_ACCESSORS[sort.key];
  const mul = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = get(a), bv = get(b);
    // Missing values always sink to the bottom, regardless of direction.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" || typeof bv === "string") {
      return mul * String(av).localeCompare(String(bv));
    }
    return mul * (av - bv);
  });
}

function SortTh({
  label, sortKey, sort, onSort, className = "",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState | null;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className={`${className} sortable-th${active ? " active" : ""}`}>
      <button
        type="button"
        className="sort-th-btn"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}${active ? (sort!.dir === "asc" ? ", ascending" : ", descending") : ""}`}
      >
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
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
}

export function ResultsTable({ rows, onSelect, scanning, newest, watchlist, onToggleWatch, sectorPEMap, emptyHint, earningsMap }: Props) {
  const [sort, setSort] = useState<SortState | null>(null);

  const handleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: DEFAULT_DIR[key] };
    });
  };

  // Sorting is purely presentational — the incoming `rows` (and everything
  // upstream: the scan, the score, the ranking) is never mutated or reordered.
  const displayRows = useMemo(() => sortRows(rows, sort), [rows, sort]);

  return (
    <div className="table-wrap glass depth-2">
      <table className="results-table">
        <thead>
          <tr>
            <th className="star-col" />
            <th className="num-col">#</th>
            <SortTh label="Company" sortKey="company" sort={sort} onSort={handleSort} />
            <SortTh label="Sector" sortKey="sector" sort={sort} onSort={handleSort} />
            <SortTh label="Score" sortKey="score" sort={sort} onSort={handleSort} className="score-col" />
            <th className="num-col">8w trend</th>
            <th className="num-col">Earnings</th>
            <SortTh label="Price" sortKey="price" sort={sort} onSort={handleSort} className="num-col" />
            <SortTh label="Day" sortKey="day" sort={sort} onSort={handleSort} className="num-col" />
            <SortTh label="P/E" sortKey="pe" sort={sort} onSort={handleSort} className="num-col" />
            <SortTh label="Rev growth" sortKey="revGrowth" sort={sort} onSort={handleSort} className="num-col" />
            <SortTh label="Mkt cap" sortKey="mktCap" sort={sort} onSort={handleSort} className="num-col" />
            <th className="flag-col">Flags</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r, i) => (
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
                  <CompanyLogo symbol={r.symbol} sector={r.sector} />
                  <span className="sym-cell-text">
                    <span className="sym num">{r.symbol}</span>
                    <span className="sym-name">{r.name}</span>
                  </span>
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
          ))}
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
