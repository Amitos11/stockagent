"use client";

import { useState, useCallback } from "react";
import {
  ScanLine, TrendingUp, BarChart3, Target, Layers,
  RefreshCw, Download, Search, ChevronRight, AlertCircle, Sparkles,
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

const BUFFETT_QUOTES = [
  { quote: "Price is what you pay. Value is what you get.", context: "Focus on intrinsic value, not noise." },
  { quote: "It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.", context: "Quality beats cheap." },
  { quote: "Our favorite holding period is forever.", context: "Think long-term." },
  { quote: "Be fearful when others are greedy, and greedy when others are fearful.", context: "Contrarian edge." },
  { quote: "Risk comes from not knowing what you're doing.", context: "Do your homework." },
];

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
  const buffettQuote = BUFFETT_QUOTES[new Date().getDay() % BUFFETT_QUOTES.length];

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
      setScanError("Connection lost. Please try again.");
      setScanning(false);
      setProgress(0);
    };
  }, [wGrowth, wProfit, wValue]);

  const handleSelectStock  = useCallback((stock: StockRow) => setSelectedStock(stock), []);
  const handleSearchResult = useCallback((stock: StockRow) => {
    const cached = results?.allRows.find((r) => r.symbol === stock.symbol);
    setSelectedStock(cached ?? stock);
  }, [results]);

  const downloadCSV = useCallback(() => {
    if (!results) return;
    const headers = ["Rank","Symbol","Name","Sector","Score","Price","P/E","Forward P/E","EPS YoY","Rev YoY","Op Margin","ROE","D/E","Mkt Cap","Value Play","Next Earnings"];
    const rows = results.valid.map((r) => [
      r.rank ?? "", r.symbol, r.name ?? "", r.sector ?? "",
      (r.score ?? 0).toFixed(1), fmtPrice(r.price, r.symbol, r.currency),
      fmtNum(r.peRatio, 1), fmtNum(r.forwardPE, 1),
      fmtPct(r.earningsGrowth), fmtPct(r.revenueGrowth),
      fmtPct(r.operatingMargin), fmtPct(r.roe),
      fmtNum(r.debtToEquity, 1), r.marketCapDisplay ?? "",
      r.isValuePlay ? "Yes" : "No", r.nextEarnings ?? "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `stockagent-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const valueCount  = results?.valid.filter((r) => r.isValuePlay).length ?? 0;
  const leader      = results?.top10[0];
  const avgScore    = results?.valid.length ? results.valid.reduce((s,r) => s+(r.score??0),0)/results.valid.length : 0;
  const greenCount  = results?.valid.filter((r) => (r.score??0) >= 60).length ?? 0;
  const failedCount = results ? results.allRows.length - results.valid.length : 0;

  return (
    <div className="min-h-screen bg-page">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="navbar sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", boxShadow: "0 2px 8px rgba(22,163,74,0.35)" }}>
              <BarChart3 size={15} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm tracking-tight">StockAgent</span>
              <span className="text-xs text-slate-400 ml-2 hidden sm:inline">Market Scanner</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-medium">
              {TICKERS.length} tickers · US + IL
            </span>
            {results?.scannedAt && (
              <span suppressHydrationWarning className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                Last scan: {new Date(results.scannedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {results && (
              <button onClick={downloadCSV}
                className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md">
                <Download size={13} /> Export CSV
              </button>
            )}
            <button onClick={runScan} disabled={scanning} className="btn-scan flex items-center gap-2 text-white font-semibold text-sm px-4 py-2 rounded-xl cursor-pointer">
              {scanning ? <RefreshCw size={15} className="animate-spin" /> : <ScanLine size={15} />}
              {scanning ? (receivedCount > 0 ? `${receivedCount}/${TICKERS.length}` : "Scanning…") : "Run Scan"}
            </button>
          </div>
        </div>
        {scanning && (
          <div className="h-[3px] bg-slate-100 overflow-hidden">
            <div className="h-full progress-glow transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </nav>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Buffett Banner ──────────────────────────────────────────────── */}
        <div className="buffett-banner rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-lg select-none"
            style={{ background: "linear-gradient(135deg,#16a34a,#166534)", boxShadow: "0 4px 12px rgba(22,163,74,0.35)", fontFamily: "Georgia, serif" }}>
            W
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 italic leading-snug">
              &ldquo;{buffettQuote.quote}&rdquo;
            </p>
            <p className="text-xs text-green-700 mt-0.5 font-semibold">Warren Buffett · {buffettQuote.context}</p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-0.5 flex-shrink-0">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Buffett Filter</span>
            <span className="text-xs text-green-700 font-mono font-bold">P/E &lt;20 · D/E &lt;50</span>
          </div>
        </div>

        {/* ── Controls ────────────────────────────────────────────────────── */}
        <div className="card-float rounded-2xl p-5">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex-1 min-w-[280px]">
              <h2 className="text-xs font-semibold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Layers size={13} /> Scoring Weights
              </h2>
              <div className="grid grid-cols-3 gap-5">
                <WeightSlider label="Growth"        value={wGrowth} onChange={setWGrowth} color="text-green-600"  trackColor="#16a34a" />
                <WeightSlider label="Profitability" value={wProfit} onChange={setWProfit} color="text-blue-600"   trackColor="#3b82f6" />
                <WeightSlider label="Valuation"     value={wValue}  onChange={setWValue}  color="text-violet-600" trackColor="#7c3aed" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className={`text-sm font-bold px-3 py-1.5 rounded-xl border ${
                totalWeight === 100
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}>
                {totalWeight}% {totalWeight === 100 ? "✓" : "≠ 100"}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-xs font-semibold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Search size={13} /> Free-Form Analysis
              </h2>
              <StockSearch
                weights={{ growth: wGrowth, profitability: wProfit, valuation: wValue }}
                onResult={handleSearchResult}
                cachedSymbols={results?.allRows.map((r) => r.symbol) ?? []}
              />
            </div>
          </div>
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {scanError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2 shadow-sm">
            <AlertCircle size={14} /> {scanError}
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!results && !scanning && (
          <div className="card-float rounded-2xl py-24 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bento-hero">
              <Sparkles size={28} className="text-white" />
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-900 text-xl tracking-tight">Ready to Scan</div>
              <div className="text-sm text-slate-400 mt-1.5">
                {TICKERS.length} tickers · US mega-cap, semis, software, healthcare, Israeli NASDAQ &amp; TASE
              </div>
            </div>
            <button onClick={runScan}
              className="btn-scan mt-1 flex items-center gap-2 text-white font-semibold px-8 py-3 rounded-xl text-sm cursor-pointer">
              <ScanLine size={16} /> Start Scan <ChevronRight size={16} />
            </button>
            <p className="text-xs text-slate-400">~30–60 sec · parallel fetch · results stream live</p>
          </div>
        )}

        {/* ── Live results ────────────────────────────────────────────────── */}
        {scanning && partialRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <RefreshCw size={13} className="animate-spin text-green-600" />
                Live results — <span className="text-green-700 font-mono font-bold">{receivedCount}</span> / {TICKERS.length}
              </div>
            </div>
            <RankedTable rows={partialRows.filter(r=>r.score!=null).slice(0,20)} onSelect={handleSelectStock}
              title={`Top results so far (${partialRows.filter(r=>r.score!=null).length} scored)`} compact />
          </div>
        )}

        {/* ── Skeleton ────────────────────────────────────────────────────── */}
        {scanning && partialRows.length === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_,i) => <div key={i} className="rounded-2xl h-24 skeleton" />)}
            </div>
            <div className="rounded-2xl h-64 skeleton" />
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {results && !scanning && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <MetricCard label="Scanned"     value={`${results.valid.length}/${results.allRows.length}`} sub={`${failedCount} no data`} accent="default" icon={<BarChart3 size={14}/>} />
              <MetricCard label="Avg Score"   value={avgScore.toFixed(1)}   sub="out of 100"        accent="purple"  icon={<Target size={14}/>} />
              <MetricCard label="Strong 60+"  value={greenCount}             sub="high-conviction"   accent="green"   icon={<TrendingUp size={14}/>} />
              <MetricCard label="Value Plays" value={valueCount}             sub="P/E<20, D/E<50"    accent="gold"    icon={<BarChart3 size={14}/>} />
              {leader && <MetricCard label="Leader" value={leader.symbol} sub={`Score ${(leader.score??0).toFixed(1)}`} accent="green" icon={<TrendingUp size={14}/>} />}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-slate-200 shadow-sm rounded-xl p-1 w-fit">
              {(["top10","all","value"] as Tab[]).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === tab ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`} style={activeTab===tab ? { background:"linear-gradient(135deg,#16a34a,#15803d)", boxShadow:"0 2px 8px rgba(22,163,74,0.3)" } : {}}>
                  {tab==="top10" ? "Top 10" : tab==="all" ? `All Ranked (${results.valid.length})` : `Value Plays (${valueCount})`}
                </button>
              ))}
            </div>

            {activeTab === "top10" && (
              <div className="space-y-5">
                <RankedTable rows={results.top10} onSelect={handleSelectStock} title="Top 10 — Ranked by Score" />
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <h3 className="text-sm font-semibold text-slate-700">Detail Cards</h3>
                    <span className="text-xs text-slate-400">Click any card for full analysis</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.top10.map((stock,i) => (
                      <Top10Card key={stock.symbol} stock={stock} rank={i+1} onClick={() => handleSelectStock(stock)} />
                    ))}
                  </div>
                </div>
                {results.valid.length > 10 && (() => {
                  const rest   = results.valid.slice(10);
                  const nonRed = rest.filter(r => (r.score??0) >= 40);
                  const reds   = rest.filter(r => (r.score??0) <  40).slice(0,5);
                  const shown  = [...nonRed,...reds];
                  const hidden = rest.length - shown.length;
                  return <RankedTable rows={shown} onSelect={handleSelectStock}
                    title={`Ranks 11–${10+shown.length}${hidden>0?` (${hidden} weak hidden)`:""}`} compact />;
                })()}
              </div>
            )}

            {(activeTab==="all"||activeTab==="value") && (
              <ScannerTable rows={results.valid} onSelectStock={handleSelectStock} filterValue={activeTab==="value"} />
            )}
          </>
        )}

        <footer className="text-center text-xs text-slate-400 pb-4 pt-2">
          ⚠️ Automated analysis only. NOT investment advice. Data via Yahoo Finance &amp; FMP.
        </footer>
      </div>

      <StockDrawer stock={selectedStock} onClose={() => setSelectedStock(null)} />
    </div>
  );
}

// ─── Ranked Table ──────────────────────────────────────────────────────────────

function RankedTable({ rows, onSelect, title, compact=false }:{
  rows: StockRow[]; onSelect:(s:StockRow)=>void; title:string; compact?:boolean;
}) {
  return (
    <div className="card-float rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className="text-xs text-slate-400 font-mono">{rows.length} stocks</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-10">#</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Symbol</th>
              {!compact && <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Name / Sector</th>}
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Score</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Day %</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">P/E</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Fwd P/E</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">EPS YoY</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Rev YoY</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Op Margin</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mkt Cap</th>
              {!compact && <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Insight</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,i) => {
              const rank=row.rank??(i+1), score=row.score??0;
              return (
                <tr key={row.symbol} onClick={()=>onSelect(row)}
                  className="table-row-hover cursor-pointer border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3"><span className="text-xs font-bold text-slate-400 tabular-nums">{rank}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 hover:text-green-700 transition-colors">{row.symbol}</span>
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
                    <div className="flex flex-col gap-1.5">
                      <ScoreBadge score={score} size="sm" />
                      <div className="h-1 w-16 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${score>=60?"score-bar-green":score>=40?"score-bar-amber":"score-bar-red"}`}
                          style={{width:`${Math.min(score,100)}%`}} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">{fmtPrice(row.price,row.symbol,row.currency)}</td>
                  <td className="px-4 py-3"><DayChangeBadge value={row.dayChange} /></td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{fmtNum(row.peRatio,1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-400">{fmtNum(row.forwardPE,1)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm tabular-nums font-semibold ${(row.earningsGrowth??0)>=0?"text-green-600":"text-red-600"}`}>{fmtPct(row.earningsGrowth)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm tabular-nums font-semibold ${(row.revenueGrowth??0)>=0?"text-green-600":"text-red-600"}`}>{fmtPct(row.revenueGrowth)}</span>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{fmtPct(row.operatingMargin)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-400 whitespace-nowrap">{row.marketCapDisplay??"—"}</td>
                  {!compact && <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px]"><span className="line-clamp-1">{row.insight}</span></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Top 10 Card ───────────────────────────────────────────────────────────────

function Top10Card({ stock, rank, onClick }:{ stock:StockRow; rank:number; onClick:()=>void }) {
  const score = stock.score??0;
  const isTop3 = rank <= 3;
  return (
    <button onClick={onClick}
      className="card-float rounded-2xl p-5 text-left cursor-pointer w-full group relative overflow-hidden">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
        style={{ background: isTop3 ? "linear-gradient(90deg,#16a34a,#4ade80)" : "linear-gradient(90deg,#e2e8f0,#e2e8f0)" }} />

      <div className="flex items-start justify-between gap-3 mb-4 mt-1">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={isTop3
              ? { background:"linear-gradient(135deg,#16a34a,#15803d)", color:"#fff", boxShadow:"0 4px 12px rgba(22,163,74,0.3)" }
              : { background:"#f1f5f9", color:"#64748b" }}>
            {rank}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 group-hover:text-green-700 transition-colors">{stock.symbol}</span>
              {stock.isValuePlay && <ValueBadge isValuePlay />}
              <DayChangeBadge value={stock.dayChange} />
            </div>
            <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{stock.name}</div>
            {stock.sector && <div className="text-xs text-slate-400">{stock.sector}</div>}
          </div>
        </div>
        <ScoreBadge score={score} />
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-3 mb-4">
        <MiniMetric label="Price"    value={fmtPrice(stock.price,stock.symbol,stock.currency)} />
        <MiniMetric label="P/E"      value={fmtNum(stock.peRatio,1)} />
        <MiniMetric label="Fwd P/E"  value={fmtNum(stock.forwardPE,1)} />
        <MiniMetric label="EPS YoY"  value={fmtPct(stock.earningsGrowth)}  positive={stock.earningsGrowth!=null&&stock.earningsGrowth>0} />
        <MiniMetric label="Rev YoY"  value={fmtPct(stock.revenueGrowth)}   positive={stock.revenueGrowth!=null&&stock.revenueGrowth>0} />
        <MiniMetric label="Op Margin" value={fmtPct(stock.operatingMargin)} />
      </div>

      {(stock.forecasts?.nextQEps!=null||stock.forecasts?.nextYRevenue!=null) && (
        <div className="flex gap-4 py-2.5 border-t border-slate-100 mb-3">
          {stock.forecasts?.nextQEps!=null && (
            <div className="text-xs">
              <span className="text-slate-400">Fwd EPS (Q): </span>
              <span className="font-semibold text-slate-700">${stock.forecasts.nextQEps.toFixed(2)}</span>
              {stock.forecasts.nextQEpsGrowth!=null && (
                <span className={`ml-1 ${stock.forecasts.nextQEpsGrowth>=0?"text-green-600":"text-red-600"}`}>{fmtPct(stock.forecasts.nextQEpsGrowth)}</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${score>=60?"score-bar-green":score>=40?"score-bar-amber":"score-bar-red"}`}
          style={{width:`${Math.min(score,100)}%`}} />
      </div>
      {stock.insight && <div className="mt-2 text-xs text-slate-400 line-clamp-1">{stock.insight}</div>}
    </button>
  );
}

// ─── Weight Slider ─────────────────────────────────────────────────────────────

function WeightSlider({ label,value,onChange,color,trackColor }:{
  label:string;value:number;onChange:(v:number)=>void;color:string;trackColor:string;
}) {
  const step = (d:number) => onChange(Math.max(0,Math.min(100,value+d)));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`text-xs font-bold tabular-nums font-mono ${color}`}>{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value}
        onChange={e=>onChange(Number(e.target.value))}
        className="w-full cursor-pointer mb-2.5"
        style={{ color:trackColor, accentColor:trackColor,
          background:`linear-gradient(to right,${trackColor} 0%,${trackColor} ${value}%,#e2e8f0 ${value}%,#e2e8f0 100%)` }}
        aria-label={`${label} weight`}
      />
      <div className="flex items-center justify-between gap-1">
        <button onClick={()=>step(-5)}
          className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center transition-colors cursor-pointer select-none">−</button>
        <input type="number" min={0} max={100} value={value}
          onChange={e=>onChange(Math.max(0,Math.min(100,Number(e.target.value))))}
          className="w-12 text-center text-xs font-semibold font-mono border border-slate-200 rounded-md py-0.5 focus:outline-none focus:ring-1 focus:ring-green-500 tabular-nums bg-white" />
        <button onClick={()=>step(5)}
          className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center transition-colors cursor-pointer select-none">+</button>
      </div>
    </div>
  );
}

// ─── Mini Metric ───────────────────────────────────────────────────────────────

function MiniMetric({ label,value,positive }:{ label:string;value:string;positive?:boolean }) {
  return (
    <div>
      <div className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-semibold tabular-nums font-mono leading-tight ${
        positive===true?"text-green-600":positive===false?"text-red-600":"text-slate-800"
      }`}>{value}</div>
    </div>
  );
}
