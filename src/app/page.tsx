"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ScanLine, TrendingUp, BarChart3, Target, Layers,
  RefreshCw, Download, Search, ChevronRight, AlertCircle,
  Globe, Star,
} from "lucide-react";
import type { StockRow, ScanResult } from "@/lib/types";
import { MetricCard } from "@/components/MetricCard";
import { ScannerTable } from "@/components/ScannerTable";
import { StockDrawer } from "@/components/StockDrawer";
import { StockSearch } from "@/components/StockSearch";
import { ScoreBadge, DayChangeBadge, ValueBadge } from "@/components/ScoreBadge";
import { SectorChart } from "@/components/SectorChart";
import { MarketHeatmap } from "@/components/MarketHeatmap";
import { fmtPrice, fmtPct, fmtNum } from "@/lib/formatters";
import { ALL_TICKERS, BUFFETT_QUOTES, getSector, SECTOR_META } from "@/lib/tickers";

type Tab = "top10" | "all" | "value" | "sectors" | "heatmap";
type MarketFilter = "all" | "US" | "IL";

export default function DashboardPage() {
  const [results, setResults]         = useState<ScanResult | null>(null);
  const [partialRows, setPartialRows] = useState<StockRow[]>([]);
  const [scanning, setScanning]       = useState(false);
  const [scanError, setScanError]     = useState("");
  const [progress, setProgress]       = useState(0);
  const [receivedCount, setReceivedCount] = useState(0);
  const [selectedStock, setSelectedStock] = useState<StockRow | null>(null);
  const [activeTab, setActiveTab]     = useState<Tab>("top10");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");

  const [wGrowth, setWGrowth] = useState(33);
  const [wProfit, setWProfit] = useState(33);
  const [wValue,  setWValue]  = useState(34);

  const totalWeight = wGrowth + wProfit + wValue;

  const dailyQuote = useMemo(() => {
    const day = new Date().getDate();
    return BUFFETT_QUOTES[day % BUFFETT_QUOTES.length];
  }, []);

  const runScan = useCallback(() => {
    setScanning(true);
    setScanError("");
    setProgress(0);
    setResults(null);
    setPartialRows([]);
    setReceivedCount(0);

    const url = `/api/scan/stream?growth=${wGrowth}&profitability=${wProfit}&valuation=${wValue}`;
    const es = new EventSource(url);
    let total: number = ALL_TICKERS.length;
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
      } catch { /* ignore parse errors */ }
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

  // Filtered rows by market
  const filteredRows = (rows: StockRow[]) => {
    if (marketFilter === "all") return rows;
    return rows.filter((r) => {
      const meta = SECTOR_META[getSector(r.symbol)];
      return meta.market === marketFilter;
    });
  };

  const validRows     = results ? filteredRows(results.valid) : [];
  const valueCount    = validRows.filter((r) => r.isValuePlay).length;
  const leader        = validRows[0];
  const avgScore      = validRows.length
    ? validRows.reduce((s, r) => s + (r.score ?? 0), 0) / validRows.length
    : 0;
  const greenCount    = validRows.filter((r) => (r.score ?? 0) >= 60).length;
  const failedCount   = results ? results.allRows.length - results.valid.length : 0;
  const top10         = validRows.slice(0, 10);

  const TABS: { key: Tab; label: string }[] = [
    { key: "top10",   label: "Top 10" },
    { key: "all",     label: `All (${validRows.length})` },
    { key: "value",   label: `Value (${valueCount})` },
    { key: "sectors", label: "Sectors" },
    { key: "heatmap", label: "Heatmap" },
  ];

  return (
    <div className="min-h-screen bg-grid" style={{ background: "linear-gradient(180deg, #080c18 0%, #060912 100%)" }}>

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 border-b" style={{ background: "rgba(6,9,18,0.9)", backdropFilter: "blur(20px)", borderColor: "rgba(99,102,241,0.12)" }}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)", boxShadow: "0 0 16px rgba(99,102,241,0.4)" }}>
              <BarChart3 size={15} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight gradient-text-brand">Discovery Agent</span>
              <span className="text-xs ml-1.5 hidden sm:inline" style={{ color: "rgba(148,163,184,0.5)" }}>Stock Scanner</span>
            </div>
          </div>

          {/* Market filter */}
          <div className="hidden md:flex items-center gap-1 rounded-xl p-1 border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(99,102,241,0.15)" }}>
            {(["all", "US", "IL"] as MarketFilter[]).map((m) => (
              <button
                key={m}
                onClick={() => setMarketFilter(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  marketFilter === m ? "tab-active" : "tab-inactive"
                }`}
              >
                {m === "all" ? <><Globe size={11} /> All Markets</> : m === "US" ? "🇺🇸 US" : "🇮🇱 Israel"}
              </button>
            ))}
          </div>

          {/* Center info */}
          <div className="hidden lg:flex items-center gap-2 text-xs" style={{ color: "rgba(148,163,184,0.5)" }}>
            <span>{ALL_TICKERS.length} tickers · US + IL</span>
            {results?.scannedAt && (
              <><span>·</span>
              <span suppressHydrationWarning>Last scan: {new Date(results.scannedAt).toLocaleTimeString()}</span></>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {results && (
              <button
                onClick={downloadCSV}
                className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer glass-hover glass-sm"
                style={{ color: "rgba(148,163,184,0.7)" }}
              >
                <Download size={13} /> Export CSV
              </button>
            )}
            <button
              onClick={runScan}
              disabled={scanning}
              className="btn-scan flex items-center gap-2 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {scanning
                ? <RefreshCw size={14} className="animate-spin" />
                : <ScanLine size={14} />}
              {scanning
                ? receivedCount > 0 ? `${receivedCount}/${ALL_TICKERS.length}` : "Scanning…"
                : "Run Scan"}
            </button>
          </div>
        </div>

        {/* Progress */}
        {scanning && (
          <div className="h-0.5 overflow-hidden" style={{ background: "rgba(99,102,241,0.1)" }}>
            <div className="progress-bar h-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </nav>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Controls ────────────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5 depth-2">
          <div className="flex flex-wrap items-start gap-6">

            {/* Buffett Filter badge */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
                  style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                  ✦
                </div>
                <span className="text-xs font-bold uppercase tracking-widest gradient-text-gold">Buffett Filter</span>
              </div>
              <div className="text-xs font-mono px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24" }}>
                P/E &lt;20 · D/E &lt;50
              </div>
            </div>

            <div className="w-px self-stretch" style={{ background: "rgba(99,102,241,0.15)" }} />

            {/* Scoring sliders */}
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-2 mb-3">
                <Layers size={13} style={{ color: "rgba(148,163,184,0.6)" }} />
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(148,163,184,0.7)" }}>Scoring Weights</h2>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <WeightSlider label="Growth"        value={wGrowth} onChange={setWGrowth} color="#22d3ee" />
                <WeightSlider label="Profitability" value={wProfit} onChange={setWProfit} color="#818cf8" />
                <WeightSlider label="Valuation"     value={wValue}  onChange={setWValue}  color="#fbbf24" />
              </div>
            </div>

            <div
              className="flex items-center self-start mt-6 text-xs font-bold px-3 py-1.5 rounded-lg tabular-nums transition-all"
              style={{
                background: totalWeight === 100 ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)",
                border: `1px solid ${totalWeight === 100 ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)"}`,
                color: totalWeight === 100 ? "#34d399" : "#fb7185",
              }}
            >
              {totalWeight}% {totalWeight === 100 ? "✓" : "≠100"}
            </div>

            <div className="w-px self-stretch" style={{ background: "rgba(99,102,241,0.15)" }} />

            {/* Free-form search */}
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-3">
                <Search size={13} style={{ color: "rgba(148,163,184,0.6)" }} />
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(148,163,184,0.7)" }}>Free-Form Analysis</h2>
              </div>
              <StockSearch
                weights={{ growth: wGrowth, profitability: wProfit, valuation: wValue }}
                onResult={handleSelectStock}
              />
            </div>
          </div>
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {scanError && (
          <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
            style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)", color: "#fb7185" }}>
            <AlertCircle size={14} /> {scanError}
          </div>
        )}

        {/* ── Buffett quote / empty state ─────────────────────────────────── */}
        {!results && !scanning && (
          <div className="glass rounded-2xl py-20 flex flex-col items-center gap-5 depth-2 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 50% 80%, rgba(99,102,241,0.08) 0%, transparent 70%)" }} />

            <div className="w-14 h-14 rounded-2xl flex items-center justify-center relative"
              style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.08))", border: "1px solid rgba(99,102,241,0.3)" }}>
              <ScanLine size={24} style={{ color: "#818cf8" }} />
            </div>

            <div className="text-center px-6 max-w-lg">
              <blockquote className="italic text-sm mb-2" style={{ color: "rgba(148,163,184,0.8)" }}>
                &ldquo;{dailyQuote.text}&rdquo;
              </blockquote>
              <cite className="text-xs font-semibold gradient-text-gold not-italic">Warren Buffett · {dailyQuote.context}</cite>
            </div>

            <div className="text-center">
              <div className="font-bold text-lg gradient-text">Ready to Scan</div>
              <div className="text-sm mt-1" style={{ color: "rgba(148,163,184,0.5)" }}>
                {ALL_TICKERS.length} tickers · US mega-cap, semis, software, healthcare, Israeli NASDAQ &amp; TASE
              </div>
            </div>
            <button
              onClick={runScan}
              className="btn-scan flex items-center gap-2 text-white font-semibold px-7 py-3 rounded-xl text-sm cursor-pointer"
            >
              <ScanLine size={16} /> Start Scan <ChevronRight size={16} />
            </button>
            <p className="text-xs" style={{ color: "rgba(148,163,184,0.35)" }}>
              ~30–60 sec · parallel fetch · results stream live
            </p>
          </div>
        )}

        {/* ── Live partial results ─────────────────────────────────────────── */}
        {scanning && partialRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "rgba(148,163,184,0.8)" }}>
                <div className="pulse-dot w-2 h-2 rounded-full bg-indigo-400" />
                Live results — {receivedCount} / {ALL_TICKERS.length} fetched
              </div>
              <span className="text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>Table updates in real-time</span>
            </div>
            <RankedTable
              rows={partialRows.filter((r) => r.score != null).slice(0, 20)}
              onSelect={handleSelectStock}
              title={`Top results so far (${partialRows.filter(r => r.score != null).length} scored)`}
              compact
            />
          </div>
        )}

        {/* ── Skeleton ─────────────────────────────────────────────────────── */}
        {scanning && partialRows.length === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-2xl h-24 skeleton" />
              ))}
            </div>
            <div className="rounded-2xl h-64 skeleton" />
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {results && !scanning && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <MetricCard label="Scanned"      value={`${results.valid.length}/${results.allRows.length}`} sub={`${failedCount} no data`}        accent="default" icon={<BarChart3 size={15} />} />
              <MetricCard label="Avg Score"    value={avgScore.toFixed(1)}                                 sub="out of 100"                       accent="purple"  icon={<Target size={15} />} />
              <MetricCard label="Strong 60+"   value={greenCount}                                          sub="high conviction"                  accent="green"   icon={<TrendingUp size={15} />} />
              <MetricCard label="Value Plays"  value={valueCount}                                          sub="P/E < 20, D/E < 50"               accent="gold"    icon={<Star size={15} />} />
              {leader && (
                <MetricCard label="Leader" value={leader.symbol} sub={`Score ${(leader.score ?? 0).toFixed(1)}`} accent="cyan" icon={<TrendingUp size={15} />} />
              )}
            </div>

            {/* Buffett quote strip */}
            <div className="rounded-xl px-4 py-2.5 flex items-center gap-3"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <span className="text-xs gradient-text-gold flex-shrink-0 font-semibold">✦ Buffett</span>
              <span className="text-xs italic flex-1 min-w-0 truncate" style={{ color: "rgba(148,163,184,0.7)" }}>
                &ldquo;{dailyQuote.text}&rdquo;
              </span>
              <span className="text-xs hidden sm:block flex-shrink-0" style={{ color: "rgba(148,163,184,0.4)" }}>{dailyQuote.context}</span>
            </div>

            {/* Market filter (mobile) */}
            <div className="flex md:hidden items-center gap-1 rounded-xl p-1 w-fit border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(99,102,241,0.15)" }}>
              {(["all", "US", "IL"] as MarketFilter[]).map((m) => (
                <button key={m} onClick={() => setMarketFilter(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${marketFilter === m ? "tab-active" : "tab-inactive"}`}>
                  {m === "all" ? "All" : m === "US" ? "🇺🇸 US" : "🇮🇱 IL"}
                </button>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl p-1 w-fit border overflow-x-auto" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(99,102,241,0.15)" }}>
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === key ? "tab-active" : "tab-inactive"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── TOP 10 ─────────────────────────────────────────────────── */}
            {activeTab === "top10" && (
              <div className="space-y-5">
                <RankedTable rows={top10} onSelect={handleSelectStock} title="Top 10 — Ranked by Score" />
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <h3 className="text-sm font-semibold text-slate-200">Detail View</h3>
                    <span className="text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>Click any card to open full analysis</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {top10.map((stock, i) => (
                      <Top10Card key={stock.symbol} stock={stock} rank={i + 1} onClick={() => handleSelectStock(stock)} />
                    ))}
                  </div>
                </div>
                {validRows.length > 10 && (
                  <RankedTable
                    rows={validRows.slice(10)}
                    onSelect={handleSelectStock}
                    title={`Ranks 11–${validRows.length}`}
                    compact
                  />
                )}
              </div>
            )}

            {/* ── ALL / VALUE ─────────────────────────────────────────────── */}
            {(activeTab === "all" || activeTab === "value") && (
              <ScannerTable
                rows={validRows}
                onSelectStock={handleSelectStock}
                filterValue={activeTab === "value"}
              />
            )}

            {/* ── SECTORS ─────────────────────────────────────────────────── */}
            {activeTab === "sectors" && (
              <SectorChart rows={validRows} />
            )}

            {/* ── HEATMAP ─────────────────────────────────────────────────── */}
            {activeTab === "heatmap" && (
              <MarketHeatmap rows={validRows} onSelect={handleSelectStock} />
            )}
          </>
        )}

        <footer className="text-center text-xs pb-4 pt-2" style={{ color: "rgba(148,163,184,0.3)" }}>
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
    <div className="glass rounded-2xl overflow-hidden depth-2">
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(99,102,241,0.12)" }}>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <span className="text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>{rows.length} stocks</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead style={{ borderBottom: "1px solid rgba(99,102,241,0.1)", background: "rgba(0,0,0,0.2)" }}>
            <tr>
              {["#", "Symbol", !compact && "Name / Sector", "Score", "Price", "Day %", "P/E", "Fwd P/E", "EPS YoY", "Rev YoY", "Op Margin", "Mkt Cap", !compact && "Insight"]
                .filter(Boolean)
                .map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: "rgba(148,163,184,0.5)" }}>
                    {h}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const rank = row.rank ?? (i + 1);
              const score = row.score ?? 0;
              const sectorMeta = SECTOR_META[getSector(row.symbol)];
              return (
                <tr
                  key={row.symbol}
                  onClick={() => onSelect(row)}
                  className="table-row-hover group"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                >
                  <td className="px-4 py-3 text-xs tabular-nums font-bold" style={{ color: "rgba(148,163,184,0.35)" }}>{rank}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors">{row.symbol}</span>
                      {row.isValuePlay && <ValueBadge isValuePlay />}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sectorMeta.color }} />
                      <span className="text-xs" style={{ color: sectorMeta.color + "bb" }}>{sectorMeta.label}</span>
                    </div>
                  </td>
                  {!compact && (
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-300 max-w-[150px] truncate">{row.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(148,163,184,0.45)" }}>{row.sector}</div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <ScoreBadge score={score} size="sm" />
                      <TrafficLight score={score} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold tabular-nums whitespace-nowrap text-slate-200">
                    {fmtPrice(row.price, row.symbol, row.currency)}
                  </td>
                  <td className="px-4 py-3"><DayChangeBadge value={row.dayChange} /></td>
                  <td className="px-4 py-3 text-sm tabular-nums" style={{ color: "rgba(148,163,184,0.8)" }}>{fmtNum(row.peRatio, 1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums" style={{ color: "rgba(148,163,184,0.6)" }}>{fmtNum(row.forwardPE, 1)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm tabular-nums font-semibold ${(row.earningsGrowth ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmtPct(row.earningsGrowth)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm tabular-nums font-semibold ${(row.revenueGrowth ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmtPct(row.revenueGrowth)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums" style={{ color: "rgba(148,163,184,0.8)" }}>{fmtPct(row.operatingMargin)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums whitespace-nowrap" style={{ color: "rgba(148,163,184,0.6)" }}>{row.marketCapDisplay ?? "—"}</td>
                  {!compact && (
                    <td className="px-4 py-3 text-xs max-w-[180px]" style={{ color: "rgba(148,163,184,0.5)" }}>
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
  const sectorMeta = SECTOR_META[getSector(stock.symbol)];
  const score = stock.score ?? 0;

  return (
    <button
      onClick={onClick}
      className="glass rounded-2xl p-5 text-left glass-hover depth-2 cursor-pointer group w-full relative overflow-hidden"
    >
      {/* Corner glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${sectorMeta.color}18, transparent 70%)` }} />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
            style={{ background: `${sectorMeta.color}20`, border: `1px solid ${sectorMeta.color}40`, color: sectorMeta.color }}>
            {rank}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-base text-slate-100 group-hover:text-indigo-300 transition-colors">{stock.symbol}</span>
              {stock.isValuePlay && <ValueBadge isValuePlay />}
              <DayChangeBadge value={stock.dayChange} />
            </div>
            <div className="text-xs mt-0.5 line-clamp-1" style={{ color: "rgba(148,163,184,0.6)" }}>{stock.name}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sectorMeta.color, boxShadow: `0 0 4px ${sectorMeta.color}` }} />
              <span className="text-xs" style={{ color: sectorMeta.color + "cc" }}>{sectorMeta.label}</span>
            </div>
          </div>
        </div>
        <ScoreBadge score={score} />
      </div>

      {/* Mini metrics */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-3">
        <MiniMetric label="Price"     value={fmtPrice(stock.price, stock.symbol, stock.currency)} />
        <MiniMetric label="P/E"       value={fmtNum(stock.peRatio, 1)} />
        <MiniMetric label="Fwd P/E"   value={fmtNum(stock.forwardPE, 1)} />
        <MiniMetric label="EPS YoY"   value={fmtPct(stock.earningsGrowth)}  positive={stock.earningsGrowth != null && stock.earningsGrowth > 0} />
        <MiniMetric label="Rev YoY"   value={fmtPct(stock.revenueGrowth)}   positive={stock.revenueGrowth  != null && stock.revenueGrowth  > 0} />
        <MiniMetric label="Op Margin" value={fmtPct(stock.operatingMargin)} />
      </div>

      {/* Forward estimates */}
      {(stock.forecasts?.nextQEps != null || stock.forecasts?.nextYRevenue != null) && (
        <div className="flex gap-4 py-2 mb-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {stock.forecasts?.nextQEps != null && (
            <div className="text-xs">
              <span style={{ color: "rgba(148,163,184,0.5)" }}>Fwd EPS (Q): </span>
              <span className="font-semibold text-slate-200">${stock.forecasts.nextQEps.toFixed(2)}</span>
              {stock.forecasts.nextQEpsGrowth != null && (
                <span className={`ml-1 ${stock.forecasts.nextQEpsGrowth >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {fmtPct(stock.forecasts.nextQEpsGrowth)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Score bar */}
      <TrafficLight score={score} width="w-full" />
      {stock.insight && (
        <div className="mt-2 text-xs line-clamp-1" style={{ color: "rgba(148,163,184,0.45)" }}>{stock.insight}</div>
      )}
    </button>
  );
}

// ─── Weight Slider ─────────────────────────────────────────────────────────────

function WeightSlider({
  label, value, onChange, color,
}: {
  label: string; value: number; onChange: (v: number) => void; color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: "rgba(148,163,184,0.6)" }}>{label}</span>
        <span className="text-xs font-black tabular-nums" style={{ color }}>{value}%</span>
      </div>
      <div className="relative h-1.5 rounded-full mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: color, boxShadow: `0 0 8px ${color}60` }}
        />
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer opacity-0 h-1.5 mt-[-6px] relative"
        aria-label={`${label} weight`}
      />
    </div>
  );
}

// ─── Traffic Light Score Bar ──────────────────────────────────────────────────

function TrafficLight({ score, width = "w-20" }: { score: number; width?: string }) {
  const isGreen  = score >= 65;
  const isYellow = score >= 40 && score < 65;
  const color    = isGreen ? "#10b981" : isYellow ? "#f59e0b" : "#f43f5e";
  const glow     = isGreen
    ? "0 0 10px rgba(16,185,129,0.6), 0 0 20px rgba(16,185,129,0.25)"
    : isYellow
    ? "0 0 10px rgba(245,158,11,0.6), 0 0 20px rgba(245,158,11,0.25)"
    : "0 0 10px rgba(244,63,94,0.5), 0 0 20px rgba(244,63,94,0.2)";
  return (
    <div className={`h-1.5 rounded-full overflow-hidden ${width}`} style={{ background: "rgba(255,255,255,0.06)" }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(score, 100)}%`, background: color, boxShadow: glow }}
      />
    </div>
  );
}

// ─── Mini Metric ───────────────────────────────────────────────────────────────

function MiniMetric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: "rgba(148,163,184,0.45)" }}>{label}</div>
      <div className={`text-sm font-bold tabular-nums leading-tight ${
        positive === true  ? "text-emerald-400"
        : positive === false ? "text-rose-400"
        : "text-slate-200"
      }`}>
        {value}
      </div>
    </div>
  );
}
