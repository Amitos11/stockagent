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
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      if (done) return;
      es.close();
      setScanError("Connection to scan stream lost. Please try again.");
      setScanning(false);
      setProgress(0);
    };
  }, [wGrowth, wProfit, wValue]);

  const handleSelectStock = useCallback((stock: StockRow) => {
    setSelectedStock(stock);
  }, []);

  const handleSearchResult = useCallback((stock: StockRow) => {
    const cached = results?.allRows.find((r) => r.symbol === stock.symbol);
    setSelectedStock(cached ?? stock);
  }, [results]);

  const downloadCSV = useCallback(() => {
    if (!results) return;
    const headers = [
      "Rank","Symbol","Name","Sector","Score",
      "Price","P/E","Forward P/E","EPS YoY","Rev YoY",
      "Op Margin","ROE","D/E","Mkt Cap","Value Play","Next Earnings",
    ];
    const rows = results.valid.map((r) => [
      r.rank ?? "", r.symbol, r.name ?? "", r.sector ?? "",
      (r.score ?? 0).toFixed(1),
      fmtPrice(r.price, r.symbol, r.currency),
      fmtNum(r.peRatio, 1), fmtNum(r.forwardPE, 1),
      fmtPct(r.earningsGrowth), fmtPct(r.revenueGrowth),
      fmtPct(r.operatingMargin), fmtPct(r.roe),
      fmtNum(r.debtToEquity, 1), r.marketCapDisplay ?? "",
      r.isValuePlay ? "Yes" : "No", r.nextEarnings ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `stockagent-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const valueCount  = results?.valid.filter((r) => r.isValuePlay).length ?? 0;
  const leader      = results?.top10[0];
  const avgScore    = results?.valid.length
    ? results.valid.reduce((s, r) => s + (r.score ?? 0), 0) / results.valid.length
    : 0;
  const greenCount  = results?.valid.filter((r) => (r.score ?? 0) >= 60).length ?? 0;
  const failedCount = results ? results.allRows.length - results.valid.length : 0;

  return (
    <div className="min-h-screen bg-mesh text-slate-100">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 glass border-b border-white/[0.06]">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", boxShadow: "0 0 16px rgba(34,197,94,0.4)" }}>
              <BarChart3 size={15} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight">StockAgent</span>
              <span className="text-xs text-slate-500 ml-2 hidden sm:inline">Market Scanner</span>
            </div>
          </div>

          {/* Center info */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/[0.06]">
              {TICKERS.length} tickers · US + IL
            </span>
            {results?.scannedAt && (
              <span suppressHydrationWarning className="px-2 py-0.5 rounded-md bg-white/5 border border-white/[0.06]">
                Last scan: {new Date(results.scannedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {results && (
              <button
                onClick={downloadCSV}
                className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/[0.08] hover:border-white/20 px-3 py-1.5 rounded-lg transition-all cursor-pointer glass-hover"
              >
                <Download size={13} /> Export CSV
              </button>
            )}
            <button
              onClick={runScan}
              disabled={scanning}
              className="btn-scan flex items-center gap-2 text-white font-semibold text-sm px-4 py-2 rounded-lg cursor-pointer"
            >
              {scanning
                ? <RefreshCw size={15} className="animate-spin" />
                : <ScanLine size={15} />}
              {scanning
                ? receivedCount > 0 ? `${receivedCount}/${TICKERS.length}` : "Scanning…"
                : "Run Scan"}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {scanning && (
          <div className="h-[2px] bg-white/5 overflow-hidden">
            <div
              className="h-full progress-glow transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </nav>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Controls ───────────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex-1 min-w-[280px]">
              <h2 className="text-xs font-semibold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Layers size={13} className="text-slate-500" />
                Scoring Weights
              </h2>
              <div className="grid grid-cols-3 gap-5">
                <WeightSlider label="Growth"        value={wGrowth} onChange={setWGrowth} color="text-emerald-400"  trackColor="#22c55e" />
                <WeightSlider label="Profitability" value={wProfit} onChange={setWProfit} color="text-blue-400"     trackColor="#60a5fa" />
                <WeightSlider label="Valuation"     value={wValue}  onChange={setWValue}  color="text-violet-400"   trackColor="#a78bfa" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className={`text-sm font-semibold px-3 py-1.5 rounded-lg border ${
                totalWeight === 100
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>
                {totalWeight}% {totalWeight === 100 ? "✓" : "≠ 100"}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-xs font-semibold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Search size={13} className="text-slate-500" />
                Free-Form Analysis
              </h2>
              <StockSearch
                weights={{ growth: wGrowth, profitability: wProfit, valuation: wValue }}
                onResult={handleSearchResult}
                cachedSymbols={results?.allRows.map((r) => r.symbol) ?? []}
              />
            </div>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {scanError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={14} /> {scanError}
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {!results && !scanning && (
          <div className="glass rounded-2xl py-24 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 100%)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <ScanLine size={28} className="text-emerald-400" />
            </div>
            <div className="text-center">
              <div className="font-bold text-white text-xl tracking-tight">Ready to Scan</div>
              <div className="text-sm text-slate-500 mt-1.5">
                {TICKERS.length} tickers · US mega-cap, semis, software, healthcare, Israeli NASDAQ &amp; TASE
              </div>
            </div>
            <button
              onClick={runScan}
              className="btn-scan mt-1 flex items-center gap-2 text-white font-semibold px-8 py-3 rounded-xl text-sm cursor-pointer"
            >
              <ScanLine size={16} /> Start Scan <ChevronRight size={16} />
            </button>
            <p className="text-xs text-slate-600">~30–60 seconds · parallel fetch · results stream live</p>
          </div>
        )}

        {/* ── Live partial results ────────────────────────────────────────── */}
        {scanning && partialRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <RefreshCw size={13} className="animate-spin text-emerald-400" />
                Live results — <span className="text-emerald-400 font-mono">{receivedCount}</span> / {TICKERS.length} fetched
              </div>
              <span className="text-xs text-slate-600">Table updates in real-time</span>
            </div>
            <RankedTable
              rows={partialRows.filter((r) => r.score != null).slice(0, 20)}
              onSelect={handleSelectStock}
              title={`Top results so far (${partialRows.filter(r => r.score != null).length} scored)`}
              compact
            />
          </div>
        )}

        {/* ── Skeleton ───────────────────────────────────────────────────── */}
        {scanning && partialRows.length === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-xl h-24 skeleton" />
              ))}
            </div>
            <div className="rounded-xl h-64 skeleton" />
          </div>
        )}

        {/* ── Results ────────────────────────────────────────────────────── */}
        {results && !scanning && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <MetricCard label="Scanned"      value={`${results.valid.length}/${results.allRows.length}`} sub={`${failedCount} no data`}   accent="default" icon={<BarChart3 size={14} />} />
              <MetricCard label="Avg Score"    value={avgScore.toFixed(1)}                                 sub="out of 100"                  accent="purple"  icon={<Target size={14} />} />
              <MetricCard label="Strong 60+"   value={greenCount}                                          sub="high-conviction"             accent="green"   icon={<TrendingUp size={14} />} />
              <MetricCard label="Value Plays"  value={valueCount}                                          sub="P/E < 20, D/E < 50"          accent="gold"    icon={<BarChart3 size={14} />} />
              {leader && (
                <MetricCard label="Leader" value={leader.symbol} sub={`Score ${(leader.score ?? 0).toFixed(1)}`} accent="green" icon={<TrendingUp size={14} />} />
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 glass rounded-xl p-1 w-fit">
              {(["top10", "all", "value"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    activeTab === tab
                      ? "text-white font-semibold"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                  style={activeTab === tab ? {
                    background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                    boxShadow: "0 0 16px rgba(34,197,94,0.3)",
                  } : {}}
                >
                  {tab === "top10" ? "Top 10"
                    : tab === "all"   ? `All Ranked (${results.valid.length})`
                    :                   `Value Plays (${valueCount})`}
                </button>
              ))}
            </div>

            {/* TOP 10 */}
            {activeTab === "top10" && (
              <div className="space-y-5">
                <RankedTable rows={results.top10} onSelect={handleSelectStock} title="Top 10 — Ranked by Score" />

                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <h3 className="text-sm font-semibold text-slate-300">Detail Cards</h3>
                    <span className="text-xs text-slate-600">Click any card for full analysis</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.top10.map((stock, i) => (
                      <Top10Card key={stock.symbol} stock={stock} rank={i + 1} onClick={() => handleSelectStock(stock)} />
                    ))}
                  </div>
                </div>

                {results.valid.length > 10 && (() => {
                  const rest = results.valid.slice(10);
                  const nonRed = rest.filter((r) => (r.score ?? 0) >= 40);
                  const reds   = rest.filter((r) => (r.score ?? 0) <  40).slice(0, 5);
                  const shown  = [...nonRed, ...reds];
                  const hidden = rest.length - shown.length;
                  return (
                    <RankedTable
                      rows={shown}
                      onSelect={handleSelectStock}
                      title={`Ranks 11–${10 + shown.length}${hidden > 0 ? ` (${hidden} weak hidden)` : ""}`}
                      compact
                    />
                  );
                })()}
              </div>
            )}

            {(activeTab === "all" || activeTab === "value") && (
              <ScannerTable
                rows={results.valid}
                onSelectStock={handleSelectStock}
                filterValue={activeTab === "value"}
              />
            )}
          </>
        )}

        <footer className="text-center text-xs text-slate-700 pb-4 pt-2">
          ⚠️ Automated analysis only. NOT investment advice. Data via Yahoo Finance &amp; FMP.
        </footer>
      </div>

      <StockDrawer stock={selectedStock} onClose={() => setSelectedStock(null)} />
    </div>
  );
}

