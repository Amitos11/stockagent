"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { StockRow, ScanWeights, EarningsHistory } from "@/lib/types";
import { computeWeightedScore, isValuePlay } from "@/lib/scoring";
import { buildSectorPEMap } from "@/lib/signals";
import { ALL_TICKERS, BUFFETT_QUOTES } from "@/lib/tickers";

import { Hero }            from "@/components/crystal/Hero";
import { TopNav }          from "@/components/crystal/TopNav";
import { ControlsPanel }   from "@/components/crystal/ControlsPanel";
import { MetricCards }     from "@/components/crystal/MetricCards";
import { Tabs }            from "@/components/crystal/Tabs";
import type { TabId }      from "@/components/crystal/Tabs";
import { ResultsTable }    from "@/components/crystal/ResultsTable";
import { SectorBreakdown } from "@/components/crystal/SectorBreakdown";
import { Heatmap }         from "@/components/crystal/Heatmap";
import { StockDrawer }     from "@/components/crystal/StockDrawer";

const WATCHLIST_KEY = "stockagent-watchlist-v1";

function loadWatchlist(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function saveWatchlist(s: Set<string>) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...s]));
}

function exportCsv(rows: StockRow[]) {
  const headers = ["Symbol","Name","Sector","Score","Price","Day%","P/E","RevGrowth%","OpMargin%","MarketCap"];
  const lines = rows.map((r) => [
    r.symbol, r.name ?? "", r.sector ?? "", (r.score ?? 0).toFixed(1),
    (r.price ?? "").toString(), (r.dayChange ?? "").toString(),
    (r.peRatio ?? "").toString(),
    r.revenueGrowth != null ? (r.revenueGrowth * 100).toFixed(1) : "",
    r.operatingMargin != null ? (r.operatingMargin * 100).toFixed(1) : "",
    (r.marketCap ?? "").toString(),
  ].join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = `stockagent-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function DashboardPage() {
  const [partialRows, setPartialRows]     = useState<StockRow[]>([]);
  const [scanning, setScanning]           = useState(false);
  const [progress, setProgress]           = useState(0);
  const [selectedStock, setSelectedStock] = useState<StockRow | null>(null);
  const [newestSymbol, setNewestSymbol]   = useState("");
  const [activeTab, setActiveTab]         = useState<TabId>("top10");
  const [marketFilter, setMarketFilter]   = useState<string>("All");
  const [scanSize, setScanSize]           = useState<number | string>(500);
  const [buffett, setBuffett]             = useState(false);
  const [search, setSearch]               = useState("");
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const [watchlist, setWatchlist]         = useState<Set<string>>(new Set());
  const [weights, setWeights]             = useState<ScanWeights>({ growth: 34, profitability: 33, valuation: 33 });
  const [analyzing, setAnalyzing]         = useState(false);
  const [analyzeError, setAnalyzeError]   = useState("");
  const [earningsMap, setEarningsMap]     = useState<Record<string, EarningsHistory>>({});

  useEffect(() => { setWatchlist(loadWatchlist()); }, []);

  const dailyQuote = useMemo((): [string, string] | null => {
    const day = new Date().getDate();
    const q = BUFFETT_QUOTES[day % BUFFETT_QUOTES.length];
    return q ? [q.text, q.context] : null;
  }, []);

  const toggleWatch = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol); else next.add(symbol);
      saveWatchlist(next);
      return next;
    });
  }, []);

  const totalTickers = useMemo(() => {
    const limit = scanSize === "All" ? ALL_TICKERS.length : Number(scanSize);
    return Math.min(ALL_TICKERS.length, limit);
  }, [scanSize]);

  const runScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setPartialRows([]);
    setProgress(0);
    setHeroCollapsed(true);

    const params = new URLSearchParams({
      growth:        String(weights.growth),
      profitability: String(weights.profitability),
      valuation:     String(weights.valuation),
      limit:         scanSize === "All" ? "9999" : String(scanSize),
    });

    const es = new EventSource(`/api/scan/stream?${params}`);
    const accumulated: StockRow[] = [];

    // Server sends unnamed SSE events — all arrive as "message" with {type, data}
    es.onmessage = (e) => {
      const { type, data } = JSON.parse(e.data) as { type: string; data?: unknown };

      if (type === "stock") {
        const row: StockRow = (data as { row: StockRow }).row;
        const idx = accumulated.findIndex((r) => r.symbol === row.symbol);
        if (idx >= 0) accumulated[idx] = row; else accumulated.push(row);
        const sorted = [...accumulated].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        setPartialRows(sorted);
        setNewestSymbol(row.symbol);
        const total = (data as { total?: number }).total ?? totalTickers;
        if (total > 0) setProgress(accumulated.length / total);
      } else if (type === "complete") {
        // Cache path: a cached result arrives as a SINGLE complete event with the
        // full ranked payload and no preceding stock events. Hydrate the table
        // from it, otherwise repeat scans of the same weights/size show nothing.
        if (accumulated.length === 0 && data) {
          const result = data as { valid?: StockRow[]; allRows?: StockRow[] };
          const rows = result.valid ?? result.allRows ?? [];
          if (rows.length) {
            accumulated.push(...rows);
            setPartialRows([...rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)));
          }
        }
        es.close();
        setScanning(false);
        setProgress(1);
      } else if (type === "error") {
        es.close();
        setScanning(false);
      }
    };

    es.onerror = () => { es.close(); setScanning(false); };
  }, [scanning, weights, marketFilter, scanSize, totalTickers]);

  // Analyze any ticker on demand — even one the scan never covered.
  const analyzeTicker = useCallback(async (raw: string) => {
    const sym = raw.trim().toUpperCase();
    if (!sym || analyzing) return;
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const qs = new URLSearchParams({
        growth:        String(weights.growth),
        profitability: String(weights.profitability),
        valuation:     String(weights.valuation),
      });
      const res = await fetch(`/api/stock/${encodeURIComponent(sym)}?${qs}`);
      const row: StockRow = await res.json();
      if (!res.ok || row.error || row.price == null) {
        setAnalyzeError(`Couldn't find data for "${sym}". Check the ticker (US symbols, or .TA for TASE).`);
        return;
      }
      // Fold it into the result set so it stays available, then open the drawer.
      setPartialRows((prev) =>
        prev.some((r) => r.symbol === row.symbol) ? prev : [...prev, row]
      );
      setSelectedStock(row);
    } catch {
      setAnalyzeError(`Lookup failed for "${sym}". Try again.`);
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, weights]);

  // Re-rank instantly when weights change — no server round-trip
  const liveRows = useMemo(() => {
    if (!partialRows.length) return [];
    return [...partialRows]
      .map((r) => ({ ...r, score: computeWeightedScore(r, weights) }))
      .sort((a, b) => b.score - a.score);
  }, [partialRows, weights]);

  const filteredRows = useMemo(() => {
    let rows = liveRows;
    if (marketFilter !== "All") {
      rows = rows.filter((r) =>
        marketFilter === "US" ? !r.symbol.endsWith(".TA") : r.symbol.endsWith(".TA")
      );
    }
    if (buffett) rows = rows.filter((r) => isValuePlay(r));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) =>
        r.symbol.toLowerCase().includes(q) || (r.name ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [liveRows, marketFilter, buffett, search]);

  const top10Rows    = useMemo(() => filteredRows.slice(0, 10), [filteredRows]);
  const valuePlays   = useMemo(() => filteredRows.filter((r) => isValuePlay(r)), [filteredRows]);
  const watchlistRows = useMemo(() => filteredRows.filter((r) => watchlist.has(r.symbol)), [filteredRows, watchlist]);
  const sectorPEMap  = useMemo(() => buildSectorPEMap(liveRows), [liveRows]);

  const tabCounts = useMemo(() => ({
    top10:     top10Rows.length,
    all:       filteredRows.length,
    value:     valuePlays.length,
    watchlist: watchlistRows.length,
  }), [top10Rows, filteredRows, valuePlays, watchlistRows]);

  // Keep drawer stock data fresh as re-ranks arrive
  useEffect(() => {
    if (!selectedStock) return;
    const updated = liveRows.find((r) => r.symbol === selectedStock.symbol);
    if (updated) setSelectedStock(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRows]);

  const tableRows =
    activeTab === "top10"     ? top10Rows :
    activeTab === "value"     ? valuePlays :
    activeTab === "watchlist" ? watchlistRows :
    filteredRows;

  // Lazy-load earnings beat/miss for the rows actually on screen (capped).
  // Earnings data is per-stock and slow, so we never fetch it for all 500 —
  // only the visible tab's first rows, and only symbols we haven't seen.
  const visibleSymbols = useMemo(
    () => tableRows.slice(0, 30).map((r) => r.symbol),
    [tableRows]
  );
  useEffect(() => {
    if (scanning) return;
    const missing = visibleSymbols.filter((s) => !(s in earningsMap));
    if (!missing.length) return;
    let cancelled = false;
    fetch(`/api/earnings?symbols=${encodeURIComponent(missing.join(","))}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, EarningsHistory>) => {
        if (cancelled) return;
        // Record every requested symbol (even ones with no data) so we don't refetch.
        setEarningsMap((prev) => {
          const next = { ...prev };
          for (const s of missing) next[s] = data[s] ?? {};
          return next;
        });
      })
      .catch(() => { /* leave unmarked */ });
    return () => { cancelled = true; };
  }, [visibleSymbols, scanning]); // eslint-disable-line react-hooks/exhaustive-deps

  const emptyHint =
    !liveRows.length && !scanning          ? "Run a scan to see results" :
    activeTab === "watchlist" && !watchlistRows.length ? "Star stocks to build your watchlist" :
    activeTab === "value" && !valuePlays.length ? "No value plays with current filters" :
    undefined;

  return (
    <>
      <div className="bg-glows" aria-hidden="true">
        <div className="bgg g1" /><div className="bgg g2" /><div className="bgg g3" />
      </div>

      <TopNav
        market={marketFilter}
        setMarket={setMarketFilter}
        scanSize={scanSize}
        setScanSize={setScanSize}
        onRunScan={runScan}
        scanning={scanning}
        progress={progress}
        resultsCount={liveRows.length}
        onExportCsv={() => exportCsv(filteredRows)}
      />

      <main className="main-layout">
        <Hero collapsed={heroCollapsed} quote={dailyQuote} glow={scanning ? 1.4 : 1} />

        <ControlsPanel
          weights={weights}
          setWeights={setWeights}
          buffett={buffett}
          setBuffett={setBuffett}
          search={search}
          setSearch={setSearch}
          tilt
          onAnalyze={analyzeTicker}
          analyzing={analyzing}
          analyzeError={analyzeError}
          hasExactMatch={liveRows.some((r) => r.symbol === search.trim().toUpperCase())}
        />

        {liveRows.length > 0 || scanning ? (
          <>
            <MetricCards rows={liveRows} scanning={scanning} tilt />
            <Tabs tab={activeTab} setTab={setActiveTab} counts={tabCounts} />

            {activeTab === "sectors" ? (
              <SectorBreakdown rows={filteredRows} onSelect={setSelectedStock} />
            ) : activeTab === "heatmap" ? (
              <Heatmap rows={filteredRows} onSelect={setSelectedStock} />
            ) : (
              <ResultsTable
                rows={tableRows}
                onSelect={setSelectedStock}
                scanning={scanning}
                newest={newestSymbol}
                watchlist={watchlist}
                onToggleWatch={toggleWatch}
                sectorPEMap={sectorPEMap}
                emptyHint={emptyHint}
                earningsMap={earningsMap}
              />
            )}
          </>
        ) : (
          <div className="empty-state glass depth-1">
            <p className="empty-hint">Click <strong>Run Scan</strong> to scan up to {ALL_TICKERS.length} stocks</p>
          </div>
        )}
      </main>

      {selectedStock && (
        <StockDrawer
          stock={selectedStock}
          weights={weights}
          sectorPEMap={sectorPEMap}
          onClose={() => setSelectedStock(null)}
          watched={watchlist.has(selectedStock.symbol)}
          onToggleWatch={() => toggleWatch(selectedStock.symbol)}
        />
      )}
    </>
  );
}
