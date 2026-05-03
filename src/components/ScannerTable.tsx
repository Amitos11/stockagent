"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter } from "lucide-react";
import type { StockRow } from "@/lib/types";
import { fmtPrice, fmtPct, fmtNum } from "@/lib/formatters";
import { ScoreBadge, DayChangeBadge, ValueBadge } from "./ScoreBadge";

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
    if (sortKey !== k) return <ArrowUpDown size={12} className="text-slate-400" />;
    return sortDir === "desc" ? <ArrowDown size={12} className="text-amber-500" /> : <ArrowUp size={12} className="text-amber-500" />;
  }

  function TH({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        onClick={() => toggleSort(k)}
        className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-800 transition-colors whitespace-nowrap"
      >
        <div className="flex items-center gap-1">
          {label} <SortIcon k={k} />
        </div>
      </th>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ticker, name, sector…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
          >
            <option value="">All Sectors</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="text-xs text-slate-400 ml-auto">
          {filtered.length} / {rows.length}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">#</th>
              <TH label="Symbol" k="symbol" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
              <TH label="Score" k="score" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Price</th>
              <TH label="Day %" k="dayChange" />
              <TH label="P/E" k="peRatio" />
              <TH label="EPS YoY" k="earningsGrowth" />
              <TH label="Rev YoY" k="revenueGrowth" />
              <TH label="Op Margin" k="operatingMargin" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Insight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((row, i) => (
              <tr
                key={row.symbol}
                onClick={() => onSelectStock(row)}
                className="hover:bg-amber-50/40 cursor-pointer transition-colors group"
              >
                <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm group-hover:text-amber-700 transition-colors">
                      {row.symbol}
                    </span>
                    {row.isValuePlay && <ValueBadge isValuePlay />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-slate-600 max-w-[160px] truncate">{row.name}</div>
                  <div className="text-xs text-slate-400 truncate">{row.sector}</div>
                </td>
                <td className="px-4 py-3">
                  <ScoreBadge score={row.score ?? 0} size="sm" />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900 tabular-nums whitespace-nowrap">
                  {fmtPrice(row.price, row.symbol, row.currency)}
                </td>
                <td className="px-4 py-3">
                  <DayChangeBadge value={row.dayChange} />
                </td>
                <td className="px-4 py-3 text-sm tabular-nums text-slate-700">{fmtNum(row.peRatio, 1)}</td>
                <td className="px-4 py-3">
                  <span className={`text-sm tabular-nums font-medium ${(row.earningsGrowth ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {fmtPct(row.earningsGrowth)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm tabular-nums font-medium ${(row.revenueGrowth ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {fmtPct(row.revenueGrowth)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm tabular-nums text-slate-700">{fmtPct(row.operatingMargin)}</td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px]">
                  <span className="line-clamp-1">{row.insight}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-slate-400 text-sm">No stocks match your filters</div>
        )}
      </div>
    </div>
  );
}