// ─── Ranked Table ──────────────────────────────────────────────────────────────

function RankedTable({
  rows, onSelect, title, compact = false,
}: {
  rows: StockRow[];
  onSelect: (s: StockRow) => void;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-500 font-mono">{rows.length} stocks</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider w-10">#</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Symbol</th>
              {!compact && <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Name / Sector</th>}
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Score</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Day %</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">P/E</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Fwd P/E</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">EPS YoY</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Rev YoY</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Op Margin</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Mkt Cap</th>
              {!compact && <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Insight</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const rank  = row.rank ?? (i + 1);
              const score = row.score ?? 0;
              return (
                <tr
                  key={row.symbol}
                  onClick={() => onSelect(row)}
                  className="table-row-hover cursor-pointer border-b border-white/[0.03] last:border-0"
                >
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold text-slate-600 tabular-nums">{rank}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                        {row.symbol}
                      </span>
                      {row.isValuePlay && <ValueBadge isValuePlay />}
                    </div>
                  </td>
                  {!compact && (
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-300 max-w-[160px] truncate">{row.name}</div>
                      <div className="text-xs text-slate-600 truncate">{row.sector}</div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <ScoreBadge score={score} size="sm" />
                      <div className="h-1 w-16 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${score >= 60 ? "score-bar-green" : score >= 40 ? "score-bar-amber" : "score-bar-red"}`}
                          style={{ width: `${Math.min(score, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-white tabular-nums whitespace-nowrap">
                    {fmtPrice(row.price, row.symbol, row.currency)}
                  </td>
                  <td className="px-4 py-3"><DayChangeBadge value={row.dayChange} /></td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-400">{fmtNum(row.peRatio, 1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-500">{fmtNum(row.forwardPE, 1)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm tabular-nums font-medium ${(row.earningsGrowth ?? 0) >= 0 ? "text-emerald-400 text-glow-green" : "text-red-400 text-glow-red"}`}>
                      {fmtPct(row.earningsGrowth)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm tabular-nums font-medium ${(row.revenueGrowth ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fmtPct(row.revenueGrowth)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-400">{fmtPct(row.operatingMargin)}</td>
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
  const score = stock.score ?? 0;
  return (
    <button
      onClick={onClick}
      className="glass glass-hover rounded-2xl p-5 text-left cursor-pointer w-full group"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all"
            style={{
              background: rank <= 3
                ? "linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.05) 100%)"
                : "rgba(255,255,255,0.04)",
              border: rank <= 3 ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.07)",
              color: rank <= 3 ? "#22c55e" : "#64748b",
            }}>
            {rank}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white group-hover:text-emerald-400 transition-colors">{stock.symbol}</span>
              {stock.isValuePlay && <ValueBadge isValuePlay />}
              <DayChangeBadge value={stock.dayChange} />
            </div>
            <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{stock.name}</div>
            {stock.sector && <div className="text-xs text-slate-600">{stock.sector}</div>}
          </div>
        </div>
        <ScoreBadge score={score} />
      </div>

      {/* Mini metrics */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-3 mb-4">
        <MiniMetric label="Price"     value={fmtPrice(stock.price, stock.symbol, stock.currency)} />
        <MiniMetric label="P/E"       value={fmtNum(stock.peRatio, 1)} />
        <MiniMetric label="Fwd P/E"   value={fmtNum(stock.forwardPE, 1)} />
        <MiniMetric label="EPS YoY"   value={fmtPct(stock.earningsGrowth)}  positive={stock.earningsGrowth != null && stock.earningsGrowth > 0} />
        <MiniMetric label="Rev YoY"   value={fmtPct(stock.revenueGrowth)}   positive={stock.revenueGrowth  != null && stock.revenueGrowth  > 0} />
        <MiniMetric label="Op Margin" value={fmtPct(stock.operatingMargin)} />
      </div>

      {/* Forward estimates */}
      {(stock.forecasts?.nextQEps != null || stock.forecasts?.nextYRevenue != null) && (
        <div className="flex gap-4 py-2.5 border-t border-white/[0.05] mb-3">
          {stock.forecasts?.nextQEps != null && (
            <div className="text-xs">
              <span className="text-slate-600">Fwd EPS (Q): </span>
              <span className="font-semibold text-slate-300">${stock.forecasts.nextQEps.toFixed(2)}</span>
              {stock.forecasts.nextQEpsGrowth != null && (
                <span className={`ml-1 ${stock.forecasts.nextQEpsGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {fmtPct(stock.forecasts.nextQEpsGrowth)}
                </span>
              )}
            </div>
          )}
          {stock.forecasts?.nextQRevenue != null && (
            <div className="text-xs">
              <span className="text-slate-600">Fwd Rev (Q): </span>
              <span className="font-semibold text-slate-300">
                ${(stock.forecasts.nextQRevenue / 1e9).toFixed(1)}B
              </span>
              {stock.forecasts.nextQRevenueGrowth != null && (
                <span className={`ml-1 ${stock.forecasts.nextQRevenueGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {fmtPct(stock.forecasts.nextQRevenueGrowth)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Score bar */}
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${score >= 60 ? "score-bar-green" : score >= 40 ? "score-bar-amber" : "score-bar-red"}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      {stock.insight && (
        <div className="mt-2 text-xs text-slate-600 line-clamp-1">{stock.insight}</div>
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
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`text-xs font-bold tabular-nums font-mono ${color}`}>{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer mb-2.5"
        style={{
          color: trackColor,
          accentColor: trackColor,
          background: `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${value}%, rgba(255,255,255,0.08) ${value}%, rgba(255,255,255,0.08) 100%)`,
        }}
        aria-label={`${label} weight`}
      />
      <div className="flex items-center justify-between gap-1">
        <button
          onClick={() => step(-5)}
          className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-bold flex items-center justify-center transition-colors cursor-pointer select-none border border-white/[0.06]"
        >−</button>
        <input
          type="number" min={0} max={100} value={value}
          onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
          className="w-12 text-center text-xs font-semibold font-mono bg-white/5 border border-white/[0.08] rounded-md py-0.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 tabular-nums"
        />
        <button
          onClick={() => step(5)}
          className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 text-sm font-bold flex items-center justify-center transition-colors cursor-pointer select-none border border-white/[0.06]"
        >+</button>
      </div>
    </div>
  );
}

// ─── Mini Metric ───────────────────────────────────────────────────────────────

function MiniMetric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-slate-600 mb-0.5 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-semibold tabular-nums font-mono leading-tight ${
        positive === true  ? "text-emerald-400"
        : positive === false ? "text-red-400"
        : "text-slate-200"
      }`}>
        {value}
      </div>
    </div>
  );
}
