"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter } from "lucide-react";
import type { StockRow } from "@/lib/types";
import { fmtPrice, fmtPct, fmtNum } from "@/lib/formatters";
import { ScoreBadge, DayChangeBadge, ValueBadge } from "./ScoreBadge";
import { getSector, SECTOR_META } from "@/lib/tickers";

type SortKey = "score" | "symbol" | "peRatio" | "earningsGrowth" | "revenueGrowth" | "operatingMargin" | "dayChange";

interface ScannerTableProps {
  rows: StockRow[];
  onSelectStock: (stock: StockRow) => void;
  filterValue?: boolean;
}

export function ScannerTable({ rows, onSelectStock, filterValue }: ScannerTableProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sectorFilter, setSectorFilter] = useState("");

  const sectors = useMemo(() => {
    const s = new Set(rows.map((r) => r.sector).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filterValue) r = r.filter((row) => row.isValuePlay);
    if (query) {
      const q = query.toLowerCase();
      r = r.filter((row) =>
        row.symbol.toLowerCase().includes(q) ||
        (row.name ?? "").toLowerCase().includes(q) ||
        (row.sector ?? "").toLowerCase().includes(q)
      );
    }
    if (sectorFilter) r = r.filter((row) => row.sector === sectorFilter);
    return [...r].sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === "symbol" ? "" : -Infinity);
      const bv = b[sortKey] ?? (sortKey === "symbol" ? "" : -Infinity);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av as number, bn = bv as number;
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [rows, query, sectorFilter, sortKey, sortDir, filterValue]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown size={11} className="opacity-30" />;
    return sortDir === "desc"
      ? <ArrowDown size={11} className="text-indigo-400" />
      : <ArrowUp size={11} className="text-indigo-400" />;
  }

  function TH({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        onClick={() => toggleSort(k)}
        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors whitespace-nowrap"
        style={{ color: sortKey === k ? "#818cf8" : "rgba(148,163,184,0.6)" }}
      >
        <div className="flex items-center gap-1">
          {label} <SortIcon k={k} />
        </div>
      </th>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden depth-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "rgba(99,102,241,0.12)" }}>
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(148,163,184,0.5)" }} />
          <input
            type="text"
            placeholder="Search ticker, name, sector…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(99,102,241,0.15)",
              color: "#f1f5f9",
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} style={{ color: "rgba(148,163,184,0.5)" }} />
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(99,102,241,0.15)",
              color: "#94a3b8",
            }}
          >
            <option value="">All Sectors</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="text-xs ml-auto" style={{ color: "rgba(148,163,184,0.5)" }}>
          {filtered.length} / {rows.length} stocks
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead style={{ borderBottom: "1px solid rgba(99,102,241,0.12)", background: "rgba(0,0,0,0.2)" }}>
            <tr>
              <th className="px-4 py-3 text-left w-8 text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(148,163,184,0.4)" }}>#</th>
              <TH label="Symbol" k="symbol" />
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(148,163,184,0.6)" }}>Name</th>
              <TH label="Score" k="score" />
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(148,163,184,0.6)" }}>Price</th>
              <TH label="Day %" k="dayChange" />
              <TH label="P/E" k="peRatio" />
              <TH label="EPS YoY" k="earningsGrowth" />
              <TH label="Rev YoY" k="revenueGrowth" />
              <TH label="Op Margin" k="operatingMargin" />
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(148,163,184,0.6)" }}>Insight</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const sectorMeta = SECTOR_META[getSector(row.symbol)];
              return (
                <tr
                  key={row.symbol}
                  onClick={() => onSelectStock(row)}
                  className="table-row-hover group"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                >
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: "rgba(148,163,184,0.35)" }}>{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors">
                        {row.symbol}
                      </span>
                      {row.isValuePlay && <ValueBadge isValuePlay />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: sectorMeta.color, boxShadow: `0 0 4px ${sectorMeta.color}80` }}
                      />
                      <span className="text-xs" style={{ color: sectorMeta.color + "cc" }}>{sectorMeta.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-300 max-w-[150px] truncate">{row.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>{row.sector}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={row.score ?? 0} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold tabular-nums whitespace-nowrap text-slate-200">
                    {fmtPrice(row.price, row.symbol, row.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <DayChangeBadge value={row.dayChange} />
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums" style={{ color: "rgba(148,163,184,0.8)" }}>
                    {fmtNum(row.peRatio, 1)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm tabular-nums font-medium ${(row.earningsGrowth ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmtPct(row.earningsGrowth)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm tabular-nums font-medium ${(row.revenueGrowth ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmtPct(row.revenueGrowth)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums" style={{ color: "rgba(148,163,184,0.8)" }}>
                    {fmtPct(row.operatingMargin)}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[200px]" style={{ color: "rgba(148,163,184,0.6)" }}>
                    <span className="line-clamp-1">{row.insight}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm" style={{ color: "rgba(148,163,184,0.4)" }}>
            No stocks match your filters
          </div>
        )}
      </div>
    </div>
  );
}
