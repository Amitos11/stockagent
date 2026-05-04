"use client";

import { useState, useCallback } from "react";
import {
  ScanLine, TrendingUp, BarChart3, Target, Layers,
  RefreshCw, Download, Search, ChevronRight, AlertCircle,
} from "lucide-react";
import type { StockRow, ScanResult } from "@/lib/types";
import { MetricCard } from "@/components/MetricCard";
import { ScannerTable } from "@/components/ScannerTable";
import { StockDrawer } from "@/components/StockDrawer";
import { StockSearch } from "@/components/StockSearch";
import { ScoreBadge, DayChangeBadge, ValueBadge } from "@/components/ScoreBadge";
import { fmtPrice, fmtPct, fmtNum } from "@/lib/formatters";
import { TICKERS } from "@/lib/tickers";

type Tab = "top10" | "all" | "value";

export default function DashboardPage() {
  const [results, setResults] = useState<ScanResult | null>(null);
  const [partialRows, setPartialRows] = useState<StockRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [progress, setProgress] = useState(0);
  const [receivedCount, setReceivedCount] = useState(0);
  const [selectedStock, setSelectedStock] = useState<StockRow | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("top10");

  const [wGrowth, setWGrowth] = useState(33);
  const [wProfit, setWProfit] = useState(33);
  const [wValue, setWValue]  = useState(34);

  const totalWeight = wGrowth + wProfit + wValue;

  const runScan = useCallback(() => {
    setScanning(true);
    setScanError("");
    setProgress(0);
    setResults(null);
    setPartialRows([]);
    setReceivedCount(0);

    const url = `/api/scan/stream?growth=${wGrowth}&profitability=${wProfit}&valuation=${wValue}`;
    const es = new EventSource(url);
    let total: number = TICKERS.length;
    let done = false;

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { type: string; data?: unknown };

        const d = (msg.data ?? {}) as Record<string, unknown>;

        if (msg.type === "start") {
          if (d["total"]) total = d["total"] as number;
        } else if (msg.type === "stock") {
          const received = (d["received"] as number | undefined) ?? 0;
          setReceivedCount(received);
          setProgress(Math.min((received / total) * 95, 95));
          const row = d["row"] as StockRow | undefined;
          if (row) {
            setPartialRows((prev) => {
              const updated = [...prev, row];
              updated.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
              return updated;
            });
          }
        } else if (msg.type === "complete") {
          done = true;
          es.close();
          const result = d as unknown as ScanResult;
          setResults(result);
          setPartialRows([]);
          setActiveTab("top10");
          setProgress(100);
          setTimeout(() => { setScanning(false); setProgress(0); }, 400);
        } else if (msg.type === "error") {
          done = true;
          es.close();
          setScanError(`Scan failed: ${(d["message"] as string | undefined) ?? "unknown error"}`);
          setScanning(false);
          setProgress(0);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      if (done) return; // natural close after complete — ignore
      es.close();
      setScanError("Connection to scan stream lost. Please try again.");
      setScanning(false);
      setProgress(0);
    };
  }, [wGrowth, wProfit, wValue]);

  const handleSelectStock = useCallback((stock: StockRow) => {
    setSelectedStock(stock);
  }, []);

  const downloadCSV = useCallback(() => {
    if (!results) return;
    const headers = [
      "Rank", "Symbol", "Name", "Sector", "Score",
      "Price", "P/E", "Forward P/E", "EPS YoY", "Rev YoY",
      "Op Margin", "ROE", "D/E", "Mkt Cap", "Value Play", "Next Earnings",
    ];
    const rows = results.valid.map((r) => [
      r.rank ?? "",
      r.symbol,
      r.name ?? "",
      r.sector ?? "",
      (r.score ?? 0).toFixed(1),
      fmtPrice(r.price, r.symbol, r.currency),
      fmtNum(r.peRatio, 1),
      fmtNum(r.forwardPE, 1),
      fmtPct(r.earningsGrowth),
      fmtPct(r.revenueGrowth),
      fmtPct(r.operatingMargin),
      fmtPct(r.roe),
      fmtNum(r.debtToEquity, 1),
      r.marketCapDisplay ?? "",
      r.isValuePlay ? "Yes" : "No",
      r.nextEarnings ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `discovery-agent-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const valueCount  = results?.valid.filter((r) => r.isValuePlay).length ?? 0;
  const leader      = results?.top10[0];
  const avgScore    = results?.valid.length
    ? results.valid.reduce((s, r) => s + (r.score ?? 0), 0) / results.valid.length
    : 0;
  const greenCount  = results?.valid.filter((r) => (r.score ?? 0) >= 60).length ?? 0;
  const failedCount = results
    ? results.allRows.length - results.valid.length
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
              <BarChart3 size={14} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm tracking-tight">Discovery Agent</span>
              <span className="text-xs text-slate-400 ml-1.5 hidden sm:inline">Stock Scanner</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <span>{TICKERS.length} tickers · US + IL</span>
            {results?.scannedAt && (
              <><span>·</span><span suppressHydrationWarning>Last scan: {new Date(results.scannedAt).toLocaleTimeString()}</span></>
            )}
          </div>

          <div className="flex items-center gap-2">
            {results && (
              <button
                onClick={downloadCSV}
                className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
              >
                <Download size={13} /> Export CSV
              </button>
            )}
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-70 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed shadow-sm"
            >
              {scanning ? <RefreshCw size={15} className="animate-spin" /> : <ScanLine size={15} />}
              {scanning
                ? receivedCount > 0
                  ? `${receivedCount}/${TICKERS.length}`
                  : "Scanning…"
                : "Run Scan"}
            </button>
          </div>
        </div>

        {scanning && (
          <div className="h-0.5 bg-slate-100 overflow-hidden">
            <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </nav>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Controls ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex-1 min-w-[280px]">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Layers size={14} className="text-slate-400" />
                Scoring Weights
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <WeightSlider label="Growth"        value={wGrowth} onChange={setWGrowth} color="text-blue-600"   trackColor="#60a5fa" />
                <WeightSlider label="Profitability" value={wProfit} onChange={setWProfit} color="text-violet-600" trackColor="#a78bfa" />
                <WeightSlider label="Valuation"     value={wValue}  onChange={setWValue}  color="text-amber-600"  trackColor="#fbbf24" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${totalWeight === 100 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                Total: {totalWeight}% {totalWeight === 100 ? "✓" : "≠100"}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Search size={14} className="text-slate-400" />
                Free-Form Analysis
              </h2>
              <StockSearch
                weights={{ growth: wGrowth, profitability: wProfit, valuation: wValue }}
                onResult={handleSelectStock}
              />
            </div>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────── */}
        {scanError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={14} /> {scanError}
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────── */}
        {!results && !scanning && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-20 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
              <ScanLine size={22} className="text-amber-400" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-800 text-lg">Ready to scan</div>
              <div className="text-sm text-slate-400 mt-1">
                {TICKERS.length} tickers · US mega-cap, semis, software, healthcare, Israeli NASDAQ &amp; TASE
              </div>
            </div>
            <button
              onClick={runScan}
              className="mt-2 flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all cursor-pointer shadow-sm"
            >
              <ScanLine size={16} /> Start Scan <ChevronRight size={16} />
            </button>
            <p className="text-xs text-slate-400">~30–60 seconds · parallel fetch · results stream in live</p>
          </div>
        )}

        {/* ── Live partial results while scanning ────────────────── */}
        {scanning && partialRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                <RefreshCw size={13} className="animate-spin text-amber-500" />
                Live results — {receivedCount} / {TICKERS.length} fetched
              </div>
              <span className="text-xs text-slate-400">Table updates in real-time</span>
            </div>
            <RankedTable
              rows={partialRows.filter((r) => r.score != null).slice(0, 20)}
              onSelect={handleSelectStock}
              title={`Top results so far (${partialRows.filter(r => r.score != null).length} scored)`}
              compact
            />
          </div>
        )}

        {/* ── Skeleton (only while no partial rows yet) ──────────── */}
        {scanning && partialRows.length === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 h-24 skeleton" />
              ))}
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-5 h-64 skeleton" />
          </div>
        )}

        {/* ── Results ────────────────────────────────────────────── */}
        {results && !scanning && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <MetricCard label="Scanned"      value={`${results.valid.length} / ${results.allRows.length}`} sub={`${failedCount} no data`}        accent="default" icon={<BarChart3 size={14} />} />
              <MetricCard label="Avg Score"    value={avgScore.toFixed(1)}                                   sub="out of 100"                       accent="purple"  icon={<Target size={14} />} />
              <MetricCard label="Strong (60+)" value={greenCount}                                            sub="high-conviction"                  accent="green"   icon={<TrendingUp size={14} />} />
              <MetricCard label="Value Plays"  value={valueCount}                                            sub="P/E < 20, D/E < 50"               accent="gold"    icon={<BarChart3 size={14} />} />
              {leader && (
                <MetricCard label="Leader" value={leader.symbol} sub={`Score ${(leader.score ?? 0).toFixed(1)}`} accent="gold" icon={<TrendingUp size={14} />} />
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-slate-100 shadow-sm rounded-xl p-1 w-fit">
              {(["top10", "all", "value"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    activeTab === tab
                      ? "bg-amber-400 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {tab === "top10" ? "Top 10"
                    : tab === "all"   ? `All Ranked (${results.valid.length})`
                    :                   `Value Plays (${valueCount})`}
                </button>
              ))}
            </div>

            {/* ── TOP 10 ──────────────────────────────────────────── */}
            {activeTab === "top10" && (
              <div className="space-y-5">

                {/* Ranked table — primary view */}
                <RankedTable rows={results.top10} onSelect={handleSelectStock} title="Top 10 — Ranked by Score" />

                {/* Detail cards grid */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">Detail View</h3>
                    <span className="text-xs text-slate-400">Click any card to open full analysis</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.top10.map((stock, i) => (
                      <Top10Card key={stock.symbol} stock={stock} rank={i + 1} onClick={() => handleSelectStock(stock)} />
                    ))}
                  </div>
                </div>

                {/* Ranks 11+ in compact table */}
                {results.valid.length > 10 && (
                  <RankedTable
                    rows={results.valid.slice(10)}
                    onSelect={handleSelectStock}
                    title={`Ranks 11–${results.valid.length} — All Other Stocks`}
                    compact
                  />
                )}
              </div>
            )}

            {/* ── ALL / VALUE ─────────────────────────────────────── */}
            {(activeTab === "all" || activeTab === "value") && (
              <ScannerTable
                rows={results.valid}
                onSelectStock={handleSelectStock}
                filterValue={activeTab === "value"}
              />
            )}
          </>
        )}

        <footer className="text-center text-xs text-slate-400 pb-4 pt-2">
          ⚠️ Automated analysis only. NOT investment advice. Data via Yahoo Finance.
        </footer>
      </div>

      <StockDrawer stock={selectedStock} onClose={() => setSelectedStock(null)} />
    </div>
  );
}

// ─── Ranked Table ─────────────────────────────────────────────────────────────

function RankedTable({
  rows, onSelect, title, compact = false,
}: {
  rows: StockRow[];
  onSelect: (s: StockRow) => void;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className="text-xs text-slate-400">{rows.length} stocks</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Symbol</th>
              {!compact && <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name / Sector</th>}
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Price</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Day %</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">P/E</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fwd P/E</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">EPS YoY</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rev YoY</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Op Margin</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Mkt Cap</th>
              {!compact && <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Insight</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row, i) => {
              const rank = row.rank ?? (i + 1);
              const score = row.score ?? 0;
              return (
                <tr
                  key={row.symbol}
                  onClick={() => onSelect(row)}
                  className="hover:bg-amber-50/50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold text-slate-400 tabular-nums">{rank}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-amber-700 transition-colors">
                        {row.symbol}
                      </span>
                      {row.isValuePlay && <ValueBadge isValuePlay />}
                    </div>
                  </td>
                  {!compact && (
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-600 max-w-[160px] truncate">{row.name}</div>
                      <div className="text-xs text-slate-400 truncate">{row.sector}</div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <ScoreBadge score={score} size="sm" />
                      <div className="h-1 w-16 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${score >= 60 ? "bg-emerald-400" : score >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${Math.min(score, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 tabular-nums whitespace-nowrap">
                    {fmtPrice(row.price, row.symbol, row.currency)}
                  </td>
                  <td className="px-4 py-3"><DayChangeBadge value={row.dayChange} /></td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-700">{fmtNum(row.peRatio, 1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-500">{fmtNum(row.forwardPE, 1)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm tabular-nums font-medium ${(row.earningsGrowth ?? 0) >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {fmtPct(row.earningsGrowth)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm tabular-nums font-medium ${(row.revenueGrowth ?? 0) >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {fmtPct(row.revenueGrowth)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-700">{fmtPct(row.operatingMargin)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-500 whitespace-nowrap">{row.marketCapDisplay ?? "—"}</td>
                  {!compact && (
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px]">
                      <span className="line-clamp-1">{row.insight}</span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Top 10 Detail Card ────────────────────────────────────────────────────────

function Top10Card({ stock, rank, onClick }: { stock: StockRow; rank: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 text-left hover:border-amber-200 hover:shadow-md transition-all cursor-pointer group w-full"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
            {rank}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">{stock.symbol}</span>
              {stock.isValuePlay && <ValueBadge isValuePlay />}
              <DayChangeBadge value={stock.dayChange} />
            </div>
            <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{stock.name}</div>
            {stock.sector && <div className="text-xs text-slate-400">{stock.sector}</div>}
          </div>
        </div>
        <ScoreBadge score={stock.score ?? 0} />
      </div>

      {/* Mini metrics grid */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-3">
        <MiniMetric label="Price"      value={fmtPrice(stock.price, stock.symbol, stock.currency)} />
        <MiniMetric label="P/E"        value={fmtNum(stock.peRatio, 1)} />
        <MiniMetric label="Fwd P/E"    value={fmtNum(stock.forwardPE, 1)} />
        <MiniMetric label="EPS YoY"    value={fmtPct(stock.earningsGrowth)}   positive={stock.earningsGrowth != null && stock.earningsGrowth > 0} />
        <MiniMetric label="Rev YoY"    value={fmtPct(stock.revenueGrowth)}    positive={stock.revenueGrowth  != null && stock.revenueGrowth  > 0} />
        <MiniMetric label="Op Margin"  value={fmtPct(stock.operatingMargin)} />
      </div>

      {/* Forward estimates row */}
      {(stock.forecasts?.nextQEps != null || stock.forecasts?.nextYRevenue != null) && (
        <div className="flex gap-4 py-2 border-t border-slate-50 mb-2">
          {stock.forecasts?.nextQEps != null && (
            <div className="text-xs">
              <span className="text-slate-400">Fwd EPS (Q): </span>
              <span className="font-semibold text-slate-700">${stock.forecasts.nextQEps.toFixed(2)}</span>
              {stock.forecasts.nextQEpsGrowth != null && (
                <span className={`ml-1 ${stock.forecasts.nextQEpsGrowth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {fmtPct(stock.forecasts.nextQEpsGrowth)}
                </span>
              )}
            </div>
          )}
          {stock.forecasts?.nextQRevenue != null && (
            <div className="text-xs">
              <span className="text-slate-400">Fwd Rev (Q): </span>
              <span className="font-semibold text-slate-700">
                ${(stock.forecasts.nextQRevenue / 1e9).toFixed(1)}B
              </span>
              {stock.forecasts.nextQRevenueGrowth != null && (
                <span className={`ml-1 ${stock.forecasts.nextQRevenueGrowth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {fmtPct(stock.forecasts.nextQRevenueGrowth)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Score bar */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${(stock.score ?? 0) >= 60 ? "bg-emerald-400" : (stock.score ?? 0) >= 40 ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${Math.min(stock.score ?? 0, 100)}%` }}
        />
      </div>
      {stock.insight && (
        <div className="mt-2 text-xs text-slate-500 line-clamp-1">{stock.insight}</div>
      )}
    </button>
  );
}

// ─── Weight Slider ─────────────────────────────────────────────────────────────

function WeightSlider({
  label, value, onChange, color, trackColor,
}: {
  label: string; value: number; onChange: (v: number) => void;
  color: string; trackColor: string;
}) {
  const step = (delta: number) => onChange(Math.max(0, Math.min(100, value + delta)));

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${color}`}>{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer mb-2"
        style={{ accentColor: trackColor }}
        aria-label={`${label} weight`}
      />
      <div className="flex items-center justify-between gap-1">
        <button
          onClick={() => step(-5)}
          className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center transition-colors cursor-pointer select-none"
        >−</button>
        <input
          type="number" min={0} max={100} value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
          className="w-12 text-center text-xs font-semibold border border-slate-200 rounded-md py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-400 tabular-nums"
        />
        <button
          onClick={() => step(5)}
          className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center transition-colors cursor-pointer select-none"
        >+</button>
      </div>
    </div>
  );
}

// ─── Mini Metric ───────────────────────────────────────────────────────────────

function MiniMetric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className={`text-sm font-semibold tabular-nums leading-tight ${
        positive === true  ? "text-emerald-700"
        : positive === false ? "text-red-700"
        : "text-slate-800"
      }`}>
        {value}
      </div>
    </div>
  );
}
