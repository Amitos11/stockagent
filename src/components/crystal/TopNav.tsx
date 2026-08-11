"use client";

interface Props {
  market: string;
  setMarket: (v: string) => void;
  scanSize: number | string;
  setScanSize: (v: number | string) => void;
  onRunScan: () => void;
  scanning: boolean;
  progress: number;
  resultsCount: number;
  onExportCsv: () => void;
}

export function TopNav({
  market, setMarket,
  scanSize, setScanSize,
  onRunScan, scanning, progress,
  resultsCount, onExportCsv,
}: Props) {
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <div className="brand">
          <span className="brand-orb" aria-hidden="true" />
          <span className="brand-name">StockAgent</span>
          <span className="brand-tag">SCREENER</span>
        </div>

        <nav className="nav-controls" aria-label="Scan controls">
          <div className="seg" role="group" aria-label="Market filter">
            {(["All", "US", "IL", "OTC"] as const).map((v) => (
              <button
                key={v}
                className={`seg-btn${market === v ? " on" : ""}`}
                onClick={() => setMarket(v)}
                title={v === "OTC" ? "Curated OTC / ADR blue-chips — a separate scan, not folded into the regular one" : undefined}
              >
                {v === "All" ? "All" : v === "US" ? "🇺🇸 US" : v === "IL" ? "🇮🇱 Israel" : "OTC"}
              </button>
            ))}
          </div>
          {market !== "OTC" && (
            <div className="seg" role="group" aria-label="Scan size">
              {([100, 250, 500, "All"] as const).map((v) => (
                <button
                  key={v}
                  className={`seg-btn${scanSize === v ? " on" : ""}`}
                  onClick={() => setScanSize(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          <button className="ghost-btn" disabled={!resultsCount} onClick={onExportCsv}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
          <button
            className={`run-btn${scanning ? " scanning" : ""}`}
            onClick={onRunScan}
            disabled={scanning}
          >
            {scanning ? (
              <>
                <span className="live-dot" aria-hidden="true" />
                Scanning {Math.round(progress * 100)}%
              </>
            ) : (
              <>
                Run Scan<span className="run-arrow" aria-hidden="true">→</span>
              </>
            )}
          </button>
        </nav>
      </div>
      <div
        className="progress-beam"
        style={{
          transform: `scaleX(${scanning || progress > 0 ? progress : 0})`,
          opacity: scanning ? 1 : 0,
        }}
        aria-hidden="true"
      />
    </header>
  );
}
